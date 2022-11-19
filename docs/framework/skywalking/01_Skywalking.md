# Skywalking 调试环境搭建

## SKywalking工程构建

参考[文档](https://github.com/apache/skywalking/blob/master/docs/en/guides/How-to-build.md)拉取代码并编译工程。

1. 安装`Jdk8+`与`maven 3.6+`
2. 源码拉取。注意，一定通过submodule的方式，直接通过`git clone`拉取之后是无法编译的。关于submobule，可以参考[文档](https://git-scm.com/book/zh/v2/Git-%E5%B7%A5%E5%85%B7-%E5%AD%90%E6%A8%A1%E5%9D%97)

```
git clone --recurse-submodules https://github.com/apache/skywalking.git
cd skywalking/

OR

git clone https://github.com/apache/skywalking.git
cd skywalking/
git submodule init
git submodule update
```

3. 执行`mvn clean package -Dmaven.test.skip`
4. 所有编译后的包在`/dist`目录下。

Skywalking工程比较复杂有很多模块，编译一次耗时会比较就，如果只是想编译一部分工程，可以使用如下选项：

```
mvn package -Pbackend,dist
```

或

```
make build.backend
```

如果开发阶段想仅编译单独一个插件的话，可以：

```
cd plugin_module_dir & mvn clean package
```

如果想编译UI部分，可以：

```
mvn package -Pui,dist
```

或

```
make build.ui
```

### 设置InteliJ IDEA

1. 将工程作为maven项目导入
2. 执行`compile -Dmaven.test.skip=true`编译工程并生成源码（使用了gRPC和protobuf，该部分需要编译后才会产生代码）
3. 将一下目录设置为IDEA的源码目录：
    * `grpc-java` and `java` folders in apm-protocol/apm-network/target/generated-sources/protobuf
    * `grpc-java` and `java` folders in oap-server/server-core/target/generated-sources/protobuf
    * `grpc-java` and `java` folders in oap-server/server-receiver-plugin/receiver-proto/target/generated-sources/fbs
    * `grpc-java` and `java` folders in oap-server/server-receiver-plugin/receiver-proto/target/generated-sources/protobuf
    * `grpc-java` and `java` folders in oap-server/exporter/target/generated-sources/protobuf
    * `grpc-java` and `java` folders in oap-server/server-configuration/grpc-configuration-sync/target/generated-sources/protobuf
    * `grpc-java` and `java` folders in oap-server/server-alarm-plugin/target/generated-sources/protobuf
    * `antlr4` folder in oap-server/oal-grammar/target/generated-sources

## skywalking-java工程构建

skywalking在

```
mvnw.cmd clean package -Dmaven.test.skip=true -Pall
```