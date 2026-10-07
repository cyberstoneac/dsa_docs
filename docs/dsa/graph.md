---
tags:
  - graph
  - bfs
  - dfs
  - dijkstra
  - union-find
  - topological-sort
  - mst
  - neetcode-150
---

# Graph

## What is a Graph? (Simple Explanation)
Imagine a map of cities connected by roads:
- **Cities** = Vertices (also called nodes)
- **Roads** = Edges (connections between cities)

A graph is just a way to represent connections between things. It could be:

- Friends on social media (who knows whom)
- Web pages linking to each other
- Flights between airports
- Prerequisites between courses

## Key Concepts (In Simple Terms)
- **Vertex (Node)**: A single point/entity in the graph
- **Edge**: A connection between two vertices
- **Directed Graph**: Roads are one-way (like a one-way street)
- **Undirected Graph**: Roads are two-way (like a normal street)
- **Weighted Graph**: Each road has a cost/distance/time
- **Path**: A sequence of vertices connected by edges
- **Cycle**: A path that starts and ends at the same vertex (like a round trip)
- **Connected Component**: A group of vertices where everyone can reach everyone else
- **DAG**: Directed Acyclic Graph - directed graph with no cycles (like a family tree)

## How to Store a Graph (Representation)

### 1. Adjacency List (Most Common)
Think of it like a contact list: for each person, list who they know.
```
0 -> [1, 2]
1 -> [0, 3]
2 -> [0]
3 -> [1]
```
Uses less memory. Best for sparse graphs.

### 2. Adjacency Matrix
Think of it like a table with checkmarks: row i, column j = 1 if connected.
```
   0  1  2  3
0  0  1  1  0
1  1  0  0  1
2  1  0  0  0
3  0  1  0  0
```
Fast to check "are these connected?" but uses O(V^2) memory.

### 3. Edge List
Just a list of all connections.
```
[[0,1], [0,2], [1,3]]
```
Useful for algorithms like Kruskal's.

## Common Algorithms (What They Do)

| Algorithm | What It Does | Real-Life Analogy |
|-----------|--------------|-------------------|
| BFS | Explores level by level | Ripples in water |
| DFS | Goes deep before coming back | Exploring a maze |
| Dijkstra | Shortest path with weights | GPS navigation |
| Union-Find | Groups connected things | Merging friend circles |
| Topological Sort | Orders tasks by dependencies | Course prerequisites |

## Patterns / Techniques
- BFS for shortest path (unweighted)
- DFS for cycle detection and connectivity
- Union-Find for grouping/merging
- Heap for Dijkstra
- Graph coloring for bipartite checks
- Backtracking for finding all paths

---

## 🔹 Basic Templates

### BFS Template
```java
public void bfs(int start, List<List<Integer>> graph) {
    Queue<Integer> queue = new LinkedList<>();
    boolean[] visited = new boolean[graph.size()];
    queue.offer(start);
    visited[start] = true;
    while (!queue.isEmpty()) {
        int node = queue.poll();
        for (int neighbor : graph.get(node)) {
            if (!visited[neighbor]) {
                visited[neighbor] = true;
                queue.offer(neighbor);
            }
        }
    }
}
```

### DFS Template
```java
public void dfs(int node, List<List<Integer>> graph, boolean[] visited) {
    visited[node] = true;
    for (int neighbor : graph.get(node)) {
        if (!visited[neighbor]) {
            dfs(neighbor, graph, visited);
        }
    }
}
```

### BFS vs DFS Decision Flow
```mermaid
graph TD
    A["Graph Problem"] --> B{"Need shortest path?"}
    B -->|Yes| C["Use BFS"]
    B -->|No| D{"Need to explore deeply?"}
    D -->|Yes| E["Use DFS"]
    D -->|No| F{"Need to group connected nodes?"}
    F -->|Yes| G["Use Union-Find"]
    F -->|No| H{"Need shortest weighted path?"}
    H -->|Yes| I["Use Dijkstra"]
    H -->|No| J["Consider Topological Sort or other"]
```

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Number of Islands**

**Problem Description:**
You have a 2D grid of '1's (land) and '0's (water). Count how many islands there are. An island is land connected horizontally or vertically (not diagonally).

**Simple Analogy:**
Imagine a map where '1' is land and '0' is water. You want to count how many separate landmasses exist.

**Example Walkthrough:**

Input:
```
grid = [
  ['1','1','0','0','0'],
  ['1','1','0','0','0'],
  ['0','0','1','0','0'],
  ['0','0','0','1','1']
]
```
```
Expected Output: 3

Visual:
1 1 0 0 0
1 1 0 0 0     <- Island 1 (top-left block)
0 0 1 0 0     <- Island 2 (single cell)
0 0 0 1 1     <- Island 3 (bottom-right pair)

How DFS works:
Start at (0,0) = '1':
  Mark as '0' (visited)
  Explore all 4 directions recursively
  This visits the entire top-left island
  count = 1

Continue scanning:
(0,1) already '0' (visited)
(0,2) = '0' skip
...
(2,2) = '1':
  Mark as '0', explore -> just one cell
  count = 2

(3,3) = '1':
  Mark as '0', explore -> visits (3,4) too
  count = 3

Return 3
```

Input:
```
grid = [
  ['1','1','1'],
  ['0','1','0'],
  ['1','1','1']
]
```
```
Expected Output: 1 (all land is connected)

1 1 1
0 1 0     <- All connected through center
1 1 1
```

**Key Insight - Sink the Island:**

When we find land ('1'), we start a DFS that "sinks" the entire island by changing all connected '1's to '0's. Then we count how many times we had to start a new DFS.

**Why It Works:**

- Each DFS call marks an entire connected component
- After marking, those cells won't trigger another count
- Number of DFS calls = number of islands
- Grid boundaries and '0' cells stop the recursion

**Visualization - Island Counting:**
```mermaid
graph TD
    A["Scan grid cell by cell"] --> B{"Found '1'?"}
    B -->|No| C["Move to next cell"]
    B -->|Yes| D["Start DFS, count++"]
    D --> E["Mark all connected '1' as '0'"]
    E --> F["Continue scanning"]
    C --> F
    F --> G{"More cells?"}
    G -->|Yes| A
    G -->|No| H["Return count"]
```

```java
public int numIslands(char[][] grid) {
    if (grid == null || grid.length == 0) return 0;
    int count = 0;
    for (int i = 0; i < grid.length; i++) {
        for (int j = 0; j < grid[0].length; j++) {
            if (grid[i][j] == '1') {
                dfs(grid, i, j);
                count++;
            }
        }
    }
    return count;
}

private void dfs(char[][] grid, int i, int j) {
    if (i < 0 || i >= grid.length || j < 0 || j >= grid[0].length || grid[i][j] == '0') {
        return;
    }
    grid[i][j] = '0';
    dfs(grid, i + 1, j);
    dfs(grid, i - 1, j);
    dfs(grid, i, j + 1);
    dfs(grid, i, j - 1);
}
```

**Edge Cases:**

- Empty grid: returns 0
- All water: returns 0
- All land: returns 1
- Single cell '1': returns 1

**Time Complexity**: O(m * n) - visit each cell once

**Space Complexity**: O(m * n) - recursion stack in worst case

**Similar Pattern Problems:**

- Max Area of Island
- Number of Connected Components
- Surrounded Regions

---

#### 2. **Flood Fill**

**Problem Description:**
You have an image (2D grid of colors). Starting from a pixel, change its color and the color of all connected pixels of the same original color to a new color. Like the paint bucket tool in MS Paint.

**Simple Analogy:**
Think of clicking "fill" in a drawing app. The color spreads to all connected same-colored pixels.

**Example Walkthrough:**

Input: `image = [[1,1,1],[1,1,0],[1,0,1]]`, `sr = 1, sc = 1`, `color = 2`
```
Expected Output: [[2,2,2],[2,2,0],[2,0,1]]

Original:
1 1 1
1 1 0
1 0 1

Start at (1,1) which is 1, change to 2:
DFS spreads to all connected 1s:

2 2 2
2 2 0
2 0 1

The '0's and the bottom-right '1' (not connected) stay unchanged.
```

Input: `image = [[0,0,0],[0,0,0]]`, `sr = 0, sc = 0`, `color = 0`
```
Expected Output: [[0,0,0],[0,0,0]]

Original color = 0, new color = 0
No change needed (already the target color)
```

**Key Insight - Same as Island Counting:**

This is almost identical to Number of Islands. Instead of counting, we just change colors. The key check is: only change pixels that match the ORIGINAL color.

**Why It Works:**

- Start DFS from the given pixel
- Change its color to new color
- Recursively visit all 4 neighbors
- Only continue if neighbor has the original color
- This naturally spreads to the entire connected region

**Visualization - Flood Fill:**
```mermaid
graph TD
    A["Start at (sr, sc)"] --> B{"Is it original color?"}
    B -->|No| C["Stop, return"]
    B -->|Yes| D["Change to new color"]
    D --> E["Visit 4 neighbors"]
    E --> F["Repeat for each"]
```

