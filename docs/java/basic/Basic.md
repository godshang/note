## Java基本数据类型


| **名称** | **字节** | **最小值**       | **最大值**              | **描述**                     |
|----------|----------|------------------|-------------------------|------------------------------|
| byte     | 1        | \-128(-2\^7)     | 127(2\^7-1)             | 8位有正负的二进制整数        |
| short    | 2        | \-2\^15          | 2\^15-1                 | 16位有正负的二进制整数       |
| int      | 4        | \-2\^31          | 2\^31 -1                | 32位有正负的二进制整数       |
| long     | 8        | \-2\^63          | 2\^63 -1                | 64位有正负的二进制整数       |
| float    | 4        |                  |                         | 32位IEEE 754标准下的浮点数据 |
| double   | 8        |                  |                         | 64位IEEE 754标准下的浮点数据 |
| boolean  | 1bit     |                  |                         |                              |
| char     | 2        | '\\u0000' (或 0) | '\\uffff' (或 65，535 ) | 16 位 Unicode 标准下的字符   |

## equals方法和hashCode方法

equals是比较值是否相等。一般比较对象是否相等都用equals，equals方法主要是用来判断从表面上看或者从内容上看，2个对象是不是相等。比较两个枚举类型的值的时候不要调用equals，直接使用“==”就可以。

hashCode实际上就是一个对象的MD5。对比起来比equals快得多。他是一个整数值，但是没有规律的。java中默认的散列码就是对象的存储地址。

对象相等则hashCode一定相等；hashCode相等对象未必相等。

注意：重载equals的时候，一定要(must)（正确）重载hashCode 。使得equals成立的时候，hashCode相等。使两个逻辑相等。我们在定义hashCode方法时，要乘以一些奇数（最好是素数），这是是为了在理论上增大哈希值得离散程度。这是数学上证明的问题。你需要知道的是，hashcode就是为了哈希索引用的，哈希值分布的越均匀，map数据结构的查询效率越高。

## Object类有哪些方法？

| Object()                       | 默认构造方法                                                                                                                            |
|--------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| clone()                        | 创建并返回此对象的一个副本。                                                                                                            |
| equals(Object obj)             | 指示某个其他对象是否与此对象“相等”。                                                                                                    |
| finalize()                     | 当垃圾回收器确定不存在对该对象的更多引用时，由对象的垃圾回收器调用此方法。                                                              |
| getClass()                     | 返回一个对象的运行时类。                                                                                                                |
| hashCode()                     | 返回该对象的哈希码值。                                                                                                                  |
| notify()                       | 唤醒在此对象监视器上等待的单个线程。                                                                                                    |
| notifyAll()                    | 唤醒在此对象监视器上等待的所有线程。                                                                                                    |
| toString()                     | 返回该对象的字符串表示。                                                                                                                |
| wait()                         | 导致当前的线程等待，直到其他线程调用此对象的 notify() 方法或 notifyAll() 方法。                                                         |
| wait(long timeout)             | 导致当前的线程等待，直到其他线程调用此对象的 notify() 方法或 notifyAll() 方法，或者超过指定的时间量。                                   |
| wait(long timeout， int nanos) | 导致当前的线程等待，直到其他线程调用此对象的 notify() 方法或 notifyAll() 方法，或者其他某个线程中断当前线程，或者已超过某个实际时间量。 |

## Java的四种引用

**强引用(StrongReference)**

强引用是使用最普遍的引用。如果一个对象具有强引用，那垃圾回收器绝不会回收它。当内存空间不足，Java虚拟机宁愿抛出OutOfMemoryError错误，使程序异常终止，也不会靠随意回收具有强引用的对象来解决内存不足的问题。

**软引用(SoftReference)**

如果一个对象只具有软引用，则内存空间足够，垃圾回收器就不会回收它；如果内存空间不足了，就会回收这些对象的内存。只要垃圾回收器没有回收它，该对象就可以被程序使用。软引用可用来实现内存敏感的高速缓存。
软引用可以和一个引用队列（ReferenceQueue）联合使用，如果软引用所引用的对象被垃圾回收器回收，Java虚拟机就会把这个软引用加入到与之关联的引用队列中。

**弱引用(WeakReference)**

弱引用与软引用的区别在于：只具有弱引用的对象拥有更短暂的生命周期。在垃圾回收器线程扫描它所管辖的内存区域的过程中，一旦发现了只具有弱引用的对象，不管当前内存空间足够与否，都会回收它的内存。不过，由于垃圾回收器是一个优先级很低的线程，因此不一定会很快发现那些只具有弱引用的对象。

弱引用可以和一个引用队列（ReferenceQueue）联合使用，如果弱引用所引用的对象被垃圾回收，Java虚拟机就会把这个弱引用加入到与之关联的引用队列中。  

**虚引用(PhantomReference)**

"虚引用"顾名思义，就是形同虚设，与其他几种引用都不同，虚引用并不会决定对象的生命周期。如果一个对象仅持有虚引用，那么它就和没有任何引用一样，在任何时候都可能被垃圾回收器回收。虚引用主要用来跟踪对象被垃圾回收器回收的活动。虚引用与软引用和弱引用的一个区别在于：虚引用必须和引用队列 （ReferenceQueue）联合使用。当垃圾回收器准备回收一个对象时，如果发现它还有虚引用，就会在回收对象的内存之前，把这个虚引用加入到与之 关联的引用队列中。

**总结**

