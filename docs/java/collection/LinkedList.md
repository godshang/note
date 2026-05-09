# LinkedList 源码分析

`LinkedList` 是 `List` 接口的实现之一，底层基于双向链表实现。`LinkedList` 继承自 `AbstractSequentialList`，并实现了 `List`、`Deque`、`Cloneable`、`Serializable` 接口。

<img src="./image/LinkedList.png" />

## Entry 内部类

`Entry` 是早期 `LinkedList` 实现中的私有内部类，表示链表节点。`next` 和 `previous` 分别指向后继节点和前驱节点，因此该结构属于双向链表。

```java
private static class Entry<E> {
	E element;
	Entry<E> next;
	Entry<E> previous;

	Entry(E element, Entry<E> next, Entry<E> previous) {
	    this.element = element;
	    this.next = next;
	    this.previous = previous;
	}
}
```

## 内部属性

在所示实现中，`LinkedList` 维护两个重要属性：`header` 是哨兵头节点，`size` 是链表中实际元素的数量。与数组结构不同，`LinkedList` 不存在预分配容量的概念。

```java
private transient Entry<E> header = new Entry<E>(null, null, null);
private transient int size = 0;
```

## 构造函数

`LinkedList`有两个构造函数，一个是无参构造函数，将`header`的头和尾都指向`header`；另一个接受一个`Collection`类型的参数，调用`addAll`方法初始化到链表中。

```java
public LinkedList() {
    header.next = header.previous = header;
}

public LinkedList(Collection<? extends E> c) {
	this();
	addAll(c);
}
```

## add方法

`add` 方法用于向链表添加元素，新元素默认插入到链表尾部。

```java
public boolean add(E e) {
	addBefore(e, header);
    return true;
}

private Entry<E> addBefore(E e, Entry<E> entry) {
	Entry<E> newEntry = new Entry<E>(e, entry, entry.previous);
	newEntry.previous.next = newEntry;
	newEntry.next.previous = newEntry;
	size++;
	modCount++;
	return newEntry;
}
```

也可以使用`addFirst`或`addLast`方法将元素添加到链表的头部和尾部。`addLast`与`add`的实现一致。

```java
public void addFirst(E e) {
	addBefore(e, header.next);
}

public void addLast(E e) {
	addBefore(e, header);
}
```

## remove方法

`remove`方法将元素从链表中移除。`LinkedList`提供了多种`remove`方法的实现，方便进行各种情形下的删除元素操作。

`remove`方法包括：

```java
public boolean remove(Object o) {}
public E remove(int index) {}
public E remove() {}
public E removeFirst() {}
public E removeLast() {}
```

核心的 `remove` 方法是私有方法，其实现逻辑是断开目标节点与前驱、后继节点之间的链接，并更新链表长度。

```java
private E remove(Entry<E> e) {
	if (e == header)
	    throw new NoSuchElementException();

    E result = e.element;
	e.previous.next = e.next;
	e.next.previous = e.previous;
    e.next = e.previous = null;
    e.element = null;
	size--;
	modCount++;
    return result;
}
```

## Deque接口中的方法

`LinkedList`也实现了`Deque`接口，因此提供了相关方法的实现，基本都是链表相关的操作，包括：

```java
void addFirst(E e);
void addLast(E e);
boolean offerFirst(E e);
boolean offerLast(E e);
E removeFirst();
E removeLast();
E pollFirst();
E pollLast();
E getFirst();
E getLast();
E peekFirst();
E peekLast();
boolean removeFirstOccurrence(Object o);
boolean removeLastOccurrence(Object o);

// *** Queue methods ***
boolean add(E e);
boolean offer(E e);
E remove();
E poll();
E element();
E peek();

// *** Stack methods ***
void push(E e);
E pop();

// *** Collection methods ***
boolean remove(Object o);
boolean contains(Object o);
public int size();
Iterator<E> iterator();
Iterator<E> descendingIterator();
```

`poll`开头的方法除返回元素外还会删除元素，`peek`开头的方法仅仅返回元素而不会删除元素。

`remove`开头的方法类似`poll`，除返回元素外还会删除元素；`get`开头的方法类似`peek`，仅仅返回元素而不会删除元素。

当链表是空时，`peek`和`poll`开头的方法会返回`null`；而`remove`和`get`开头的方法会抛出异常。
