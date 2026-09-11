# Tree

## Key Concepts
- Hierarchical structure with parent-child relationships
- **Binary Tree**: Each node has at most 2 children
- **Binary Search Tree (BST)**: Left < Parent < Right
- **Balanced Tree**: Height difference ≤ 1 (AVL, Red-Black)
- **Time Complexity**: O(log n) for balanced, O(n) for skewed
- **Space Complexity**: O(h) for recursion stack where h = height

## Traversals
- **Inorder** (Left-Root-Right): BST gives sorted order
- **Preorder** (Root-Left-Right): Root first, useful for copying
- **Postorder** (Left-Right-Root): Children before parent, useful for deletion
- **Level Order** (BFS): Breadth-first traversal

## Common Problems
- Tree Traversals (all types)
- Maximum/Minimum Depth
- Path Sum problems
- Lowest Common Ancestor (LCA)
- Serialize/Deserialize
- Construct tree from traversals

## Patterns / Techniques
- Recursion (top-down, bottom-up)
- DFS (depth-first traversal)
- BFS (breadth-first traversal)
- Divide and Conquer on trees
- Backtracking for paths

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Maximum Depth of Binary Tree**
**Explanation**: Recursively find max depth of left and right subtrees, return max + 1. Base case: null node has depth 0. Time: O(n), Space: O(h).

```java
public int maxDepth(TreeNode root) {
    if (root == null) return 0;
    return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}
```

**Similar Pattern Problems**: Minimum Depth, Tree Height

---

#### 2. **Symmetric Tree (Mirror Tree)**
**Explanation**: Recursively check if left subtree mirrors right subtree. Compare node values and structure. Time: O(n), Space: O(h).

```java
public boolean isSymmetric(TreeNode root) {
    if (root == null) return true;
    return isMirror(root.left, root.right);
}

private boolean isMirror(TreeNode left, TreeNode right) {
    if (left == null && right == null) return true;
    if (left == null || right == null) return false;
    return left.val == right.val && isMirror(left.left, right.right) && isMirror(left.right, right.left);
}
```

**Similar Pattern Problems**: Same Tree, Is Subtree

---

#### 3. **Invert Binary Tree**
**Explanation**: Swap left and right children recursively. Base: null returns null. Time: O(n), Space: O(h).

```java
public TreeNode invertTree(TreeNode root) {
    if (root == null) return null;
    
    TreeNode temp = root.left;
    root.left = invertTree(root.right);
    root.right = invertTree(temp);
    
    return root;
}
```

**Similar Pattern Problems**: Flip Tree, Mirror Tree Operations

---

#### 4. **Path Sum**
**Explanation**: DFS checking each path. Subtract node value from target, check if target becomes 0 at leaf. Time: O(n), Space: O(h).

```java
public boolean hasPathSum(TreeNode root, int targetSum) {
    if (root == null) return false;
    
    if (root.left == null && root.right == null) {
        return targetSum == root.val;
    }
    
    return hasPathSum(root.left, targetSum - root.val) || 
           hasPathSum(root.right, targetSum - root.val);
}
```

**Similar Pattern Problems**: Path Sum II, III, IV

---

### Medium

#### 5. **Binary Tree Inorder Traversal (Iterative)**
**Explanation**: Use stack to simulate recursion. Push left nodes, when null pop and visit, move to right. Time: O(n), Space: O(h).

```java
public List<Integer> inorderTraversal(TreeNode root) {
    List<Integer> result = new ArrayList<>();
    Stack<TreeNode> stack = new Stack<>();
    TreeNode curr = root;
    
    while (curr != null || !stack.isEmpty()) {
        while (curr != null) {
            stack.push(curr);
            curr = curr.left;
        }
        
        curr = stack.pop();
        result.add(curr.val);
        curr = curr.right;
    }
    
    return result;
}
```

**Similar Pattern Problems**: Preorder/Postorder Traversal, Morris Traversal

---

#### 6. **Lowest Common Ancestor in BST**
**Explanation**: Leverage BST property. If both nodes < root, search left. If both > root, search right. If one on each side or equals root, that's LCA. Time: O(log n), Space: O(h).

