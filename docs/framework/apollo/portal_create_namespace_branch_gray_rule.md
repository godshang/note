# Apollo 源码解析 —— Portal 配置灰度规则

## 概述

* 对于一个子 Namespace 仅对应一条有效灰度规则 GrayReleaseRule 记录。每次变更灰度规则时，标记删除老的灰度规则，新增保存新的灰度规则。
* 变更灰度配置完成后，会发布一条 ReleaseMessage 消息，以通知配置变更。

## GrayReleaseRule

在 `apollo-common` 项目中，`com.ctrip.framework.apollo.common.entity.GrayReleaseRule` ，继承 BaseEntity 抽象类

```java
@Entity
@Table(name = "`GrayReleaseRule`")
@SQLDelete(sql = "Update GrayReleaseRule set IsDeleted = true, DeletedAt = ROUND(UNIX_TIMESTAMP(NOW(4))*1000) where Id = ?")
@Where(clause = "`IsDeleted` = false")
public class GrayReleaseRule extends BaseEntity{

    @Column(name = "`AppId`", nullable = false)
    private String appId;

    @Column(name = "`ClusterName`", nullable = false)
    private String clusterName;

    @Column(name = "`NamespaceName`", nullable = false)
    private String namespaceName;

    @Column(name = "`BranchName`", nullable = false)
    private String branchName;

    @Column(name = "`Rules`")
    private String rules;

    @Column(name = "`ReleaseId`", nullable = false)
    private Long releaseId;

    @Column(name = "`BranchStatus`", nullable = false)
    private int branchStatus;
}
```

* `appId` + `clusterName` + `namespaceName` + `branchName` 四个字段，指向对应的子 Namespace 对象。
* `rules` 字段，规则数组，目前将 GrayReleaseRuleItemDTO 数组，JSON 格式化进行存储
* `releaseId` 字段，Release 编号。目前有两种情况：
    1. 当灰度已经发布，则指向对应的最新的 Release 对象的编号。
    2. 当灰度还未发布，等于 0 。等到灰度发布后，更新为对应的 Release 对象的编号。
* `branchStatus` 字段，Namespace 分支状态。在 `com.ctrip.framework.apollo.common.constants.NamespaceBranchStatus` 中，枚举如下：
```java
public interface NamespaceBranchStatus {

  int DELETED = 0;

  int ACTIVE = 1;

  int MERGED = 2;

}
```

## Portal

### NamespaceBranchController

在 `apollo-porta`l 项目中，`com.ctrip.framework.apollo.portal.controller.NamespaceBranchController` ，提供 Namespace 分支的 API 。

`#updateBranchRules(...)` 方法， 更新 Namespace 分支的灰度规则。代码如下：

```java
@PreAuthorize(value = "@permissionValidator.hasOperateNamespacePermission(#appId, #namespaceName, #env)")
@PutMapping(value = "/apps/{appId}/envs/{env}/clusters/{clusterName}/namespaces/{namespaceName}/branches/{branchName}/rules")
public void updateBranchRules(@PathVariable String appId, @PathVariable String env,
                                @PathVariable String clusterName, @PathVariable String namespaceName,
                                @PathVariable String branchName, @RequestBody GrayReleaseRuleDTO rules) {

    namespaceBranchService
        .updateBranchGrayRules(appId, Env.valueOf(env), clusterName, namespaceName, branchName, rules);

}
```

调用 `NamespaceBranchService#updateBranchGrayRules(...)` 方法，更新 Namespace 分支的灰度规则。

### NamespaceBranchService

在 `apollo-portal` 项目中，`com.ctrip.framework.apollo.portal.service.NamespaceBranchService` ，提供 Namespace 分支的 Service 逻辑。

