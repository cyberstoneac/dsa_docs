# Graph

## Key Concepts
- Set of vertices connected by edges
- **Directed Graph**: Edges have direction
- **Undirected Graph**: Edges are bidirectional
- **Weighted Graph**: Edges have weights/costs
- **Cycle**: Path that starts and ends at same vertex
- **Connected Component**: Set of vertices where any can reach any other

## Representation
- **Adjacency List**: Array of lists (memory efficient)
- **Adjacency Matrix**: 2D array (fast lookup, uses O(V²) space)
- **Edge List**: List of edges (useful for some algorithms)

## Common Algorithms
- **BFS** (Breadth-First Search): Shortest path in unweighted graphs
- **DFS** (Depth-First Search): Traversal, cycle detection, topological sort
- **Dijkstra**: Shortest path in weighted graphs (non-negative weights)
- **Union-Find**: Detect cycles, connected components
- **Topological Sort**: Linear ordering of DAG
- **Tarjan/Bridges**: Find critical connections

## Patterns / Techniques
- BFS for shortest path
- DFS for cycle detection
- Union-Find for connectivity
- Heap for Dijkstra
- Graph coloring
- Backtracking for paths

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Number of Islands**
**Explanation**: DFS/BFS on grid. Mark visited cells, count connected components of '1'. Time: O(m*n), Space: O(m*n).

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

**Similar Pattern Problems**: Max Area of Island, Number of Connected Components

---

#### 2. **Flood Fill**
**Explanation**: DFS changing connected pixels of same color to new color. Time: O(m*n), Space: O(m*n).

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

**Similar Pattern Problems**: Surrounded Regions, Pacific Atlantic Water Flow

---

#### 3. **Clone Graph**
**Explanation**: DFS/BFS creating deep copy. Use HashMap to track visited nodes. Time: O(V+E), Space: O(V).

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

**Similar Pattern Problems**: Copy List with Random Pointer

---

#### 4. **Find the Town Judge**
**Explanation**: Judge is person that all trust but trusts no one. Count trust relationships. Time: O(n), Space: O(n).

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

**Similar Pattern Problems**: Single Number (XOR variant)

---

### Medium

#### 5. **Course Schedule (Cycle Detection)**
**Explanation**: Detect cycle in directed graph. Use BFS with in-degree. Time: O(V+E), Space: O(V).

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

**Similar Pattern Problems**: Course Schedule II, Topological Sort, Alien Dictionary

---

#### 6. **Pacific Atlantic Water Flow**
**Explanation**: Find cells where water flows to both oceans. Start from edges, work inward using DFS. Time: O(m*n), Space: O(m*n).

```java
public List<List<Integer>> pacificAtlantic(int[][] heights) {
    List<List<Integer>> result = new ArrayList<>();
    int m = heights.length, n = heights[0].length;
    boolean[][] pacific = new boolean[m][n];
    boolean[][] atlantic = new boolean[m][n];
    
    // DFS from top and left (Pacific)
    for (int i = 0; i < m; i++) {
        dfs(heights, pacific, i, 0);
    }
    for (int j = 0; j < n; j++) {
        dfs(heights, pacific, 0, j);
    }
    
    // DFS from bottom and right (Atlantic)
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

**Similar Pattern Problems**: Number of Islands, Surrounded Regions

---

#### 7. **Word Ladder**
**Explanation**: Shortest transformation path using BFS. Build word graph. Time: O(N*L²), Space: O(N*L).

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

**Similar Pattern Problems**: Word Ladder II, Minimum Genetic Mutation

---

### Hard

#### 8. **Critical Connections in Network (Bridges)**
**Explanation**: Find bridges using Tarjan's algorithm. Use discovery time and low value. Time: O(V+E), Space: O(V).

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

**Similar Pattern Problems**: Minimum Height Trees, Network Delay Time

---

#### 9. **Shortest Path with Obstacles Elimination**
**Explanation**: BFS with state (row, col, obstacles used). Track visited with 3D array. Time: O(m*n*k), Space: O(m*n*k).

```java
public int shortestPath(int[][] grid, int k) {
    int m = grid.length, n = grid[0].length;
    if (k < m - 1 + n - 1) return -1;
    
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

**Similar Pattern Problems**: Shortest Path in Matrix, Path with Minimum Effort

---

#### 10. **Topological Sort (DFS)**
**Explanation**: Linear ordering of vertices in DAG. Use DFS with post-order traversal. Time: O(V+E), Space: O(V).

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

**Similar Pattern Problems**: Course Schedule, Alien Dictionary, Build Order

---

#### 11. **Union-Find (Disjoint Set)**
**Explanation**: Track connected components. Union find with path compression and union by rank. Time: O(α(n)) amortized.

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
            parent[x] = find(parent[x]); // Path compression
        }
        return parent[x];
    }
    
    public boolean union(int x, int y) {
        int px = find(x), py = find(y);
        
        if (px == py) return false;
        
        // Union by rank
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

// Usage example: Number of connected components
public int countComponents(int n, int[][] edges) {
    UnionFind uf = new UnionFind(n);
    
    for (int[] edge : edges) {
        uf.union(edge[0], edge[1]);
    }
    
    return uf.countComponents(n);
}
```

**Similar Pattern Problems**: Accounts Merge, Friends of Appropriate Ages, Smallest String with Swaps

---

#### 12. **Minimum Spanning Tree - Kruskal's Algorithm**
**Explanation**: Find MST using edges sorted by weight. Union-Find for cycle detection. Time: O(E log E), Space: O(V).

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

**Similar Pattern Problems**: Connect All Points, Min Cost to Connect Sticks

---

## 📌 Key Patterns & Techniques

### 1. **Graph Representation**
- Adjacency list: most common for sparse graphs
- Adjacency matrix: useful when checking edge (u,v) frequently

### 2. **Traversal Patterns**
- BFS: shortest path (unweighted), level-order
- DFS: topological sort, cycle detection, connectivity

### 3. **Cycle Detection**
- Directed: use colors (white, gray, black)
- Undirected: DFS with parent tracking

### 4. **Shortest Path**
- Unweighted: BFS
- Weighted (non-negative): Dijkstra
- Weighted (general): Bellman-Ford

### 5. **Union-Find Applications**
- Connected components
- Cycle detection
- Minimum spanning tree
- Kruskal's algorithm

### 6. **Topological Sort Applications**
- Course prerequisites
- Build order
- Alien dictionary ordering
- Task scheduling

---

## 🎯 Common Pitfalls to Avoid

- ❌ Not distinguishing directed vs undirected edges
- ❌ Forgetting to mark nodes as visited
- ❌ Wrong graph representation for problem type
- ❌ Not handling disconnected components
- ❌ Integer overflow in path weights
- ❌ Assuming positive weights when not guaranteed
- ❌ Incorrect Union-Find implementation
- ❌ Topological sort on cyclic graph
- ❌ Not handling disconnected components
- ❌ Integer overflow in path weights
- ❌ Assuming positive weights when not guaranteed
