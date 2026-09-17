---
tags:
  - dynamic-programming
  - dp
  - memoization
  - tabulation
  - recursion
  - neetcode-150
---

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
4. **Interval DP**: Range-based problems (matrix chain, burst balloons)
5. **State Compression**: Using bit manipulation or clever indexing

## DP Techniques
- Longest subsequence/substring problems
- Knapsack variants
- Coin change problems
- Path problems in grids
- Stock trading problems
- String matching problems
- Interval DP problems

---

## 🔹 Basic Templates

### Top-Down (Memoization) Template
```java
public int solve(int[] nums) {
    Integer[] memo = new Integer[nums.length];
    return dp(nums, 0, memo);
}

private int dp(int[] nums, int i, Integer[] memo) {
    if (i >= nums.length) return 0;
    if (memo[i] != null) return memo[i];
    int result = Math.max(nums[i] + dp(nums, i + 2, memo), dp(nums, i + 1, memo));
    memo[i] = result;
    return result;
}
```

### Bottom-Up (Tabulation) Template
```java
public int solve(int[] nums) {
    int n = nums.length;
    int[] dp = new int[n + 1];
    dp[0] = 0;
    for (int i = 1; i <= n; i++) {
        dp[i] = Math.max(nums[i-1] + dp[i-2], dp[i-1]);
    }
    return dp[n];
}
```

### DP Decision Flow
```mermaid
graph TD
    A["DP Problem"] --> B{"Can be broken into subproblems?"}
    B -->|No| C["Not a DP problem"]
    B -->|Yes| D{"Overlapping subproblems?"}
    D -->|No| E["Use Divide and Conquer"]
    D -->|Yes| F{"Optimal substructure?"}
    F -->|No| G["Use Greedy or other approach"]
    F -->|Yes| H{"How many state variables?"}
    H -->|1| I["1D DP"]
    H -->|2| J["2D DP"]
    H -->|Range-based| K["Interval DP"]
    I --> L["Define dp[i], recurrence, base case"]
    J --> M["Define dp[i][j], recurrence, base case"]
    K --> N["Define dp[i][j], try all splits"]
```

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Climbing Stairs**

**Problem Description:**
You are climbing a staircase with n steps. Each time you can climb 1 or 2 steps. In how many distinct ways can you climb to the top?

**Example Walkthrough:**

Input: `n = 3`
```
Expected Output: 3

Ways to climb:
1. 1 + 1 + 1
2. 1 + 2
3. 2 + 1

Step-by-step DP:
dp[1] = 1 (only one way: 1 step)
dp[2] = 2 (1+1 or 2)
dp[3] = dp[2] + dp[1] = 2 + 1 = 3

Return 3
```

Input: `n = 5`
```
Expected Output: 8

dp[1] = 1
dp[2] = 2
dp[3] = dp[2] + dp[1] = 2 + 1 = 3
dp[4] = dp[3] + dp[2] = 3 + 2 = 5
dp[5] = dp[4] + dp[3] = 5 + 3 = 8

Return 8
```

**Key Insight - Fibonacci Pattern:**
To reach step n, you must come from step n-1 (climb 1) or step n-2 (climb 2). So dp[n] = dp[n-1] + dp[n-2]. This is the Fibonacci sequence.

**Why It Works:**
- Last step is either 1 or 2 stairs
- All ways to reach n = ways to reach n-1 + ways to reach n-2
- Base cases: dp[1] = 1, dp[2] = 2
- This gives the classic Fibonacci recurrence

**Time Complexity**: O(n)
**Space Complexity**: O(n) for array, O(1) for optimized

**Visualization - Climbing Stairs:**
```mermaid
graph TD
    A["n=5"] --> B["dp[1]=1"]
    A --> C["dp[2]=2"]
    C --> D["dp[3]=dp[2]+dp[1]=3"]
    D --> E["dp[4]=dp[3]+dp[2]=5"]
    E --> F["dp[5]=dp[4]+dp[3]=8"]
```

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

**Edge Cases:**
- n = 1: returns 1
- n = 2: returns 2
- Large n: use long or modulo if needed
- n = 0: returns 1 (empty staircase, one way)

**Similar Pattern Problems:**
- Min Cost Climbing Stairs
- Frog Jump
- Decode Ways

---

#### 2. **House Robber**

**Problem Description:**
You are a robber planning to rob houses along a street. Each house has a certain amount of money. You cannot rob adjacent houses (security system). Find maximum amount you can rob.

**Example Walkthrough:**

Input: `nums = [2, 7, 9, 3, 1]`
```
Expected Output: 12

Rob houses 0, 2, 4: 2 + 9 + 1 = 12

Step-by-step DP:
dp[0] = 2
dp[1] = max(2, 7) = 7
dp[2] = max(7, 2+9) = 11
dp[3] = max(11, 7+3) = 11
dp[4] = max(11, 11+1) = 12

Return 12
```

Input: `nums = [2, 1, 1, 2]`
```
Expected Output: 4

Rob houses 0 and 3: 2 + 2 = 4

dp[0] = 2
dp[1] = max(2, 1) = 2
dp[2] = max(2, 2+1) = 3
dp[3] = max(3, 2+2) = 4

Return 4
```

**Key Insight - Skip or Rob:**
At each house, we have two choices:
- **Skip**: Keep the maximum from previous house (dp[i-1])
- **Rob**: Take current + maximum from two houses back (dp[i-2] + nums[i])

Choose whichever gives more money.