```java
public void updateBranchGrayRules(String appId, Env env, String clusterName, String namespaceName,
                                    String branchName, GrayReleaseRuleDTO rules) {

    String operator = userInfoHolder.getUser().getUserId();
    updateBranchGrayRules(appId, env, clusterName, namespaceName, branchName, rules, operator);
}

public void updateBranchGrayRules(String appId, Env env, String clusterName, String namespaceName,
                                    String branchName, GrayReleaseRuleDTO rules, String operator) {
    rules.setDataChangeCreatedBy(operator);
    rules.setDataChangeLastModifiedBy(operator);

    namespaceBranchAPI.updateBranchGrayRules(appId, env, clusterName, namespaceName, branchName, rules);

    Tracer.logEvent(TracerEventType.UPDATE_GRAY_RELEASE_RULE,
            String.format("%s+%s+%s+%s", appId, env, clusterName, namespaceName));
}
```

调用 `NamespaceBranchAPI#updateBranchGrayRules(...)` 方法，更新 Namespace 分支的灰度规则。

### NamespaceBranchAPI

`com.ctrip.framework.apollo.portal.api.NamespaceBranchAPI` ，实现 API 抽象类，封装对 Admin Service 的 Namespace 分支模块的 API 调用。代码如下：

```java
public void updateBranchGrayRules(String appId, Env env, String clusterName,
        String namespaceName, String branchName, GrayReleaseRuleDTO rules) {
    restTemplate
          .put(env, "/apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}/branches/{branchName}/rules",
              rules, appId, clusterName, namespaceName, branchName);

}
```

## Admin Service

### NamespaceBranchController

在 `apollo-adminservice` 项目中， `com.ctrip.framework.apollo.adminservice.controller.NamespaceBranchController` ，提供 Namespace 分支的 API 。

```java
@Transactional
@PutMapping("/apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}/branches/{branchName}/rules")
public void updateBranchGrayRules(@PathVariable String appId, @PathVariable String clusterName,
                                    @PathVariable String namespaceName, @PathVariable String branchName,
                                    @RequestBody GrayReleaseRuleDTO newRuleDto) {

    checkBranch(appId, clusterName, namespaceName, branchName);

    GrayReleaseRule newRules = BeanUtils.transform(GrayReleaseRule.class, newRuleDto);
    newRules.setRules(GrayReleaseRuleItemTransformer.batchTransformToJSON(newRuleDto.getRuleItems()));
    newRules.setBranchStatus(NamespaceBranchStatus.ACTIVE);

    namespaceBranchService.updateBranchGrayRules(appId, clusterName, namespaceName, branchName, newRules);

    messageSender.sendMessage(ReleaseMessageKeyGenerator.generate(appId, clusterName, namespaceName),
                              Topics.APOLLO_RELEASE_TOPIC);
}
```

- 调用 `#checkBranch(appId, clusterName, namespaceName, branchName)` ，校验子 Namespace 是否存在。
- 调用 `BeanUtils#transfrom(Class<T> clazz, Object src)` 方法，将 GrayReleaseRuleDTO 转换成 GrayReleaseRule 对象。
- 调用 `GrayReleaseRuleItemTransformer#batchTransformToJSON(et<GrayReleaseRuleItemDTO> ruleItems) `方法，JSON 化规则为字符串，并设置到 GrayReleaseRule 对象中。
- 设置 GrayReleaseRule 对象的 branchStatus 为 ACTIVE 。
- 调用 `NamespaceBranchService#updateBranchGrayRules(appId, clusterName, namespaceName, branchName, newRules)` 方法，更新子 Namespace 的灰度发布规则。
- 调用 `MessageSender#sendMessage(message, channel)` 方法，发送 Release 消息，从而通知客户端更新配置。

### NamespaceBranchService

在` apollo-biz` 项目中，`com.ctrip.framework.apollo.biz.service.NamespaceBranchService` ，提供 Namespace 分支的 Service 逻辑给 Admin Service 和 Config Service 。

`#updateBranchGrayRules(appId, clusterName, namespaceName, branchName, newRules)` 方法，更新子 Namespace 的灰度发布规则。

