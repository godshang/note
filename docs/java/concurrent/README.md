# Java 并发编程

本目录以 Java 5—8 的并发模型与主要 JUC 实现为背景，内容分为四组：

* 基础理论：Java 内存模型、happens-before、线程生命周期与 `volatile`。
* 锁与同步器：`synchronized`、`Lock`、AQS 以及常见 JUC 锁。
* 并发容器：`ConcurrentHashMap`、写时复制集合与阻塞队列。
* 线程上下文：`ThreadLocal` 与 `InheritableThreadLocal`。

阅读源码分析时应留意文章所引用的 JDK 版本。例如，JDK 7 的 `ConcurrentHashMap` 使用分段锁，而 JDK 8 改为数组、链表/红黑树与 CAS、`synchronized` 协作；两套实现不能混为一谈。