```java
public int[][] floodFill(int[][] image, int sr, int sc, int color) {
    int original = image[sr][sc];
    if (original != color) {
        dfs(image, sr, sc, original, color);
    }
    return image;
}

private void dfs(int[][] image, int i, int j, int original, int color) {
    if (i < 0 || i >= image.length || j < 0 || j >= image[0].length || image[i][j] != original) {
        return;
    }
    image[i][j] = color;
    dfs(image, i + 1, j, original, color);
    dfs(image, i - 1, j, original, color);
    dfs(image, i, j + 1, original, color);
    dfs(image, i, j - 1, original, color);
}
```

**Edge Cases:**

- New color same as original: return unchanged (avoid infinite loop)
- Single pixel: changes it
- All same color: changes all
- No matching neighbors: changes only the starting pixel

**Time Complexity**: O(m * n)

**Space Complexity**: O(m * n) recursion stack

**Similar Pattern Problems:**

- Surrounded Regions
- Pacific Atlantic Water Flow
- Number of Islands

---

#### 3. **Clone Graph**

**Problem Description:**
Given a reference to a node in a connected undirected graph, return a deep copy (clone) of the graph. Each node has a value and a list of neighbors.

**Simple Analogy:**
Like photocopying a network of friends. You need to create entirely new nodes, not just reference the old ones.

**Example Walkthrough:**

Input:
```
Graph: 1 -- 2
       |    |
       4 -- 3

adjList = [[2,4],[1,3],[2,4],[1,3]]
```
```
Expected Output: A deep copy of the same graph structure with new node objects

Step 1: Start at node 1
        Not in map -> create copy, put in map
        map = {1: copy1}

Step 2: Visit neighbor 2
        Not in map -> create copy, put in map
        map = {1: copy1, 2: copy2}
        copy1.neighbors.add(copy2)

Step 3: Visit neighbor 4 (from node 2's perspective)
        Not in map -> create copy
        map = {1: copy1, 2: copy2, 4: copy4}
        copy2.neighbors.add(copy4)

Step 4: Visit neighbor 1 (from node 4)
        Already in map -> use copy1
        copy4.neighbors.add(copy1)

... continues until all nodes visited
```

Input:
```
Graph: 1 (single node, no neighbors)

adjList = [[]]
```
```
Expected Output: A single node with no neighbors

Step 1: Create copy of node 1
        Return copy
```

**Key Insight - HashMap to Track Copies:**

Use a HashMap that maps original nodes to their copies. Before creating a copy, check if it already exists. This prevents infinite loops in cyclic graphs.

**Why It Works:**

- HashMap ensures we create exactly one copy per original node
- When we encounter an already-copied node, we reuse the copy
- DFS or BFS both work; DFS is simpler
- Handles cycles naturally because we check the map first

**Visualization - Clone Graph:**
```mermaid
graph TD
    A["Start at node"] --> B{"Already in map?"}
    B -->|Yes| C["Return existing copy"]
    B -->|No| D["Create new copy"]
    D --> E["Add to map"]
    E --> F["For each neighbor:"]
    F --> G["Recursively clone neighbor"]
    G --> H["Add cloned neighbor to copy's list"]
```

```java
public Node cloneGraph(Node node) {
    if (node == null) return null;
    Map<Node, Node> map = new HashMap<>();
    return dfs(node, map);
}

private Node dfs(Node node, Map<Node, Node> map) {
    if (map.containsKey(node)) return map.get(node);
    Node copy = new Node(node.val);
    map.put(node, copy);
    for (Node neighbor : node.neighbors) {
        copy.neighbors.add(dfs(neighbor, map));
    }
    return copy;
}
```

**Edge Cases:**

- Null node: return null
- Single node: return single copy
- Cyclic graph: handled by map
- Self-loop: handled by map

**Time Complexity**: O(V + E)

**Space Complexity**: O(V) for the map

**Similar Pattern Problems:**

- Copy List with Random Pointer
- Deep Copy of Binary Tree

---

#### 4. **Find the Town Judge**

**Problem Description:**
In a town of n people, the judge is someone who:
- Trusts nobody
- Is trusted by everyone else (n-1 people)

Given trust relationships trust[i] = [a, b] means a trusts b. Find the judge, or -1 if no judge.

**Simple Analogy:**
Like finding the most popular person who doesn't follow anyone back.

**Example Walkthrough:**

Input: `n = 3`, `trust = [[1,3],[2,3]]`
```
Expected Output: 3

Person 1 trusts 3
Person 2 trusts 3
Person 3 trusts nobody

Check person 3:
- Trusted by 2 people (1 and 2) = n-1 = 2 ✓
- Trusts 0 people ✓
Judge is 3
```

Input: `n = 3`, `trust = [[1,3],[2,3],[3,1]]`
```
Expected Output: -1

Person 1 trusts 3
Person 2 trusts 3
Person 3 trusts 1

Person 3 is trusted by 2 people BUT also trusts 1
So not a judge.
No other person is trusted by everyone.
Return -1
```

Input: `n = 1`, `trust = []`
```
Expected Output: 1

Only one person, trusts nobody, trusted by everyone (vacuously)
Person 1 is the judge.
```

**Key Insight - Two Counters:**

Track two things per person:

1. How many people they trust (out-degree)
2. How many people trust them (in-degree)

The judge has out-degree 0 and in-degree n-1.

**Why It Works:**

- Judge trusts nobody -> out-degree = 0
- Everyone else trusts judge -> in-degree = n-1
- Only one person can satisfy both conditions
- Simple counting, no graph traversal needed

**Visualization - Town Judge:**
```mermaid
graph TD
    A["trust = [[1,3],[2,3]]"] --> B["Count in-degrees and out-degrees"]
    B --> C["Person 1: in=0, out=1"]
    B --> D["Person 2: in=0, out=1"]
    B --> E["Person 3: in=2, out=0"]
    E --> F["Person 3 has in=n-1, out=0"]
    F --> G["Return 3"]
```

```java
public int findJudge(int n, int[][] trust) {
    int[] trustCount = new int[n + 1];
    int[] trustedCount = new int[n + 1];
    for (int[] t : trust) {
        trustedCount[t[0]]++;
        trustCount[t[1]]++;
    }
    for (int i = 1; i <= n; i++) {
        if (trustedCount[i] == 0 && trustCount[i] == n - 1) {
            return i;
        }
    }
    return -1;
}
```

**Edge Cases:**

- n = 1, no trust: returns 1
- No judge exists: returns -1
- Multiple potential judges: impossible (only one can have in-degree n-1)
- Self-trust: ignored (judge trusts nobody)

**Time Complexity**: O(n + E)

**Space Complexity**: O(n)

**Similar Pattern Problems:**

- Celebrity Problem
- Single Number

---

### Medium

#### 5. **Course Schedule (Cycle Detection)**

**Problem Description:**
You have numCourses courses to take. Some courses have prerequisites: [a, b] means you must take b before a. Can you finish all courses? (i.e., is there a valid ordering with no cycles?)

**Simple Analogy:**
Like checking if a set of tasks with dependencies can be completed. If A needs B and B needs A, it's impossible.

**Example Walkthrough:**

Input: `numCourses = 4`, `prerequisites = [[1,0],[2,1],[3,2]]`
```
Expected Output: true

Course 0 -> Course 1 -> Course 2 -> Course 3
(0 has no prereqs, then 1, then 2, then 3)

Step-by-step (Kahn's algorithm / BFS):
In-degrees: 0:0, 1:1, 2:1, 3:1

Queue initially: [0]
Process 0: count=1, reduce in-degree of 1 -> 0, add 1 to queue
Process 1: count=2, reduce in-degree of 2 -> 0, add 2 to queue
Process 2: count=3, reduce in-degree of 3 -> 0, add 3 to queue
Process 3: count=4, queue empty

count (4) == numCourses (4) -> Return true
```

Input: `numCourses = 2`, `prerequisites = [[1,0],[0,1]]`
```
Expected Output: false

Course 1 needs 0, Course 0 needs 1
Circular dependency!

In-degrees: 0:1, 1:1
Queue initially: [] (no course has in-degree 0)
count = 0 != 2 -> Return false
```

**Key Insight - In-Degree and Queue:**

Think of courses as nodes and prerequisites as directed edges. A course with no prerequisites (in-degree 0) can be taken first. Remove it, which might free up other courses. If we can remove all courses, no cycle.

**Why It Works:**

- A cycle means some courses can never have in-degree 0
- Kahn's algorithm removes nodes with in-degree 0 one by one
- If we process all nodes, no cycle exists (can finish)
- If some remain, there's a cycle (can't finish)
- This is topological sorting in disguise

**Visualization - Course Schedule:**
```mermaid
graph TD
    A["Build graph and in-degrees"] --> B["Queue all nodes with in-degree 0"]
    B --> C{"Queue empty?"}
    C -->|No| D["Poll node, count++"]
    D --> E["Reduce in-degree of neighbors"]
    E --> F["Add neighbors with in-degree 0 to queue"]
    F --> C
    C -->|Yes| G{"count == numCourses?"}
    G -->|Yes| H["Return true (no cycle)"]
    G -->|No| I["Return false (cycle exists)"]
```

