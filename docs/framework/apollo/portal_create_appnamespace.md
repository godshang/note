# Apollo源码分析——创建Namespace

## AppNamespace vs Namespace

1. 创建App时会创建默认的AppNamespace（即`application`）、默认的Cluster（即`default`），并基于默认Cluster、默认AppNamespace创建Namespace
2. 创建Cluster后会为App下每个AppNamespace创建Namespace
3. 创建AppNamespace后为App下每个Cluster创建Namespace

## Portal

### NamespaceController

`apollo-portal`模块`com.ctrip.framework.apollo.portal.controller.NamespaceController`，`createAppNamespace`提供了创建AppNamespace的入口

```java
@PreAuthorize(value = "@permissionValidator.hasCreateAppNamespacePermission(#appId, #appNamespace)")
@PostMapping("/apps/{appId}/appnamespaces")
public AppNamespace createAppNamespace(@PathVariable String appId,
      @RequestParam(defaultValue = "true") boolean appendNamespacePrefix,
      @Valid @RequestBody AppNamespace appNamespace) {
    if (!InputValidator.isValidAppNamespace(appNamespace.getName())) {
      throw BadRequestException.invalidNamespaceFormat(InputValidator.INVALID_CLUSTER_NAMESPACE_MESSAGE + " & "
          + InputValidator.INVALID_NAMESPACE_NAMESPACE_MESSAGE);
    }

    AppNamespace createdAppNamespace = appNamespaceService.createAppNamespaceInLocal(appNamespace, appendNamespacePrefix);

    if (portalConfig.canAppAdminCreatePrivateNamespace() || createdAppNamespace.isPublic()) {
      namespaceService.assignNamespaceRoleToOperator(appId, appNamespace.getName(),
          userInfoHolder.getUser().getUserId());
    }

    publisher.publishEvent(new AppNamespaceCreationEvent(createdAppNamespace));

    return createdAppNamespace;
}
```

1. 调用`InputValidator.isValidAppNamespace`对`name`的格式进行校验
2. 调用`appNamespaceService.createAppNamespaceInLocal`创建AppNamespace，保存到PortalDB数据库
3. 调用`namespaceService.assignNamespaceRoleToOperator`授予Namespace Role，默认会把修改和发布的权限授予给AppNamespace创建者
4. 发送`AppNamespaceCreationEvent`时间

### AppNamespaceService

`com.ctrip.framework.apollo.portal.service.AppNamespaceService`的`createAppNamespaceInLocal`方法实现创建AppNamespace

```java
@Transactional
public AppNamespace createAppNamespaceInLocal(AppNamespace appNamespace, boolean appendNamespacePrefix) {
    String appId = appNamespace.getAppId();

    //add app org id as prefix
    App app = appService.load(appId);
    if (app == null) {
      throw BadRequestException.appNotExists(appId);
    }

    StringBuilder appNamespaceName = new StringBuilder();
    //add prefix postfix
    appNamespaceName
        .append(appNamespace.isPublic() && appendNamespacePrefix ? app.getOrgId() + "." : "")
        .append(appNamespace.getName())
        .append(appNamespace.formatAsEnum() == ConfigFileFormat.Properties ? "" : "." + appNamespace.getFormat());
    appNamespace.setName(appNamespaceName.toString());

    if (appNamespace.getComment() == null) {
      appNamespace.setComment("");
    }

    if (!ConfigFileFormat.isValidFormat(appNamespace.getFormat())) {
     throw BadRequestException.invalidNamespaceFormat("format must be properties、json、yaml、yml、xml");
    }

    String operator = appNamespace.getDataChangeCreatedBy();
    if (StringUtils.isEmpty(operator)) {
      operator = userInfoHolder.getUser().getUserId();
      appNamespace.setDataChangeCreatedBy(operator);
    }

    appNamespace.setDataChangeLastModifiedBy(operator);

    // globally uniqueness check for public app namespace
    if (appNamespace.isPublic()) {
      checkAppNamespaceGlobalUniqueness(appNamespace);
    } else {
      // check private app namespace
      if (appNamespaceRepository.findByAppIdAndName(appNamespace.getAppId(), appNamespace.getName()) != null) {
        throw new BadRequestException("Private AppNamespace " + appNamespace.getName() + " already exists!");
      }
      // should not have the same with public app namespace
      checkPublicAppNamespaceGlobalUniqueness(appNamespace);
    }

    AppNamespace createdAppNamespace = appNamespaceRepository.save(appNamespace);

    roleInitializationService.initNamespaceRoles(appNamespace.getAppId(), appNamespace.getName(), operator);
    roleInitializationService.initNamespaceEnvRoles(appNamespace.getAppId(), appNamespace.getName(), operator);

    return createdAppNamespace;
}
```

