# Apollo Portal源码分析——Client拉取配置

## 概述

Client轮询Config Service有两种方式

* RemoteConfigRepository，定时轮询Config Service的配置查询接口`/configs/{appId}/{clusterName}/{namespace:.+}`
* RemoteConfigLongPollService，长轮询Config Service的配置变更通知接口`notifications/v2`，当有新的通知时，触发RemoteConfigRepository，立即再查询`/configs/{appId}/{clusterName}/{namespace:.+}`接口获取配置

RemoteConfigRepository每个Namespace一个实例，但RemoteConfigLongPollService是单例的，多个RemoteConfigRepository注册到全局唯一的RemoteConfigLongPollService中。

## ConfigRepository

`com.ctrip.framework.apollo.internals.ConfigRepository`，配置 Repository 接口。代码如下：

```java
public interface ConfigRepository {
    /**
    * Get the config from this repository.
    * @return config
    */
    Properties getConfig();

    /**
    * Set the fallback repo for this repository.
    * @param upstreamConfigRepository the upstream repo
    */
    void setUpstreamRepository(ConfigRepository upstreamConfigRepository);

    /**
    * Add change listener.
    * @param listener the listener to observe the changes
    */
    void addChangeListener(RepositoryChangeListener listener);

    /**
    * Remove change listener.
    * @param listener the listener to remove
    */
    void removeChangeListener(RepositoryChangeListener listener);

    /**
    * Return the config's source type, i.e. where is the config loaded from
    *
    * @return the config's source type
    */
    ConfigSourceType getSourceType();
}
```

* `getConfig()`方法读取配置内容
* `setUpstreamRepository(ConfigRepository)`方法设置上游的Repository，主要用于LocalFileConfigRepository，从Config Service读取配置缓存在本地文件
* `addChangeListener(RepositoryChangeListener)`，添加监听器
* `removeChangeListener(RepositoryChangeListener)`，移除监听器

## AbstractConfigRepository

`com.ctrip.framework.apollo.internals.AbstractConfigRepository`是ConfigRepository的抽象类实现，代码如下：

```java
public abstract class AbstractConfigRepository implements ConfigRepository {
    private static final Logger logger = LoggerFactory.getLogger(AbstractConfigRepository.class);
    private List<RepositoryChangeListener> m_listeners = Lists.newCopyOnWriteArrayList();
    protected PropertiesFactory propertiesFactory = ApolloInjector.getInstance(PropertiesFactory.class);

    protected boolean trySync() {
        try {
            sync();
            return true;
        } catch (Throwable ex) {
            Tracer.logEvent("ApolloConfigException", ExceptionUtil.getDetailMessage(ex));
            logger
                .warn("Sync config failed, will retry. Repository {}, reason: {}", this.getClass(), ExceptionUtil
                    .getDetailMessage(ex));
        }
        return false;
    }

    protected abstract void sync();

    @Override
    public void addChangeListener(RepositoryChangeListener listener) {
        if (!m_listeners.contains(listener)) {
            m_listeners.add(listener);
        }
    }

    @Override
    public void removeChangeListener(RepositoryChangeListener listener) {
        m_listeners.remove(listener);
    }

    protected void fireRepositoryChange(String namespace, Properties newProperties) {
        for (RepositoryChangeListener listener : m_listeners) {
            try {
                listener.onRepositoryChange(namespace, newProperties);
            } catch (Throwable ex) {
                Tracer.logError(ex);
                logger.error("Failed to invoke repository change listener {}", listener.getClass(), ex);
            }
        }
    }
}
```

* `m_listeners`是监听器的List容器，是一个CopyOnWriteArrayList，保证线程安全
* `trySync`是一个同步配置的方法，内部调用抽象方法`sync`，`sync`再由子类负责实现
* `addChangeListener`和`removeChangeListener`方法实现类监听器的添加和移除操作
* `fireRepositoryChange`触发监听器回调

## RemoteConfigRepository

`com.ctrip.framework.apollo.internals.RemoteConfigRepository`，实现了AbstractConfigRepository，实现从Config Service拉取配置缓存在内存中，并且定时刷新缓存。

### 构造方法

