# Apollo Portal源码分析——关联Namespace

## Portal

### NamespaceController

`apollo-portal`模块`com.ctrip.framework.apollo.portal.controller.NamespaceController`

关联Namespace的入口是`/apps/{appId}/namespaces`，支持创建多个Namespace

```java
@PreAuthorize(value = "@permissionValidator.hasCreateNamespacePermission(#appId)")
@PostMapping("/apps/{appId}/namespaces")
public ResponseEntity<Void> createNamespace(@PathVariable String appId,
                                              @RequestBody List<NamespaceCreationModel> models) {

    checkModel(!CollectionUtils.isEmpty(models));
    String operator = userInfoHolder.getUser().getUserId();

    for (NamespaceCreationModel model : models) {
      String namespaceName = model.getNamespace().getNamespaceName();
      roleInitializationService.initNamespaceRoles(appId, namespaceName, operator);
      roleInitializationService.initNamespaceEnvRoles(appId, namespaceName, operator);
      NamespaceDTO namespace = model.getNamespace();
      RequestPrecondition.checkArgumentsNotEmpty(model.getEnv(), namespace.getAppId(),
                                                 namespace.getClusterName(), namespace.getNamespaceName());

      try {
        namespaceService.createNamespace(Env.valueOf(model.getEnv()), namespace);
      } catch (Exception e) {
        logger.error("create namespace fail.", e);
        Tracer.logError(
                String.format("create namespace fail. (env=%s namespace=%s)", model.getEnv(),
                        namespace.getNamespaceName()), e);
      }
      namespaceService.assignNamespaceRoleToOperator(appId, namespaceName,userInfoHolder.getUser().getUserId());
}
```

1. 循环`models`列表，创建Namespace
2. 调用`initNamespaceRoles`和`initNamespaceEnvRoles`为初始化角色
3. 调用`RequestPrecondition.checkArgumentsNotEmpty`校验参数
4. 调用`namespaceService.createNamespace`创建Namespace
5. 调用`namespaceService.assignNamespaceRoleToOperator`为管理员授予角色

### NamespaceService

`com.ctrip.framework.apollo.portal.service.NamespaceService`，`createNamespace`实现创建Namespace功能

```java
public NamespaceDTO createNamespace(Env env, NamespaceDTO namespace) {
    if (StringUtils.isEmpty(namespace.getDataChangeCreatedBy())) {
      namespace.setDataChangeCreatedBy(userInfoHolder.getUser().getUserId());
    }

    if (StringUtils.isEmpty(namespace.getDataChangeLastModifiedBy())) {
      namespace.setDataChangeLastModifiedBy(userInfoHolder.getUser().getUserId());
    }
    NamespaceDTO createdNamespace = namespaceAPI.createNamespace(env, namespace);

    Tracer.logEvent(TracerEventType.CREATE_NAMESPACE,
        String.format("%s+%s+%s+%s", namespace.getAppId(), env, namespace.getClusterName(),
            namespace.getNamespaceName()));
    return createdNamespace;
}
```

内部调用`namespaceAPI.createNamespace`接口，实际上是HTTP请求到`AdminService`接口上

```java
public NamespaceDTO createNamespace(Env env, NamespaceDTO namespace) {
    return restTemplate
        .post(env, "apps/{appId}/clusters/{clusterName}/namespaces", namespace, NamespaceDTO.class,
            namespace.getAppId(), namespace.getClusterName());
}
```

## AdminService

### NamespaceController

`apollo-adminservice`模块`com.ctrip.framework.apollo.adminservice.controller.NamespaceController`，`apps/{appId}/clusters/{clusterName}/namespaces`接口实现在`NamespaceController.create()`方法

```java
@PostMapping("/apps/{appId}/clusters/{clusterName}/namespaces")
public NamespaceDTO create(@PathVariable("appId") String appId,
                             @PathVariable("clusterName") String clusterName,
                             @Valid @RequestBody NamespaceDTO dto) {
    Namespace entity = BeanUtils.transform(Namespace.class, dto);
    Namespace managedEntity = namespaceService.findOne(appId, clusterName, entity.getNamespaceName());
    if (managedEntity != null) {
      throw BadRequestException.namespaceAlreadyExists(entity.getNamespaceName());
    }

    entity = namespaceService.save(entity);

    return BeanUtils.transform(NamespaceDTO.class, entity);
}
```

主要过程是将`NamespaceDTO`对象转换为`Namespace`对象，检查`appId`、`clusterName`、`namespaceName`唯一性，最后创建Namespace。

`namespaceService.save`在前文已经分析过，不再赘述。