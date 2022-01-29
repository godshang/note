# Kafka 实战

## producer无消息丢失配置

Kafka Java版本的producer采用异步发送机制。send方法仅仅把消息放入缓冲区，由一个专属I/O线程负责从缓冲区中提取消息并封装仅消息batch中，然后发送出去。这个过程中存在数据丢失的窗口：若I/O线程发送之前producer崩溃，则存储缓冲区中的消息全部丢失了。

producer另一个问题就是消息的乱序。假设客户端一次发送两条消息到相同的分区，若此时由于某些原因，比如瞬时的网络抖动，导致第一条消息未发送成功，同时Kafka又配置了重试机制以及`max.in.flight.requests.per.connection`大于1（默认值是5），那么producer重试第一条消息成功后，第一条消息在日志中的位置反而位于第二条消息之后，这就造成了消息的乱序，而很多场景中都有事件强顺序保证的要求。

使用同步发送可以规避第一个问题，但性能会很差，并不推荐在实际场景中使用。因此最后能够使用异步方式的同时还能有效避免数据丢失，即使producer崩溃也不会有问题。

producer端无消息丢失配置如下：

* block.on.buffer.full = true
* acks = all or -1
* retries = Integer.MAX_VALUE
* max.in.flight.requests.per.connection = 1
* 使用带回调机制的send发送消息，即 KafkaProducer.send(record, callback)
* Callback逻辑中显式地关闭producer，使用 close(0)
* unclean.leader.election.enable = false
* replication.factor = 3
* min.insync.replicas = 2
* replication.factor > min.insync.replicas
* enable.auto.commit = false

下面分别从producer端和broker端分别讨论上述参数这样设置的含义。

### producer端配置

**block.on.buffer.full = true**

实际上这个参数在0.9.0.0版本已经被标记为deprecated，并使用`max.block.ms`参数替代，但这里还是推荐用户显示地设置它为`true`，使得内存缓冲区被填满时producer处于阻塞状态并停止接收新的消息而不是抛出异常；否则producer生产速度过快会导致耗尽缓冲区。新版本（0.10.0.0之后）可以不用理会这个参数，转而设置`max.block.ms`即可。

**acks = all**

设置acks为all很容易理解，即必须要等到所有follower都响应了发送消息才能被认为提交成功，这是producer端最强程度的持久化保证。

**retries = Integer.MAX_VALUE**

设置成MAX_VALUE有些极端，但其实想表达的是producer要开启无限重试。用户不必担心producer会重试那些肯定无法恢复的错误，当前producer只会城市那些可恢复的异常情况，所以放心地设置一个比较大的值通常能很好地保证消息不丢失。

**max.in.flight.requests.per.connection = 1**

设置该参数为1主要是为了防止topic同分区下的消息乱序问题。这个参数的实际效果其实限制了producer在单个broker连接上能够发送的未响应请求的数量。因此，如果设置成1，则producer在某个broker发送响应之前将无法再给该broker发送PRODUCE请求。

**使用带回调机制的send**

不要使用KafkaProducer中单参数的send方法，因为该send调用仅仅是把消息发出而不会理会消息发送的结果。如果消息发送失败，该方法不会得到任何通知，故可能造成数据的丢失，实际环境中一定要使用带回调机制的send版本。

**Callback逻辑中显示立即关闭producer**

在Callback的失败处理逻辑中显示调用KafkaProducer.close(0)，这样做的目的是为了处理消息的乱序问题。若不使用close(0)，默认情况下producer会被允许将未完成的消息发送出去，这样就有可能造成消息乱序。

### broker端配置

**unclean.leader.election.enable = false**

关闭unclean leader选举，即不允许非ISR中的副本被选举为leader，从而避免broker端音日志水位截断而造成的消息丢失。

**replication.faction >= 3**

设置成3主要是参考Hadoop及业界通用的三副本原则，其实这里主要想强调的一定使用多个副本来保存分区的消息。

**min.insync.replicas > 1**

用于控制某条消息至少被写入到ISR中的多少个副本才算成功。设置成大于1是为了提升producer端发送语义的持久性。记住只有在producer端acks被设置成all或-1时，这个参数才有意义。在实际使用时，不要使用默认值。

