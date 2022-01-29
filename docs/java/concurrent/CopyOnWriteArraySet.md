# CopyOnWriteArraySet 源码分析

`CopyOnWriteArraySet`是`JUC`中的`Set`接口实现，是一个线程安全的`Set`容器。

`CopyOnWriteArraySet`继承自`AbstractSet`，实现了`Serializable`接口。

## 构造函数

`CopyOnWriteArraySet`提供了2个构造函数，包括创建一个空的集合，以及从一个已有的集合创建。

```java
public CopyOnWriteArraySet() {
    al = new CopyOnWriteArrayList<E>();
}

public CopyOnWriteArraySet(Collection<? extends E> c) {
    al = new CopyOnWriteArrayList<E>();
    al.addAllAbsent(c);
}
```

## 内部属性

`CopyOnWriteArraySet`的实现基于内部的一个`CopyOnWriteArrayList`实例，读写方法都代理到`CopyOnWriteArrayList`实例完成。因此，`CopyOnWriteArraySet`的适用场景与`CopyOnWriteArrayList`一样，适合读多写少的小规模数据；而且，每次的写操作都会造成底层数组的创建与数据的复制，带来额外的开销。

```java
private final CopyOnWriteArrayList<E> al;
```

## 实现原理

`CopyOnWriteArraySet`中的方法都会代理到`CopyOnWriteArrayList`的实例`al`上，因此方法的实现相对简单。

有一点要注意的是，`Set`要求容器中不能存在同样的元素，这个去重逻辑是在`CopyOnWriteArrayList`中的`addIfAbsent`方法实现的。

```java
public boolean add(E e) {
    return al.addIfAbsent(e);
}

// CopyOnWriteArrayList
public boolean addIfAbsent(E e) {
	final ReentrantLock lock = this.lock;
	lock.lock();
	try {
	    // Copy while checking if already present.
	    // This wins in the most common case where it is not present
	    Object[] elements = getArray();
	    int len = elements.length;
	    Object[] newElements = new Object[len + 1];
	    for (int i = 0; i < len; ++i) {
		if (eq(e, elements[i]))
		    return false; // exit, throwing away copy
		else
		    newElements[i] = elements[i];
	    }
	    newElements[len] = e;
	    setArray(newElements);
	    return true;
	} finally {
	    lock.unlock();
	}
}
```

同样，在`CopyOnWriteArrayList`的`addAllAbsent`方法中也有类似的去重逻辑。

```java
public int addAllAbsent(Collection<? extends E> c) {
	Object[] cs = c.toArray();
	if (cs.length == 0)
	    return 0;
	Object[] uniq = new Object[cs.length];
	final ReentrantLock lock = this.lock;
	lock.lock();
	try {
	    Object[] elements = getArray();
	    int len = elements.length;
	    int added = 0;
	    for (int i = 0; i < cs.length; ++i) { // scan for duplicates
		Object e = cs[i];
		if (indexOf(e, elements, 0, len) < 0 &&
		    indexOf(e, uniq, 0, added) < 0)
		    uniq[added++] = e;
	    }
	    if (added > 0) {
            Object[] newElements = Arrays.copyOf(elements, len + added);
            System.arraycopy(uniq, 0, newElements, len, added);
            setArray(newElements);
	    }
	    return added;
	} finally {
	    lock.unlock();
	}
}
```