**Why It Works:**
- Can't rob adjacent houses, so robbing house i means we can only consider up to i-2
- Skipping house i means we keep whatever we had at i-1
- Taking max of both choices gives optimal at each step
- This is optimal substructure: best at i depends on best at i-1 and i-2

**Time Complexity**: O(n)
**Space Complexity**: O(1) optimized

**Visualization - House Robber:**
```mermaid
graph TD
    A["nums = [2, 7, 9, 3, 1]"] --> B["dp[0]=2"]
    B --> C["dp[1]=max(2,7)=7"]
    C --> D["dp[2]=max(7,2+9)=11"]
    D --> E["dp[3]=max(11,7+3)=11"]
    E --> F["dp[4]=max(11,11+1)=12"]
```

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

**Edge Cases:**
- Empty array: returns 0
- Single house: returns its value
- Two houses: returns max of both
- All houses same: alternates

**Similar Pattern Problems:**
- House Robber II (circular street)
- House Robber III (binary tree)
- Delete and Earn

---

#### 3. **Coin Change - Minimum Coins**

**Problem Description:**
Given coins of different denominations and a total amount, find the minimum number of coins needed to make up that amount. Return -1 if impossible.

**Example Walkthrough:**

Input: `coins = [1, 2, 5]`, `amount = 11`
```
Expected Output: 3 (5 + 5 + 1 = 11)

Step-by-step DP:
dp[0] = 0
dp[1] = 1 (coin 1)
dp[2] = 1 (coin 2)
dp[3] = 2 (coin 2 + 1)
dp[4] = 2 (coin 2 + 2)
dp[5] = 1 (coin 5)
dp[6] = 2 (coin 5 + 1)
dp[7] = 2 (coin 5 + 2)
dp[8] = 3 (coin 5 + 2 + 1)
dp[9] = 3 (coin 5 + 2 + 2)
dp[10] = 2 (coin 5 + 5)
dp[11] = 3 (coin 5 + 5 + 1)

Return 3
```

Input: `coins = [2]`, `amount = 3`
```
Expected Output: -1 (impossible)

dp[0] = 0
dp[1] = INF (can't make 1 with coin 2)
dp[2] = 1
dp[3] = INF (can't make 3)

Return -1
```

**Key Insight - Try Every Coin:**
For each amount i, try every coin. If coin <= i, we can use it plus the optimal solution for (i - coin). Take the minimum over all coins.

**Why It Works:**
- dp[i] = minimum coins to make amount i
- For each coin, if we use it, remaining amount is i - coin
- Optimal solution uses one of the coins as the "last" coin
- dp[i] = 1 + min(dp[i - coin]) for all valid coins
- Base case: dp[0] = 0 (zero coins for zero amount)

**Time Complexity**: O(amount * coins)
**Space Complexity**: O(amount)

**Visualization - Coin Change:**
```mermaid
graph TD
    A["coins=[1,2,5], amount=11"] --> B["dp[0]=0"]
    B --> C["dp[1]=1"]
    C --> D["dp[2]=1"]
    D --> E["dp[3]=2"]
    E --> F["dp[4]=2"]
    F --> G["dp[5]=1"]
    G --> H["dp[6]=2"]
    H --> I["dp[7]=2"]
    I --> J["dp[8]=3"]
    J --> K["dp[9]=3"]
    K --> L["dp[10]=2"]
    L --> M["dp[11]=3"]
```

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

**Edge Cases:**
- amount = 0: returns 0
- No valid combination: returns -1
- Single coin = amount: returns 1
- Coin larger than amount: ignored

**Similar Pattern Problems:**
- Coin Change II (count ways)
- Perfect Squares
- Minimum Cost For Tickets

---

#### 4. **0/1 Knapsack**

**Problem Description:**
Given n items with weights and values, and a knapsack capacity W, find the maximum value you can carry. Each item can be taken at most once.

**Example Walkthrough:**

Input: `weights = [1, 3, 4, 5]`, `values = [1, 4, 5, 7]`, `capacity = 7`
```
Expected Output: 9 (items 2 and 3: weight 3+4=7, value 4+5=9)

Step-by-step DP:
dp[i][w] = max value using first i items with capacity w

dp[0][*] = 0 (no items)
dp[*][0] = 0 (no capacity)

i=1 (w=1, v=1):
  w=1: dp[1][1] = max(dp[0][1], dp[0][0]+1) = max(0, 1) = 1
  w=2..7: dp[1][w] = 1

i=2 (w=3, v=4):
  w=1,2: dp[2][w] = dp[1][w] = 1
  w=3: dp[2][3] = max(dp[1][3], dp[1][0]+4) = max(1, 4) = 4
  w=4: dp[2][4] = max(dp[1][4], dp[1][1]+4) = max(1, 5) = 5
  w=5: dp[2][5] = max(dp[1][5], dp[1][2]+4) = max(1, 5) = 5
  w=6: dp[2][6] = max(dp[1][6], dp[1][3]+4) = max(1, 5) = 5
  w=7: dp[2][7] = max(dp[1][7], dp[1][4]+4) = max(1, 5) = 5

i=3 (w=4, v=5):
  w=4: dp[3][4] = max(dp[2][4], dp[2][0]+5) = max(5, 5) = 5
  w=5: dp[3][5] = max(dp[2][5], dp[2][1]+5) = max(5, 6) = 6
  w=6: dp[3][6] = max(dp[2][6], dp[2][2]+5) = max(5, 6) = 6
  w=7: dp[3][7] = max(dp[2][7], dp[2][3]+5) = max(5, 9) = 9

i=4 (w=5, v=7):
  w=5: dp[4][5] = max(dp[3][5], dp[3][0]+7) = max(6, 7) = 7
  w=6: dp[4][6] = max(dp[3][6], dp[3][1]+7) = max(6, 8) = 8
  w=7: dp[4][7] = max(dp[3][7], dp[3][2]+7) = max(9, 8) = 9

Return dp[4][7] = 9
```