```java
public boolean canFinish(int numCourses, int[][] prerequisites) {
    int[] inDegree = new int[numCourses];
    List<List<Integer>> graph = new ArrayList<>();
    for (int i = 0; i < numCourses; i++) {
        graph.add(new ArrayList<>());
    }
    for (int[] prereq : prerequisites) {
        graph.get(prereq[1]).add(prereq[0]);
        inDegree[prereq[0]]++;
    }
    Queue<Integer> queue = new LinkedList<>();
    for (int i = 0; i < numCourses; i++) {
        if (inDegree[i] == 0) queue.offer(i);
    }
    int count = 0;
    while (!queue.isEmpty()) {
        int course = queue.poll();
        count++;
        for (int next : graph.get(course)) {
            inDegree[next]--;
            if (inDegree[next] == 0) queue.offer(next);
        }
    }
    return count == numCourses;
}
```

**Edge Cases:**

- No prerequisites: all courses can be taken
- Self-loop [0,0]: impossible
- Disconnected graph: still works
- Linear chain: always possible

**Time Complexity**: O(V + E)

**Space Complexity**: O(V + E)

**Similar Pattern Problems:**

- Course Schedule II (return the order)
- Alien Dictionary
- Topological Sort

---

#### 6. **Pacific Atlantic Water Flow**

**Problem Description:**
Given a 2D grid of heights, water can flow from a cell to adjacent cells with height <= current. The Pacific Ocean touches the top and left edges. The Atlantic touches the bottom and right edges. Find all cells where water can flow to BOTH oceans.

**Simple Analogy:**
Imagine rain falling on mountains. Water flows downhill. Which peaks can drain to both the west coast (Pacific) and east coast (Atlantic)?

**Example Walkthrough:**

Input:
```
heights = [
  [1,2,2,3,5],
  [3,2,3,4,4],
  [2,4,5,3,1],
  [6,7,1,4,5],
  [5,1,1,2,4]
]
```
```
Expected Output: [[0,4],[1,3],[1,4],[2,2],[3,0],[3,1],[4,0]]

Key insight: Work backwards!
Instead of checking if water can flow from each cell to ocean,
start from ocean edges and see which cells can reach them.

Pacific (top + left edges):
Start DFS from all top row and left column cells
Water can flow TO these cells from higher neighbors
Mark all reachable cells

Atlantic (bottom + right edges):
Start DFS from all bottom row and right column cells
Mark all reachable cells

Cells marked by both = answer

Pacific reachable:
Row 0: all
Col 0: all
Plus cells reachable from these going uphill

Atlantic reachable:
Row 4: all
Col 4: all
Plus cells reachable going uphill

Intersection = [[0,4],[1,3],[1,4],[2,2],[3,0],[3,1],[4,0]]
```

Input:
```
heights = [[1]]
```
```
Expected Output: [[0,0]]

Single cell touches both oceans (corner)
```

**Key Insight - Reverse Thinking (Start from Ocean):**

Instead of checking each cell (which would be expensive), start DFS from the ocean borders and move INWARD to higher or equal cells. A cell can reach the ocean if the ocean can reach it (going uphill).

**Why It Works:**

- Water flows from high to low
- Reverse: we can flow from low to high (going uphill from ocean)
- If ocean can reach a cell going uphill, water can flow from that cell to ocean
- Two separate DFS passes (one per ocean) mark reachable cells
- Intersection gives cells that reach both

**Visualization - Pacific Atlantic:**
```mermaid
graph TD
    A["Start DFS from Pacific edges"] --> B["Mark all reachable cells going uphill"]
    B --> C["Start DFS from Atlantic edges"]
    C --> D["Mark all reachable cells going uphill"]
    D --> E["Find cells marked by both"]
    E --> F["Return result"]
```

```java
public List<List<Integer>> pacificAtlantic(int[][] heights) {
    List<List<Integer>> result = new ArrayList<>();
    int m = heights.length, n = heights[0].length;
    boolean[][] pacific = new boolean[m][n];
    boolean[][] atlantic = new boolean[m][n];
    for (int i = 0; i < m; i++) {
        dfs(heights, pacific, i, 0);
    }
    for (int j = 0; j < n; j++) {
        dfs(heights, pacific, 0, j);
    }
    for (int i = 0; i < m; i++) {
        dfs(heights, atlantic, i, n - 1);
    }
    for (int j = 0; j < n; j++) {
        dfs(heights, atlantic, m - 1, j);
    }
    for (int i = 0; i < m; i++) {
        for (int j = 0; j < n; j++) {
            if (pacific[i][j] && atlantic[i][j]) {
                result.add(Arrays.asList(i, j));
            }
        }
    }
    return result;
}

private void dfs(int[][] heights, boolean[][] visited, int i, int j) {
    if (i < 0 || i >= heights.length || j < 0 || j >= heights[0].length || visited[i][j]) {
        return;
    }
    visited[i][j] = true;
    int[][] dirs = {{0, 1}, {0, -1}, {1, 0}, {-1, 0}};
    for (int[] dir : dirs) {
        int ni = i + dir[0], nj = j + dir[1];
        if (ni >= 0 && ni < heights.length && nj >= 0 && nj < heights[0].length &&
            heights[ni][nj] >= heights[i][j]) {
            dfs(heights, visited, ni, nj);
        }
    }
}
```

**Edge Cases:**

- Single row: all cells touch both oceans (top = Pacific, bottom = Atlantic)
- Single column: all cells touch both
- All same height: all cells reach both oceans
- Single cell: touches both

**Time Complexity**: O(m * n)

**Space Complexity**: O(m * n)

**Similar Pattern Problems:**

- Number of Islands
- Surrounded Regions
- Walls and Gates

---

#### 7. **Word Ladder**

**Problem Description:**
Given two words (beginWord and endWord) and a dictionary, find the length of the shortest transformation sequence from beginWord to endWord. Each step can change exactly one letter, and each intermediate word must be in the dictionary.

**Simple Analogy:**
Like a word puzzle: change "hit" to "cog" one letter at a time, where each intermediate word is valid.

**Example Walkthrough:**

Input: `beginWord = "hit"`, `endWord = "cog"`, `wordList = ["hot","dot","dog","lot","log","cog"]`
```
Expected Output: 5

Shortest path:
hit -> hot -> dot -> dog -> cog
(change 1 letter each time)

BFS level by level:
Level 1: hit (start)
Level 2: hot (change i->o)
Level 3: dot, lot (change h->d or h->l)
Level 4: dog, log (change t->g)
Level 5: cog (change d->c or l->c) = endWord!

Return 5
```

Input: `beginWord = "hit"`, `endWord = "cog"`, `wordList = ["hot","dot","dog","lot","log"]`
```
Expected Output: 0

"cog" is not in wordList
Can't reach endWord
Return 0
```

**Key Insight - BFS for Shortest Path:**

Each word is a node. Two words are connected if they differ by exactly one letter. BFS finds the shortest path because BFS explores level by level (all words 1 step away, then 2 steps away, etc.).

**Why It Works:**

- BFS guarantees shortest path in unweighted graphs
- Each transformation = one edge
- Level in BFS = number of transformations
- Removing words from the set prevents revisiting (optimization)
- Early return when endWord found gives minimum

**Visualization - Word Ladder:**
```mermaid
graph TD
    A["hit (level 1)"] --> B["hot (level 2)"]
    B --> C["dot (level 3)"]
    B --> D["lot (level 3)"]
    C --> E["dog (level 4)"]
    D --> F["log (level 4)"]
    E --> G["cog (level 5)"]
    F --> G
```

```java
public int ladderLength(String beginWord, String endWord, List<String> wordList) {
    Set<String> words = new HashSet<>(wordList);
    if (!words.contains(endWord)) return 0;
    Queue<String> queue = new LinkedList<>();
    queue.offer(beginWord);
    words.remove(beginWord);
    int steps = 1;
    while (!queue.isEmpty()) {
        int size = queue.size();
        for (int i = 0; i < size; i++) {
            String curr = queue.poll();
            if (curr.equals(endWord)) return steps;
            for (String neighbor : getNeighbors(curr, words)) {
                queue.offer(neighbor);
                words.remove(neighbor);
            }
        }
        steps++;
    }
    return 0;
}

private List<String> getNeighbors(String word, Set<String> words) {
    List<String> neighbors = new ArrayList<>();
    char[] chars = word.toCharArray();
    for (int i = 0; i < chars.length; i++) {
        char original = chars[i];
        for (char c = 'a'; c <= 'z'; c++) {
            if (c == original) continue;
            chars[i] = c;
            String neighbor = new String(chars);
            if (words.contains(neighbor)) {
                neighbors.add(neighbor);
            }
        }
        chars[i] = original;
    }
    return neighbors;
}
```

**Edge Cases:**

- endWord not in list: returns 0
- beginWord == endWord: returns 1 (or 0 depending on definition)
- No valid path: returns 0
- Single character words: works

**Time Complexity**: O(N * L^2) where N = words, L = word length

**Space Complexity**: O(N * L)

**Similar Pattern Problems:**