**确保replication.factor > min.insync.replicas**

若两者相等，那么只要有一个副本挂掉，分区就无法正常工作，虽然有很高的持久性但可用性被极大地降低了。推荐配置成replication.factor = min.insync.replicas + 1。


## Q1：Kafka是如何保障数据不丢失的？

该问题已经成为了Kafka面试的惯例，如同Java的HashMap，属于高频出现的面试问题。那么，我们该怎么理解这个问题呢？问题是Kafka如何保障数据不丢失，即Kafka的Broker提供了什么机制保证数据不丢失的。其实对于Kafka的Broker而言，Kafka 的复制机制和分区的多副本架构是Kafka 可靠性保证的核心。把消息写入多个副本可以使Kafka 在发生崩溃时仍能保证消息的持久性。搞清楚了问题的核心，再来看一下该怎么回答这个问题：主要包括三个方面

>1.Topic 副本因子个数：replication.factor >= 3
>2.同步副本列表(ISR)：min.insync.replicas = 2
>3.禁用unclean选举：unclean.leader.election.enable=false

下面将会逐步分析上面的三个配置：

**副本因子**

Kafka的topic是可以分区的，并且可以为分区配置多个副本，该配置可以通过replication.factor参数实现。Kafka中的分区副本包括两种类型：领导者副本（Leader Replica）和追随者副本（Follower Replica)，每个分区在创建时都要选举一个副本作为领导者副本，其余的副本自动变为追随者副本。在 Kafka 中，追随者副本是不对外提供服务的，也就是说，任何一个追随者副本都不能响应消费者和生产者的读写请求。所有的请求都必须由领导者副本来处理。换句话说，所有的读写请求都必须发往领导者副本所在的 Broker，由该 Broker 负责处理。追随者副本不处理客户端请求，它唯一的任务就是从领导者副本异步拉取消息，并写入到自己的提交日志中，从而实现与领导者副本的同步。一般来说，副本设为3可以满足大部分的使用场景，也有可能是5个副本(比如银行)。如果副本因子为N，那么在N-1个broker 失效的情况下，仍然能够从主题读取数据或向主题写入数据。所以，更高的副本因子会带来更高的可用性、可靠性和更少的故障。另一方面，副本因子N需要至少N个broker ，而且会有N个数据副本，也就是说它们会占用N倍的磁盘空间。实际生产环境中一般会在可用性和存储硬件之间作出权衡。除此之外，副本的分布同样也会影响可用性。默认情况下，Kafka会确保分区的每个副本分布在不同的Broker上，但是如果这些Broker在同一个机架上，一旦机架的交换机发生故障，分区就会不可用。所以建议把Broker分布在不同的机架上，可以使用broker.rack参数配置Broker所在机架的名称。

**同步副本列表**

In-sync replica(ISR)称之为同步副本，ISR中的副本都是与Leader进行同步的副本，所以不在该列表的follower会被认为与Leader是不同步的。那么，ISR中存在是什么副本呢？首先可以明确的是：Leader副本总是存在于ISR中。而follower副本是否在ISR中，取决于该follower副本是否与Leader副本保持了“同步”。Kafka的broker端有一个参数replica.lag.time.max.ms, 该参数表示follower副本滞后与Leader副本的最长时间间隔，默认是10秒。这就意味着，只要follower副本落后于leader副本的时间间隔不超过10秒，就可以认为该follower副本与leader副本是同步的，所以哪怕当前follower副本落后于Leader副本几条消息，只要在10秒之内赶上Leader副本，就不会被踢出出局。可以看出ISR是一个动态的，所以即便是为分区配置了3个副本，还是会出现同步副本列表中只有一个副本的情况(其他副本由于不能够与leader及时保持同步，被移出ISR列表)。如果这个同步副本变为不可用，我们必须在可用性和一致性之间作出选择(CAP理论)。根据Kafka 对可靠性保证的定义，消息只有在被写入到所有同步副本之后才被认为是已提交的。但如果这里的“所有副本”只包含一个同步副本，那么在这个副本变为不可用时，数据就会丢失。如果要确保已提交的数据被写入不止一个副本，就需要把最小同步副本数量设置为大一点的值。对于一个包含3 个副本的主题分区，如果min.insync.replicas=2，那么至少要存在两个同步副本才能向分区写入数据。如果进行了上面的配置，此时必须要保证ISR中至少存在两个副本，如果ISR中的副本个数小于2，那么Broker就会停止接受生产者的请求。尝试发送数据的生产者会收到NotEnoughReplicasException异常，消费者仍然可以继续读取已有的数据。

