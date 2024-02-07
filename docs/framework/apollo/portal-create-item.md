# Apollo源码分析——创建Item

每一个Item代表了一个配置项

## Portal

### ItemController

创建Item的入口是`/apps/{appId}/envs/{env}/clusters/{clusterName}/namespaces/{namespaceName}/item`，位于`apollo-portal`模块`com.ctrip.framework.apollo.portal.controller.ItemController`

```java
@PreAuthorize(value = "@permissionValidator.hasModifyNamespacePermission(#appId, #namespaceName, #env)")
@PostMapping("/apps/{appId}/envs/{env}/clusters/{clusterName}/namespaces/{namespaceName}/item")
public ItemDTO createItem(@PathVariable String appId, @PathVariable String env,
                            @PathVariable String clusterName, @PathVariable String namespaceName,
                            @RequestBody ItemDTO item) {
    checkModel(isValidItem(item));

    //protect
    item.setLineNum(0);
    item.setId(0);
    String userId = userInfoHolder.getUser().getUserId();
    item.setDataChangeCreatedBy(userId);
    item.setDataChangeLastModifiedBy(userId);
    item.setDataChangeCreatedTime(null);
    item.setDataChangeLastModifiedTime(null);

    return configService.createItem(appId, Env.valueOf(env), clusterName, namespaceName, item);
}
```

校验`item`并设置属性后，调用`createItem`创建Item

### ItemService

`com.ctrip.framework.apollo.portal.service.ItemService`，`createItem`方法实现了创建Item

```java
public ItemDTO createItem(String appId, Env env, String clusterName, String namespaceName, ItemDTO item) {
    NamespaceDTO namespace = namespaceAPI.loadNamespace(appId, env, clusterName, namespaceName);
    if (namespace == null) {
      throw BadRequestException.namespaceNotExists(appId, clusterName, namespaceName);
    }
    item.setNamespaceId(namespace.getId());

    ItemDTO itemDTO = itemAPI.createItem(appId, env, clusterName, namespaceName, item);
    Tracer.logEvent(TracerEventType.MODIFY_NAMESPACE, String.format("%s+%s+%s+%s", appId, env, clusterName, namespaceName));
    return itemDTO;
}
```

1. 调用`namespaceAPI.loadNamespace`接口，根据`appId`、`env`、`clusterName`、`namespaceName`查询Namespace，如果Namespace不存在抛出异常
2. 为`item`设置`namespaceId`
3. 调用`itemAPI.createItem`创建Item

### NamepsaceAPI

`NamespaceAPI`是`com.ctrip.framework.apollo.portal.api.AdminServiceAPI`的一个静态内部类

`loadNamespace`请求到了`apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}`接口

```java
public NamespaceDTO loadNamespace(String appId, Env env, String clusterName,
        String namespaceName) {
    return
        restTemplate.get(env, "apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}",
            NamespaceDTO.class, appId, clusterName, namespaceName);
}
```

就是使用`appId`、`clusterName`、`namespaceName`查询了一下Namespace，逻辑比较简单

### ItemAPI

`ItemAPI`是`com.ctrip.framework.apollo.portal.api.AdminServiceAPI`的一个静态内部类

`createItem`请求到了`apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}/items`接口

```java
public ItemDTO createItem(String appId, Env env, String clusterName, String namespace, ItemDTO item) {
    return restTemplate.post(env, "apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}/items",
          item, ItemDTO.class, appId, clusterName, namespace);
}
```

## AdminService

### ItemController

`apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}/items`接口实现在`apollo-adminservice`模块的`com.ctrip.framework.apollo.adminservice.controller.ItemController`的`create`方法