- Word Ladder II (find all shortest paths)
- Minimum Genetic Mutation
- Open the Lock

---

#### 8. **Rotting Oranges**

**Problem Description:**
You are given an `m x n` grid where each cell can have one of three values:
- `0` representing an empty cell
- `1` representing a fresh orange
- `2` representing a rotten orange

Every minute, any fresh orange that is **4-directionally adjacent** to a rotten orange becomes rotten. Return the minimum number of minutes that must elapse until no cell has a fresh orange. If this is impossible, return `-1`.

**Example Walkthrough:**

Input: `grid = [[2,1,1],[1,1,0],[0,1,1]]`
```
Expected Output: 4

Initial grid:
[2, 1, 1]
[1, 1, 0]
[0, 1, 1]

Minute 0: Rotten at (0,0), fresh count = 6
          Queue: [(0,0)]

Minute 1: Process (0,0) -> rot (0,1), (1,0)
          Queue: [(0,1), (1,0)], fresh = 4
          Grid:
          [2, 2, 1]
          [2, 1, 0]
          [0, 1, 1]

Minute 2: Process (0,1), (1,0)
          (0,1) -> rot (0,2)
          (1,0) -> rot (1,1) already processed? No, rot (1,1)
          Queue: [(0,2), (1,1)], fresh = 2
          Grid:
          [2, 2, 2]
          [2, 2, 0]
          [0, 1, 1]

Minute 3: Process (0,2), (1,1)
          (0,2) -> no fresh neighbors
          (1,1) -> rot (2,1)
          Queue: [(2,1)], fresh = 1
          Grid:
          [2, 2, 2]
          [2, 2, 0]
          [0, 2, 1]

Minute 4: Process (2,1) -> rot (2,2)
          Queue: [(2,2)], fresh = 0
          Grid:
          [2, 2, 2]
          [2, 2, 0]
          [0, 2, 2]

Fresh = 0, return 4
```

Input: `grid = [[2,1,1],[0,1,1],[1,0,1]]`
```
Expected Output: -1

The orange at (2,0) is isolated (surrounded by empty cells and fresh oranges that can't reach it).
Return -1.
```

Input: `grid = [[0,2]]`
```
Expected Output: 0

No fresh oranges initially, return 0.
```

**Key Insight - Multi-Source BFS:**

- All initially rotten oranges are sources for BFS
- BFS naturally processes level by level (each level = 1 minute)
- Track fresh orange count; if it reaches 0, return elapsed time
- If queue empties and fresh > 0, some oranges are unreachable -> return -1

**Why It Works:**

- BFS explores nodes in order of distance from sources
- All rotten oranges spread simultaneously (multi-source BFS)
- Each BFS level represents one minute of spreading
- Fresh count tracks remaining work
- Unreachable fresh oranges remain after BFS completes

**Visualization - Multi-Source BFS:**
```mermaid
graph TD
    A["Initialize: Add all rotten to queue, count fresh"] --> B{"Queue empty?"}
    B -->|Yes| C{"fresh == 0?"}
    C -->|Yes| D["Return minutes"]
    C -->|No| E["Return -1"]
    B -->|No| F["Process current level"]
    F --> G["For each cell in level: rot 4-directional neighbors"]
    G --> H["Add newly rotten to next level"]
    H --> I["minutes++"]
    I --> B
```

```java
public int orangesRotting(int[][] grid) {
    int m = grid.length, n = grid[0].length;
    Queue<int[]> queue = new LinkedList<>();
    int fresh = 0;
    for (int i = 0; i < m; i++) {
        for (int j = 0; j < n; j++) {
            if (grid[i][j] == 2) queue.offer(new int[]{i, j});
            else if (grid[i][j] == 1) fresh++;
        }
    }
    if (fresh == 0) return 0;
    int minutes = 0;
    int[][] dirs = {{0,1},{0,-1},{1,0},{-1,0}};
    while (!queue.isEmpty()) {
        int size = queue.size();
        boolean rotted = false;
        for (int k = 0; k < size; k++) {
            int[] cell = queue.poll();
            for (int[] d : dirs) {
                int ni = cell[0] + d[0], nj = cell[1] + d[1];
                if (ni >= 0 && ni < m && nj >= 0 && nj < n && grid[ni][nj] == 1) {
                    grid[ni][nj] = 2;
                    queue.offer(new int[]{ni, nj});
                    fresh--;
                    rotted = true;
                }
            }
        }
        if (rotted) minutes++;
    }
    return fresh == 0 ? minutes : -1;
}
```

**Time Complexity**: O(m x n) - each cell visited at most once

**Space Complexity**: O(m x n) - queue can hold all cells in worst case

**Edge Cases:**

- No fresh oranges: return 0
- All fresh, no rotten: return -1
- All rotten: return 0
- Isolated fresh oranges: return -1
- Single cell grid: check value

**Common Pitfalls:**

1. Not tracking fresh count - needed to detect unreachable oranges
2. Incrementing minutes for empty levels - only increment when rot spreads
3. Forgetting 4-directional check (up, down, left, right)
4. Not doing multi-source BFS initially - must add all rotten to queue first

**Similar Pattern Problems:**

- Walls and Gates (multi-source BFS)
- 01 Matrix (multi-source BFS)
- Shortest Path in Binary Matrix (BFS)
- Pacific Atlantic Water Flow (reverse BFS)

---

#### 9. **Number of Connected Components in an Undirected Graph**

**Problem Description:**
You have a graph of `n` nodes labeled from `0` to `n - 1`. You are given an integer `n` and an array `edges` where `edges[i] = [a_i, b_i]` indicates that there is an undirected edge between nodes `a_i` and `b_i`. Return the number of connected components in the graph.

**Example Walkthrough:**

Input: `n = 5, edges = [[0,1],[1,2],[3,4]]`
```
Expected Output: 2

Graph:
0 -- 1 -- 2    3 -- 4

Component 1: {0, 1, 2}
Component 2: {3, 4}

Step 1: Initialize parent array: parent[i] = i
        parent = [0, 1, 2, 3, 4]

Step 2: Process edge (0,1)
        Find: 0->0, 1->1
        Union: parent[1] = 0
        parent = [0, 0, 2, 3, 4]

Step 3: Process edge (1,2)
        Find: 1->0, 2->2
        Union: parent[2] = 0
        parent = [0, 0, 0, 3, 4]

Step 4: Process edge (3,4)
        Find: 3->3, 4->4
        Union: parent[4] = 3
        parent = [0, 0, 0, 3, 3]

Step 5: Count unique roots
        Roots: 0, 0, 0, 3, 3 -> unique = {0, 3} = 2

Return 2
```

Input: `n = 5, edges = [[0,1],[1,2],[2,3],[3,4]]`
```
Expected Output: 1

All nodes connected in one chain.
Return 1.
```

**Key Insight - Union-Find (Disjoint Set Union):**

- Initialize each node as its own parent (n components)
- For each edge, union the two nodes' sets
- Decrement component count on successful union
- Path compression + union by rank optimize to near O(1) per operation

**Why It Works:**

- Each set represents a connected component
- Union merges sets connected by an edge
- Final count of distinct roots = number of components
- Alternative: BFS/DFS from each unvisited node, count traversals

**Visualization - Union-Find:**
```mermaid
graph TD
    A["Initialize parent[i] = i, count = n"] --> B["For each edge (u, v)"]
    B --> C["Find root of u, root of v"]
    C --> D{"root_u == root_v?"}
    D -->|Yes| E["Already connected, skip"]
    D -->|No| F["Union: parent[root_u] = root_v"]
    F --> G["count--"]
    E --> H{"More edges?"}
    G --> H
    H -->|Yes| B
    H -->|No| I["Return count"]
```

```java
public int countComponents(int n, int[][] edges) {
    int[] parent = new int[n];
    int[] rank = new int[n];
    for (int i = 0; i < n; i++) parent[i] = i;
    int components = n;
    for (int[] edge : edges) {
        int ru = find(parent, edge[0]);
        int rv = find(parent, edge[1]);
        if (ru != rv) {
            if (rank[ru] < rank[rv]) parent[ru] = rv;
            else if (rank[ru] > rank[rv]) parent[rv] = ru;
            else { parent[rv] = ru; rank[ru]++; }
            components--;
        }
    }
    return components;
}

private int find(int[] parent, int x) {
    if (parent[x] != x) parent[x] = find(parent, parent[x]);
    return parent[x];
}
```

**Alternative - BFS/DFS:**
```java
public int countComponents(int n, int[][] edges) {
    List<List<Integer>> adj = new ArrayList<>();
    for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
    for (int[] e : edges) {
        adj.get(e[0]).add(e[1]);
        adj.get(e[1]).add(e[0]);
    }
    boolean[] visited = new boolean[n];
    int count = 0;
    for (int i = 0; i < n; i++) {
        if (!visited[i]) {
            count++;
            bfs(adj, visited, i);
        }
    }
    return count;
}

private void bfs(List<List<Integer>> adj, boolean[] visited, int start) {
    Queue<Integer> q = new LinkedList<>();
    q.offer(start);
    visited[start] = true;
    while (!q.isEmpty()) {
        int node = q.poll();
        for (int neighbor : adj.get(node)) {
            if (!visited[neighbor]) {
                visited[neighbor] = true;
                q.offer(neighbor);
            }
        }
    }
}
```

