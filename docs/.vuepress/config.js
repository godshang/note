module.exports = {
    title: '开发者笔记',
    description: '',
    port: 4000,
    base: '/note/',
    plugins: [
        
    ],
    markdown: {
        toc: {
            includeLevel:[1, 2, 3, 4]
        }
    },
    themeConfig: {
        nav: [
            {
                text: 'Home', 
                link: '/' 
            },
            {
                text: 'Java', 
                items: [
                    { text: 'Java基础', link: '/java/base/basic' },
                    { text: 'Java集合框架', link: '/java/collection/ArrayList' },
                    { text: 'Java并发编程', link: '/java/concurrent/Theory' },
                    { text: 'JVM相关', link: '/java/jvm/memory' },
                    { text: 'Java NIO相关', link: '/java/nio/io' },
                ]
            },
            {
                text: '数据存储', 
                items: [
                    { text: 'MySQL', link: '/storage/database/mysql' },
                    { text: 'Redis', link: '/storage/redis/redis-question' },
                    { text: '消息队列', link: '/storage/mq/kafka-intro' },
                ]
            },
            {
                text: '框架',
                items: [
                    { text: 'Spring框架', link: '/framework/spring-framework/spring-framework-intro' },
                    { text: 'Netty', link: '/framework/netty/netty-business-logic' },
                    { text: 'Apollo源码分析', link: '/framework/apollo/setup-debug-enviroment' },
                ]
            },
            {
                text: '架构',
                items: [
                    { text: '系统设计', link: '/arch/system-design/01-scale-from-zero' },
                    { text: '案例', link: '/arch/case-study/rate-limiter' },
                ]
            },
        ],
        sidebar: {
            '/java/base/': [
                {
                    title: 'Java基础',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'Java基础-知识点',
                            path: '/java/base/basic',
                        },
                        {
                            title: 'Java基础-面向对象',
                            path: '/java/base/oop',
                        },
                        {
                            title: 'Java基础-代理',
                            path: '/java/base/proxy'
                        },
                        {
                            title: 'Java基础-SPI机制',
                            path: '/java/base/spi'
                        }
                    ]
                }
            ],
            '/java/collection/': [
                {
                    title: 'Java集合框架',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'ArrayList',
                            path: '/java/collection/ArrayList',
                        },
                        {
                            title: 'LinkedList',
                            path: '/java/collection/LinkedList',
                        },
                        {
                            title: 'Vector',
                            path: '/java/collection/Vector',
                        },
                        {
                            title: 'Stack',
                            path: '/java/collection/Stack',
                        },
                        {
                            title: 'HashMap',
                            path: '/java/collection/HashMap',
                        },
                        {
                            title: 'Hashtable',
                            path: '/java/collection/Hashtable',
                        },
                        {
                            title: 'LinkedHashMap',
                            path: '/java/collection/LinkedHashMap',
                        },
                        {
                            title: 'TreeMap',
                            path: '/java/collection/TreeMap',
                        },
                        {
                            title: 'Red-Black-Tree',
                            path: '/java/collection/Red-Black-Tree',
                        },
                        {
                            title: 'HashSet',
                            path: '/java/collection/HashSet',
                        },
                        {
                            title: 'LinkedHashSet',
                            path: '/java/collection/LinkedHashSet',
                        }
                    ]
                }
            ],
            '/java/concurrent/': [
                {
                    title: 'Java并发编程',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'Java并发-理论基础',
                            path: '/java/concurrent/Theory',
                        },
                        {
                            title: 'Java并发-线程',
                            path: '/java/concurrent/Thread',
                        },
                        {
                            title: 'Java并发-锁',
                            path: '/java/concurrent/Lock.md',
                        },
                        {
                            title: 'AQS',
                            path: '/java/concurrent/AQS',
                        },
                        {
                            title: 'JUC锁',
                            path: '/java/concurrent/JUC-Lock',
                        },
                        {
                            title: 'CopyOnWriteArrayList',
                            path: '/java/concurrent/CopyOnWriteArrayList',
                        },
                        {
                            title: 'CopyOnWriteArraySet',
                            path: '/java/concurrent/CopyOnWriteArraySet',
                        },
                        {
                            title: '阻塞队列',
                            path: '/java/concurrent/BlockingQueue',
                        },
                        {
                            title: 'Volatile原理',
                            path: '/java/concurrent/Volatile',
                        },
                        {
                            title: 'ThreadLocal原理',
                            path: '/java/concurrent/ThreadLocal',
                        }
                    ]
                }
            ],
            '/java/jvm/': [
                {
                    title: 'JVM相关',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'JVM内存模型',
                            path: '/java/jvm/Memory',
                        },
                        {
                            title: '垃圾回收',
                            path: '/java/jvm/GC',
                        },
                        {
                            title: 'HotSpot垃圾回收算法实现',
                            path: '/java/jvm/hotspot-algo',
                        },
                        {
                            title: '类加载器',
                            path: '/java/jvm/class-loader',
                        }
                    ]
                }
            ],
            '/java/nio/': [
                {
                    title: 'Java NIO相关',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'I/O模型',
                            path: '/java/nio/io',
                        },
                        {
                            title: 'I/O多路复用',
                            path: '/java/nio/io-multiplex',
                        },
                        {
                            title: 'Reactor模式',
                            path: '/java/nio/reactor',
                        }
                    ]
                }
            ],
            '/storage/database/': [
                {
                    title: '数据库',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'MySQL常见问题',
                            path: '/storage/database/mysql'
                        },
                        {
                            title: '分库分表',
                            path: '/storage/database/shard'
                        },
                        {
                            title: '索引',
                            path: '/storage/database/db-index'
                        },
                        {
                            title: '事务',
                            path: '/storage/database/transaction'
                        },
                        {
                            title: '事务ACID的实现原理',
                            path: '/storage/database/acid'
                        }
                    ]
                }
            ],
            '/storage/redis/': [
                {
                    title: 'Redis详解',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'Redis常见问题',
                            path: '/storage/redis/redis-question'
                        },
                        {
                            title: 'Redis数据结构',
                            path: '/storage/redis/redis-data-structure'
                        },
                        {
                            title: 'Redis持久化',
                            path: '/storage/redis/redis-persistence'
                        },
                        {
                            title: 'Redis事务',
                            path: '/storage/redis/redis-tx'
                        },
                        {
                            title: '分布式锁',
                            path: '/storage/redis/redis-lock'
                        },
                        {
                            title: '消息队列',
                            path: '/storage/redis/redis-mq'
                        },
                        {
                            title: '布隆过滤器',
                            path: '/storage/redis/redis-bloom-filter'
                        },
                        {
                            title: 'Scan',
                            path: '/storage/redis/redis-scan'
                        }
                    ]
                }
            ],
            '/storage/mq/': [
                {
                    title: '消息队列',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'Kafka详解',
                            path: '/storage/mq/kafka-intro'
                        },
                        {
                            title: 'Kafka常见问题',
                            path: '/storage/mq/kafka-question'
                        },
                        {
                            title: 'RocketMQ详解',
                            path: '/storage/mq/rmq-intro'
                        },
                        {
                            title: 'MQ常见问题',
                            path: '/storage/mq/mq-question'
                        }
                    ]
                }
            ],
            '/framework/spring-framework/': [
                {
                    title: 'Spring',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'Spring基础 - 简介',
                            path: '/framework/spring-framework/spring-framework-intro'
                        },
                        {
                            title: 'Spring基础 - Spring核心之控制反转(IOC)',
                            path: '/framework/spring-framework/spring-framework-ioc'
                        },
                        {
                            title: 'Spring基础 - Spring核心之面向切面编程(AOP)',
                            path: '/framework/spring-framework/spring-framework-aop'
                        },
                        {
                            title: 'Spring基础 - SpringMVC请求流程',
                            path: '/framework/spring-framework/spring-framework-mvc'
                        },
                        {
                            title: 'Spring进阶- Spring IOC实现原理详解之IOC体系结构设计',
                            path: '/framework/spring-framework/spring-framework-ioc-source-1'
                        },
                        {
                            title: 'Spring进阶- Spring IOC实现原理详解之IOC初始化流程',
                            path: '/framework/spring-framework/spring-framework-ioc-source-2'
                        },
                        {
                            title: 'Spring进阶- Spring IOC实现原理详解之Bean实例化',
                            path: '/framework/spring-framework/spring-framework-ioc-source-3'
                        }
                    ]
                }
            ],
            '/framework/netty/': [
                {
                    title: 'Netty',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'Netty耗时的业务逻辑应该写在哪儿，有什么注意事项',
                            path: '/framework/netty/netty-business-logic'
                        }
                    ]
                }
            ],
            '/framework/apollo/': [
                {
                    title: 'Apollo源码分析',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'Apollo调试环境搭建',
                            path: '/framework/apollo/setup-debug-enviroment'
                        },
                        {
                            title: 'Apollo源码分析——Portal创建App',
                            path: '/framework/apollo/portal-create-app'
                        },
                        {
                            title: 'Apollo源码分析——Portal创建Cluster',
                            path: '/framework/apollo/portal-create-cluster'
                        },
                        {
                            title: 'Apollo源码分析——Portal创建Namespace',
                            path: '/framework/apollo/portal-create-appnamespace'
                        },
                        {
                            title: 'Apollo源码分析——Portal关联Namespace',
                            path: '/framework/apollo/portal-create-namespace'
                        },
                        {
                            title: 'Apollo源码分析——Portal创建Item',
                            path: '/framework/apollo/portal-create-item'
                        },
                        {
                            title: 'Apollo源码分析——Portal文本变更Item',
                            path: '/framework/apollo/portal-create-item-by-text'
                        },
                        {
                            title: 'Apollo源码分析——Portal发布配置',
                            path: '/framework/apollo/portal-publish'
                        },
                        {
                            title: 'Apollo源码分析——AdminService发布ReleaseMessage',
                            path: '/framework/apollo/adminservice-send-release-message'
                        },
                        {
                            title: 'Apollo源码分析——ConfigService通知配置变更',
                            path: '/framework/apollo/configservice-notifications'
                        },
                        {
                            title: 'Apollo源码分析——ConfigService配置查询',
                            path: '/framework/apollo/configservice-query-api'
                        },
                        {
                            title: 'Apollo源码分析——Client拉取配置',
                            path: '/framework/apollo/client-poll-config'
                        },
                        {
                            title: 'Apollo源码分析——Portal 创建灰度',
                            path: '/framework/apollo/portal-create-namespace-branch'
                        },
                        {
                            title: 'Apollo源码分析——Portal 配置灰度规则',
                            path: '/framework/apollo/portal-create-namespace-branch-gray-rule'
                        },
                        {
                            title: 'Apollo源码分析——Portal 灰度全量发布',
                            path: '/framework/apollo/portal-publish-namespace-branch-to-master'
                        },
                        {
                            title: 'Apollo 源码解析 —— Portal 灰度发布',
                            path: '/framework/apollo/portal-publish-namespace-branch'
                        },
                        {
                            title: 'Apollo 源码解析 —— 客户端 API 配置（一）之一览',
                            path: '/framework/apollo/client-config-api-1'
                        },
                        {
                            title: 'Apollo 源码解析 —— 客户端 API 配置（二）之 Config',
                            path: '/framework/apollo/client-config-api-2'
                        },
                        {
                            title: 'Apollo 源码解析 —— 客户端 API 配置（三）之 ConfigFile',
                            path: '/framework/apollo/client-config-api-3'
                        },
                        {
                            title: 'Apollo 源码解析 —— 客户端 API 配置（四）之 ConfigRepository                            ',
                            path: '/framework/apollo/client-config-api-4'
                        }
                    ]
                }
            ],
            '/arch/system-design/': [
                {
                    title: '系统设计',
                    collapsable: false,
                    sidebarDepth: 0,
                }
            ],
            '/arch/case-study/': [
                {
                    title: '架构案例',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: '限流',
                            path: '/arch/case-study/rate-limiter'
                        },
                        {
                            title: '缓存一致性',
                            path: '/arch/case-study/cache-consistency'
                        },
                        {
                            title: '缓存雪崩、缓存穿透、缓存击穿',
                            path: '/arch/case-study/cache-avalanche-cache-penetration'
                        },
                        {
                            title: '如何设计一个亿级网关',
                            path: '/arch/case-study/gateway'
                        },
                        {
                            title: '如何设计一个短网址服务',
                            path: '/arch/case-study/short-url'
                        },
                        {
                            title: '如何设计一个扣减类服务',
                            path: '/arch/case-study/deduction'
                        },
                    ]
                }   
            ],
            '/bigdata/flink/': [
                {
                    title: 'Flink',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: '限流',
                            path: '/arch/case-study/rate-limiter'
                        }
                    ]
                }   
            ]
        }
    }
}