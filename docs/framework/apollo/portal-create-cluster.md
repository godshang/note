# Apollo源码分析——创建Cluster

## Portal

### ClusterController

`apollo-portal`模块`com.ctrip.framework.apollo.portal.controller.ClusterController`，`createCluster`方法是创建Cluster的入口。

```java
@PreAuthorize(value = "@permissionValidator.hasCreateClusterPermission(#appId)")
@PostMapping(value = "apps/{appId}/envs/{env}/clusters")
public ClusterDTO createCluster(@PathVariable String appId, @PathVariable String env,
                                @Valid @RequestBody ClusterDTO cluster) {
    String operator = userInfoHolder.getUser().getUserId();
    cluster.setDataChangeLastModifiedBy(operator);
    cluster.setDataChangeCreatedBy(operator);

    return clusterService.createCluster(Env.valueOf(env), cluster);
}
```

1. 从`userInfoHolder`中获取用户名设置到`cluster`对象中
2. 调用`clusterService.createCluster`方法创建cluster，核心逻辑在`clusterService`中

### ClusterService

`com.ctrip.framework.apollo.portal.service.ClusterService`的`createCluster`方法完成Cluster的创建

```java
public ClusterDTO createCluster(Env env, ClusterDTO cluster) {
    if (!clusterAPI.isClusterUnique(cluster.getAppId(), env, cluster.getName())) {
      throw BadRequestException.clusterAlreadyExists(cluster.getName());
    }
    ClusterDTO clusterDTO = clusterAPI.create(env, cluster);

    Tracer.logEvent(TracerEventType.CREATE_CLUSTER, cluster.getAppId(), "0", cluster.getName());

    return clusterDTO;
}
```

1. 调用`clusterAPI.isClusterUnique`根据`appId`和`name`判断是否唯一，不唯一抛出异常
2. 调用`clusterAPI.create`完成Cluster创建
3. 返回创建结果

### AdminServiceAPI

`com.ctrip.framework.apollo.portal.api.AdminServiceAPI`的静态内部类`ClusterAPI`继承了`API`，提供Cluster相关的API方法

```java
@Service
public static class ClusterAPI extends API {

    public List<ClusterDTO> findClustersByApp(String appId, Env env) {
      ClusterDTO[] clusterDTOs = restTemplate.get(env, "apps/{appId}/clusters", ClusterDTO[].class,
          appId);
      return Arrays.asList(clusterDTOs);
    }

    public ClusterDTO loadCluster(String appId, Env env, String clusterName) {
      return restTemplate.get(env, "apps/{appId}/clusters/{clusterName}", ClusterDTO.class,
          appId, clusterName);
    }

    public boolean isClusterUnique(String appId, Env env, String clusterName) {
      return restTemplate
          .get(env, "apps/{appId}/cluster/{clusterName}/unique", Boolean.class,
              appId, clusterName);

    }

    public ClusterDTO create(Env env, ClusterDTO cluster) {
      return restTemplate.post(env, "apps/{appId}/clusters", cluster, ClusterDTO.class,
          cluster.getAppId());
    }


    public void delete(Env env, String appId, String clusterName, String operator) {
      restTemplate.delete(env, "apps/{appId}/clusters/{clusterName}?operator={operator}", appId, clusterName, operator);
    }
}
```

`isClusterUnique`方法和`create`方法都是HTTP调用，请求到了`AdminService`中的接口。

## AdminService

### ClusterController

`apollo-adminservice`模块`com.ctrip.framework.apollo.adminservice.controller.ClusterController`，`create`方法提供了创建Cluster的入口。

```java
@PostMapping("/apps/{appId}/clusters")
public ClusterDTO create(@PathVariable("appId") String appId,
                         @RequestParam(value = "autoCreatePrivateNamespace", defaultValue = "true") boolean autoCreatePrivateNamespace,
                         @Valid @RequestBody ClusterDTO dto) {
    Cluster entity = BeanUtils.transform(Cluster.class, dto);
    Cluster managedEntity = clusterService.findOne(appId, entity.getName());
    if (managedEntity != null) {
        throw BadRequestException.clusterAlreadyExists(entity.getName());
    }

    if (autoCreatePrivateNamespace) {
        entity = clusterService.saveWithInstanceOfAppNamespaces(entity);
    } else {
        entity = clusterService.saveWithoutInstanceOfAppNamespaces(entity);
    }

    return BeanUtils.transform(ClusterDTO.class, entity);
}
```

1. 调用`BeanUtils.transform`方法将`ClusterDTO`对象转换为`Cluster`对象
2. 调用`clusterService.findOne`方法，使用`appId`和`cluster name`查询是否已存在集群，若已存在则抛出异常
3. 如果参数`autoCreatePrivateNamespace`是`true`，调用`clusterService.saveWithInstanceOfAppNamespaces`方法，否则调用`clusterService.saveWithoutInstanceOfAppNamespaces`，二者都返回`Cluster`类的对象`entity`
4. 最后将`entity`转换为`ClusterDTO`对象返回

### ClusterService

`com.ctrip.framework.apollo.biz.service.ClusterService`

`saveWithInstanceOfAppNamespaces`方法实现创建Cluster及Namespace，内部先调用`saveWithoutInstanceOfAppNamespaces`方法创建Cluster，再调用`namespaceService.instanceOfAppNamespaces`方法创建Namespace

```java
@Transactional
public Cluster saveWithInstanceOfAppNamespaces(Cluster entity) {

    Cluster savedCluster = saveWithoutInstanceOfAppNamespaces(entity);

    namespaceService.instanceOfAppNamespaces(savedCluster.getAppId(), savedCluster.getName(),
                                             savedCluster.getDataChangeCreatedBy());

    return savedCluster;
}
```

`saveWithoutInstanceOfAppNamespaces`完成Cluster的创建，代码如下：

```java
@Transactional
public Cluster saveWithoutInstanceOfAppNamespaces(Cluster entity) {
    if (!isClusterNameUnique(entity.getAppId(), entity.getName())) {
      throw new BadRequestException("cluster not unique");
    }
    entity.setId(0);//protection
    Cluster cluster = clusterRepository.save(entity);

    auditService.audit(Cluster.class.getSimpleName(), cluster.getId(), Audit.OP.INSERT,
                       cluster.getDataChangeCreatedBy());

    return cluster;
}
```

1. 判断`appId`和`name`的唯一性，不唯一抛出异常
2. 调用`clusterRepository.save`方法创建Cluster
3. 记录审计日志

### ClusterRepository

`com.ctrip.framework.apollo.biz.repository.ClusterRepository`继承了`org.springframework.data.repository.PagingAndSortingRepository`，提供数据访问能力，代码如下：

```java
public interface ClusterRepository extends PagingAndSortingRepository<Cluster, Long> {

    List<Cluster> findByAppIdAndParentClusterId(String appId, Long parentClusterId);

    List<Cluster> findByAppId(String appId);

    Cluster findByAppIdAndName(String appId, String name);

    List<Cluster> findByParentClusterId(Long parentClusterId);
}
```