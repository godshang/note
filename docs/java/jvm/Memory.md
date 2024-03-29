# JVM内存区域

## 运行时数据区域

Java虚拟机所管理的内存包括以下几个运行时数据区域：

* 程序计数器
* 虚拟机栈
* 本地方法栈
* 方法区
* 堆

JDK 1.8与1.7相比，最大的差别就是：元数据区取代了永久代。元空间的本质和永久代类似，都是对JVM规范中方法区的实现，但是元空间与永久代之间最大的区别在于：元数据空间并不在虚拟机中，而是使用本地内存。

### 程序计数器

程序计数器是一块较小的内存空间，是当前线程正在执行的那条字节码指令的地址。若当前线程正在执行的是一个本地方法，那么此时程序计数器为Undefined。

程序计数器的作用：

* 字节码解释器通过改变程序计数器来依次读取指令，从而实现代码的流程控制。
* 在多线程情况下，程序计数器记录的是当前线程执行的位置，从而当线程切换回来时，就知道上次线程执行到哪了。

程序计数器的特点：

* 是一块较小的内存空间。
* 线程私有，每条线程都有自己的程序计数器。
* 生命周期：随着线程的创建而创建，随着线程的结束而销毁。
* 是唯一一个不会出现OutOfMemoryError的内存区域。

### Java虚拟机栈

Java 虚拟机栈是描述 Java 方法运行过程的内存模型。

Java虚拟机栈也是线程私有的，它的生命周期与线程相同。每个方法被执行的时候，Java虚拟机都会同步创建一个栈帧用于存储局部变量表、操作数栈、动态链接、方法出口等信息。每个方法被调用直至执行完毕的过程，就对应着一个栈帧在虚拟机栈中从入栈到出栈的过程。

我们常说的内存分为堆和栈，栈通常指的就是虚拟机栈，或者更多情况下只是只虚拟机栈中的局部变量表部分。局部变量表存放了编译期可知的各种Java虚拟机基本数据类型、对象引用和returnAddress类型。

Java 虚拟机栈的特点：

* 局部变量表随着栈帧的创建而创建，它的大小在编译时确定，创建时只需分配事先规定的大小即可。在方法运行过程中，局部变量表的大小不会发生改变。
* Java 虚拟机栈会出现两种异常：StackOverFlowError 和 OutOfMemoryError。
    * 如果线程请求的栈深度大于虚拟机所允许的深度，将抛出StackOverflowError异常
    * 如果Java虚拟机栈容量可以动态扩展，当栈扩展时无法申请到足够的内存会抛出OutOfMemoryError异常。
* Java 虚拟机栈也是线程私有，随着线程创建而创建，随着线程的结束而销毁。

### 本地方法栈

本地方法栈与虚拟机栈的作用非常类似，区别知识虚拟机栈为虚拟机执行Java方法服务，而本地方法栈则是为虚拟机使用到的本地Native方法服务。

与虚拟机栈一样，本地方法栈也会在栈深度溢出或者栈扩展失败时分别抛出StackOverflowError和OutOfMemoryError异常。

### Java 堆

堆是用来存放对象的内存空间，几乎所有的对象都存储在堆中。

堆的特点:

* 线程共享，整个 Java 虚拟机只有一个堆，所有的线程都访问同一个堆。而程序计数器、Java 虚拟机栈、本地方法栈都是一个线程对应一个。
* 在虚拟机启动时创建。
* 是垃圾收集器管理的内存区域。
* 进一步可分为：新生代(Eden区 From Survior To Survivor)、老年代。（在基于分代收集理论的收集器中）

堆的大小既可以固定也可以扩展，但对于主流的虚拟机，堆的大小是可扩展的，因此当线程请求分配内存，但堆已满，且内存已无法再扩展时，就抛出 OutOfMemoryError 异常。

Java中对象实例都分配在对堆上吗？几乎是，但是现在由于即时编译技术的进步，尤其是逃逸分析技术的日渐强大，栈上分配、标量替换优化手段已经导致一些变化悄然发生。

