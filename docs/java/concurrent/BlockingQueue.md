# BlockingQueue 源码分析

阻塞队列（BlockingQueue）是 Java 5 并发新特性中的内容，阻塞队列的接口是 java.util.concurrent.BlockingQueue，它提供了两个附加操作：当队列中为空时，从队列中获取元素的操作将被阻塞；当队列满时，向队列中添加元素的操作将被阻塞。

阻塞队列常用于生产者和消费者的场景，生产者是往队列里添加元素的线程，消费者是从队列里拿元素的线程。阻塞队列就是生产者存放元素的容器。

阻塞队列提供了四种操作方法：

<table BORDER CELLPADDING=3 CELLSPACING=1>
 <tr>
   <td></td>
   <td ALIGN=CENTER><em>Throws exception</em></td>
   <td ALIGN=CENTER><em>Special value</em></td>
   <td ALIGN=CENTER><em>Blocks</em></td>
   <td ALIGN=CENTER><em>Times out</em></td>
 </tr>
 <tr>
   <td><b>Insert</b></td>
   <td>add(e)</td>
   <td>offer(e)</td>
   <td>put(e)</td>
   <td>offer(e, time, unit)</td>
 </tr>
 <tr>
   <td><b>Remove</b></td>
   <td>remove()</td>
   <td>poll()</td>
   <td>take()</td>
   <td>poll(time, unit)</td>
 </tr>
 <tr>
   <td><b>Examine</b></td>
   <td>element()</td>
   <td>peek()</td>
   <td><em>not applicable</em></td>
   <td><em>not applicable</em></td>
 </tr>
</table>

* 抛出异常：当队列满时，再向队列中插入元素，则会抛出IllegalStateException异常。当队列空时，再向队列中获取元素，则会抛出NoSuchElementException异常。
* 返回特殊值：当队列满时，向队列中添加元素，则返回false，否则返回true。当队列为空时，向队列中获取元素，则返回null，否则返回元素。
* 一直阻塞：当阻塞队列满时，如果生产者向队列中插入元素，则队列会一直阻塞当前线程，直到队列可用或响应中断退出。当阻塞队列为空时，如果消费者线程向阻塞队列中获取数据，则队列会一直阻塞当前线程，直到队列空闲或响应中断退出。
* 超时退出：当队列满时，如果生产线程向队列中添加元素，则队列会阻塞生产线程一段时间，超过指定的时间则退出返回false。当队列为空时，消费线程从队列中移除元素，则队列会阻塞一段时间，如果超过指定时间退出返回null。

JDK6提供了6个阻塞队列。分别是：

1.	ArrayBlockingQueue：是一个用数组实现的有界阻塞队列，此队列按照先进先出（FIFO）的原则对元素进行排序。支持公平锁和非公平锁。【注：每一个线程在获取锁的时候可能都会排队等待，如果在等待时间上，先获取锁的线程的请求一定先被满足，那么这个锁就是公平的。反之，这个锁就是不公平的。公平的获取锁，也就是当前等待时间最长的线程先获取锁】
2.	LinkedBlockingQueue：一个由链表结构组成的有界队列，此队列的长度为Integer.MAX_VALUE。此队列按照先进先出的顺序进行排序。
3.	PriorityBlockingQueue： 一个支持线程优先级排序的无界队列，默认自然序进行排序，也可以自定义实现compareTo()方法来指定元素排序规则，不能保证同优先级元素的顺序。
4.	DelayQueue： 一个实现PriorityBlockingQueue实现延迟获取的无界队列，在创建元素时，可以指定多久才能从队列中获取当前元素。只有延时期满后才能从队列中获取元素。（DelayQueue可以运用在以下应用场景：1.缓存系统的设计：可以用DelayQueue保存缓存元素的有效期，使用一个线程循环查询DelayQueue，一旦能从DelayQueue中获取元素时，表示缓存有效期到了。2.定时任务调度。使用DelayQueue保存当天将会执行的任务和执行时间，一旦从DelayQueue中获取到任务就开始执行，从比如TimerQueue就是使用DelayQueue实现的。）
5.	SynchronousQueue： 一个不存储元素的阻塞队列，每一个put操作必须等待take操作，否则不能添加元素。支持公平锁和非公平锁。SynchronousQueue的一个使用场景是在线程池里。Executors.newCachedThreadPool()就使用了SynchronousQueue，这个线程池根据需要（新任务到来时）创建新的线程，如果有空闲线程则会重复使用，线程空闲了60秒后会被回收。
6.	LinkedBlockingDeque： 一个由链表结构组成的双向阻塞队列。队列头部和尾部都可以添加和移除元素，多线程并发时，可以将锁的竞争最多降到一半。