Input: `weights = [2, 3, 4]`, `values = [3, 4, 5]`, `capacity = 5`
```
Expected Output: 7 (items 0 and 1: weight 2+3=5, value 3+4=7)

dp[3][5] = 7
```

**Key Insight - Include or Exclude:**
For each item i and capacity w:
- **Exclude**: Keep value from i-1 items with same capacity
- **Include**: If item fits, take item i + best value from i-1 items with reduced capacity
- Choose max of both options

**Why It Works:**
- dp[i][w] = max value using first i items with capacity w
- Each item has exactly 2 choices: include or exclude
- Including item i: value[i-1] + dp[i-1][w - weight[i-1]]
- Excluding item i: dp[i-1][w]
- This explores all 2^n combinations efficiently in O(n*W)

**Time Complexity**: O(n * capacity)
**Space Complexity**: O(n * capacity), optimized to O(capacity)

**Visualization - 0/1 Knapsack:**
```mermaid
graph TD
    A["Items: (1,1), (3,4), (4,5), (5,7)"] --> B["dp[0][*] = 0"]
    B --> C["i=1: dp[1][1]=1"]
    C --> D["i=2: dp[2][3]=4, dp[2][4]=5"]
    D --> E["i=3: dp[3][7]=9"]
    E --> F["i=4: dp[4][7]=9"]
    F --> G["Return 9"]
```

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

**Edge Cases:**
- No items: returns 0
- No capacity: returns 0
- All items fit: returns sum of all values
- No item fits: returns 0

**Similar Pattern Problems:**
- Partition Equal Subset Sum
- Target Sum
- Subset Sum Problem

---

### Medium

#### 5. **Longest Common Subsequence**

**Problem Description:**
Given two strings text1 and text2, return the length of their longest common subsequence. A subsequence is a sequence that appears in the same relative order but not necessarily contiguous.

**Example Walkthrough:**

Input: `text1 = "abcde"`, `text2 = "ace"`
```
Expected Output: 3 ("ace")

Step-by-step DP:
    ""  a  c  e
""   0  0  0  0
a    0  1  1  1
b    0  1  1  1
c    0  1  2  2
d    0  1  2  2
e    0  1  2  3

dp[5][3] = 3
```

Input: `text1 = "abc"`, `text2 = "abc"`
```
Expected Output: 3

    ""  a  b  c
""   0  0  0  0
a    0  1  1  1
b    0  1  2  2
c    0  1  2  3

dp[3][3] = 3
```

Input: `text1 = "abc"`, `text2 = "def"`
```
Expected Output: 0 (no common subsequence)

dp[3][3] = 0
```

**Key Insight - Match or Skip:**
For each pair (i, j):
- If characters match: dp[i][j] = dp[i-1][j-1] + 1
- If characters don't match: dp[i][j] = max(dp[i-1][j], dp[i][j-1])

**Why It Works:**
- If last characters match, they're part of LCS, so add 1 to LCS of prefixes without them
- If they don't match, one of them is not in LCS, so take max of skipping either
- Base case: empty string has LCS of 0 with anything
- Builds up solution from smallest prefixes to full strings

**Time Complexity**: O(m * n)
**Space Complexity**: O(m * n), optimized to O(min(m,n))

**Visualization - LCS:**
```mermaid
graph TD
    A["text1='abcde', text2='ace'"] --> B["Build 2D table"]
    B --> C["Fill row by row"]
    C --> D["Match 'a': dp[1][1]=1"]
    D --> E["Match 'c': dp[3][2]=2"]
    E --> F["Match 'e': dp[5][3]=3"]
    F --> G["Return 3"]
```

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

**Edge Cases:**
- Empty strings: returns 0
- One empty string: returns 0
- Identical strings: returns length
- No common characters: returns 0

**Similar Pattern Problems:**
- Longest Common Substring (contiguous)
- Longest Increasing Subsequence
- Edit Distance
- Shortest Common Supersequence

---

#### 6. **Edit Distance**

**Problem Description:**
Given two strings word1 and word2, return the minimum number of operations (insert, delete, replace) required to convert word1 to word2.

**Example Walkthrough:**

Input: `word1 = "horse"`, `word2 = "ros"`
```
Expected Output: 3

horse -> rorse (replace 'h' with 'r')
rorse -> rose (delete 'r')
rose -> ros (delete 'e')

Step-by-step DP:
    ""  r  o  s
""   0  1  2  3
h    1  1  2  3
o    2  2  1  2
r    3  2  2  2
s    4  3  3  2
e    5  4  4  3

dp[5][3] = 3
```

Input: `word1 = "intention"`, `word2 = "execution"`
```
Expected Output: 5

intention -> inention (remove 't')
inention -> enention (replace 'i' with 'e')
enention -> exention (replace 'n' with 'x')
exention -> exection (replace 'n' with 'c')
exection -> execution (insert 'u')

dp[9][9] = 5
```

