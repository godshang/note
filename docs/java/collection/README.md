# Java集合框架

Java提供了非常丰富的各类集合数据结构，包含了常用的：集合、链表、队列、栈、字典等。这些数据结构，它们位于`java.util.*`包中。

<img src="./image/collection_framework.jpg" />

## 集合接口

集合接口分为两类，一类以`Collection`衍生的各类集合，一类是以`Map`衍生的各类字典。

`Collection`包含`List`和`Set`两大分支，`List`是一个有序的数据结构，每个元素有自己的索引，第一个元素的索引值是0，主要实现有`LinkedList`、`ArrayList`、`Vector`、`Stack`。`Set`是一个不允许重复元素的无序数据结构，主要实现有`HashSet`和`TreeSet`。`HashSet`依赖与`HashMap`，它实际上是由`HashMap`实现；`TreeSet`依赖`TreeMap`，它实际是由`TreeMap`实现。

`Map`是一个键值对的字典结构，`Map`中的每个元素包括`key`和`value`两部分。`Map`的主要实现有`HashMap`、`TreeMap`、`WeakHashMap`、`LinkedHashMap`、`Hashtable`等。

`Iterator`是一个迭代器接口，用于集合的遍历。`Enumeration`是一个更古老的遍历接口，1.0的时候引入，`Enumeration`只能在`Hashtable`、`Vector`、`Stack`中使用。