1. 校验`appId`对应的App是否存在
2. 设置AppNamespace的`name`属性，如果是`pulib`类型且`appendNamespacePrefix`是`true`的情况会增加一个前缀，如果是非`Properties`类型会增加类型的后缀
3. 如果`comment`是`null`则设置为空字符串
4. 校验`format`格式
5. 设置`dataChangeCreatedBy`和`dataChangeLastModifiedBy`
6. 校验AppNamespace唯一性，如果是`public`类型调用`checkAppNamespaceGlobalUniqueness`检查全局的唯一性，否则调用`appNamespaceRepository.findByAppIdAndName`根据`appId`和`name`检查唯一性，并调用`checkPublicAppNamespaceGlobalUniqueness`检查`public`类型中也不存在同名AppNamespace

    `checkPublicAppNamespaceGlobalUniqueness`方法校验`name`在`public`类型中的唯一性

    ```java
    private void checkPublicAppNamespaceGlobalUniqueness(AppNamespace appNamespace) {
        AppNamespace publicAppNamespace = findPublicAppNamespace(appNamespace.getName());
        if (publicAppNamespace != null) {
        throw new BadRequestException("AppNamespace " + appNamespace.getName() + " already exists as public namespace in appId: " + publicAppNamespace.getAppId() + "!");
        }
    }
    ```

    `checkAppNamespaceGlobalUniqueness`方法是在全局范围内检查`name`的唯一性，先是复用`checkPublicAppNamespaceGlobalUniqueness`方法检查`public`类型，再调用`findAllPrivateAppNamespaces`查找`private`类型

    ```java
    private void checkAppNamespaceGlobalUniqueness(AppNamespace appNamespace) {
        checkPublicAppNamespaceGlobalUniqueness(appNamespace);

        List<AppNamespace> privateAppNamespaces = findAllPrivateAppNamespaces(appNamespace.getName());

        if (!CollectionUtils.isEmpty(privateAppNamespaces)) {
            Set<String> appIds = Sets.newHashSet();
            for (AppNamespace ans : privateAppNamespaces) {
                appIds.add(ans.getAppId());
                if (appIds.size() == PRIVATE_APP_NAMESPACE_NOTIFICATION_COUNT) {
                break;
                }
            }

            throw new BadRequestException(
                "Public AppNamespace " + appNamespace.getName() + " already exists as private AppNamespace in appId: "
                    + APP_NAMESPACE_JOINER.join(appIds) + ", etc. Please select another name!");
        }
    }
    ```

    > 这里的校验有点绕，看上去都是检查了`public`和`private`类型中的唯一性，但实际上还是不一样，在else的分支里，仅仅检查了改`appId`下的`private`类型，其他`appId`下的`private`类型并没有检查

7. 调用`appNamespaceRepository.save`创建AppNamespace
8. 初始化AppNamespace的角色

### AppNamespaceRepository

`com.ctrip.framework.apollo.portal.repository.AppNamespaceRepository`继承了`org.springframework.data.repository.PagingAndSortingRepository`，实现了数据访问功能

```java
public interface AppNamespaceRepository extends PagingAndSortingRepository<AppNamespace, Long> {

  AppNamespace findByAppIdAndName(String appId, String namespaceName);

  AppNamespace findByName(String namespaceName);

  List<AppNamespace> findByNameAndIsPublic(String namespaceName, boolean isPublic);

  List<AppNamespace> findByIsPublicTrue();

  List<AppNamespace> findByAppId(String appId);

  @Modifying
  @Query("UPDATE AppNamespace SET IsDeleted = true, DeletedAt = ROUND(UNIX_TIMESTAMP(NOW(4))*1000), DataChange_LastModifiedBy=?2 WHERE AppId=?1 and IsDeleted = false")
  int batchDeleteByAppId(String appId, String operator);

  @Modifying
  @Query("UPDATE AppNamespace SET IsDeleted = true, DeletedAt = ROUND(UNIX_TIMESTAMP(NOW(4))*1000), DataChange_LastModifiedBy = ?3 WHERE AppId=?1 and Name = ?2 and IsDeleted = false")
  int delete(String appId, String namespaceName, String operator);
}
```

