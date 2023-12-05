# Apollo 源码解析 —— Portal 灰度发布

## 概述

灰度发布，实际上是子 Namespace ( 分支 Namespace )发布 Release 。所以，调用的接口和 《Apollo 源码解析 —— Portal 发布配置》 是一样的。

差异点，在于 `apollo-biz` 项目中，`ReleaseService#publish(...)` 方法中，多了一个处理灰度发布的分支逻辑。

## ReleaseService

### publishBranchNamespace

`#publishBranchNamespace(...)` 方法，子 Namespace 发布 Release 。子 Namespace 会自动继承 父 Namespace 已经发布的配置。若有相同的配置项，使用 子 Namespace 的。配置处理的逻辑上，和关联 Namespace 是一致的。代码如下：

```java
 private Release publishBranchNamespace(Namespace parentNamespace, Namespace childNamespace,
                                         Map<String, String> childNamespaceItems,
                                         String releaseName, String releaseComment,
                                         String operator, boolean isEmergencyPublish, Set<String> grayDelKeys) {
    Release parentLatestRelease = findLatestActiveRelease(parentNamespace);
    Map<String, String> parentConfigurations = parentLatestRelease != null ?
            GSON.fromJson(parentLatestRelease.getConfigurations(),
                          GsonType.CONFIG) : new LinkedHashMap<>();
    long baseReleaseId = parentLatestRelease == null ? 0 : parentLatestRelease.getId();

    Map<String, String> configsToPublish = mergeConfiguration(parentConfigurations, childNamespaceItems);

    if(!(grayDelKeys == null || grayDelKeys.size()==0)){
        for (String key : grayDelKeys){
            configsToPublish.remove(key);
        }
    }

    return branchRelease(parentNamespace, childNamespace, releaseName, releaseComment,
        configsToPublish, baseReleaseId, operator, ReleaseOperation.GRAY_RELEASE, isEmergencyPublish,
        childNamespaceItems.keySet());

}
```

* 调用 `#findLatestActiveRelease(parentNamespace)` 方法，获得父 Namespace 的最后有效 Release 对象。
* 获得父 Namespace 的配置 Map 。
* 获得父 Namespace 的 releaseId 属性。
* 调用 `#mergeConfiguration(parentConfigurations, childNamespaceItems)` 方法，合并父子 Namespace 的配置 Map 。代码如下：
    ```java
    private Map<String, String> mergeConfiguration(Map<String, String> baseConfigurations,
                                                    Map<String, String> coverConfigurations) {
        int expectedSize = baseConfigurations.size() + coverConfigurations.size();
        Map<String, String> result = Maps.newLinkedHashMapWithExpectedSize(expectedSize);

        //copy base configuration
        result.putAll(baseConfigurations);

        //update and publish
        result.putAll(coverConfigurations);

        return result;
    }
    ```
* 调用 `#branchRelease(...)` 方法，发布子 Namespace 的 Release 。代码如下：
    ```java
    private Release branchRelease(Namespace parentNamespace, Namespace childNamespace,
                                String releaseName, String releaseComment,
                                Map<String, String> configurations, long baseReleaseId,
                                String operator, int releaseOperation, boolean isEmergencyPublish, Collection<String> branchReleaseKeys) {
        Release previousRelease = findLatestActiveRelease(childNamespace.getAppId(),
                                                        childNamespace.getClusterName(),
                                                        childNamespace.getNamespaceName());
        long previousReleaseId = previousRelease == null ? 0 : previousRelease.getId();

        Map<String, Object> releaseOperationContext = Maps.newLinkedHashMap();
        releaseOperationContext.put(ReleaseOperationContext.BASE_RELEASE_ID, baseReleaseId);
        releaseOperationContext.put(ReleaseOperationContext.IS_EMERGENCY_PUBLISH, isEmergencyPublish);
        releaseOperationContext.put(ReleaseOperationContext.BRANCH_RELEASE_KEYS, branchReleaseKeys);

        Release release =
            createRelease(childNamespace, releaseName, releaseComment, configurations, operator);

        //update gray release rules
        GrayReleaseRule grayReleaseRule = namespaceBranchService.updateRulesReleaseId(childNamespace.getAppId(),
                                                                                    parentNamespace.getClusterName(),
                                                                                    childNamespace.getNamespaceName(),
                                                                                    childNamespace.getClusterName(),
                                                                                    release.getId(), operator);

        if (grayReleaseRule != null) {
        releaseOperationContext.put(ReleaseOperationContext.RULES, GrayReleaseRuleItemTransformer
            .batchTransformFromJSON(grayReleaseRule.getRules()));
        }

        releaseHistoryService.createReleaseHistory(parentNamespace.getAppId(), parentNamespace.getClusterName(),
                                                parentNamespace.getNamespaceName(), childNamespace.getClusterName(),
                                                release.getId(),
                                                previousReleaseId, releaseOperation, releaseOperationContext, operator);

        return release;
    }
    ```