**禁用unclean选举**

选择一个同步副本列表中的分区作为leader 分区的过程称为clean leader election。注意，这里要与在非同步副本中选一个分区作为leader分区的过程区分开，在非同步副本中选一个分区作为leader的过程称之为unclean leader election。由于ISR是动态调整的，所以会存在ISR列表为空的情况，通常来说，非同步副本落后 Leader 太多，因此，如果选择这些副本作为新 Leader，就可能出现数据的丢失。毕竟，这些副本中保存的消息远远落后于老 Leader 中的消息。在 Kafka 中，选举这种副本的过程可以通过Broker 端参数unclean.leader.election.enable控制是否允许 Unclean 领导者选举。开启 Unclean 领导者选举可能会造成数据丢失，但好处是，它使得分区 Leader 副本一直存在，不至于停止对外提供服务，因此提升了高可用性。反之，禁止 Unclean Leader 选举的好处在于维护了数据的一致性，避免了消息丢失，但牺牲了高可用性。分布式系统的CAP理论说的就是这种情况。不幸的是，unclean leader election的选举过程仍可能会造成数据的不一致，因为同步副本并不是完全同步的。由于复制是异步完成的，因此无法保证follower可以获取最新消息。比如Leader分区的最后一条消息的offset是100，此时副本的offset可能不是100，这受到两个参数的影响：

* replica.lag.time.max.ms：同步副本滞后与leader副本的时间
* zookeeper.session.timeout.ms：与zookeeper会话超时时间

简而言之，如果我们允许不同步的副本成为leader，那么就要承担丢失数据和出现数据不一致的风险。如果不允许它们成为leader，那么就要接受较低的可用性，因为我们必须等待原先的首领恢复到可用状态。关于unclean选举，不同的场景有不同的配置方式。对数据质量和数据一致性要求较高的系统会禁用这种unclean的leader选举(比如银行)。如果在可用性要求较高的系统里，比如实时点击流分析系统， 一般不会禁用unclean的leader选举。

## Q2：如何解决Kafka数据丢失问题？

你可能会问：这个问题跟Q1有什么区别呢？其实一般在面试问题中可以理解成一个问题。之所以在这里做出区分，是因为两者的解决方式不一样。Q1问题是从Kafka的Broker侧来看待数据丢失的问题，而Q2是从Kafka的生产者与消费者的角度来看待数据丢失的问题。先来看一下如何回答这个问题，主要包括两个方面：

Producer

* retries=Long.MAX_VALUE设置 retries 为一个较大的值。这里的 retries 同样是 Producer 的参数，对应前面提到的 Producer 自动重试。当出现网络的瞬时抖动时，消息发送可能会失败，此时配置了 retries > 0 的 Producer 能够自动重试消息发送，避免消息丢失。
* acks=all设置 acks = all。acks 是 Producer 的一个参数，代表了你对“已提交”消息的定义。如果设置成 all，则表明所有副本 Broker 都要接收到消息，该消息才算是“已提交”。这是最高等级的“已提交”定义。
* max.in.flight.requests.per.connections=1该参数指定了生产者在收到服务器晌应之前可以发送多少个消息。它的值越高，就会占用越多的内存，不过也会提升吞吐量。把它设为1 可以保证消息是按照发送的顺序写入服务器的，即使发生了重试。
* Producer要使用带有回调通知的API，也就是说不要使用 producer.send(msg)，而要使用 producer.send(msg, callback)。
* 其他错误处理使用生产者内置的重试机制，可以在不造成消息丢失的情况下轻松地处理大部分错误，不过 仍然需要处理其他类型的错误，例如消息大小错误、序列化错误等等。

Consumer

