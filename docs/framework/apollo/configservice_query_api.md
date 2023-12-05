# Apollo源码分析——ConfigService配置查询

上文分析了配置变更时通知的实现，但通知变化的接口，仅返回通知相关的信息，不包括配置相关的信息，ConfigService还提供了读取配置的接口。

## ConfigController

`com.ctrip.framework.apollo.configservice.controller.ConfigController`，提供了查询配置的接口 `configs/{appId}/{clusterName}/{namespace:.+}`

```java
@GetMapping(value = "/{appId}/{clusterName}/{namespace:.+}")
public ApolloConfig queryConfig(@PathVariable String appId, @PathVariable String clusterName,
                                @PathVariable String namespace,
                                @RequestParam(value = "dataCenter", required = false) String dataCenter,
                                @RequestParam(value = "releaseKey", defaultValue = "-1") String clientSideReleaseKey,
                                @RequestParam(value = "ip", required = false) String clientIp,
                                @RequestParam(value = "label", required = false) String clientLabel,
                                @RequestParam(value = "messages", required = false) String messagesAsString,
                                HttpServletRequest request, HttpServletResponse response) throws IOException {
    String originalNamespace = namespace;
    //strip out .properties suffix
    namespace = namespaceUtil.filterNamespaceName(namespace);
    //fix the character case issue, such as FX.apollo <-> fx.apollo
    namespace = namespaceUtil.normalizeNamespace(appId, namespace);

    if (Strings.isNullOrEmpty(clientIp)) {
        clientIp = WebUtils.tryToGetClientIp(request);
    }

    ApolloNotificationMessages clientMessages = transformMessages(messagesAsString);

    List<Release> releases = Lists.newLinkedList();

    String appClusterNameLoaded = clusterName;
    if (!ConfigConsts.NO_APPID_PLACEHOLDER.equalsIgnoreCase(appId)) {
        Release currentAppRelease = configService.loadConfig(appId, clientIp, clientLabel, appId, clusterName, namespace,
            dataCenter, clientMessages);

        if (currentAppRelease != null) {
            releases.add(currentAppRelease);
            //we have cluster search process, so the cluster name might be overridden
            appClusterNameLoaded = currentAppRelease.getClusterName();
        }
    }

    //if namespace does not belong to this appId, should check if there is a public configuration
    if (!namespaceBelongsToAppId(appId, namespace)) {
        Release publicRelease = this.findPublicConfig(appId, clientIp, clientLabel, clusterName, namespace,
            dataCenter, clientMessages);
        if (Objects.nonNull(publicRelease)) {
            releases.add(publicRelease);
        }
    }

    if (releases.isEmpty()) {
        response.sendError(HttpServletResponse.SC_NOT_FOUND,
            String.format(
                "Could not load configurations with appId: %s, clusterName: %s, namespace: %s",
                appId, clusterName, originalNamespace));
        Tracer.logEvent("Apollo.Config.NotFound",
            assembleKey(appId, clusterName, originalNamespace, dataCenter));
        return null;
    }

    auditReleases(appId, clusterName, dataCenter, clientIp, releases);

    String mergedReleaseKey = releases.stream().map(Release::getReleaseKey)
            .collect(Collectors.joining(ConfigConsts.CLUSTER_NAMESPACE_SEPARATOR));

    if (mergedReleaseKey.equals(clientSideReleaseKey)) {
        // Client side configuration is the same with server side, return 304
        response.setStatus(HttpServletResponse.SC_NOT_MODIFIED);
        Tracer.logEvent("Apollo.Config.NotModified",
            assembleKey(appId, appClusterNameLoaded, originalNamespace, dataCenter));
        return null;
    }

    ApolloConfig apolloConfig = new ApolloConfig(appId, appClusterNameLoaded, originalNamespace,
        mergedReleaseKey);
    apolloConfig.setConfigurations(mergeReleaseConfigurations(releases));

    Tracer.logEvent("Apollo.Config.Found", assembleKey(appId, appClusterNameLoaded,
        originalNamespace, dataCenter));
    return apolloConfig;
}
```

* 请求参数说明：
    * `clientSideReleaseKey`：客户端侧的ReleaseKey，用于和查询到的ReleaseKey相比较，判断是否有配置更新
    * `clientIp`：用于灰度发布功能，关于灰度发布整体流程比较复杂，后面单独展开
    * `messagesAsString`：客户端当前请求的 Namespace 的通知消息明细，`transformMessages`方法会将其转换为`ApolloNotificationMessages`对象
        ```java
        ApolloNotificationMessages transformMessages(String messagesAsString) {
            ApolloNotificationMessages notificationMessages = null;
            if (!Strings.isNullOrEmpty(messagesAsString)) {
                try {
                    notificationMessages = gson.fromJson(messagesAsString, ApolloNotificationMessages.class);
                } catch (Throwable ex) {
                    Tracer.logError(ex);
                }
            }

            return notificationMessages;
        }
        ```
