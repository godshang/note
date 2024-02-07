# Apollo 源码解析 —— Portal 灰度全量发布

## 概述

灰度全量发布，和 《Apollo 源码解析 —— Portal 发布配置》 ，差异点在于，多了一步配置合并，所以代码实现上，有很多相似度。

## Portal

### NamespaceBranchController

在 `apollo-portal` 项目中，`com.ctrip.framework.apollo.portal.controller.NamespaceBranchController` ，提供 Namespace 分支的 API 。

`#merge(...)` 方法，灰度全量发布，合并子 Namespace 变更的配置 Map 到父 Namespace ，并进行一次 Release 。代码如下：

```java
@PostMapping(value = "/apps/{appId}/envs/{env}/clusters/{clusterName}/namespaces/{namespaceName}/branches/{branchName}/merge")
  public ReleaseDTO merge(@PathVariable String appId, @PathVariable String env,
                          @PathVariable String clusterName, @PathVariable String namespaceName,
                          @PathVariable String branchName, @RequestParam(value = "deleteBranch", defaultValue = "true") boolean deleteBranch,
                          @RequestBody NamespaceReleaseModel model) {

    if (model.isEmergencyPublish() && !portalConfig.isEmergencyPublishAllowed(Env.valueOf(env))) {
        throw new BadRequestException("Env: %s is not supported emergency publish now", env);
    }

    ReleaseDTO createdRelease = namespaceBranchService.merge(appId, Env.valueOf(env), clusterName, namespaceName, branchName,
                                                             model.getReleaseTitle(), model.getReleaseComment(),
                                                             model.isEmergencyPublish(), deleteBranch);

    ConfigPublishEvent event = ConfigPublishEvent.instance();
    event.withAppId(appId)
        .withCluster(clusterName)
        .withNamespace(namespaceName)
        .withReleaseId(createdRelease.getId())
        .setMergeEvent(true)
        .setEnv(Env.valueOf(env));

    publisher.publishEvent(event);

    return createdRelease;
}
```

* POST `/apps/{appId}/envs/{env}/clusters/{clusterName}/namespaces/{namespaceName}/branches/{branchName}/merge` 接口，Request Body 传递 JSON 对象。
* 校验若是紧急发布，但是当前环境未允许该操作，抛出 BadRequestException 异常。
* 调用 `NamespaceBranchService#merge(...)` 方法，合并子 Namespace 变更的配置 Map 到父 Namespace ，并进行一次 Release 。
* 创建 ConfigPublishEvent 对象，并调用 `ApplicationEventPublisher#publishEvent(event)` 方法，发布 ConfigPublishEvent 事件。
* 返回 ReleaseDTO 对象。

### NamespaceBranchService

在 `apollo-portal` 项目中，`com.ctrip.framework.apollo.portal.service.NamespaceBranchService` ，提供 Namespace 分支的 Service 逻辑。

`#merge(...)` 方法，调用 Admin Service API ，合并子 Namespace 变更的配置 Map 到父 Namespace ，并进行一次 Release 。代码如下：

```java
public ReleaseDTO merge(String appId, Env env, String clusterName, String namespaceName,
                        String branchName, String title, String comment,
                        boolean isEmergencyPublish, boolean deleteBranch, String operator) {

    ItemChangeSets changeSets = calculateBranchChangeSet(appId, env, clusterName, namespaceName, branchName, operator);

    ReleaseDTO mergedResult =
            releaseService.updateAndPublish(appId, env, clusterName, namespaceName, title, comment,
                    branchName, isEmergencyPublish, deleteBranch, changeSets);

    Tracer.logEvent(TracerEventType.MERGE_GRAY_RELEASE,
            String.format("%s+%s+%s+%s", appId, env, clusterName, namespaceName));

    return mergedResult;
}
```