* 禁用自动提交：enable.auto.commit=false
* 消费者处理完消息之后再提交offset
* 配置auto.offset.reset这个参数指定了在没有偏移量可提交时(比如消费者第l次启动时)或者请求的偏移量在broker上不存在时(比如数据被删了)，消费者会做些什么。这个参数有两种配置。一种是earliest：消费者会从分区的开始位置读取数据，不管偏移量是否有效，这样会导致消费者读取大量的重复数据，但可以保证最少的数据丢失。一种是latest(默认)，如果选择了这种配置， 消费者会从分区的末尾开始读取数据，这样可以减少重复处理消息，但很有可能会错过一些消息。

## Q3：Kafka可以保障永久不丢失数据吗？

上面分析了一些保障数据不丢失的措施，在一定程度上可以避免数据的丢失。但是请注意：Kafka 只对“已提交”的消息（committed message）做有限度的持久化保证。所以说，Kafka不能够完全保证数据不丢失，需要做出一些权衡。首先，要理解什么是已提交的消息，当 Kafka 的若干个 Broker 成功地接收到一条消息并写入到日志文件后，它们会告诉生产者程序这条消息已成功提交。此时，这条消息在 Kafka 看来就正式变为已提交消息了。所以说无论是ack=all，还是ack=1,不论哪种情况，Kafka 只对已提交的消息做持久化保证这件事情是不变的。其次，要理解有限度的持久化保证，也就是说 Kafka 不可能保证在任何情况下都做到不丢失消息。必须保证Kafka的Broker是可用的，换句话说，假如消息保存在 N 个 Kafka Broker 上，那么这个前提条件就是这 N 个 Broker 中至少有 1 个存活。只要这个条件成立，Kafka 就能保证你的这条消息永远不会丢失。总结一下，Kafka 是能做到不丢失消息的，只不过这些消息必须是已提交的消息，而且还要满足一定的条件。

## Q4：如何保障Kafka中的消息是有序的？

首先需要明确的是：Kafka的主题是分区有序的，如果一个主题有多个分区，那么Kafka会按照key将其发送到对应的分区中，所以，对于给定的key，与其对应的record在分区内是有序的。Kafka可以保证同一个分区里的消息是有序的，即生产者按照一定的顺序发送消息，Broker就会按照这个顺序将他们写入对应的分区中，同理，消费者也会按照这个顺序来消费他们。在一些场景下，消息的顺序是非常重要的。比如，先存钱再取钱与先取钱再存钱是截然不同的两种结果。上面的问题中提到一个参数max.in.flight.requests.per.connections=1,该参数的作用是在重试次数大于等于1时，保证数据写入的顺序。如果该参数不为1，那么当第一个批次写入失败时，第二个批次写入成功，Broker会重试写入第一个批次，如果此时第一个批次重试写入成功，那么这两个批次消息的顺序就反过来了。一般来说，如果对消息的顺序有要求，那么在为了保障数据不丢失，需要先设置发送重试次数retries>0,同时需要把max.in.flight.requests.per.connections参数设为1，这样在生产者尝试发送第一批消息时，就不会有其他的消息发送给broker，虽然会影响吞吐量，但是可以保证消息的顺序。除此之外，还可以使用单分区的Topic，但是会严重影响吞吐量。

## Q5：如何确定合适的Kafka主题的分区数量？

选择合适的分区数量可以达到高度并行读写和负载均衡的目的，在分区上达到均衡负载是实现吞吐量的关键。需要根据每个分区的生产者和消费者的期望吞吐量进行估计。

举个栗子：假设期望读取数据的速率(吞吐量)为1GB/Sec，而一个消费者的读取速率为50MB/Sec，此时至少需要20个分区以及20个消费者(一个消费者组)。同理，如果期望生产数据的速率为1GB/Sec，而每个生产者的生产速率为100MB/Sec，此时就需要有10个分区。在这种情况下，如果设置20个分区，既可以保障1GB/Sec的生产速率，也可以保障消费者的吞吐量。通常需要将分区的数量调整为消费者或者生产者的数量，只有这样才可以同时实现生产者和消费者的吞吐量。

一个简单的计算公式为：分区数 = max(生产者数量，消费者数量)

