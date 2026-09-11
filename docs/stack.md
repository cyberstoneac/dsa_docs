# Stack

## Key Concepts
- LIFO (Last In First Out) data structure
- Push (add) and Pop (remove) from top
- **Time Complexity**: O(1) for push/pop/peek
- **Space Complexity**: O(n) for storage

## Common Problems
- Valid Parentheses
- Next Greater Element
- Min Stack (track minimum efficiently)
- Evaluate Reverse Polish Notation
- Largest Rectangle in Histogram

## Patterns / Techniques
- Monotonic Stack (maintain increasing/decreasing order)
- Stack with Auxiliary Data Structure
- Using Stack for Recursion/DFS

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Valid Parentheses**
**Explanation**: Use stack to track opening brackets. For each closing bracket, check if it matches top of stack. If matches, pop. If doesn't match or stack empty when needed, return false. Stack should be empty at end. Time: O(n), Space: O(n).

```java
public boolean isValid(String s) {
    Stack<Character> stack = new Stack<>();
    HashMap<Character, Character> map = new HashMap<>();
    map.put(')', '(');
    map.put(']', '[');
    map.put('}', '{');
    
    for (char c : s.toCharArray()) {
        if (map.containsKey(c)) {
            if (stack.isEmpty() || stack.pop() != map.get(c)) {
                return false;
            }
        } else {
            stack.push(c);
        }
    }
    
    return stack.isEmpty();
}
```

**Similar Pattern Problems**: Valid Parentheses II, Check if Balanced

---

#### 2. **Min Stack**
**Explanation**: Maintain two stacks - one for values, one for tracking minimum at each level. When pushing, also push min(current, prev_min). When popping, pop from both stacks. Time: O(1) for all ops, Space: O(n).

```java
class MinStack {
    private Stack<Integer> stack;
    private Stack<Integer> minStack;
    
    public MinStack() {
        stack = new Stack<>();
        minStack = new Stack<>();
    }
    
    public void push(int val) {
        stack.push(val);
        minStack.push(Math.min(val, minStack.isEmpty() ? val : minStack.peek()));
    }
    
    public void pop() {
        stack.pop();
        minStack.pop();
    }
    
    public int top() {
        return stack.peek();
    }
    
    public int getMin() {
        return minStack.peek();
    }
}
```

**Similar Pattern Problems**: Max Stack, Stack with Duplicate Min

---

### Medium

#### 3. **Evaluate Reverse Polish Notation**
**Explanation**: Process tokens left to right. Numbers go to stack. When operator found, pop two operands, apply operation, push result back. Time: O(n), Space: O(n).

```java
public int evalRPN(String[] tokens) {
    Stack<Integer> stack = new Stack<>();
    
    for (String token : tokens) {
        if (token.equals("+") || token.equals("-") || token.equals("*") || token.equals("/")) {
            int b = stack.pop();
            int a = stack.pop();
            
            int result;
            switch (token) {
                case "+": result = a + b; break;
                case "-": result = a - b; break;
                case "*": result = a * b; break;
                case "/": result = a / b; break;
                default: result = 0;
            }
            stack.push(result);
        } else {
            stack.push(Integer.parseInt(token));
        }
    }
    
    return stack.pop();
}
```

**Similar Pattern Problems**: Basic Calculator, Expression Evaluation

---

#### 4. **Daily Temperatures**
**Explanation**: Monotonic stack approach. For each day, compare with stack top. If current temp > top's temp, found the answer for that day. Pop and compare again. Push current to stack. Time: O(n), Space: O(n).

```java
public int[] dailyTemperatures(int[] temperatures) {
    int n = temperatures.length;
    int[] result = new int[n];
    Stack<Integer> stack = new Stack<>(); // Store indices
    
    for (int i = 0; i < n; i++) {
        while (!stack.isEmpty() && temperatures[i] > temperatures[stack.peek()]) {
            int prevIndex = stack.pop();
            result[prevIndex] = i - prevIndex;
        }
        stack.push(i);
    }
    
    return result;
}
```

**Similar Pattern Problems**: Next Greater Element, Trapping Rain Water

---

