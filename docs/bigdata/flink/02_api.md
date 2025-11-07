# Flink常用API

## Flink API的抽象级别分析

Flink中提供了4种不同层次的API，每种API在简洁和易用之间有自己的权衡，适用于不同的场景。目前其中的3种API用得比较多，下面自下向上介绍这4种API。

* 低级API：提供了对时间和状态的细粒度控制，简洁性和易用性较差，主要应用在对一些复杂事件的处理逻辑上。
* 核心API：主要提供了针对流数据和离线数据的处理，对低级API进行了一些封装，提供了filter、sum、max、min等高级函数，简单且易用，所以在工作中应用比较广泛。
* Table API：一般与DataSet或者DataStream紧密关联，首先通过一个DataSet或DataStream创建出一个Table；然后用类似于filter、join或者select关系型转化操作来转化为一个新的Table对象；最后将一个Table对象转回一个DataSet或DataStream。与SQL不同的是，Table API的查询不是一个指定的SQL字符串，而是调用指定的API方法。
* SQL：Flink的SQL集成是基于Apache Calcite的，Apache Calcite实现了标准的SQL，使用起来比其他API更加灵活，因为可以直接使用SQL语句。Table API和SQL可以很容易地结合在一块使用，它们都返回Table对象。

## Flink DataStream的常用API

DataStream API主要分为3块：DataSource、Transformation、Sink。

* DataSource是程序的数据源输入，可以通过StreamExecutionEnvironment.addSource(sourceFunction)为程序添加一个数据源。
* Transformation是具体的操作，它对一个或多个输入数据源进行计算处理，比如Map、FlatMap和Filter等操作。
* Sink是程序的输出，它可以把Transformation处理之后的数据输出到指定的存储介质中。

### DataSource

Flink针对DataStream提供了大量的已经实现的DataSource（数据源）接口，比如下面4种。

1. 基于文件：读取文本文件，文件遵循TextInputFormat逐行读取规则并返回。

```
readTextFile(path)
```

2. 基于Socket：从Socket中读取数据，元素可以通过一个分隔符分开。

```
socketTextStream
```

3. 基于集合：通过Java的Collection集合创建一个数据流，集合中的所有元素必须是相同类型的。

```
fromCollection(Collection)
```

4. 自定义输入

addSource可以实现读取第三方数据源的数据。

也可以自定义数据源，有两种方式实现。

* 通过实现SourceFunction接口来自定义无并行度（也就是并行度只能为1）的数 据源。
* 通过实现ParallelSourceFunction 接口或者继承RichParallelSourceFunction 来自定义有并行度的数据源。

### Transformation

Flink针对DataStream提供了大量的已经实现的算子。

* Map：输入一个元素，然后返回一个元素，中间可以进行清洗转换等操作。
* FlatMap：输入一个元素，可以返回零个、一个或者多个元素。
* Filter：过滤函数，对传入的数据进行判断，符合条件的数据会被留下。
* KeyBy：根据指定的Key进行分组，Key相同的数据会进入同一个分区。
* Reduce：对数据进行聚合操作，结合当前元素和上一次Reduce返回的值进行聚合操作，然后返回一个新的值。
* Aggregations：sum()、min()、max()等。
* Union：合并多个流，新的流会包含所有流中的数据，但是Union有一个限制，就是所有合并的流类型必须是一致的。
* Connect：和Union类似，但是只能连接两个流，两个流的数据类型可以不同，会对两个流中的数据应用不同的处理方法。
* coMap和coFlatMap：在ConnectedStream中需要使用这种函数，类似于Map和flatMap。
* Split：根据规则把一个数据流切分为多个流。
* Select：和Split配合使用，选择切分后的流。

另外，Flink针对DataStream提供了一些数据分区规则，具体如下。

* Random partitioning：随机分区。
```
DataStream.shuffle()
```

* Rebalancing：对数据集进行再平衡、重分区和消除数据倾斜。
```
DataStream.rebalance()
```

* Rescaling：重新调节。
```
DataStream.rescale()
```
Rescaling与Rebalancing的区别为Rebalancing会产生全量重分区，而Rescaling不会。

* Custom partitioning：自定义分区。
```
DataStream.partitionCustom(partitioner, "someKey")
或
DataStream.partitionCustom(partitioner, 0)
```

### Sink

Flink针对DataStream提供了大量的已经实现的数据目的地（Sink），具体如下所示。

* writeAsText()：将元素以字符串形式逐行写入，这些字符串通过调用每个元素的toString()方法来获取。
* print() / printToErr()：打印每个元素的toString()方法的值到标准输出或者标准错误输出流中。
* 自定义输出：addSink可以实现把数据输出到第三方存储介质中。