**Key Insight - Three Operations:**
For each pair (i, j):
- If characters match: dp[i][j] = dp[i-1][j-1] (no operation)
- If characters don't match: dp[i][j] = 1 + min(
    - dp[i-1][j] (delete from word1)
    - dp[i][j-1] (insert into word1)
    - dp[i-1][j-1] (replace)
  )

**Why It Works:**
- dp[i][j] = min operations to convert word1[0..i] to word2[0..j]
- If last characters match, no operation needed on them
- If they don't match, we must either delete, insert, or replace
- Each operation reduces the problem to a smaller subproblem
- Taking minimum over all three gives optimal solution

**Time Complexity**: O(m * n)
**Space Complexity**: O(m * n), optimized to O(min(m,n))

**Visualization - Edit Distance:**
```mermaid
graph TD
    A["word1='horse', word2='ros'"] --> B["Base: dp[i][0]=i, dp[0][j]=j"]
    B --> C["Fill row by row"]
    C --> D["Match 'o': dp[2][2]=1"]
    D --> E["Match 's': dp[5][3]=3"]
    E --> F["Return 3"]
```

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

**Edge Cases:**
- One empty string: returns length of other
- Both empty: returns 0
- Identical strings: returns 0
- Completely different: returns max length

**Similar Pattern Problems:**
- Regular Expression Matching
- Distinct Subsequences
- One Edit Distance

---

#### 7. **Longest Increasing Subsequence**

**Problem Description:**
Given an integer array nums, return the length of the longest strictly increasing subsequence.

**Example Walkthrough:**

Input: `nums = [10, 9, 2, 5, 3, 7, 101, 18]`
```
Expected Output: 4 ([2, 3, 7, 101] or [2, 3, 7, 18])

Step-by-step DP:
dp[i] = LIS ending at index i

dp[0] = 1 (10)
dp[1] = 1 (9)
dp[2] = 1 (2)
dp[3] = 2 (2, 5)
dp[4] = 2 (2, 3)
dp[5] = 3 (2, 3, 7)
dp[6] = 4 (2, 3, 7, 101)
dp[7] = 4 (2, 3, 7, 18)

Return max = 4
```

Input: `nums = [7, 7, 7, 7, 7, 7, 7]`
```
Expected Output: 1 (strictly increasing)

All dp[i] = 1
Return 1
```

**Key Insight - Compare with All Previous:**
For each index i, check all previous indices j < i. If nums[j] < nums[i], we can extend the LIS ending at j. dp[i] = max(dp[j] + 1) for all valid j.

**Why It Works:**
- dp[i] = length of LIS ending at index i
- To extend to i, previous element must be smaller
- Try all possible previous elements
- Take maximum to get longest
- Answer is max over all dp[i]

**Time Complexity**: O(n^2), optimized to O(n log n)
**Space Complexity**: O(n)

**Visualization - LIS:**
```mermaid
graph TD
    A["nums = [10,9,2,5,3,7,101,18]"] --> B["dp[0]=1 (10)"]
    B --> C["dp[3]=2 (2,5)"]
    C --> D["dp[5]=3 (2,3,7)"]
    D --> E["dp[6]=4 (2,3,7,101)"]
    E --> F["Return 4"]
```

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

**Edge Cases:**
- Empty array: returns 0
- Single element: returns 1
- All same elements: returns 1
- Strictly increasing: returns n

**Similar Pattern Problems:**
- Largest Divisible Subset
- Russian Doll Envelopes
- Maximum Length of Pair Chain

---

#### 8. **Unique Paths in Grid**

**Problem Description:**
A robot is at top-left of an m x n grid. It can only move right or down. How many unique paths to reach bottom-right?

**Example Walkthrough:**

Input: `m = 3, n = 7`
```
Expected Output: 28

Grid:
S . . . . . .
. . . . . . .
. . . . . . E

Step-by-step DP:
dp[0][j] = 1 for all j (only one way: all right)
dp[i][0] = 1 for all i (only one way: all down)

dp[1][1] = dp[0][1] + dp[1][0] = 1 + 1 = 2
dp[1][2] = dp[0][2] + dp[1][1] = 1 + 2 = 3
...
dp[2][6] = 28

Return 28
```

Input: `m = 3, n = 3`
```
Expected Output: 6

Grid:
S . .
. . .
. . E

Paths:
1. R R D D
2. R D R D
3. R D D R
4. D R R D
5. D R D R
6. D D R R

dp[2][2] = 6
```

**Key Insight - Two Ways to Reach:**
To reach cell (i, j), robot must come from (i-1, j) [from above] or (i, j-1) [from left]. So dp[i][j] = dp[i-1][j] + dp[i][j-1].

**Why It Works:**
- First row: only one way (all right moves)
- First column: only one way (all down moves)
- Every other cell: sum of paths from above and left
- This is optimal substructure: paths to (i,j) depend on paths to neighbors

**Time Complexity**: O(m * n)
**Space Complexity**: O(m * n), optimized to O(n)

**Visualization - Unique Paths:**
```mermaid
graph TD
    A["m=3, n=3"] --> B["dp[0][*]=1, dp[*][0]=1"]
    B --> C["dp[1][1]=2"]
    C --> D["dp[1][2]=3"]
    D --> E["dp[2][1]=3"]
    E --> F["dp[2][2]=6"]
    F --> G["Return 6"]
```

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

**Edge Cases:**
- m = 1, n = 1: returns 1
- m = 1, n > 1: returns 1
- m > 1, n = 1: returns 1
- Large m, n: use long or BigInteger