```java
private static final Logger logger = DeferredLoggerFactory.getLogger(RemoteConfigRepository.class);
private static final Joiner STRING_JOINER = Joiner.on(ConfigConsts.CLUSTER_NAMESPACE_SEPARATOR);
private static final Joiner.MapJoiner MAP_JOINER = Joiner.on("&").withKeyValueSeparator("=");
private static final Escaper pathEscaper = UrlEscapers.urlPathSegmentEscaper();
private static final Escaper queryParamEscaper = UrlEscapers.urlFormParameterEscaper();

private final ConfigServiceLocator m_serviceLocator;
private final HttpClient m_httpClient;
private final ConfigUtil m_configUtil;
private final RemoteConfigLongPollService remoteConfigLongPollService;
private volatile AtomicReference<ApolloConfig> m_configCache;
private final String m_namespace;
private final static ScheduledExecutorService m_executorService;
private final AtomicReference<ServiceDTO> m_longPollServiceDto;
private final AtomicReference<ApolloNotificationMessages> m_remoteMessages;
private final RateLimiter m_loadConfigRateLimiter;
private final AtomicBoolean m_configNeedForceRefresh;
private final SchedulePolicy m_loadConfigFailSchedulePolicy;
private static final Gson GSON = new Gson();

static {
    m_executorService = Executors.newScheduledThreadPool(1, ApolloThreadFactory.create("RemoteConfigRepository", true));
}

/**
* Constructor.
*
* @param namespace the namespace
*/
public RemoteConfigRepository(String namespace) {
    m_namespace = namespace;
    m_configCache = new AtomicReference<>();
    m_configUtil = ApolloInjector.getInstance(ConfigUtil.class);
    m_httpClient = ApolloInjector.getInstance(HttpClient.class);
    m_serviceLocator = ApolloInjector.getInstance(ConfigServiceLocator.class);
    remoteConfigLongPollService = ApolloInjector.getInstance(RemoteConfigLongPollService.class);
    m_longPollServiceDto = new AtomicReference<>();
    m_remoteMessages = new AtomicReference<>();
    m_loadConfigRateLimiter = RateLimiter.create(m_configUtil.getLoadConfigQPS());
    m_configNeedForceRefresh = new AtomicBoolean(true);
    m_loadConfigFailSchedulePolicy = new ExponentialSchedulePolicy(m_configUtil.getOnErrorRetryInterval(),
        m_configUtil.getOnErrorRetryInterval() * 8);
    this.trySync();
    this.schedulePeriodicRefresh();
    this.scheduleLongPollingRefresh();
}
```

