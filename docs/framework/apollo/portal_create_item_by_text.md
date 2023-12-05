# Apollo源码分析——文本变更Item

## 概述

批量变更Item指通过文本方式编辑配置。

* 对于`properties`类型的Namespace，会创建多条Item
* 对于非`properties`类型的Namespace，如`yaml`、`yml`、`json`、`xml`等，仅有一条Item记录

## ItemChangeSets

`com.ctrip.framework.apollo.common.dto.ItemChangeSets`表示Item的变更集合，`createItems`表示新建集合，`updateItems`表示更新集合，`deleteItems`表示删除集合。

```java
public class ItemChangeSets extends BaseDTO{

    private List<ItemDTO> createItems = new LinkedList<>();
    private List<ItemDTO> updateItems = new LinkedList<>();
    private List<ItemDTO> deleteItems = new LinkedList<>();

    public void addCreateItem(ItemDTO item) {
        createItems.add(item);
    }

    public void addUpdateItem(ItemDTO item) {
        updateItems.add(item);
    }

    public void addDeleteItem(ItemDTO item) {
        deleteItems.add(item);
    }

    public boolean isEmpty(){
        return createItems.isEmpty() && updateItems.isEmpty() && deleteItems.isEmpty();
    }

    public List<ItemDTO> getCreateItems() {
        return createItems;
    }

    public List<ItemDTO> getUpdateItems() {
        return updateItems;
    }

    public List<ItemDTO> getDeleteItems() {
        return deleteItems;
    }

    public void setCreateItems(List<ItemDTO> createItems) {
        this.createItems = createItems;
    }

    public void setUpdateItems(List<ItemDTO> updateItems) {
        this.updateItems = updateItems;
    }

    public void setDeleteItems(List<ItemDTO> deleteItems) {
        this.deleteItems = deleteItems;
    }

}
```

## ConfigTextResolver

`com.ctrip.framework.apollo.portal.component.txtresolver.ConfigTextResolver`是一个接口，实现从`configText`到`ItemChangeSets`的解析。

```java
public interface ConfigTextResolver {

    ItemChangeSets resolve(long namespaceId, String configText, List<ItemDTO> baseItems);
}
```

`com.ctrip.framework.apollo.portal.component.txtresolver.ConfigTextResolver`接口有两个实现，分别用于解析`properties`类型和非`properties`类型的配置

### FileTextResolver

`com.ctrip.framework.apollo.portal.component.txtresolver.FileTextResolver`用于解析非`properties`类型的配置，这种情况只会产生一个Item

```java
@Component("fileTextResolver")
public class FileTextResolver implements ConfigTextResolver {

    @Override
    public ItemChangeSets resolve(long namespaceId, String configText, List<ItemDTO> baseItems) {
        ItemChangeSets changeSets = new ItemChangeSets();
        if (CollectionUtils.isEmpty(baseItems) && StringUtils.isEmpty(configText)) {
            return changeSets;
        }
        if (CollectionUtils.isEmpty(baseItems)) {
            changeSets.addCreateItem(createItem(namespaceId, 0, configText));
        } else {
            ItemDTO beforeItem = baseItems.get(0);
            if (!configText.equals(beforeItem.getValue())) {//update
                changeSets.addUpdateItem(createItem(namespaceId, beforeItem.getId(), configText));
            }
        }

        return changeSets;
    }

    private ItemDTO createItem(long namespaceId, long itemId, String value) {
        ItemDTO item = new ItemDTO();
        item.setId(itemId);
        item.setNamespaceId(namespaceId);
        item.setValue(value);
        item.setLineNum(1);
        item.setKey(ConfigConsts.CONFIG_FILE_CONTENT_KEY);
        return item;
    }
}
```

1. 创建`ItemChangeSets`对象
2. 如果`baseItems`和`configText`为空，那么不做处理直接返回
3. 如果`baseItems`是空，那么用`configText`构建一个Item，并加入到`createItems`列表中
4. 否则对已有的Item进行更新，用已有Item的id构建一个Item，并加入到`updateItems`列表中

### PropertyResolver