**Time Complexity**: O(n + E) for BFS/DFS, O(E * α(n)) ≈ O(E) for Union-Find

**Space Complexity**: O(n + E) for adjacency list, O(n) for Union-Find

**Edge Cases:**

- No edges: n components
- Complete graph: 1 component
- Self-loops: ignored in union
- Multiple edges between same nodes: handled by find check
- n = 1: return 1

**Common Pitfalls:**

1. Not using path compression - degrades to O(n) per find
2. Not using union by rank - degrades tree balance
3. Forgetting to decrement component count on successful union
4. Not checking `ru != rv` before union - would double-count

**Similar Pattern Problems:**

- Redundant Connection (Union-Find cycle detection)
- Graph Valid Tree (connected + no cycles)
- Accounts Merge (Union-Find on strings)
- Number of Provinces (connected components)

---

#### 10. **Redundant Connection**

**Problem Description:**
In this problem, a tree is an undirected graph that is connected and has no cycles. You are given a graph that started as a tree with `n` nodes labeled from `1` to `n`, with one additional edge added. The added edge has two different vertices chosen from `1` to `n`, and was not an edge that already existed. The graph is represented as an array `edges` of length `n` where `edges[i] = [a_i, b_i]` indicates that there is an edge between nodes `a_i` and `b_i`. Return an edge that can be removed so that the resulting graph is a tree of `n` nodes. If there are multiple answers, return the answer that occurs last in the input.

**Example Walkthrough:**

Input: `edges = [[1,2],[1,3],[2,3]]`
```
Expected Output: [2,3]

Graph:
1 -- 2
|  /
| /
3

Step 1: Process (1,2)
        Find: 1->1, 2->2
        Union: parent[2] = 1
        parent = [_, 1, 1, 3]

Step 2: Process (1,3)
        Find: 1->1, 3->3
        Union: parent[3] = 1
        parent = [_, 1, 1, 1]

Step 3: Process (2,3)
        Find: 2->1, 3->1
        Roots are same! Cycle detected.
        Return [2, 3]

Result: [2,3]
```

Input: `edges = [[1,2],[2,3],[3,4],[1,4],[1,5]]`
```
Expected Output: [1,4]

Step 1: (1,2) -> union, parent[2]=1
Step 2: (2,3) -> union, parent[3]=1
Step 3: (3,4) -> union, parent[4]=1
Step 4: (1,4) -> find(1)=1, find(4)=1 -> SAME! Cycle.
        Return [1, 4]
```

**Key Insight - Union-Find Cycle Detection:**

- Process edges in order
- For each edge, check if endpoints are already connected
- If yes, this edge creates a cycle -> it's the redundant edge
- If no, union them
- Since we process in order, the last edge that creates a cycle is returned

**Why It Works:**

- A tree with n nodes has exactly n-1 edges
- Given n edges, exactly one edge creates a cycle
- Union-Find detects when adding an edge would connect already-connected nodes
- Processing in order and returning the first cycle-creating edge gives the last edge that causes redundancy

**Visualization - Cycle Detection:**
```mermaid
graph TD
    A["For each edge (u, v) in order"] --> B["Find root of u, root of v"]
    B --> C{"root_u == root_v?"}
    C -->|Yes| D["Cycle detected! Return edge"]
    C -->|No| E["Union(u, v)"]
    E --> F{"More edges?"}
    F -->|Yes| A
    F -->|No| G["No cycle (shouldn't happen)"]
```

```java
public int[] findRedundantConnection(int[][] edges) {
    int n = edges.length;
    int[] parent = new int[n + 1];
    int[] rank = new int[n + 1];
    for (int i = 1; i <= n; i++) parent[i] = i;
    for (int[] edge : edges) {
        int ru = find(parent, edge[0]);
        int rv = find(parent, edge[1]);
        if (ru == rv) return edge;
        if (rank[ru] < rank[rv]) parent[ru] = rv;
        else if (rank[ru] > rank[rv]) parent[rv] = ru;
        else { parent[rv] = ru; rank[ru]++; }
    }
    return new int[0];
}

private int find(int[] parent, int x) {
    if (parent[x] != x) parent[x] = find(parent, parent[x]);
    return parent[x];
}
```

**Alternative - DFS Cycle Detection:**
```java
public int[] findRedundantConnection(int[][] edges) {
    int n = edges.length;
    List<List<Integer>> adj = new ArrayList<>();
    for (int i = 0; i <= n; i++) adj.add(new ArrayList<>());
    for (int[] edge : edges) {
        boolean[] visited = new boolean[n + 1];
        if (hasPath(adj, visited, edge[0], edge[1])) {
            return edge;
        }
        adj.get(edge[0]).add(edge[1]);
        adj.get(edge[1]).add(edge[0]);
    }
    return new int[0];
}

private boolean hasPath(List<List<Integer>> adj, boolean[] visited, int src, int dst) {
    if (src == dst) return true;
    visited[src] = true;
    for (int neighbor : adj.get(src)) {
        if (!visited[neighbor] && hasPath(adj, visited, neighbor, dst)) {
            return true;
        }
    }
    return false;
}
```

**Time Complexity**: O(n * α(n)) ≈ O(n) for Union-Find, O(n²) for DFS

**Space Complexity**: O(n) for Union-Find, O(n + E) for DFS

**Edge Cases:**

- 3 nodes, 3 edges (triangle): return last edge
- Self-loop: return that edge
- Multiple redundant edges: return the last one in input order
- n = 3, edges = [[1,2],[2,3],[1,3]]: return [1,3]
- Straight line with extra edge: return the closing edge

**Common Pitfalls:**

1. Not using path compression - degrades performance
2. Returning first cycle-creating edge instead of last - must process in order
3. Not initializing parent array size correctly (n+1 for 1-indexed)
4. Not handling disconnected components properly

**Similar Pattern Problems:**

- Number of Connected Components (Union-Find)
- Graph Valid Tree (cycle detection + connectivity)
- Accounts Merge (Union-Find on strings)
- Detect Cycle in Undirected Graph (DFS/Union-Find)

---

#### 11. **Network Delay Time**

**Problem Description:**
You are given a network of `n` nodes labeled from `1` to `n`. You are also given `times`, a list of travel times as directed edges `times[i] = (u_i, v_i, w_i)`, where `u_i` is the source node, `v_i` is the target node, and `w_i` is the time it takes for a signal to travel from source to target. We will send a signal from a given node `k`. Return the minimum time it takes for all the `n` nodes to receive the signal. If it is impossible for all the `n` nodes to receive the signal, return `-1`.

**Example Walkthrough:**

Input: `times = [[2,1,1],[2,3,1],[3,4,1]], n = 4, k = 2`
```
Expected Output: 2

Graph:
2 -> 1 (weight 1)
2 -> 3 (weight 1)
3 -> 4 (weight 1)

Dijkstra from node 2:
dist[2] = 0
dist[1] = 1 (via 2)
dist[3] = 1 (via 2)
dist[4] = 2 (via 2->3->4)

Max dist = 2
Return 2
```

Input: `times = [[1,2,1]], n = 2, k = 2`
```
Expected Output: -1

Node 1 cannot be reached from node 2.
Return -1.
```

Input: `times = [[1,2,1]], n = 2, k = 1`
```
Expected Output: 1

dist[1] = 0, dist[2] = 1
Max dist = 1
Return 1
```

**Key Insight - Dijkstra's Shortest Path:**

- Find shortest path from source `k` to all other nodes
- Answer = maximum of all shortest distances
- If any node is unreachable, return -1
- Use min-heap for efficient extraction of minimum distance node
- Time complexity O((V + E) log V) with binary heap

**Why It Works:**

- Signal travels along shortest paths (it propagates in all directions)
- Time for all nodes to receive signal = max of shortest distances
- Dijkstra finds shortest paths from single source
- Unreachable nodes have infinite distance -> return -1

**Visualization - Dijkstra's Algorithm:**
```mermaid
graph TD
    A["Initialize dist[] = INF, dist[k] = 0"] --> B["Push (0, k) to min-heap"]
    B --> C{"Heap empty?"}
    C -->|Yes| D["Find max dist, check all reachable"]
    C -->|No| E["Pop (d, u) from heap"]
    E --> F{"d > dist[u]?"}
    F -->|Yes| G["Stale entry, skip"]
    F -->|No| H["For each neighbor v of u"]
    H --> I{"dist[u] + w < dist[v]?"}
    I -->|Yes| J["Update dist[v], push to heap"]
    I -->|No| K["Skip"]
    J --> C
    K --> C
```