### 方法区

方法区与Java堆一样，是各个线程共享的内存区域，用于存储已被虚拟机加载的类型信息、常量、静态变量、即时编译器编译后的代码缓存等数据。

方法区的特点：

* 线程共享。 方法区是堆的一个逻辑部分，因此和堆一样，都是线程共享的。整个虚拟机中只有一个方法区。
* 永久代。 方法区中的信息一般需要长期存在，而且它又是堆的逻辑分区，因此用堆的划分方法，把方法区称为“永久代”。
* 内存回收效率低。 方法区中的信息一般需要长期存在，回收一遍之后可能只有少量信息无效。主要回收目标是：对常量池的回收；对类型的卸载。
* Java 虚拟机规范对方法区的要求比较宽松。 和堆一样，允许固定大小，也允许动态扩展，还允许不实现垃圾回收。

方法区与永久代常常被混为一谈，本质上两者并不等价，仅仅是因为当时的HotSpot虚拟机设计团队选择把收集器的分带设计扩展至方法区，或者说使用永久代来实现方法区而已，这使得HotSpot的垃圾收集器能够像管理Java堆一样管理这部分内存，省去专门为方法区编写内存管理代码的工作。对于其他虚拟机实现，是不存在永久代的概念的。JDK7中的HotSpot，已经把原本放在永久代中的字符串常量池、静态变量等移出，而到了JDK8，终于完全废弃了永久代的概念，改用在本地内存中实现的元空间来代替。

如果方法区无法满足新的内存分配需求时，将抛出OutOfMemoryError异常。

### 运行时常量池

运行时常量池是方法区的一部分。Class文件中除了有类的版本、字段、方法、接口等描述信息外，还有一项信息是常量池表，用于存放编译期生成的各种字面量与符号引用，这部分内容将在类加载后存放到方法区的运行时常量池中。

运行时常量的一个重要特征是具备动态性，Java语言并不要求常量一定只有编译期才能产生，也就是说，并非预置入Class文件中常量池的内容才能进入方法区运行时常量池，运行期也可以将新的常量放入池中，这种特性利用得比较多的便是String类的intern()方法。

既然运行时常量池是方法区的一部分，自然受到方法区内存的限制，当常量池无法再申请到内存时便会抛出OutOfMemoryError异常。

### 直接内存

直接内存也叫堆外内存。直接内存（Direct Memory）并不是虚拟机运行时数据区的一部分，也不是《Java虚拟机规范》中定义的内存区域，但是这部分内存也被频繁地使用，而且也可能导致OutOfMemoryError异常出现。

NIO中引入了一种基于通道（Channel）与缓冲区（Buffer）的I/O方式，它可以使用Native函数库直接分配堆外内存，然后通过一个存储在Java堆里面的DirectByteBuffer对象作为这块内存的引用进行操作。这样能在一些场景中显著提高性能，因为避免了Java堆和Native堆中来回复制数据。

直接内存与堆内存比较：

* 直接内存申请空间耗费更高的性能
* 直接内存读取 IO 的性能要优于普通的堆内存。
* 直接内存作用链： 本地 IO -> 直接内存 -> 本地 IO
* 堆内存作用链：本地 IO -> 直接内存 -> 非直接内存 -> 直接内存 -> 本地 IO

显然，本机直接内存的分配不会受到Java堆大小的限制，但是，既然是内存，则肯定还是会受到本机总内存大小以及处理器寻址空间的限制，当各个内存区域总和大于物理内存限制，从而导致动态扩展时出现OutOfMemoryError异常。

## HotSpot虚拟机对象

HotSpot虚拟机在Java堆中对象分配、布局和访问的全过程。

### 对象的创建

#### 类加载

当Java虚拟机遇到一条字节码new指令时，首先将去检查这个指令的参数是否能在常量池中定位到一个类的符号引用，并且检查这个符号引用代表的类是否已被加载、解析和初始化过。如果没有，那必须先执行相应的类加载过程。

