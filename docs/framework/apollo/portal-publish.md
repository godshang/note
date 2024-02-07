# Apollo源码分析——发布配置

## Portal

### ReleaseController

发布页面点击发布按钮，进行配置的发布，操作入口在`apollo-portal`模块`com.ctrip.framework.apollo.portal.controller.ReleaseController`的`createRelease`方法

```java
@PreAuthorize(value = "@permissionValidator.hasReleaseNamespacePermission(#appId, #namespaceName, #env)")
@PostMapping(value = "/apps/{appId}/envs/{env}/clusters/{clusterName}/namespaces/{namespaceName}/releases")
public ReleaseDTO createRelease(@PathVariable String appId,
                                  @PathVariable String env, @PathVariable String clusterName,
                                  @PathVariable String namespaceName, @RequestBody NamespaceReleaseModel model) {
    model.setAppId(appId);
    model.setEnv(env);
    model.setClusterName(clusterName);
    model.setNamespaceName(namespaceName);

    if (model.isEmergencyPublish() && !portalConfig.isEmergencyPublishAllowed(Env.valueOf(env))) {
        throw new BadRequestException("Env: %s is not supported emergency publish now", env);
    }

    ReleaseDTO createdRelease = releaseService.publish(model);

    ConfigPublishEvent event = ConfigPublishEvent.instance();
    event.withAppId(appId)
        .withCluster(clusterName)
        .withNamespace(namespaceName)
        .withReleaseId(createdRelease.getId())
        .setNormalPublishEvent(true)
        .setEnv(Env.valueOf(env));

    publisher.publishEvent(event);

    return createdRelease;
}
```

1. 如果是紧急发布，但环境被配置为不允许紧急发布，则抛出异常。`emergencyPublish.supported.envs`参数用于配置支持紧急发布的环境，默认是个空数组，即所有环境均不允许紧急发布
2. 调用`releaseService.publish`创建Release
3. 构造`ConfigPublishEvent`事件并发布

### ReleaseService

`com.ctrip.framework.apollo.portal.service.ReleaseService`的`publish`方法调用`releaseAPI`发布配置

```java
public ReleaseDTO publish(NamespaceReleaseModel model) {
    Env env = model.getEnv();
    boolean isEmergencyPublish = model.isEmergencyPublish();
    String appId = model.getAppId();
    String clusterName = model.getClusterName();
    String namespaceName = model.getNamespaceName();
    String releaseBy = StringUtils.isEmpty(model.getReleasedBy()) ?
                       userInfoHolder.getUser().getUserId() : model.getReleasedBy();

    ReleaseDTO releaseDTO = releaseAPI.createRelease(appId, env, clusterName, namespaceName,
                                                     model.getReleaseTitle(), model.getReleaseComment(),
                                                     releaseBy, isEmergencyPublish);

    Tracer.logEvent(TracerEventType.RELEASE_NAMESPACE,
                    String.format("%s+%s+%s+%s", appId, env, clusterName, namespaceName));

    return releaseDTO;
}
```

### ReleaseAPI

`ReleaseAPI`是`com.ctrip.framework.apollo.portal.api.AdminServiceAPI`静态内部类，封装了对Release的操作接口，`createRelease`方法实现创建Release功能

```java
public ReleaseDTO createRelease(String appId, Env env, String clusterName, String namespace,
        String releaseName, String releaseComment, String operator,
        boolean isEmergencyPublish) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.parseMediaType(MediaType.APPLICATION_FORM_URLENCODED_VALUE + ";charset=UTF-8"));
    MultiValueMap<String, String> parameters = new LinkedMultiValueMap<>();
    parameters.add("name", releaseName);
    parameters.add("comment", releaseComment);
    parameters.add("operator", operator);
    parameters.add("isEmergencyPublish", String.valueOf(isEmergencyPublish));
    HttpEntity<MultiValueMap<String, String>> entity =
        new HttpEntity<>(parameters, headers);
    ReleaseDTO response = restTemplate.post(
        env, "apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}/releases", entity,
        ReleaseDTO.class, appId, clusterName, namespace);
    return response;
}
```