* 基础属性
    * `m_namespace`，Namespace名字，一个RemoteConfigRepository对应一个Namespace
    * `m_configCache，指向ApolloConfig的AtomicReference，缓存配置
* 轮询属性
    * `m_remoteMessages`，指向ApolloNotificationMessages的AtomicReference
    * `m_executorService`，线程池对象，线程数为1
    * `remoteConfigLongPollService`，长轮询的Service实现
    * `m_loadConfigRateLimiter`
    * `m_loadConfigFailSchedulePolicy`，失败定时重试策略，使用 ExponentialSchedulePolicy 实现类，区间范围是 [1, 8] 秒
* 通知属性
    * `remoteConfigLongPollService`，长轮询服务
    * `m_longPollServiceDto`，长轮询得到的Config Service信息，在下一次轮询配置时，优先从该Config Service请求
    * `m_configNeedForceRefresh`，是否强制拉取缓存的标记。若为true，则多一轮从Config Service拉取配置

构造方法中除了各个属性的初始化外，还调用几个方法：

* `trySync`方法，尝试同步配置，作为初次的配置缓存
* `schedulePeriodicRefresh`方法，初始化定时刷新配置的任务
    ```java
    private void schedulePeriodicRefresh() {
        logger.debug("Schedule periodic refresh with interval: {} {}",
            m_configUtil.getRefreshInterval(), m_configUtil.getRefreshIntervalTimeUnit());
        m_executorService.scheduleAtFixedRate(
            new Runnable() {
                @Override
                public void run() {
                    Tracer.logEvent("Apollo.ConfigService", String.format("periodicRefresh: %s", m_namespace));
                    logger.debug("refresh config for namespace: {}", m_namespace);
                    trySync();
                    Tracer.logEvent("Apollo.Client.Version", Apollo.VERSION);
                }
            }, m_configUtil.getRefreshInterval(), m_configUtil.getRefreshInterval(),
            m_configUtil.getRefreshIntervalTimeUnit());
    }
    ```
* `scheduleLongPollingRefresh`方法，将自己注册到RemoteConfigLongPollService中，实现配置更新的实时通知
    ```java
    private void scheduleLongPollingRefresh() {
        remoteConfigLongPollService.submit(m_namespace, this);
    }
    ```
  当RemoteConfigLongPollService长轮询到该RemoteConfigRepository的Namespace下的配置更新时，会回调`onLongPollNotified`方法
    ```java
    public void onLongPollNotified(ServiceDTO longPollNotifiedServiceDto, ApolloNotificationMessages remoteMessages) {
        m_longPollServiceDto.set(longPollNotifiedServiceDto);
        m_remoteMessages.set(remoteMessages);
        m_executorService.submit(new Runnable() {
          @Override
          public void run() {
                m_configNeedForceRefresh.set(true);
            trySync();
          }
        });
    }
    ```

### getConfigServices

`getConfigServices`方法获得所有Config Service信息，代码如下：

```java
private List<ServiceDTO> getConfigServices() {
    List<ServiceDTO> services = m_serviceLocator.getConfigServices();
    if (services.size() == 0) {
        throw new ApolloConfigException("No available config service");
    }

    return services;
}
```

通过ConfigServiceLocator获得Config Service集群的地址。

### assembleQueryConfigUrl

`assembleQueryConfigUrl`方法组装轮询Config Service的配置读取接口`/configs/{appId}/{clusterName}/{namespace:.+}`URL

```java
String assembleQueryConfigUrl(String uri, String appId, String cluster, String namespace,
                                String dataCenter, ApolloNotificationMessages remoteMessages, ApolloConfig previousConfig) {

    String path = "configs/%s/%s/%s";
    List<String> pathParams =
        Lists.newArrayList(pathEscaper.escape(appId), pathEscaper.escape(cluster),
            pathEscaper.escape(namespace));
    Map<String, String> queryParams = Maps.newHashMap();

    if (previousConfig != null) {
        queryParams.put("releaseKey", queryParamEscaper.escape(previousConfig.getReleaseKey()));
    }

    if (!Strings.isNullOrEmpty(dataCenter)) {
        queryParams.put("dataCenter", queryParamEscaper.escape(dataCenter));
    }

    String localIp = m_configUtil.getLocalIp();
    if (!Strings.isNullOrEmpty(localIp)) {
        queryParams.put("ip", queryParamEscaper.escape(localIp));
    }

    String label = m_configUtil.getApolloLabel();
    if (!Strings.isNullOrEmpty(label)) {
        queryParams.put("label", queryParamEscaper.escape(label));
    }

    if (remoteMessages != null) {
        queryParams.put("messages", queryParamEscaper.escape(GSON.toJson(remoteMessages)));
    }

    String pathExpanded = String.format(path, pathParams.toArray());

    if (!queryParams.isEmpty()) {
        pathExpanded += "?" + MAP_JOINER.join(queryParams);
    }
    if (!uri.endsWith("/")) {
        uri += "/";
    }
    return uri + pathExpanded;
}
```

### onLongPollNotified

当长轮询到配置更新时，会回调`onLongPollNotified`方法，触发配置的同步，代码如下

```java
public void onLongPollNotified(ServiceDTO longPollNotifiedServiceDto, ApolloNotificationMessages remoteMessages) {
    m_longPollServiceDto.set(longPollNotifiedServiceDto);
    m_remoteMessages.set(remoteMessages);
    m_executorService.submit(new Runnable() {
      @Override
      public void run() {
          m_configNeedForceRefresh.set(true);
          trySync();
      }
    });
}
```

* 设置长轮询到配置更新的Config Service，下次同步配置时，优先读取改服务
* 设置`m_remoteMessages`
* 提交配置同步的任务

### sync

`sync`方法实现从Config Service同步配置

```java
protected synchronized void sync() {
    Transaction transaction = Tracer.newTransaction("Apollo.ConfigService", "syncRemoteConfig");

    try {
        ApolloConfig previous = m_configCache.get();
        ApolloConfig current = loadApolloConfig();

        //reference equals means HTTP 304
        if (previous != current) {
            logger.debug("Remote Config refreshed!");
            m_configCache.set(current);
            this.fireRepositoryChange(m_namespace, this.getConfig());
        }

        if (current != null) {
            Tracer.logEvent(String.format("Apollo.Client.Configs.%s", current.getNamespaceName()),
                current.getReleaseKey());
        }

        transaction.setStatus(Transaction.SUCCESS);
    } catch (Throwable ex) {
        transaction.setStatus(ex);
        throw ex;
    } finally {
        transaction.complete();
    }
}
```

* 获得`m_configCache`缓存的ApolloConfig对象
* 调用`loadApolloConfig`方法，从Config Service获取ApolloConfig对象
* 如果缓存的ApolloConfig对象和加载到的ApolloConfig对象不同，说明配置发生了更新
    * 设置到`m_configCache`缓存中
    * 调用`fireRepositoryChange`方法触发监听器的回调

### loadApolloConfig

```java
private ApolloConfig loadApolloConfig() {
    if (!m_loadConfigRateLimiter.tryAcquire(5, TimeUnit.SECONDS)) {
        //wait at most 5 seconds
        try {
            TimeUnit.SECONDS.sleep(5);
        } catch (InterruptedException e) {
        }
    }
    String appId = m_configUtil.getAppId();
    String cluster = m_configUtil.getCluster();
    String dataCenter = m_configUtil.getDataCenter();
    String secret = m_configUtil.getAccessKeySecret();
    Tracer.logEvent("Apollo.Client.ConfigMeta", STRING_JOINER.join(appId, cluster, m_namespace));
    int maxRetries = m_configNeedForceRefresh.get() ? 2 : 1;
    long onErrorSleepTime = 0; // 0 means no sleep
    Throwable exception = null;

    List<ServiceDTO> configServices = getConfigServices();
    String url = null;
    retryLoopLabel:
    for (int i = 0; i < maxRetries; i++) {
        List<ServiceDTO> randomConfigServices = Lists.newLinkedList(configServices);
        Collections.shuffle(randomConfigServices);
        //Access the server which notifies the client first
        if (m_longPollServiceDto.get() != null) {
            randomConfigServices.add(0, m_longPollServiceDto.getAndSet(null));
        }

        for (ServiceDTO configService : randomConfigServices) {
            if (onErrorSleepTime > 0) {
                logger.warn(
                    "Load config failed, will retry in {} {}. appId: {}, cluster: {}, namespaces: {}",
                    onErrorSleepTime, m_configUtil.getOnErrorRetryIntervalTimeUnit(), appId, cluster, m_namespace);

                try {
                    m_configUtil.getOnErrorRetryIntervalTimeUnit().sleep(onErrorSleepTime);
                } catch (InterruptedException e) {
                    //ignore
                }
            }

            url = assembleQueryConfigUrl(configService.getHomepageUrl(), appId, cluster, m_namespace,
                    dataCenter, m_remoteMessages.get(), m_configCache.get());

            logger.debug("Loading config from {}", url);

            HttpRequest request = new HttpRequest(url);
            if (!StringUtils.isBlank(secret)) {
                Map<String, String> headers = Signature.buildHttpHeaders(url, appId, secret);
                request.setHeaders(headers);
            }

            Transaction transaction = Tracer.newTransaction("Apollo.ConfigService", "queryConfig");
            transaction.addData("Url", url);
            try {

                HttpResponse<ApolloConfig> response = m_httpClient.doGet(request, ApolloConfig.class);
                m_configNeedForceRefresh.set(false);
                m_loadConfigFailSchedulePolicy.success();

                transaction.addData("StatusCode", response.getStatusCode());
                transaction.setStatus(Transaction.SUCCESS);

                if (response.getStatusCode() == 304) {
                    logger.debug("Config server responds with 304 HTTP status code.");
                    return m_configCache.get();
                }

                ApolloConfig result = response.getBody();

                logger.debug("Loaded config for {}: {}", m_namespace, result);

                return result;
            } catch (ApolloConfigStatusCodeException ex) {
                ApolloConfigStatusCodeException statusCodeException = ex;
                //config not found
                if (ex.getStatusCode() == 404) {
                    String message = String.format(
                        "Could not find config for namespace - appId: %s, cluster: %s, namespace: %s, " +
                            "please check whether the configs are released in Apollo!",
                        appId, cluster, m_namespace);
                    statusCodeException = new ApolloConfigStatusCodeException(ex.getStatusCode(),
                        message);
                }
                Tracer.logEvent("ApolloConfigException", ExceptionUtil.getDetailMessage(statusCodeException));
                transaction.setStatus(statusCodeException);
                exception = statusCodeException;
                if(ex.getStatusCode() == 404) {
                    break retryLoopLabel;
                }
            } catch (Throwable ex) {
                Tracer.logEvent("ApolloConfigException", ExceptionUtil.getDetailMessage(ex));
                transaction.setStatus(ex);
                exception = ex;
            } finally {
                transaction.complete();
            }

            // if force refresh, do normal sleep, if normal config load, do exponential sleep
            onErrorSleepTime = m_configNeedForceRefresh.get() ? m_configUtil.getOnErrorRetryInterval() :
                m_loadConfigFailSchedulePolicy.fail();
        }

    }
    String message = String.format(
        "Load Apollo Config failed - appId: %s, cluster: %s, namespace: %s, url: %s",
        appId, cluster, m_namespace, url);
    throw new ApolloConfigException(message, exception);
}
```

* 调用`m_loadConfigRateLimiter.tryAcquire`方法判断是否被限流，若限流则sleep 5秒，避免频繁请求Config Service
* 从`m_configUtil`中获取`appId`、`cluster`、`dataCenter`、`secret`等参数
* 调用`getConfigServices`方法获取所有Config Service地址
*  `maxRetries`参数控制外层for循环，控制异常时的重试次数
* 从`configServices`列表创建新的`randomConfigServices`列表，`randomConfigServices`是一个打乱后的列表
* 将`m_longPollServiceDto`加入到`randomConfigServices`中，`m_longPollServiceDto`存储的是上次通知的Config Service，查询时优先使用该服务，同时清空`m_longPollServiceDto`，避免重复访问同一服务
* 遍历`randomConfigServices`列表，查询Config Service，如果某次遍历过程中查询到了配置，则返回结果
    * 如果`onErrorSleepTime`大于0，则sleep一段时间，时间单位默认是秒。若请求失败一次 Config Service 时，会计算一次下一次请求的延迟时间。因为是每次请求失败一次 Config Service 时就计算一次，所以延迟时间的上限为 8 秒
    * 调用`assembleQueryConfigUrl`方法组装查询配置的URL
    * 构建HttpRequest对象，并调用HttpUtil的doGet方法发起调用
    * 设置`m_configNeedForceRefresh`为false，`m_loadConfigFailSchedulePolicy`的success方法标记成功
    * 如果HTTP响应码是304，表明没有新的配置，直接返回缓存的ApolloConfig对象
    * 否则说明有新的配置，创建ApolloConfig对象并返回
    * 发生异常时，记录trace相关信息，如果状态码是404则进行重试，注意这时候不会重新计算`onErrorSleepTime`
    * 最后计算`onErrorSleepTime`，并进行下一次重试

### getConfig

`getConfig`获取配置，将ApolloConfig转换为Peroperties返回

```java
public Properties getConfig() {
    if (m_configCache.get() == null) {
      this.sync();
    }
    return transformApolloConfigToProperties(m_configCache.get());
}
```

`transformApolloConfigToProperties`方法实现转换功能

```java
private Properties transformApolloConfigToProperties(ApolloConfig apolloConfig) {
    Properties result = propertiesFactory.getPropertiesInstance();
    result.putAll(apolloConfig.getConfigurations());
    return result;
}
```

## RemoteConfigLongPollService

`com.ctrip.framework.apollo.internals.RemoteConfigLongPollService`，远程配置长轮询服务，负责长轮询Config Service的配置变更通知`/notifications/v2`接口。当有新的通知时，触发RemoteConfigRepository，立即查询Config Service的配置读取接口`/configs/{appId}/{clusterName}/{namespace:.+}`。

### 构造方法

```java
private static final Logger logger = LoggerFactory.getLogger(RemoteConfigLongPollService.class);
private static final Joiner STRING_JOINER = Joiner.on(ConfigConsts.CLUSTER_NAMESPACE_SEPARATOR);
private static final Joiner.MapJoiner MAP_JOINER = Joiner.on("&").withKeyValueSeparator("=");
private static final Escaper queryParamEscaper = UrlEscapers.urlFormParameterEscaper();
private static final long INIT_NOTIFICATION_ID = ConfigConsts.NOTIFICATION_ID_PLACEHOLDER;
//90 seconds, should be longer than server side's long polling timeout, which is now 60 seconds
private static final int LONG_POLLING_READ_TIMEOUT = 90 * 1000;
private final ExecutorService m_longPollingService;
private final AtomicBoolean m_longPollingStopped;
private SchedulePolicy m_longPollFailSchedulePolicyInSecond;
private RateLimiter m_longPollRateLimiter;
private final AtomicBoolean m_longPollStarted;
private final Multimap<String, RemoteConfigRepository> m_longPollNamespaces;
private final ConcurrentMap<String, Long> m_notifications;
private final Map<String, ApolloNotificationMessages> m_remoteNotificationMessages;//namespaceName -> watchedKey -> notificationId
private Type m_responseType;
private static final Gson GSON = new Gson();
private ConfigUtil m_configUtil;
private HttpClient m_httpClient;
private ConfigServiceLocator m_serviceLocator;
private final ConfigServiceLoadBalancerClient configServiceLoadBalancerClient = ServiceBootstrap.loadPrimary(
    ConfigServiceLoadBalancerClient.class);

  /**
   * Constructor.
   */
 RemoteConfigLongPollService() {
    m_longPollFailSchedulePolicyInSecond = new ExponentialSchedulePolicy(1, 120); //in second
    m_longPollingStopped = new AtomicBoolean(false);
    m_longPollingService = Executors.newSingleThreadExecutor(
        ApolloThreadFactory.create("RemoteConfigLongPollService", true));
    m_longPollStarted = new AtomicBoolean(false);
    m_longPollNamespaces =
        Multimaps.synchronizedSetMultimap(HashMultimap.<String, RemoteConfigRepository>create());
    m_notifications = Maps.newConcurrentMap();
    m_remoteNotificationMessages = Maps.newConcurrentMap();
    m_responseType = new TypeToken<List<ApolloConfigNotification>>() {
    }.getType();
    m_configUtil = ApolloInjector.getInstance(ConfigUtil.class);
    m_httpClient = ApolloInjector.getInstance(HttpClient.class);
    m_serviceLocator = ApolloInjector.getInstance(ConfigServiceLocator.class);
    m_longPollRateLimiter = RateLimiter.create(m_configUtil.getLongPollQPS());
}
```

* 基础属性
    * `m_longPollNamespaces`，注册的长轮询的 Namespace Multimap 缓存。
    * `m_notifications`，通知编号Map缓存。
    * `m_remoteNotificationMessages`，通知消息Map缓存
* 轮询属性
    * `m_longPollingService`，长轮询ExecutorService，线程池大小为1。
    * `m_longPollingStopped`，是否停止长轮询的标识。
    * `m_longPollStarted`，是否长轮询已经开始 的标识。
    * `m_loadConfigRateLimiter`，加载配置的RateLimiter。
    * `m_longPollFailSchedulePolicyInSecond`，失败定时重试策略，使用ExponentialSchedulePolicy实现类，区间范围是[1, 120]秒。

### assembleLongPollRefreshUrl

`assembleLongPollRefreshUrl`方法组装长轮询配置的URL地址，代码如下：

```java
String assembleLongPollRefreshUrl(String uri, String appId, String cluster, String dataCenter,
                                    Map<String, Long> notificationsMap) {
    Map<String, String> queryParams = Maps.newHashMap();
    queryParams.put("appId", queryParamEscaper.escape(appId));
    queryParams.put("cluster", queryParamEscaper.escape(cluster));
    queryParams
        .put("notifications", queryParamEscaper.escape(assembleNotifications(notificationsMap)));

    if (!Strings.isNullOrEmpty(dataCenter)) {
      queryParams.put("dataCenter", queryParamEscaper.escape(dataCenter));
    }
    String localIp = m_configUtil.getLocalIp();
    if (!Strings.isNullOrEmpty(localIp)) {
      queryParams.put("ip", queryParamEscaper.escape(localIp));
    }

    String params = MAP_JOINER.join(queryParams);
    if (!uri.endsWith("/")) {
      uri += "/";
    }

    return uri + "notifications/v2?" + params;
}

