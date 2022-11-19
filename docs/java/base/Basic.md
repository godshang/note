# 知识点

## 数据类型

### Java基本数据类型


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

### 缓存池

new Integer(123) 与 Integer.valueOf(123) 的区别在于：

* new Integer(123) 每次都会新建一个对象
* Integer.valueOf(123) 会使用缓存池中的对象，多次调用会取得同一个对象的引用。

valueOf() 方法的实现比较简单，就是先判断值是否在缓存池中，如果在的话就直接返回缓存池的内容。

```java
public static Integer valueOf(int i) {
    if (i >= IntegerCache.low && i <= IntegerCache.high)
        return IntegerCache.cache[i + (-IntegerCache.low)];
    return new Integer(i);
}
```

在 Java 8 中，Integer 缓存池的大小默认为 -128~127。

```java
static final int low = -128;
static final int high;
static final Integer cache[];

static {
    // high value may be configured by property
    int h = 127;
    String integerCacheHighPropValue =
        sun.misc.VM.getSavedProperty("java.lang.Integer.IntegerCache.high");
    if (integerCacheHighPropValue != null) {
        try {
            int i = parseInt(integerCacheHighPropValue);
            i = Math.max(i, 127);
            // Maximum array size is Integer.MAX_VALUE
            h = Math.min(i, Integer.MAX_VALUE - (-low) -1);
        } catch( NumberFormatException nfe) {
            // If the property cannot be parsed into an int, ignore it.
        }
    }
    high = h;

    cache = new Integer[(high - low) + 1];
    int j = low;
    for(int k = 0; k < cache.length; k++)
        cache[k] = new Integer(j++);

    // range [-128, 127] must be interned (JLS7 5.1.7)
    assert IntegerCache.high >= 127;
}
```

编译器会在缓冲池范围内的基本类型自动装箱过程调用 valueOf() 方法，因此多个 Integer 实例使用自动装箱来创建并且值相同，那么就会引用相同的对象。

```java
Integer m = 123;
Integer n = 123;
System.out.println(m == n); // true
```

基本类型对应的缓冲池如下：

* boolean values true and false
* all byte values
* short values between -128 and 127
* int values between -128 and 127
* char in the range \u0000 to \u007F

## String

String 被声明为 final，因此它不可被继承。

内部使用 char 数组存储数据，该数组被声明为 final，这意味着 value 数组初始化之后就不能再引用其它数组。并且 String 内部没有改变 value 数组的方法，因此可以保证 String 不可变。

### 不可变的好处：

1. 可以缓存 hash 值

因为 String 的 hash 值经常被使用，例如 String 用做 HashMap 的 key。不可变的特性可以使得 hash 值也不可变，因此只需要进行一次计算。

2. String Pool 的需要

如果一个 String 对象已经被创建过了，那么就会从 String Pool 中取得引用。只有 String 是不可变的，才可能使用 String Pool。

3. 安全性

String 经常作为参数，String 不可变性可以保证参数不可变。例如在作为网络连接参数的情况下如果 String 是可变的，那么在网络连接过程中，String 被改变，改变 String 对象的那一方以为现在连接的是其它主机，而实际情况却不一定是。

4. 线程安全

String 不可变性天生具备线程安全，可以在多个线程中安全地使用。

### String, StringBuffer and StringBuilder

1. 可变性

* String 不可变
* StringBuffer 和 StringBuilder 可变

2. 线程安全

* String 不可变，因此是线程安全的
* StringBuilder 不是线程安全的
* StringBuffer 是线程安全的，内部使用 synchronized 进行同步

### String.intern()

使用 String.intern() 可以保证相同内容的字符串变量引用同一的内存对象。

下面示例中，s1 和 s2 采用 new String() 的方式新建了两个不同对象，而 s3 是通过 s1.intern() 方法取得一个对象引用。intern() 首先把 s1 引用的对象放到 String Pool(字符串常量池)中，然后返回这个对象引用。因此 s3 和 s1 引用的是同一个字符串常量池的对象。

```java
String s1 = new String("aaa");
String s2 = new String("aaa");
System.out.println(s1 == s2);           // false
String s3 = s1.intern();
System.out.println(s1.intern() == s3);  // true
```

如果是采用 "bbb" 这种使用双引号的形式创建字符串实例，会自动地将新建的对象放入 String Pool 中。

```
String s4 = "bbb";
String s5 = "bbb";
System.out.println(s4 == s5);  // true
```

HotSpot中字符串常量池保存哪里？永久代？方法区还是堆区？

