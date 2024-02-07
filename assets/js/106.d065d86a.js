(window.webpackJsonp=window.webpackJsonp||[]).push([[106],{618:function(_,v,s){"use strict";s.r(v);var t=s(45),a=Object(t.a)({},(function(){var _=this,v=_.$createElement,s=_._self._c||v;return s("ContentSlotsDistributor",{attrs:{"slot-key":_.$parent.slotKey}},[s("h1",{attrs:{id:"mysql"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#mysql"}},[_._v("#")]),_._v(" MySQL")]),_._v(" "),s("h2",{attrs:{id:"自增主键的作用"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#自增主键的作用"}},[_._v("#")]),_._v(" 自增主键的作用")]),_._v(" "),s("p",[_._v("在使用InnoDB存储引擎时，如果没有特别的需要，请永远使用一个与业务无关的自增字段作为主键。")]),_._v(" "),s("p",[_._v("经常看到有帖子或博客讨论主键选择问题，有人建议使用业务无关的自增主键，有人觉得没有必要，完全可以使用如学号或身份证号这种唯一字段作为主键。不论支持哪种论点，大多数论据都是业务层面的。如果从数据库索引优化角度看，使用InnoDB引擎而不使用自增主键绝对是一个糟糕的主意。")]),_._v(" "),s("p",[_._v("InnoDB使用聚集索引，数据记录本身被存于主索引（一颗B+Tree）的叶子节点上。这就要求同一个叶子节点内（大小为一个内存页或磁盘页）的各条数据记录按主键顺序存放，因此每当有一条新的记录插入时，MySQL会根据其主键将其插入适当的节点和位置，如果页面达到装载因子（InnoDB默认为15/16），则开辟一个新的页（节点）。")]),_._v(" "),s("p",[_._v("如果表使用自增主键，那么每次插入新的记录，记录就会顺序添加到当前索引节点的后续位置，当一页写满，就会自动开辟一个新的页。这样就会形成一个紧凑的索引结构，近似顺序填满。由于每次插入时也不需要移动已有数据，因此效率很高，也不会增加很多开销在维护索引上。")]),_._v(" "),s("p",[_._v("如果使用非自增主键（如果身份证号或学号等），由于每次插入主键的值近似于随机，因此每次新纪录都要被插到现有索引页得中间某个位置。此时MySQL不得不为了将新记录插到合适位置而移动数据，甚至目标页面可能已经被回写到磁盘上而从缓存中清掉，此时又要从磁盘上读回来，这增加了很多开销，同时频繁的移动、分页操作造成了大量的碎片，得到了不够紧凑的索引结构，后续不得不通过OPTIMIZE TABLE来重建表并优化填充页面。")]),_._v(" "),s("p",[_._v("因此，只要可以，请尽量在InnoDB上采用自增字段做主键。")]),_._v(" "),s("h2",{attrs:{id:"如何实现mysql的读写分离"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#如何实现mysql的读写分离"}},[_._v("#")]),_._v(" 如何实现MySQL的读写分离？")]),_._v(" "),s("p",[_._v("其实很简单，就是基于主从复制架构，简单来说，就搞一个主库，挂多个从库，然后我们就单单只是写主库，然后主库会自动把数据给同步到从库上去。")]),_._v(" "),s("h2",{attrs:{id:"mysql-主从复制原理的是啥"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#mysql-主从复制原理的是啥"}},[_._v("#")]),_._v(" MySQL 主从复制原理的是啥？")]),_._v(" "),s("p",[_._v("主库将变更写入 binlog 日志，然后从库连接到主库之后，从库有一个 IO 线程，将主库的 binlog 日志拷贝到自己本地，写入一个 relay 中继日志中。接着从库中有一个 SQL 线程会从中继日志读取 binlog，然后执行 binlog 日志中的内容，也就是在自己本地再次执行一遍 SQL，这样就可以保证自己跟主库的数据是一样的。")]),_._v(" "),s("p",[_._v("这里有一个非常重要的一点，就是从库同步主库数据的过程是串行化的，也就是说主库上并行的操作，在从库上会串行执行。所以这就是一个非常重要的点了，由于从库从主库拷贝日志以及串行执行 SQL 的特点，在高并发场景下，从库的数据一定会比主库慢一些，是有延时的。所以经常出现，刚写入主库的数据可能是读不到的，要过几十毫秒，甚至几百毫秒才能读取到。")]),_._v(" "),s("p",[_._v("而且这里还有另外一个问题，就是如果主库突然宕机，然后恰好数据还没同步到从库，那么有些数据可能在从库上是没有的，有些数据可能就丢失了。")]),_._v(" "),s("p",[_._v("所以 MySQL 实际上在这一块有两个机制，一个是半同步复制，用来解决主库数据丢失问题；一个是并行复制，用来解决主从同步延时问题。")]),_._v(" "),s("p",[_._v("这个所谓半同步复制，也叫 semi-sync 复制，指的就是主库写入 binlog 日志之后，就会将强制此时立即将数据同步到从库，从库将日志写入自己本地的 relay log 之后，接着会返回一个 ack 给主库，主库接收到至少一个从库的 ack 之后才会认为写操作完成了。")]),_._v(" "),s("p",[_._v("所谓并行复制，指的是从库开启多个线程，并行读取 relay log 中不同库的日志，然后并行重放不同库的日志，这是库级别的并行。")]),_._v(" "),s("h3",{attrs:{id:"mysql-主从同步延时问题"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#mysql-主从同步延时问题"}},[_._v("#")]),_._v(" MySQL 主从同步延时问题")]),_._v(" "),s("p",[_._v("以前线上确实处理过因为主从同步延时问题而导致的线上的 bug，属于小型的生产事故。")]),_._v(" "),s("p",[_._v("是这个么场景。有个同学是这样写代码逻辑的。先插入一条数据，再把它查出来，然后更新这条数据。在生产环境高峰期，写并发达到了 2000/s，这个时候，主从复制延时大概是在小几十毫秒。线上会发现，每天总有那么一些数据，我们期望更新一些重要的数据状态，但在高峰期时候却没更新。用户跟客服反馈，而客服就会反馈给我们。")]),_._v(" "),s("p",[_._v("我们通过 MySQL 命令：")]),_._v(" "),s("p",[_._v("show slave status\n查看 Seconds_Behind_Master ，可以看到从库复制主库的数据落后了几 ms。")]),_._v(" "),s("p",[_._v("一般来说，如果主从延迟较为严重，有以下解决方案：")]),_._v(" "),s("ul",[s("li",[_._v("分库，将一个主库拆分为多个主库，每个主库的写并发就减少了几倍，此时主从延迟可以忽略不计。")]),_._v(" "),s("li",[_._v("打开 MySQL 支持的并行复制，多个库并行复制。如果说某个库的写入并发就是特别高，单库写并发达到了 2000/s，并行复制还是没意义。")]),_._v(" "),s("li",[_._v("重写代码，写代码的同学，要慎重，插入数据时立马查询可能查不到。")]),_._v(" "),s("li",[_._v("如果确实是存在必须先插入，立马要求就查询到，然后立马就要反过来执行一些操作，对这个查询设置直连主库。不推荐这种方法，你要是这么搞，读写分离的意义就丧失了。")])])])}),[],!1,null,null,null);v.default=a.exports}}]);