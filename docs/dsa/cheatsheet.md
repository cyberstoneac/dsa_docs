# 📋 DSA Cheat Sheet

A one-page quick reference for **complexities**, **patterns**, and **common tricks**. Bookmark this page for revision.

---

## ⏱️ Time Complexity — Data Structures

| Structure | Access | Search | Insert | Delete | Space |
|-----------|:------:|:------:|:------:|:------:|:-----:|
| **Array** | O(1) | O(n) | O(n) | O(n) | O(n) |
| **Dynamic Array** | O(1) | O(n) | O(1)* | O(n) | O(n) |
| **Singly Linked List** | O(n) | O(n) | O(1) | O(1) | O(n) |
| **Doubly Linked List** | O(n) | O(n) | O(1) | O(1) | O(n) |
| **Stack** | O(n) | O(n) | O(1) | O(1) | O(n) |
| **Queue** | O(n) | O(n) | O(1) | O(1) | O(n) |
| **Deque** | O(1) | O(n) | O(1) | O(1) | O(n) |
| **Hash Table** | — | O(1)† | O(1)† | O(1)† | O(n) |
| **BST (balanced)** | O(log n) | O(log n) | O(log n) | O(log n) | O(n) |
| **BST (skewed)** | O(n) | O(n) | O(n) | O(n) | O(n) |
| **Heap (Min/Max)** | O(1) top | O(n) | O(log n) | O(log n) | O(n) |
| **Trie** | — | O(m) | O(m) | O(m) | O(n·m) |

`*` Amortized (rare resizing) &nbsp;&nbsp; `†` Average case

---

## 🔄 Sorting Algorithms

| Algorithm | Best | Average | Worst | Space | Stable? |
|-----------|:----:|:-------:|:-----:|:-----:|:-------:|
| **Bubble Sort** | O(n) | O(n²) | O(n²) | O(1) | ✅ |
| **Insertion Sort** | O(n) | O(n²) | O(n²) | O(1) | ✅ |
| **Selection Sort** | O(n²) | O(n²) | O(n²) | O(1) | ❌ |
| **Merge Sort** | O(n log n) | O(n log n) | O(n log n) | O(n) | ✅ |
| **Quick Sort** | O(n log n) | O(n log n) | O(n²) | O(log n) | ❌ |
| **Heap Sort** | O(n log n) | O(n log n) | O(n log n) | O(1) | ❌ |
| **Counting Sort** | O(n+k) | O(n+k) | O(n+k) | O(k) | ✅ |
| **Radix Sort** | O(nk) | O(nk) | O(nk) | O(n+k) | ✅ |

---

## 🧭 Graph Algorithms

| Algorithm | Time | Space | Use Case |
|-----------|:----:|:-----:|----------|
| **BFS** | O(V+E) | O(V) | Shortest path (unweighted), level-order |
| **DFS** | O(V+E) | O(V) | Cycle detection, topological sort, components |
| **Dijkstra** | O((V+E) log V) | O(V) | Shortest path (non-negative weights) |
| **Bellman-Ford** | O(VE) | O(V) | Shortest path (negative weights OK) |
| **Floyd-Warshall** | O(V³) | O(V²) | All-pairs shortest path |
| **Kruskal's MST** | O(E log E) | O(V) | Minimum spanning tree |
| **Prim's MST** | O(E log V) | O(V) | Minimum spanning tree (dense graphs) |
| **Topological Sort** | O(V+E) | O(V) | Task ordering (DAG only) |
| **Union-Find** | O(α(n)) ≈ O(1) | O(V) | Connectivity, cycle detection |
| **Tarjan's Bridge** | O(V+E) | O(V) | Critical connections |

---

## 🔍 Pattern Recognition Guide

| Problem Says… | Likely Pattern | Complexity |
|---------------|----------------|:----------:|
| Sorted array, find pair/triplet | Two Pointers | O(n) / O(n²) |
| Substring / subarray with condition | Sliding Window | O(n) |
| Search in sorted array | Binary Search | O(log n) |
| Minimum/maximum answer in range | Binary Search on Answer | O(n log range) |
| "K largest/smallest" | Heap | O(n log k) |
| Next greater/smaller element | Monotonic Stack | O(n) |
| All permutations/combinations | Backtracking | O(n!) / O(2ⁿ) |
| Overlapping intervals | Sort + Merge/Sweep | O(n log n) |
| Optimal substructure + overlap | Dynamic Programming | Depends |
| Local optimal → global optimal | Greedy | Depends |
| Prefix matching | Trie | O(m) |
| Frequency / duplicates | HashMap / HashSet | O(n) |
| Cycle in linked list | Fast & Slow Pointers | O(n) |
| Count/check bits | Bit Manipulation | O(1) / O(log n) |
| Number theory, primes | Maths (Sieve, GCD) | Varies |

---

## 🧩 Bit Manipulation Tricks

