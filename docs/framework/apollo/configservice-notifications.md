# Apollo Portal源码分析——ConfigService通知配置变更

[[toc]]

## 概述

上文中提到`ReleaseMessageScanner`扫描到ReleaseMessage后会回调`ReleaseMessageListener`接口的实现，其中`NotificationControllerV2`实现和客户端推送配置相关。

那NotificationControllerV2在得知有配置发布后是如何通知到客户端的呢？

以下内容来自[Apollo配置中心设计](https://www.apolloconfig.com/#/zh/design/apollo-design)

实现方式如下：

> 1. 客户端会发起一个Http请求到Config Service的notifications/v2接口，也就是NotificationControllerV2，参见RemoteConfigLongPollService
> 2. NotificationControllerV2不会立即返回结果，而是通过Spring DeferredResult把请求挂起
> 3. 如果在60秒内没有该客户端关心的配置发布，那么会返回Http状态码304给客户端
> 4. 如果有该客户端关心的配置发布，NotificationControllerV2会调用DeferredResult的setResult方法，传入有配置变化的namespace信息，同时该请求会立即返回。客户端从返回的结果中获取到配置变化的namespace后，会立即请求Config Service获取该namespace的最新配置。

## NotificationControllerV2

### pollNotification

```java
@GetMapping
public DeferredResult<ResponseEntity<List<ApolloConfigNotification>>> pollNotification(
        @RequestParam(value = "appId") String appId,
        @RequestParam(value = "cluster") String cluster,
        @RequestParam(value = "notifications") String notificationsAsString,
        @RequestParam(value = "dataCenter", required = false) String dataCenter,
        @RequestParam(value = "ip", required = false) String clientIp) {
        List<ApolloConfigNotification> notifications = null;

    try {
        notifications =
            gson.fromJson(notificationsAsString, notificationsTypeReference);
    } catch (Throwable ex) {
        Tracer.logError(ex);
    }

    if (CollectionUtils.isEmpty(notifications)) {
        throw BadRequestException.invalidNotificationsFormat(notificationsAsString);
    }

    Map<String, ApolloConfigNotification> filteredNotifications = filterNotifications(appId, notifications);

    if (CollectionUtils.isEmpty(filteredNotifications)) {
        throw BadRequestException.invalidNotificationsFormat(notificationsAsString);
    }

    DeferredResultWrapper deferredResultWrapper = new DeferredResultWrapper(bizConfig.longPollingTimeoutInMilli());
    Set<String> namespaces = Sets.newHashSetWithExpectedSize(filteredNotifications.size());
    Map<String, Long> clientSideNotifications = Maps.newHashMapWithExpectedSize(filteredNotifications.size());

    for (Map.Entry<String, ApolloConfigNotification> notificationEntry : filteredNotifications.entrySet()) {
        String normalizedNamespace = notificationEntry.getKey();
        ApolloConfigNotification notification = notificationEntry.getValue();
        namespaces.add(normalizedNamespace);
        clientSideNotifications.put(normalizedNamespace, notification.getNotificationId());
        if (!Objects.equals(notification.getNamespaceName(), normalizedNamespace)) {
            deferredResultWrapper.recordNamespaceNameNormalizedResult(notification.getNamespaceName(), normalizedNamespace);
        }
    }

    Multimap<String, String> watchedKeysMap =
        watchKeysUtil.assembleAllWatchKeys(appId, cluster, namespaces, dataCenter);

    Set<String> watchedKeys = Sets.newHashSet(watchedKeysMap.values());

    /**
     * 1、set deferredResult before the check, for avoid more waiting
     * If the check before setting deferredResult,it may receive a notification the next time
     * when method handleMessage is executed between check and set deferredResult.
     */
    deferredResultWrapper
          .onTimeout(() -> logWatchedKeys(watchedKeys, "Apollo.LongPoll.TimeOutKeys"));

    deferredResultWrapper.onCompletion(() -> {
        //unregister all keys
        for (String key : watchedKeys) {
            deferredResults.remove(key, deferredResultWrapper);
        }
        logWatchedKeys(watchedKeys, "Apollo.LongPoll.CompletedKeys");
    });

    //register all keys
    for (String key : watchedKeys) {
        this.deferredResults.put(key, deferredResultWrapper);
    }

    logWatchedKeys(watchedKeys, "Apollo.LongPoll.RegisteredKeys");
    logger.debug("Listening {} from appId: {}, cluster: {}, namespace: {}, datacenter: {}",
        watchedKeys, appId, cluster, namespaces, dataCenter);

    /**
     * 2、check new release
     */
    List<ReleaseMessage> latestReleaseMessages =
        releaseMessageService.findLatestReleaseMessagesGroupByMessages(watchedKeys);

    /**
     * Manually close the entity manager.
     * Since for async request, Spring won't do so until the request is finished,
     * which is unacceptable since we are doing long polling - means the db connection would be hold
     * for a very long time
     */
    entityManagerUtil.closeEntityManager();

    List<ApolloConfigNotification> newNotifications =
        getApolloConfigNotifications(namespaces, clientSideNotifications, watchedKeysMap,
            latestReleaseMessages);

    if (!CollectionUtils.isEmpty(newNotifications)) {
        deferredResultWrapper.setResult(newNotifications);
    }

    return deferredResultWrapper.getResult();
}
```

1. 将`notificationsAsString`解析成`List<ApolloConfigNotification>`，表示客户端本地的配置通知信息
    * 因为一个客户端可以订阅多个 Namespace ，所以该参数是 List 
    * 该接口真正返回的结果也是`List<ApolloConfigNotification>`，仅返回配置发生变化的 Namespace 对应的 ApolloConfigNotification 。也就说，当有几个配置发生变化的 Namespace ，返回几个对应的 ApolloConfigNotification 。另外，客户端接收到返回后，会增量合并到本地的配置通知信息。客户端下次请求时，使用合并后的配置通知信息
    * 注意，客户端请求时，只传递 ApolloConfigNotification 的 `namespaceName` + `notificationId` ，不传递 messages
2. `clientIp`请求参数，目前该接口暂时用不到，作为预留参数
3. 调用`filterNotifications`方法，过滤后返回`Map<String, ApolloConfigNotification>`。`filterNotifications`的目的是客户端传递的Namespace名字可能不正确，比如大小写不对，这个方法会对其做归一化处理
    ```java
    private Map<String, ApolloConfigNotification> filterNotifications(String appId,
                                                                    List<ApolloConfigNotification> notifications) {
        Map<String, ApolloConfigNotification> filteredNotifications = Maps.newHashMap();
        for (ApolloConfigNotification notification : notifications) {
            if (Strings.isNullOrEmpty(notification.getNamespaceName())) {
                continue;
            }
            //strip out .properties suffix
            String originalNamespace = namespaceUtil.filterNamespaceName(notification.getNamespaceName());
            notification.setNamespaceName(originalNamespace);
            //fix the character case issue, such as FX.apollo <-> fx.apollo
            String normalizedNamespace = namespaceUtil.normalizeNamespace(appId, originalNamespace);

            // in case client side namespace name has character case issue and has difference notification ids
            // such as FX.apollo = 1 but fx.apollo = 2, we should let FX.apollo have the chance to update its notification id
            // which means we should record FX.apollo = 1 here and ignore fx.apollo = 2
            if (filteredNotifications.containsKey(normalizedNamespace) &&
                filteredNotifications.get(normalizedNamespace).getNotificationId() < notification.getNotificationId()) {
                continue;
            }

            filteredNotifications.put(normalizedNamespace, notification);
        }
        return filteredNotifications;
    }
    ```
    * 调用`namespaceUtil.filterNamespaceName`方法过滤Namespace后缀，如果是以`.properties`结尾则去掉该后缀
        ```java
        public String filterNamespaceName(String namespaceName) {
            if (namespaceName.toLowerCase().endsWith(".properties")) {
            int dotIndex = namespaceName.lastIndexOf(".");
            return namespaceName.substring(0, dotIndex);
            }

            return namespaceName;
        }
        ```
    * 调用`namespaceUtil.normalizeNamespace`方法进行归一化处理。例如，数据库中Namespace名为`Fx.Apollo`，而客户端Namespace名为`fx.Apollo`,通过归一化后，统一为`Fx.Apollo`
        ```java
        public String normalizeNamespace(String appId, String namespaceName) {
            AppNamespace appNamespace = appNamespaceServiceWithCache.findByAppIdAndNamespace(appId, namespaceName);
            if (appNamespace != null) {
                return appNamespace.getName();
            }

            appNamespace = appNamespaceServiceWithCache.findPublicNamespaceByName(namespaceName);
            if (appNamespace != null) {
                return appNamespace.getName();
            }

            return namespaceName;
        }
        ```
    * 如果客户端Namespace的名字有大小写的问题，并且恰好有不同的通知编号。例如Namespace名字为`FX.apollo`的通知编号是1，但是`fx.apollo`的通知编号为2。我们应该让`FX.apollo`可以更新它的通知编号，所以，我们使用`FX.apollo`的ApolloConfigNotification对象，添加到结果，而忽略`fx.apollo`。通过这样的方式，若此时服务器的通知编号为3，那么`FX.apollo`的通知编号先更新成3，再下一次长轮询时，`fx.apollo`的通知编号再更新成3
4. 创建`DeferredResultWrapper`对象，超时时间由`bizConfig.longPollingTimeoutInMilli()`返回，可通过参数`long.polling.timeout`设置，默认值60s
5. 创建`Set<String>`对象`namespaces`、`Map<String, Long>`对象`clientSideNotifications`，循环`filterNotifications`，将归一化后的Namespace名字加入到`namespaces`和`clientSideNotifications`中。如果归一化的Namespace名字与客户端传递的Namespace名字不一致，则记录到`deferredResultWrapper`中，原因是客户端只认识原始的Namespace名字
6. 调用`watchKeysUtil.assembleAllWatchKeys`组装Watch Key
7. 为`deferredResultWrapper`设置`onTimeout`、`onCompletion`事件的回调函数
8. 将每个Watch Key和`deferredResultWrapper`注册到`deferredResults`中
9. 调用`releaseMessageService.findLatestReleaseMessagesGroupByMessages`方法，获得 Watch Key 集合中，每个 Watch Key 对应的最新的 ReleaseMessage 记录
10. 调用`entityManagerUtil.closeEntityManager`手动关闭 EntityManager，对应Async请求，Srping在请求完成之前是不会关闭EntityManager的，这意味着长连接过程中，数据库连接不会释放，实际上后面的处理已经不需要数据库连接了，所以这里释放调
11. 调用`getApolloConfigNotifications`方法，获得新的 ApolloConfigNotification 通知数组`newNotifications`
    ```java
    private List<ApolloConfigNotification> getApolloConfigNotifications(Set<String> namespaces,
                                                                      Map<String, Long> clientSideNotifications,
                                                                      Multimap<String, String> watchedKeysMap,
                                                                      List<ReleaseMessage> latestReleaseMessages) {
        List<ApolloConfigNotification> newNotifications = Lists.newArrayList();
        if (!CollectionUtils.isEmpty(latestReleaseMessages)) {
        Map<String, Long> latestNotifications = Maps.newHashMap();
        for (ReleaseMessage releaseMessage : latestReleaseMessages) {
            latestNotifications.put(releaseMessage.getMessage(), releaseMessage.getId());
        }

        for (String namespace : namespaces) {
            long clientSideId = clientSideNotifications.get(namespace);
            long latestId = ConfigConsts.NOTIFICATION_ID_PLACEHOLDER;
            Collection<String> namespaceWatchedKeys = watchedKeysMap.get(namespace);
            for (String namespaceWatchedKey : namespaceWatchedKeys) {
                long namespaceNotificationId =
                    latestNotifications.getOrDefault(namespaceWatchedKey, ConfigConsts.NOTIFICATION_ID_PLACEHOLDER);
                if (namespaceNotificationId > latestId) {
                    latestId = namespaceNotificationId;
                }
            }
            if (latestId > clientSideId) {
                ApolloConfigNotification notification = new ApolloConfigNotification(namespace, latestId);
                namespaceWatchedKeys.stream().filter(latestNotifications::containsKey).forEach(namespaceWatchedKey ->
                    notification.addMessage(namespaceWatchedKey, latestNotifications.get(namespaceWatchedKey)));
                newNotifications.add(notification);
            }
        }
        }
        return newNotifications;
    }
    ```
    * 遍历`latestReleaseMessages`，将服务端最新的ReleaseMessage记录在`latestNotifications`中
    * 遍历`namespaces`，从`clientSideNotifications`获取客户端该Namespace的通知ID，计算服务端最大的ID
    * 若服务器的通知编号大于客户端的通知编号，意味着有配置更新，那么会创建`ApolloConfigNotification`对象，循环调用`addMessage`方法，添加到`ApolloConfigNotification`中
    * 返回`newNotifications`，若非空，说明有配置更新
12. 若有新的通知，调用`DeferredResultWrapper#setResult(List<ApolloConfigNotification>)`方法，直接设置 DeferredResult 的结果，从而结束长轮询。

### handleMessage

`handleMessage`方法实现了`ReleaseMessageListener`接口中的定义，用于ReleaseMessage的通知

```java
@RestController
@RequestMapping("/notifications/v2")
public class NotificationControllerV2 implements ReleaseMessageListener {
    @Override
    public void handleMessage(ReleaseMessage message, String channel) {
        logger.info("message received - channel: {}, message: {}", channel, message);

        String content = message.getMessage();
        Tracer.logEvent("Apollo.LongPoll.Messages", content);
        if (!Topics.APOLLO_RELEASE_TOPIC.equals(channel) || Strings.isNullOrEmpty(content)) {
            return;
        }

        String changedNamespace = retrieveNamespaceFromReleaseMessage.apply(content);

        if (Strings.isNullOrEmpty(changedNamespace)) {
            logger.error("message format invalid - {}", content);
            return;
        }

        if (!deferredResults.containsKey(content)) {
            return;
        }

        //create a new list to avoid ConcurrentModificationException
        List<DeferredResultWrapper> results = Lists.newArrayList(deferredResults.get(content));

        ApolloConfigNotification configNotification = new ApolloConfigNotification(changedNamespace, message.getId());
        configNotification.addMessage(content, message.getId());

        //do async notification if too many clients
        if (results.size() > bizConfig.releaseMessageNotificationBatch()) {
            largeNotificationBatchExecutorService.submit(() -> {
                logger.debug("Async notify {} clients for key {} with batch {}", results.size(), content,
                    bizConfig.releaseMessageNotificationBatch());
                for (int i = 0; i < results.size(); i++) {
                if (i > 0 && i % bizConfig.releaseMessageNotificationBatch() == 0) {
                    try {
                        TimeUnit.MILLISECONDS.sleep(bizConfig.releaseMessageNotificationBatchIntervalInMilli());
                    } catch (InterruptedException e) {
                        //ignore
                    }
                }
                logger.debug("Async notify {}", results.get(i));
                results.get(i).setResult(configNotification);
                }
            });
            return;
        }

        logger.debug("Notify {} clients for key {}", results.size(), content);

        for (DeferredResultWrapper result : results) {
            result.setResult(configNotification);
        }
        logger.debug("Notification completed");
    }
}
```

1. 判断`channel`是否是`Topics.APOLLO_RELEASE_TOPIC = "apollo-release"`，且ReleaseMessage的`content`不为空，否则直接返回
2. 调用`retrieveNamespaceFromReleaseMessage`函数，将`content`进行分隔提取出Namespace，如果Namespace是空的话直接返回。ReleaseMessage消息格式可以参考前文，具体在`ReleaseMessageKeyGenerator.generate`方法，格式是`appId+cluster+namespace`
    ```java
    private static final Function<String, String> retrieveNamespaceFromReleaseMessage =
        releaseMessage -> {
            if (Strings.isNullOrEmpty(releaseMessage)) {
            return null;
            }
            List<String> keys = ReleaseMessageKeyGenerator.messageToList(releaseMessage);
            if (CollectionUtils.isEmpty(keys)) {
            return null;
            }
            return keys.get(2);
        };
    ```
3. 检查`deferredResults`是否包含`content`，不包含直接返回
4. 从`deferredResults`中构造`DeferredResultWrapper`列表`results`，注意`deferredResults`是一个`Multimap`结构，因此`get`时候返回的是一个集合
5. 创建`ApolloConfigNotification`对象`configNotification`作为最终返回给客户端的数据结构，并调用`addMessage`方法将`content`加入到内部的`ApolloNotificationMessages`对象`messages`中
6. 如果`results`列表的长度大于`bizConfig.releaseMessageNotificationBatch()`（这个值由参数`apollo.release-message.notification.batch`设置，默认值是100）。如果列表过长表示现在有太多的客户端长连接存在，那么会在`largeNotificationBatchExecutorService`线程池中异步向客户端推送，每推送`bizConfig.releaseMessageNotificationBatch()`个客户端，就会sleep `bizConfig.releaseMessageNotificationBatchIntervalInMilli()`（这个值由参数`apollo.release-message.notification.batch.interval`设置，默认值是100）毫秒
7. 如果`reulsts`李彪长度不大于`bizConfig.releaseMessageNotificationBatch()`，那么直接`setResult`通知客户端

## ApolloConfigNotification

`com.ctrip.framework.apollo.core.dto.ApolloConfigNotification`，Apollo配置通知DTO

```java
public class ApolloConfigNotification {
    private String namespaceName;
    private long notificationId;
    private volatile ApolloNotificationMessages messages;

    public ApolloConfigNotification(String namespaceName, long notificationId) {
        this.namespaceName = namespaceName;
        this.notificationId = notificationId;
    }

    public void addMessage(String key, long notificationId) {
        if (this.messages == null) {
            synchronized(this) {
                if (this.messages == null) {
                    this.messages = new ApolloNotificationMessages();
                }
            }
        }

        this.messages.put(key, notificationId);
    }
}
```

* `messages`使用了`volatile`修饰，原因是可能存在多线程修改

`ApolloNotificationMessages`就是对Map的封装，内部仅有一个Map结构`details`

```java
public class ApolloNotificationMessages {
    private Map<String, Long> details;
}
```

为什么`ApolloConfigNotification`中有`ApolloNotificationMessages`，而且`ApolloNotificationMessages`的`details`字段是Map？按道理说，对于一个Namespace的通知，使用 `ApolloConfigNotification`的`namespaceName + notificationId`已经足够了。但是，在`namespaceName`对应的Namespace是关联类型时，会同时查询`当前Namespace + 关联的Namespace`这两个Namespace，所以会是多个，使用Map数据结构。 当然，对于`/notifications/v2`接口，仅有【直接】获得到配置变化才可能出现`ApolloNotificationMessages.details`为多个的情况。为啥？在`#handleMessage(...)`方法中，一次只处理一条ReleaseMessage，因此只会有`ApolloNotificationMessages.details`只会有一个。

## DeferredResultWrapper

`com.ctrip.framework.apollo.configservice.wrapper.DeferredResultWrapper` ，DeferredResult 包装器，封装 DeferredResult 的公用方法。

```java
private static final ResponseEntity<List<ApolloConfigNotification>>
      NOT_MODIFIED_RESPONSE_LIST = new ResponseEntity<>(HttpStatus.NOT_MODIFIED);

private Map<String, String> normalizedNamespaceNameToOriginalNamespaceName;

private DeferredResult<ResponseEntity<List<ApolloConfigNotification>>> result;

public DeferredResultWrapper(long timeoutInMilli) {
    result = new DeferredResult<>(timeoutInMilli, NOT_MODIFIED_RESPONSE_LIST);
}
```

`NOT_MODIFIED_RESPONSE_LIST`，静态属性，未修改时的 ResponseEntity 响应，使用 304 状态码。

`result` 属性，响应的 DeferredResult 对象，在构造方法中初始化。

`normalizedNamespaceNameToOriginalNamespaceName`属性，归一化( normalized )和原始( original )的 Namespace 的名字的 Map 。因为客户端在填写 Namespace 时，写错了名字的大小写。在 Config Service 中，会进行归一化“修复”，方便逻辑的统一编写。但是，最终返回给客户端需要“还原”回原始( original )的 Namespace 的名字，避免客户端无法识别。

```java
public void recordNamespaceNameNormalizedResult(String originalNamespaceName, String normalizedNamespaceName) {
    if (normalizedNamespaceNameToOriginalNamespaceName == null) {
      normalizedNamespaceNameToOriginalNamespaceName = Maps.newHashMap();
    }
    normalizedNamespaceNameToOriginalNamespaceName.put(normalizedNamespaceName, originalNamespaceName);
}
```

```java
public void setResult(List<ApolloConfigNotification> notifications) {
    // 恢复被归一化的 Namespace 的名字为原始的 Namespace 的名字
    if (normalizedNamespaceNameToOriginalNamespaceName != null) {
        notifications.stream().filter(notification -> normalizedNamespaceNameToOriginalNamespaceName.containsKey
                (notification.getNamespaceName())).forEach(notification -> notification.setNamespaceName(
                normalizedNamespaceNameToOriginalNamespaceName.get(notification.getNamespaceName())));
    }
    // 设置结果，并使用 200 状态码。
    result.setResult(new ResponseEntity<>(notifications, HttpStatus.OK));
}
```

## ReleaseMessageServiceWithCache

`com.ctrip.framework.apollo.configservice.service.ReleaseMessageServiceWithCache` ，实现 InitializingBean 和 ReleaseMessageListener 接口，缓存 ReleaseMessage 的 Service 实现类。通过将 ReleaseMessage 缓存在内存中，提高查询性能。缓存实现方式如下：

* 启动时，初始化 ReleaseMessage 到缓存。
* 新增时，基于 ReleaseMessageListener ，通知有新的 ReleaseMessage ，根据是否有消息间隙，直接使用该 ReleaseMessage 或从数据库读取。

`#afterPropertiesSet()` 方法，通知 Spring 调用，初始化定时任务。代码如下：

```java
@Override
public void afterPropertiesSet() throws Exception {
    populateDataBaseInterval();
    //block the startup process until load finished
    //this should happen before ReleaseMessageScanner due to autowire
    loadReleaseMessages(0);

    executorService.submit(() -> {
        while (doScan.get() && !Thread.currentThread().isInterrupted()) {
            Transaction transaction = Tracer.newTransaction("Apollo.ReleaseMessageServiceWithCache", "scanNewReleaseMessages");
            try {
                loadReleaseMessages(maxIdScanned);
                transaction.setStatus(Transaction.SUCCESS);
            } catch (Throwable ex) {
                transaction.setStatus(ex);
                logger.error("Scan new release messages failed", ex);
            } finally {
                transaction.complete();
            }
            try {
                scanIntervalTimeUnit.sleep(scanInterval);
            } catch (InterruptedException e) {
                //ignore
            }
        }
    });
}
```

1. 调用`#populateDataBaseInterval()`方法，从`bizConfig`中读取`scanInterval`和`scanIntervalTimeUnit`
    ```java
    private void populateDataBaseInterval() {
        scanInterval = bizConfig.releaseMessageCacheScanInterval();
        scanIntervalTimeUnit = bizConfig.releaseMessageCacheScanIntervalTimeUnit();
    }
    ```

2. 调用`#loadReleaseMessages(startId)`方法，初始拉取 ReleaseMessage 到缓存。以`startId`为起点、500为批次大小，分批从数据库中查询ReleaseMessage，调用`mergeReleaseMessage`合并到缓存中。
    ```java
    private void loadReleaseMessages(long startId) {
        boolean hasMore = true;
        while (hasMore && !Thread.currentThread().isInterrupted()) {
            //current batch is 500
            List<ReleaseMessage> releaseMessages = releaseMessageRepository
                .findFirst500ByIdGreaterThanOrderByIdAsc(startId);
            if (CollectionUtils.isEmpty(releaseMessages)) {
                break;
            }
            releaseMessages.forEach(this::mergeReleaseMessage);
            int scanned = releaseMessages.size();
            startId = releaseMessages.get(scanned - 1).getId();
            hasMore = scanned == 500;
            logger.info("Loaded {} release messages with startId {}", scanned, startId);
        }
    }

    private synchronized void mergeReleaseMessage(ReleaseMessage releaseMessage) {
        ReleaseMessage old = releaseMessageCache.get(releaseMessage.getMessage());
        if (old == null || releaseMessage.getId() > old.getId()) {
            releaseMessageCache.put(releaseMessage.getMessage(), releaseMessage);
            maxIdScanned = releaseMessage.getId();
        }
    }
    ```

3. 当有新ReleaseMessage产生时会回调`#handleMessage()`方法，代码如下

    ```java
    @Override
    public void handleMessage(ReleaseMessage message, String channel) {
        //Could stop once the ReleaseMessageScanner starts to work
        doScan.set(false);
        logger.info("message received - channel: {}, message: {}", channel, message);

        String content = message.getMessage();
        Tracer.logEvent("Apollo.ReleaseMessageService.UpdateCache", String.valueOf(message.getId()));
        if (!Topics.APOLLO_RELEASE_TOPIC.equals(channel) || Strings.isNullOrEmpty(content)) {
            return;
        }

        long gap = message.getId() - maxIdScanned;
        if (gap == 1) {
            mergeReleaseMessage(message);
        } else if (gap > 1) {
            //gap found!
            loadReleaseMessages(maxIdScanned);
        }
    }
    ```

    * 关闭增量拉取定时任务的执行。后续通过 ReleaseMessageScanner 通知即可。
    * 仅处理 APOLLO_RELEASE_TOPIC 。
    * 计算`gap`
    * 若无空缺，调用 `#mergeReleaseMessage(message)` 方法，直接合并即可。
    * 若有空缺，调用 `#loadReleaseMessages(maxIdScanned)` 方法，增量拉取。
    * 何时会产生空缺？定时任务还来不及拉取( 即未执行 )，ReleaseMessageScanner 就已经通知，此处会产生空缺的 gap 。

## WatchKeysUtil

`com.ctrip.framework.apollo.configservice.util.WatchKeysUtil` ，Watch Key 工具类。

核心的方法为 `#assembleAllWatchKeys(appId, clusterName, namespaces, dataCenter)` 方法，组装 Watch Key Multimap 。其中 KEY 为 Namespace 的名字，VALUE 为 Watch Key 集合。代码如下：

```java
public Multimap<String, String> assembleAllWatchKeys(String appId, String clusterName,
                                                       Set<String> namespaces,
                                                       String dataCenter) {
    Multimap<String, String> watchedKeysMap =
        assembleWatchKeys(appId, clusterName, namespaces, dataCenter);

    //Every app has an 'application' namespace
    if (!(namespaces.size() == 1 && namespaces.contains(ConfigConsts.NAMESPACE_APPLICATION))) {
        Set<String> namespacesBelongToAppId = namespacesBelongToAppId(appId, namespaces);
        Set<String> publicNamespaces = Sets.difference(namespaces, namespacesBelongToAppId);

        //Listen on more namespaces if it's a public namespace
        if (!publicNamespaces.isEmpty()) {
            watchedKeysMap
                .putAll(findPublicConfigWatchKeys(appId, clusterName, publicNamespaces, dataCenter));
        }
    }

    return watchedKeysMap;
}
```

1. 调用 `#assembleWatchKeys(appId, clusterName, namespaces, dataCenter)` 方法，组装 App 下的 Watch Key Multimap 。
    ```java
    private Multimap<String, String> assembleWatchKeys(String appId, String clusterName,
                                                     Set<String> namespaces,
                                                     String dataCenter) {
        Multimap<String, String> watchedKeysMap = HashMultimap.create();

        for (String namespace : namespaces) {
            watchedKeysMap.putAll(namespace, assembleWatchKeys(appId, clusterName, namespace, dataCenter));
        }

        return watchedKeysMap;
    }

    private Set<String> assembleWatchKeys(String appId, String clusterName, String namespace,
                                        String dataCenter) {
        if (ConfigConsts.NO_APPID_PLACEHOLDER.equalsIgnoreCase(appId)) {
            return Collections.emptySet();
        }
        Set<String> watchedKeys = Sets.newHashSet();

        //watch specified cluster config change
        if (!Objects.equals(ConfigConsts.CLUSTER_NAME_DEFAULT, clusterName)) {
            watchedKeys.add(generate(appId, clusterName, namespace));
        }

        //watch data center config change
        if (!Strings.isNullOrEmpty(dataCenter) && !Objects.equals(dataCenter, clusterName)) {
         watchedKeys.add(generate(appId, dataCenter, namespace));
        }

        //watch default cluster config change
        watchedKeys.add(generate(appId, ConfigConsts.CLUSTER_NAME_DEFAULT, namespace));

        return watchedKeys;
    }
    ```
2. 判断 namespaces 中，可能存在关联类型的 Namespace ，因此需要进一步处理。在这里的判断会比较“绕”，如果 namespaces 仅仅是 "application" 时，那么肯定不存在关联类型的 Namespace 。
    * 调用 `#namespacesBelongToAppId(appId, namespaces)` 方法，获得属于该 App 的 Namespace 的名字的集合。
        ```java
        private Set<String> namespacesBelongToAppId(String appId, Set<String> namespaces) {
            if (ConfigConsts.NO_APPID_PLACEHOLDER.equalsIgnoreCase(appId)) {
                return Collections.emptySet();
            }
            List<AppNamespace> appNamespaces = appNamespaceService.findByAppIdAndNamespaces(appId, namespaces);

            if (appNamespaces == null || appNamespaces.isEmpty()) {
                return Collections.emptySet();
            }

            return appNamespaces.stream().map(AppNamespace::getName).collect(Collectors.toSet());
        }
        ```
    * 通过 `Sets#difference(...)` 方法，进行集合差异计算，获得关联类型的 Namespace 的名字的集合。
    * 调用` #findPublicConfigWatchKeys(...)` 方法，获得关联类型的 Namespace 的名字的集合的 Watch Key Multimap ，并添加到结果集中。
        ```java
        private Multimap<String, String> findPublicConfigWatchKeys(String applicationId,
                                                             String clusterName,
                                                             Set<String> namespaces,
                                                             String dataCenter) {
            Multimap<String, String> watchedKeysMap = HashMultimap.create();
            List<AppNamespace> appNamespaces = appNamespaceService.findPublicNamespacesByNames(namespaces);

            for (AppNamespace appNamespace : appNamespaces) {
                //check whether the namespace's appId equals to current one
                if (Objects.equals(applicationId, appNamespace.getAppId())) {
                    continue;
            }

                String publicConfigAppId = appNamespace.getAppId();

                watchedKeysMap.putAll(appNamespace.getName(),
                    assembleWatchKeys(publicConfigAppId, clusterName, appNamespace.getName(), dataCenter));
            }

            return watchedKeysMap;
        }
        ```

## EntityManagerUtil

`com.ctrip.framework.apollo.biz.utils.EntityManagerUtil` ，实现 `org.springframework.orm.jpa.EntityManagerFactoryAccessor` 抽象类，EntityManager 抽象类。代码如下：

```java
@Component
public class EntityManagerUtil extends EntityManagerFactoryAccessor {
    private static final Logger logger = LoggerFactory.getLogger(EntityManagerUtil.class);
    /**
    * close the entity manager.
    * Use it with caution! This is only intended for use with async request, which Spring won't
    * close the entity manager until the async request is finished.
    */
    public void closeEntityManager() {
        EntityManagerHolder emHolder = (EntityManagerHolder)
            TransactionSynchronizationManager.getResource(getEntityManagerFactory());
        if (emHolder == null) {
            return;
        }
        logger.debug("Closing JPA EntityManager in EntityManagerUtil");
        EntityManagerFactoryUtils.closeEntityManager(emHolder.getEntityManager());
    }
}
```