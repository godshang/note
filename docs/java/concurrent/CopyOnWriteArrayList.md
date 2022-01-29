# CopyOnWriteArrayList 源码分析

`CopyOnWriteArrayList`是`JUC`中`List`接口的实现，是一个线程安全的`ArrayList`。

`CopyOnWriteArrayList`实现了`List`、`RandomAccess`、`Cloneable`、`Serializable`接口。

## 构造函数

`CopyOnWriteArrayList`提供了3个重载的构造函数。

```java
public CopyOnWriteArrayList() {
    setArray(new Object[0]);
}

public CopyOnWriteArrayList(Collection<? extends E> c) {
    Object[] elements;
    if (c.getClass() == CopyOnWriteArrayList.class)
        elements = ((CopyOnWriteArrayList<?>)c).getArray();
    else {
        elements = c.toArray();
        // c.toArray might (incorrectly) not return Object[] (see 6260652)
        if (elements.getClass() != Object[].class)
            elements = Arrays.copyOf(elements, elements.length, Object[].class);
    }
    setArray(elements);
}

public CopyOnWriteArrayList(E[] toCopyIn) {
    setArray(Arrays.copyOf(toCopyIn, toCopyIn.length, Object[].class));
}
```

## 内部属性

`CopyOnWriteArrayList`内部有2个非常重要的内部属性，一个是用于存储数据的数组`array`，功能同`ArrayList`中的内部数组一样；另一个是名为`lock`的可重入锁，用来保证并发访问时的线程安全性。

```java
/** The lock protecting all mutators */
final transient ReentrantLock lock = new ReentrantLock();

/** The array, accessed only via getArray/setArray. */
private transient volatile Object[] array;
```

## 实现原理

`CopyOnWriteArrayList`的实现采用了写时复制的原理。对于可能造成并发问题的写操作，每次写都会创建一个新的数组，将原数组`array`中的数据复制到新数组中，在新数组上进行写入，再将`array`变量指向新数组。整个过程在`lock`重入锁的保护下，保证了并发写入的安全。这样做的好处是可以对`CopyOnWriteArrayList`进行并发的读，而不需要加锁。如果读的时候有多个线程正在想`CopyOnWriteArrayList`添加数据，读还是会读到旧的数据，因为从开始读的那一刻已经确定了读取的还是旧数组。

以`add`方法为例：

```java
public boolean add(E e) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        Object[] elements = getArray();
        int len = elements.length;
        Object[] newElements = Arrays.copyOf(elements, len + 1);
        newElements[len] = e;
        setArray(newElements);
        return true;
    } finally {
        lock.unlock();
    }
}
```

其他的写方法过程类似。

`CopyOnWriteArrayList`由于每次写都会创建一个新的数组并复制数据，当写操作较多时会带来较大的开销，因此适合读多写少的并发场景。

## 迭代器

`CopyOnWriteArrayList`适用`iterator`返回的迭代器进行迭代时，需要注意，它不支持在迭代时进行写方法的调用，比如在迭代过程中`remove`元素。这与`CopyOnWriteArrayList`本身的写时复制特性有关。

`CopyOnWriteArrayList`的迭代器在迭代过程中使用的是创建迭代器时的数组的一个快照，因此在迭代过程中看的数据都是这个快照中的数据，即使发生了数据的写入，例如新增或者删除，都不会在迭代过冲中反应出来。

与`ArrayList`实现相比，CopyOnWriteArrayList返回迭代器不会抛出ConcurrentModificationException异常，即它不是fail-fast机制的。