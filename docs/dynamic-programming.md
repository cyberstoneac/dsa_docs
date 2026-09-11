# Dynamic Programming

## Key Concepts
- **Optimal Substructure**: Problem can be solved using solutions of subproblems
- **Overlapping Subproblems**: Same subproblems are solved multiple times
- **Memoization**: Cache results to avoid recomputation
- **State Definition**: Clearly define what dp[i] or dp[i][j] represents
- **Recurrence Relation**: Mathematical formula connecting subproblems

## Approaches
- **Top-Down (Memoization)**: Recursive with caching
- **Bottom-Up (Tabulation)**: Iterative building from base cases
- **Space Optimization**: Reduce auxiliary space by tracking only needed values

## Common Patterns
1. **1D DP**: Single parameter varying (sequences, arrays)
2. **2D DP**: Two parameters (grid, subsequence, subarray)
3. **3D DP**: Three parameters (advanced scenarios)
4. **State Compression**: Using bit manipulation or clever indexing

## DP Techniques
- Longest subsequence/substring problems
- Knapsack variants
- Coin change problems
- Path problems in grids
- Stock trading problems
- String matching problems

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Climbing Stairs**
**Explanation**: Each step can come from 1 or 2 stairs below. DP[i] = DP[i-1] + DP[i-2]. Time: O(n), Space: O(n) or O(1).

```java
public int climbStairs(int n) {
    if (n <= 2) return n;
    
    int[] dp = new int[n + 1];
    dp[1] = 1;
    dp[2] = 2;
    
    for (int i = 3; i <= n; i++) {
        dp[i] = dp[i - 1] + dp[i - 2];
    }
    
    return dp[n];
}

// Space optimized
public int climbStairsOptimized(int n) {
    if (n <= 2) return n;
    
    int prev = 1, curr = 2;
    for (int i = 3; i <= n; i++) {
        int next = prev + curr;
        prev = curr;
        curr = next;
    }
    
    return curr;
}
```

**Similar Pattern Problems**: Min Cost Climbing Stairs, Frog Jump

---

#### 2. **House Robber**
**Explanation**: Can't rob adjacent houses. DP[i] = max(DP[i-1], DP[i-2] + nums[i]). Time: O(n), Space: O(1).

```java
public int rob(int[] nums) {
    if (nums.length == 0) return 0;
    if (nums.length == 1) return nums[0];
    
    int prev2 = 0, prev1 = nums[0];
    
    for (int i = 1; i < nums.length; i++) {
        int curr = Math.max(prev1, prev2 + nums[i]);
        prev2 = prev1;
        prev1 = curr;
    }
    
    return prev1;
}
```

**Similar Pattern Problems**: House Robber II, House Robber III

---

#### 3. **Coin Change - Minimum Coins**
**Explanation**: Minimum coins to make amount. DP[i] = 1 + min(DP[i - coin]) for all coins. Time: O(amount * coins), Space: O(amount).

```java
public int coinChange(int[] coins, int amount) {
    int[] dp = new int[amount + 1];
    Arrays.fill(dp, amount + 1);
    dp[0] = 0;
    
    for (int i = 1; i <= amount; i++) {
        for (int coin : coins) {
            if (coin <= i) {
                dp[i] = Math.min(dp[i], 1 + dp[i - coin]);
            }
        }
    }
    
    return dp[amount] > amount ? -1 : dp[amount];
}
```

**Similar Pattern Problems**: Coin Change II (count ways), Perfect Squares

---

#### 4. **0/1 Knapsack**
**Explanation**: Maximize value with weight constraint. DP[i][w] = max(DP[i-1][w], DP[i-1][w-weight] + value). Time: O(n*W), Space: O(n*W).

```java
public int knapsack(int[] weights, int[] values, int capacity) {
    int n = weights.length;
    int[][] dp = new int[n + 1][capacity + 1];
    
    for (int i = 1; i <= n; i++) {
        for (int w = 1; w <= capacity; w++) {
            if (weights[i - 1] <= w) {
                dp[i][w] = Math.max(
                    dp[i - 1][w],
                    dp[i - 1][w - weights[i - 1]] + values[i - 1]
                );
            } else {
                dp[i][w] = dp[i - 1][w];
            }
        }
    }
    
    return dp[n][capacity];
}
```

**Similar Pattern Problems**: Partition Equal Subset Sum, Target Sum

---

### Medium

#### 5. **Longest Common Subsequence**
**Explanation**: DP[i][j] = DP[i-1][j-1] + 1 if chars match, else max(DP[i-1][j], DP[i][j-1]). Time: O(m*n), Space: O(m*n).

```java
public int longestCommonSubsequence(String text1, String text2) {
    int m = text1.length(), n = text2.length();
    int[][] dp = new int[m + 1][n + 1];
    
    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (text1.charAt(i - 1) == text2.charAt(j - 1)) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    
    return dp[m][n];
}
```