String assembleNotifications(Map<String, Long> notificationsMap) {
    List<ApolloConfigNotification> notifications = Lists.newArrayList();
    for (Map.Entry<String, Long> entry : notificationsMap.entrySet()) {
      ApolloConfigNotification notification = new ApolloConfigNotification(entry.getKey(), entry.getValue());
      notifications.add(notification);
    }
    return GSON.toJson(notifications);
}
```

### submit

`submit`方法提交 RemoteConfigRepository 到长轮询任务，代码如下：

```java
public boolean submit(String namespace, RemoteConfigRepository remoteConfigRepository) {
    boolean added = m_longPollNamespaces.put(namespace, remoteConfigRepository);
    m_notifications.putIfAbsent(namespace, INIT_NOTIFICATION_ID);
    if (!m_longPollStarted.get()) {
      startLongPolling();
    }
    return added;
}
```

* 将namespace和remoteConfigRepository记录到`m_longPollNamespaces`中。
* 将namespace添加到`m_notifications`中。
* 若未启动长轮询定时任务，则调用`startLongPolling`方法开启长轮询。

### startLongPolling

```java
private void startLongPolling() {
    if (!m_longPollStarted.compareAndSet(false, true)) {
        //already started
        return;
    }
    try {
        final String appId = m_configUtil.getAppId();
        final String cluster = m_configUtil.getCluster();
        final String dataCenter = m_configUtil.getDataCenter();
        final String secret = m_configUtil.getAccessKeySecret();
        final long longPollingInitialDelayInMills = m_configUtil.getLongPollingInitialDelayInMills();
        m_longPollingService.submit(new Runnable() {
            @Override
            public void run() {
                if (longPollingInitialDelayInMills > 0) {
                    try {
                    logger.debug("Long polling will start in {} ms.", longPollingInitialDelayInMills);
                    TimeUnit.MILLISECONDS.sleep(longPollingInitialDelayInMills);
                    } catch (InterruptedException e) {
                    //ignore
                    }
                }
                doLongPollingRefresh(appId, cluster, dataCenter, secret);
            }
        });
    } catch (Throwable ex) {
        m_longPollStarted.set(false);
        ApolloConfigException exception =
            new ApolloConfigException("Schedule long polling refresh failed", ex);
        Tracer.logError(exception);
        logger.warn(ExceptionUtil.getDetailMessage(exception));
    }
}
```

* CAS设置`m_longPollStarted`标识，如果已经启动，不重复启动
* 获得`appId`、`cluster`、`dataCenter`等配置信息
* 调用`ConfigUtil#getLongPollingInitialDelayInMills()`方法，获得长轮询任务的初始化延迟时间，单位毫秒。默认2000毫秒
* 提交长轮询任务，该任务会持续且循环执行