* 调用`namespaceUtil.filterNamespaceName`方法，去除Namespace的`.properties`后缀
* 调用`namespaceUtil.normalizeNamespace`方法，获取归一化后的Namesapce
* 如果`clientIp`为空，则调用`WebUtils.tryToGetClientIp`尝试获取`clientIp`
    ```java
    public static String tryToGetClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-FORWARDED-FOR");
        if (!Strings.isNullOrEmpty(forwardedFor)) {
        return X_FORWARDED_FOR_SPLITTER.splitToList(forwardedFor).get(0);
        }
        return request.getRemoteAddr();
    }
    ```
* 创建`releases`列表，收集返回给客户端的Release信息
* 如果`appId`不等于`ApolloNoAppIdPlaceHolder`，那么尝试获取Namespace对应的最新Release信息
    * 调用`configService.loadConfig`方法查询Release对象
    * 获得Release对应的Cluster名字，因为，在`ConfigService.loadConfig`方法中会根据`clusterName`和`dataCenter`分别查询 Release 直到找到一个，所以需要根据结果的 Release 获取真正的 Cluster 名。
* 如果是关联类型，那么尝试获取关联Namespace的最新Release
    * 调用`namespaceBelongsToAppId`判断Namespace是否是当前AppId下的，如果不是那么可能是一个公共Namespace
        ```java
        private boolean namespaceBelongsToAppId(String appId, String namespaceName) {
            //Every app has an 'application' namespace
            if (Objects.equals(ConfigConsts.NAMESPACE_APPLICATION, namespaceName)) {
                return true;
            }

            //if no appId is present, then no other namespace belongs to it
            if (ConfigConsts.NO_APPID_PLACEHOLDER.equalsIgnoreCase(appId)) {
                return false;
            }

            AppNamespace appNamespace = appNamespaceService.findByAppIdAndNamespace(appId, namespaceName);

            return appNamespace != null;
        }
        ```
    * 调用`findPublicConfig`方法获取公共Namespace的最新配置
        ```java
        private Release findPublicConfig(String clientAppId, String clientIp, String clientLabel, String clusterName,
                                   String namespace, String dataCenter, ApolloNotificationMessages clientMessages) {
            AppNamespace appNamespace = appNamespaceService.findPublicNamespaceByName(namespace);

            //check whether the namespace's appId equals to current one
            if (Objects.isNull(appNamespace) || Objects.equals(clientAppId, appNamespace.getAppId())) {
                return null;
            }

            String publicConfigAppId = appNamespace.getAppId();

            return configService.loadConfig(clientAppId, clientIp, clientLabel, publicConfigAppId, clusterName, namespace, dataCenter,
                clientMessages);
        }
        ```
* 经过前面的查找Release过程，如果`releases`仍为空，表明没有Release产生，返回客户端状态码404
* 调用`auditReleases`方法，记录InstanceConfig。关于InstanceConfig，稍显复杂且与本文主题关系不大，后续单独再分析
* 从`release`列表计算`mergedReleaseKey`，多个Release的话用`+`号拼接
* 如果`mergedReleaseKey`与`clientSideReleaseKey`相等，表明没有新的配置变更，返回客户端状态码304
* 创建ApolloConfig对象，调用`mergeReleaseConfigurations`方法合并多个Release的配置集合并设置到`configurations`字段中
    ```java
    Map<String, String> mergeReleaseConfigurations(List<Release> releases) {
        Map<String, String> result = Maps.newLinkedHashMap();
        for (Release release : Lists.reverse(releases)) {
            result.putAll(gson.fromJson(release.getConfigurations(), configurationTypeReference));
        }
        return result;
    }
    ```
* 最后返回ApolloConfig对象

## ConfigService

`com.ctrip.framework.apollo.configservice.service.config.ConfigService`接口实现了配置查询的功能，同时也继承`ReleaseMessageListener`接口，在ReleaseMessage产生时可以作为回调处理。

`com.ctrip.framework.apollo.configservice.service.config.AbstractConfigService`抽象类实现了`ConfigService`接口，`com.ctrip.framework.apollo.configservice.service.config.ConfigServiceWithCache`与`com.ctrip.framework.apollo.configservice.service.config.DefaultConfigService`分别继承自`AbstractConfigService`，二者的差别再与是否使用缓存，通过参数`config-service.cache.enabled`决定使用哪个实现。