`com.ctrip.framework.apollo.portal.component.txtresolver.PropertyResolver`用于解析`properties`类型的配置

```java
  @Override
  public ItemChangeSets resolve(long namespaceId, String configText, List<ItemDTO> baseItems) {

      Map<Integer, ItemDTO> oldLineNumMapItem = BeanUtils.mapByKey("lineNum", baseItems);
      Map<String, ItemDTO> oldKeyMapItem = BeanUtils.mapByKey("key", baseItems);

      //remove comment and blank item map.
      oldKeyMapItem.remove("");

      String[] newItems = configText.split(ITEM_SEPARATOR);
      Set<String> repeatKeys = new HashSet<>();
      if (isHasRepeatKey(newItems, repeatKeys)) {
          throw new BadRequestException("Config text has repeated keys: %s, please check your input.", repeatKeys);
      }

      ItemChangeSets changeSets = new ItemChangeSets();
      Map<Integer, String> newLineNumMapItem = new HashMap<>();//use for delete blank and comment item
      int lineCounter = 1;
      for (String newItem : newItems) {
          newItem = newItem.trim();
          newLineNumMapItem.put(lineCounter, newItem);
          ItemDTO oldItemByLine = oldLineNumMapItem.get(lineCounter);

          //comment item
          if (isCommentItem(newItem)) {

              handleCommentLine(namespaceId, oldItemByLine, newItem, lineCounter, changeSets);

            //blank item
          } else if (isBlankItem(newItem)) {

              handleBlankLine(namespaceId, oldItemByLine, lineCounter, changeSets);

            //normal item
          } else {
              handleNormalLine(namespaceId, oldKeyMapItem, newItem, lineCounter, changeSets);
          }

          lineCounter++;
      }

      deleteCommentAndBlankItem(oldLineNumMapItem, newLineNumMapItem, changeSets);
      deleteNormalKVItem(oldKeyMapItem, changeSets);

      return changeSets;
  }
```

1. `BeanUtils.mapByKey`方法可以将一组对象按key进行分组，返回一个Map结构，key是指定的属性，value是对象。
    * `oldLineNumMapItem`和`oldKeyMapItem`两个Map对象就分别表示了用`lineNum`和`key`进行分组后的结果
    * `oldKeyMapItem`移除空行
2. 将`configText`切分为String数组`newItems`，分隔符`\n`
3. 调用`isHasRepeatKey`判断`newItems`中是否包含重复的key，若有则抛出异常

    ```java
    private boolean isHasRepeatKey(String[] newItems, @NotNull Set<String> repeatKeys) {
        Set<String> keys = new HashSet<>();
        int lineCounter = 1;
        for (String item : newItems) {
            if (!isCommentItem(item) && !isBlankItem(item)) {
                String[] kv = parseKeyValueFromItem(item);
                if (kv != null) {
                    String key = kv[0].toLowerCase();
                    if(!keys.add(key)){
                        repeatKeys.add(key);
                    }
                } else {
                    throw new BadRequestException("line:" + lineCounter + " key value must separate by '='");
                }
            }
            lineCounter++;
        }
        return !repeatKeys.isEmpty();
    }
    ```

    大致逻辑是基于Set判断是否存在重复key，判断过程中会忽略注释行和空行

