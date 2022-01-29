module.exports = {
    title: '开发者笔记',
    description: '',
    port: 4000,
    base: '/note/',
    plugins: [
        
    ],
    themeConfig: {
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Java', items: [
                { text: 'Java基础', link: '/java/basic/Basic' },
                { text: 'Java集合框架', link: '/java/collection/ArrayList' },
                { text: 'Java并发编程', link: '/java/concurrent/Thread' },
                { text: 'JVM相关', link: '/java/jvm/Memory' },
                { text: 'Java NIO相关', link: '/java/nio/IO' },
            ] },
            { text: '数据存储', items: [
                { text: 'MySQL', link: '/storage/database/MySQL' },
                { text: 'Redis', link: '/storage/redis/Redis_Question' },
                { text: '消息队列', link: '/storage/mq/Kafka_Intro' },
            ] },
            { text: '框架', items: [
                { text: 'Spring', link: '/framework/spring/Spring_Basic' },
                { text: 'Netty', link: '/framework/netty/Netty_BusinessLogic' },
            ] },
            { text: '架构', link: '/arch/Rate_Limiter' },
            // { text: 'Kubernetes', link: '/kubernetes/01_intro' },
        ],
        sidebar: {
            '/java/': [
                {
                    title: 'Java基础',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'Java基础知识',
                            path: '/java/basic/Basic',
                        },
                        {
                            title: '代理',
                            path: '/java/basic/Proxy'
                        }
                    ]
                },
                {
                    title: 'Java集合框架',
                    path: '/java/collection/',
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
                            title: 'Red_Black_Tree',
                            path: '/java/collection/Red_Black_Tree',
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
                },
                {
                    title: 'Java并发编程',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'Java线程',
                            path: '/java/concurrent/Thread',
                        },
                        {
                            title: 'Java的锁',
                            path: '/java/concurrent/Lock.md',
                        },
                        {
                            title: 'AQS',
                            path: '/java/concurrent/AQS',
                        },
                        {
                            title: 'JUC锁',
                            path: '/java/concurrent/JUC_Lock',
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
                },
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
                            path: '/java/jvm/HotSpot_Algo',
                        },
                        {
                            title: '类加载器',
                            path: '/java/jvm/Class_Loader',
                        }
                    ]
                },
                {
                    title: 'Java NIO相关',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'I/O模型',
                            path: '/java/nio/IO',
                        },
                        {
                            title: 'I/O多路复用',
                            path: '/java/nio/IO_Multiplex',
                        },
                        {
                            title: 'Reactor模式',
                            path: '/java/nio/Reactor',
                        }
                    ]
                }
            ],
            '/storage/': [
                {
                    title: '数据库',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'MySQL常见问题',
                            path: '/storage/database/MySQL'
                        },
                        {
                            title: '分库分表',
                            path: '/storage/database/Shard'
                        },
                        {
                            title: '索引',
                            path: '/storage/database/DB_Index'
                        },
                        {
                            title: '事务',
                            path: '/storage/database/Transaction'
                        },
                        {
                            title: '事务ACID的实现原理',
                            path: '/storage/database/ACID'
                        }
                    ]
                },
                {
                    title: 'Redis详解',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'Redis常见问题',
                            path: '/storage/redis/Redis_Question'
                        },
                        {
                            title: 'Redis数据结构',
                            path: '/storage/redis/Redis_DataStructure'
                        },
                        {
                            title: 'Redis持久化',
                            path: '/storage/redis/Redis_Persistence'
                        },
                        {
                            title: 'Redis事务',
                            path: '/storage/redis/Redis_Tx'
                        },
                        {
                            title: '分布式锁',
                            path: '/storage/redis/Redis_Lock'
                        },
                        {
                            title: '消息队列',
                            path: '/storage/redis/Redis_MQ'
                        },
                        {
                            title: 'HyperLogLog',
                            path: '/storage/redis/Redis_HyperLogLog'
                        },
                        {
                            title: '布隆过滤器',
                            path: '/storage/redis/Redis_BloomFilter'
                        },
                        {
                            title: 'Scan',
                            path: '/storage/redis/Redis_Scan'
                        }
                    ]
                },
                {
                    title: '消息队列',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'Kafka详解',
                            path: '/storage/mq/Kafka_Intro'
                        },
                        {
                            title: 'Kafka常见问题',
                            path: '/storage/mq/Kafka_Question'
                        },
                        {
                            title: 'RocketMQ详解',
                            path: '/storage/mq/RocketMQ_Intro'
                        },
                        {
                            title: 'MQ常见问题',
                            path: '/storage/mq/MQ_Question'
                        }
                    ]
                }
            ],
            '/framework/': [
                {
                    title: 'Spring',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'Spring基础知识',
                            path: '/framework/spring/Spring_Basic'
                        },
                        {
                            title: 'Spring IOC 容器源码分析',
                            path: '/framework/spring/Spring_IoC'
                        },
                        {
                            title: 'Spring AOP 使用介绍',
                            path: '/framework/spring/Spring_AOP_Intro'
                        },
                        {
                            title: 'Spring AOP 源码分析',
                            path: '/framework/spring/Spring_AOP_Source'
                        },
                        {
                            title: 'Spring MVC',
                            path: '/framework/spring/Spring_MVC'
                        },
                        {
                            title: 'Spring Boot',
                            path: '/framework/spring/Spring_Boot'
                        }
                    ]
                },
                {
                    title: 'Netty',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'Netty耗时的业务逻辑应该写在哪儿，有什么注意事项',
                            path: '/framework/netty/Netty_BusinessLogic'
                        }
                    ]
                }
            ],
            '/arch/': [
                {
                    title: '架构基础',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: '限流',
                            path: '/arch/Rate_Limiter'
                        },
                        {
                            title: '缓存一致性',
                            path: '/arch/Cache_Consistency'
                        },
                        {
                            title: '缓存雪崩、缓存穿透、缓存击穿',
                            path: '/arch/Cache_Avalanche_Cache_Penetration'
                        },
                    ]
                },
                {
                    title: '架构案例',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: '如何设计一个亿级网关',
                            path: '/arch/Gateway'
                        },
                        {
                            title: '如何设计一个短网址服务',
                            path: '/arch/Short_Url'
                        },
                        {
                            title: '如何设计一个扣减类服务',
                            path: '/arch/Deduction'
                        },
                    ]
                }   
            ],
            '/kubernetes/': [
                {
                    title: 'Kubernetes入门',
                    collapsable: false,
                    path: '/kubernetes/01_intro'
                },
            ]
        }
    }
}