### doLongPollingRefresh

```java
private void doLongPollingRefresh(String appId, String cluster, String dataCenter, String secret) {
    ServiceDTO lastServiceDto = null;
    while (!m_longPollingStopped.get() && !Thread.currentThread().isInterrupted()) {
        if (!m_longPollRateLimiter.tryAcquire(5, TimeUnit.SECONDS)) {
            //wait at most 5 seconds
            try {
                TimeUnit.SECONDS.sleep(5);
            } catch (InterruptedException e) {
            }
        }
        Transaction transaction = Tracer.newTransaction("Apollo.ConfigService", "pollNotification");
        String url = null;
        try {
            if (lastServiceDto == null) {
            lastServiceDto = this.resolveConfigService();
            }

            url = assembleLongPollRefreshUrl(lastServiceDto.getHomepageUrl(), appId, cluster, dataCenter, m_notifications);

            logger.debug("Long polling from {}", url);

            HttpRequest request = new HttpRequest(url);
            request.setReadTimeout(LONG_POLLING_READ_TIMEOUT);
            if (!StringUtils.isBlank(secret)) {
                Map<String, String> headers = Signature.buildHttpHeaders(url, appId, secret);
                request.setHeaders(headers);
            }

            transaction.addData("Url", url);

            final HttpResponse<List<ApolloConfigNotification>> response =
                m_httpClient.doGet(request, m_responseType);

            logger.debug("Long polling response: {}, url: {}", response.getStatusCode(), url);
            if (response.getStatusCode() == 200 && response.getBody() != null) {
                updateNotifications(response.getBody());
                updateRemoteNotifications(response.getBody());
                transaction.addData("Result", response.getBody().toString());
                notify(lastServiceDto, response.getBody());
            }

            //try to load balance
            if (response.getStatusCode() == 304 && ThreadLocalRandom.current().nextBoolean()) {
                lastServiceDto = null;
            }

            m_longPollFailSchedulePolicyInSecond.success();
            transaction.addData("StatusCode", response.getStatusCode());
            transaction.setStatus(Transaction.SUCCESS);
        } catch (Throwable ex) {
            lastServiceDto = null;
            Tracer.logEvent("ApolloConfigException", ExceptionUtil.getDetailMessage(ex));
            transaction.setStatus(ex);
            long sleepTimeInSecond = m_longPollFailSchedulePolicyInSecond.fail();
            logger.warn(
                "Long polling failed, will retry in {} seconds. appId: {}, cluster: {}, namespaces: {}, long polling url: {}, reason: {}",
                sleepTimeInSecond, appId, cluster, assembleNamespaces(), url, ExceptionUtil.getDetailMessage(ex));
            try {
                TimeUnit.SECONDS.sleep(sleepTimeInSecond);
            } catch (InterruptedException ie) {
            //ignore
            }
        } finally {
            transaction.complete();
        }
    }
}
```