1. 运行时常量池（Runtime Constant Pool）是虚拟机规范中是方法区的一部分，在加载类和结构到虚拟机后，就会创建对应的运行时常量池；而字符串常量池是这个过程中常量字符串的存放位置。所以从这个角度，字符串常量池属于虚拟机规范中的方法区，它是一个逻辑上的概念；而堆区，永久代以及元空间是实际的存放位置。
2. 不同的虚拟机对虚拟机的规范（比如方法区）是不一样的，只有 HotSpot 才有永久代的概念。
3. HotSpot也是发展的，由于一些问题的存在，HotSpot考虑逐渐去永久代，对于不同版本的JDK，实际的存储位置是有差异的，具体看如下表格：

|JDK版本    |是否有永久代，字符串常量池放在哪里？                             |方法区逻辑上规范，由哪些实际的部分实现的？                                      |
|---------|-----------------------------------------------|-----------------------------------------------------------|
|jdk1.6及之前|有永久代，运行时常量池（包括字符串常量池），静态变量存放在永久代上              |这个时期方法区在HotSpot中是由永久代来实现的，以至于这个时期说方法区就是指永久代                |
|jdk1.7   |有永久代，但已经逐步“去永久代”，字符串常量池、静态变量移除，保存在堆中；          |这个时期方法区在HotSpot中由永久代（类型信息、字段、方法、常量）和堆（字符串常量池、静态变量）共同实现     |
|jdk1.8及之后|取消永久代，类型信息、字段、方法、常量保存在本地内存的元空间，但字符串常量池、静态变量仍在堆中|这个时期方法区在HotSpot中由本地内存的元空间（类型信息、字段、方法、常量）和堆（字符串常量池、静态变量）共同实现|

## 访问权限

Java 中有三个访问权限修饰符: private、protected 以及 public，如果不加访问修饰符，表示包级可见。

可以对类或类中的成员(字段以及方法)加上访问修饰符。

* 类可见表示其它类可以用这个类创建实例对象。
* 成员可见表示其它类可以用这个类的实例对象访问到该成员。

protected 用于修饰成员，表示在继承体系中成员对于子类可见，但是这个访问修饰符对于类没有意义。

设计良好的模块会隐藏所有的实现细节，把它的 API 与它的实现清晰地隔离开来。模块之间只通过它们的 API 进行通信，一个模块不需要知道其他模块的内部工作情况，这个概念被称为信息隐藏或封装。因此访问权限应当尽可能地使每个类或者成员不被外界访问。

如果子类的方法重写了父类的方法，那么子类中该方法的访问级别不允许低于父类的访问级别。这是为了确保可以使用父类实例的地方都可以使用子类实例，也就是确保满足里氏替换原则。

## 抽象类和接口

1. 抽象类

抽象类和抽象方法都使用 abstract 关键字进行声明。抽象类一般会包含抽象方法，抽象方法一定位于抽象类中。

抽象类和普通类最大的区别是，抽象类不能被实例化，需要继承抽象类才能实例化其子类。

2. 接口

接口是抽象类的延伸，在 Java 8 之前，它可以看成是一个完全抽象的类，也就是说它不能有任何的方法实现。

从 Java 8 开始，接口也可以拥有默认的方法实现，这是因为不支持默认方法的接口的维护成本太高了。在 Java 8 之前，如果一个接口想要添加新的方法，那么要修改所有实现了该接口的类。

接口的成员(字段 + 方法)默认都是 public 的，并且不允许定义为 private 或者 protected。

接口的字段默认都是 static 和 final 的。

3. 比较

* 从设计层面上看，抽象类提供了一种 IS-A 关系，那么就必须满足里式替换原则，即子类对象必须能够替换掉所有父类对象。而接口更像是一种 LIKE-A 关系，它只是提供一种方法实现契约，并不要求接口和实现接口的类具有 IS-A 关系。
* 从使用上来看，一个类可以实现多个接口，但是不能继承多个抽象类。
* 接口的字段只能是 static 和 final 类型的，而抽象类的字段没有这种限制。
* 接口的成员只能是 public 的，而抽象类的成员可以有多种访问权限。

4. 使用选择

使用接口:

* 需要让不相关的类都实现一个方法，例如不相关的类都可以实现 Compareable 接口中的 compareTo() 方法；
* 需要使用多重继承。

使用抽象类:

* 需要在几个相关的类中共享代码。
* 需要能控制继承来的成员的访问权限，而不是都为 public。
* 需要继承非静态和非常量字段。

在很多情况下，接口优先于抽象类，因为接口没有抽象类严格的类层次结构要求，可以灵活地为一个类添加行为。并且从 Java 8 开始，接口也可以有默认的方法实现，使得修改接口的成本也变的很低。

## static初始化顺序

静态变量和静态语句块优先于实例变量和普通语句块，静态变量和静态语句块的初始化顺序取决于它们在代码中的顺序。

存在继承的情况下，初始化顺序为：

* 父类(静态变量、静态语句块)
* 子类(静态变量、静态语句块)
* 父类(实例变量、普通语句块)
* 父类(构造函数)
* 子类(实例变量、普通语句块)
* 子类(构造函数)

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