### mergeFromMasterAndPublishBranch

在父 Namespace 发布 Release 后，会调用 `#mergeFromMasterAndPublishBranch(...)` 方法，自动将 父 Namespace (主干) 合并到子 Namespace (分支)，并进行一次子 Namespace 的发布。参考《Apollo源码分析——发布配置》。

## 加载灰度配置

在 `AbstractConfigService#findRelease(...)` 方法中，会读取根据客户端的情况，匹配是否有灰度 Release ，代码如下：

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

* 调用 `GrayReleaseRulesHolder#findReleaseIdFromGrayReleaseRule(...)` 方法，读取灰度发布编号，即 GrayReleaseRule.releaseId 属性。
* 调用 `#findActiveOne(grayReleaseId, clientMessages)` 方法，读取灰度 Release 对象。

### GrayReleaseRulesHolder

`com.ctrip.framework.apollo.biz.grayReleaseRule.GrayReleaseRulesHolder` ，实现 InitializingBean 和 ReleaseMessageListener 接口，GrayReleaseRule 缓存 Holder ，用于提高对 GrayReleaseRule 的读取速度。

#### 初始化

`#afterPropertiesSet()` 方法，通过 Spring 调用，初始化 Scan 任务。代码如下：

```java
@Override
public void afterPropertiesSet() throws Exception {
    populateDataBaseInterval();
    //force sync load for the first time
    periodicScanRules();
    executorService.scheduleWithFixedDelay(this::periodicScanRules,
        getDatabaseScanIntervalSecond(), getDatabaseScanIntervalSecond(), getDatabaseScanTimeUnit()
    );
}
```

* 调用 #populateDataBaseInterval() 方法，从 ServerConfig 中，读取定时任务的周期配置。代码如下：
    ```java
    private void populateDataBaseInterval() {
        databaseScanInterval = bizConfig.grayReleaseRuleScanInterval();
    }
    ```
* 调用 #periodicScanRules() 方法，初始拉取 GrayReleaseRuleCache 到缓存。代码如下：
    ```java
    private void periodicScanRules() {
        Transaction transaction = Tracer.newTransaction("Apollo.GrayReleaseRulesScanner",
            "scanGrayReleaseRules");
        try {
            loadVersion.incrementAndGet();
            scanGrayReleaseRules();
            transaction.setStatus(Transaction.SUCCESS);
        } catch (Throwable ex) {
            transaction.setStatus(ex);
            logger.error("Scan gray release rule failed", ex);
        } finally {
            transaction.complete();
        }
    }

    private void scanGrayReleaseRules() {
        long maxIdScanned = 0;
        boolean hasMore = true;

        while (hasMore && !Thread.currentThread().isInterrupted()) {
            List<GrayReleaseRule> grayReleaseRules = grayReleaseRuleRepository
                .findFirst500ByIdGreaterThanOrderByIdAsc(maxIdScanned);
            if (CollectionUtils.isEmpty(grayReleaseRules)) {
                break;
            }
            mergeGrayReleaseRules(grayReleaseRules);
            int rulesScanned = grayReleaseRules.size();
            maxIdScanned = grayReleaseRules.get(rulesScanned - 1).getId();
            //batch is 500
            hasMore = rulesScanned == 500;
        }
    }
    ```
    * 循环顺序、分批加载 GrayReleaseRule ，直到全部加载完或者线程打断。
    * loadVersion 属性，递增加载版本号。
    * 调用 `#mergeGrayReleaseRules(List<GrayReleaseRule>)` 方法，合并 GrayReleaseRule 数组，到缓存中。