* 循环执行，直到停止或线程中断。
* 调用 `RateLimiter#tryAcquire(long timeout, TimeUnit unit)` 方法，判断是否被限流。若限流，sleep 5 秒，避免对 Config Service 请求过于频繁。
* 若无 lastServiceDto 对象，随机获得 Config Service 的地址。
* 调用 `#assembleLongPollRefreshUrl(...)` 方法，组装长轮询通知变更的地址。
* 创建 HttpRequest 对象，并设置超时时间。默认超时时间为 90 秒，大于 Config Service 的通知接口的 60 秒。
* 调用 `HttpUtil#doGet(request, Class)` 方法，发起请求，返回 HttpResponse 对象。
* 若返回状态码为 200 ，说明有新的通知，刷新本地的缓存。
    * 调用 `#updateNotifications(List<ApolloConfigNotification>)` 方法，更新 m_notifications。
    * 调用 `#updateRemoteNotifications(List<ApolloConfigNotification>)` 方法，更新 m_remoteNotificationMessages 。
    * 调用 `#notify(ServiceDTO, List<ApolloConfigNotification>)` 方法，通知对应的 RemoteConfigRepository 们。
* 若返回状态码为 304 ，说明无新的通知，随机，重置连接的 Config Service 的地址，下次请求不同的 Config Service ，实现负载均衡。
* 调用 `SchedulePolicy#success()` 方法，标记成功。
* 发生异常时
    * 重置连接的 Config Service 的地址 lastServiceDto ，下次请求不同的 Config Service。
    * 调用 `SchedulePolicy#fail()` 方法，标记失败，计算下一次延迟执行时间。
    * leep，等待一定时间，下次失败重试。