## ArrayBlockingQueue

ArrayBlockingQueue的原理就是使用一个可重入锁和这个锁生成的两个条件对象进行并发控制(classic two-condition algorithm)。

ArrayBlockingQueue是一个带有长度的阻塞队列，初始化的时候必须要指定队列长度，且指定长度之后不允许进行修改。

### 构造方法

```java
public ArrayBlockingQueue(int capacity) { ... }
public ArrayBlockingQueue(int capacity, boolean fair) { ... }
public ArrayBlockingQueue(int capacity, boolean fair, Collection<? extends E> c) { ... }
```

ArrayBlockingQueue提供了三种构造方法，参数含义如下：
* capacity：容量，即队列大小。
* fair：是否公平锁。
* c：队列初始化元素，顺序按照Collection遍历顺序。

### 入队方法

```java
public void put(E e) throws InterruptedException {
    if (e == null) throw new NullPointerException();
    final E[] items = this.items;
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        try {
            while (count == items.length)
                notFull.await();
        } catch (InterruptedException ie) {
            notFull.signal(); // propagate to non-interrupted thread
            throw ie;
        }
        insert(e);
    } finally {
        lock.unlock();
    }
}

private void insert(E x) {
    items[putIndex] = x;
    putIndex = inc(putIndex);
    ++count;
    notEmpty.signal();
}
```

生产者首先获得锁lock，然后判断队列是否已经满了，如果满了，则等待，直到被唤醒，然后调用insert插入元素。

而对于非阻塞的方法来说，并没有使用到条件对象，而是直接根据内部容器是否已满，来决定是否插入新元素。

```java
public boolean offer(E e) {
    if (e == null) throw new NullPointerException();
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        if (count == items.length)
            return false;
        else {
            insert(e);
            return true;
        }
    } finally {
        lock.unlock();
    }
}

public boolean add(E e) {
    if (offer(e))
        return true;
    else
        throw new IllegalStateException("Queue full");
}
```

### 出队方法

```java
public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        try {
            while (count == 0)
                notEmpty.await();
        } catch (InterruptedException ie) {
            notEmpty.signal(); // propagate to non-interrupted thread
            throw ie;
        }
        E x = extract();
        return x;
    } finally {
        lock.unlock();
    }
}

private E extract() {
    final E[] items = this.items;
    E x = items[takeIndex];
    items[takeIndex] = null;
    takeIndex = inc(takeIndex);
    --count;
    notFull.signal();
    return x;
}
```

消费者首先获得锁，然后判断队列是否为空，为空，则等待，直到被唤醒，然后调用extract获取元素。

同插入类似，非阻塞版本的方法未使用条件对象：

```java
public E poll() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        if (count == 0)
            return null;
        E x = extract();
        return x;
    } finally {
        lock.unlock();
    }
}

public E remove() {
    E x = poll();
    if (x != null)
        return x;
    else
        throw new NoSuchElementException();
}
```

## LinkedBlockingQueue

LinkedBlockingQueue是一个使用链表完成队列操作的阻塞队列。链表是单向链表，而不是双向链表。

内部使用放锁和拿锁，这两个锁实现阻塞("two lock queue" algorithm)。ArrayBlockingQueue只有1个锁，添加数据和删除数据的时候只能有1个被执行，不允许并行执行。而LinkedBlockingQueue有2个锁，放锁和拿锁，添加数据和删除数据是可以并行进行的，当然添加数据和删除数据的时候只能有1个线程各自执行。

### 构造方法

```java
public LinkedBlockingQueue() { ... }
public LinkedBlockingQueue(int capacity) { ... }
public LinkedBlockingQueue(Collection<? extends E> c) { ... }
```

如果不指定队列的容量大小，也就是使用默认的Integer.MAX_VALUE，如果存在添加速度大于删除速度时候，有可能会内存溢出，这点在使用前希望慎重考虑。

### 入队方法

LinkedBlockingQueue有几个不同的数据添加方法，put、offer方法。

#### put方法