* 创建定时任务，定时调用 `#scanGrayReleaseRules()` 方法，重新全量拉取 GrayReleaseRuleCache 到缓存。

#### handleMessage

`#handleMessage(ReleaseMessage, channel)` 实现方法，基于 ReleaseMessage 近实时通知，更新缓存。代码如下：

```java
public void handleMessage(ReleaseMessage message, String channel) {
    logger.info("message received - channel: {}, message: {}", channel, message);
    String releaseMessage = message.getMessage();
    if (!Topics.APOLLO_RELEASE_TOPIC.equals(channel) || Strings.isNullOrEmpty(releaseMessage)) {
        return;
    }
    List<String> keys = ReleaseMessageKeyGenerator.messageToList(releaseMessage);
    //message should be appId+cluster+namespace
    if (CollectionUtils.isEmpty(keys)) {
        return;
    }
    String appId = keys.get(0);
    String cluster = keys.get(1);
    String namespace = keys.get(2);

    List<GrayReleaseRule> rules = grayReleaseRuleRepository
        .findByAppIdAndClusterNameAndNamespaceName(appId, cluster, namespace);

    mergeGrayReleaseRules(rules);
}
```

* 只处理 APOLLO_RELEASE_TOPIC 的消息。
* 获得 appId cluster namespace 参数。
* 调用 `grayReleaseRuleRepository#findByAppIdAndClusterNameAndNamespaceName(appId, cluster, namespace)` 方法，获得对应的 GrayReleaseRule 数组。
* 调用 `#mergeGrayReleaseRules(List<GrayReleaseRule>)` 方法，合并到 GrayReleaseRule 缓存中。

#### mergeGrayReleaseRules

`#mergeGrayReleaseRules(List<GrayReleaseRule>)` 方法，合并 GrayReleaseRule 到缓存中。代码如下：

```java
private void mergeGrayReleaseRules(List<GrayReleaseRule> grayReleaseRules) {
    if (CollectionUtils.isEmpty(grayReleaseRules)) {
        return;
    }
    for (GrayReleaseRule grayReleaseRule : grayReleaseRules) {
      i f (grayReleaseRule.getReleaseId() == null || grayReleaseRule.getReleaseId() == 0) {
        //filter rules with no release id, i.e. never released
                continue;
        }
        String key = assembleGrayReleaseRuleKey(grayReleaseRule.getAppId(), grayReleaseRule
              .getClusterName(), grayReleaseRule.getNamespaceName());
        //create a new list to avoid ConcurrentModificationException
        List<GrayReleaseRuleCache> rules = Lists.newArrayList(grayReleaseRuleCache.get(key));
        GrayReleaseRuleCache oldRule = null;
        for (GrayReleaseRuleCache ruleCache : rules) {
            if (ruleCache.getBranchName().equals(grayReleaseRule.getBranchName())) {
                oldRule = ruleCache;
                break;
            }
        }

        //if old rule is null and new rule's branch status is not active, ignore
        if (oldRule == null && grayReleaseRule.getBranchStatus() != NamespaceBranchStatus.ACTIVE) {
            continue;
        }

        //use id comparison to avoid synchronization
        if (oldRule == null || grayReleaseRule.getId() > oldRule.getRuleId()) {
            addCache(key, transformRuleToRuleCache(grayReleaseRule));
            if (oldRule != null) {
                removeCache(key, oldRule);
            }
        } else {
            if (oldRule.getBranchStatus() == NamespaceBranchStatus.ACTIVE) {
                //update load version
                oldRule.setLoadVersion(loadVersion.get());
            } else if ((loadVersion.get() - oldRule.getLoadVersion()) > 1) {
                //remove outdated inactive branch rule after 2 update cycles
                removeCache(key, oldRule);
            }
        }
    }
}
```