```java
public int networkDelayTime(int[][] times, int n, int k) {
    List<List<int[]>> adj = new ArrayList<>();
    for (int i = 0; i <= n; i++) adj.add(new ArrayList<>());
    for (int[] t : times) adj.get(t[0]).add(new int[]{t[1], t[2]});
    int[] dist = new int[n + 1];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[k] = 0;
    PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[0] - b[0]);
    pq.offer(new int[]{0, k});
    while (!pq.isEmpty()) {
        int[] curr = pq.poll();
        int d = curr[0], u = curr[1];
        if (d > dist[u]) continue;
        for (int[] edge : adj.get(u)) {
            int v = edge[0], w = edge[1];
            if (dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                pq.offer(new int[]{dist[v], v});
            }
        }
    }
    int maxDist = 0;
    for (int i = 1; i <= n; i++) {
        if (dist[i] == Integer.MAX_VALUE) return -1;
        maxDist = Math.max(maxDist, dist[i]);
    }
    return maxDist;
}
```

**Alternative - Bellman-Ford:**
```java
public int networkDelayTime(int[][] times, int n, int k) {
    int[] dist = new int[n + 1];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[k] = 0;
    for (int i = 0; i < n - 1; i++) {
        for (int[] t : times) {
            if (dist[t[0]] != Integer.MAX_VALUE && dist[t[0]] + t[2] < dist[t[1]]) {
                dist[t[1]] = dist[t[0]] + t[2];
            }
        }
    }
    int maxDist = 0;
    for (int i = 1; i <= n; i++) {
        if (dist[i] == Integer.MAX_VALUE) return -1;
        maxDist = Math.max(maxDist, dist[i]);
    }
    return maxDist;
}
```

**Time Complexity**: O((V + E) log V) for Dijkstra, O(V * E) for Bellman-Ford

**Space Complexity**: O(V + E) for adjacency list, O(V) for dist array

**Edge Cases:**

- k is the only node: return 0
- Some nodes unreachable: return -1
- Multiple paths to same node: Dijkstra picks shortest
- Self-loops: ignored (w > 0)
- Disconnected graph: return -1

**Common Pitfalls:**

1. Not using min-heap - O(V²) instead of O(E log V)
2. Not skipping stale entries - inefficient
3. Forgetting to check unreachable nodes - returns wrong answer
4. Using 0-indexed arrays with 1-indexed nodes - off-by-one

**Similar Pattern Problems:**

- Cheapest Flights Within K Stops (Dijkstra variant)
- Path with Minimum Effort (Dijkstra on grid)
- Swim in Rising Water (Dijkstra / Binary Search + BFS)
- Shortest Path in Weighted Graph (Dijkstra)

---

#### 12. **Swim in Rising Water**

**Problem Description:**
You are given an `n x n` integer matrix `grid` where each value `grid[i][j]` represents the elevation at that point `(i, j)`. The rain starts to fall. At time `t`, the depth of the water everywhere is `t`. You can swim from a square to another 4-directionally adjacent square if and only if the elevation of both squares individually are at most `t`. You can swim infinite distances in zero time. You must swim from the top-left square `(0, 0)` to the bottom-right square `(n - 1, n - 1)`. Return the least time until you can reach the bottom-right square.

**Example Walkthrough:**

Input: `grid = [[0,2],[1,3]]`
```
Expected Output: 3

Grid:
0 2
1 3

Start at (0,0) with elevation 0, end at (1,1) with elevation 3.

t=0: Can only be at (0,0)
t=1: (0,0) and (1,0) have elevation <= 1. Can move to (1,0).
t=2: (0,0), (1,0), (0,1) have elevation <= 2. Can move to (0,1).
t=3: All cells have elevation <= 3. Can reach (1,1).

Return 3.
```

Input: `grid = [[0,1,2,3,4],[24,23,22,21,5],[12,13,14,15,16],[11,17,18,19,20],[10,9,8,7,6]]`
```
Expected Output: 16

The optimal path: 0 -> 1 -> 2 -> ... -> 16
Maximum elevation on path = 16
Return 16.
```

**Key Insight - Minimax Path (Dijkstra / Binary Search + BFS):**

- We want the path from start to end that **minimizes the maximum elevation** along the path
- This is a minimax path problem
- **Approach 1**: Dijkstra where distance = max elevation on path
- **Approach 2**: Binary search on answer `t`, check if path exists using BFS/DFS

**Why It Works:**

- At time `t`, cells with elevation <= `t` are passable
- We want the minimum `t` such that a path exists
- Binary search works because if path exists at `t`, it exists at any `t' > t`
- Dijkstra works because we track `max elevation so far` as the "distance"

**Visualization - Dijkstra on Grid (Minimax):**
```mermaid
graph TD
    A["Start: dist[0][0] = grid[0][0]"] --> B["Min-heap push (grid[0][0], 0, 0)"]
    B --> C{"Heap empty?"}
    C -->|Yes| D["Return dist[n-1][n-1]"]
    C -->|No| E["Pop (d, i, j)"]
    E --> F{"d > dist[i][j]?"}
    F -->|Yes| G["Stale, skip"]
    F -->|No| H["For each 4-dir neighbor (ni, nj)"]
    H --> I["newDist = max(d, grid[ni][nj])"]
    I --> J{"newDist < dist[ni][nj]?"}
    J -->|Yes| K["Update dist, push to heap"]
    J -->|No| L["Skip"]
    K --> C
    L --> C
```

```java
public int swimInWater(int[][] grid) {
    int n = grid.length;
    int[][] dist = new int[n][n];
    for (int[] row : dist) Arrays.fill(row, Integer.MAX_VALUE);
    dist[0][0] = grid[0][0];
    PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[0] - b[0]);
    pq.offer(new int[]{grid[0][0], 0, 0});
    int[][] dirs = {{0,1},{0,-1},{1,0},{-1,0}};
    while (!pq.isEmpty()) {
        int[] curr = pq.poll();
        int d = curr[0], i = curr[1], j = curr[2];
        if (d > dist[i][j]) continue;
        if (i == n - 1 && j == n - 1) return d;
        for (int[] dir : dirs) {
            int ni = i + dir[0], nj = j + dir[1];
            if (ni >= 0 && ni < n && nj >= 0 && nj < n) {
                int newDist = Math.max(d, grid[ni][nj]);
                if (newDist < dist[ni][nj]) {
                    dist[ni][nj] = newDist;
                    pq.offer(new int[]{newDist, ni, nj});
                }
            }
        }
    }
    return -1;
}
```

**Alternative - Binary Search + BFS:**
```java
public int swimInWater(int[][] grid) {
    int n = grid.length;
    int lo = grid[0][0], hi = n * n - 1;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (canReach(grid, mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}

private boolean canReach(int[][] grid, int t) {
    int n = grid.length;
    if (grid[0][0] > t) return false;
    boolean[][] visited = new boolean[n][n];
    Queue<int[]> q = new LinkedList<>();
    q.offer(new int[]{0, 0});
    visited[0][0] = true;
    int[][] dirs = {{0,1},{0,-1},{1,0},{-1,0}};
    while (!q.isEmpty()) {
        int[] curr = q.poll();
        if (curr[0] == n - 1 && curr[1] == n - 1) return true;
        for (int[] dir : dirs) {
            int ni = curr[0] + dir[0], nj = curr[1] + dir[1];
            if (ni >= 0 && ni < n && nj >= 0 && nj < n
                && !visited[ni][nj] && grid[ni][nj] <= t) {
                visited[ni][nj] = true;
                q.offer(new int[]{ni, nj});
            }
        }
    }
    return false;
}
```

**Time Complexity**: O(n² log n) for Dijkstra, O(n² log n) for binary search + BFS

**Space Complexity**: O(n²) for dist/visited arrays and heap/queue

**Edge Cases:**

- n = 1: return grid[0][0]
- All same elevation: return that elevation
- Sorted ascending: return grid[n-1][n-1]
- Sorted descending: return grid[0][0]
- Random elevations: Dijkstra finds optimal path

**Common Pitfalls:**

1. Using sum of elevations instead of max - wrong problem
2. Not tracking max elevation correctly during BFS
3. Binary search bounds: `lo = grid[0][0]`, `hi = n*n - 1`
4. Not checking if start is reachable at time `t`

**Similar Pattern Problems:**

- Path with Minimum Effort (Dijkstra / Binary Search)
- Network Delay Time (Dijkstra)
- Cheapest Flights Within K Stops (Dijkstra variant)
- Minimum Cost to Reach Destination in Time (Dijkstra)

---

### Hard

#### 13. **Critical Connections in Network (Bridges)**

**Problem Description:**
In a network of n servers connected by undirected edges, find all critical connections (bridges). A bridge is an edge that, if removed, disconnects the network.

**Simple Analogy:**
Like finding weak links in a chain. If removing a link breaks the chain into two pieces, it's critical.

**Example Walkthrough:**

Input: `n = 4`, `connections = [[0,1],[1,2],[2,0],[1,3]]`
```
Expected Output: [[1,3]]

Visual:
0 --- 1 --- 3
 \   /
  \ /
   2

Edge 0-1: removing it? 0 still connects via 2-1. Not a bridge.
Edge 1-2: removing it? 1 still connects via 0-2. Not a bridge.
Edge 2-0: removing it? 2 still connects via 1-0. Not a bridge.
Edge 1-3: removing it? 3 becomes isolated! BRIDGE.

Return [[1,3]]
```