### AppNamespaceCreationEvent

`com.ctrip.framework.apollo.portal.listener.AppNamespaceCreationEvent`表示AppNamespace创建事件，继承自`org.springframework.context.ApplicationEvent`

```java
public class AppNamespaceCreationEvent extends ApplicationEvent {

  public AppNamespaceCreationEvent(Object source) {
    super(source);
  }

  public AppNamespace getAppNamespace() {
    Preconditions.checkState(source != null);
    return (AppNamespace) this.source;
  }
}
```

### CreationListener

`com.ctrip.framework.apollo.portal.listener.AppNamespaceCreationEvent`事件的消费逻辑在`com.ctrip.framework.apollo.portal.listener.CreationListener`中，代码如下

```java
@EventListener
public void onAppNamespaceCreationEvent(AppNamespaceCreationEvent event) {
    AppNamespaceDTO appNamespace = BeanUtils.transform(AppNamespaceDTO.class, event.getAppNamespace());
    List<Env> envs = portalSettings.getActiveEnvs();
    for (Env env : envs) {
      try {
        namespaceAPI.createAppNamespace(env, appNamespace);
      } catch (Throwable e) {
        LOGGER.error("Create appNamespace failed. appId = {}, env = {}", appNamespace.getAppId(), env, e);
        Tracer.logError(String.format("Create appNamespace failed. appId = %s, env = %s", appNamespace.getAppId(), env), e);
      }
    }
}
```

对每个环境循环调用`namespaceAPI.createAppNamespace`方法创建AppNamespace。

`NamespaceAPI`是`com.ctrip.framework.apollo.portal.api.AdminServiceAPI`的一个静态内部类，提供AppNamespace相关的API

```java
public AppNamespaceDTO createAppNamespace(Env env, AppNamespaceDTO appNamespace) {
    return restTemplate
        .post(env, "apps/{appId}/appnamespaces", appNamespace, AppNamespaceDTO.class, appNamespace.getAppId());
}
```

## AdminService

### AppNamespaceController

`apollo-adminservice`模块`com.ctrip.framework.apollo.adminservice.controller.AppNamespaceController`，`apps/{appId}/appnamespaces`接口实现在`create`方法

```java
@PostMapping("/apps/{appId}/appnamespaces")
public AppNamespaceDTO create(@RequestBody AppNamespaceDTO appNamespace,
                                @RequestParam(defaultValue = "false") boolean silentCreation) {

    AppNamespace entity = BeanUtils.transform(AppNamespace.class, appNamespace);
    AppNamespace managedEntity = appNamespaceService.findOne(entity.getAppId(), entity.getName());

    if (managedEntity == null) {
      if (StringUtils.isEmpty(entity.getFormat())){
        entity.setFormat(ConfigFileFormat.Properties.getValue());
      }

      entity = appNamespaceService.createAppNamespace(entity);
    } else if (silentCreation) {
      appNamespaceService.createNamespaceForAppNamespaceInAllCluster(appNamespace.getAppId(), appNamespace.getName(),
          appNamespace.getDataChangeCreatedBy());

      entity = managedEntity;
    } else {
      throw BadRequestException.appNamespaceAlreadyExists(entity.getAppId(), entity.getName());
    }

    return BeanUtils.transform(AppNamespaceDTO.class, entity);
}
```

1. 调用`BeanUtils.transform`方法将`AppNamespaceDTO`对象转换为`AppNamespace`对象
2. 根据`appId`和`name`查询AppNamespace
    
    * 如果未查找到，调用`appNamespaceService.createAppNamespace`创建AppNamespace
    * 如果已存在AppNamespace且`silentCreation`参数为`true`，那么调用`appNamespaceService.createNamespaceForAppNamespaceInAllCluster`为所有Cluster创建Namespace
    * 否则抛出异常

### AppNamespaceService

`com.ctrip.framework.apollo.biz.service.AppNamespaceService`，`createAppNamespace`实现了创建AppNamespace的功能