```java
@PreAcquireNamespaceLock
  @PostMapping("/apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}/items")
  public ItemDTO create(@PathVariable("appId") String appId,
                        @PathVariable("clusterName") String clusterName,
                        @PathVariable("namespaceName") String namespaceName, @RequestBody ItemDTO dto) {
    Item entity = BeanUtils.transform(Item.class, dto);

    Item managedEntity = itemService.findOne(appId, clusterName, namespaceName, entity.getKey());
    if (managedEntity != null) {
      throw BadRequestException.itemAlreadyExists(entity.getKey());
    }
    entity = itemService.save(entity);
    dto = BeanUtils.transform(ItemDTO.class, entity);
    commitService.createCommit(appId, clusterName, namespaceName, new ConfigChangeContentBuilder().createItem(entity).build(),
        dto.getDataChangeLastModifiedBy()
    );

    return dto;
}
```

1. 先将`ItemDTO`类型的对象转换为`Item`类型的对象
2. 根据`appId`、`clusterName`、`namespaceName`、`key`查询Item，如果已存在则抛出异常
3. 转换为`ItemDTO`类型对象，留到最后返回
4. 调用`commitService.createCommit`创建一个Commit

### ItemService

`com.ctrip.framework.apollo.biz.service.ItemService`的`save`方式实现了创建Item的功能

```java
@Transactional
  public Item save(Item entity) {
    checkItemKeyLength(entity.getKey());
    checkItemType(entity.getType());
    checkItemValueLength(entity.getNamespaceId(), entity.getValue());

    entity.setId(0);//protection

    if (entity.getLineNum() == 0) {
      Item lastItem = findLastOne(entity.getNamespaceId());
      int lineNum = lastItem == null ? 1 : lastItem.getLineNum() + 1;
      entity.setLineNum(lineNum);
    }

    Item item = itemRepository.save(entity);

    auditService.audit(Item.class.getSimpleName(), item.getId(), Audit.OP.INSERT,
                       item.getDataChangeCreatedBy());

    return item;
}
```

1. `checkItemKeyLength`检查`key`的长度，默认长度128，可以通过参数`item.key.length.limit`设置
2. `checkItemType`校验Item类型，合法值是是闭区间`[0, 3]`，`type`表示配置项类型，0: String，1: Number，2: Boolean，3: JSON
3. `checkItemValueLength`校验`value`的长度，这里的逻辑稍显复杂

    ```java
    private boolean checkItemValueLength(long namespaceId, String value) {
        int limit = getItemValueLengthLimit(namespaceId);
        Namespace currentNamespace = namespaceService.findOne(namespaceId);
        if(currentNamespace != null) {
            Matcher m = clusterPattern.matcher(currentNamespace.getClusterName());
            boolean isGray = m.matches();
            if (isGray) {
                limit = getGrayNamespaceItemValueLengthLimit(currentNamespace, limit);
            }
        }
        if (!StringUtils.isEmpty(value) && value.length() > limit) {
            throw new BadRequestException("value too long. length limit:" + limit);
        }
        return true;
    }
    ```

    * `getItemValueLengthLimit`方法获取`limit`限制

    ```java
    private int getItemValueLengthLimit(long namespaceId) {
        Map<Long, Integer> namespaceValueLengthOverride = bizConfig.namespaceValueLengthLimitOverride();
        if (namespaceValueLengthOverride != null && namespaceValueLengthOverride.containsKey(namespaceId)) {
            return namespaceValueLengthOverride.get(namespaceId);
        }
        return bizConfig.itemValueLengthLimit();
    }
    ```

    配置项`namespace.value.length.limit.override`可以为每个Nameapce配置其中`value`的最长长度，`namespaceValueLengthOverride`就是一个KV结构，key是`namespaceId`，value是长度限制。
    
    如果没有单独配置的话，返回的就是全局的长度限制，默认值是20000，可以通过参数`item.value.length.limit`设置

    * 根据`namespaceId`查询Namespace，如果Namespace的`name`符合正则`[0-9]{14}-[a-zA-Z0-9]{16}`，则认为是一个灰度发布中的Namespace，会调用`getGrayNamespaceItemValueLengthLimit`方法获取灰度Namespace的父Namespace的长度限制，并返回父Namespace和灰度Namespace二者中较大的长度限制

    ```java
    private int getGrayNamespaceItemValueLengthLimit(Namespace grayNamespace, int grayNamespaceLimit) {
        Namespace parentNamespace = namespaceService.findParentNamespace(grayNamespace);
        if (parentNamespace != null) {
            int parentLimit = getItemValueLengthLimit(parentNamespace.getId());
            if (parentLimit > grayNamespaceLimit) {
                return parentLimit;
            }
        }
        return grayNamespaceLimit;
    }
    ```

    * 根据最终计算出的`limit`，判断`value`长度是否超过限制，若超过则抛出异常