#### 5. **Asteroid Collision**
**Explanation**: Use stack to track surviving asteroids. For each asteroid, check collision logic: if moving right, push to stack. If moving left, check with rightward asteroids in stack. Handle collisions by sizes. Time: O(n), Space: O(n).

```java
public int[] asteroidCollision(int[] asteroids) {
    Stack<Integer> stack = new Stack<>();
    
    for (int asteroid : asteroids) {
        boolean alive = true;
        
        while (alive && asteroid < 0 && !stack.isEmpty() && stack.peek() > 0) {
            int top = stack.pop();
            
            if (top < -asteroid) {
                continue; // Current survives
            } else if (top == -asteroid) {
                alive = false; // Both explode
            } else {
                alive = false;
                stack.push(top); // Top survives
            }
        }
        
        if (alive) {
            stack.push(asteroid);
        }
    }
    
    int[] result = new int[stack.size()];
    for (int i = result.length - 1; i >= 0; i--) {
        result[i] = stack.pop();
    }
    
    return result;
}
```

**Similar Pattern Problems**: Robot Collisions, Track Collisions

---

### Hard

#### 6. **Largest Rectangle in Histogram**
**Explanation**: Monotonic stack of indices maintaining increasing heights. When height decreases, pop indices and calculate area with popped bar as shortest. Time: O(n), Space: O(n).

```java
public int largestRectangleArea(int[] heights) {
    Stack<Integer> stack = new Stack<>();
    int maxArea = 0;
    
    for (int i = 0; i < heights.length; i++) {
        while (!stack.isEmpty() && heights[i] < heights[stack.peek()]) {
            int h = heights[stack.pop()];
            int w = stack.isEmpty() ? i : i - stack.peek() - 1;
            maxArea = Math.max(maxArea, h * w);
        }
        stack.push(i);
    }
    
    while (!stack.isEmpty()) {
        int h = heights[stack.pop()];
        int w = stack.isEmpty() ? heights.length : heights.length - stack.peek() - 1;
        maxArea = Math.max(maxArea, h * w);
    }
    
    return maxArea;
}
```

**Similar Pattern Problems**: Maximal Rectangle, Largest Rectangle with Rotations

---

#### 7. **Decode String**
**Explanation**: Stack stores characters. When ']' encountered, pop until '[', multiply by number before '['. Push result back. Handle nested patterns. Time: O(n*m) where m = multiplication factor, Space: O(n).

```java
public String decodeString(String s) {
    Stack<Object> stack = new Stack<>();
    int num = 0;
    
    for (char c : s.toCharArray()) {
        if (Character.isDigit(c)) {
            num = num * 10 + (c - '0');
        } else if (c == '[') {
            stack.push(num);
            stack.push("[");
            num = 0;
        } else if (c == ']') {
            StringBuilder sb = new StringBuilder();
            while (!stack.peek().equals("[")) {
                sb.insert(0, stack.pop());
            }
            stack.pop(); // Remove '['
            int count = (Integer) stack.pop();
            String decoded = sb.toString();
            for (int i = 0; i < count; i++) {
                stack.push(decoded);
            }
        } else {
            stack.push(String.valueOf(c));
        }
    }
    
    StringBuilder result = new StringBuilder();
    while (!stack.isEmpty()) {
        result.insert(0, stack.pop());
    }
    
    return result.toString();
}
```

**Similar Pattern Problems**: Nested List Weight Sum, Decode Ways

---

## 📌 Key Patterns & Techniques

### 1. **Monotonic Stack**
- Maintain stack in increasing or decreasing order
- Used for: Next Greater Element, Largest Rectangle
- Efficiently find nearest element with specific property

### 2. **Stack with Auxiliary Data**
- Pair stack with additional tracking (min/max)
- Used for: Min Stack, Max Stack
- O(1) operations for auxiliary queries

### 3. **Recursion to Iteration**
- Convert recursive algorithms to iterative using stack
- Used for: DFS, backtracking simulation

---

## 🎯 Common Pitfalls to Avoid

- ❌ Forgetting to check if stack is empty before peek/pop
- ❌ Confusing stack index for multiple stacks
- ❌ Not handling order correctly in monotonic stack
- ❌ Integer overflow in calculations
- ❌ Not clearing stack between test cases
