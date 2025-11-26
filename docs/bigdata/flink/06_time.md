# Flink Time详解

## Time

Stream数据中的Time（时间）分为以下3种。

* Event Time ：事件产生的时间，它通常由事件中的时间戳描述。
* Ingestion Time ：事件进入Flink的时间。
* Processing Time ：事件被处理时当前系统的时间。

这几种时间的对应关系如图所示。

<img src="Flink/img/4d21978d3611c1d6d99c6dd79cbc6821.png" />

我们在Flink的Stream程序中处理数据时，默认使用的是哪个时间呢？如何修改呢？

默认情况下，Flink在Stream程序中处理数据使用的时间是ProcessingTime，想要修改使用时间可以使用setStreamTimeCharacteristic()

## Flink如何处理乱序数据

在使用EventTime处理Stream数据的时候会遇到数据乱序的问题，流处理从Event（事件）产生，流经Source，再到Operator，这中间需要一定的时间。虽然大部分情况下，传输到Operator的数据都是按照事件产生的时间顺序来的，但是也不排除由于网络延迟等原因而导致乱序的产生，特别是使用Kafka的时候，多个分区之间的数据无法保证有序。因此，在进行Window计算的时候，不能无限期地等下去，必须要有个机制来保证在特定的时间后，必须触发Window进行计算，这个特别的机制就是Watermark。Watermark是用于处理乱序事件的。

### Watermark

Watermark可以翻译为水位线，有3种应用场景。

* 有序的Stream中的Watermark
* 无序的Stream中的Watermark
* 多并行度Stream中的Watermark

<img src="Flink/img/6be50c07ca3d5526c596a8d591547eda.png" />

注意：在多并行度的情况下，Watermark会有一个对齐机制，这个对齐机制会取所有Channel中最小的Watermark，图8.5中的14和29这两个Watermark的最终取值为14。

### Watermark的生成方式

通常情况下，在接收到Source的数据后，应该立刻生成Watermark，但是也可以在应用简单的Map或者Filter操作后再生成Watermark。

注意：如果指定多次Watermark，后面指定的值会覆盖前面的值。

Watermark的生成方式有两种。

1. With Periodic Watermarks

* 周期性地触发Watermark的生成和发送，默认是100ms。
* 每隔 N 秒自动向流里注入一个 Watermark，时间间隔由 ExecutionConfig.setAutoWatermarkInterval决定。每次调用getCurrentWatermark方法，如果得到的Watermark不为空并且比之前的大，就注入流中。
* 可以定义一个最大允许乱序的时间，这种比较常用。
* 实现AssignerWithPeriodicWatermarks接口。

2. With Punctuated Watermarks

* 基于某些事件触发Watermark的生成和发送。
* 基于事件向流里注入一个 Watermark，每一个元素都有机会判断是否生成一个Watermark。如果得到的Watermark不为空并且比之前的大，就注入流中。
* 实现AssignerWithPunctuatedWatermarks接口。

第1种方式比较常用。