4. 设置`lineNum`，先调用`findLastOne`方法获取Namespace下最大行号，若有则加1并设置，否则设置为1
5. 调用`itemRepository.save`创建Item
6. 记录审计日志

### ItemRepository

`com.ctrip.framework.apollo.biz.repository.ItemRepository`继承`org.springframework.data.repository.PagingAndSortingRepository`，提供了Item的数据访问能力

```java
public interface ItemRepository extends PagingAndSortingRepository<Item, Long> {

  Item findByNamespaceIdAndKey(Long namespaceId, String key);

  List<Item> findByNamespaceIdOrderByLineNumAsc(Long namespaceId);

  List<Item> findByNamespaceId(Long namespaceId);

  List<Item> findByNamespaceIdAndDataChangeLastModifiedTimeGreaterThan(Long namespaceId, Date date);

  Page<Item> findByKey(String key, Pageable pageable);

  Page<Item> findByNamespaceId(Long namespaceId, Pageable pageable);
  
  Item findFirst1ByNamespaceIdOrderByLineNumDesc(Long namespaceId);

  @Modifying
  @Query("update Item set IsDeleted = true, DeletedAt = ROUND(UNIX_TIMESTAMP(NOW(4))*1000), DataChange_LastModifiedBy = ?2 where NamespaceId = ?1 and IsDeleted = false")
  int deleteByNamespaceId(long namespaceId, String operator);

}
```

### CommitService

`com.ctrip.framework.apollo.biz.service.CommitService`的`createCommit`方法创建了一个Commit

```java
public void createCommit(String appId, String clusterName, String namespaceName, String configChangeContent,
      String operator) {

    Commit commit = new Commit();
    commit.setId(0);//protection
    commit.setAppId(appId);
    commit.setClusterName(clusterName);
    commit.setNamespaceName(namespaceName);
    commit.setChangeSets(configChangeContent);
    commit.setDataChangeCreatedBy(operator);
    commit.setDataChangeLastModifiedBy(operator);
    commitRepository.save(commit);
}
```

### CommitRepository

`com.ctrip.framework.apollo.biz.repository.CommitRepository`继承`org.springframework.data.repository.PagingAndSortingRepository`，提供了Commit的数据访问能力

```java
public interface CommitRepository extends PagingAndSortingRepository<Commit, Long> {

  List<Commit> findByAppIdAndClusterNameAndNamespaceNameOrderByIdDesc(String appId, String clusterName,
                                                                      String namespaceName, Pageable pageable);

  List<Commit> findByAppIdAndClusterNameAndNamespaceNameAndDataChangeLastModifiedTimeGreaterThanEqualOrderByIdDesc(
      String appId, String clusterName, String namespaceName, Date dataChangeLastModifiedTime, Pageable pageable);

  @Modifying
  @Query("update Commit set IsDeleted = true, DeletedAt = ROUND(UNIX_TIMESTAMP(NOW(4))*1000), DataChange_LastModifiedBy = ?4 where AppId=?1 and ClusterName=?2 and NamespaceName = ?3 and IsDeleted = false")
  int batchDelete(String appId, String clusterName, String namespaceName, String operator);

  List<Commit> findByAppIdAndClusterNameAndNamespaceNameAndChangeSetsLikeOrderByIdDesc(String appId, String clusterName, String namespaceName,String changeSets, Pageable page);
}
```