```java
public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
    if (p.val < root.val && q.val < root.val) {
        return lowestCommonAncestor(root.left, p, q);
    } else if (p.val > root.val && q.val > root.val) {
        return lowestCommonAncestor(root.right, p, q);
    } else {
        return root;
    }
}
```

**Similar Pattern Problems**: LCA Binary Tree (generic), LCA with Parent Pointers

---

#### 7. **Build Tree from Inorder and Preorder**
**Explanation**: Preorder first element is root. Find root in inorder, split into left/right. Recursively build. Time: O(n), Space: O(n).

```java
public TreeNode buildTree(int[] preorder, int[] inorder) {
    HashMap<Integer, Integer> inMap = new HashMap<>();
    for (int i = 0; i < inorder.length; i++) {
        inMap.put(inorder[i], i);
    }
    
    return buildTreeHelper(preorder, 0, preorder.length - 1, inorder, 0, inorder.length - 1, inMap);
}

private TreeNode buildTreeHelper(int[] preorder, int preStart, int preEnd, 
                                  int[] inorder, int inStart, int inEnd, 
                                  HashMap<Integer, Integer> inMap) {
    if (preStart > preEnd) return null;
    
    TreeNode root = new TreeNode(preorder[preStart]);
    int inRoot = inMap.get(preorder[preStart]);
    int numsLeft = inRoot - inStart;
    
    root.left = buildTreeHelper(preorder, preStart + 1, preStart + numsLeft, inorder, inStart, inRoot - 1, inMap);
    root.right = buildTreeHelper(preorder, preStart + numsLeft + 1, preEnd, inorder, inRoot + 1, inEnd, inMap);
    
    return root;
}
```

**Similar Pattern Problems**: Build from Postorder-Inorder

---

### Hard

#### 8. **Binary Tree Maximum Path Sum**
**Explanation**: DFS returning max path sum ending at node. For each node, compute best path through it. Time: O(n), Space: O(h).

```java
private int maxSum = Integer.MIN_VALUE;

public int maxPathSum(TreeNode root) {
    maxSum = Integer.MIN_VALUE;
    dfs(root);
    return maxSum;
}

private int dfs(TreeNode node) {
    if (node == null) return 0;
    
    int left = Math.max(0, dfs(node.left));
    int right = Math.max(0, dfs(node.right));
    
    maxSum = Math.max(maxSum, left + node.val + right);
    
    return node.val + Math.max(left, right);
}
```

**Similar Pattern Problems**: Maximum Path Sum in N-ary Tree, Path Sum III

---

#### 9. **Recover Binary Search Tree**
**Explanation**: Inorder traversal should be sorted in BST. Find two out-of-order values, swap. Time: O(n), Space: O(h).

```java
private TreeNode first, second, prev;

public void recoverTree(TreeNode root) {
    first = second = prev = null;
    inorder(root);
    
    if (first != null && second != null) {
        int temp = first.val;
        first.val = second.val;
        second.val = temp;
    }
}

private void inorder(TreeNode node) {
    if (node == null) return;
    
    inorder(node.left);
    
    if (prev != null && prev.val > node.val) {
        if (first == null) first = prev;
        second = node;
    }
    prev = node;
    
    inorder(node.right);
}
```

**Similar Pattern Problems**: Find Duplicate Subtree, Validate BST

---

## 📌 Key Patterns & Techniques

### 1. **Recursion Pattern**
- Base: null node
- Recursive case: process left, process right, combine

### 2. **Traversal Pattern**
- Inorder: visit left, root, right
- Preorder: visit root, left, right
- Postorder: visit left, right, root

### 3. **DFS vs BFS**
- DFS: recursion/stack, space = O(h)
- BFS: queue, space = O(w) where w = max width

### 4. **Divide and Conquer**
- Solve left subtree, right subtree, combine results

---

## 🎯 Common Pitfalls to Avoid

- ❌ Not handling null nodes
- ❌ Confusing traversal orders
- ❌ Integer overflow in path sums
- ❌ Modifying tree unintentionally
- ❌ Off-by-one in array indices
