# Heap / Priority Queue

## Key Concepts
- **Min Heap**: Parent ≤ Children (smallest at top)
- **Max Heap**: Parent ≥ Children (largest at top)
- **Priority Queue**: Abstract data type with priority ordering
- **Heapify**: Maintain heap property after insertion/deletion
- **Heap Operations**: Insert O(log n), Delete O(log n), Peek O(1)
- **Array Representation**: Root at index 0, left child at 2i+1, right at 2i+2

## When to Use
- Find k largest/smallest elements
- Merge sorted lists/streams
- Scheduling problems (earliest deadline)
- Huffman coding, Dijkstra's algorithm
- Load balancing, system design

## Complexity
- Build heap: O(n)
- Insert: O(log n)
- Delete: O(log n)
- Heapify: O(log n)
- Space: O(n)

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Kth Largest Element in Array**
**Explanation**: Use min-heap of size k. When size > k, remove smallest. Remaining top is kth largest. Time: O(n log k), Space: O(k).

```java
public int findKthLargest(int[] nums, int k) {
    PriorityQueue<Integer> minHeap = new PriorityQueue<>();
    
    for (int num : nums) {
        minHeap.offer(num);
        if (minHeap.size() > k) {
            minHeap.poll();
        }
    }
    
    return minHeap.peek();
}
```

**Similar Pattern Problems**: Kth Smallest Element, K Closest Points

---

#### 2. **Last Stone Weight**
**Explanation**: Max heap. Pop two heaviest, if different push difference. Time: O(n log n), Space: O(n).

```java
public int lastStoneWeight(int[] stones) {
    PriorityQueue<Integer> maxHeap = new PriorityQueue<>((a, b) -> b - a);
    
    for (int stone : stones) {
        maxHeap.offer(stone);
    }
    
    while (maxHeap.size() > 1) {
        int first = maxHeap.poll();
        int second = maxHeap.poll();
        
        if (first != second) {
            maxHeap.offer(first - second);
        }
    }
    
    return maxHeap.isEmpty() ? 0 : maxHeap.peek();
}
```

**Similar Pattern Problems**: Last Stone Weight II, Relative Sort Array

---

### Medium

#### 3. **Kth Closest Points to Origin**
**Explanation**: Max heap of k closest points by distance. Time: O(n log k), Space: O(k).

```java
public int[][] kClosest(int[][] points, int k) {
    PriorityQueue<int[]> maxHeap = new PriorityQueue<>((a, b) -> 
        (b[0] * b[0] + b[1] * b[1]) - (a[0] * a[0] + a[1] * a[1])
    );
    
    for (int[] point : points) {
        maxHeap.offer(point);
        if (maxHeap.size() > k) {
            maxHeap.poll();
        }
    }
    
    int[][] result = new int[k][2];
    int index = 0;
    while (!maxHeap.isEmpty()) {
        result[index++] = maxHeap.poll();
    }
    
    return result;
}
```

**Similar Pattern Problems**: Top K Frequent Elements, K Closest Elements

---

#### 4. **Top K Frequent Elements**
**Explanation**: Count frequencies, use min-heap of size k. Time: O(n log k), Space: O(n).

```java
public int[] topKFrequent(int[] nums, int k) {
    Map<Integer, Integer> count = new HashMap<>();
    for (int num : nums) {
        count.put(num, count.getOrDefault(num, 0) + 1);
    }
    
    PriorityQueue<Integer> minHeap = new PriorityQueue<>((a, b) -> count.get(a) - count.get(b));
    
    for (int num : count.keySet()) {
        minHeap.offer(num);
        if (minHeap.size() > k) {
            minHeap.poll();
        }
    }
    
    int[] result = new int[k];
    int index = 0;
    while (!minHeap.isEmpty()) {
        result[index++] = minHeap.poll();
    }
    
    return result;
}
```

**Similar Pattern Problems**: Top K Frequent Words, Rearrange String K Distance Apart

---

#### 5. **Merge K Sorted Lists**
**Explanation**: Min-heap with list nodes. Pop smallest, add its next node. Time: O(n log k), Space: O(k).

