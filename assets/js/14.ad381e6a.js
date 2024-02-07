(window.webpackJsonp=window.webpackJsonp||[]).push([[14],{377:function(v,e,a){v.exports=a.p+"assets/img/e8c50f34e1c3f7975d3d236f1f477f56.e8c50f34.png"},378:function(v,e,a){v.exports=a.p+"assets/img/902724f349f1df242562fefb8e338db9.902724f3.png"},379:function(v,e,a){v.exports=a.p+"assets/img/653d1eecc520dce5c88649740747305d.653d1eec.png"},380:function(v,e,a){v.exports=a.p+"assets/img/695fb0d8017904ea8e053555c1f45a56.695fb0d8.png"},535:function(v,e,a){"use strict";a.r(e);var _=a(45),t=Object(_.a)({},(function(){var v=this,e=v.$createElement,_=v._self._c||e;return _("ContentSlotsDistributor",{attrs:{"slot-key":v.$parent.slotKey}},[_("h1",{attrs:{id:"从零到百万级用户系统的演进"}},[_("a",{staticClass:"header-anchor",attrs:{href:"#从零到百万级用户系统的演进"}},[v._v("#")]),v._v(" 从零到百万级用户系统的演进")]),v._v(" "),_("p",[v._v("本文以一个简单的例子介绍如何从零开始向支撑百万级用户的系统演进。")]),v._v(" "),_("h2",{attrs:{id:"单服务器架构"}},[_("a",{staticClass:"header-anchor",attrs:{href:"#单服务器架构"}},[v._v("#")]),v._v(" 单服务器架构")]),v._v(" "),_("p",[v._v("千里之行始于足下，一个复杂的系统也是从简单演变而来。一开始，系统可能没有什么人访问，这时候用一个服务器就足够了，Web应用、数据库、缓存等等都运行在同一个服务器上。")]),v._v(" "),_("img",{attrs:{src:a(377)}}),v._v(" "),_("p",[v._v("请求流程大致是这样的：")]),v._v(" "),_("ol",[_("li",[v._v("用户通过域名访问网站，例如；api.mysite.com。通常DNS不是我们的服务，而是由第三方所提供")]),v._v(" "),_("li",[v._v("DNS将域名解析后的IP地址返回给浏览器或移动app")]),v._v(" "),_("li",[v._v("通过IP地址直接向Web服务器发送HTTP请求")]),v._v(" "),_("li",[v._v("Web服务器返回HTML页面或JSON格式的响应。")])]),v._v(" "),_("img",{attrs:{src:a(378)}}),v._v(" "),_("h2",{attrs:{id:"数据库单独部署"}},[_("a",{staticClass:"header-anchor",attrs:{href:"#数据库单独部署"}},[v._v("#")]),v._v(" 数据库单独部署")]),v._v(" "),_("p",[v._v("随着用户逐步增长，单一的服务器开始遇到瓶颈了，我们可以将Web服务与数据库服务分开来，分别部署到不同的服务器上，方便二者之后独立的扩展。")]),v._v(" "),_("img",{attrs:{src:a(379)}}),v._v(" "),_("h2",{attrs:{id:"选择哪种数据库"}},[_("a",{staticClass:"header-anchor",attrs:{href:"#选择哪种数据库"}},[v._v("#")]),v._v(" 选择哪种数据库")]),v._v(" "),_("p",[v._v("数据库有"),_("code",[v._v("关系型数据库")]),v._v("和"),_("code",[v._v("非关系型数据库")]),v._v("两类。")]),v._v(" "),_("p",[v._v("关系型数据库也被称为"),_("code",[v._v("RDBMS")]),v._v("(relational database management system)或SQL数据库。最流行的关系型数据库有"),_("code",[v._v("MySQL")]),v._v("、"),_("code",[v._v("Oracle")]),v._v("、"),_("code",[v._v("PostgreSQL")]),v._v("等。关系型数据库以表格和行的方式表示和存储数据。不同的表之间可以使用用"),_("code",[v._v("join")]),v._v("操作进行关联。")]),v._v(" "),_("p",[v._v("非关系型数据库也被称为"),_("code",[v._v("NoSQL")]),v._v("数据库。常用的有"),_("code",[v._v("CouchDB")]),v._v("、"),_("code",[v._v("Neo4j")]),v._v("、"),_("code",[v._v("Cassandra")]),v._v("、"),_("code",[v._v("HBase")]),v._v("、"),_("code",[v._v("Amazon DynamoDB")]),v._v("等。非关系型数据库有四类：key-value存储、图存储、列式存储、文档存储。非关系型数据库一般不支持"),_("code",[v._v("join")]),v._v("操作。")]),v._v(" "),_("p",[v._v("对多数场景来说，直接使用关系型数据库是一个比较好的选择。但某些场景下关系型数据库可能并不合适，比如：当服务有低延迟的要求、非结构化的数据、海量数据存储，这时候就可以选择非关系型数据库。")]),v._v(" "),_("h2",{attrs:{id:"垂直扩展-vs-水平扩展"}},[_("a",{staticClass:"header-anchor",attrs:{href:"#垂直扩展-vs-水平扩展"}},[v._v("#")]),v._v(" 垂直扩展 vs 水平扩展")]),v._v(" "),_("p",[v._v("垂直扩展(Vertical scaling，也叫scale up)，是指给服务器增加更多的CPU、内存等手段实现扩展。水平扩展(Horizontal scaling，也叫scale-out)，是指通过增加更多服务器的手段实现扩展。")]),v._v(" "),_("p",[v._v("垂直扩展比较简单， 因此当流量低时，是一个比较好的选择。但垂直扩展有一些缺点：")]),v._v(" "),_("ul",[_("li",[v._v("垂直扩展有上限，不可能给服务器增加无限的CPU和内存。")]),v._v(" "),_("li",[v._v("垂直扩展无法实现故障转移（failover）和冗余（redundancy），如果一台服务器挂了，那么整个服务就不可用了。")])]),v._v(" "),_("p",[v._v("因此，对大型应用而言，水平扩展是一个更理想的选择。")]),v._v(" "),_("h2",{attrs:{id:"负载均衡"}},[_("a",{staticClass:"header-anchor",attrs:{href:"#负载均衡"}},[v._v("#")]),v._v(" 负载均衡")]),v._v(" "),_("p",[v._v("负载均衡（load balancer）可以将流量导向多个服务器来提高性能和可靠性。")]),v._v(" "),_("img",{attrs:{src:a(380)}})])}),[],!1,null,null,null);e.default=t.exports}}]);