**Similar Pattern Problems:**
- Unique Paths II (with obstacles)
- Min Path Sum
- Dungeon Game

---

### Hard

#### 9. **Best Time to Buy and Sell Stock II**

**Problem Description:**
Given an array of stock prices, find the maximum profit. You may complete as many transactions as you like (buy one and sell one share multiple times). You may not engage in multiple transactions simultaneously.

**Example Walkthrough:**

Input: `prices = [7, 1, 5, 3, 6, 4]`
```
Expected Output: 7

Buy at 1, sell at 5: profit = 4
Buy at 3, sell at 6: profit = 3
Total = 7

Greedy approach:
Day 1->2: 1-7 = -6 (skip)
Day 2->3: 5-1 = 4 (take)
Day 3->4: 3-5 = -2 (skip)
Day 4->5: 6-3 = 3 (take)
Day 5->6: 4-6 = -2 (skip)
Total = 4 + 3 = 7
```

Input: `prices = [1, 2, 3, 4, 5]`
```
Expected Output: 4

Buy at 1, sell at 5: profit = 4

Or capture each upward trend:
1->2: +1
2->3: +1
3->4: +1
4->5: +1
Total = 4
```

Input: `prices = [7, 6, 4, 3, 1]`
```
Expected Output: 0 (no profit possible)

All trends downward
Return 0
```

**Key Insight - Capture Every Upward Trend:**
Since we can make unlimited transactions, we can capture every price increase. If tomorrow's price > today's, we "buy today and sell tomorrow" for profit.

**Why It Works:**
- Any profitable sequence can be decomposed into consecutive day transactions
- Sum of all positive differences = maximum profit
- Greedy works because there's no limit on transactions
- Equivalent to: sum of all (prices[i] - prices[i-1]) where positive

**Time Complexity**: O(n)
**Space Complexity**: O(1)

**Visualization - Stock II:**
```mermaid
graph TD
    A["prices=[7,1,5,3,6,4]"] --> B["1->5: +4"]
    B --> C["3->6: +3"]
    C --> D["Total: 7"]
```

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

**Edge Cases:**
- Empty array: returns 0
- Single day: returns 0
- Strictly increasing: returns last - first
- Strictly decreasing: returns 0

**Similar Pattern Problems:**
- Best Time to Buy and Sell Stock III (2 transactions)
- Best Time to Buy and Sell Stock IV (k transactions)
- Best Time to Buy and Sell Stock with Cooldown

---

#### 10. **Word Break**

**Problem Description:**
Given a string s and a dictionary wordDict, return true if s can be segmented into a space-separated sequence of dictionary words.

**Example Walkthrough:**

Input: `s = "leetcode"`, `wordDict = ["leet", "code"]`
```
Expected Output: true

"leetcode" = "leet" + "code"

Step-by-step DP:
dp[0] = true (empty string)
dp[1] = false ("l" not in dict)
dp[2] = false ("le" not in dict)
dp[3] = false ("lee" not in dict)
dp[4] = true ("leet" in dict)
dp[5] = false
dp[6] = false
dp[7] = false
dp[8] = true ("code" in dict, dp[4]=true)

Return true
```

Input: `s = "applepenapple"`, `wordDict = ["apple", "pen"]`
```
Expected Output: true

"applepenapple" = "apple" + "pen" + "apple"

dp[5] = true (apple)
dp[8] = true (apple + pen)
dp[13] = true (apple + pen + apple)

Return true
```

Input: `s = "catsandog"`, `wordDict = ["cats", "dog", "sand", "and", "cat"]`
```
Expected Output: false

Can't segment "catsandog" into dictionary words
Return false
```

**Key Insight - Check All Split Points:**
dp[i] = true if s[0:i] can be segmented. For each i, check all j < i. If dp[j] is true and s[j:i] is in dictionary, then dp[i] is true.

**Why It Works:**
- dp[i] represents whether prefix s[0:i] can be segmented
- If we can segment s[0:j] and s[j:i] is a word, then s[0:i] can be segmented
- Try all possible split points j
- Base case: dp[0] = true (empty string)

**Time Complexity**: O(n^2 * m) where m is average word length
**Space Complexity**: O(n)

**Visualization - Word Break:**
```mermaid
graph TD
    A["s='leetcode', dict=['leet','code']"] --> B["dp[0]=true"]
    B --> C["dp[4]=true (leet)"]
    C --> D["dp[8]=true (code)"]
    D --> E["Return true"]
```

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

**Edge Cases:**
- Empty string: returns true
- Single word: returns true if in dict
- No valid segmentation: returns false
- Repeated words: works correctly

**Similar Pattern Problems:**
- Word Break II (return all segmentations)
- Concatenated Words
- Palindrome Partitioning

---

#### 11. **Burst Balloons**

**Problem Description:**
Given n balloons with numbers, burst them to collect maximum coins. When you burst balloon i, you get nums[left] * nums[i] * nums[right] coins. After bursting, left and right become adjacent. Find maximum coins.

**Example Walkthrough:**

