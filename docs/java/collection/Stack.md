# Stack 源码分析

`Stack`是Java中的栈实现，它继承自`Vector`，在`Vector`的基础上增加了栈的相关操作方法，即`push`、`pop`、`peek`、`empty`、`search`等方法。

代码比较简单，直接贴出来。

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