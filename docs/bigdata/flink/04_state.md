# Flink State管理与恢复

## State

前面wordcount的例子没有包含状态管理。如果一个Task在处理过程中挂掉了,那么它在内存中的状态都会丢失,所有的数据都需要重新计算。从容错和消息处理的语义
(At-least-once和Exactly-once)上来说,Flink引入了State和CheckPoiint.

这两个概念的区别如下。

* State一般指一个具体的Task/Operator的状态,State数据默认保存在Java的堆内存中。
* 而CheckPoint(可以理解为CheckPoint是把State数据持久化存储了)则表示了一个FlinkJob在一个特定时刻的一份全局状态快照,即包含了所有Task/Operator的状态。

注意:Task是Flink中执行的基本单位,Operator是算子(Transformation)

State可以被记录,在失败的情况下数据还可以恢复。Flink中有以下两种基本类型的State。

* Keyed State
* Operator State

Keyed State和Operator State以两种形式存在。

* 原始状态(Raw State):由用户自行管理状态具体的数数据结构,框架在做CheckPoint的时候,使用byte[]读写状态内容,对其内部数据结构一无所知
* 托管状态(ManagedState):由Flink框架管理的状态。

通常在DataStream上推荐使用托管状态,当实现一个用户自定义的Operator时使用到原始状态。

### Keyed State

Keyed State，顾名思义就是基于KeyedStream上的状态，这个状态是跟特定的Key绑定的。KeyedStreamer流上的每一个Key，都对应一个State。

`stream.keyBy(...)`方法会返回一个KeyedStream对象。

Flink针对KeyedState提供了一下可以保存State的数据结构。

* ValueState<T>：类型为T的单值状态，这个状态与对应的Key绑定，是最简单的状态。它可以通过update方法更新状态值，通过value()方法获取状态值。
* ListState<T>：Key上的状态值为一个列表可以通过add方法往列表中附加值，也可以通过get()方法返回一个Iterable<T>来遍历状态值。
* ReducingState<T>：每次调用add方法添加值的时候，会调用用户传入的reduceFunction，最后合并到一个单一的状态值。
* MapState<UK,UV>：状态值为一个Map，用户通过put或putAll方法添加元素。

需要注意的是,以上所述的State对象,仅仅用于与状态进行交互(更新、删除、清空等),而真正的状态值有可能存在于内存、磁盘或者其他分布式存储系统中,相当于我们只是持有了这个状态的句柄。

### Operator State

Operator State与Key无关,而是与Operator绑定,整个Operator只双时应一个State

Flink针对Operator State提供了以保存State的数据结构。

```
ListState<T> 
```

举例来说,Flink中的Kafka Connector就使用了Operator State,它会在每个Connector实例中,保存该实例消费Topic的所有(partition,offset)映射。

## State的容错

当程序出现问题需要恢复State数据的时候，只有程序提供支持才可以实现State的容错。

State的容错需要依靠CheckPoint机制,这样才可以保证Exactly-once这种语义,但是注意,它只能保证Flink系统内的Exactly-once,比如Flink内置支持的算子。

针对Source和Sink组件,如果想要保证Exactly-once的话,则这些组件本身应支持这种语义。

## CheckPoint

为了保证State的容错性,Flink需要对State进行CheckPoint。CheeckPoint是Flink实现容错机制的核心功能,它能够根据配置周期性地基于Stream中各个Operator/Task的状态来生成快照,从而将这些状态数据定期持久化存储下来。Flink程序一旦意外崩溃,重新运行程序时可以有选择地从这些快照进行恢复,从而修正因为故障带来的程序数据异常。

Flink的CheckPoint机制可以与Stream和State持久化存储交互的前提有以下两点。

* 需要有持久化的Source,它需要支持在一定时间内重放事件,这种Source的典型例子就是持久化的消息队列(如Apache Kafka、RabbitMQ等)或文件系统(如
HDFS、S3、GFS等)。
* 需要有用于State的持久化存储介质,比如分布式文件系统(如HDFS、S3、GFS等)。

默认情况下,CheckPoint功能是Disabled(禁用)的,使用时需要先开启它。

通过如下代码即可开启。

```
env.enableCheckpointing (1000);
```

完整的参考代码如下。

