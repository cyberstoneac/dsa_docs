# Linked List

## Key Concepts
- Nodes pointing to next element (or previous in doubly linked)
- No random access (O(n) to reach element)
- **Time Complexity**: O(1) for insertion/deletion at known position, O(n) for search
- Efficient for insertions/deletions compared to arrays
- **Space Complexity**: O(n) for n nodes

## Variants
- Singly Linked List (next pointer only)
- Doubly Linked List (next and previous pointers)
- Circular Linked List (last node points to first)

## Common Problems
- Reverse a Linked List
- Detect Cycle (Floyd's Algorithm)
- Merge Two Sorted Lists
- Remove Nth Node From End
- LRU Cache (uses linked list + hashmap)

## Patterns / Techniques
- Fast and Slow Pointers
- Recursion
- Dummy Node (simplifies code)
- Two-Pass Algorithm

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Reverse Linked List**
**Explanation**: Iterative approach with three pointers. Previous starts as null, current at head. Reverse link, then move pointers forward. Time: O(n), Space: O(1).

```java
public ListNode reverseList(ListNode head) {
    ListNode prev = null, curr = head;
    
    while (curr != null) {
        ListNode next = curr.next; // Save next
        curr.next = prev;           // Reverse link
        prev = curr;                // Move prev
        curr = next;                // Move curr
    }
    
    return prev;
}
```

**Similar Pattern Problems**: Reverse List II, Reverse Nodes in K-Group

---

#### 2. **Merge Two Sorted Lists**
**Explanation**: Use dummy node, two pointers on both lists. Compare values, add smaller to result, move that pointer. Add remaining nodes at end. Time: O(m+n), Space: O(1).

```java
public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
    ListNode dummy = new ListNode(0);
    ListNode curr = dummy;
    
    while (list1 != null && list2 != null) {
        if (list1.val < list2.val) {
            curr.next = list1;
            list1 = list1.next;
        } else {
            curr.next = list2;
            list2 = list2.next;
        }
        curr = curr.next;
    }
    
    curr.next = (list1 != null) ? list1 : list2;
    return dummy.next;
}
```

**Similar Pattern Problems**: Merge K Sorted Lists, Merge Multiple Lists

---

#### 3. **Delete Node in a Linked List**
**Explanation**: Copy next node's value to current, then skip next node (remove it). Works because we can't access previous in given constraint. Time: O(1), Space: O(1).

```java
public void deleteNode(ListNode node) {
    node.val = node.next.val;
    node.next = node.next.next;
}
```

**Similar Pattern Problems**: Delete Node II, Unlink Nodes

---

#### 4. **Remove Nth Node From End of List**
**Explanation**: Two-pass or two-pointer approach. Fast pointer goes n steps ahead. Both move together until fast reaches end. Use dummy for edge case (removing head). Time: O(n), Space: O(1).

```java
public ListNode removeNthFromEnd(ListNode head, int n) {
    ListNode dummy = new ListNode(0);
    dummy.next = head;
    ListNode fast = dummy, slow = dummy;
    
    // Move fast n+1 steps ahead
    for (int i = 0; i <= n; i++) {
        fast = fast.next;
    }
    
    // Move both until fast reaches end
    while (fast != null) {
        fast = fast.next;
        slow = slow.next;
    }
    
    slow.next = slow.next.next;
    return dummy.next;
}
```

**Similar Pattern Problems**: Remove Kth Element, Remove Elements

---

#### 5. **Linked List Cycle**
**Explanation**: Floyd's cycle detection (fast and slow pointers). Fast moves 2 steps, slow moves 1 step. If they meet, cycle exists. Time: O(n), Space: O(1).

```java
public boolean hasCycle(ListNode head) {
    ListNode fast = head, slow = head;
    
    while (fast != null && fast.next != null) {
        fast = fast.next.next;
        slow = slow.next;
        
        if (fast == slow) {
            return true;
        }
    }
    
    return false;
}
```

**Similar Pattern Problems**: Detect Cycle II (find start), Cycle Length

---

### Medium

#### 6. **Add Two Numbers**
**Explanation**: Traverse both lists simultaneously, add digits with carry. Create new node for each sum digit. Handle final carry. Time: O(max(m,n)), Space: O(max(m,n)).

```java
public ListNode addTwoNumbers(ListNode l1, ListNode l2) {
    ListNode dummy = new ListNode(0);
    ListNode curr = dummy;
    int carry = 0;
    
    while (l1 != null || l2 != null || carry != 0) {
        int sum = (l1 != null ? l1.val : 0) + (l2 != null ? l2.val : 0) + carry;
        carry = sum / 10;
        curr.next = new ListNode(sum % 10);
        curr = curr.next;
        
        l1 = (l1 != null) ? l1.next : null;
        l2 = (l2 != null) ? l2.next : null;
    }
    
    return dummy.next;
}
```

**Similar Pattern Problems**: Add Two Numbers II, Multiply Two Lists

---

#### 7. **Sort List (Merge Sort)**
**Explanation**: Divide using slow/fast pointers, then merge sorted halves. Time: O(n log n), Space: O(log n) for recursion stack.

```java
public ListNode sortList(ListNode head) {
    if (head == null || head.next == null) return head;
    
    ListNode mid = getMid(head);
    ListNode midNext = mid.next;
    mid.next = null;
    
    ListNode left = sortList(head);
    ListNode right = sortList(midNext);
    
    return merge(left, right);
}

private ListNode getMid(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
    }
    return slow;
}

private ListNode merge(ListNode l1, ListNode l2) {
    ListNode dummy = new ListNode(0);
    ListNode curr = dummy;
    
    while (l1 != null && l2 != null) {
        if (l1.val < l2.val) {
            curr.next = l1;
            l1 = l1.next;
        } else {
            curr.next = l2;
            l2 = l2.next;
        }
        curr = curr.next;
    }
    
    curr.next = (l1 != null) ? l1 : l2;
    return dummy.next;
}
```

**Similar Pattern Problems**: Quick Sort Linked List, Insertion Sort List

---

#### 8. **Copy List with Random Pointer**
**Explanation**: Two-pass: first pass creates nodes and stores mapping. Second pass copies links. Or use interweaving to avoid extra hashmap. Time: O(n), Space: O(n).

```java
public Node copyRandomList(Node head) {
    HashMap<Node, Node> map = new HashMap<>();
    Node curr = head;
    
    // First pass: create all nodes
    while (curr != null) {
        map.put(curr, new Node(curr.val));
        curr = curr.next;
    }
    
    // Second pass: set pointers
    curr = head;
    while (curr != null) {
        map.get(curr).next = map.get(curr.next);
        map.get(curr).random = map.get(curr.random);
        curr = curr.next;
    }
    
    return map.get(head);
}
```

**Similar Pattern Problems**: Deep Copy Graph, Clone Tree

---

#### 9. **Reorder List**
**Explanation**: Find middle, reverse second half, merge alternately. Time: O(n), Space: O(1).

```java
public void reorderList(ListNode head) {
    ListNode mid = getMid(head);
    ListNode second = mid.next;
    mid.next = null;
    
    second = reverse(second);
    merge(head, second);
}

private void merge(ListNode l1, ListNode l2) {
    while (l1 != null) {
        ListNode l1Next = l1.next;
        ListNode l2Next = l2.next;
        
        l1.next = l2;
        l1 = l1Next;
        
        if (l1 != null) {
            l2.next = l1;
            l2 = l2Next;
        }
    }
}
```

**Similar Pattern Problems**: Reorder Deque, Zigzag Traversal

---

### Hard

#### 10. **Merge k Sorted Lists**
**Explanation**: Use min heap (priority queue) with head of each list. Pop min, add to result, push next node from same list. Time: O(n log k), Space: O(k).

```java
public ListNode mergeKLists(ListNode[] lists) {
    PriorityQueue<ListNode> pq = new PriorityQueue<>((a, b) -> a.val - b.val);
    
    for (ListNode list : lists) {
        if (list != null) pq.offer(list);
    }
    
    ListNode dummy = new ListNode(0);
    ListNode curr = dummy;
    
    while (!pq.isEmpty()) {
        ListNode node = pq.poll();
        curr.next = node;
        curr = curr.next;
        
        if (node.next != null) {
            pq.offer(node.next);
        }
    }
    
    return dummy.next;
}
```

**Similar Pattern Problems**: Merge Multiple Streams, K-way Merge

---

#### 11. **LRU Cache**
**Explanation**: Doubly linked list + HashMap. HashMap stores key→node mapping. Doubly linked list maintains LRU order. On access, move node to front. Time: O(1), Space: O(capacity).

```java
class LRUCache {
    private int capacity;
    private HashMap<Integer, Node> map;
    private Node head, tail;
    
    class Node {
        int key, val;
        Node prev, next;
    }
    
    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.map = new HashMap<>();
        this.head = new Node();
        this.tail = new Node();
        head.next = tail;
        tail.prev = head;
    }
    
    public int get(int key) {
        if (!map.containsKey(key)) return -1;
        Node node = map.get(key);
        moveToFront(node);
        return node.val;
    }
    
    public void put(int key, int value) {
        if (map.containsKey(key)) {
            Node node = map.get(key);
            node.val = value;
            moveToFront(node);
        } else {
            if (map.size() == capacity) {
                removeLast();
            }
            Node node = new Node();
            node.key = key;
            node.val = value;
            map.put(key, node);
            addToFront(node);
        }
    }
    
    private void moveToFront(Node node) {
        removeNode(node);
        addToFront(node);
    }
    
    private void addToFront(Node node) {
        node.next = head.next;
        node.prev = head;
        head.next.prev = node;
        head.next = node;
    }
    
    private void removeNode(Node node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }
    
    private void removeLast() {
        Node last = tail.prev;
        removeNode(last);
        map.remove(last.key);
    }
}
```

**Similar Pattern Problems**: LFU Cache, Time-based Key-Value Store

---

## 📌 Key Patterns & Techniques

### 1. **Fast and Slow Pointers**
- Detect cycle, find middle, find kth node
- Fast moves 2 steps, slow moves 1

### 2. **Dummy Node**
- Simplifies edge cases (removing head, merging)
- Always has dummy point to head

### 3. **Reversal**
- Reverse links to change direction
- Used in reordering, palindrome checks

### 4. **Two-Pass Algorithm**
- First pass gathers info
- Second pass uses info for solution

---

## 🎯 Common Pitfalls to Avoid

- ❌ Forgetting to handle null pointers
- ❌ Creating cycles accidentally (breaking links correctly)
- ❌ Not using dummy node when helpful
- ❌ Off-by-one errors with fast/slow pointers
- ❌ Not updating pointers correctly during reversal