* 调用 `#calculateBranchChangeSet(appId, env, clusterName, namespaceName, branchName)` 方法，计算变化的 Item 集合。
    
    ```java
    private ItemChangeSets calculateBranchChangeSet(String appId, Env env, String clusterName, String namespaceName,
                                                    String branchName, String operator) {
        NamespaceBO parentNamespace = namespaceService.loadNamespaceBO(appId, env, clusterName, namespaceName);

        if (parentNamespace == null) {
            throw BadRequestException.namespaceNotExists(appId, clusterName, namespaceName);
        }

        if (parentNamespace.getItemModifiedCnt() > 0) {
            throw new BadRequestException("Merge operation failed. Because master has modified items");
        }

        List<ItemDTO> masterItems = itemService.findItems(appId, env, clusterName, namespaceName);

        List<ItemDTO> branchItems = itemService.findItems(appId, env, branchName, namespaceName);

        ItemChangeSets changeSets = itemsComparator.compareIgnoreBlankAndCommentItem(parentNamespace.getBaseInfo().getId(),
                                                                                    masterItems, branchItems);
        changeSets.setDeleteItems(Collections.emptyList());
        changeSets.setDataChangeLastModifiedBy(operator);
        return changeSets;
    }
    ```

    * 调用 `namespaceService#loadNamespaceBO(appId, env, clusterName, namespaceName)` 方法，获得父 NamespaceBO 对象。该对象，包含了 Namespace 的详细数据，包括 Namespace 的基本信息、配置集合。
    * 若父 Namespace 不存在，抛出 BadRequestException 异常。
    * 若父 Namespace 有未发布的配置变更，不允许合并。因为，可能存在冲突，无法自动解决。此时，需要在 Portal 上将父 Namespace 的配置进行一次发布，或者回退回历史版本。
    * 调用 `ItemService#findItems(appId, env, clusterName, namespaceName)` 方法，获得父 Namespace 及子 Namespace 的 ItemDTO 数组。
    * 调用 `ItemsComparator#compareIgnoreBlankAndCommentItem(baseNamespaceId, baseItems, targetItems)` 方法，计算变化的 Item 集合。
    * 设置 `ItemChangeSets.deleteItem` 为空。因为子 Namespace 从父 Namespace 继承配置，但是实际自己没有那些配置项，所以如果不设置为空，会导致合并时，这些配置项被删除。

* 调用 `ReleaseService#updateAndPublish(...)` 方法，调用 Admin Service API ，合并子 Namespace 变更的配置 Map 到父 Namespace ，并进行一次 Release 。

### ReleaseAPI

`com.ctrip.framework.apollo.portal.api.ReleaseAPI` ，实现 API 抽象类，封装对 Admin Service 的 Release 模块的 API 调用。代码如下：

```java
public ReleaseDTO updateAndPublish(String appId, Env env, String clusterName, String namespace,
        String releaseName, String releaseComment, String branchName,
        boolean isEmergencyPublish, boolean deleteBranch, ItemChangeSets changeSets) {

    return restTemplate.post(env,
          "apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}/updateAndPublish?"
              + "releaseName={releaseName}&releaseComment={releaseComment}&branchName={branchName}"
              + "&deleteBranch={deleteBranch}&isEmergencyPublish={isEmergencyPublish}",
          changeSets, ReleaseDTO.class, appId, clusterName, namespace,
          releaseName, releaseComment, branchName, deleteBranch, isEmergencyPublish);

}
```

## Admin Service

### ReleaseController

在 `apollo-adminservice` 项目中， `com.ctrip.framework.apollo.adminservice.controller.ReleaseController` ，提供 Release 的 API 。

`#updateAndPublish(...)` 方法，合并子 Namespace 变更的配置 Map 到父 Namespace ，并进行一次 Release 。代码如下：