```
StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
// 每隔1000 ms启动一个检查点(设置CheckPoint的周期)
env.enableCheckpointing(1000);
// 高级选项：
// 设置模式为Exactly-once (这是默认值)
env.getCheckpointConfi g().setCheckpointingMode(CheckpointingMode.EXACTLY_ONCE);
// 确保检查点之间有至少500 ms的间隔(CheckPoint最小间隔)
env.getCheckpointConfi g().setMinPauseBetweenCheckpoints(500);
// 检查点必须在1min内完成，或者被丢弃(CheckPoint的超时时间)
env.getCheckpointConfi g().setCheckpointTimeout(60000);
// 同一时间只允许操作一个检查点
env.getCheckpointConfi g().setMaxConcurrentCheckpoints(1);
// 表示一旦 Flink 处理程序被 cancel 后，会保留 CheckPoint 数据，以便根据实际需要恢复到指定的
CheckPoint
env.getCheckpointConfig().enableExternalizedCheckpoints(ExternalizedCheckpointClean
up.RETAIN_ON_CANCELLATION);
```

注意：enableExternalizedCheckpoints()方法中可以接收以下两个参数。

* ExternalizedCheckpointCleanup.RETAIN_ON_CANCELLATION ：表示一旦Flink处理程序被cancel后，会保留CheckPoint数据，以便根据实际需要恢复到指定的CheckPoint。
* ExternalizedCheckpointCleanup.DELETE_ON_CANCELLATION ：表示一旦Flink处理程序被cancel后，会删除CheckPoint数据，只有Job执行失败的时候才会保存CheckPoint。

当CheckPoint机制开启之后，默认的CheckPointMode是Exactly-once，CheckPointMode有两种选项：Exactly-once和At-least-once。

Exactly-once对于大多数应用来说是合适的，At-least-once可能用在某些延迟超低的应用程序（始终延迟为几毫秒）上。

## StateBackend

默认情况下，State会保存在TaskManager的内存中，CheckPoint会存储在JobManager的内存中。State和CheckPoint的存储位置取决于StateBackend的配置。Flink一共提供了3种StateBackend。

1． MemoryStateBackend

State数据保存在Java堆内存中，执行CheckPoint的时候，会把State的快照数据保存到JobManager的内存中。基于内存的StateBackend在生产环境下不建议使用。

2． FsStateBackend

State数据保存在TaskManager的内存中，执行CheckPoint的时候，会把State的快照数据保存到配置的文件系统中，可以使用HDFS等分布式文件系统。

3． RocksDBStateBackend

RocksDB跟上面的都略有不同，它会在本地文件系统中维护状态，State会直接写入本地RocksDB中。同时它需要配置一个远端的FileSystem URI（一般是HDFS），在进行CheckPoint的时候，会把本地的数据直接复制到远端的FileSystem中。Fail Over（故障切换）的时候直接从远端的Filesystem中恢复数据到本地。RocksDB克服了State受内存限制的缺点，同时又能够持久化到远端文件系统中，推荐在生产中使用。

## Restart Strategy

Flink支持不同的Restart Strategy（重启策略），以便在故障发生时控制作业重启。集群在启动时会伴随一个默认的重启策略，在没有定义具体重启策略时会使用该默认策略；如果在任务提交时指定了一个重启策略，该策略会覆盖集群的默认策略。

默认的重启策略是通过Flink的配置文件flink-conf.yaml中的restart-strategy参数指定的。

常用的重启策略有以下3种。

* 固定间隔（Fixed delay）。
* 失败率（Failure rate）。
* 无重启（No restart）。

如果没有启用CheckPoint，则使用无重启策略。如果启用了CheckPoint，但没有配置重启策略，则使用固定间隔策略，其中Integer.MAX_VALUE参数是允许尝试重启的次数。

重启策略可以在flink-conf.yaml中配置，这属于全局配置，也可以在某个任务代码中动态指定，且只对这个任务有效，会覆盖全局的配置。

## SavePoint

Flink通过SavePoint功能可以升级程序，然后继续从升级前的那个点开始执行计算，保证数据不中断。SavePoint 可以生成全局、一致性的快照，也可以保存数据源、Offset、Operator操作状态等信息，还可以从应用在过去任意做了SavePoint的时刻开始继续执行。

那么这个SavePoint和我们前面说的CheckPoint有什么区别呢？

1． CheckPoint

应用定时触发，用于保存状态，它会过期，在内部应用失败重启的时候使用。

2． SavePoint

用户手动执行，是指向CheckPoint的指针，它不会过期，一般在升级的情况下使用。