```java
 @Transactional
public void updateBranchGrayRules(String appId, String clusterName, String namespaceName,
                                    String branchName, GrayReleaseRule newRules) {
    doUpdateBranchGrayRules(appId, clusterName, namespaceName, branchName, newRules, true, ReleaseOperation.APPLY_GRAY_RULES);
}

private void doUpdateBranchGrayRules(String appId, String clusterName, String namespaceName,
                                              String branchName, GrayReleaseRule newRules, boolean recordReleaseHistory, int releaseOperation) {
    GrayReleaseRule oldRules = grayReleaseRuleRepository
        .findTopByAppIdAndClusterNameAndNamespaceNameAndBranchNameOrderByIdDesc(appId, clusterName, namespaceName, branchName);

    Release latestBranchRelease = releaseService.findLatestActiveRelease(appId, branchName, namespaceName);

    long latestBranchReleaseId = latestBranchRelease != null ? latestBranchRelease.getId() : 0;

    newRules.setReleaseId(latestBranchReleaseId);

    grayReleaseRuleRepository.save(newRules);

    //delete old rules
    if (oldRules != null) {
        grayReleaseRuleRepository.delete(oldRules);
    }

    if (recordReleaseHistory) {
        Map<String, Object> releaseOperationContext = Maps.newHashMap();
        releaseOperationContext.put(ReleaseOperationContext.RULES, GrayReleaseRuleItemTransformer
            .batchTransformFromJSON(newRules.getRules()));
        if (oldRules != null) {
            releaseOperationContext.put(ReleaseOperationContext.OLD_RULES,
                GrayReleaseRuleItemTransformer.batchTransformFromJSON(oldRules.getRules()));
        }
        releaseHistoryService.createReleaseHistory(appId, clusterName, namespaceName, branchName, latestBranchReleaseId,
            latestBranchReleaseId, releaseOperation, releaseOperationContext, newRules.getDataChangeLastModifiedBy());
    }
}
```

- 调用 `GrayReleaseRuleRepository#findTopByAppIdAndClusterNameAndNamespaceNameAndBranchNameOrderByIdDesc(appId, clusterName, namespaceName, branchName)` 方法，获得子 Namespace 的灰度发布规则。
- Release Id 相关：
    - 调用 `ReleaseService#findLatestActiveRelease(appId, branchName, namespaceName)` 方法，获得最新的，并且有效的，子 Namespace 的 Release 对象。
    - 获得最新的子 Namespace 的 Release 对象的编号。若不存在，则设置为 0 。
    - 设置 GrayReleaseRule 的 releaseId 属性。
- 调用 `GrayReleaseRuleRepository#save(GrayReleaseRule)` 方法，保存新的 GrayReleaseRule 对象。
- 删除老的 GrayReleaseRule 对象。
- 若需要，调用 `ReleaseHistoryService#createReleaseHistory(...)` 方法，创建 ReleaseHistory 对象，并保存。其中，ReleaseHistory.operation 属性，为 APPLY_GRAY_RULES 。

### GrayReleaseRuleRepository

`com.ctrip.framework.apollo.biz.repository.GrayReleaseRuleRepository` ，继承 `org.springframework.data.repository.PagingAndSortingRepository` 接口，提供 GrayReleaseRule 的数据访问 给 Admin Service 和 Config Service 。代码如下：

```java
public interface GrayReleaseRuleRepository extends PagingAndSortingRepository<GrayReleaseRule, Long> {

    GrayReleaseRule findTopByAppIdAndClusterNameAndNamespaceNameAndBranchNameOrderByIdDesc(String appId, String clusterName, String namespaceName, String branchName);

    List<GrayReleaseRule> findByAppIdAndClusterNameAndNamespaceName(String appId, String clusterName, String namespaceName);

    List<GrayReleaseRule> findFirst500ByIdGreaterThanOrderByIdAsc(Long id);

}
```