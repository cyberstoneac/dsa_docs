# Queue

## Key Concepts
- FIFO (First In First Out) data structure
- Enqueue (add) to rear, Dequeue (remove) from front
- **Time Complexity**: O(1) for enqueue/dequeue/peek
- **Space Complexity**: O(n) for storage

## Common Problems
- Implement Queue using Stacks
- Circular Queue
- Sliding Window Maximum
- Number of Recent Calls
- Reconstruct Queue by Height

## Patterns / Techniques
- Two Stacks for Queue (simulate with stacks)
- Double-ended Queue (Deque) for flexibility
- Level-order Traversal (BFS)
- Monotonic Queue (sliding window problems)

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Implement Queue using Stacks**
**Explanation**: Use two stacks - `pushStack` for enqueue, `popStack` for dequeue. When dequeuing, if popStack empty, push all elements from pushStack (reversed). Time: O(1) amortized, Space: O(n).

```java
class MyQueue {
    private Stack<Integer> pushStack;
    private Stack<Integer> popStack;
    
    public MyQueue() {
        pushStack = new Stack<>();
        popStack = new Stack<>();
    }
    
    public void push(int x) {
        pushStack.push(x);
    }
    
    public int pop() {
        if (popStack.isEmpty()) {
            while (!pushStack.isEmpty()) {
                popStack.push(pushStack.pop());
            }
        }
        return popStack.pop();
    }
    
    public int peek() {
        if (popStack.isEmpty()) {
            while (!pushStack.isEmpty()) {
                popStack.push(pushStack.pop());
            }
        }
        return popStack.peek();
    }
    
    public boolean empty() {
        return pushStack.isEmpty() && popStack.isEmpty();
    }
}
```

**Similar Pattern Problems**: Implement Deque using Arrays, Stack using Queues

---

#### 2. **Number of Recent Calls**
**Explanation**: Keep queue of recent timestamps. When new request comes, remove timestamps older than t-3000. Queue size is answer. Time: O(1) per operation, Space: O(n).

```java
class RecentCounter {
    private Queue<Integer> queue;
    
    public RecentCounter() {
        queue = new LinkedList<>();
    }
    
    public int ping(int t) {
        queue.offer(t);
        
        while (!queue.isEmpty() && queue.peek() < t - 3000) {
            queue.poll();
        }
        
        return queue.size();
    }
}
```

**Similar Pattern Problems**: Last N Orders, Expiring Map

---

### Medium

#### 3. **Sliding Window Maximum**
**Explanation**: Use deque (double-ended queue) storing indices. Maintain decreasing order of values. Remove indices outside window. Remove smaller values when new larger arrives. Front of deque is maximum. Time: O(n), Space: O(n).

```java
public int[] maxSlidingWindow(int[] nums, int k) {
    int n = nums.length;
    int[] result = new int[n - k + 1];
    Deque<Integer> deque = new LinkedList<>(); // Store indices
    
    for (int i = 0; i < n; i++) {
        // Remove indices outside window
        while (!deque.isEmpty() && deque.peekFirst() < i - k + 1) {
            deque.pollFirst();
        }
        
        // Remove smaller elements
        while (!deque.isEmpty() && nums[deque.peekLast()] < nums[i]) {
            deque.pollLast();
        }
        
        deque.offerLast(i);
        
        // Window is complete
        if (i >= k - 1) {
            result[i - k + 1] = nums[deque.peekFirst()];
        }
    }
    
    return result;
}
```

**Similar Pattern Problems**: Maximum of Minimum Subarrays, Max Consecutive Ones

---

#### 4. **Perfect Squares**
**Explanation**: BFS approach. Each number represents squared number (1², 2², 3²...). Find shortest path from n to 0 using BFS. Each step is subtracting a perfect square. Time: O(n * sqrt(n)), Space: O(n).

```java
public int numSquares(int n) {
    Queue<int[]> queue = new LinkedList<>(); // [value, steps]
    HashSet<Integer> visited = new HashSet<>();
    queue.offer(new int[]{n, 0});
    visited.add(n);
    
    while (!queue.isEmpty()) {
        int[] curr = queue.poll();
        int num = curr[0], steps = curr[1];
        
        if (num == 0) return steps;
        
        for (int i = 1; i * i <= num; i++) {
            int next = num - i * i;
            
            if (!visited.contains(next)) {
                visited.add(next);
                queue.offer(new int[]{next, steps + 1});
            }
        }
    }
    
    return -1;
}
```

**Similar Pattern Problems**: Minimum Path Sum, Word Ladder

---

#### 5. **Reconstruct Queue by Height**
**Explanation**: Sort by height descending, then position ascending. Insert each person at their specified position in result list. This works because all taller people are already inserted. Time: O(n log n + n²) = O(n²), Space: O(n).

```java
public int[][] reconstructQueue(int[][] people) {
    Arrays.sort(people, (a, b) -> 
        a[0] == b[0] ? a[1] - b[1] : b[0] - a[0]
    );
    
    List<int[]> result = new LinkedList<>();
    
    for (int[] person : people) {
        result.add(person[1], person);
    }
    
    return result.toArray(new int[result.size()][]);
}
```

**Similar Pattern Problems**: Create Sorted Array, Process Queue by Conditions

---

### Hard

#### 6. **Dota2 Senate**
**Explanation**: Use queue of team members. Process bans in order. If senator has ban from opponent, they're banned. Otherwise, they ban opponent and go to queue. Time: O(n), Space: O(n).

```java
public String predictPartyVictory(String senate) {
    Queue<Integer> radiant = new LinkedList<>();
    Queue<Integer> dire = new LinkedList<>();
    
    for (int i = 0; i < senate.length(); i++) {
        if (senate.charAt(i) == 'R') {
            radiant.offer(i);
        } else {
            dire.offer(i);
        }
    }
    
    while (!radiant.isEmpty() && !dire.isEmpty()) {
        int rIndex = radiant.poll();
        int dIndex = dire.poll();
        
        if (rIndex > dIndex) {
            radiant.offer(rIndex + senate.length());
        } else {
            dire.offer(dIndex + senate.length());
        }
    }
    
    return radiant.isEmpty() ? "Dire" : "Radiant";
}
```

**Similar Pattern Problems**: Robot Returning to Origin, Process Requests

---

## 📌 Key Patterns & Techniques

### 1. **Two Stack Queue**
- Use two stacks to simulate queue behavior
- Enqueue pushes to stack1
- Dequeue transfers to stack2 if needed

### 2. **Deque (Double-Ended Queue)**
- Add/remove from both ends
- Used for: Sliding window, monotonic queue

### 3. **BFS (Breadth-First Search)**
- Queue stores nodes to visit
- Used for: Shortest path, level-order traversal

### 4. **Monotonic Queue**
- Maintain specific order in deque
- Used for: Sliding window maximum, minimum

---

## 🎯 Common Pitfalls to Avoid

- ❌ Forgetting to check if queue is empty
- ❌ Confusing queue implementation (array vs linked list)
- ❌ Not maintaining proper deque invariants
- ❌ Off-by-one errors in window tracking
- ❌ Inefficient operations (avoid removals from middle)