## AdminService

### ReleaseController

`apollo-adminservice`模块，`com.ctrip.framework.apollo.adminservice.controller.ReleaseController`提供Release的API

`publish`方法实现发布一个Release的功能

```java
@Transactional
@PostMapping("/apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}/releases")
public ReleaseDTO publish(@PathVariable("appId") String appId,
                            @PathVariable("clusterName") String clusterName,
                            @PathVariable("namespaceName") String namespaceName,
                            @RequestParam("name") String releaseName,
                            @RequestParam(name = "comment", required = false) String releaseComment,
                            @RequestParam("operator") String operator,
                            @RequestParam(name = "isEmergencyPublish", defaultValue = "false") boolean isEmergencyPublish) {
    Namespace namespace = namespaceService.findOne(appId, clusterName, namespaceName);
    if (namespace == null) {
        throw NotFoundException.namespaceNotFound(appId, clusterName, namespaceName);
    }
    Release release = releaseService.publish(namespace, releaseName, releaseComment, operator, isEmergencyPublish);

    //send release message
    Namespace parentNamespace = namespaceService.findParentNamespace(namespace);
    String messageCluster;
    if (parentNamespace != null) {
        messageCluster = parentNamespace.getClusterName();
    } else {
        messageCluster = clusterName;
    }
    messageSender.sendMessage(ReleaseMessageKeyGenerator.generate(appId, messageCluster, namespaceName),
                              Topics.APOLLO_RELEASE_TOPIC);
    return BeanUtils.transform(ReleaseDTO.class, release);
}
```

1. 调用`namespaceService.findOne`方法根据`appId`、`clusterName`、`namespaceName`查询Namespace，如果不存在则抛出异常
2. 调用`releaseService.publish`创建Release
3. 调用`messageSender.sendMessage`发送Release消息

### ReleaseService

`apollo-biz`模块中的`com.ctrip.framework.apollo.biz.service.ReleaseService`提供了Release相关的操作。

`publish`方法实现了创建Release的功能，代码如下：

```java
@Transactional
public Release publish(Namespace namespace, String releaseName, String releaseComment,
                         String operator, boolean isEmergencyPublish) {

    checkLock(namespace, isEmergencyPublish, operator);

    Map<String, String> operateNamespaceItems = getNamespaceItems(namespace);

    Namespace parentNamespace = namespaceService.findParentNamespace(namespace);

    //branch release
    if (parentNamespace != null) {
      return publishBranchNamespace(parentNamespace, namespace, operateNamespaceItems,
                                    releaseName, releaseComment, operator, isEmergencyPublish);
    }

    Namespace childNamespace = namespaceService.findChildNamespace(namespace);

    Release previousRelease = null;
    if (childNamespace != null) {
      previousRelease = findLatestActiveRelease(namespace);
    }

    //master release
    Map<String, Object> operationContext = Maps.newLinkedHashMap();
    operationContext.put(ReleaseOperationContext.IS_EMERGENCY_PUBLISH, isEmergencyPublish);

    Release release = masterRelease(namespace, releaseName, releaseComment, operateNamespaceItems,
                                    operator, ReleaseOperation.NORMAL_RELEASE, operationContext);

    //merge to branch and auto release
    if (childNamespace != null) {
      mergeFromMasterAndPublishBranch(namespace, childNamespace, operateNamespaceItems,
                                      releaseName, releaseComment, operator, previousRelease,
                                      release, isEmergencyPublish);
    }

    return release;
  }
```