## Flink DataSet的常用API分析

DataSet API主要可以分为3块来分析：DataSource、Transformation和Sink。

* DataSource是程序的数据源输入。
* Transformation是具体的操作，它对一个或多个输入数据源进行计算处理，比如Map、FlatMap、Filter等操作。
* Sink是程序的输出，它可以把Transformation处理之后的数据输出到指定的存储介质中。

系统提供了一批内置的Connector，它们会提供对应的Sink支持。

也可以自定义Sink，有两种实现方式：

* 实现SinkFunction接口
* 继承RichSinkFunction类

### DataSource

对DataSet批处理而言，较频繁的操作是读取HDFS中的文件数据，因此这里主要介绍两个DataSource组件。

1. 基于集合：主要是为了方便测试使用。

```
fromCollection(Collection)
```

2. 基于文件：基于HDFS中的数据进行计算分析。

```
readTextFile(path)
```

### Transformation

Flink针对DataSet提供了大量的已经实现的算子。

* Map：输入一个元素，然后返回一个元素，中间可以进行清洗转换等操作。
* FlatMap：输入一个元素，可以返回零个、一个或者多个元素。
* MapPartition：类似Map，一次处理一个分区的数据（如果在进行Map处理的时候需要获取第三方资源连接，建议使用MapPartition）。
* Filter：过滤函数，对传入的数据进行判断，符合条件的数据会被留下。
* Reduce：对数据进行聚合操作，结合当前元素和上一次Reduce返回的值进行聚合操作，然后返回一个新的值。
* Aggregations：sum、max、min等。
* Distinct：返回一个数据集中去重之后的元素。
* Join：内连接。
* OuterJoin：外链接。
* Cross：获取两个数据集的笛卡尔积。
* Union：返回两个数据集的总和，数据类型需要一致。
* First-n：获取集合中的前N个元素。
* Sort Partition：在本地对数据集的所有分区进行排序，通过sortPartition()的链接调用来完成对多个字段的排序。

Flink针对DataSet提供了一些数据分区规则，具体如下。

* Rebalance：对数据集进行再平衡、重分区以及消除数据倾斜操作。
* Hash-Partition：根据指定Key的散列值对数据集进行分区。
* Range-Partition：根据指定的Key对数据集进行范围分区。
* Custom Partitioning：自定义分区规则，自定义分区需要实现Partitioner接口。

### Sink

Flink针对DataSet提供了大量的已经实现的Sink。

* writeAsText()：将元素以字符串形式逐行写入，这些字符串通过调用每个元素的toString()方法来获取。
* writeAsCsv()：将元组以逗号分隔写入文件中，行及字段之间的分隔是可配置的，每个字段的值来自对象的toString()方法。
* print()：打印每个元素的toString()方法的值到标准输出或者标准错误输出流中。

## Flink Table API和SQL的分析及使用

Flink针对标准的流处理和批处理提供了两种关系型API：Table API和SQL。Table API允许用户以一种很直观的方式进行select、filter和join操作；Flink SQL支持基于 Apache Calcite实现的标准SQL。针对批处理和流处理可以提供相同的处理语义和结果。

Flink Table API、SQL接口和Flink的DataStream API、DataSet API是紧密联系在一起的。

Table API和SQL是关系型API，用户可以像操作MySQL数据库表一样来操作数据，而不需要通过编写Java代码来完成Flink Function，更不需要手工为Java代码调优。另外，SQL作为一个非程序员可操作的语言，学习成本很低，如果一个系统提供SQL支持，将很容易被用户接受。

### Table API和SQL的基本使用

想使用Table API和SQL，首先要创建一个TableEnvironment。TableEnvironment对象是Table API和SQL集成的核心，通过TableEnvironment可以实现以下功能。

* 通过内部目录创建表。
* 通过外部目录创建表。
* 执行SQL查询。
* 注册一个用户自定义的Function。
* 把DataStream或者DataSet转换成Table。
* 持有ExecutionEnvironment或者StreamExecutionEnvironment的引用。

一个查询中只能绑定一个指定的TableEnvironment，TableEnvironment可以通过TableEnvironment.getTableEnvironment()或者TableConfig来生成。TableConfig可以用来配置TableEnvironment或者自定义查询优化。

如何创建一个TableEnvironment对象?具体实现代码如下。