* 生产者数量=整体生产吞吐量/每个生产者对单个分区的最大生产吞吐量
* 消费者数量=整体消费吞吐量/每个消费者从单个分区消费的最大吞吐量

## Q6：如何调整生产环境中Kafka主题的分区数量？

需要注意的是：当我们增加主题的分区数量时，会违背同一个key进行同一个分区的事实。我们可以创建一个新的主题，使得该主题有更多的分区数，然后暂停生产者，将旧的主题中的数据复制到新的主题中，然后将消费者和生产者切换到新的主题，操作起来会非常棘手。

## Q7:如何重平衡Kafka集群？

在下面情况发生时，需要重平衡集群：

* 主题分区在整个集群里的不均衡分布造成了集群负载的不均衡。
* broker离线造成分区不同步。
* 新加入的broker 需要从集群里获得负载。

使用kafka-reassign-partitions.sh命令进行重平衡

## Q8:如何查看消费者组是否存在滞后消费？

我们可以使用kafka-consumer-groups.sh命令进行查看，比如：

```
$ bin/kafka-consumer-groups.sh --bootstrap-server cdh02:9092 --describe --group my-group
## 会显示下面的一些指标信息
TOPIC PARTITION CURRENT-OFFSET LOG-END-OFFSET   LAG          CONSUMER-ID HOST CLIENT-ID
主题   分区       当前offset      LEO           滞后消息数       消费者id     主机   客户端id
```

一般情况下，如果运行良好，CURRENT-OFFSET的值会与LOG-END-OFFSET的值非常接近。通过这个命令可以查看哪个分区的消费出现了滞后。

## Q9：什么是ISR？

ISR是Kafka集群动态维护的一组同步副本集，每个topic分区都有自己的ISR列表，ISR中的所有副本都与leader副本保持同步状态，并且leader副本总是包含在ISR中的，只有ISR中的副本才有资格被选举为leader。

ISR中关于同步的判定，在新老版本之中不同。在0.9.0.0版本之前，使用`replica.lag.max.messages`参数设置follower副本落后与leader副本的消息数，一旦超过了这个消息数就认为该follower副本为不同步的状态，从而被Kafka踢出ISR。

可能follower与leader不同步的原因主要有3个：

* 请求速度追不上：follower副本在一段时间内都无法追上leader副本端的消息接收速度，比如follower副本所在的broker的网络I/O开销过大导致备份消息的速度持续慢于从leader处获取消息的速度。
* 进程卡住：follower在一段时间无法向leader请求数据，比如GC或程序bug等。
* 新创建的副本：如果用户增加了副本数，那么新创建的follower副本在启动后全力追赶leader进度，在追赶进度这段时间内通常都是与leader不同步的。

`replica.lag.max.messages`是用于检测第一种情况的。`replica.lag.time.max.ms`用于检测另外联众情况，表示超过设定的时间则被视为不同步，就会被踢出ISR。

0.9.0.0版本之前的这种ISR设计方案有一些缺陷，比如突然有一波消息生产的瞬时高峰流量，是得消息数大于等于了`replica.lang.max.messages`的值，此时follower副本就会被认为与leader副本不同步，从而被踢出ISR。然而follower副本所在broker实际上都处于存活状态且没有任何性能问题，等到追上leader的LEO就重新加入了ISR——于是就出现了它们不断被踢出ISR，然后又重新加回ISR的情况。

另外，`replica.lag.max.messages`这个参数是全局的，如果设置过大，不同topic的流量差异又非常大的情况，就会出现低流量的topic要花费相当长的时间才会被Kafka辨别出滞后。

0.9.0.0版本之后，Kafka去掉了`replica.lag.max.messages`这个参数，改用统一的参数同时检测由于慢以及进程卡壳而导致的之后，即follower副本落后leader副本的时间间隔，这个唯一的参数就是`replica.lag.time.max.ms`，默认值是10秒。

## Q10：Controller是做什么的？

每个Kafka集群任意时刻都只能有一个controller，集群启动时都会参与controller的竞选。Controller包括如下职责：

* 更新集群元数据信息
* 创建topic
* 删除topic
* 分区重分配
* preferred leader副本选举
* topic分区扩展
* broker加入集群
* broker崩溃
* 受控关闭
* controller leader选举
