(window.webpackJsonp=window.webpackJsonp||[]).push([[114],{634:function(e,n,t){"use strict";t.r(n);var i=t(45),l=Object(i.a)({},(function(){var e=this,n=e.$createElement,t=e._self._c||n;return t("ContentSlotsDistributor",{attrs:{"slot-key":e.$parent.slotKey}},[t("h1",{attrs:{id:"sentinel"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#sentinel"}},[e._v("#")]),e._v(" Sentinel")]),e._v(" "),t("p",[t("code",[e._v("Sentinel")]),e._v("哨兵是Redis的高可用解决方案，由一个或多个Sentinel实例组成的Sentinel系统可以监视任意多个主服务器，以及这些主服务器属下的所有从服务器，并在被监视的主服务器进入下线状态时，自动将下线主服务器属下的某个从服务器升级为新的主服务器，然后由新的主服务器代替已下线的从服务器继续处理命令请求。")]),e._v(" "),t("p",[e._v("Sentinel是一个运行在特殊模式下的Redis服务器，它使用了和普通模式不同的命令表，因此Sentinel模式能够使用的命令和普通Redis服务器能够使用的命令不同。")]),e._v(" "),t("p",[e._v("Sentinel会读入用户指定的配置文件，为每个要被监视的主服务器创建响应的实例结构，并创建连向主服务器的命令连接和订阅连接，其中命令连接用于向主服务器发送命令请求，而订阅连接则用户接受指定频道的消息。")]),e._v(" "),t("p",[e._v("Sentinel通过向主服务器发送INFO命令来获得主服务器属下所有从服务器的地址信息，并未这些从服务器创建响应的实例结构，以及连向这些从服务器的命令连接和订阅连接。")]),e._v(" "),t("p",[e._v("一般情况下，Sentinel每十秒一次向被监视的主服务器和从服务器发送INFO命令，当主服务器处于下线状态，或者Sentinel正在对主服务器进行故障转移操作时，Sentine")])])}),[],!1,null,null,null);n.default=l.exports}}]);