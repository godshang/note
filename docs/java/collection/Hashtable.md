# Hashtable 源码分析

`Hashtable`是JDK提供的另一个`Map`实现，更为古老，从JDK 1.0版本开始就已经存在了。`Hashtable`与`HashMap`极为类似，包括内部数据结构与实现逻辑。

## 类继承结构

`Hashtable`继承自`Dictionary`抽象类，并且实现了`Map`接口；`HashMap`继承自`AbstractMap`抽象类，且实现了`Map`接口。

## 线程安全

`Hashtabl`中的各方法都使用`synchronized`关键字，实现了并发访问时的线程安全性。

## 其他细节

* `Hashtable`不允许key和value为null。
* `Hashtable`处理哈希冲突时，同样是插入到链表头部。