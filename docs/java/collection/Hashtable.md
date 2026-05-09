# Hashtable 源码分析

`Hashtable` 是 JDK 早期提供的 `Map` 实现，自 JDK 1.0 起即已存在。它与 `HashMap` 在基本数据结构和实现思路上较为相似，但在空值支持、同步策略和继承结构上存在差异。

## 类继承结构

`Hashtable`继承自`Dictionary`抽象类，并且实现了`Map`接口；`HashMap`继承自`AbstractMap`抽象类，且实现了`Map`接口。

## 线程安全

`Hashtable` 的主要公开方法使用 `synchronized` 修饰，因此单个方法调用具备同步保护。但这种同步粒度较粗，在并发场景下通常不如 `ConcurrentHashMap` 适合高并发访问。

## 其他细节

* `Hashtable` 不允许 `key` 和 `value` 为 `null`。
* 在 JDK 8 的实现中，`Hashtable` 处理哈希冲突时仍然采用链表结构，不会像 `HashMap` 一样在链表过长时树化。