```java
public ListNode mergeKLists(ListNode[] lists) {
    PriorityQueue<ListNode> minHeap = new PriorityQueue<>((a, b) -> a.val - b.val);
    
    for (ListNode list : lists) {
        if (list != null) {
            minHeap.offer(list);
        }
    }
    
    ListNode dummy = new ListNode(0);
    ListNode current = dummy;
    
    while (!minHeap.isEmpty()) {
        ListNode smallest = minHeap.poll();
        current.next = smallest;
        current = current.next;
        
        if (smallest.next != null) {
            minHeap.offer(smallest.next);
        }
    }
    
    return dummy.next;
}
```

**Similar Pattern Problems**: Merge Sorted Array, Merge K Sorted Arrays

---

#### 6. **Find Median from Data Stream**
**Explanation**: Max heap for smaller half, min heap for larger half. Time: O(log n), Space: O(n).

```java
class MedianFinder {
    private PriorityQueue<Integer> maxHeap;
    private PriorityQueue<Integer> minHeap;
    
    public MedianFinder() {
        maxHeap = new PriorityQueue<>((a, b) -> b - a);
        minHeap = new PriorityQueue<>();
    }
    
    public void addNum(int num) {
        if (maxHeap.isEmpty() || num <= maxHeap.peek()) {
            maxHeap.offer(num);
        } else {
            minHeap.offer(num);
        }
        
        if (maxHeap.size() > minHeap.size() + 1) {
            minHeap.offer(maxHeap.poll());
        }
        if (minHeap.size() > maxHeap.size()) {
            maxHeap.offer(minHeap.poll());
        }
    }
    
    public double findMedian() {
        if (maxHeap.size() > minHeap.size()) {
            return maxHeap.peek();
        }
        return (maxHeap.peek() + minHeap.peek()) / 2.0;
    }
}
```

**Similar Pattern Problems**: Find Median of BST, Find Mode in BST

---

### Hard

#### 7. **IPO (Maximum Capital)**
**Explanation**: Simulate projects sorted by capital. Max-heap of available projects. Time: O(n log n), Space: O(n).

```java
public int findMaximizedCapital(int k, int w, int[] profits, int[] capital) {
    int n = profits.length;
    Project[] projects = new Project[n];
    
    for (int i = 0; i < n; i++) {
        projects[i] = new Project(capital[i], profits[i]);
    }
    
    Arrays.sort(projects, (a, b) -> a.capital - b.capital);
    
    PriorityQueue<Integer> maxHeap = new PriorityQueue<>((a, b) -> b - a);
    int i = 0;
    
    for (int j = 0; j < k; j++) {
        while (i < n && projects[i].capital <= w) {
            maxHeap.offer(projects[i++].profit);
        }
        
        if (maxHeap.isEmpty()) break;
        w += maxHeap.poll();
    }
    
    return w;
}

class Project {
    int capital, profit;
    Project(int capital, int profit) {
        this.capital = capital;
        this.profit = profit;
    }
}
```

**Similar Pattern Problems**: Stock Market Prediction, Resource Allocation

---

## 📌 Key Patterns & Techniques

### 1. **K Largest/Smallest Pattern**
- Use min-heap for k largest (size k, peek is smallest of k largest)
- Use max-heap for k smallest (size k, peek is largest of k smallest)
- Keep heap size ≤ k

### 2. **Merge k Collections**
- Put first element from each collection in heap
- Pop smallest, add its next element
- Continue until heap empty

### 3. **Two Heap Pattern**
- Max heap for left half
- Min heap for right half
- Balance sizes for median/middle queries

### 4. **Lazy Deletion**
- Mark deleted items but keep in heap
- Check validity when popping
- Saves deletion cost

---

## 🎯 Common Pitfalls to Avoid

- ❌ Wrong comparator for min/max heap
- ❌ Heap not properly balanced
- ❌ Not handling heap size properly
- ❌ Comparison with null values
- ❌ Integer overflow in distance calculations
- ❌ Not updating heap after peek