```java
@Transactional
public AppNamespace createAppNamespace(AppNamespace appNamespace) {
    String createBy = appNamespace.getDataChangeCreatedBy();
    if (!isAppNamespaceNameUnique(appNamespace.getAppId(), appNamespace.getName())) {
      throw new ServiceException("appnamespace not unique");
    }
    appNamespace.setId(0);//protection
    appNamespace.setDataChangeCreatedBy(createBy);
    appNamespace.setDataChangeLastModifiedBy(createBy);

    appNamespace = appNamespaceRepository.save(appNamespace);

    createNamespaceForAppNamespaceInAllCluster(appNamespace.getAppId(), appNamespace.getName(), createBy);

    auditService.audit(AppNamespace.class.getSimpleName(), appNamespace.getId(), Audit.OP.INSERT, createBy);
    return appNamespace;
}
```

1. 判断`appId`和`name`的唯一性
2. 调用`appNamespaceRepository.save`创建Cluster
3. 调用`createNamespaceForAppNamespaceInAllCluster`为`appId`下的所有Cluster创建Namespace
4. 记录审计日志

`createNamespaceForAppNamespaceInAllCluster`代码如下

```java
public void createNamespaceForAppNamespaceInAllCluster(String appId, String namespaceName, String createBy) {
    List<Cluster> clusters = clusterService.findParentClusters(appId);

    for (Cluster cluster : clusters) {

      // in case there is some dirty data, e.g. public namespace deleted in other app and now created in this app
      if (!namespaceService.isNamespaceUnique(appId, cluster.getName(), namespaceName)) {
        continue;
      }

      Namespace namespace = new Namespace();
      namespace.setClusterName(cluster.getName());
      namespace.setAppId(appId);
      namespace.setNamespaceName(namespaceName);
      namespace.setDataChangeCreatedBy(createBy);
      namespace.setDataChangeLastModifiedBy(createBy);

      namespaceService.save(namespace);
    }
}
```

1. 查询`appId`下的所有Cluster
2. 循环Cluster列表，构建Namespace对象，并调用`namespaceService.save`创建Namespace

### NamespaceService

`com.ctrip.framework.apollo.biz.service.NamespaceService`，`save`方法实现创建Namespace功能

```java
@Transactional
  public Namespace save(Namespace entity) {
    if (!isNamespaceUnique(entity.getAppId(), entity.getClusterName(), entity.getNamespaceName())) {
      throw new ServiceException("namespace not unique");
    }
    entity.setId(0);//protection
    Namespace namespace = namespaceRepository.save(entity);

    auditService.audit(Namespace.class.getSimpleName(), namespace.getId(), Audit.OP.INSERT,
                       namespace.getDataChangeCreatedBy());

    return namespace;
}
```

1. 调用`isNamespaceUnique`检查`appId`、`clusterName`、`namespaceName`是否存在，若已存在抛出异常

    ```java
    public boolean isNamespaceUnique(String appId, String cluster, String namespace) {
        Objects.requireNonNull(appId, "AppId must not be null");
        Objects.requireNonNull(cluster, "Cluster must not be null");
        Objects.requireNonNull(namespace, "Namespace must not be null");
        return Objects.isNull(
            namespaceRepository.findByAppIdAndClusterNameAndNamespaceName(appId, cluster, namespace));
    }
    ```

2. 调用`namespaceRepository.save`创建Namespace
3. 记录审计日志

### NamespaceRepository

`com.ctrip.framework.apollo.biz.repository.NamespaceRepository`继承自`org.springframework.data.repository.PagingAndSortingRepository`，提供数据访问能力

```java
public interface NamespaceRepository extends PagingAndSortingRepository<Namespace, Long> {

  List<Namespace> findByAppIdAndClusterNameOrderByIdAsc(String appId, String clusterName);

  Namespace findByAppIdAndClusterNameAndNamespaceName(String appId, String clusterName, String namespaceName);

  @Modifying
  @Query("update Namespace set IsDeleted = true, DeletedAt = ROUND(UNIX_TIMESTAMP(NOW(4))*1000), DataChange_LastModifiedBy = ?3 where AppId=?1 and ClusterName=?2 and IsDeleted = false")
  int batchDelete(String appId, String clusterName, String operator);

  List<Namespace> findByAppIdAndNamespaceNameOrderByIdAsc(String appId, String namespaceName);

  List<Namespace> findByNamespaceName(String namespaceName, Pageable page);

  List<Namespace> findByIdIn(Set<Long> namespaceIds);

  int countByNamespaceNameAndAppIdNot(String namespaceName, String appId);

}
```