#### 为新生对象分配内存

对象所需内存的大小在类加载完成后便可完全确定，为对象分配空间实际上便等同于把一块确定大小的内存块从Java堆中划分出来。划分方式有两种：

1. 如果堆中内存是规整的，所有被使用过的内存都被放在一边，空闲的内存被放在另一边，中间放着一个指针作为分界点指示器，那分配内存就仅仅是把直至向空闲方向挪动一段与对象大小相等的距离，这种分配方式称为“指针碰撞”。
2. 如果堆中内存并不规整，已被使用的内存和空闲的内存相互交错在一起，没办法简单地进行指针碰撞，虚拟机必须维护一个列表，记录哪些内存块可用，在分配的时候从列表中找到一块足够大的空间划分给对象实例，并更新列表上的记录，这种分配方式称为“空闲列表”。

当使用带有压缩整理过程的垃圾收集器（如Serial、ParNew等）时，采用的分配算法是指针碰撞；当使用基于清除算法的垃圾收集器（如CMS）时，采用的是空闲列表。

另一个问题时，在并发情况下如何线程安全的创建对象。解决方案有两种，一种是对分配内存空间的动作进行同步处理，实际上虚拟机就是采用CAS配上失败重试的方式保证原子性；另一种方式是使用本地线程分配缓冲区（TLAB），提前为线程划分不同的空间，只有本地缓冲区用完了，分配新的缓冲区时才需要同步锁定。

#### 初始化

内存分配完成之后，虚拟机必须对分配到的内存空间都初始化为零值。如果使用了TLAB，这一工作也可以提前至TLAB分配时顺便进行。

虚拟机还要为对象进行必要的设置，例如对象是哪个类的实例、如何才能找到类的元数据信息、对象的哈希码、对象的GC分代年龄等信息。这些信息存放在对象的对象头之中。

以上工作完成后，从虚拟机视角看，一个新的对象已经产生。但从Java程序的视角看，对象创建才刚刚开始，构造函数，即Class文件中的`<init>()`方法还没有执行。new指令之后接着执行`<init>()`方法，按照程序员的意愿对对象进行初始化，这样一个真正可用的对象才算完全被构造出来。

### 对象的内存布局

在HotSpot虚拟机里，对象在堆内存中的存储布局可以划分为三个部分：对象头、实例数据和对齐填充。

对象头包括两类信息，第一类用于存储对象自身的运行时数据，如哈希码、GC分代年龄、锁状态标志、线程持有的锁、偏向线程ID、偏向时间戳等；对象头的另外一部分是类型指针，即对象指向它的类型元数据的指针。此外，如果对象是一个Java数组，那在对象头中国还必须有一块用于记录数组长度的数据。

实例数据部分是对象真正存储的有效信息，即我们在程序代码里所定义的各种类型的字段内容，包括父类成员变量和本类成员变量。

对象的第三部分是对齐填充，这不是必然存在的，它仅仅起着占位符的作用，用于确保对象的总长度为 8 字节的整数倍。

### 对象的访问定位

对象的访问方式是由虚拟机实现而定的，主流的访问方式主要有句柄和直接指针两种。

如果使用句柄访问，Java堆中将可能会划分出一块内存作为句柄池，reference中存储的就是对象的句柄地址，而句柄中包含了对象实例数据与类型数据各自具体的地址信息。

如果使用直接指针访问，Java堆中对象的内存布局就必须考虑如何放置访问类型数据的相关信息，reference中存储的直接就是对象地址，如果只是访问对象本身的话，就不需要多一次间接访问的开销。

这两种对象访问方式各有优势，使用句柄的最大好处是reference中存储的是稳定的句柄地址，在对象被移动时只会改变句柄中的实例数据指针，而reference本身不需要被修改。使用直接指针的最大好处就是速度更快，它节省了一次指针定位的时间开销。