```java
@Transactional
  @PostMapping("/apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}/updateAndPublish")
  public ReleaseDTO updateAndPublish(@PathVariable("appId") String appId,
                                     @PathVariable("clusterName") String clusterName,
                                     @PathVariable("namespaceName") String namespaceName,
                                     @RequestParam("releaseName") String releaseName,
                                     @RequestParam("branchName") String branchName,
                                     @RequestParam(value = "deleteBranch", defaultValue = "true") boolean deleteBranch,
                                     @RequestParam(name = "releaseComment", required = false) String releaseComment,
                                     @RequestParam(name = "isEmergencyPublish", defaultValue = "false") boolean isEmergencyPublish,
                                     @RequestBody ItemChangeSets changeSets) {
    Namespace namespace = namespaceService.findOne(appId, clusterName, namespaceName);
    if (namespace == null) {
        throw NotFoundException.namespaceNotFound(appId, clusterName, namespaceName);
    }

    Release release = releaseService.mergeBranchChangeSetsAndRelease(namespace, branchName, releaseName,
                                                                     releaseComment, isEmergencyPublish, changeSets);

    if (deleteBranch) {
        namespaceBranchService.deleteBranch(appId, clusterName, namespaceName, branchName,
                                            NamespaceBranchStatus.MERGED, changeSets.getDataChangeLastModifiedBy());
    }

    messageSender.sendMessage(ReleaseMessageKeyGenerator.generate(appId, clusterName, namespaceName),
                              Topics.APOLLO_RELEASE_TOPIC);

    return BeanUtils.transform(ReleaseDTO.class, release);

}
```

* 调用 `NamespaceService#findOne(ppId, clusterName, namespaceName)` 方法，获得父 Namespace 对象。若校验到不存在，抛出 NotFoundException 异常。
* 调用 `ReleaseService#mergeBranchChangeSetsAndRelease(...)` 方法，合并子 Namespace 变更的配置 Map 到父 Namespace ，并进行一次 Release 。
* 若需要删除子 Namespace ，即 Portal 中选择【删除灰度版本】，调用 `NamespaceBranchService#deleteBranch(...)` 方法，删除子 Namespace 相关的记录。
* 调用 `MessageSender#sendMessage(String message, String channel)` 方法，发送发布消息。
* 调用 `BeanUtils#transfrom(Class<T> clazz, Object src)` 方法，将 Release 转换成 ReleaseDTO 对象。

### ReleaseService

在 `apollo-biz` 项目中，`com.ctrip.framework.apollo.biz.service.ReleaseService` ，提供 Release 的 Service 逻辑给 Admin Service 和 Config Service 。

#### mergeBranchChangeSetsAndRelease

`ReleaseService#mergeBranchChangeSetsAndRelease(...)` 方法，合并子 Namespace 变更的配置 Map 到父 Namespace ，并进行一次 Release 。代码如下：

```java
@Transactional
  public Release mergeBranchChangeSetsAndRelease(Namespace namespace, String branchName, String releaseName,
                                                 String releaseComment, boolean isEmergencyPublish,
                                                 ItemChangeSets changeSets) {

    checkLock(namespace, isEmergencyPublish, changeSets.getDataChangeLastModifiedBy());

    itemSetService.updateSet(namespace, changeSets);

    Release branchRelease = findLatestActiveRelease(namespace.getAppId(), branchName, namespace
        .getNamespaceName());
    long branchReleaseId = branchRelease == null ? 0 : branchRelease.getId();

    Map<String, String> operateNamespaceItems = getNamespaceItems(namespace);

    Map<String, Object> operationContext = Maps.newLinkedHashMap();
    operationContext.put(ReleaseOperationContext.SOURCE_BRANCH, branchName);
    operationContext.put(ReleaseOperationContext.BASE_RELEASE_ID, branchReleaseId);
    operationContext.put(ReleaseOperationContext.IS_EMERGENCY_PUBLISH, isEmergencyPublish);

    return masterRelease(namespace, releaseName, releaseComment, operateNamespaceItems,
                         changeSets.getDataChangeLastModifiedBy(),
                         ReleaseOperation.GRAY_RELEASE_MERGE_TO_MASTER, operationContext);

}
```

* 调用 `#checkLock(...)` 方法，校验锁定。
* 调用 `ItemService#updateSet(namespace, changeSets)` 方法，将变更的配置集 合 ItemChangeSets 对象，更新到父 Namespace 中。
* 调用 `#getNamespaceItems(namespace)` 方法，获得父 Namespace 的配置 Map 。因为上面已经更新过，所以获得到的是合并后的结果。
* 创建 Map ，并设置需要的 KV ，用于 ReleaseHistory 对象的 operationContext 属性。
* 调用 `#masterRelease(...)` 方法，父 Namespace 进行发布。