4. 创建`ItemChangeSets`对象，并解析配置到ItemChangeSets中
    * 循环`newItems`数组
    * 用行号`lineCounter`从`oldLineNumMapItem`中获取旧配置项`oldItemByLine`。行号`lineCounter`从1开始，每次循环结束加一
    * 使用`isCommentItem`判断新配置文本`newItem`是否是注释
      ```java
      private boolean isCommentItem(String line) {
          return line != null && (line.startsWith("#") || line.startsWith("!"));
      }
      ```

    * 如果是注释，则调用`handleCommentLine`处理注释行
      ```java
      private void handleCommentLine(Long namespaceId, ItemDTO oldItemByLine, String newItem, int lineCounter, ItemChangeSets changeSets) {
          String oldComment = oldItemByLine == null ? "" : oldItemByLine.getComment();
          //create comment. implement update comment by delete old comment and create new comment
          if (!(isCommentItem(oldItemByLine) && newItem.equals(oldComment))) {
              changeSets.addCreateItem(buildCommentItem(0L, namespaceId, newItem, lineCounter));
          }
      }
      ```      
      * 如果老配置项不是注释，或者与新配置不相等，则创建注释Item，并加入到`createItems`中
      * 创建的注释Item，key和value都是空字符串，comment是文本内容
        ```java
        private ItemDTO buildCommentItem(Long id, Long namespaceId, String comment, int lineNum) {
            return buildNormalItem(id, namespaceId, "", "", comment, lineNum);
        }
        ```
    
    * 使用`isBlankItem`判断新配置文本`newItem`是否是空行
      ```java
      private boolean isBlankItem(String line) {
          return  Strings.nullToEmpty(line).trim().isEmpty();
      }
      ```
    * 如果是空行，则调用`handleBlankLine`处理
      ```java
      private void handleBlankLine(Long namespaceId, ItemDTO oldItem, int lineCounter, ItemChangeSets changeSets) {
          if (!isBlankItem(oldItem)) {
              changeSets.addCreateItem(buildBlankItem(0L, namespaceId, lineCounter));
          }
      }
      ```
      * 如果老配置不是空行，则创建空行Item，并加入到`createItems`中
      * 创建空行Item，key、value、comment均为空字符串
        ```java
        private ItemDTO buildBlankItem(Long id, Long namespaceId, int lineNum) {
            return buildNormalItem(id, namespaceId, "", "", "", lineNum);
        }
        ```
    
    * 既不是注释也不是空行，说明是一个正常的配置项，调用`handleNormalLine`处理
      ```java
      private void handleNormalLine(Long namespaceId, Map<String, ItemDTO> keyMapOldItem, String newItem,
                                int lineCounter, ItemChangeSets changeSets) {

          String[] kv = parseKeyValueFromItem(newItem);

          if (kv == null) {
              throw new BadRequestException("line:" + lineCounter + " key value must separate by '='");
          }

          String newKey = kv[0];
          String newValue = kv[1].replace("\\n", "\n"); //handle user input \n

          ItemDTO oldItem = keyMapOldItem.get(newKey);

          if (oldItem == null) {//new item
              changeSets.addCreateItem(buildNormalItem(0L, namespaceId, newKey, newValue, "", lineCounter));
          } else if (!newValue.equals(oldItem.getValue()) || lineCounter != oldItem.getLineNum()) {//update item
              changeSets.addUpdateItem(
                buildNormalItem(oldItem.getId(), namespaceId, newKey, newValue, oldItem.getComment(),
                    lineCounter));
          }
          keyMapOldItem.remove(newKey);
      }
      ```
        * 调用`parseKeyValueFromItem`将`newItem`新配置文本解析成String数组`kv`
        ```java
        private String[] parseKeyValueFromItem(String item) {
            int kvSeparator = item.indexOf(KV_SEPARATOR);
            if (kvSeparator == -1) {
                return null;
            }

            String[] kv = new String[2];
            kv[0] = item.substring(0, kvSeparator).trim();
            kv[1] = item.substring(kvSeparator + 1).trim();
            return kv;
        }
        ```
        * 从`kv`数组中获取`newKey`、`newValue`，并将`newValue`中的`\\n`字符替换为`\n`字符
        * 从`oldKeyMapItem`中获取旧配置项`oldItem`
        * 如果不存在旧配置项`oldItem`，则调用`buildNormalItem`创建新Item并加入到`createItems`中
          ```java
          private ItemDTO buildNormalItem(Long id, Long namespaceId, String key, String value, String comment, int lineNum) {
              ItemDTO item = new ItemDTO(key, value, comment, lineNum);
              item.setId(id);
              item.setNamespaceId(namespaceId);
              return item;
          }
          ```
        * 如果旧配置项已存在，但新旧value不相等、或新旧行号不一致，那么调用`buildNormalItem`创建新Item并加入到`updateItems`中
        * 最后，从`oldKeyMapItem`中移除`newKey`对应的配置

