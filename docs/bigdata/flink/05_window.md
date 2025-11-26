# Flink窗口详解

## Window

Flink认为Batch是Streaming的一个特例，因此Flink底层引擎是一个流式引擎，在上面实现了流处理和批处理。而Window就是从Streaming到Batch的桥梁。

通常来讲，Window就是用来对一个无限的流设置一个有限的集合，从而在有界的数据集上进行操作的一种机制。

比如，对流中的所有元素进行计数是不可能的，因为通常流是无限的（无界的）。因此，流上的聚合需要由Window来划定范围，比如“计算过去的5min”或者“最后100个元素的和”。

Window可以由时间（Time Window）（如每30s）或者数据（Count Window）（如每100个元素）驱动。DataStream API提供了Time和Count的Window。同时，由于某些特殊的需要，DataStream API也提供了定制化的Window操作，供用户自定义Window。

## Windows的使用

Window根据类型可以分为两种。

* Tumbling Window：滚动窗口，标识窗口内的数据没有重叠

<img src="Flink/img/68f8604c9eaa9aa4abcb41744dbd0113.png" />

* Sliding Window：滑动窗口，表示窗口内的数据有重叠

<img src="Flink/img/2643eb8a1356a0afdf0793083632f1a7.png" />

### Time Window

Time Window是根据时间对数据流进行分组的，它支持Tumbling Window和Sliding Window。

其中timeWindow(Time.minutes(1))方法表示Tumbling窗口的窗口大小为1min，对每1min内的数据进行聚合计算。

timeWindow(Time.minutes(1),Time.seconds(30))方法表示Sliding Window的窗口大小为1min，滑动间隔为30s。就是每隔30s计算最近1min内的数据。

### Count Window

Count Window是根据元素个数对数据流进行分组的，它也支持Tumbling Window和Sliding Window。

其中countWindow(100)方法表示Tumbling Window的窗口大小是100个元素，当窗口中填满100个元素的时候，就会对窗口进行计算。

countWindow(100,10)方法表示Sliding Window的窗口大小是100个元素，滑动的间隔为10个元素，也就是说每新增10个元素就会对前面100个元素计算一次。

### 自定义Window

自定义 Window 可以分为两种：一种是基于 Key 的 Window，一种是不基于 Key 的Window。

* .keyBy(...).widow(...) ：属于基于Key的Window，会先对窗口中的数据进行分组，然后再聚合。
* .windowAll(...) ：属于不基于Key的Window，会对窗口所有数据进行聚合。

## Window聚合分类

Window聚合操作分为两种：一种是增量聚合，一种是全量聚合。增量聚合是指窗口每进入一条数据就计算一次，而全量聚合是指在窗口触发的时候才会对窗口内的所有数据进行一次计算。

### 增量聚合

常见的增量聚合函数如下。

* reduce(reduceFunction)
* aggregate(aggregateFunction)
* sum()
* min()
* max()

### 全量聚合

全量聚合指当属于窗口的数据到齐，才开始进行聚合计算，可以实现对窗口内的数据进行排序等需求。常见的全量聚合函数为apply(windowFunction)和process(processWindowFunction)。