### updateNotifications

`updateNotifications`方法更新`m_notifications`，代码如下：

```java
private void updateNotifications(List<ApolloConfigNotification> deltaNotifications) {
    for (ApolloConfigNotification notification : deltaNotifications) {
        if (Strings.isNullOrEmpty(notification.getNamespaceName())) {
            continue;
        }
        String namespaceName = notification.getNamespaceName();
        if (m_notifications.containsKey(namespaceName)) {
            m_notifications.put(namespaceName, notification.getNotificationId());
        }
        //since .properties are filtered out by default, so we need to check if there is notification with .properties suffix
        String namespaceNameWithPropertiesSuffix =
            String.format("%s.%s", namespaceName, ConfigFileFormat.Properties.getValue());
        if (m_notifications.containsKey(namespaceNameWithPropertiesSuffix)) {
            m_notifications.put(namespaceNameWithPropertiesSuffix, notification.getNotificationId());
        }
    }
}
```

### updateRemoteNotifications

`updateRemoteNotifications`方法更新`m_remoteNotificationMessages`，代码如下：

```java
private void updateRemoteNotifications(List<ApolloConfigNotification> deltaNotifications) {
    for (ApolloConfigNotification notification : deltaNotifications) {
        if (Strings.isNullOrEmpty(notification.getNamespaceName())) {
            continue;
        }

        if (notification.getMessages() == null || notification.getMessages().isEmpty()) {
            continue;
        }

        ApolloNotificationMessages localRemoteMessages =
            m_remoteNotificationMessages.get(notification.getNamespaceName());
        if (localRemoteMessages == null) {
            localRemoteMessages = new ApolloNotificationMessages();
            m_remoteNotificationMessages.put(notification.getNamespaceName(), localRemoteMessages);
        }

        localRemoteMessages.mergeFrom(notification.getMessages());
    }
}
```

