# 代理

## Java 代理

Java 代理可以分为静态代理和动态代理。

* 静态代理：在编码阶段显式编写代理类。
* 动态代理：在运行期间动态生成代理对象或代理类。

### 静态代理

静态代理通常体现为代理模式。代理类与被代理类实现同一个接口，代理类持有被代理类实例，并在代理方法中将调用转发给被代理对象。代理类可以在转发前后增加权限校验、日志记录、事务控制等增强逻辑。

**弊端**

如果需要为多个类型提供代理能力，通常需要编写多个代理类。随着接口和方法数量增加，代理类的维护成本会显著上升。

静态代理的问题根源在于代理关系在编译期已经确定。动态代理将代理类生成过程推迟到运行期，从而降低重复代理类的编写成本。

### 动态代理

JDK 动态代理基于接口生成代理对象。当代理对象的方法被调用时，调用会被分派到 `InvocationHandler.invoke()` 方法中，开发者可以在该方法中实现对目标方法的增强。

```java
// 1. 首先实现一个InvocationHandler，方法调用会被转发到该类的invoke()方法。
class LogInvocationHandler implements InvocationHandler{
    ...
    private Hello hello;
    public LogInvocationHandler(Hello hello) {
        this.hello = hello;
    }
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        if("sayHello".equals(method.getName())) {
            logger.info("You said: " + Arrays.toString(args));
        }
        return method.invoke(hello, args);
    }
}
// 2. 然后在需要使用Hello的时候，通过JDK动态代理获取Hello的代理对象。
Hello hello = (Hello)Proxy.newProxyInstance(
    getClass().getClassLoader(), // 1. 类加载器
    new Class<?>[] {Hello.class}, // 2. 代理需要实现的接口，可以有多个
    new LogInvocationHandler(new HelloImp()));// 3. 方法调用的实际处理者
System.out.println(hello.sayHello("I love you!"));
```

与静态代理相比，动态代理能够将通用代理逻辑集中到一个 `InvocationHandler` 中。当多个接口需要相同的横切逻辑时，可以复用同一套处理逻辑，避免为每个接口手工编写代理类。

JDK 动态代理生成的代理类具有以下特征：

* 代理类继承 `Proxy`，并实现目标接口。由于 Java 不支持多重类继承，因此 JDK 动态代理只能基于接口生成代理，不能直接代理普通类。
* 代理类持有 `InvocationHandler`，方法调用最终委托给 `InvocationHandler.invoke()`。
* 代理类会处理接口方法以及 `Object` 中的 `equals()`、`hashCode()`、`toString()` 等方法。

**弊端**

JDK 动态代理要求被代理对象至少实现一个接口。对于没有接口的普通类，不能直接使用 JDK 动态代理，需要考虑 CGLIB、Byte Buddy 等基于子类或字节码生成的方案。

### 动态代理与静态代理的区别

* 静态代理需要手工编写代理类，动态代理在运行期生成代理对象。
* 静态代理适合代理关系较少且结构稳定的场景，动态代理适合处理通用横切逻辑。
* 动态代理常用于 AOP、声明式事务、远程调用客户端等场景。
* 动态代理能够降低业务类与增强逻辑之间的耦合，使增强逻辑以较低侵入性的方式复用。

## CGLib

CGLIB 是一种基于继承的动态代理技术。其基本原理是为目标类生成子类，并在子类中重写可覆盖的方法，从而在方法调用前后织入增强逻辑。

由于 CGLIB 依赖继承机制，因此不能代理 `final` 类，也不能增强 `final` 方法、`private` 方法和无法被子类覆盖的方法。CGLIB 底层使用 ASM 操作字节码生成代理类。

## CGLIB 和 JDK 动态代理的区别

* JDK 动态代理基于接口生成代理类；CGLIB 基于目标类生成子类。
* JDK 动态代理适用于目标对象实现了接口的场景；CGLIB 适用于目标对象没有接口但允许被继承的场景。
* JDK 动态代理生成的代理类继承 `Proxy`；CGLIB 生成的代理类继承目标类。
* 性能差异与 JDK 版本、调用方式、代理逻辑复杂度有关，不能简单概括为某一种方案始终更快。现代 JDK 中，JDK 动态代理的性能已经有明显优化。