```
//流数据查询
StreamExecutionEnvironment sEnv = StreamExecutionEnvironment.getExecutionEnvironment();
StreamTableEnvironment sTableEnv = TableErnvironment.getTableEnvironment(sEnv)
//批数据查询
ExecutionEnvironment bEnv = ExecutionEnvironment.getExecutionEnvironment()
BatchTableEnvironment bTableEnv = TableEnviromment.getTableEnvironment(bEnv)
```

通过获取到的TableEnvironment对象可以创建Table对象，有两种类型的Table对象：输入Table(Input Table)和输出Table(Output Table)。输入Table可以给Table API和SQL提供查询数据，输出Table可以把Table API和SQL的查询结果发送到外部存储介质中。

输入Table可以通过多种数据源注册。

* 已存在的Table对象：通常是Table API和SQL的查询结果。
* TableSource：通过它可以访问外部数据，比如文件、数据库和消息队列。
* DataStream或DataSet。

输出Table需要使用TableSink注册。

下面演示如何通过TableSource注册一个Table。

```
StreamExecutionEnvironment env = StreamExecutionEnvironment.getexecutionEnvironment();
StreamTableEnvironment tableEnv = TableEnviromment.getTableEnvironment(env)
//创建一个TableSource
TableSource csvSource = new CsvTableSource("/jpath/to/file", ....)
//注册一个TableSource,称为CvsTable
tableEnv.registerTableSource ("CsvTable", csvSopurce)
```

接下来演示如何通过TableSink把数据写到外部存储介质中。

```
StreamExecutionEnvironment env = StreamExecutionEnvironment.getexecutionEnvironment();
StreamTableEnvironment tableEnv = TableEnvironment.getTableEnvironment(env)
//创建一个TableSink
TableSink csvSink = new CsvTableSink("/path/to/file", ...);
//定义字段名称和类型
String[] fieldNames = {"a", "b", "c"};
TypeInformation[] fieldTypes = {Types.INT, Tyypes.STRING, Types.LONG}
//注册一个Tablesink,称为CsvSinkTable
tableEnv.registerTableSink("CsvSinkTable", fieldNames, fieldTypes, csvSink)
```

我们知道了如何通过TableSource读取数据和通过TableSink写出数据,下面介绍如何查询Table中的数据。

1.使用Table API

```
StreamExecutionEnvironment env = StreamExecutiionEnvironment.getExecutionEnvironment()
StreamTableEnvironment tableEnv = TableEnvironment.getTableEnvironment(env);
//注册一个Orders表
//通过scan操作获取到一个Table对象
Table orders = tableEnv.scan("Orders");
//计算所有来自法国的收入
Table revenue = orders
    .filter("cCountry=== 'FRANCE'")
    .groupBy("cID, cName")
    .select("cID, cName, revenue.sum AS revSum");
```

1.使用SQL

```
StreamExecutionEnvironment env = StreamExecuttionEnvironment.getExecutionEnvironment()
StreamTableEnvironment tableEnv = TableEnvironment.getTableEnvironment(env);
//注册一个Orders表
//计算所有来自法国的收入
Table revenue = tableEnv.sqlQuery(
    "SELECT CID, cName, SUM(revenue) AS revSum" +
    "FROM Orders " +
    "WHERE cCountry = 'FRANCE' " +
    "GROUP BY CID, cName"
);
```


### DataStream、DataSet和Table之间的转换

Table API和SQL查询可以很容易地和DataStream、DataSet程序集成到一起。通过一个TableEnvironment，可以把DataStream或者DataSet注册为Table，这样就可以使用Table API和SQL查询了。通过TableEnvironment 也可以把Table对象转换为DataStream或者DataSet，这样就能够使用DataStream或者DataSet中的相关API了。

## Flink支持的DataType分析

Flink支持Java和Scala中的大部分数据类型。

* Java Tuple和Scala Case Class。
* Java POJO：Java实体类。
* Primitive Type：默认支持Java和Scala基本数据类型。
* General Class Type：默认支持大多数Java和Scala Class。
* Hadoop Writable：支持Hadoop中实现了org.apache.Hadoop.Writable的数据类型。
* Special Type：比如Scala中的Either Option和Try。

## Flink序列化分析

Flink自带了针对诸如Int、Long和String等标准类型的序列化器。

如果Flink无法实现序列化的数据类型，我们可以交给Avro和Kryo。

* 使用Avro序列化：env.getConfig().enableForceAvro();。
* 使用Kryo序列化：env.getConfig().enableForceKryo();。
* 使用自定义序列化：env.getConfig().addDefaultKryoSerializer(Class<?> type, Class<? extendsSerializer<?>> serializerClass);。