Input: `nums = [3, 1, 5, 8]`
```
Expected Output: 167

Optimal order: burst 1, then 5, then 3, then 8
1: 3*1*5 = 15
5: 3*5*8 = 120
3: 1*3*8 = 24
8: 1*8*1 = 8
Total = 167

DP approach (reverse thinking):
Add boundaries: [1, 3, 1, 5, 8, 1]
Consider which balloon bursts LAST in range

dp[1][4] = max over k of:
  dp[1][k-1] + nums[0]*nums[k]*nums[5] + dp[k+1][4]

For k=3 (balloon 5):
  dp[1][2] + 1*5*1 + dp[4][4]
  = (burst 3,1) + 5 + (burst 8)
  = 15 + 5 + 8 = 28? No...

Let me redo:
nums = [1, 3, 1, 5, 8, 1] (with boundaries)
For range [1,4] (balloons 3,1,5,8):
  Try k=1 (balloon 3): 1*3*1 + dp[2][4] = 3 + dp[2][4]
  Try k=2 (balloon 1): dp[1][1] + 3*1*8 + dp[3][4] = 0 + 24 + dp[3][4]
  Try k=3 (balloon 5): dp[1][2] + 3*5*8 + dp[4][4] = dp[1][2] + 120 + 0
  Try k=4 (balloon 8): dp[1][3] + 5*8*1 = dp[1][3] + 40

dp[1][2] = max(1*3*1, 1*1*5) = 3? Let's compute:
  Range [1,2] (balloons 3,1):
  k=1: 1*3*5 + dp[2][2] = 15 + 0 = 15
  k=2: dp[1][1] + 1*1*5 = 0 + 5 = 5
  dp[1][2] = 15

dp[3][4] = max over k in [3,4]:
  k=3: 3*5*1 + dp[4][4] = 15 + 0 = 15
  k=4: dp[3][3] + 5*8*1 = 0 + 40 = 40
  dp[3][4] = 40

dp[1][3] = max over k in [1,3]:
  k=1: 1*3*1 + dp[2][3] = 3 + dp[2][3]
  k=2: dp[1][1] + 3*1*8 + dp[3][3] = 0 + 24 + 0 = 24
  k=3: dp[1][2] + 3*5*8 = 15 + 120 = 135
  dp[1][3] = max(3+dp[2][3], 24, 135)
  dp[2][3] = max over k in [2,3]:
    k=2: 3*1*8 + dp[3][3] = 24 + 0 = 24
    k=3: dp[2][2] + 1*5*8 = 0 + 40 = 40
    dp[2][3] = 40
  dp[1][3] = max(3+40, 24, 135) = 135

Now dp[1][4]:
  k=1: 1*3*1 + dp[2][4] = 3 + dp[2][4]
  k=2: dp[1][1] + 3*1*8 + dp[3][4] = 0 + 24 + 40 = 64
  k=3: dp[1][2] + 3*5*8 + dp[4][4] = 15 + 120 + 0 = 135
  k=4: dp[1][3] + 5*8*1 = 135 + 40 = 175
  dp[1][4] = 175? But expected 167...

Let me recompute dp[2][4]:
  Range [2,4] (balloons 1,5,8):
  k=2: 3*1*8 + dp[3][4] = 24 + 40 = 64
  k=3: dp[2][2] + 1*5*8 + dp[4][4] = 0 + 40 + 0 = 40
  k=4: dp[2][3] + 5*8*1 = 40 + 40 = 80
  dp[2][4] = 80

So dp[1][4]:
  k=1: 3 + 80 = 83
  k=2: 64
  k=3: 135
  k=4: 175
  dp[1][4] = 175

Hmm, 175 vs 167. Let me verify the actual optimal:
Burst order: 1, 5, 3, 8
1: 3*1*5 = 15
5: 3*5*8 = 120
3: 1*3*8 = 24
8: 1*8*1 = 8
Total = 167

Another order: 1, 5, 8, 3
1: 15
5: 120
8: 3*8*1 = 24
3: 1*3*1 = 3
Total = 162

Order: 5, 1, 3, 8
5: 3*5*8 = 120
1: 3*1*8 = 24
3: 1*3*8 = 24
8: 8
Total = 176? Wait:
After bursting 5: [3,1,8]
Burst 1: 3*1*8 = 24
After: [3,8]
Burst 3: 1*3*8 = 24
After: [8]
Burst 8: 1*8*1 = 8
Total = 120 + 24 + 24 + 8 = 176

Hmm, let me check if 176 is achievable:
Original: [3, 1, 5, 8]
Burst 5: 3*5*8 = 120, remaining [3,1,8]
Burst 1: 3*1*8 = 24, remaining [3,8]
Burst 3: 1*3*8 = 24, remaining [8]
Burst 8: 1*8*1 = 8
Total = 120 + 24 + 24 + 8 = 176

So 176 > 167. The expected output might be 167 for a different interpretation or I made an error. Let me just present the standard DP solution.

Actually, the standard answer for [3,1,5,8] is 167. Let me recheck my calculation.

Wait, I think the issue is that when you burst 5 first, the neighbors are 1 and 8, not 3 and 8.
Original: [3, 1, 5, 8]
Burst 5: neighbors are 1 and 8 (not 3 and 8)
Coins: 1*5*8 = 40, remaining [3,1,8]

Burst 1: neighbors are 3 and 8
Coins: 3*1*8 = 24, remaining [3,8]

Burst 3: neighbors are 1 (boundary) and 8
Coins: 1*3*8 = 24, remaining [8]

Burst 8: neighbors are 1 and 1 (boundaries)
Coins: 1*8*1 = 8

Total: 40 + 24 + 24 + 8 = 96? That's worse.

Let me try the order 1, 5, 3, 8:
Original: [3, 1, 5, 8]
Burst 1: neighbors 3 and 5
Coins: 3*1*5 = 15, remaining [3,5,8]

Burst 5: neighbors 3 and 8
Coins: 3*5*8 = 120, remaining [3,8]

Burst 3: neighbors 1 and 8
Coins: 1*3*8 = 24, remaining [8]

Burst 8: neighbors 1 and 1
Coins: 1*8*1 = 8

Total: 15 + 120 + 24 + 8 = 167

Yes! 167 is correct. My earlier calculation with 5 first was wrong because I used wrong neighbors.

So the DP solution is correct and returns 167.
```

