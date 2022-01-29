# 分布式锁

Redis实现分布式锁一般是使用`setnx`指令，只允许一个客户端占有，先来先占，用完之后使用`del`指令释放锁。

```
> setnx lock_name true
(integer) 1
... do something ...
> del lock_name
(integer) 1
```
这样会存在一个问题，如果逻辑执行中间出现异常，可能会导致`del`指令没有被执行，这样会陷入死锁，锁永远不会释放。

可以为锁设置一个过期时间，这样即使中间出现异常也可以保证过期之后锁会自动释放。

```
> setnx lock_name true
OK
> expire lock_name 5
... do something ...
> del lock_name
(integer) 1
```

这又会引入一个新的问题，如果在`setnx`和`expire`两条指令中间服务器进程突然挂掉，就会导致`expire`指令无法执行，也会造成死锁。

这个问题的根源在于`setnx`和`expire`两条指令不是原子指令。Redis事务无法解决这个问题，因为`expire`指令依赖于`setnx`指令的执行结果，如果`setnx`没有抢到锁，是不应该执行`expire`指令的。Redis事务没有`if-else`的逻辑，事务是一口气执行完，要么都执行要么都不执行。

Redis 2.8版本加入了`set`指令的扩展参数，使得`setnx`和`expire`指令可以执行。

```
> set lock_name true ex 5 nx
OK
... do something ...
> del lock_name
(integer) 1
```

## 超时问题

Redis 的分布式锁不能解决超时问题，如果在加锁和释放锁之间的逻辑执行的太长，以至于超出了锁的超时限制，就会出现问题。因为这时候锁过期了，第二个线程重新持有了这把锁，但是紧接着第一个线程执行完了业务逻辑，就把锁给释放了，第三个线程就会在第二个线程逻辑执行完之间拿到了锁。

为了避免这个问题，Redis 分布式锁不要用于较长时间的任务。如果真的偶尔出现了，数据出现的小波错乱可能需要人工介入解决。 

有一个更加安全的方案是为 set 指令的 value 参数设置为一个随机数，释放锁时先匹配随机数是否一致，然后再删除 key。但是匹配 value 和删除 key 不是一个原子操作，Redis 也没有提供类似于 delifequals 这样的指令，这就需要使用 Lua 脚本来处理了，因为 Lua 脚本可以保证连续多个指令的原子性执行。 

```
tag = random.nextint()  # 随机数
if redis.set(key, tag, nx=True, ex=5):
    do_something()
    redis.delifequals(key, tag)  # 假象的 delifequals 指令

# delifequals
if redis.call("get",KEYS[1]) == ARGV[1] then
    return redis.call("del",KEYS[1]) 
else
    return 0 
end
```

## 可重入性

可重入性是指线程在持有锁的情况下再次请求加锁，如果一个锁支持同一个线程的多次加锁，那么这个锁就是可重入的。比如 Java 语言里有个 ReentrantLock 就是可重入锁。Redis 分布式锁如果要支持可重入，需要对客户端的 set 方法进行包装，使用线程的 Threadlocal 变量存储当前持有锁的计数。 

精确一点还需要考虑内存锁计数的过期时间，代码复杂度将会继续升高。实践中不推荐使用可重入锁，它加重了客户端的复杂性，在编写业务方法时注意在逻辑结构上进行调整完全可以不使用可重入锁。

## 集群环境下的问题

比如在Sentinel集群中，主节点挂点后，从节点会取而代之。假设第一个客户端在主节点中申请成功了一把锁，但是这把锁还没有来得及同步到从节点，主节点就挂掉了。然后从节点变成了主节点，这个新的节点内部还没有这把锁，所以当另一个客户端过来请求加锁时，就被批准了。这样就会导致系统中同一把锁被两个客户端同时持有。

这种情况仅仅发生在主从failover的情况下，而且持续时间比较短，业务系统多数情况下可以容忍。

Redlock算法可以解决这个问题，但比较复杂。Redlock需要多个Redis实例，这些实例之间相互独立没有主从关系，同很多分布式算法一样，redlock也使用了“大多数机制”。加锁时，它会向过半节点发送setnx指令，只要过半节点成功，就认为加锁成功。释放锁时，需要向所有节点发送del指令。Redlock算法还需要考虑出错重试、时钟漂移等很多细节问题，同时Redlock需要向多个节点进行读写，意味着相比单实例Redis性能会下降一些。