5. 调用`deleteCommentAndBlankItem`删除旧配置中的注释和空行
```java
private void deleteCommentAndBlankItem(Map<Integer, ItemDTO> oldLineNumMapItem,
                                         Map<Integer, String> newLineNumMapItem,
                                         ItemChangeSets changeSets) {

    for (Map.Entry<Integer, ItemDTO> entry : oldLineNumMapItem.entrySet()) {
        int lineNum = entry.getKey();
        ItemDTO oldItem = entry.getValue();
        String newItem = newLineNumMapItem.get(lineNum);

        //1. old is blank by now is not
        //2.old is comment by now is not exist or modified
        //3.old is blank by now is not exist or modified
        if ((isBlankItem(oldItem) && !isBlankItem(newItem))
                || (isCommentItem(oldItem) || isBlankItem(oldItem)) && (newItem == null || !newItem.equals(oldItem.getComment()))) {
            changeSets.addDeleteItem(oldItem);
        }
    }
}
```

6. 调用`deleteNormalKVItem`删除旧配种的正常配置项，由于在`handleNormalLine`处理时，已经从`oldKeyMapItem`移除了仍出现在新配置中的旧配置，调用`deleteNormalKVItem`时，`oldKeyMapItem`仍然出现的配置项，可以认为不存在新配置中，应该被删除
```java
private void deleteNormalKVItem(Map<String, ItemDTO> baseKeyMapItem, ItemChangeSets changeSets) {
    //surplus item is to be deleted
    for (Map.Entry<String, ItemDTO> entry : baseKeyMapItem.entrySet()) {
      changeSets.addDeleteItem(entry.getValue());
    }
}
```

## Portal

### ItemController

文本模式提交配置的入口是`/apps/{appId}/envs/{env}/clusters/{clusterName}/namespaces/{namespaceName}/items`，代码位于`apollo-portal`模块`com.ctrip.framework.apollo.portal.controller.ItemController`的`modifyItemsByText()`方法

```java
@PreAuthorize(value = "@permissionValidator.hasModifyNamespacePermission(#appId, #namespaceName, #env)")
  @PutMapping(value = "/apps/{appId}/envs/{env}/clusters/{clusterName}/namespaces/{namespaceName}/items", consumes = {
      "application/json"})
  public void modifyItemsByText(@PathVariable String appId, @PathVariable String env,
                                @PathVariable String clusterName, @PathVariable String namespaceName,
                                @RequestBody NamespaceTextModel model) {
    model.setAppId(appId);
    model.setClusterName(clusterName);
    model.setEnv(env);
    model.setNamespaceName(namespaceName);

    configService.updateConfigItemByText(model);
}
```

调用`updateConfigItemByText`方法，这里虽然叫做`configService`，但其实它的类型是`ItemService`，应该是之前重构过

### ItemService

`com.ctrip.framework.apollo.portal.service.ItemService`

```java
public void updateConfigItemByText(NamespaceTextModel model) {
    String appId = model.getAppId();
    Env env = model.getEnv();
    String clusterName = model.getClusterName();
    String namespaceName = model.getNamespaceName();

    NamespaceDTO namespace = namespaceAPI.loadNamespace(appId, env, clusterName, namespaceName);
    if (namespace == null) {
        throw BadRequestException.namespaceNotExists(appId, clusterName, namespaceName);
    }
    long namespaceId = namespace.getId();

    // In case someone constructs an attack scenario
    if (model.getNamespaceId() != namespaceId) {
        throw BadRequestException.namespaceNotExists();
    }

    String configText = model.getConfigText();

    ConfigTextResolver resolver =
        model.getFormat() == ConfigFileFormat.Properties ? propertyResolver : fileTextResolver;

    ItemChangeSets changeSets = resolver.resolve(namespaceId, configText,
        itemAPI.findItems(appId, env, clusterName, namespaceName));
    if (changeSets.isEmpty()) {
        return;
    }

    String operator = model.getOperator();
    if (StringUtils.isBlank(operator)) {
        operator = userInfoHolder.getUser().getUserId();
    }
    changeSets.setDataChangeLastModifiedBy(operator);

    updateItems(appId, env, clusterName, namespaceName, changeSets);

    Tracer.logEvent(TracerEventType.MODIFY_NAMESPACE_BY_TEXT,
        String.format("%s+%s+%s+%s", appId, env, clusterName, namespaceName));
    Tracer.logEvent(TracerEventType.MODIFY_NAMESPACE, String.format("%s+%s+%s+%s", appId, env, clusterName, namespaceName));
}
```