Input: `n = 2`, `connections = [[0,1]]`
```
Expected Output: [[0,1]]

Only one edge, removing it disconnects
```

**Key Insight - Discovery Time and Low Value:**

Tarjan's algorithm uses two values per node:

- **disc[u]**: When was u first discovered? (timestamp)
- **low[u]**: What's the earliest discovered node reachable from u's subtree?

An edge (u, v) is a bridge if low[v] > disc[u], meaning v's subtree can't reach any ancestor of u.

**Why It Works:**

- If v's subtree has a back edge to u or higher, low[v] <= disc[u]
- If no back edge exists, low[v] > disc[u], meaning removing (u,v) disconnects v's subtree
- DFS explores all edges, tracking discovery times
- Back edges (to ancestors) update low values

**Visualization - Finding Bridges:**
```mermaid
graph TD
    A["DFS from node 0 (disc=0)"] --> B["Visit 1 (disc=1, low=1)"]
    B --> C["Visit 2 (disc=2, low=2)"]
    C --> D["Back edge to 0, low[2]=0"]
    D --> E["Return to 1, low[1]=min(1,0)=0"]
    B --> F["Visit 3 (disc=3, low=3)"]
    F --> G["No back edge, low[3]=3 > disc[1]=1"]
    G --> H["Bridge found: (1,3)"]
```

```java
public List<List<Integer>> criticalConnections(int n, List<List<Integer>> connections) {
    List<List<Integer>> result = new ArrayList<>();
    List<Integer>[] graph = new ArrayList[n];
    for (int i = 0; i < n; i++) {
        graph[i] = new ArrayList<>();
    }
    for (List<Integer> conn : connections) {
        graph[conn.get(0)].add(conn.get(1));
        graph[conn.get(1)].add(conn.get(0));
    }
    int[] disc = new int[n];
    int[] low = new int[n];
    boolean[] visited = new boolean[n];
    int[] time = {0};
    for (int i = 0; i < n; i++) {
        if (!visited[i]) {
            dfs(i, -1, disc, low, visited, graph, time, result);
        }
    }
    return result;
}

private void dfs(int u, int parent, int[] disc, int[] low, boolean[] visited,
                 List<Integer>[] graph, int[] time, List<List<Integer>> result) {
    visited[u] = true;
    disc[u] = low[u] = time[0]++;
    for (int v : graph[u]) {
        if (!visited[v]) {
            dfs(v, u, disc, low, visited, graph, time, result);
            low[u] = Math.min(low[u], low[v]);
            if (low[v] > disc[u]) {
                result.add(Arrays.asList(u, v));
            }
        } else if (v != parent) {
            low[u] = Math.min(low[u], disc[v]);
        }
    }
}
```

**Edge Cases:**

- Single edge: it's a bridge
- No edges: no bridges
- Fully connected: no bridges
- Tree structure: all edges are bridges

**Time Complexity**: O(V + E)

**Space Complexity**: O(V)

**Similar Pattern Problems:**

- Minimum Height Trees
- Network Delay Time
- Articulation Points

---

#### 14. **Shortest Path with Obstacles Elimination**

**Problem Description:**
Given an m x n grid where 1 = obstacle and 0 = empty, find the shortest path from (0,0) to (m-1,n-1). You can eliminate at most k obstacles.

**Simple Analogy:**
Like navigating a maze where you can break through at most k walls.

**Example Walkthrough:**

Input: `grid = [[0,0,0],[1,1,0],[0,0,0],[0,1,1],[0,0,0]]`, `k = 1`
```
Expected Output: 6

Path: (0,0) -> (0,1) -> (0,2) -> (1,2) -> (2,2) -> (3,2) -> (4,2)
Eliminated 1 obstacle at (3,2)? No, (3,2) is 1 but we go through (2,2) to (3,2)?
Wait, let me trace:
(0,0) 0
(0,1) 0
(0,2) 0
(1,2) 0
(2,2) 0
(3,2) 1 -> eliminate this obstacle
(4,2) 0
Total steps: 6
```

Input: `grid = [[0,1,1],[1,1,1],[1,1,0]]`, `k = 1`
```
Expected Output: -1

Too many obstacles, can't reach with only 1 elimination
```

**Key Insight - BFS with Extra State:**

Regular BFS state is (row, col). Here we need (row, col, obstacles_used). We track visited[row][col][obstacles] to avoid revisiting the same state.

**Why It Works:**

- BFS guarantees shortest path in unweighted graphs
- Extra dimension tracks how many obstacles we've eliminated
- We can visit the same cell with different obstacle counts
- Pruning: if k >= m+n-2, we can always reach (just go through obstacles)
- Early termination when reaching destination

**Visualization - Shortest Path with Obstacles:**
```mermaid
graph TD
    A["Start (0,0) with k=1"] --> B["BFS level by level"]
    B --> C["State: (row, col, obstacles)"]
    C --> D{"Reached destination?"}
    D -->|Yes| E["Return steps"]
    D -->|No| F["Try 4 directions"]
    F --> G["Update obstacles if grid cell is 1"]
    G --> H{"obstacles <= k?"}
    H -->|Yes| I["Add to queue if not visited"]
    H -->|No| J["Skip"]
```

```java
public int shortestPath(int[][] grid, int k) {
    int m = grid.length, n = grid[0].length;
    if (k >= m - 1 + n - 1) return m - 1 + n - 1;
    Queue<int[]> queue = new LinkedList<>();
    queue.offer(new int[]{0, 0, 0});
    int[][][] visited = new int[m][n][k + 1];
    visited[0][0][0] = 1;
    int steps = 0;
    int[][] dirs = {{0, 1}, {0, -1}, {1, 0}, {-1, 0}};
    while (!queue.isEmpty()) {
        int size = queue.size();
        for (int i = 0; i < size; i++) {
            int[] curr = queue.poll();
            int row = curr[0], col = curr[1], obstacles = curr[2];
            if (row == m - 1 && col == n - 1) return steps;
            for (int[] dir : dirs) {
                int nr = row + dir[0], nc = col + dir[1];
                if (nr >= 0 && nr < m && nc >= 0 && nc < n) {
                    int newObstacles = obstacles + grid[nr][nc];
                    if (newObstacles <= k && visited[nr][nc][newObstacles] == 0) {
                        visited[nr][nc][newObstacles] = 1;
                        queue.offer(new int[]{nr, nc, newObstacles});
                    }
                }
            }
        }
        steps++;
    }
    return -1;
}
```

**Edge Cases:**

- Start == end: returns 0
- No obstacles: standard BFS
- Too many obstacles: returns -1
- k large enough: shortest path without detours

**Time Complexity**: O(m * n * k)

**Space Complexity**: O(m * n * k)

**Similar Pattern Problems:**

- Shortest Path in Matrix
- Path with Minimum Effort
- Minimum Obstacle Removal to Reach Corner

---

#### 15. **Topological Sort (DFS)**

**Problem Description:**
Given a directed acyclic graph (DAG), return a linear ordering of vertices such that for every edge (u, v), u comes before v.

**Simple Analogy:**
Like ordering courses: you must take prerequisites before advanced courses. Topological sort gives a valid order.

**Example Walkthrough:**

Input: `n = 6`, `edges = [[5,2],[5,0],[4,0],[4,1],[2,3],[3,1]]`
```
Expected Output: [5,4,2,3,1,0] (or any valid topological order)

Graph:
5 -> 2 -> 3 -> 1
5 -> 0
4 -> 0
4 -> 1

DFS from 5: visit 5, then 2, then 3, then 1
Post-order: 1, 3, 2, 0? No, let me trace:
dfs(5): mark 5
  dfs(2): mark 2
    dfs(3): mark 3
      dfs(1): mark 1
      push 1
    push 3
  push 2
  dfs(0): mark 0
  push 0
push 5

Stack: [1, 3, 2, 0, 5] (bottom to top)
Result: [5, 0, 2, 3, 1] (reverse)

dfs(4): mark 4
  dfs(0): already visited
  dfs(1): already visited
  push 4

Final stack: [1, 3, 2, 0, 5, 4]
Result: [4, 5, 0, 2, 3, 1]

Valid order: 4 before 0 and 1, 5 before 2 and 0, etc.
```

Input: `n = 3`, `edges = [[0,1],[1,2],[2,0]]`
```
Expected Output: [] (cycle detected)

This is a cycle! Topological sort only works on DAG.
```

**Key Insight - Post-Order Reversal:**

DFS finishes a node only after all its descendants are finished. So the last node to finish has no outgoing edges to unvisited nodes. If we push nodes onto a stack as they finish, popping gives topological order.

**Why It Works:**

- DFS explores all descendants before finishing a node
- A node is finished only after all reachable nodes are processed
- Pushing to stack at finish time and reversing gives topological order
- For edge (u, v): u is pushed before v finishes? No, v finishes first, so v is pushed first, then u. Reversed: u comes before v. Correct!

**Visualization - Topological Sort:**
```mermaid
graph TD
    A["DFS from each unvisited node"] --> B["Mark node as visited"]
    B --> C["Recursively visit all neighbors"]
    C --> D["After all neighbors done, push node to stack"]
    D --> E["After all DFS, pop stack for result"]
```