```java
@Bean
public ConfigService configService() {
    if (bizConfig.isConfigServiceCacheEnabled()) {
      return new ConfigServiceWithCache(releaseService, releaseMessageService,
          grayReleaseRulesHolder(), bizConfig);
    }
    return new DefaultConfigService(releaseService, grayReleaseRulesHolder());
}
```

### AbstractConfigService

`AbstractConfigService`实现公用的获取配置的逻辑，并暴露抽象方法，让子类实现。暴露的两个抽象方法如下所示：

```java
protected abstract Release findActiveOne(long id, ApolloNotificationMessages clientMessages);

protected abstract Release findLatestActiveRelease(String configAppId, String configClusterName,
      String configNamespaceName, ApolloNotificationMessages clientMessages);
```

`loadConfig`查询Release查询

```java
@Override
public Release loadConfig(String clientAppId, String clientIp, String clientLabel, String configAppId, String configClusterName,
    String configNamespace, String dataCenter, ApolloNotificationMessages clientMessages) {
    // load from specified cluster first
    if (!Objects.equals(ConfigConsts.CLUSTER_NAME_DEFAULT, configClusterName)) {
        Release clusterRelease = findRelease(clientAppId, clientIp, clientLabel, configAppId, configClusterName, configNamespace,
            clientMessages);

        if (Objects.nonNull(clusterRelease)) {
            return clusterRelease;
        }
    }

    // try to load via data center
    if (!Strings.isNullOrEmpty(dataCenter) && !Objects.equals(dataCenter, configClusterName)) {
        Release dataCenterRelease = findRelease(clientAppId, clientIp, clientLabel, configAppId, dataCenter, configNamespace,
            clientMessages);
        if (Objects.nonNull(dataCenterRelease)) {
            return dataCenterRelease;
        }
    }

    // fallback to default release
    return findRelease(clientAppId, clientIp, clientLabel, configAppId, ConfigConsts.CLUSTER_NAME_DEFAULT, configNamespace,
        clientMessages);
}
```