1. 调用`namespaceAPI.loadNamespace`查询Namespace，如果不存在则抛出异常
2. 如果查询到的Namespace的ID，与参数传入的namespaceId不一致，则抛出异常
3. 使用`ConfigTextResolver`解析配置文本`configText`，生产`ItemChangeSets`
4. 调用`updateItems`方法更新配置项

```java
public void updateItems(String appId, Env env, String clusterName, String namespaceName, ItemChangeSets changeSets){
    itemAPI.updateItemsByChangeSet(appId, env, clusterName, namespaceName, changeSets);
}
```

### ItemAPI

`ItemAPI`是`com.ctrip.framework.apollo.portal.api.AdminServiceAPI`的静态内部类

`updateItemsByChangeSet`方法是`AdminService`接口`apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}/itemset`的封装

```java
public void updateItemsByChangeSet(String appId, Env env, String clusterName, String namespace,
        ItemChangeSets changeSets) {
    restTemplate.post(env, "apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}/itemset",
          changeSets, Void.class, appId, clusterName, namespace);
}
```

## AdminService

### ItemSetController

`apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}/itemset`接口的实现在`apollo-adminservice`模块`com.ctrip.framework.apollo.adminservice.controller.ItemSetController`的`create`方法

```java
@PreAcquireNamespaceLock
@PostMapping("/apps/{appId}/clusters/{clusterName}/namespaces/{namespaceName}/itemset")
public ResponseEntity<Void> create(@PathVariable String appId, @PathVariable String clusterName,
                                     @PathVariable String namespaceName, @RequestBody ItemChangeSets changeSet) {

    itemSetService.updateSet(appId, clusterName, namespaceName, changeSet);

    return ResponseEntity.status(HttpStatus.OK).build();
}
```

### ItemSetService

`com.ctrip.framework.apollo.biz.service.ItemSetService`

`updateSet`方法实现了对`ItemChangeSets`的数据存储操作，分别对`createItems`、`updateItems`、`deleteItems`列表进行新增、修改、删除

```java
@Transactional
public ItemChangeSets updateSet(String appId, String clusterName,
                                String namespaceName, ItemChangeSets changeSet) {
    Namespace namespace = namespaceService.findOne(appId, clusterName, namespaceName);

    if (namespace == null) {
      throw NotFoundException.namespaceNotFound(appId, clusterName, namespaceName);
    }

    String operator = changeSet.getDataChangeLastModifiedBy();
    ConfigChangeContentBuilder configChangeContentBuilder = new ConfigChangeContentBuilder();

    if (!CollectionUtils.isEmpty(changeSet.getCreateItems())) {
      this.doCreateItems(changeSet.getCreateItems(), namespace, operator, configChangeContentBuilder);
      auditService.audit("ItemSet", null, Audit.OP.INSERT, operator);
    }

    if (!CollectionUtils.isEmpty(changeSet.getUpdateItems())) {
      this.doUpdateItems(changeSet.getUpdateItems(), namespace, operator, configChangeContentBuilder);
      auditService.audit("ItemSet", null, Audit.OP.UPDATE, operator);
    }

    if (!CollectionUtils.isEmpty(changeSet.getDeleteItems())) {
      this.doDeleteItems(changeSet.getDeleteItems(), namespace, operator, configChangeContentBuilder);
      auditService.audit("ItemSet", null, Audit.OP.DELETE, operator);
    }

    if (configChangeContentBuilder.hasContent()) {
      commitService.createCommit(appId, clusterName, namespaceName, configChangeContentBuilder.build(),
                   changeSet.getDataChangeLastModifiedBy());
    }

    return changeSet;
}
```