```java
public List<Integer> topologicalSort(int n, int[][] edges) {
    List<Integer>[] graph = new ArrayList[n];
    for (int i = 0; i < n; i++) {
        graph[i] = new ArrayList<>();
    }
    for (int[] edge : edges) {
        graph[edge[0]].add(edge[1]);
    }
    boolean[] visited = new boolean[n];
    Stack<Integer> stack = new Stack<>();
    for (int i = 0; i < n; i++) {
        if (!visited[i]) {
            dfs(i, visited, graph, stack);
        }
    }
    List<Integer> result = new ArrayList<>();
    while (!stack.isEmpty()) {
        result.add(stack.pop());
    }
    return result;
}

private void dfs(int node, boolean[] visited, List<Integer>[] graph, Stack<Integer> stack) {
    visited[node] = true;
    for (int neighbor : graph[node]) {
        if (!visited[neighbor]) {
            dfs(neighbor, visited, graph, stack);
        }
    }
    stack.push(node);
}
```

**Edge Cases:**

- No edges: any order works
- Linear chain: only one valid order
- Multiple components: each sorted independently
- Cycle: no valid topological order

**Time Complexity**: O(V + E)

**Space Complexity**: O(V)

**Similar Pattern Problems:**

- Course Schedule
- Alien Dictionary
- Build Order

---

#### 16. **Union-Find (Disjoint Set)**

**Problem Description:**
A data structure that tracks elements partitioned into disjoint sets. Supports two operations: find (which set?) and union (merge two sets).

**Simple Analogy:**
Like managing friend groups. When two people become friends, merge their groups. Find tells you which group someone belongs to.

**Example Walkthrough:**

Input: `n = 5`, operations:
```
union(0, 1)
union(2, 3)
union(1, 3)
find(0) == find(3)? Yes (all connected)
countComponents() = 2 (groups: {0,1,2,3}, {4})
```

**Step-by-step:**
```
Initial: parent = [0, 1, 2, 3, 4], rank = [0, 0, 0, 0, 0]

union(0, 1): find(0)=0, find(1)=1, parent[1]=0
parent = [0, 0, 2, 3, 4]

union(2, 3): find(2)=2, find(3)=3, parent[3]=2
parent = [0, 0, 2, 2, 4]

union(1, 3): find(1)=0, find(3)=2, parent[2]=0
parent = [0, 0, 0, 2, 4]
After path compression: parent[3]=0
parent = [0, 0, 0, 0, 4]

find(0) = 0, find(3) = 0 -> Same group!

countComponents: roots = {0, 4} -> 2
```

**Key Insight - Path Compression + Union by Rank:**

- **Path compression**: When finding root, make all nodes on path point directly to root
- **Union by rank**: Attach smaller tree under larger tree
- Together they give nearly O(1) amortized operations

**Why It Works:**

- Each set is a tree with a root
- find(x) follows parent pointers to root
- union merges two trees by attaching one root to another
- Path compression flattens the tree for faster future finds
- Union by rank keeps trees balanced

**Visualization - Union-Find:**
```mermaid
graph TD
    A["Initial: 5 separate sets"] --> B["union(0,1): 1->0"]
    B --> C["union(2,3): 3->2"]
    C --> D["union(1,3): 2->0, 3->2->0"]
    D --> E["After path compression: 3->0"]
    E --> F["find(0)=0, find(3)=0"]
```

```java
class UnionFind {
    int[] parent, rank;
    public UnionFind(int n) {
        parent = new int[n];
        rank = new int[n];
        for (int i = 0; i < n; i++) {
            parent[i] = i;
        }
    }
    public int find(int x) {
        if (parent[x] != x) {
            parent[x] = find(parent[x]);
        }
        return parent[x];
    }
    public boolean union(int x, int y) {
        int px = find(x), py = find(y);
        if (px == py) return false;
        if (rank[px] < rank[py]) {
            parent[px] = py;
        } else if (rank[px] > rank[py]) {
            parent[py] = px;
        } else {
            parent[py] = px;
            rank[px]++;
        }
        return true;
    }
    public int countComponents(int n) {
        Set<Integer> roots = new HashSet<>();
        for (int i = 0; i < n; i++) {
            roots.add(find(i));
        }
        return roots.size();
    }
}
```

**Edge Cases:**

- Single element: one component
- No unions: n components
- All unions: 1 component
- Union same set: returns false

**Time Complexity**: O(α(n)) amortized per operation (α is inverse Ackermann, nearly constant)

**Space Complexity**: O(n)

**Similar Pattern Problems:**

- Accounts Merge
- Friends of Appropriate Ages
- Smallest String with Swaps

---

#### 17. **Minimum Spanning Tree - Kruskal's Algorithm**

**Problem Description:**
Given a connected weighted undirected graph, find the Minimum Spanning Tree (MST) - a subset of edges that connects all vertices with minimum total weight.

**Simple Analogy:**
Like connecting cities with roads at minimum cost, ensuring all cities are connected.

**Example Walkthrough:**

Input: `n = 3`, `connections = [[1,2,5],[1,3,6],[2,3,1]]`
```
Expected Output: 6

Edges sorted by weight:
[2,3,1] - weight 1
[1,2,5] - weight 5
[1,3,6] - weight 6

Process:
1. Add [2,3,1]: 2 and 3 connected, total=1
2. Add [1,2,5]: 1 connected to {2,3}, total=6
3. [1,3,6]: already connected (would form cycle), skip

MST edges: [2,3,1] + [1,2,5] = total weight 6
```

Input: `n = 4`, `connections = [[1,2,3],[3,4,4]]`
```
Expected Output: -1

Graph is not connected
Can't form spanning tree
```

**Key Insight - Sort Edges + Union-Find:**

- Sort all edges by weight
- Process from smallest to largest
- Add edge if it doesn't form a cycle (Union-Find check)
- Stop when we have n-1 edges (spanning tree complete)

**Why It Works:**

- Greedy works for MST (unlike many problems)
- Smallest edge that doesn't create cycle must be in some MST
- Union-Find efficiently detects cycles
- n-1 edges connect n vertices without cycles

**Visualization - Kruskal's:**
```mermaid
graph TD
    A["Sort edges by weight"] --> B["Process each edge"]
    B --> C{"Union successful?"}
    C -->|Yes| D["Add to MST, total += weight"]
    C -->|No| E["Skip (would form cycle)"]
    D --> F{"edges == n-1?"}
    F -->|Yes| G["Return total"]
    F -->|No| B
    E --> B
```

```java
public int minimumCost(int n, int[][] connections) {
    Arrays.sort(connections, (a, b) -> a[2] - b[2]);
    UnionFind uf = new UnionFind(n + 1);
    int totalCost = 0;
    int edgesUsed = 0;
    for (int[] edge : connections) {
        if (uf.union(edge[0], edge[1])) {
            totalCost += edge[2];
            edgesUsed++;
            if (edgesUsed == n - 1) break;
        }
    }
    return edgesUsed == n - 1 ? totalCost : -1;
}
```

**Edge Cases:**

- Already connected: processes until n-1 edges
- Disconnected: returns -1
- Single node: returns 0
- All same weights: works correctly

**Time Complexity**: O(E log E) for sorting

**Space Complexity**: O(V) for Union-Find

**Similar Pattern Problems:**

- Connect All Points
- Min Cost to Connect Sticks
- Optimize Water Distribution

---

## 📌 Key Patterns & Techniques

### 1. **Graph Representation**
- **Adjacency list**: Best for most problems (sparse graphs)
- **Adjacency matrix**: When you need O(1) edge lookup
- **Edge list**: For Kruskal's and similar algorithms

### 2. **Traversal Patterns**
- **BFS**: Shortest path (unweighted), level-order, spreading (islands)
- **DFS**: Topological sort, cycle detection, connectivity, backtracking

### 3. **Cycle Detection**
- **Directed**: Use colors (white=unvisited, gray=in-progress, black=done)
- **Undirected**: DFS with parent tracking, or Union-Find

### 4. **Shortest Path**
- **Unweighted**: BFS
- **Weighted (non-negative)**: Dijkstra
- **Weighted (general)**: Bellman-Ford
- **All pairs**: Floyd-Warshall

### 5. **Union-Find Applications**
- Connected components
- Cycle detection in undirected graphs
- Minimum spanning tree (Kruskal's)
- Dynamic connectivity

### 6. **Topological Sort Applications**
- Course prerequisites
- Build order
- Alien dictionary
- Task scheduling

---

## 🎯 Common Pitfalls to Avoid

- Not distinguishing directed vs undirected edges
- Forgetting to mark nodes as visited (infinite loops!)
- Wrong graph representation for problem type
- Not handling disconnected components
- Integer overflow in path weights (use long)
- Assuming positive weights when not guaranteed
- Incorrect Union-Find implementation (path compression + union by rank)
- Topological sort on cyclic graph (not possible!)
- Not handling edge cases (empty graph, single node)
- Confusing BFS and DFS use cases
- Forgetting that BFS gives shortest path only for unweighted graphs