### notify

`notify`方法通知Namespace对应的所有RemoteConfigRepository，回调`onLongPollNotified`方法，代码如下：

```java
private void notify(ServiceDTO lastServiceDto, List<ApolloConfigNotification> notifications) {
    if (notifications == null || notifications.isEmpty()) {
        return;
    }
    for (ApolloConfigNotification notification : notifications) {
        String namespaceName = notification.getNamespaceName();
        //create a new list to avoid ConcurrentModificationException
        List<RemoteConfigRepository> toBeNotified =
            Lists.newArrayList(m_longPollNamespaces.get(namespaceName));
        ApolloNotificationMessages originalMessages = m_remoteNotificationMessages.get(namespaceName);
        ApolloNotificationMessages remoteMessages = originalMessages == null ? null : originalMessages.clone();
        //since .properties are filtered out by default, so we need to check if there is any listener for it
        toBeNotified.addAll(m_longPollNamespaces
            .get(String.format("%s.%s", namespaceName, ConfigFileFormat.Properties.getValue())));
        for (RemoteConfigRepository remoteConfigRepository : toBeNotified) {
            try {
                remoteConfigRepository.onLongPollNotified(lastServiceDto, remoteMessages);
            } catch (Throwable ex) {
                Tracer.logError(ex);
            }
        }
    }
}
```