Input: `nums = [1, 5]`
```
Expected Output: 10

Burst 1: 1*1*5 = 5, remaining [5]
Burst 5: 1*5*1 = 5
Total = 10

Or burst 5 first: 1*5*1 = 5, remaining [1]
Burst 1: 1*1*1 = 1
Total = 6

Max = 10
```

**Key Insight - Reverse Thinking (Last Balloon):**
Instead of thinking about which balloon to burst first, think about which balloon to burst LAST in a range. If balloon k is burst last in range [i, j], then all balloons between i and k-1 and between k+1 and j are already burst. The coins from bursting k last = nums[i-1] * nums[k] * nums[j+1].

**Why It Works:**
- dp[i][j] = max coins from bursting all balloons in range [i, j]
- If k is the last balloon burst in [i, j], then:
  - First burst all in [i, k-1] (dp[i][k-1])
  - Then burst all in [k+1, j] (dp[k+1][j])
  - Finally burst k: nums[i-1] * nums[k] * nums[j+1]
- Try all possible k as the last balloon
- Add boundaries (1 at both ends) to handle edge cases

**Time Complexity**: O(n^3) - three nested loops
**Space Complexity**: O(n^2) - 2D DP table

**Visualization - Burst Balloons:**
```mermaid
graph TD
    A["nums=[3,1,5,8]"] --> B["Add boundaries: [1,3,1,5,8,1]"]
    B --> C["len=1: dp[i][i] = nums[i-1]*nums[i]*nums[i+1]"]
    C --> D["len=2: try both as last"]
    D --> E["len=3: try all as last"]
    E --> F["len=4: dp[1][4] = 167"]
```

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

**Edge Cases:**
- Empty array: returns 0
- Single balloon: returns its value
- Two balloons: max of bursting either first
- All same values: works correctly

**Similar Pattern Problems:**
- Remove Boxes
- Zuma Game
- Strange Printer

---

#### 12. **Matrix Chain Multiplication**

**Problem Description:**
Given dimensions of matrices in a chain, find the minimum number of scalar multiplications needed to compute the product.

**Example Walkthrough:**

Input: `dimensions = [10, 20, 30]`
```
Expected Output: 6000

Matrices: A(10x20), B(20x30)
Only one way: A*B = 10*20*30 = 6000

Return 6000
```

Input: `dimensions = [10, 20, 30, 40, 30]`
```
Expected Output: 30000

Matrices: A(10x20), B(20x30), C(30x40), D(40x30)

Possible parenthesizations:
(AB)(CD): 10*20*30 + 30*40*30 + 10*30*30 = 6000 + 36000 + 9000 = 51000
A(BC)D: 20*30*40 + 10*20*40 + 10*40*30 = 24000 + 8000 + 12000 = 44000
A((BC)D): same as above
((AB)C)D: 10*20*30 + 10*30*40 + 10*40*30 = 6000 + 12000 + 12000 = 30000

Minimum = 30000

DP:
dp[i][j] = min cost to multiply matrices i to j

dp[0][1] = 10*20*30 = 6000
dp[1][2] = 20*30*40 = 24000
dp[2][3] = 30*40*30 = 36000

dp[0][2] = min(
  dp[0][0] + dp[1][2] + 10*20*40 = 0 + 24000 + 8000 = 32000
  dp[0][1] + dp[2][2] + 10*30*40 = 6000 + 0 + 12000 = 18000
) = 18000

dp[1][3] = min(
  dp[1][1] + dp[2][3] + 20*30*30 = 0 + 36000 + 18000 = 54000
  dp[1][2] + dp[3][3] + 20*40*30 = 24000 + 0 + 24000 = 48000
) = 48000

dp[0][3] = min(
  dp[0][0] + dp[1][3] + 10*20*30 = 0 + 48000 + 6000 = 54000
  dp[0][1] + dp[2][3] + 10*30*30 = 6000 + 36000 + 9000 = 51000
  dp[0][2] + dp[3][3] + 10*40*30 = 18000 + 0 + 12000 = 30000
) = 30000

Return 30000
```

**Key Insight - Try Every Split:**
For range [i, j], try every possible split point k. The cost is:
- Cost of left part [i, k]
- Cost of right part [k+1, j]
- Cost of multiplying the two resulting matrices

**Why It Works:**
- Matrix multiplication is associative, so we can parenthesize in many ways
- Optimal parenthesization has optimal sub-parenthesizations
- dp[i][j] = min over all k of: dp[i][k] + dp[k+1][j] + dimensions[i]*dimensions[k+1]*dimensions[j+1]
- Build from smaller chains to larger chains

**Time Complexity**: O(n^3)
**Space Complexity**: O(n^2)

**Visualization - Matrix Chain:**
```mermaid
graph TD
    A["dimensions=[10,20,30,40,30]"] --> B["len=2: dp[0][1]=6000, dp[1][2]=24000, dp[2][3]=36000"]
    B --> C["len=3: dp[0][2]=18000, dp[1][3]=48000"]
    C --> D["len=4: dp[0][3]=30000"]
    D --> E["Return 30000"]
```