1. 调用`checkLock`方法校验锁的持有情况
2. 调用`getNamespaceItems`方法查询Namespace下所有的Item集合，并构造成Map结构返回，Map的key是配置项的key，value是配置项的value
3. 调用`namespaceService.findParentNamespace`方法查询父Namespace`parentNamespace`
4. 如果`parentNamespace`不为空，表示是针对分支创建Release，进入`publishBranchNamespace`方法

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

    * 调用`findLatestActiveRelease`方法查询`parentNamespace`的最近一次发布
    * 从`parentLatestRelease`的`configurations`字段构建出Map结构`parentConfigurations`，`configurations`字段存储了创建Release时的配置项快照
    * 计算`baseReleaseId`，如果`parentLatestRelease`为空则从0开始，否则使用`parentLatestRelease`的id
    * 调用`mergeConfiguration`方法，将`parentConfigurations`和`childNamespaceItems`进行合并产生`configsToPublish`，此处的含义是如果主干的配置项发生了变化，应该也反映到分支上

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
    * 如果存在`grayDelKeys`，则从`configsToPublish`中移除对应配置项（TODO)
    * 调用`branchRelease`创建分支Release

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
        * 调用`findLatestActiveRelease`查找分支的前一个Release记录`previousRelease`
        * 计算`previousReleaseId`，如果`previousRelease`为空则从0开始，否则使用`previousRelease`的id
        * 将`baseReleaseId`、`isEmergencyPublish`、`branchReleaseKeys`参数组织到一个Map结构`releaseOperationContext`中
        * 调用`createRelease`方法创建Release

            ```java
            private Release createRelease(Namespace namespace, String name, String comment,
                                Map<String, String> configurations, String operator) {
                Release release = new Release();
                release.setReleaseKey(ReleaseKeyGenerator.generateReleaseKey(namespace));
                release.setDataChangeCreatedTime(new Date());
                release.setDataChangeCreatedBy(operator);
                release.setDataChangeLastModifiedBy(operator);
                release.setName(name);
                release.setComment(comment);
                release.setAppId(namespace.getAppId());
                release.setClusterName(namespace.getClusterName());
                release.setNamespaceName(namespace.getNamespaceName());
                release.setConfigurations(GSON.toJson(configurations));
                release = releaseRepository.save(release);

                namespaceLockService.unlock(namespace.getId());
                auditService.audit(Release.class.getSimpleName(), release.getId(), Audit.OP.INSERT,
                                release.getDataChangeCreatedBy());

                return release;
            }
            ```
        * 调用`namespaceBranchService.updateRulesReleaseId`更新灰度发布规则，采用的是新建后删除旧数据的方式

            ```java
            @Transactional
            public GrayReleaseRule updateRulesReleaseId(String appId, String clusterName,
                                            String namespaceName, String branchName,
                                            long latestReleaseId, String operator) {
                GrayReleaseRule oldRules = grayReleaseRuleRepository.
                    findTopByAppIdAndClusterNameAndNamespaceNameAndBranchNameOrderByIdDesc(appId, clusterName, namespaceName, branchName);

                if (oldRules == null) {
                    return null;
                }

                GrayReleaseRule newRules = new GrayReleaseRule();
                newRules.setBranchStatus(NamespaceBranchStatus.ACTIVE);
                newRules.setReleaseId(latestReleaseId);
                newRules.setRules(oldRules.getRules());
                newRules.setAppId(oldRules.getAppId());
                newRules.setClusterName(oldRules.getClusterName());
                newRules.setNamespaceName(oldRules.getNamespaceName());
                newRules.setBranchName(oldRules.getBranchName());
                newRules.setDataChangeCreatedBy(operator);
                newRules.setDataChangeLastModifiedBy(operator);

                grayReleaseRuleRepository.save(newRules);

                grayReleaseRuleRepository.delete(oldRules);

                return newRules;
            }
            ```
        
        * 调用`releaseHistoryService.createReleaseHistory`创建ReleaseHistory，ReleaseHistory代表发布记录，前面提到收集参数的Map结构`releaseOperationContext`，最终会被序列化为JSON，写入到ReleaseHistory的`operationContext`字段

            ```java
            @Transactional
            public ReleaseHistory createReleaseHistory(String appId, String clusterName, String
                namespaceName, String branchName, long releaseId, long previousReleaseId, int operation,
                                                        Map<String, Object> operationContext, String operator) {
                ReleaseHistory releaseHistory = new ReleaseHistory();
                releaseHistory.setAppId(appId);
                releaseHistory.setClusterName(clusterName);
                releaseHistory.setNamespaceName(namespaceName);
                releaseHistory.setBranchName(branchName);
                releaseHistory.setReleaseId(releaseId);
                releaseHistory.setPreviousReleaseId(previousReleaseId);
                releaseHistory.setOperation(operation);
                if (operationContext == null) {
                    releaseHistory.setOperationContext("{}"); //default empty object
                } else {
                    releaseHistory.setOperationContext(GSON.toJson(operationContext));
                }
                releaseHistory.setDataChangeCreatedTime(new Date());
                releaseHistory.setDataChangeCreatedBy(operator);
                releaseHistory.setDataChangeLastModifiedBy(operator);

                releaseHistoryRepository.save(releaseHistory);

                auditService.audit(ReleaseHistory.class.getSimpleName(), releaseHistory.getId(),
                                Audit.OP.INSERT, releaseHistory.getDataChangeCreatedBy());

                int releaseHistoryRetentionLimit = this.getReleaseHistoryRetentionLimit(releaseHistory);
                if (releaseHistoryRetentionLimit != DEFAULT_RELEASE_HISTORY_RETENTION_SIZE) {
                    if (!releaseClearQueue.offer(releaseHistory)) {
                        logger.warn("releaseClearQueue is full, failed to add task to clean queue, " +
                            "clean queue max size:{}", CLEAN_QUEUE_MAX_SIZE);
                    }
                }
                return releaseHistory;
            }
            ```

            * 参数`apollo.release-history.retention.size.override`可以设置是否清除ReleaseHistory，如果用户设置了这个值，那么会加入到`releaseClearQueue`队列中，由后台线程进行清理（TODO）

