# Redis 事务

Redis 的事务使用非常简单，不同于关系数据库，我们无须理解那么多复杂的事务模型，就可以直接使用。不过也正是因为这种简单性，它的事务模型很不严格，这要求我们不能像使用关系数据库的事务一样来使用 Redis。 

## Redis 事务的基本使用

关系数据库事务通常提供 begin、commit 和 rollback。Redis 的事务语义不同：`MULTI` 开始排队，`EXEC` 顺序执行已入队命令，`DISCARD` 只丢弃尚未执行的队列；Redis 不提供执行后的回滚。

```
begin();
try {
    command1();
    command2();
    ....
    commit();
} catch(Exception e) {
    rollback();
} 
```

Redis 在形式上看起来也差不多，分别是 multi/exec/discard。multi 指示事务的开始，exec 指示事务的执行，discard 指示事务的丢弃。 

```
> multi 
OK 
> incr books 
QUEUED 
> incr books 
QUEUED 
> exec 
(integer) 1 
(integer) 2 
```

上面的指令演示了一个完整的事务过程。命令在 `EXEC` 之前不会执行，而是进入服务端的事务队列；服务端收到 `EXEC` 后顺序执行队列并返回各命令结果。执行事务队列期间，其他客户端的命令不会插入该队列中间。这里的“原子”仅指队列不会被其他命令打断，并不表示某条命令运行时报错后能够回滚已经执行的命令。

`QUEUED` 表示命令已进入服务端的事务队列，尚未执行。

## 原子性

事务的原子性是指要么事务全部成功，要么全部失败，那么 Redis 事务执行是原子性的么？ 

下面我们来看一个特别的例子。 

```
> multi 
OK 
> set books iamastring 
QUEUED 
> incr books 
QUEUED 
> set poorman iamdesperate 
QUEUED 
> exec 
1) OK 
2) (error) ERR value is not an integer or out of range 
3) OK 
> get books 
"iamastring" 
>  get poorman 
"iamdesperate"
```

上面的例子是事务执行到中间遇到失败了，因为我们不能对一个字符串进行数学运算，事务在遇到指令执行失败后，后面的指令还继续执行，所以 poorman 的值能继续得到设置。 

因此，Redis 事务具有“命令队列不会被其他客户端命令插入”的执行隔离性，但不具备关系数据库事务常说的失败回滚语义。入队阶段的语法错误会导致整个事务拒绝执行；`EXEC` 阶段的运行时错误只影响对应命令，其余命令仍会继续执行。

## discard(丢弃) 

Redis 为事务提供了一个 discard 指令，用于丢弃事务缓存队列中的所有指令，在 exec 执行之前。

```
> get books (nil) 
> multi 
OK 
> incr books 
QUEUED 
> incr books 
QUEUED 
> discard 
OK 
> get books 
(nil) 
```

我们可以看到 discard 之后，队列中的所有指令都没执行，就好像 multi 和 discard 中间的所有指令从未发生过一样。 

## 优化 

上面的 Redis 事务在发送每个指令到事务缓存队列时都要经过一次网络读写，当一个事务内部的指令较多时，需要的网络 IO 时间也会线性增长。所以通常 Redis 的客户端在执行事务时都会结合 pipeline 一起使用，这样可以将多次 IO 操作压缩为单次 IO 操作。比如我们在使用 Python 的 Redis 客户端时执行事务时是要强制使用 pipeline 的。 

## Watch

考虑到一个业务场景，Redis 存储了我们的账户余额数据，它是一个整数。现在有两个并发的客户端要对账户余额进行修改操作，这个修改不是一个简单的 incrby 指令，而是要对余额乘以一个倍数。Redis 可没有提供 multiplyby 这样的指令。我们需要先取出余额然后在内存里乘以倍数，再将结果写回 Redis。 

这就会出现并发问题，因为有多个客户端会并发进行操作。我们可以通过 Redis 的分布式锁来避免冲突，这是一个很好的解决方案。分布式锁是一种悲观锁，那是不是可以使用乐观锁的方式来解决冲突呢？

Redis 提供了这种 watch 的机制，它就是一种乐观锁。有了 watch 我们又多了一种可以用来解决并发修改的方法。 watch 的使用方式如下： 

```
while True:     
    do_watch()     
    commands()     
    multi()     
    send_commands()     
    try:         
        exec()         
        break     
    except WatchError:         
        continue 
```

watch 会在事务开始之前盯住 1 个或多个关键变量，当事务执行时，也就是服务器收到了 exec 指令要顺序执行缓存的事务队列时，Redis 会检查关键变量自 watch 之后，是否被修改了 (包括当前事务所在的客户端)。如果关键变量被人动过了，exec 指令就会返回 null 回复告知客户端事务执行失败，这个时候客户端一般会选择重试。 

当服务器给 exec 指令返回一个 null 回复时，客户端知道了事务执行是失败的，通常客户端 (redis-py) 都会抛出一个 WatchError 这种错误，不过也有些语言 (jedis) 不会抛出异常，而是通过在 exec 方法里返回一个 null，这样客户端需要检查一下返回结果是否为 null 来确定事务是否执行失败。 

**注意事项**

Redis 禁止在 multi 和 exec 之间执行 watch 指令，而必须在 multi 之前做好盯住关键变量，否则会出错。 

