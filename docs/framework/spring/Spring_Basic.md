# Spring 基础知识点

## 什么是 Spring 框架?

Spring 是一种轻量级开发框架，旨在提高开发人员的开发效率以及系统的可维护性。

我们一般说 Spring 框架指的都是 Spring Framework，它是很多模块的集合，使用这些模块可以很方便地协助我们进行开发。这些模块是：核心容器、数据访问/集成,、Web、AOP（面向切面编程）、工具、消息和测试模块。比如：Core Container 中的 Core 组件是Spring 所有组件的核心，Beans 组件和 Context 组件是实现IOC和依赖注入的基础，AOP组件用来实现面向切面编程。

Spring 官网列出的 Spring 的 6 个特征:

* 核心技术 ：依赖注入(DI)，AOP，事件(events)，资源，i18n，验证，数据绑定，类型转换，SpEL。
* 测试 ：模拟对象，TestContext框架，Spring MVC 测试，WebTestClient。
* 数据访问 ：事务，DAO支持，JDBC，ORM，编组XML。
* Web支持 : Spring MVC和Spring WebFlux Web框架。
* 集成 ：远程处理，JMS，JCA，JMX，电子邮件，任务，调度，缓存。
* 语言 ：Kotlin，Groovy，动态语言。

## 循环依赖

### 什么是循环依赖？

循环依赖就是循环引用，也就是两个或两个以上的Bean互相持有对方，最终形成闭环。比如A依赖B，B依赖C，C又依赖A。

如果在日常开发中我们用new 对象的方式发生这种循环依赖的话程序会在运行时一直循环调用，直至内存溢出报错。下面说一下Spring是如果解决循环依赖的。

根据 spring 中 Bean 的注入方式：构造器注入方式，属性注入方式（单例和多例）。

### 构造器参数循环依赖

Spring容器会将每一个正在创建的 Bean 标识符放在一个“当前创建Bean池”中，Bean标识符在创建过程中将一直保持在这个池中，因此如果在创建Bean过程中发现自己已经在“当前创建Bean池”里时将抛出BeanCurrentlyInCreationException异常表示循环依赖；而对于创建完毕的Bean将从“当前创建Bean池”中清除掉。

因此，如果是通过构造器注入时有循环依赖，以上述A、B、C三个为例，Spring先创建单例A，A又依赖B，会将A放到“当前创建Bean池”，再去创建B，而B又依赖C，会将B放在“当前创建Bean池”中，再去创建C，而C又依赖A，但此时A已经在池中，所以会报错，因为在池中的Bean都是未初始化完的，所以会依赖错误。

### setter方式 - 单例

Spring中Bean初始化分为三步，createBeanInstance实例化、populateBean填充属性、InitializeBean初始化。

Spring先是用构造实例化Bean对象 ，此时Spring会将这个实例化结束的对象放到一个Map中，并且Spring提供了获取这个未设置属性的实例化对象引用的方法。结合我们的实例来看，当Spring实例化了A、B、C后，紧接着会去设置对象的属性，此时A依赖B，就会去Map中取出存在里面的单例B对象，以此类推，不会出来循环的问题。

下面是Spring源码中的实现方法。以下的源码在Spring的Bean包中的DefaultSingletonBeanRegistry.java 类中:

```java
/** Cache of singleton objects: bean name --> bean instance（缓存单例实例化对象的Map集合） */
private final Map<String, Object> singletonObjects = new ConcurrentHashMap<String, Object>(64);

/** Cache of singleton factories: bean name --> ObjectFactory（单例的工厂Bean缓存集合） */
private final Map<String, ObjectFactory> singletonFactories = new HashMap<String, ObjectFactory>(16);

/** Cache of early singleton objects: bean name --> bean instance（早期的对象缓存集合） */
private final Map<String, Object> earlySingletonObjects = new HashMap<String, Object>(16);

/** Set of registered singletons, containing the bean names in registration order（单例的实例化对象名称集合） */
private final Set<String> registeredSingletons = new LinkedHashSet<String>(64);
/**
 * 添加单例实例
 * 解决循环引用的问题
 * Add the given singleton factory for building the specified singleton
 * if necessary.
 * <p>To be called for eager registration of singletons, e.g. to be able to
 * resolve circular references.
 * @param beanName the name of the bean
 * @param singletonFactory the factory for the singleton object
 */
protected void addSingletonFactory(String beanName, ObjectFactory singletonFactory) {
	Assert.notNull(singletonFactory, "Singleton factory must not be null");
	synchronized (this.singletonObjects) {
		if (!this.singletonObjects.containsKey(beanName)) {
			this.singletonFactories.put(beanName, singletonFactory);
			this.earlySingletonObjects.remove(beanName);
			this.registeredSingletons.add(beanName);
		}
	}
}
```

### setter方式 - 原型

scope="prototype" 意思是 每次请求都会创建一个实例对象。两者的区别是：有状态的bean都使用 prototype 作用域，无状态的一般都使用singleton单例作用域。

对于“prototype”作用域Bean，Spring容器无法完成依赖注入，因为“prototype”作用域的Bean，Spring容器不进行缓存，因此无法提前暴露一个创建中的Bean。