5. 回到`publish`方法，如果`parentNamespace`为空，说明是针对主干创建Release，继续下面流程
6. 调用`namespaceService.findChildNamespace`查询子命名空间`childNamespace`（TODO）
7. 调用`masterRelease`方法创建主干Release，`findLatestActiveRelease`、`createRelease`、`createReleaseHistory`方法前文已经分析过了

    ```java
    private Release masterRelease(Namespace namespace, String releaseName, String releaseComment,
                                Map<String, String> configurations, String operator,
                                int releaseOperation, Map<String, Object> operationContext) {
        Release lastActiveRelease = findLatestActiveRelease(namespace);
        long previousReleaseId = lastActiveRelease == null ? 0 : lastActiveRelease.getId();
        Release release = createRelease(namespace, releaseName, releaseComment,
                                        configurations, operator);

        releaseHistoryService.createReleaseHistory(namespace.getAppId(), namespace.getClusterName(),
                                                namespace.getNamespaceName(), namespace.getClusterName(),
                                                release.getId(), previousReleaseId, releaseOperation,
                                                operationContext, operator);

        return release;
    }
    ```

8. 如果有子Namespace，调用`mergeFromMasterAndPublishBranch`方法将主干配置合并到分支配置中，并进行一次子Namespace的发布

    ```java
    private void mergeFromMasterAndPublishBranch(Namespace parentNamespace, Namespace childNamespace,
                                                Map<String, String> parentNamespaceItems,
                                                String releaseName, String releaseComment,
                                                String operator, Release masterPreviousRelease,
                                                Release parentRelease, boolean isEmergencyPublish) {
        //create release for child namespace
        Release childNamespaceLatestActiveRelease = findLatestActiveRelease(childNamespace);

        Map<String, String> childReleaseConfiguration;
        Collection<String> branchReleaseKeys;
        if (childNamespaceLatestActiveRelease != null) {
            childReleaseConfiguration = GSON.fromJson(childNamespaceLatestActiveRelease.getConfigurations(), GsonType.CONFIG);
            branchReleaseKeys = getBranchReleaseKeys(childNamespaceLatestActiveRelease.getId());
        } else {
            childReleaseConfiguration = Collections.emptyMap();
            branchReleaseKeys = null;
        }

        Map<String, String> parentNamespaceOldConfiguration = masterPreviousRelease == null ?
                                                            null : GSON.fromJson(masterPreviousRelease.getConfigurations(),
                                                                                GsonType.CONFIG);

        Map<String, String> childNamespaceToPublishConfigs =
            calculateChildNamespaceToPublishConfiguration(parentNamespaceOldConfiguration, parentNamespaceItems,
                childReleaseConfiguration, branchReleaseKeys);

        //compare
        if (!childNamespaceToPublishConfigs.equals(childReleaseConfiguration)) {
            branchRelease(parentNamespace, childNamespace, releaseName, releaseComment,
                        childNamespaceToPublishConfigs, parentRelease.getId(), operator,
                        ReleaseOperation.MASTER_NORMAL_RELEASE_MERGE_TO_GRAY, isEmergencyPublish, branchReleaseKeys);
        }

    }
    ```
    
    * 查询子命名空间`childNamespace`的最近一次Release
    * 从`childNamespaceLatestActiveRelease`中解析出分支上一次发布的配置项快照`childReleaseConfiguration`
    * 调用`getBranchReleaseKeys`从发布历史中查找`branchReleaseKeys`
    * 从`masterPreviousRelease`中解析出主干上一次发布的配置项快照`parentNamespaceOldConfiguration`
    * 调用`calculateChildNamespaceToPublishConfiguration`计算子命名空间待发布的配置项（TODO）
    * 最后调用`branchRelease`进行分支发布