* 优先查询指定Cluster的Release，如果查询到则返回
* 否则查询所属IDC的Relase，如果查询到则返回
* 最后查询默认Cluster的Release
* 关于多Cluster的加载顺序，可以参考[官方文档](https://www.apolloconfig.com/#/zh/design/apollo-introduction?id=_442-%e5%85%ac%e5%85%b1%e7%bb%84%e4%bb%b6%e9%85%8d%e7%bd%ae%e7%9a%84%e8%8e%b7%e5%8f%96%e8%a7%84%e5%88%99)

`findRelease`方法实现Release的查找

```java
private Release findRelease(String clientAppId, String clientIp, String clientLabel, String configAppId, String configClusterName,
      String configNamespace, ApolloNotificationMessages clientMessages) {
    Long grayReleaseId = grayReleaseRulesHolder.findReleaseIdFromGrayReleaseRule(clientAppId, clientIp, clientLabel, configAppId,
        configClusterName, configNamespace);

    Release release = null;

    if (grayReleaseId != null) {
        release = findActiveOne(grayReleaseId, clientMessages);
    }

    if (release == null) {
        release = findLatestActiveRelease(configAppId, configClusterName, configNamespace, clientMessages);
    }

    return release;
  }
```

* 调用`GrayReleaseRulesHolder#findReleaseIdFromGrayReleaseRule(...)`方法，读取灰度发布编号，即 GrayReleaseRule.releaseId 属性
* 调用`findActiveOne(grayReleaseId, clientMessages)`方法，读取灰度 Release 对象
* 若非灰度，调用`findLatestActiveRelease(configAppId, configClusterName, configNamespace, clientMessages)`方法，获得最新的，并且有效的 Release 对象。

### DefaultConfigService

`DefaultConfigService`是`ConfigService`的默认实现，直接查询数据库，不使用缓存

```java
public class DefaultConfigService extends AbstractConfigService {

    private final ReleaseService releaseService;
    private final GrayReleaseRulesHolder grayReleaseRulesHolder;

    public DefaultConfigService(final ReleaseService releaseService,
        final GrayReleaseRulesHolder grayReleaseRulesHolder) {
        super(grayReleaseRulesHolder);
        this.releaseService = releaseService;
        this.grayReleaseRulesHolder = grayReleaseRulesHolder;
    }

    @Override
    protected Release findActiveOne(long id, ApolloNotificationMessages clientMessages) {
        return releaseService.findActiveOne(id);
    }

    @Override
    protected Release findLatestActiveRelease(String configAppId, String configClusterName, String configNamespace,
                                                ApolloNotificationMessages clientMessages) {
        return releaseService.findLatestActiveRelease(configAppId, configClusterName,
            configNamespace);
    }

    @Override
    public void handleMessage(ReleaseMessage message, String channel) {
        // since there is no cache, so do nothing
    }
}
```

### ConfigServiceWithCache

`ConfigServiceWithCache`是`ConfigService`的带缓存实现，缓存基于Guava Cache实现

#### 构造方法

```java
private static final String TRACER_EVENT_CACHE_INVALIDATE = "ConfigCache.Invalidate";
private static final String TRACER_EVENT_CACHE_LOAD = "ConfigCache.LoadFromDB";
private static final String TRACER_EVENT_CACHE_LOAD_ID = "ConfigCache.LoadFromDBById";
private static final String TRACER_EVENT_CACHE_GET = "ConfigCache.Get";
private static final String TRACER_EVENT_CACHE_GET_ID = "ConfigCache.GetById";

private final ReleaseService releaseService;
private final ReleaseMessageService releaseMessageService;
private final BizConfig bizConfig;

private LoadingCache<String, ConfigCacheEntry> configCache;

private LoadingCache<Long, Optional<Release>> configIdCache;

private ConfigCacheEntry nullConfigCacheEntry;

public ConfigServiceWithCache(final ReleaseService releaseService,
        final ReleaseMessageService releaseMessageService,
        final GrayReleaseRulesHolder grayReleaseRulesHolder,
        final BizConfig bizConfig) {
    super(grayReleaseRulesHolder);
    this.releaseService = releaseService;
    this.releaseMessageService = releaseMessageService;
    this.bizConfig = bizConfig;
    nullConfigCacheEntry = new ConfigCacheEntry(ConfigConsts.NOTIFICATION_ID_PLACEHOLDER, null);
}
```

`configCache`和`configIdCache`，分别缓存ConfigCacheEntry和Release对象。

ConfigCacheEntry是一个内部私有的静态类，是对通知编号和Release对象的封装。

```java
private static class ConfigCacheEntry {
    private final long notificationId;
    private final Release release;

    public ConfigCacheEntry(long notificationId, Release release) {
      this.notificationId = notificationId;
      this.release = release;
    }

    public long getNotificationId() {
      return notificationId;
    }

    public Release getRelease() {
      return release;
    }
  }
```

#### initialize

`initialize`方法中完成缓存的初始化

```java
@PostConstruct
void initialize() {
    configCache = CacheBuilder.newBuilder()
        .expireAfterAccess(DEFAULT_EXPIRED_AFTER_ACCESS_IN_MINUTES, TimeUnit.MINUTES)
        .build(new CacheLoader<String, ConfigCacheEntry>() {
            @Override
            public ConfigCacheEntry load(String key) throws Exception {
                List<String> namespaceInfo = ReleaseMessageKeyGenerator.messageToList(key);
                if (CollectionUtils.isEmpty(namespaceInfo)) {
                    Tracer.logError(
                        new IllegalArgumentException(String.format("Invalid cache load key %s", key)));
                    return nullConfigCacheEntry;
                }

                Transaction transaction = Tracer.newTransaction(TRACER_EVENT_CACHE_LOAD, key);
                try {
                    ReleaseMessage latestReleaseMessage = releaseMessageService.findLatestReleaseMessageForMessages(Lists
                        .newArrayList(key));
                    Release latestRelease = releaseService.findLatestActiveRelease(namespaceInfo.get(0), namespaceInfo.get(1),
                        namespaceInfo.get(2));

                    transaction.setStatus(Transaction.SUCCESS);

                    long notificationId = latestReleaseMessage == null ? ConfigConsts.NOTIFICATION_ID_PLACEHOLDER : latestReleaseMessage
                        .getId();

                    if (notificationId == ConfigConsts.NOTIFICATION_ID_PLACEHOLDER && latestRelease == null) {
                        return nullConfigCacheEntry;
                    }

                    return new ConfigCacheEntry(notificationId, latestRelease);
                } catch (Throwable ex) {
                    transaction.setStatus(ex);
                throw ex;
                } finally {
                    transaction.complete();
                }
            }
        });
    configIdCache = CacheBuilder.newBuilder()
        .expireAfterAccess(DEFAULT_EXPIRED_AFTER_ACCESS_IN_MINUTES, TimeUnit.MINUTES)
        .build(new CacheLoader<Long, Optional<Release>>() {
            @Override
            public Optional<Release> load(Long key) throws Exception {
                Transaction transaction = Tracer.newTransaction(TRACER_EVENT_CACHE_LOAD_ID, String.valueOf(key));
                try {
                    Release release = releaseService.findActiveOne(key);

                    transaction.setStatus(Transaction.SUCCESS);

                    return Optional.ofNullable(release);
                } catch (Throwable ex) {
                    transaction.setStatus(ex);
                    throw ex;
                } finally {
                    transaction.complete();
                }
            }
        });
}
```

* 初始化`configCache`
    * 调用`ReleaseMessageKeyGenerator.messageToList`将`key`转换为List，如果格式不符合要求返回`nullConfigCacheEntry`
    * 调用 `releaseMessageService.findLatestReleaseMessageForMessages(List<String>)` 方法，获得最新的 ReleaseMessage 对象。这一步是 DefaultConfigService 没有的操作，用于读取缓存的时候，判断缓存是否过期，下文详细解析。
    * 调用 `ReleaseService.findLatestActiveRelease(appId, clusterName, namespaceName)` 方法，获得最新的，且有效的 Release 对象。
    * 获得通知编号。
    * 若 `latestReleaseMessage` 和 `latestRelease` 都为空，返回 nullConfigCacheEntry 。
    * 创建 ConfigCacheEntry 对象，并返回。
* 初始化`configIdCache`
    * 调用 `ReleaseService#findActiveOne(key)` 方法，获得 Release 对象。
    * 调用 `Optional.ofNullable(Object)` 方法，使用 Optional 包装 Release 对象，并返回。

#### handleMessage

```java
@Override
public void handleMessage(ReleaseMessage message, String channel) {
    logger.info("message received - channel: {}, message: {}", channel, message);
    if (!Topics.APOLLO_RELEASE_TOPIC.equals(channel) || Strings.isNullOrEmpty(message.getMessage())) {
        return;
    }

    try {
        String messageKey = message.getMessage();
        if (bizConfig.isConfigServiceCacheKeyIgnoreCase()) {
            messageKey = messageKey.toLowerCase();
        }
        invalidate(messageKey);

        //warm up the cache
        configCache.getUnchecked(messageKey);
    } catch (Throwable ex) {
        //ignore
    }
}
```

* 判断`channel`，仅处理 APOLLO_RELEASE_TOPIC
* 调用 `#invalidate(message)` 方法，清空对应的缓存
* 调用 `LoadingCache#getUnchecked(key)` 方法，预热缓存，读取 ConfigCacheEntry 对象，重新从 DB 中加载。

#### findLatestActiveRelease

```java
protected Release findLatestActiveRelease(String appId, String clusterName, String namespaceName,
                                            ApolloNotificationMessages clientMessages) {
    String messageKey = ReleaseMessageKeyGenerator.generate(appId, clusterName, namespaceName);
    String cacheKey = messageKey;

    if (bizConfig.isConfigServiceCacheKeyIgnoreCase()) {
        cacheKey = cacheKey.toLowerCase();
    }

    Tracer.logEvent(TRACER_EVENT_CACHE_GET, cacheKey);

    ConfigCacheEntry cacheEntry = configCache.getUnchecked(cacheKey);

    //cache is out-dated
    if (clientMessages != null && clientMessages.has(messageKey) &&
        clientMessages.get(messageKey) > cacheEntry.getNotificationId()) {
        //invalidate the cache and try to load from db again
        invalidate(cacheKey);
        cacheEntry = configCache.getUnchecked(cacheKey);
    }

    return cacheEntry.getRelease();
}
```

* 调用 `ReleaseMessageKeyGenerator#generate(appId, clusterName, namespaceName)` 方法，根据 `appId` + `clusterName` + `namespaceName` ，获得 ReleaseMessage 的 message 。
* 调用 `LoadingCache#getUnchecked(key)` 方法，从缓存 configCache 中，读取 ConfigCacheEntry 对象。
* 若客户端的通知编号更大，说明缓存已经过期。因为 `#handleMessage(ReleaseMessage message, String channel)` 方法，是通过定时扫描 ReleaseMessage 的机制实现，那么延迟是不可避免会存在的。所以通过此处比较的方式，实现缓存的过期的检查。
    * 调用 `#invalidate(message)` 方法，清空对应的缓存。
    * 调用 `LoadingCache#getUnchecked(key)` 方法，读取 ConfigCacheEntry 对象，重新从 DB 中加载。

#### findActiveOne

```java
protected Release findActiveOne(long id, ApolloNotificationMessages clientMessages) {
    Tracer.logEvent(TRACER_EVENT_CACHE_GET_ID, String.valueOf(id));
    return configIdCache.getUnchecked(id).orElse(null);
}
```