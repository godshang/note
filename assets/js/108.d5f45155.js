(window.webpackJsonp=window.webpackJsonp||[]).push([[108],{628:function(_,v,e){"use strict";e.r(v);var t=e(45),i=Object(t.a)({},(function(){var _=this,v=_.$createElement,e=_._self._c||v;return e("ContentSlotsDistributor",{attrs:{"slot-key":_.$parent.slotKey}},[e("h1",{attrs:{id:"redis数据结构"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#redis数据结构"}},[_._v("#")]),_._v(" Redis数据结构")]),_._v(" "),e("h2",{attrs:{id:"简单动态字符串"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#简单动态字符串"}},[_._v("#")]),_._v(" 简单动态字符串")]),_._v(" "),e("ul",[e("li",[_._v("常数复杂度获取字符串长度。")]),_._v(" "),e("li",[_._v("拒绝C字符串缓冲区溢出。")]),_._v(" "),e("li",[_._v("减少修改字符串时带来的内存重分配字数。使用空间预分配、惰性空间释放两种优化策略。")]),_._v(" "),e("li",[_._v("二进制安全。")]),_._v(" "),e("li",[_._v("兼容部分C字符串函数。")])]),_._v(" "),e("h2",{attrs:{id:"链表"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#链表"}},[_._v("#")]),_._v(" 链表")]),_._v(" "),e("ul",[e("li",[_._v("双端：链表节点带有prev和next指针，获取某个节点的前置节点和后置节点的复杂度都是O（1）。")]),_._v(" "),e("li",[_._v("无环：表头节点的prev指针和表尾节点的next指针都指向NULL，对链表的访问以NULL为终点。")]),_._v(" "),e("li",[_._v("带表头指针和表尾指针：通过list结构的head指针和tail指针，程序获取链表的表头节点和表尾节点的复杂度为O（1）。")]),_._v(" "),e("li",[_._v("带链表长度计数器：程序使用list结构的len属性来对list持有的链表节点进行计数，程序获取链表中节点数量的复杂度为O（1）。")]),_._v(" "),e("li",[_._v("多态：链表节点使用void*指针来保存节点值，并且可以通过list结构的dup、free、match三个属性为节点值设置类型特定函数，所以链表可以用于保存各种不同类型的值。")])]),_._v(" "),e("h2",{attrs:{id:"字典"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#字典"}},[_._v("#")]),_._v(" 字典")]),_._v(" "),e("ul",[e("li",[_._v("哈希表的实现类似HashMap，有一个table数组存储dictEntry，size属性存储字典大小（即table数组大小），used属性记录字典已有的键值对数量，sizemark属性总等于size-1，用来决定键值对应该放到table数组的哪个位置上。")]),_._v(" "),e("li",[_._v("字典基于哈希表实现，ht属性包含两个哈希表的数组，一般情况下只使用ht[0]，只有在对ht[0]rehash时才会使用ht[1]。rehashindex记录了目前rehash的进度，如果没有在进行rehash值为-1。")]),_._v(" "),e("li",[_._v("使用拉链法解决键的哈希冲突；为了插入效率，总是将新节点插入到链表的表头位置。")]),_._v(" "),e("li",[_._v("渐进式rehash。")])]),_._v(" "),e("h2",{attrs:{id:"跳跃表"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#跳跃表"}},[_._v("#")]),_._v(" 跳跃表")]),_._v(" "),e("ul",[e("li",[_._v("跳跃表支持平均O（logN）、最坏O（N）复杂度的节点查找，还可以通过顺序性操作来批量处理节点。")]),_._v(" "),e("li",[_._v("跳跃表是有序集合的底层实现之一。")]),_._v(" "),e("li",[_._v("Redis的跳跃表实现由zskiplist和zskiplistNode两个结构组成，其中zskiplist用于保存跳跃表信息（比如表头节点、表尾节点、长度），而zskiplistNode则用于表示跳跃表节点。")]),_._v(" "),e("li",[_._v("每个跳跃表节点的层高都是1至32之间的随机数。")]),_._v(" "),e("li",[_._v("在同一个跳跃表中，多个节点可以包含相同的分值，但每个节点的成员对象必须是唯一的。")]),_._v(" "),e("li",[_._v("跳跃表中的节点按照分值大小进行排序，当分值相同时，节点按照成员对象的大小进行排序。")])]),_._v(" "),e("h2",{attrs:{id:"整数集合"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#整数集合"}},[_._v("#")]),_._v(" 整数集合")]),_._v(" "),e("ul",[e("li",[_._v("整数集合（intset）是集合键的底层实现之一，当一个集合只包含整数值元素，并且这个集合的元素数量不多时，Redis就会使用整数集合作为集合键的底层实现。")]),_._v(" "),e("li",[_._v("整数集合（intset）是Redis用于保存整数值的集合抽象数据结构，它可以保存类型为int16_t、int32_t或者int64_t的整数值，并且保证集合中不会出现重复元素。")]),_._v(" "),e("li",[_._v("每当要将一个新元素添加到整数集合里面，并且新元素的类型比整数集合现有所有元素的类型都要长时，整数集合需要先进行升级，然后才能将新元素添加到整数集合里面。")]),_._v(" "),e("li",[_._v("整数集合的升级策略有两个好处，一个是提升整数集合的灵活性，另一个是尽可能地节约内存。")]),_._v(" "),e("li",[_._v("整数集合不支持降级操作，一旦对数组进行了升级，编码就会一直保持升级后的状态。")])]),_._v(" "),e("h2",{attrs:{id:"压缩列表"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#压缩列表"}},[_._v("#")]),_._v(" 压缩列表")]),_._v(" "),e("ul",[e("li",[_._v("压缩列表是一种为节约内存而开发的顺序型数据结构。")]),_._v(" "),e("li",[_._v("压缩列表被用作列表键和哈希键的底层实现之一。")]),_._v(" "),e("li",[_._v("压缩列表可以包含多个节点，每个节点可以保存一个字节数组或者整数值。")]),_._v(" "),e("li",[_._v("添加新节点到压缩列表，或者从压缩列表中删除节点，可能会引发连锁更新操作，但这种操作出现的几率并不高。")])]),_._v(" "),e("h1",{attrs:{id:"对象"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#对象"}},[_._v("#")]),_._v(" 对象")]),_._v(" "),e("p",[_._v("Redis没有直接使用上述数据结构，而是基于这些数据结构创建了一个对象系统，这个系统包含字符串对象、列表对象、哈希对象、集合对象和有序集合对象这五种类型的对象，每种对象都用到了至少一种我们前面所介绍的数据结构。")]),_._v(" "),e("p",[_._v("通过这五种不同类型的对象，Redis可以在执行命令之前，根据对象的类型来判断一个对象是否可以执行给定的命令。使用对象的另一个好处是，我们可以针对不同的使用场景，为对象设置多种不同的数据结构实现，从而优化对象在不同场景下的使用效率。")]),_._v(" "),e("p",[_._v("除此之外，Redis的对象系统还实现了基于引用计数技术的内存回收机制，当程序不再使用某个对象的时候，这个对象所占用的内存就会被自动释放；另外，Redis还通过引用计数技术实现了对象共享机制，这一机制可以在适当的条件下，通过让多个数据库键共享同一个对象来节约内存。")]),_._v(" "),e("p",[_._v("最后，Redis的对象带有访问时间记录信息，该信息可以用于计算数据库键的空转时长，在服务器启用了maxmemory功能的情况下，空转时长较大的那些键可能会优先被服务器删除。")]),_._v(" "),e("h2",{attrs:{id:"对象的类型与编码"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#对象的类型与编码"}},[_._v("#")]),_._v(" 对象的类型与编码")]),_._v(" "),e("p",[_._v("Redis中对象包括：")]),_._v(" "),e("ul",[e("li",[e("code",[_._v("REDIS_STRING")]),_._v("：字符串对象。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_LIST")]),_._v("：链表对象。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_HASH")]),_._v("：哈希对象。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_SET")]),_._v("：集合对象。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_ZSET")]),_._v("：有序集合对象。")])]),_._v(" "),e("p",[_._v("Redis中编码包括：")]),_._v(" "),e("ul",[e("li",[e("code",[_._v("REDIS_ENCODING_INT")]),_._v("：long类型的整数。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_ENCODING_EMBSTR")]),_._v("：embstr编码的简单动态字符串。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_ENCODING_RAW")]),_._v("：简单动态字符串。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_ENCODING_HT")]),_._v("：字典。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_ENCODING_LINKEDLIST")]),_._v("：双端链表。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_ENCODING_ZIPLIST")]),_._v("：压缩列表。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_ENCODING_INTSET")]),_._v("：整数集合。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_ENCODING_SKIPLIST")]),_._v("：跳跃表和字典。")])]),_._v(" "),e("p",[_._v("每种类型的对象都至少使用了两种类型的编码。")]),_._v(" "),e("ul",[e("li",[e("code",[_._v("REDIS_STRING")]),_._v("使用了"),e("code",[_._v("REDIS_ENCODING_INT")]),_._v("、"),e("code",[_._v("REDIS_ENCODING_EMBSTR")]),_._v("、"),e("code",[_._v("REDIS_ENCODING_RAW")]),_._v("。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_LIST")]),_._v("使用了"),e("code",[_._v("REDIS_ENCODING_ZIPLIST")]),_._v("、"),e("code",[_._v("REDIS_ENCODING_LINKEDLIST")]),_._v("。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_HASH")]),_._v("使用了"),e("code",[_._v("REDIS_ENCODING_ZIPLIST")]),_._v("、"),e("code",[_._v("REDIS_ENCODING_HT")]),_._v("。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_SET")]),_._v("使用了"),e("code",[_._v("REDIS_ENCODING_INTSET")]),_._v("、"),e("code",[_._v("REDIS_ENCODING_HT")]),_._v("。")]),_._v(" "),e("li",[e("code",[_._v("REDIS_ZSET")]),_._v("使用了"),e("code",[_._v("REDIS_ENCODING_ZIPLIST")]),_._v("、"),e("code",[_._v("REDIS_ENCODING_SKIPLIST")]),_._v("。")])]),_._v(" "),e("h2",{attrs:{id:"内存回收"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#内存回收"}},[_._v("#")]),_._v(" 内存回收")]),_._v(" "),e("p",[_._v("Redis在自己的对象系统中构建了一个使用引用计数的内存回收机制。每个对象的引用计数信息存储在redisObject结构的refcount属性中。")]),_._v(" "),e("p",[_._v("引用计数属性还可以实现对象共享。Redis在初始化服务器时会创建一万个字符串对象，包含从0到9999的所有整数值。类似于Java中Integer的缓存。")]),_._v(" "),e("h2",{attrs:{id:"对象的空转时间"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#对象的空转时间"}},[_._v("#")]),_._v(" 对象的空转时间")]),_._v(" "),e("p",[_._v("redisObject结构包含一个lru属性，记录对象最后一次被命令程序访问的时间。")])])}),[],!1,null,null,null);v.default=i.exports}}]);