### NamespaceBranchService

在 `apollo-biz` 项目中，`com.ctrip.framework.apollo.biz.service.NamespaceBranchService` ，提供 Namespace 分支的 Service 逻辑给 Admin Service 和 Config Service 。

#### deleteBranch

`#deleteBranch(...)` 方法，删除子 Namespace 相关的记录。代码如下：

```java
@Transactional
public void deleteBranch(String appId, String clusterName, String namespaceName,
                           String branchName, int branchStatus, String operator) {
    Cluster toDeleteCluster = clusterService.findOne(appId, branchName);
    if (toDeleteCluster == null) {
        return;
    }

    Release latestBranchRelease = releaseService.findLatestActiveRelease(appId, branchName, namespaceName);

    long latestBranchReleaseId = latestBranchRelease != null ? latestBranchRelease.getId() : 0;

    //update branch rules
    GrayReleaseRule deleteRule = new GrayReleaseRule();
    deleteRule.setRules("[]");
    deleteRule.setAppId(appId);
    deleteRule.setClusterName(clusterName);
    deleteRule.setNamespaceName(namespaceName);
    deleteRule.setBranchName(branchName);
    deleteRule.setBranchStatus(branchStatus);
    deleteRule.setDataChangeLastModifiedBy(operator);
    deleteRule.setDataChangeCreatedBy(operator);

    doUpdateBranchGrayRules(appId, clusterName, namespaceName, branchName, deleteRule, false, -1);

    //delete branch cluster
    clusterService.delete(toDeleteCluster.getId(), operator);

    int releaseOperation = branchStatus == NamespaceBranchStatus.MERGED ? ReleaseOperation
        .GRAY_RELEASE_DELETED_AFTER_MERGE : ReleaseOperation.ABANDON_GRAY_RELEASE;

    releaseHistoryService.createReleaseHistory(appId, clusterName, namespaceName, branchName, latestBranchReleaseId,
        latestBranchReleaseId, releaseOperation, null, operator);

    auditService.audit("Branch", toDeleteCluster.getId(), Audit.OP.DELETE, operator);
}
```

* 调用 `ClusterService#findOne(appId, branchName)` 方法，获得子 Cluster 对象。
* 调用 `ReleaseService#findLatestActiveRelease(namespace)` 方法，获得最后、有效的 Release 对象。
* 创建新的，用于表示删除的 GrayReleaseRule 的对象。并且，当前场景，该 GrayReleaseRule 的 branchStatus 为 MERGED 。调用 `#doUpdateBranchGrayRules(...)` 方法，更新 GrayReleaseRule 。
* 调用 `ClusterService#delte(id, operator)` 方法，删除子 Cluster 相关。
* 调用 `ReleaseHistoryService#createReleaseHistory(...)` 方法，创建 ReleaseHistory 对象，并保存。
* 记录 Audit 到数据库中。

### ClusterService

在 `apollo-biz` 项目中，`com.ctrip.framework.apollo.biz.service.ClusterService` ，提供 Cluster 的 Service 逻辑给 Admin Service 和 Config Service 。

#### delete

`#delete(...)` 方法，删除 Cluster 相关。代码如下：

```java
@Transactional
  public void delete(long id, String operator) {
    Cluster cluster = clusterRepository.findById(id).orElse(null);
    if (cluster == null) {
        throw BadRequestException.clusterNotExists("");
    }

    //delete linked namespaces
    namespaceService.deleteByAppIdAndClusterName(cluster.getAppId(), cluster.getName(), operator);

    cluster.setDeleted(true);
    cluster.setDataChangeLastModifiedBy(operator);
    clusterRepository.save(cluster);

    auditService.audit(Cluster.class.getSimpleName(), id, Audit.OP.DELETE, operator);
}
```

* 标记删除 Cluster 和其相关的 Namespace 。