```java
public int matrixChainOrder(int[] dimensions) {
    int n = dimensions.length - 1;
    int[][] dp = new int[n][n];
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

**Edge Cases:**
- Two matrices: only one way
- Single matrix: returns 0
- All same dimensions: works correctly
- Large chains: O(n^3) may be slow

**Similar Pattern Problems:**
- Optimal Binary Search Tree
- Palindrome Partitioning II
- Minimum Cost to Cut a Stick

---

#### 13. **Palindrome Partitioning II (DP)**

**Problem Description:**
Given a string s, partition it such that every substring is a palindrome. Return the minimum cuts needed.

**Example Walkthrough:**

Input: `s = "aab"`
```
Expected Output: 1

"aab" -> "aa" | "b" (1 cut)
Both "aa" and "b" are palindromes.

DP:
isPalin[0][0] = true ("a")
isPalin[1][1] = true ("a")
isPalin[2][2] = true ("b")
isPalin[0][1] = true ("aa")
isPalin[1][2] = false ("ab")
isPalin[0][2] = false ("aab")

dp[0] = 0 (single char is palindrome)
dp[1] = 0 (isPalin[0][1] = true)
dp[2]:
  isPalin[0][2]? No -> dp[2] = 2
  j=1: isPalin[1][2]? No
  j=2: isPalin[2][2]? Yes -> dp[2] = min(2, dp[1]+1) = min(2, 1) = 1

Return dp[2] = 1
```

Input: `s = "a"`
```
Expected Output: 0 (already palindrome)

dp[0] = 0
Return 0
```

Input: `s = "ab"`
```
Expected Output: 1

"ab" -> "a" | "b" (1 cut)

isPalin[0][0]=true, isPalin[1][1]=true, isPalin[0][1]=false

dp[0] = 0
dp[1]: isPalin[0][1]? No -> dp[1]=1
       j=1: isPalin[1][1]? Yes -> dp[1]=min(1, dp[0]+1)=min(1,1)=1

Return 1
```

**Key Insight - Precompute Palindromes:**
First, precompute which substrings are palindromes using DP. Then, use another DP to find minimum cuts. dp[i] = minimum cuts for s[0:i]. If s[0:i] is palindrome, dp[i] = 0. Otherwise, try all j where s[j:i] is palindrome and dp[i] = min(dp[j-1] + 1).

**Why It Works:**
- dp[i] = min cuts for prefix s[0:i]
- If prefix is palindrome, 0 cuts needed
- Otherwise, we make a cut at some j, and s[j:i] must be palindrome
- dp[i] = min over all valid j of dp[j-1] + 1
- Precomputing palindromes avoids repeated O(n) checks

**Time Complexity**: O(n^2) - both palindrome precompute and DP
**Space Complexity**: O(n^2) for isPalin, O(n) for dp

**Visualization - Palindrome Partitioning II:**
```mermaid
graph TD
    A["s='aab'"] --> B["Precompute palindromes"]
    B --> C["isPalin[0][1]=true (aa)"]
    C --> D["dp[0]=0, dp[1]=0"]
    D --> E["dp[2]=dp[1]+1=1"]
    E --> F["Return 1"]
```

```java
public int minCut(String s) {
    int n = s.length();
    boolean[][] isPalin = new boolean[n][n];
    int[] dp = new int[n];
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

**Edge Cases:**
- Empty string: returns 0
- Single character: returns 0
- All same characters: returns 0
- No palindromes > 1: returns n-1

**Similar Pattern Problems:**
- Palindrome Partitioning (all partitions)
- Palindrome Removal
- Minimum Cost to Cut a Stick

---

## 📌 Key Patterns & Techniques

### 1. **1D DP Pattern**
- Define: dp[i] = solution for problem of size i
- Recurrence: Based on previous states
- Base: dp[0] or dp[1] initialization
- Examples: Climbing Stairs, House Robber, Coin Change

### 2. **2D DP Pattern (Grid/Subsequence)**
- Define: dp[i][j] for position or indices
- Fill: Usually left-to-right, top-to-bottom
- Recurrence: Combine from multiple previous states
- Examples: LCS, Edit Distance, Unique Paths

### 3. **Interval DP Pattern**
- Define: dp[i][j] = solution for range [i, j]
- Recurrence: Try all split points k between i and j
- Use: Matrix Chain, Palindrome Partitioning, Burst Balloons
- Fill by increasing length

### 4. **Space Optimization**
- Only keep previous row/column if building iteratively
- Use rolling arrays to reduce space
- Examples: 0/1 Knapsack, LCS, Unique Paths

### 5. **State Definition Best Practices**
- Be explicit about what dp[i] represents
- Check base cases carefully
- Validate transitions with examples
- Write recurrence relation clearly

---

## 🎯 Common Pitfalls to Avoid

- Incorrect state definition (unclear what dp[i] means)
- Missing base cases or wrong initialization
- Wrong recurrence relation direction
- Not handling all transitions (e.g., all coins in coin change)
- Integer overflow in path calculations
- Off-by-one errors in indexing
- Not considering edge cases (empty string, n=0, etc.)
- Confusing similar problems (LCS vs LIS vs LCSubstring)
- Wrong order of DP dimension filling in interval DP
- Incorrect split point in optimal substructure problems
- Forgetting to take max/min at the right step
- Not optimizing space when possible