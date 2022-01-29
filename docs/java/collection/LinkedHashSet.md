# LinkedHashSet

`LinkedHashSet`是另一个`Set`接口的实现，与`HashSet`不同的是，它能保证集合中元素的顺序，底层使用了`LinkedHashMap`实现。

`LinkedHashSet`实现非常简单，通过继承`HashSet`实现，只不过调用了父类的构造函数时，使用了`HashSet`包访问级别的构造函数，这个细节在上文介绍`HashSet`时有提到过。

```java
HashSet(int initialCapacity, float loadFactor, boolean dummy) {
	map = new LinkedHashMap<E,Object>(initialCapacity, loadFactor);
}
```

我们知道，`LinkedHashMap`的顺序有插入顺序和访问顺序的差别（见`LinkedHashMap`一节），默认维护的是插入顺序。因此`LinkedHashSet`所保持的顺序，也就是元素插入时的先后顺序。

`LinkedHashSet`代码比较简单，我就直接贴出来了。

```java
public class LinkedHashSet<E>
    extends HashSet<E>
    implements Set<E>, Cloneable, java.io.Serializable {

    private static final long serialVersionUID = -2851667679971038690L;

    /**
     * Constructs a new, empty linked hash set with the specified initial
     * capacity and load factor.
     *
     * @param      initialCapacity the initial capacity of the linked hash set
     * @param      loadFactor      the load factor of the linked hash set
     * @throws     IllegalArgumentException  if the initial capacity is less
     *               than zero, or if the load factor is nonpositive
     */
    public LinkedHashSet(int initialCapacity, float loadFactor) {
        super(initialCapacity, loadFactor, true);
    }

    /**
     * Constructs a new, empty linked hash set with the specified initial
     * capacity and the default load factor (0.75).
     *
     * @param   initialCapacity   the initial capacity of the LinkedHashSet
     * @throws  IllegalArgumentException if the initial capacity is less
     *              than zero
     */
    public LinkedHashSet(int initialCapacity) {
        super(initialCapacity, .75f, true);
    }

    /**
     * Constructs a new, empty linked hash set with the default initial
     * capacity (16) and load factor (0.75).
     */
    public LinkedHashSet() {
        super(16, .75f, true);
    }

    /**
     * Constructs a new linked hash set with the same elements as the
     * specified collection.  The linked hash set is created with an initial
     * capacity sufficient to hold the elements in the specified collection
     * and the default load factor (0.75).
     *
     * @param c  the collection whose elements are to be placed into
     *           this set
     * @throws NullPointerException if the specified collection is null
     */
    public LinkedHashSet(Collection<? extends E> c) {
        super(Math.max(2*c.size(), 11), .75f, true);
        addAll(c);
    }
}
```