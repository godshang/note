# EventExecutorGroup

## 接口定义

`EventExecutorGroup`定义在`io.netty.util.concurrent`包中，继承自JDK中的`ScheduledExecutorService`，因此可以提供异步任务、定时任务的支持。

```java
package io.netty.util.concurrent;

public interface EventExecutorGroup extends ScheduledExecutorService, Iterable<EventExecutor> {
    ...
}
```

## 优雅关闭

`EventExecutorGroup`相对于JDK中的`ExecutorService`而言，提供了优雅关闭的方式，同时将`shutdown`和`shutdownNow`方法标记为`Deprecated`。

```java
/**
 * Signals this executor that the caller wants the executor to be shut down.  Once this method is called,
 * {@link #isShuttingDown()} starts to return {@code true}, and the executor prepares to shut itself down.
 * Unlike {@link #shutdown()}, graceful shutdown ensures that no tasks are submitted for <i>'the quiet period'</i>
 * (usually a couple seconds) before it shuts itself down.  If a task is submitted during the quiet period,
 * it is guaranteed to be accepted and the quiet period will start over.
 *
 * @param quietPeriod the quiet period as described in the documentation
 * @param timeout     the maximum amount of time to wait until the executor is {@linkplain #shutdown()}
 *                    regardless if a task was submitted during the quiet period
 * @param unit        the unit of {@code quietPeriod} and {@code timeout}
 *
 * @return the {@link #terminationFuture()}
 */
Future<?> shutdownGracefully(long quietPeriod, long timeout, TimeUnit unit);
```

`shutdownGracefully`的方法说明，一旦该方法被调用，`isShuttingDown`方法调用时将会`true`，同时开始尝试关闭`executor`。优雅关闭保证在关闭之前，在静默时间（`quietPeriod`参数指定，通常是几秒中）内没有任务提交，如果在静默期内有任务提交，这个任务会被接收，静默时间会重新开始计算。

## 管理EventExecutor

`EventExecutorGroup`管理了一组`EventExecutor`，二者的关系类似于Java Web中的`FilterChain`和`Filter`。

```java
EventExecutor next();

Iterator<EventExecutor> iterator();
```

`EventExecutorGroup`提供了`next`和`iterator`两个方法用于访问其管理的`EventExecutor`，`next`方法返回其中一个`EventExecutor`，`iterator`则返回一个迭代器进行遍历。

## submit和schedule

`EventExecutorGroup`中也定义了`submit`和`schedule`两组方法，与`ExecutorService`中的基本相同，区别的是`EventExecutorGroup`中的方法返回的是`io.netty.util.concurrent.Future`，而`ExecutorService`中的方法返回的是`java.util.concurrent.Future`。

# EventExecutor

```java
public interface EventExecutor extends EventExecutorGroup {

    EventExecutor next();

    EventExecutorGroup parent();
}
```

`EventExecutor`直接继承自`EventExecutorGroup`，这其实有点费解。按`EventExecutor`类中的注释说法，`EventExecutor`是一种特殊的`EventExecutorGroup`，提供了一些handy method，比如判断一个线程是否在EventLoop中。根本原因应该还是想拥有`EventExecutorGroup`中的任务管理的一些能力。

`EventExecutorGroup`中的`next`方法会返回其管理的一个`EventExecutor`实例。`EventExecutor`也提供了一个`next`方法，但是只返回了自身的引用。

`EventExecutor`的`parent`方法返回的是当前`EventExecutor`所属的`EventExecutorGroup`的实例引用。

## inEventLoop