**Similar Pattern Problems**: Longest Common Substring, Longest Increasing Subsequence

---

#### 6. **Edit Distance**
**Explanation**: Minimum operations (insert, delete, replace) to convert string. DP[i][j] = DP[i-1][j-1] if match, else 1 + min(replace, insert, delete). Time: O(m*n), Space: O(m*n).

```java
public int editDistance(String word1, String word2) {
    int m = word1.length(), n = word2.length();
    int[][] dp = new int[m + 1][n + 1];
    
    for (int i = 0; i <= m; i++) dp[i][0] = i;
    for (int j = 0; j <= n; j++) dp[0][j] = j;
    
    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (word1.charAt(i - 1) == word2.charAt(j - 1)) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(
                    Math.min(dp[i - 1][j], dp[i][j - 1]),
                    dp[i - 1][j - 1]
                );
            }
        }
    }
    
    return dp[m][n];
}
```

**Similar Pattern Problems**: Regular Expression Matching, Distinct Subsequences

---

#### 7. **Longest Increasing Subsequence**
**Explanation**: DP[i] = longest LIS ending at i. DP[i] = max(DP[j] + 1) for all j < i where arr[j] < arr[i]. Time: O(n²), Space: O(n).

```java
public int lengthOfLIS(int[] nums) {
    int n = nums.length;
    int[] dp = new int[n];
    Arrays.fill(dp, 1);
    
    for (int i = 1; i < n; i++) {
        for (int j = 0; j < i; j++) {
            if (nums[j] < nums[i]) {
                dp[i] = Math.max(dp[i], dp[j] + 1);
            }
        }
    }
    
    int maxLen = 0;
    for (int len : dp) {
        maxLen = Math.max(maxLen, len);
    }
    
    return maxLen;
}

// Binary search optimization: O(n log n)
public int lengthOfLISOptimized(int[] nums) {
    List<Integer> tail = new ArrayList<>();
    
    for (int num : nums) {
        int pos = Collections.binarySearch(tail, num);
        if (pos < 0) pos = -(pos + 1);
        
        if (pos == tail.size()) {
            tail.add(num);
        } else {
            tail.set(pos, num);
        }
    }
    
    return tail.size();
}
```

**Similar Pattern Problems**: Largest Divisible Subset, Russian Doll Envelopes

---

#### 8. **Unique Paths in Grid**
**Explanation**: DP[i][j] = DP[i-1][j] + DP[i][j-1]. Only move right or down. Time: O(m*n), Space: O(m*n) or O(n).

```java
public int uniquePaths(int m, int n) {
    int[][] dp = new int[m][n];
    
    for (int i = 0; i < m; i++) dp[i][0] = 1;
    for (int j = 0; j < n; j++) dp[0][j] = 1;
    
    for (int i = 1; i < m; i++) {
        for (int j = 1; j < n; j++) {
            dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
        }
    }
    
    return dp[m - 1][n - 1];
}

// Space optimized
public int uniquePathsOptimized(int m, int n) {
    int[] dp = new int[n];
    Arrays.fill(dp, 1);
    
    for (int i = 1; i < m; i++) {
        for (int j = 1; j < n; j++) {
            dp[j] += dp[j - 1];
        }
    }
    
    return dp[n - 1];
}
```

**Similar Pattern Problems**: Unique Paths II (with obstacles), Min Path Sum

---

### Hard

#### 9. **Best Time to Buy and Sell Stock II**
**Explanation**: Multiple transactions allowed. Capture every upward trend. Can buy/sell or hold each day. Time: O(n), Space: O(1).

```java
public int maxProfit(int[] prices) {
    int profit = 0;
    
    for (int i = 1; i < prices.length; i++) {
        if (prices[i] > prices[i - 1]) {
            profit += prices[i] - prices[i - 1];
        }
    }
    
    return profit;
}

// DP approach (more generalizable)
public int maxProfitDP(int[] prices) {
    int buy = Integer.MIN_VALUE, sell = 0;
    
    for (int price : prices) {
        buy = Math.max(buy, sell - price);
        sell = Math.max(sell, buy + price);
    }
    
    return sell;
}
```

**Similar Pattern Problems**: Best Time to Buy and Sell Stock III (2 transactions), IV (k transactions)

---

#### 10. **Word Break**
**Explanation**: DP[i] = true if s[0:i] can be segmented. DP[i] = true if DP[j] is true and s[j:i] in wordDict. Time: O(n² * m), Space: O(n).

```java
public boolean wordBreak(String s, List<String> wordDict) {
    Set<String> words = new HashSet<>(wordDict);
    int n = s.length();
    boolean[] dp = new boolean[n + 1];
    dp[0] = true;
    
    for (int i = 1; i <= n; i++) {
        for (int j = 0; j < i; j++) {
            if (dp[j] && words.contains(s.substring(j, i))) {
                dp[i] = true;
                break;
            }
        }
    }
    
    return dp[n];
}
```