| Trick | Formula | Description |
|-------|---------|-------------|
| Check odd | `x & 1` | 1 if odd, 0 if even |
| Check power of 2 | `(x & (x-1)) == 0` | True if x is power of 2 |
| Isolate lowest set bit | `x & (-x)` | Extract rightmost 1 |
| Remove lowest set bit | `x & (x-1)` | Clear rightmost 1 |
| Set bit i | `x \| (1 << i)` | Turn bit i on |
| Clear bit i | `x & ~(1 << i)` | Turn bit i off |
| Toggle bit i | `x ^ (1 << i)` | Flip bit i |
| Check bit i | `(x >> i) & 1` | 1 if bit i is set |
| Multiply by 2 | `x << 1` | Left shift |
| Divide by 2 | `x >> 1` | Right shift (signed) |
| Unsigned divide by 2 | `x >>> 1` | Right shift (unsigned) |
| Swap without temp | `a ^= b; b ^= a; a ^= b;` | XOR swap |

---

## 📐 Maths Essentials

| Concept | Formula | Notes |
|---------|---------|-------|
| GCD | `gcd(a, b) = gcd(b, a % b)` | Euclidean algorithm |
| LCM | `a * b / gcd(a, b)` | Divide first to avoid overflow |
| Modular addition | `(a + b) % m` | Keep numbers small |
| Modular multiplication | `(a * b) % m` | `(a % m) * (b % m) % m` |
| Fast power | `pow(a, n)` in O(log n) | Binary exponentiation |
| Digital root | `1 + (n-1) % 9` | Repeated digit sum (n > 0) |
| Sieve of Eratosthenes | O(n log log n) | All primes up to n |
| Prime check | O(√n) | Trial division to √n |
| Trailing zeros in n! | `n/5 + n/25 + n/125 + …` | Count factors of 5 |
| Catalan number | `C(n) = (2n)! / ((n+1)! · n!)` | Count of BSTs, parenthesis |

---

## ⚡ Complexity Hierarchy

```
O(1) < O(log n) < O(√n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!)
```

**Rule of thumb for interview problems:**
- n ≤ 10 → O(n!) or O(2ⁿ) is fine
- n ≤ 20 → O(2ⁿ) is fine
- n ≤ 100 → O(n³) is fine
- n ≤ 1,000 → O(n²) is fine
- n ≤ 100,000 → O(n log n) or O(n) needed
- n ≤ 1,000,000 → O(n) or O(log n) needed

---

## 🧠 Common Interview Patterns

### 1. Sliding Window (O(n))
```java
int left = 0;
for (int right = 0; right < n; right++) {
    // add nums[right]
    while (invalid) {
        // remove nums[left]
        left++;
    }
    // update answer
}
```

### 2. Two Pointers (O(n))
```java
int left = 0, right = n - 1;
while (left < right) {
    if (sum == target) { /* found */ }
    else if (sum < target) left++;
    else right--;
}
```

### 3. Binary Search (O(log n))
```java
int left = 0, right = n - 1;
while (left <= right) {
    int mid = left + (right - left) / 2;
    if (nums[mid] == target) return mid;
    else if (nums[mid] < target) left = mid + 1;
    else right = mid - 1;
}
return -1;
```

### 4. BFS (O(V+E))
```java
Queue<Node> queue = new LinkedList<>();
Set<Node> visited = new HashSet<>();
queue.offer(start);
visited.add(start);
while (!queue.isEmpty()) {
    Node curr = queue.poll();
    for (Node neighbor : curr.neighbors) {
        if (visited.add(neighbor)) {
            queue.offer(neighbor);
        }
    }
}
```

### 5. DFS (O(V+E))
```java
void dfs(Node node, Set<Node> visited) {
    if (node == null || !visited.add(node)) return;
    for (Node neighbor : node.neighbors) {
        dfs(neighbor, visited);
    }
}
```

### 6. Backtracking (O(n!))
```java
void backtrack(State state, List<Result> result) {
    if (isComplete(state)) {
        result.add(new Result(state));
        return;
    }
    for (Choice choice : state.choices()) {
        if (isValid(choice)) {
            state.apply(choice);
            backtrack(state, result);
            state.undo(choice);
        }
    }
}
```

### 7. Dynamic Programming (1D)
```java
int[] dp = new int[n + 1];
dp[0] = baseCase;
for (int i = 1; i <= n; i++) {
    dp[i] = recurrence(dp, i);
}
return dp[n];
```

### 8. Dynamic Programming (2D)
```java
int[][] dp = new int[m + 1][n + 1];
// fill base cases
for (int i = 1; i <= m; i++) {
    for (int j = 1; j <= n; j++) {
        dp[i][j] = recurrence(dp, i, j);
    }
}
return dp[m][n];
```

---

## 🎯 Interview Tips

- **Clarify before coding** — ask about constraints, edge cases, duplicates
- **Talk through your approach** — interviewers want to see your thought process
- **Start with brute force** — then optimize; mention trade-offs
- **Check edge cases** — empty input, single element, all duplicates
- **Analyze complexity** — state time and space before coding
- **Test your code** — walk through a small example manually
- **Watch for overflow** — use `long` when multiplying large numbers
- **Use `.equals()` for objects** — not `==` for Integer/String
- **Prefer clean code** — meaningful names > clever one-liners

---

## 🔗 Useful Resources

- [NeetCode 150](https://neetcode.io/practice) — Curated problem list
- [LeetCode](https://leetcode.com/) — Practice platform
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/) — Visual complexity charts
- [VisuAlgo](https://visualgo.net/) — Algorithm visualizations

---

> 💡 **Tip:** Don't memorize — understand. Patterns repeat; problems don't.