```java
public void put(E e) throws InterruptedException {
    if (e == null) throw new NullPointerException();
    // Note: convention in all put/take/etc is to preset local var
    // holding count negative to indicate failure unless set.
    int c = -1;
    final ReentrantLock putLock = this.putLock;
    final AtomicInteger count = this.count;
    putLock.lockInterruptibly();
    try {
        /*
        * Note that count is used in wait guard even though it is
        * not protected by lock. This works because count can
        * only decrease at this point (all other puts are shut
        * out by lock), and we (or some other waiting put) are
        * signalled if it ever changes from
        * capacity. Similarly for all other uses of count in
        * other wait guards.
        */
        while (count.get() == capacity) { 
                notFull.await();
        }
        enqueue(e);
        c = count.getAndIncrement();
        if (c + 1 < capacity)
            notFull.signal();
    } finally {
        putLock.unlock();
    }
    if (c == 0)
        signalNotEmpty();
}
```

put方法中如果队列已满，那么阻塞等待；如果队列未满，那么创建一个节点加入到队列中，如果放完以后队列还有剩余空间，继续唤醒下一个添加线程进行添加。如果放之前队列中没有元素，放完以后要唤醒消费线程进行消费。

ArrayBlockingQueue中放入数据阻塞的时候，需要消费数据才能唤醒。而LinkedBlockingQueue中放入数据阻塞的时候，因为它内部有2个锁，可以并行执行放入数据和消费数据，不仅在消费数据的时候进行唤醒插入阻塞的线程，同时在插入的时候如果容量还没满，也会唤醒插入阻塞的线程。

接下来我们看看signalNotEmpty，顺带着看signalNotFull方法。

```java
private void signalNotEmpty() {
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lock();
    try {
        notEmpty.signal();
    } finally {
        takeLock.unlock();
    }
}

private void signalNotFull() {
    final ReentrantLock putLock = this.putLock;
    putLock.lock();
    try {
        notFull.signal();
    } finally {
        putLock.unlock();
    }
}
```

为什么要这么写？因为signal的时候要获取到该signal对应的Condition对象的锁才行。

#### offer 方法

```java
public boolean offer(E e) {
    if (e == null) throw new NullPointerException();
    final AtomicInteger count = this.count;
    if (count.get() == capacity)
        return false;
    int c = -1;
    final ReentrantLock putLock = this.putLock;
    putLock.lock();
    try {
        if (count.get() < capacity) {
            enqueue(e);
            c = count.getAndIncrement();
            if (c + 1 < capacity)
                notFull.signal();
        }
    } finally {
        putLock.unlock();
    }
    if (c == 0)
        signalNotEmpty();
    return c >= 0;
}
```

offer仅仅对put方法改动了一点点，当队列没有可用元素的时候，不同于put方法的阻塞等待，offer方法直接方法false。

### 出队方法

LinkedBlockingQueue有不同的几个数据删除方法，take、poll方法。

#### take 方法

```java
public E take() throws InterruptedException {
    E x;
    int c = -1;
    final AtomicInteger count = this.count;
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lockInterruptibly();
    try {
        while (count.get() == 0) {
            notEmpty.await();
        }
        x = dequeue();
        c = count.getAndDecrement();
        if (c > 1)
            notEmpty.signal();
    } finally {
        takeLock.unlock();
    }
    if (c == capacity)
        signalNotFull();
    return x;
}
```

take方法看起来就是put方法的逆向操作。当队列为空，阻塞等待；当队列不为空，从队首获取并移除一个元素，如果消费后还有元素在队列中，继续唤醒下一个消费线程进行元素移除。如果放之前队列是满元素的情况，移除完后要唤醒生产线程进行添加元素。

#### poll 方法

```java
public E poll() {
    final AtomicInteger count = this.count;
    if (count.get() == 0)
        return null;
    E x = null;
    int c = -1;
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lock();
    try {
        if (count.get() > 0) {
            x = dequeue();
            c = count.getAndDecrement();
            if (c > 1)
                notEmpty.signal();
        }
    } finally {
        takeLock.unlock();
    }
    if (c == capacity)
        signalNotFull();
    return x;
}
```

poll方法去除了take方法中元素为空后阻塞等待这一步骤，这里也就不详细说了。

### 获取元素

```java
public E peek() {
    if (count.get() == 0)
        return null;
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lock();
    try {
        Node<E> first = head.next;
        if (first == null)
            return null;
        else
            return first.item;
    } finally {
        takeLock.unlock();
    }
}
```

### 删除元素

