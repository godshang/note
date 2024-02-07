(window.webpackJsonp=window.webpackJsonp||[]).push([[57],{538:function(a,t,r){"use strict";r.r(t);var s=r(45),n=Object(s.a)({},(function(){var a=this,t=a.$createElement,r=a._self._c||t;return r("ContentSlotsDistributor",{attrs:{"slot-key":a.$parent.slotKey}},[r("h1",{attrs:{id:"flink高级功能的使用"}},[r("a",{staticClass:"header-anchor",attrs:{href:"#flink高级功能的使用"}},[a._v("#")]),a._v(" Flink高级功能的使用")]),a._v(" "),r("h2",{attrs:{id:"flink-broadcast"}},[r("a",{staticClass:"header-anchor",attrs:{href:"#flink-broadcast"}},[a._v("#")]),a._v(" Flink Broadcast")]),a._v(" "),r("p",[a._v("在讲Broadcast之前需要区分一下DataStream中的Broadcast（分区规则）和Flink中的Broadcast（广播变量）功能。")]),a._v(" "),r("ol",[r("li",[a._v("DataStream Broadcast（分区规则）")])]),a._v(" "),r("p",[a._v("分区规则是把元素广播给所有的分区，数据会被重复处理，类似于Storm中的allGrouping。")]),a._v(" "),r("ol",{attrs:{start:"2"}},[r("li",[a._v("Flink Broadcast（广播变量）")])]),a._v(" "),r("p",[a._v("广播变量允许编程人员在每台机器上保持一个只读的缓存变量，而不是传送变量的副本给Task。广播变量创建后，它可以运行在集群中的任何Function上，而不需要多次传递给集群节点。另外请记住，不要修改广播变量，这样才能确保每个节点获取到的值都是一致的。")]),a._v(" "),r("p",[a._v("用一句话解释，Broadcast可以理解为一个公共的共享变量。可以把一个DataSet（数据集）广播出去，不同的Task在节点上都能够获取到它，这个数据集在每个节点上只会存在一份。如果不使用Broadcast，则在各节点的每个Task中都需要复制一份DataSet数据集，比较浪费内存（也就是一个节点中可能会存在多份DataSet数据）。")])])}),[],!1,null,null,null);t.default=n.exports}}]);