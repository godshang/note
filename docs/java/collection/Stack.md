# Stack 源码分析

`Stack` 是 Java 早期提供的栈实现，继承自 `Vector`，并在其基础上增加了 `push`、`pop`、`peek`、`empty`、`search` 等栈操作方法。

由于 `Stack` 继承自 `Vector`，其方法带有同步语义，但该类属于较早期的集合类型。在新的代码中，如果需要栈结构，通常优先考虑使用 `Deque` 接口的实现，例如 `ArrayDeque`。

`Stack` 的核心源码如下：

```java
public
class Stack<E> extends Vector<E> {
    
    public Stack() {}

    public E push(E item) {
        addElement(item);

        return item;
    }

    public synchronized E pop() {
        E	obj;
        int	len = size();

        obj = peek();
        removeElementAt(len - 1);

        return obj;
    }

    public synchronized E peek() {
        int	len = size();

        if (len == 0)
            throw new EmptyStackException();
        return elementAt(len - 1);
    }

    public boolean empty() {
    	return size() == 0;
    }

    public synchronized int search(Object o) {
        int i = lastIndexOf(o);

        if (i >= 0) {
            return size() - i;
        }
        return -1;
    }

    /** use serialVersionUID from JDK 1.0.2 for interoperability */
    private static final long serialVersionUID = 1224463164541339165L;
}
```