```java
public boolean remove(Object o) {
    if (o == null) return false;
    fullyLock();
    try {
        for (Node<E> trail = head, p = trail.next;
                p != null;
                trail = p, p = p.next) {
            if (o.equals(p.item)) {
                unlink(p, trail);
                return true;
            }
        }
        return false;
    } finally {
        fullyUnlock();
    }
}

void fullyLock() {
    putLock.lock();
    takeLock.lock();
}

void fullyUnlock() {
    takeLock.unlock();
    putLock.unlock();
}
```

因为remove方法使用两个锁全部上锁，所以其他操作都需要等待它完成，而该方法需要从head节点遍历到尾节点，所以时间复杂度为O(n)。我们来看看unlink方法。

```java
void unlink(Node<E> p, Node<E> trail) {
    // assert isFullyLocked();
    // p.next is not changed, to allow iterators that are
    // traversing p to maintain their weak-consistency guarantee.
    p.item = null;
    trail.next = p.next;
    if (last == p)
        last = trail;
    if (count.getAndDecrement() == capacity)
        notFull.signal();
}
```

### 小结

LinkedBlockingQueue是一个阻塞队列，内部由两个ReentrantLock来实现出入队列的线程安全，由各自的Condition对象的await和signal来实现等待和唤醒功能。它和ArrayBlockingQueue的不同点在于：

* 队列大小有所不同，ArrayBlockingQueue是有界的初始化必须指定大小，而LinkedBlockingQueue可以是有界的也可以是无界的(Integer.MAX_VALUE)，对于后者而言，当添加速度大于移除速度时，在无界的情况下，可能会造成内存溢出等问题。
* 数据存储容器不同，ArrayBlockingQueue采用的是数组作为数据存储容器，而LinkedBlockingQueue采用的则是以Node节点作为连接对象的链表。
* 由于ArrayBlockingQueue采用的是数组的存储容器，因此在插入或删除元素时不会产生或销毁任何额外的对象实例，而LinkedBlockingQueue则会生成一个额外的Node对象。这可能在长时间内需要高效并发地处理大批量数据的时，对于GC可能存在较大影响。
* 两者的实现队列添加或移除的锁不一样，ArrayBlockingQueue实现的队列中的锁是没有分离的，即添加操作和移除操作采用的同一个ReenterLock锁，而LinkedBlockingQueue实现的队列中的锁是分离的，其添加采用的是putLock，移除采用的则是takeLock，这样能大大提高队列的吞吐量，也意味着在高并发的情况下生产者和消费者可以并行地操作队列中的数据，以此来提高整个队列的并发性能。

## Reference