**Similar Pattern Problems**: Word Break II (return all segmentations), Concatenated Words

---

#### 11. **Burst Balloons**
**Explanation**: Reverse thinking: consider which balloon to burst last in range. DP[i][j] = max coins from bursting balloons between i and j. Time: O(n³), Space: O(n²).

```java
public int maxCoins(int[] nums) {
    int n = nums.length;
    int[] balloons = new int[n + 2];
    balloons[0] = 1;
    balloons[n + 1] = 1;
    
    for (int i = 0; i < n; i++) {
        balloons[i + 1] = nums[i];
    }
    
    int[][] dp = new int[n + 2][n + 2];
    
    for (int len = 1; len <= n; len++) {
        for (int left = 1; left + len - 1 <= n; left++) {
            int right = left + len - 1;
            
            for (int k = left; k <= right; k++) {
                int coins = dp[left][k - 1] + balloons[left - 1] * balloons[k] * balloons[right + 1] + dp[k + 1][right];
                dp[left][right] = Math.max(dp[left][right], coins);
            }
        }
    }
    
    return dp[1][n];
}
```

**Similar Pattern Problems**: Remove Boxes, Zuma Game

---

#### 12. **Matrix Chain Multiplication**
**Explanation**: Find optimal way to multiply matrix chain. DP[i][j] = min multiplications to compute product from i to j. Time: O(n³), Space: O(n²).

```java
public int matrixChainOrder(int[] dimensions) {
    // dimensions[i-1] x dimensions[i] is matrix i
    int n = dimensions.length - 1;
    int[][] dp = new int[n][n];
    
    // length is chain length from i to j
    for (int len = 2; len <= n; len++) {
        for (int i = 0; i <= n - len; i++) {
            int j = i + len - 1;
            dp[i][j] = Integer.MAX_VALUE;
            
            for (int k = i; k < j; k++) {
                int cost = dp[i][k] + dp[k + 1][j] + 
                           dimensions[i] * dimensions[k + 1] * dimensions[j + 1];
                dp[i][j] = Math.min(dp[i][j], cost);
            }
        }
    }
    
    return dp[0][n - 1];
}
```

**Similar Pattern Problems**: Optimal Binary Search Tree, Palindrome Partitioning II

---

#### 13. **Palindrome Partitioning II (DP)**
**Explanation**: Minimum cuts needed for palindrome partitions. DP[i] = min cuts for s[0:i]. Time: O(n²), Space: O(n).

```java
public int minCut(String s) {
    int n = s.length();
    boolean[][] isPalin = new boolean[n][n];
    int[] dp = new int[n];
    
    // Precompute palindromes
    for (int i = 0; i < n; i++) {
        for (int j = 0; j <= i; j++) {
            if (s.charAt(i) == s.charAt(j) && (i - j <= 1 || isPalin[j + 1][i - 1])) {
                isPalin[j][i] = true;
            }
        }
    }
    
    for (int i = 0; i < n; i++) {
        if (isPalin[0][i]) {
            dp[i] = 0;
        } else {
            dp[i] = i;
            for (int j = 1; j <= i; j++) {
                if (isPalin[j][i]) {
                    dp[i] = Math.min(dp[i], dp[j - 1] + 1);
                }
            }
        }
    }
    
    return dp[n - 1];
}
```

**Similar Pattern Problems**: Palindrome Partitioning (all partitions), Palindrome Removal

---

## 📌 Key Patterns & Techniques

### 1. **1D DP Pattern**
- Define: dp[i] = solution for problem of size i
- Recurrence: Based on previous states
- Base: dp[0] or dp[1] initialization

### 2. **2D DP Pattern (Grid/Subsequence)**
- Define: dp[i][j] for position or indices
- Fill: Usually left-to-right, top-to-bottom
- Recurrence: Combine from multiple previous states

### 3. **Interval DP Pattern**
- Define: dp[i][j] = solution for range [i, j]
- Recurrence: Try all split points k between i and j
- Use: Matrix Chain, Palindrome Partitioning, Burst Balloons

### 4. **Space Optimization**
- Only keep previous row/column if building iteratively
- Use rolling arrays to reduce space

### 5. **State Definition Best Practices**
- Be explicit about what dp[i] represents
- Check base cases carefully
- Validate transitions with examples

---

## 🎯 Common Pitfalls to Avoid

- ❌ Incorrect state definition (unclear what dp[i] means)
- ❌ Missing base cases or wrong initialization
- ❌ Wrong recurrence relation direction
- ❌ Not handling all transitions (e.g., all coins in coin change)
- ❌ Integer overflow in path calculations
- ❌ Off-by-one errors in indexing
- ❌ Not considering edge cases (empty string, n=0, etc.)
- ❌ Confusing similar problems (LCS vs LIS vs LCSubstring)
- ❌ Wrong order of DP dimension filling in interval DP
- ❌ Incorrect split point in optimal substructure problems
