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
            { text: 'Home', link: '/' },
            { text: 'Java', items: [
                { text: 'Java基础', link: '/java/base/Basic' },
                { text: 'Java集合框架', link: '/java/collection/ArrayList' },
                { text: 'Java并发编程', link: '/java/concurrent/Theory' },
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
                { text: 'Apollo', link: '/framework/apollo/01' },
            ] },
            { text: '架构', items: [
                { text: '系统设计', link: '/arch/system_design/01_Scale_From_Zero' },
                { text: '案例', link: '/arch/case_study/Rate_Limiter' },
            ] },
            { text: 'Web3', items: [
                { text: '北大肖臻《区块链技术与应用》', link: '/web3/blockchain/01' },
            ] },
            // { text: 'Kubernetes', link: '/kubernetes/01_intro' },
            { text: '其他', items: [
                { text: '证券从业资格考试', link: '/other/sac/01' },
            ] },
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
                            path: '/java/base/Basic',
                        },
                        {
                            title: 'Java基础-面向对象',
                            path: '/java/base/Oop',
                        },
                        {
                            title: 'Java基础-代理',
                            path: '/java/base/Proxy'
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
                            path: '/java/jvm/HotSpot_Algo',
                        },
                        {
                            title: '类加载器',
                            path: '/java/jvm/Class_Loader',
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
            '/storage/database/': [
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
            '/framework/spring/': [
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
                            path: '/framework/netty/Netty_BusinessLogic'
                        }
                    ]
                }
            ],
            '/framework/apollo/': [
                {
                    title: 'Apollo',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: 'Apollo调试环境搭建',
                            path: '/framework/apollo/01'
                        },
                        {
                            title: 'Apollo Portal源码分析——创建App',
                            path: '/framework/apollo/portal_create_app'
                        },
                        {
                            title: 'Apollo Portal源码分析——创建Cluster',
                            path: '/framework/apollo/portal_create_cluster'
                        },
                        {
                            title: 'Apollo Portal源码分析——创建Namespace',
                            path: '/framework/apollo/portal_create_appnamespace'
                        },
                        {
                            title: 'Apollo Portal源码分析——关联Namespace',
                            path: '/framework/apollo/portal_create_namespace'
                        },
                        {
                            title: 'Apollo Portal源码分析——创建Item',
                            path: '/framework/apollo/portal_create_item'
                        },
                        {
                            title: 'Apollo Portal源码分析——文本变更Item',
                            path: '/framework/apollo/portal_create_item_by_text'
                        },
                        {
                            title: 'Apollo Portal源码分析——发布配置',
                            path: '/framework/apollo/portal_publish'
                        },
                        {
                            title: 'Apollo Portal源码分析——发布ReleaseMessage',
                            path: '/framework/apollo/adminservice_send_release_message'
                        },
                        {
                            title: 'Apollo Portal源码分析——ConfigService通知配置变更',
                            path: '/framework/apollo/configservice-notifications'
                        }
                    ]
                }
            ],
            '/arch/system_design/': [
                {
                    title: '系统设计',
                    collapsable: false,
                    sidebarDepth: 0,
                }
            ],
            '/arch/case_study/': [
                {
                    title: '架构案例',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: '限流',
                            path: '/arch/case_study/Rate_Limiter'
                        },
                        {
                            title: '缓存一致性',
                            path: '/arch/case_study/Cache_Consistency'
                        },
                        {
                            title: '缓存雪崩、缓存穿透、缓存击穿',
                            path: '/arch/case_study/Cache_Avalanche_Cache_Penetration'
                        },
                        {
                            title: '如何设计一个亿级网关',
                            path: '/arch/case_study/Gateway'
                        },
                        {
                            title: '如何设计一个短网址服务',
                            path: '/arch/case_study/Short_Url'
                        },
                        {
                            title: '如何设计一个扣减类服务',
                            path: '/arch/case_study/Deduction'
                        },
                    ]
                }   
            ],
            '/web3/blockchain': [
                {
                    title: '北大肖臻《区块链技术与应用》',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: '比特币：密码学原理',
                            path: '/web3/blockchain/01'
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
            ],
            '/other/sac/': [
                {
                    title: '证券从业资格考试',
                    collapsable: false,
                    sidebarDepth: 0,
                    children: [
                        {
                            title: '第一章 金融市场体系',
                            path: '/other/sac/01'
                        },
                        {
                            title: '第二章 中国的金融体系与多层次资本市场',
                            path: '/other/sac/02'
                        },
                    ]
                }
            ]
        }
    }
}