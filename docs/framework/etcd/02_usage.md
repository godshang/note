# 基本使用

## 搭建本地集群

从GitHub上下载最新的发布版本，[地址](https://github.com/etcd-io/etcd/releases)。从Release下载的是二进制格式，解压后可以直接启动运行。

```
$ ./etcd
```

## 和etcd交互

`etcdctl`是一个和`etcd`服务器交互的命令行工具。为了向后兼容，etcdctl默认使用V2 API来和etcd服务器通讯。为了让etcdctl使用V3 API，需要通过环境变量设置。

```
$ export ETCDCTL_API=3
```

### 查看版本

```
$ ./etcdctl version
etcdctl version: 3.5.1
API version: 3.5
```

### 写入键

应用通过写入键来储存键到 etcd 中。每个存储的键通过 Raft 协议复制到 etcd 集群的所有成员来实现一致性和可靠性。

这是设置键 foo 的值为 bar 的命令：

```
$ ./etcdctl put foo bar
OK
```

### 读取键

应用可以从 etcd 集群中读取键的值。查询可以读取单个 key，或者某个范围的键。

假设 etcd 集群存储有下面的键：

```
foo = bar
foo1 = bar1
foo2 = bar2
foo3 = bar3
```

这是读取键 foo 的值的命令：

```
$ ./etcdctl get foo
foo
bar
```

这是以16进制格式读取键的值的命令：

```
$ ./etcdctl get foo --hex
\x66\x6f\x6f
\x62\x61\x72
```

这是只读取键 foo 的值的命令：

```
$ ./etcdctl get foo --print-value-only
bar
```

这是范围覆盖从 foo to foo3 的键的命令：

```
$ ./etcdctl get foo foo3
foo
bar
foo1
bar1
foo2
bar2
```

注意 foo3 不在范围之内，因为范围是半开区间 [foo, foo3), 不包含 foo3.

这是范围覆盖以 foo 为前缀的所有键的命令：

```
$ ./etcdctl get --prefix foo
foo
bar
foo1
bar1
foo2
bar2
foo3
bar3
```

这是范围覆盖以 foo 为前缀的所有键的命令，结果数量限制为2：

```
$ ./etcdctl get --prefix --limit=2 foo
foo
bar
foo1
bar1
```

### 读取键过往版本的值

应用可能想读取键的被替代的值。例如，应用可能想通过访问键的过往版本来回滚到旧的配置。或者，应用可能想通过多个请求来得到一个覆盖多个键的统一视图，而这些请求可以通过访问键历史记录而来。因为 etcd 集群上键值存储的每个修改都会增加 etcd 集群的全局修订版本，应用可以通过提供旧有的 etcd 修改版本来读取被替代的键。

注意，版本是全局的，而非某个键的。因此，每次写入操作都会导致版本增加。

```
$ ./etcdctl get --rev=8 foo
foo
world
```

### 删除键

应用可以从 etcd 集群中删除一个键或者特定范围的键。

这是删除键 foo 的命令：

```
$ ./etcdctl del foo
1 # 删除了1个键
```

这是删除从 foo to foo9 范围的键的命令：

```
$ ./etcdctl del foo1 foo9
3 # 删除了3个键
```

这是删除键 zoo 并返回被删除的键值对的命令：

```
$ ./etcdctl del --prev-kv zoo
1
zoo
val
```

这是删除前缀为 zoo 的键的命令：

```
$ ./etcdctl del --prefix zoo
3
```

### 观察键的变化

应用可以观察一个键或者范围内的键来监控任何更新。

这是在键 foo 上进行观察的命令：

```
$ ./etcdctl watch foo

```

执行watch命令后，控制台不会有任何输出。当在另一个终端执行命令后，控制台会打印相应的内容：

```
$ ./etcdctl watch foo
PUT
foo
bar
PUT
foo
yoyo
DELETE
foo
```

这是以16进制格式在键 foo 上进行观察的命令：

```
$ ./etcdctl watch foo --hex
```

这是观察从 foo to foo9 范围内键的命令：

```
$ ./etcdctl watch foo foo9
```

这是观察前缀为 foo 的键的命令:

```
$ ./etcdctl watch --prefix foo
```

这是观察多个键 foo 和 zoo 的命令:

```
$ ./etcdctl watch -i
$ watch foo
$ watch zoo
```

### 观察key的历史改动

应用可能想观察 etcd 中键的历史改动。例如，应用想接收到某个键的所有修改。如果应用一直连接到 etcd，那么 watch 就足够好了。但是，如果应用或者 etcd 出错，改动可能发生在出错期间，这样应用就没能实时接收到这个更新。为了保证更新被交付，应用必须能够观察到键的历史变动。为了做到这点，应用可以在观察时指定一个历史修订版本，就像读取键的过往版本一样。

这是观察历史改动的例子：

```
$ ./etcdctl watch --rev=2 foo
PUT
foo
bar
PUT
foo
bar
PUT
foo
hello
PUT
foo
world
PUT
foo
bar
DELETE
foo

PUT
foo
bar
PUT
foo
yoyo
DELETE
foo

PUT
foo
bar
```

### 压缩修订版本

如我们提到的，etcd 保存修订版本以便应用可以读取键的过往版本。但是，为了避免积累无限数量的历史数据，压缩过往的修订版本就变得很重要。压缩之后，etcd 删除历史修订版本，释放资源来提供未来使用。所有修订版本在压缩修订版本之前的被替代的数据将不可访问。

这是压缩修订版本的命令：

```
$ ./etcdctl compact 4
compacted revision 4
```

### 查看当前版本

tcd 服务器的当前修订版本可以在任何键(存在或者不存在)以json格式使用get命令来找到。下面展示的例子中 mykey 是在 etcd 服务器中不存在的：

```
$ ./etcdctl get mykey -w=json
{"header":{"cluster_id":14841639068965178418,"member_id":10276657743932975437,"revision":22,"raft_term":2}}
```

### 授予租约

应用可以为 etcd 集群里面的键授予租约。当键被附加到租约时，它的存活时间被绑定到租约的存活时间，而租约的存活时间相应的被 time-to-live (TTL)管理。在租约授予时每个租约的最小TTL值由应用指定。租约的实际 TTL 值是不低于最小 TTL，由 etcd 集群选择。一旦租约的 TTL 到期，租约就过期并且所有附带的键都将被删除。

这是授予租约的命令：

```
$ ./etcdctl lease grant 30
lease 694d7cba6fd7a12d granted with TTL(30s)
$ ./etcdctl put --lease=694d7cba6fd7a12d foo bar
OK
```

### 撤销租约

应用通过租约id可以撤销租约。撤销租约将删除所有它附带的key。

这是撤销同一个租约的命令：

```
$ ./etcdctl lease grant 30                      
lease 694d7cba6fd7a134 granted with TTL(30s)
$ ./etcdctl lease revoke 694d7cba6fd7a134
lease 694d7cba6fd7a134 revoked
```

### 维持租约

应用可以通过刷新键的TTL来维持租约，使得租约不过期。

这是维持同一个租约的命令：

```
$ ./etcdctl lease grant 30               
lease 694d7cba6fd7a137 granted with TTL(30s)
$ ./etcdctl lease keep-alive 694d7cba6fd7a137
lease 694d7cba6fd7a137 keepalived with TTL(30)
lease 694d7cba6fd7a137 keepalived with TTL(30)
```

### 获取租约信息

应用程序可能想知道租约信息，以便可以更新或检查租约是否仍然存在或已过期。应用程序也可能想知道有那些键附加到了特定租约。

假设我们完成了下列操作序列：

```
$ ./etcdctl lease grant 500
lease 694d7cba6fd7a13a granted with TTL(500s)
$ ./etcdctl put --lease=694d7cba6fd7a13a foo bar
OK
$ ./etcdctl put --lease=694d7cba6fd7a13a foo1 bar1
OK
```

这是获取租约信息的命令：

```
$ ./etcdctl lease timetolive 694d7cba6fd7a13a
lease 694d7cba6fd7a13a granted with TTL(500s), remaining(454s)
```

这是获取租约信息和租约附带的键的命令：

```
$ ./etcdctl lease timetolive --keys 694d7cba6fd7a13a
lease 694d7cba6fd7a13a granted with TTL(500s), remaining(444s), attached keys([foo foo1])
```