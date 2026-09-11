# Backtracking

## Key Concepts
- Explore all possibilities systematically
- **Search Space**: All valid combinations/permutations/solutions
- **Pruning**: Cut branches that can't lead to valid solutions
- **State**: Current partial solution being built
- **Backtrack**: Undo choices and try alternatives
- **Base Case**: When solution is complete or invalid

## When to Use
- Generate all permutations/combinations
- Find all valid paths/solutions
- Constraint satisfaction problems
- Exhaustive search with optimization

## Time Complexity
- Generally O(N!) or O(2^N) - exponential
- Pruning can improve practical performance
- Space: O(N) for recursion stack

## Patterns
1. **Permutation pattern**: Choose element, recurse, undo choice
2. **Combination pattern**: Choose index range, avoid duplicates
3. **Partition pattern**: Divide string/array into valid parts
4. **Board pattern**: N-Queens, Sudoku solving

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Subsets**
**Explanation**: Generate all 2^n subsets. For each element, include or exclude it. Time: O(n*2^n), Space: O(n).

```java
public List<List<Integer>> subsets(int[] nums) {
    List<List<Integer>> result = new ArrayList<>();
    backtrack(nums, 0, new ArrayList<>(), result);
    return result;
}

private void backtrack(int[] nums, int start, List<Integer> current, List<List<Integer>> result) {
    result.add(new ArrayList<>(current));
    
    for (int i = start; i < nums.length; i++) {
        current.add(nums[i]);
        backtrack(nums, i + 1, current, result);
        current.remove(current.size() - 1);
    }
}
```

**Similar Pattern Problems**: Subsets II (with duplicates), Power Set

---

#### 2. **Combinations**
**Explanation**: Choose k elements from n. Similar to subsets but fixed size k. Time: O(C(n,k) * k), Space: O(k).

```java
public List<List<Integer>> combine(int n, int k) {
    List<List<Integer>> result = new ArrayList<>();
    backtrack(n, k, 1, new ArrayList<>(), result);
    return result;
}

private void backtrack(int n, int k, int start, List<Integer> current, List<List<Integer>> result) {
    if (current.size() == k) {
        result.add(new ArrayList<>(current));
        return;
    }
    
    for (int i = start; i <= n; i++) {
        current.add(i);
        backtrack(n, k, i + 1, current, result);
        current.remove(current.size() - 1);
    }
}
```

**Similar Pattern Problems**: Combination Sum, Combinations with Duplicates

---

#### 3. **Permutations**
**Explanation**: Generate all n! orderings. Mark visited, try each unused element. Time: O(n*n!), Space: O(n).

```java
public List<List<Integer>> permute(int[] nums) {
    List<List<Integer>> result = new ArrayList<>();
    boolean[] used = new boolean[nums.length];
    backtrack(nums, used, new ArrayList<>(), result);
    return result;
}

private void backtrack(int[] nums, boolean[] used, List<Integer> current, List<List<Integer>> result) {
    if (current.size() == nums.length) {
        result.add(new ArrayList<>(current));
        return;
    }
    
    for (int i = 0; i < nums.length; i++) {
        if (!used[i]) {
            used[i] = true;
            current.add(nums[i]);
            backtrack(nums, used, current, result);
            current.remove(current.size() - 1);
            used[i] = false;
        }
    }
}
```

**Similar Pattern Problems**: Permutations II (with duplicates), Next Permutation

---

### Medium

#### 4. **Generate Parentheses**
**Explanation**: Generate all valid parenthesis combinations. Track open/close counts. Time: O(4^n/sqrt(n)), Space: O(n).

```java
public List<String> generateParenthesis(int n) {
    List<String> result = new ArrayList<>();
    backtrack(n, n, "", result);
    return result;
}

private void backtrack(int open, int close, String current, List<String> result) {
    if (open == 0 && close == 0) {
        result.add(current);
        return;
    }
    
    if (open > 0) {
        backtrack(open - 1, close, current + "(", result);
    }
    
    if (close > open) {
        backtrack(open, close - 1, current + ")", result);
    }
}
```

**Similar Pattern Problems**: Generate Valid IP Addresses, Restore IP Addresses

---

#### 5. **Combination Sum**
**Explanation**: Find all combinations that sum to target. Reuse elements allowed. Time: O(N^T/M), Space: O(T/M).

```java
public List<List<Integer>> combinationSum(int[] candidates, int target) {
    List<List<Integer>> result = new ArrayList<>();
    Arrays.sort(candidates);
    backtrack(candidates, target, 0, new ArrayList<>(), result);
    return result;
}

private void backtrack(int[] candidates, int target, int start, List<Integer> current, List<List<Integer>> result) {
    if (target == 0) {
        result.add(new ArrayList<>(current));
        return;
    }
    
    if (target < 0) return;
    
    for (int i = start; i < candidates.length; i++) {
        current.add(candidates[i]);
        backtrack(candidates, target - candidates[i], i, current, result);
        current.remove(current.size() - 1);
    }
}
```

