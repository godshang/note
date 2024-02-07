# Spring Boot 面试题

## Spring Boot自动配置原理是什么？

SpringBoot 项目的一切都要从 @SpringBootApplication 这个注解开始说起。

@SpringBootApplication 标注在某个类上说明：

* 这个类是 SpringBoot 的主配置类。
* SpringBoot 就应该运行这个类的 main 方法来启动 SpringBoot 应用。

```java
@SpringBootConfiguration 
@EnableAutoConfiguration 
@ComponentScan( excludeFilters = {@Filter( type = FilterType.CUSTOM, classes = {TypeExcludeFilter.class} ), @Filter( type = FilterType.CUSTOM, classes = {AutoConfigurationExcludeFilter.class} )} ) 
public @interface SpringBootApplication { 
```

可以看到 SpringBootApplication 注解是一个组合注解（关于组合注解文章的开头有讲到），其主要组合了一下三个注解：

* @SpringBootConfiguration：该注解表示这是一个 SpringBoot 的配置类，其实它就是一个 @Configuration 注解而已。
* @ComponentScan：开启组件扫描。
* @EnableAutoConfiguration：从名字就可以看出来，就是这个类开启自动配置的。嗯，自动配置的奥秘全都在这个注解里面。

```java
@AutoConfigurationPackage 
@Import({AutoConfigurationImportSelector.class}) 
public @interface EnableAutoConfiguration { 
```

@AutoConfigurationPackage 注解就是将主配置类（@SpringBootConfiguration标注的类）的所在包及下面所有子包里面的所有组件扫描到Spring容器中。所以说，默认情况下主配置类包及子包以外的组件，Spring 容器是扫描不到的。

AutoConfigurationImportSelector会扫描所有jar路径下的`META-INF/spring.factories`，将其文件包装成Properties对象。从Properties对象获取到key值为`EnableAutoConfiguration`的数据，然后添加到容器里。

