# Flink高级功能的使用

## Flink Broadcast

在讲Broadcast之前需要区分一下DataStream中的Broadcast（分区规则）和Flink中的Broadcast（广播变量）功能。

1. DataStream Broadcast（分区规则）

分区规则是把元素广播给所有的分区，数据会被重复处理，类似于Storm中的allGrouping。

2. Flink Broadcast（广播变量）

广播变量允许编程人员在每台机器上保持一个只读的缓存变量，而不是传送变量的副本给Task。广播变量创建后，它可以运行在集群中的任何Function上，而不需要多次传递给集群节点。另外请记住，不要修改广播变量，这样才能确保每个节点获取到的值都是一致的。

用一句话解释，Broadcast可以理解为一个公共的共享变量。可以把一个DataSet（数据集）广播出去，不同的Task在节点上都能够获取到它，这个数据集在每个节点上只会存在一份。如果不使用Broadcast，则在各节点的每个Task中都需要复制一份DataSet数据集，比较浪费内存（也就是一个节点中可能会存在多份DataSet数据）。

Broadcast的使用步骤如下。

(1)初始化数据。

```
DataSet<Integer> toBroadcast = env.fromElements(1,2,3)
```

(2)广播数据。

```
withBroadcastSet(toBroadcast, "broadecastSetName")
```

(3)获取数据。

```
Collection<Integer>broadcastSet = getRuntimeContext().getBroadcastVariable ("broadcastSetName")
```

在使用Broadcast的时候需要注意以下事项。

* 广播变量存在于每个节点的内存中,它的数据量不能太大,因为广播出去的数据常驻内存,除非程序执行结束。
* 广播变量在初始化广播以后不支持修改,这样才能保证每个节点的数据都是一致的。
* 如果多个算子需要使用同一份数据集,那么需要在对应的多个算子后面分别注册广播变量。
* 广播变量只能在Flink批处理程序中才可以使用。

## Flink Accumulator

Accumulator即累加器,与MapReduce中Counter的应用场景差不多,都能很好地观察Task在运行期间的数据变化。可以在Flink Job的算子函数中使用累加器,但是只有在任务执行结束之后才能获得累加器的最终结果。

Counter是一个具体的累加器实现,常用的Counter有IntCounter、LongCounter和DoubleCounter.

累加器的使用步骤如下。

(1)创建累加器。

```
private IntCounter numLines = new IntCounter();
```

(2)注册累加器。

```
getRuntimeContext().addAccumulator("num-lines", this.numLines);
```

(3)使用累加器。

```
this.numLines.add(1);
```

(4)获取累加器的结果。

```
myJobExecutionResult.getAccumulatorResult("num-lines")
```

注意：只有在任务执行结束后，才能获取累加器的值。

## Flink Broadcast和Accumulator的区别

* Broadcast允许程序员将一个只读的变量缓存在每台机器上，而不用在任务之间传递变量。广播变量可以进行共享,但是不可以进行修改。
* Accumulator可以在不同任务中对同一个变量进行累加操作，但是只有在任务执行结束的时候才能获得累加器的最终结果。

## Flink Distributed Cache

Flink提供了一个分布式缓存(DistributedCache),类似于Hadoop,可以使用户在并行函数中很方便地读取本地文件。

此缓存的工作机制为程序注册一个文件或者目录(本地或或者远程文件系统,如HDFS或者S3),通过ExecutionEnvironment注册缓存文件并为它起一个名称。当程序执行时,Flink自动将文件或者目录复制到所有TaskManager节点的本地文件系统,用户可以通过这个指定的名称查找文件或者目录,然后从TaskManager节点的本地文件系统访问它。