### ReleaseRepository

`com.ctrip.framework.apollo.biz.repository.ReleaseRepository`继承`org.springframework.data.repository.PagingAndSortingRepository`，提供Release数据操作能力

```java
public interface ReleaseRepository extends PagingAndSortingRepository<Release, Long> {

    Release findFirstByAppIdAndClusterNameAndNamespaceNameAndIsAbandonedFalseOrderByIdDesc(@Param("appId") String appId, @Param("clusterName") String clusterName,
                                                                                            @Param("namespaceName") String namespaceName);

    Release findByIdAndIsAbandonedFalse(long id);

    List<Release> findByAppIdAndClusterNameAndNamespaceNameOrderByIdDesc(String appId, String clusterName, String namespaceName, Pageable page);

    List<Release> findByAppIdAndClusterNameAndNamespaceNameAndIsAbandonedFalseOrderByIdDesc(String appId, String clusterName, String namespaceName, Pageable page);

    List<Release> findByAppIdAndClusterNameAndNamespaceNameAndIsAbandonedFalseAndIdBetweenOrderByIdDesc(String appId, String clusterName, String namespaceName, long fromId, long toId);

    List<Release> findByReleaseKeyIn(Set<String> releaseKey);

    List<Release> findByIdIn(Set<Long> releaseIds);

    @Modifying
    @Query("update Release set IsDeleted = true, DeletedAt = ROUND(UNIX_TIMESTAMP(NOW(4))*1000), DataChange_LastModifiedBy = ?4 where AppId=?1 and ClusterName=?2 and NamespaceName = ?3 and IsDeleted = false")
    int batchDelete(String appId, String clusterName, String namespaceName, String operator);

    // For release history conversion program, need to delete after conversion it done
    List<Release> findByAppIdAndClusterNameAndNamespaceNameOrderByIdAsc(String appId, String clusterName, String namespaceName);
}
```