[【细谈Java并发】谈谈LinkedBlockingQueue](http://benjaminwhx.com/2018/05/11/%E3%80%90%E7%BB%86%E8%B0%88Java%E5%B9%B6%E5%8F%91%E3%80%91%E8%B0%88%E8%B0%88LinkedBlockingQueue/)

## PriorityBlockingQueue

PriorityBlockingQueue 是一个无界的阻塞队列，可以视作带有并发控制的PriorityQueue。

PriorityBlockingQueue中不允许添加null元素。由于PriorityBlockingQueue是一个无界队列，使用时要注意避免资源耗尽的情况。另外一点，PriorityBlockingQueue中的比较依赖于元素实现的Comparable接口，因此未实现Comparable接口的元素也无法添加到队列中，会抛出一个ClassCastException异常。

PriorityBlockingQueue在数据结构上与DelayQueue类似，都通过内部的一个PriorityQueue实现优先级队列；在实现上又与ArrayBlockingQueue类似，通过ReentrantLock与其上的一个notEmpty的Condition对象实现，不同之处在于它没有notFull的Condition对象，因为PriorityBlockingQueue是一个无界队列。

### 构造函数

PriorityBlockingQueue提供了4个构造函数，可以创建空队列、创建一个拥有初始容量的队列、从已有集合创建队列、创建一个使用自定义比较器的队列。

PriorityBlockingQueue内部实现依赖使用了PriorityQueue，而PriorityQueue中数据存储使用了数组，同ArrayList类似，添加元素时会引起数组的创建与复制，因此，如果知道队列容量的话，初始化时就创建好会比较节省资源。

```java
public PriorityBlockingQueue() {
    q = new PriorityQueue<E>();
}

public PriorityBlockingQueue(int initialCapacity) {
    q = new PriorityQueue<E>(initialCapacity, null);
}

public PriorityBlockingQueue(int initialCapacity,
                             Comparator<? super E> comparator) {
    q = new PriorityQueue<E>(initialCapacity, comparator);
}

public PriorityBlockingQueue(Collection<? extends E> c) {
    q = new PriorityQueue<E>(c);
}
```

### 内部属性

```java
private final PriorityQueue<E> q;
private final ReentrantLock lock = new ReentrantLock(true);
private final Condition notEmpty = lock.newCondition();
```

### 入队方法

入队方法有add、offer、put方法，add和put方法均通过调用offer方法实现。因为是一个无界队列，所以put方法永远不会阻塞。

```java
public boolean add(E e) {
    return offer(e);
}

public void put(E e) {
    offer(e); // never need to block
}

public boolean offer(E e) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        boolean ok = q.offer(e);
        assert ok;
        notEmpty.signal();
        return true;
    } finally {
        lock.unlock();
    }
}
```

offer方法很简单，在获取锁之后，向内部的PriorityQueue实例添加元素，然后通知等待在notEmpty上的其他线程。

### 出队方法

出队方法有remove、poll、take方法。

```java
public boolean remove(Object o) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        return q.remove(o);
    } finally {
        lock.unlock();
    }
}

public E poll() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        return q.poll();
    } finally {
        lock.unlock();
    }
}

public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        try {
            while (q.size() == 0)
                notEmpty.await();
        } catch (InterruptedException ie) {
            notEmpty.signal(); // propagate to non-interrupted thread
            throw ie;
        }
        E x = q.poll();
        assert x != null;
        return x;
    } finally {
        lock.unlock();
    }
}
```

方法实现的比较简单，都是从PriorityQueue中获取元素。take方法是一个阻塞方法，当队列容量为空时，阻塞在notEmpty上，等待其他线程向队列中添加元素。

## DelayQueue

DelayQueue是一个无界的BlockingQueue，其特化的参数是Delayed。Delayed扩展了Comparable接口，比较的基准为延时的时间值，Delayed接口的实现类getDelay的返回值应为固定值（final）。DelayQueue内部是使用PriorityQueue实现的。

```
DelayQueue = BlockingQueue + PriorityQueue + Delayed
```

DelayQueue的关键元素BlockingQueue、PriorityQueue、Delayed。可以这么说，DelayQueue是一个使用优先队列（PriorityQueue）实现的BlockingQueue，优先队列的比较基准值是时间。

注意：DelayQueue中不允许添加null元素。由于DelayQueue是一个无界队列，使用时要注意避免资源耗尽的情况。

### 入队方法

入队方法有add、offer、put方法，add和put方法均通过调用offer方法实现。因为是一个无界队列，所以put方法永远不会阻塞。

```java
public boolean add(E e) {
    return offer(e);
}

public void put(E e) {
    offer(e);
}

public boolean offer(E e) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        E first = q.peek();
        q.offer(e);
        if (first == null || e.compareTo(first) < 0)
            available.signalAll();
        return true;
    } finally {
        lock.unlock();
    }
}
```

offer方法向内部的PriorityQueue添加元素，同时会检查队列头部的元素是否到期。

### 出队方法

出队方法有remove、poll、take方法。

remove方法直接从队列中移除一个元素。poll方法会判断队首的元素是否到期，如果还未到期会返回空，否则返回队首元素；如果队列不为空，则会通知其他线程来获取元素。take方法在获取不到元素时会一直阻塞。

```java
public boolean remove(Object o) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        return q.remove(o);
    } finally {
        lock.unlock();
    }
}

public E poll() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        E first = q.peek();
        if (first == null || first.getDelay(TimeUnit.NANOSECONDS) > 0)
            return null;
        else {
            E x = q.poll();
            assert x != null;
            if (q.size() != 0)
                available.signalAll();
            return x;
        }
    } finally {
        lock.unlock();
    }
}

public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        for (;;) {
            E first = q.peek();
            if (first == null) {
                available.await();
            } else {
                long delay =  first.getDelay(TimeUnit.NANOSECONDS);
                if (delay > 0) {
                    long tl = available.awaitNanos(delay);
                } else {
                    E x = q.poll();
                    assert x != null;
                    if (q.size() != 0)
                        available.signalAll(); // wake up other takers
                    return x;

                }
            }
        }
    } finally {
        lock.unlock();
    }
}
```