**Similar Pattern Problems**: Combination Sum II (no reuse), Combination Sum III (k elements)

---

#### 6. **Word Search**
**Explanation**: DFS on grid checking if word exists. Mark visited cells. Time: O(N*3^L), Space: O(L).

```java
public boolean exist(char[][] board, String word) {
    for (int i = 0; i < board.length; i++) {
        for (int j = 0; j < board[0].length; j++) {
            if (board[i][j] == word.charAt(0) && 
                backtrack(board, word, 0, i, j)) {
                return true;
            }
        }
    }
    return false;
}

private boolean backtrack(char[][] board, String word, int index, int row, int col) {
    if (index == word.length()) return true;
    
    if (row < 0 || row >= board.length || col < 0 || col >= board[0].length || 
        board[row][col] != word.charAt(index)) {
        return false;
    }
    
    char original = board[row][col];
    board[row][col] = '*';
    
    boolean result = backtrack(board, word, index + 1, row + 1, col) ||
                     backtrack(board, word, index + 1, row - 1, col) ||
                     backtrack(board, word, index + 1, row, col + 1) ||
                     backtrack(board, word, index + 1, row, col - 1);
    
    board[row][col] = original;
    return result;
}
```

**Similar Pattern Problems**: Word Search II (multiple words), Search Pattern in Matrix

---

#### 7. **Palindrome Partitioning**
**Explanation**: Partition string into palindromes. Backtrack exploring all valid partitions. Time: O(N*2^N), Space: O(N).

```java
public List<List<String>> partition(String s) {
    List<List<String>> result = new ArrayList<>();
    backtrack(s, 0, new ArrayList<>(), result);
    return result;
}

private void backtrack(String s, int start, List<String> current, List<List<String>> result) {
    if (start == s.length()) {
        result.add(new ArrayList<>(current));
        return;
    }
    
    for (int i = start; i < s.length(); i++) {
        if (isPalindrome(s, start, i)) {
            current.add(s.substring(start, i + 1));
            backtrack(s, i + 1, current, result);
            current.remove(current.size() - 1);
        }
    }
}

private boolean isPalindrome(String s, int left, int right) {
    while (left < right) {
        if (s.charAt(left++) != s.charAt(right--)) return false;
    }
    return true;
}
```

**Similar Pattern Problems**: Palindrome Partitioning II, Cut Palindrome String

---

### Hard

#### 8. **N Queens**
**Explanation**: Place n queens on n×n board. No two attack each other. Backtrack with pruning. Time: O(n!), Space: O(n).

```java
public List<List<String>> solveNQueens(int n) {
    List<List<String>> result = new ArrayList<>();
    char[][] board = new char[n][n];
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            board[i][j] = '.';
        }
    }
    
    backtrack(board, 0, result);
    return result;
}

private void backtrack(char[][] board, int row, List<List<String>> result) {
    if (row == board.length) {
        result.add(boardToList(board));
        return;
    }
    
    for (int col = 0; col < board.length; col++) {
        if (isValid(board, row, col)) {
            board[row][col] = 'Q';
            backtrack(board, row + 1, result);
            board[row][col] = '.';
        }
    }
}

private boolean isValid(char[][] board, int row, int col) {
    for (int i = 0; i < row; i++) {
        if (board[i][col] == 'Q') return false;
    }
    
    for (int i = row - 1, j = col - 1; i >= 0 && j >= 0; i--, j--) {
        if (board[i][j] == 'Q') return false;
    }
    
    for (int i = row - 1, j = col + 1; i >= 0 && j < board.length; i--, j++) {
        if (board[i][j] == 'Q') return false;
    }
    
    return true;
}

private List<String> boardToList(char[][] board) {
    List<String> result = new ArrayList<>();
    for (char[] row : board) {
        result.add(new String(row));
    }
    return result;
}
```

**Similar Pattern Problems**: N Queens II (count solutions), Sudoku Solver

---

## 📌 Key Patterns & Techniques

### 1. **Combination Pattern (No Reuse)**
- Use `start` index to avoid duplicates
- Explore from start to end
- Perfect for: Combinations, Subsets

### 2. **Permutation Pattern (Full Reuse)**
- Use `boolean[] used` array
- Try all unused elements
- Perfect for: Permutations, Arrangements

### 3. **Substring/Partition Pattern**
- Iterate through indices
- Choose substring, recurse on remainder
- Perfect for: Palindrome Partitioning, IP Addresses

### 4. **Board Pattern (2D Search)**
- Mark visited cells
- Explore 4 directions
- Unmark on backtrack
- Perfect for: Word Search, N-Queens

### 5. **Pruning Techniques**
- Early termination when target reached
- Check validity before recursing
- Skip impossible branches

---

## 🎯 Common Pitfalls to Avoid

- ❌ Forgetting to undo changes when backtracking
- ❌ Not handling duplicates (sort first)
- ❌ Incorrect base case conditions
- ❌ Not exploring all possibilities
- ❌ Inefficient pruning strategies
- ❌ Modifying shared data structure
- ❌ Off-by-one errors in index management