WeakReference与SoftReference都可以用来保存对象的实例引用，这两个类与垃圾回收有关。

WeakReference是弱引用，其中保存的对象实例可以被GC回收掉。这个类通常用于在某处保存对象引用，而又不干扰该对象被GC回收，通常用于Debug、内存监视工具等程序中。因为这类程序一般要求即要观察到对象，又不能影响该对象正常的GC过程。

最近在JDK的Proxy类的实现代码中也发现了Weakrefrence的应用，Proxy会把动态生成的Class实例暂存于一个由Weakrefrence构成的Map中作为Cache。SoftReference是强引用，它保存的对象实例，除非JVM即将OutOfMemory，否则不会被GC回收。

这个特性使得它特别适合设计对象Cache。对于Cache，我们希望被缓存的对象最好始终常驻内存，但是如果JVM内存吃紧，为了不发生OutOfMemoryError导致系统崩溃，必要的时候也允许JVM回收Cache的内存，待后续合适的时机再把数据重新Load到Cache中。这样可以系统设计得更具弹性。

## String

String 被声明为final，因此它不可继承。

内部使用 char 数组存储数据，该数组被声明为 final，这意味着 value 数组初始化之后就不能再引用其它数组。并且 String 内部没有改变 value 数组的方法，因此可以保证 String 不可变。

```java
public final class String
    implements java.io.Serializable, Comparable<String>, CharSequence {
    /** The value is used for character storage. */
    private final char value[];
```

不可变的好处：

* 可以缓存 hash 值：因为 String 的 hash 值经常被使用，例如 String 用做 HashMap 的 key。不可变的特性可以使得 hash 值也不可变，因此只需要进行一次计算。
* String Pool 的需要：如果一个 String 对象已经被创建过了，那么就会从 String Pool 中取得引用。只有 String 是不可变的，才可能使用 String Pool。
* 安全性：String 经常作为参数，String 不可变性可以保证参数不可变。例如在作为网络连接参数的情况下如果 String 是可变的，那么在网络连接过程中，String 被改变，改变 String 对象的那一方以为现在连接的是其它主机，而实际情况却不一定是。
* 线程安全：String 不可变性天生具备线程安全，可以在多个线程中安全地使用。

## String StringBuffer 和 StringBuilder 的区别是什么? String 为什么是不可变的?

**可变性**

String 类中使用 final 关键字修饰字符数组来保存字符串，private final char value[]，所以 String 对象是不可变的。

在 Java 9 之后，String 类的实现改用 byte 数组存储字符串 private final byte[] value;

而 StringBuilder 与 StringBuffer 都继承自 AbstractStringBuilder 类，在 AbstractStringBuilder 中也是使用字符数组保存字符串char[]value 但是没有用 final 关键字修饰，所以这两种对象都是可变的。

StringBuilder 与 StringBuffer 的构造方法都是调用父类构造方法也就是 AbstractStringBuilder 实现的。 AbstractStringBuilder 实现上类似 ArrayList 。

```java
abstract class AbstractStringBuilder implements Appendable, CharSequence {
    /**
     * The value is used for character storage.
     */
    char[] value;

    /**
     * The count is the number of characters used.
     */
    int count;

    AbstractStringBuilder(int capacity) {
        value = new char[capacity];
    }
```

**线程安全性**

String 中的对象是不可变的，也就可以理解为常量，线程安全。AbstractStringBuilder 是 StringBuilder 与 StringBuffer 的公共父类，定义了一些字符串的基本操作，如 expandCapacity、append、insert、indexOf 等公共方法。StringBuffer 对方法加了同步锁或者对调用的方法加了同步锁，所以是线程安全的。StringBuilder 并没有对方法进行加同步锁，所以是非线程安全的。

**性能**

每次对 String 类型进行改变的时候，都会生成一个新的 String 对象，然后将指针指向新的 String 对象。StringBuffer 每次都会对 StringBuffer 对象本身进行操作，而不是生成新的对象并改变对象引用。相同情况下使用 StringBuilder 相比使用 StringBuffer 仅能获得 10%~15% 左右的性能提升，但却要冒多线程不安全的风险。

**对于三者使用的总结**

1. 操作少量的数据: 适用 String
2. 单线程操作字符串缓冲区下操作大量数据: 适用 StringBuilder
3. 多线程操作字符串缓冲区下操作大量数据: 适用 StringBuffer

## 在 Java 中定义一个不做事且没有参数的构造方法的作用

Java 程序在执行子类的构造方法之前，如果没有用 super()来调用父类特定的构造方法，则会调用父类中“没有参数的构造方法”。因此，如果父类中只定义了有参数的构造方法，而在子类的构造方法中又没有用 super()来调用父类中特定的构造方法，则编译时将发生错误，因为 Java 程序在父类中找不到没有参数的构造方法可供执行。解决办法是在父类里加上一个不做事且没有参数的构造方法。

## Object object = new Object() 在内存中占了多少字节？

普通对象在内存中的存储布局：

* 对象头 markword
* 类型指针 class pointer
* 实例数据 instance data
* 对齐 padding

数组对象在内存中的存储布局：

* 对象头 markword
* 类型指针 class pointer
* 数组长度 length 4字节
* 实例数据 instance data
* 对齐 padding

markword长8个字节；对于64位虚拟机，指针长度为64位8个字节，如果开启了压缩指针（-XX:UseCompressedClassPointers，默认开启），那么就是4个字节；再加上对齐4字节，共16字节。

如果算上对象应用的指针的话，就是20字节。