* 若 GrayReleaseRule 无对应的 Release 编号，说明该子 Namespace 还未灰度发布，则忽略。
* 获得子 Namespace 对应的老的 GrayReleaseRuleCache 对象。此处的“老”，指的是缓存中的。
* 若不存在老的 GrayReleaseRuleCache ，并且当前 GrayReleaseRule 对应的分支不处于激活( ACTIVE 有效 )状态，则忽略。
* 若新的 GrayReleaseRule 为新增或更新( 编号更大 )，进行缓存更新，并移除老的 GrayReleaseRule 出缓存。
    * 调用 `transformRuleToRuleCache(GrayReleaseRule)` 方法，将 GrayReleaseRule 转换成 GrayReleaseRuleCache 对象。
    * 调用 `#addCache(key, GrayReleaseRuleCache)` 方法，添加新的 GrayReleaseRuleCache 到缓存中。
    * 调用 `#remove(key, oldRule)` 方法，移除老 的 GrayReleaseRuleCache 出缓存。
* 老的 GrayReleaseRuleCache 对应的分支处于激活( 有效 )状态，更新加载版本号。
    * 例如，定时轮询，有可能，早于 #handleMessage(...) 拿到对应的新的 GrayReleaseRule 记录，那么此时规则编号是相等的，不符合上面的条件，但是符合这个条件。
    * 再例如，两次定时轮询，第二次和第一次的规则编号是相等的，不符合上面的条件，但是符合这个条件。
    * 总结，刷新有效的 GrayReleaseRuleCache 对象的 loadVersion 。
* 若 `GrayReleaseRule.branchStatus` 为 DELETED 或 MERGED 的情况，保留两轮定时扫描，后调用 #remove(key, oldRule) 方法，移除出缓存。

#### findReleaseIdFromGrayReleaseRule

`#findReleaseIdFromGrayReleaseRule(clientAppId, clientIp, configAppId, configCluster, configNamespaceName)` 方法，若匹配上灰度规则，返回对应的 Release 编号。代码如下：

```java
public Long findReleaseIdFromGrayReleaseRule(String clientAppId, String clientIp, String clientLabel, String configAppId, String configCluster, String configNamespaceName) {
    String key = assembleGrayReleaseRuleKey(configAppId, configCluster, configNamespaceName);
    if (!grayReleaseRuleCache.containsKey(key)) {
        return null;
    }
    //create a new list to avoid ConcurrentModificationException
    List<GrayReleaseRuleCache> rules = Lists.newArrayList(grayReleaseRuleCache.get(key));
    for (GrayReleaseRuleCache rule : rules) {
        //check branch status
        if (rule.getBranchStatus() != NamespaceBranchStatus.ACTIVE) {
            continue;
        }
        if (rule.matches(clientAppId, clientIp, clientLabel)) {
            return rule.getReleaseId();
        }
    }
    return null;
}
```

### GrayReleaseRuleCache

`com.ctrip.framework.apollo.biz.grayReleaseRule.GrayReleaseRuleCache` ，GrayReleaseRule 的缓存类。代码如下：

```java
public class GrayReleaseRuleCache implements Comparable<GrayReleaseRuleCache> {
    private long ruleId;
    private String branchName;
    private String namespaceName;
    private long releaseId;
    private long loadVersion;
    private int branchStatus;
    private Set<GrayReleaseRuleItemDTO> ruleItems;

    public boolean matches(String clientAppId, String clientIp, String clientLabel) {
        for (GrayReleaseRuleItemDTO ruleItem : ruleItems) {
            if (ruleItem.matches(clientAppId, clientIp, clientLabel)) {
                return true;
            }
        }
        return false;
    }
}
````

相比 GrayReleaseRule 来说：

* 少了 appId + clusterName 字段，因为在 GrayReleaseRulesHolder 中，缓存 KEY 会根据需要包含这两个字段。
* 多了 loadVersion 字段，用于记录 GrayReleaseRuleCache 的加载版本，用于自动过期逻辑。