# Dynamic Programming

## Key Concepts

- Solves overlapping subproblems
- Optimal substructure

## Common Problems

- Fibonacci Sequence
- Longest Common Subsequence
- 0/1 Knapsack

## Techniques

- Memoization (Top-Down)
- Tabulation (Bottom-Up)

## 🔹 Practice Problems by Topic

* **Climbing Stairs**: similar to fibonacci
* **Frog Jump**: Similar to above just need to subtract energy to jump (frog need to reach end)
      * Que: [10,20,30,10] Ans: 20

```java
      public class ClimbStairsOptimized {
         public int climbStairs(int n, int arr) {

            int first = 0;
            int second = 0;

            for (int i = 1; i < n; i++) {
                  int fs = first + Math.abs(arr[i] - arr[i-1]); // jumping 1 step
                  int ss = Integer.MAX_VALUE;
                  if(i>1) ss = second + Math.abs(arr[i] - arr[i-2]); // jumping 2 steps

                  int temp = Math.min(fs, ss); // taking min or max based on question
                  second = first; 
                  first = temp;
            }

            return first;
         }
      }
```
* **Frog Jump to K distance**: similar to above problem, just one change before we were doing for step 1 and step 2, now we will do till k steps meaning we will iterate min/max logic in a for loop and get the result
```java
for (int i = 1; i < n; i++) {
   int minSteps = Integer.MAX_VALUE;
   for(int j = 1; j <= k; j++>) {
      int ss = Integer.MAX_VALUE;
      if(i-j>=0) ss = dp[i-j] + Math.abs(arr[i] - arr[i-j]);
      minSteps = Math.min(fs, ss)
   }
   dp[i] = minSteps;
}
```
* **Maximum sum of non Adjecent elements**: Here as the questions says we can't use contiguos elements for adding up the numbers. So what we do is we start with the classic DP approach of subsequence, where we add element by the take or notTake approach, and solve the problem 
      * Que: [2,1,4,9] Ans: 11
```java
fun(3, arr);

int fun(int i, int[] arr) {
   if(i<0) return 0;
   if(i == 0) return arr[0];

   int take = arr[i] + fun(i-2, arr); // takes the element and will take the next+1 element
   int notTake = fun(i-1, arr); // does not take, basically says we can take next element

   return Math.max(take, notTake); // return the max value
}
```
* **House Robber**: Similar to above
* **House Robber 2**: Similar to above, here we can't take the first and last element, so we call the method 2 times with [0, n-2] and [1, n-1], means skipping first one time and last second, and then taking max or min as per the expectation
* **Grid Unique Paths**
* **Grid Unique Paths 2**
* **Min Path Sum**
* **Max Path Sum**
* **Triangle** : Most of these problems will start at a certain index and then move to another in (i-1, j), (i, j-1) or (i-1,j-1) paths. based on questions these change but the core concept remains the same of take and notTake.
* **Cherry Pickup 2 [3D Array]**: 
    * Similar to above here 2 start points will be given, core logic remains the same just a change is that when 2 paths collide we will take a single value from both. Also here in function we will have 3 vars instead of 2. Here row remains the same as both start from first row but start index is different that's why. Ending points can be similar, that's why we will take one value if they reach at same index and will take different value if they reach at different indexes. 
    * Now as we need to generate all the combinations for 3 pointers we will need a for loop which will start from first person -1 to +1 value and same for second as well.
```java

  return dp(grid, 0, 0, n - 1, mem);

  public int cherryPickup(int[][] grid) {
    final int m = grid.length;
    final int n = grid[0].length;
    int[][][] mem = new int[m][n][n];
    Arrays.stream(mem).forEach(A -> Arrays.stream(A).forEach(B -> Arrays.fill(B, -1)));
    return dp(grid, 0, 0, n - 1, mem);
  }

  // Returns the maximum cherries we can collect, where robot #1 is on (x, y1) and robot #2 is on (x, y2).
  private int dp(int[][] grid, int x, int y1, int y2, int[][][] mem) {
    if (x == grid.length) // end of rows
      return 0;
    if (y1 < 0 || y1 == grid[0].length || y2 < 0 || y2 == grid[0].length) // out of bounds case
      return 0;
    if (mem[x][y1][y2] != -1)
      return mem[x][y1][y2];

    final int currRow = grid[x][y1] + (y1 == y2 ? 0 : grid[x][y2]); // checking if both match then don't add and take one otherwise add both

    for (int d1 = -1; d1 <= 1; d1++)
      for (int d2 = -1; d2 <= 1; d2++)
        mem[x][y1][y2] = Math.max(mem[x][y1][y2], currRow + dp(grid, x + 1, y1 + d1, y2 + d2, mem)); // calling all the 9 combinations here for d1 and d2

    return mem[x][y1][y2];
  }

```
* **Subset sum equal to K**: Mostly similar to problem 4 just that this is 2D, here we will have index and sum and 2 params for our DP. whenever we pass the values just make sure if we are taking it then f(i-1,sum-arr[index]) will be passed otherwise f(i-1, sum) will be passed. Small cases will be added that sum should not be negative when subtracting. 
* **Partition Equal Subset Sum**:
      * Que: [2,3,3,3,4,5] must be divided to equal sum > [2,3,5] & [3,3,4]
      * Approach: For this first calculate the total sum fo the array, if sum%2==0 then we can divide it and follow the above problem with Sum as sum/2 and we are good.
* **Partition A Set Into Two Subsets With Minimum Absolute Sum Difference**: This is similar to subset sum problem, where we have create a boolean array which will tell us whether we can get the target sum or not. Now next step is to iterate through the optimized dp solution and subtract s2 = totalSum - s1 and s1 will get the final min value.
```java
   for(int s1 = 0; s1<=totalSum/2;s1++){
      if(dp[lastRow][s1] == true) // subset sum is possible that means true
         min = Math.min(min, (totalSum-s1) - s1) // basically saying s2 - s1; as the data will be stored as [0,3,5,7,9,12], for s1 it is from begining and for s2 it from end. 
   }
```
* **Counts Subsets with Sum K**: Similar to problem 12, just we need to all the results if it matches with the sum.
* **Count Partitions With Given Difference**:  Similar to problem 12, just a minor change the sum that we will be finding is = (totalSum - diff) / 2
* **0/1 Knapsack**: similar to problem 12, here we will be subtracting the weight from the weight capacity of bag, it will break once the loop reaches to end for items.
* **Coin change**: Similar to above, just that when we are taking a coin it is not moved to next index for take case if it is less than total value, only for not take case it moved to next index. And as always when we are taking a value that means we need to subtract that value from totalValue. If it reaches to zero then that means we have reached to final.
* **Target Sum**: Similar to 16, just a change here is questions is talking about + and - signs which basically means dividing the data into 2 sets.
* **Coin Change 2 | Infinite Supply Problems**: Asking for how many ways we can make the amount, just add take and notTake and we will be good.
* **Unbounded Knapsack**: Same as coin change problem
* **Rod Cutting Problem**: Similar to 0/1 Knapsack problem
* **Longest Common Subsequence**: This also follows the approach of match and not match, but here as this is a String problem we will be adding few more cases.
```java
s1 = "adcbc", s2 = "dcadb"
if(s1.charAt(i) == s.charAt(j))
   return 1 + f(i-1, j-1, arr); // As the char matches we go to previous index at both strings

return Math.max(f(i, j-1, arr), f(i-1, j, arr)); // char is not matching at index so we go for previous index for s1 and second call for s2 saying that, may be they can match
```
* **Print Longest Common Subsequence**: Similar to above question, go for the optimized solution for above question and then we need to iterate through the dp array with below conditions. Single loop should be enough and start from last indexes of both Strings.
      * If they match then go to i-1, j-1
      * If they don't match then if dp[i-1][j] > dp[i][j] then i--; else j--;
* **Longest Common Substring**: Similar to LCS problem just that the notTake part is not considered as we want subString not sequence
* **Longest Palindromic Subsequence**: Similar to LCS, here for string 2 we need to reverse the original String and send it.
* **Minimum Insertions to Make String Palindrome**: Similar to LCS, get the count of above program and subtract from the total size of original string
* **Minimum Insertions/Deletions to Convert String A to String B**: s1.size() + s2.size() - 2 * LCS of both
* **Shortest Common Supersequence**: 
      * Que : s1="brute", s2="groot" Result: "bgruoote"
      * Ans: 
      * Approach is similar to 24, just one change is previously we were just printing matching chars now we will add them even if they don't match.
      * But post that there is a chance that data will still remain in either of those strings so lets add that as well to the result.
```java
s1 = "brute", s2 = "groot"
while(i>0 && j>0) {
   if(s1.charAt(i-1) == s2.charAt(j-1)) { // if matched then add and reduce both indexes
      result += s1.charAt(i-1);
      i--;
      j--;
   } else if(dp[i-1][j] > dp[i][j]) { // if d[i-1][j] > dp[i][j] then add from first string
      result += s1.charAt(i-1);
      i--;
   }else {
      result += s2.charAt(j-1); // add from second string
      j--;
   }
}

while(i>0) result += s1.charAt(i-1); i--; // add the remaining chars from string 1
while(j>0) result += s2.charAt(j-1); j--; // add the remaining chars from string 2
```
* **Distinct Subsequences**: As part of this problem we need to find that how many times string 2 is present in string 1 as a subsequence, there is a slight change with this problem here.
      * if the char matches on both string we can consider the index from first string or we can ignore that, means (i-1, j-1) + (i-1, j) 
      * if they don't match just move the first string cause we need to match the first string with second so we do (i-1, j)
```java
s1 = "babgbag", s2 = "bag"

if(j<0) return 1; // basically saying s2 is exhausted 
if(i<0) return 0; // nothing to compare 

if(s1.charAt(i) == s.charAt(j))
   return f(i-1, j-1, arr) + f(i-1, j, arr); 

return f(i-1, j, arr); // char is not matching at index so we go for previous index for s1
```
* **Edit Distance**: Here we need to calculate min operations required to convert one string to another, we can do delete, insert and replace, to solve this
   * If both strings match then we move to (i-1, j-1)
   * If they do not match in that case we take min of (i-1, j) or (i, j-1) or (i-1,j-1) and adding 1 to each
* **Wildcard matching**: Here we need to match the string with the pattern, like ?ay with ray, **aab with aaab, to solve this
   * If current char is ? or both strings char match then we move to next index for both f(i-1,j-1)
   * If current char is * then match the before char on either of those strings meaning f(i-1, j) or f(i, j-1)
   * for base case as * can be matched to zero or more chars we need to iterate the pattern, if the first string is exhuasted and pattern is still remaining as we can see in the example 2, then we need to check if there is any char apart froom * is left then it is incorrect.
* **Best Time to Buy and Sell Stock**: 
   * Que: [7, 1, 5, 3, 6, 4] Ans: 5, You can buy only once
   * Here we will keep track of the min element of the arr and subtract it with the current value.
```java
   int cost = arr[i]-min;
   profit = Math.max(profit, cost);
   min = Math.min(min, arr[i]);
```
* **Best Time to Buy and Sell Stock 2**: 
   * Que: [7, 1, 5, 3, 6, 4] Ans: 7, Here You can buy multiple times
   * This is similar to take and not take case scenario where we can decide to take the value or we don't, so we need to keep 2 vars one will be index and second will be to know whether we are buying or selling and call this data in recursion
   * In optimized approach we take 4 vars and do the same.
```java
   long profit = 0;
   if(buy == 1){
      profit = Math.max(-arr[i] + f(i-1, 0, arr) // take case, here we considered a value so we are saying next time I can only sell
                        0 + f(i-1, 1, arr))      // not take case, here we have decided not to buy and that's why we skipped it
   } else {
      profit = Math.max(arr[i] + f(i-1, 1, arr) // take case, here we considered a value so we are saying next time I can only buy
                        0 + f(i-1, 0, arr))     // not take case, here we have decided not to sell and that's why we skipped it
   }
   return profit;
```
* **Best Time to Buy and Sell Stock 3**: 
   * Que: [3,4,5,0,0,3,1,4] Ans: 6, Here you can do at max 2 transactions
   * Similar to above problem, one change is that we need to maintain a variable which will keep track of the transaction made so far, which we will change based on take case
```java
   if(i==n || trans == 2*k) return 0; // we did 2*k becauses sell is 1 transaction and buy is 1
   long profit = 0;
   if(trans%2 == 0){
      profit = Math.max(-arr[i] + f(i-1, 0, trans+1, arr) // take case, here we considered a value so we are saying next time I can only sell
                        0 + f(i-1, 1, trans, arr))      // not take case, here we have decided not to buy and that's why we skipped it
   } else {
      profit = Math.max(arr[i] + f(i-1, 1, trans+1, arr) // take case, here we considered a value so we are saying next time I can only buy
                        0 + f(i-1, 0, trans, arr))     // not take case, here we have decided not to sell and that's why we skipped it
   }
   return profit;
```
* **Best Time to Buy and Sell Stock 4**: Similar to above, there we had 2 here we have k
   * Que: [3,4,5,0,0,3,1,4] Ans: 6, Here you can do at max k transactions
* **Best Time to Buy and Sell Stock with Cooldown**:
   * Que: [4,9,0,4,10] Ans: 11, You cannot buy after sell
   * Similar to stock 2 question, here when we sell anything then we will do i-2 instead of i-1 that's it, cause you are not allowed to buy on next day, for take case
* **Best Time to Buy and Sell Stock With Transaction Fee**:
   * Que: [4,9,0,4,10] Ans: 11, You need to pay transaction fee post selling
   * Similar to stock 2 question, here when we are selling that time we will subtract the value from the profit and we are good, for take case
* **Longest Increasing subsequence**:
   * For this question we will check if the new value is greater than the prev value then take it add to the result. Similar to take and not take case, just that first we will start with not take case and take the max value and return it.
```java

   int len = 0 + f(i+1, prevIndex);                // not take case
   if(prevIndex == -1 || arr[i] > arr[prevIndex])
      len = Math.max(len, f(i+1, i));             // take case  
   
   return len;
```
*  **Printing Longest Increasing Subsequence**:
   * To solve this convert the above ans to dp[1] size,
```java

// Step 1 : Loop through dp to find the max length (len) and its last index (ind).

// Step 2: Backtrack to Print LIS
// Start from ind (last element of LIS).
// Move backward and collect elements where dp[i] == len.
// Decrease len each time we add an element.

int i = ind;
List<Integer> ans = new ArrayList<>();
while (len > 0) {
    if (dp[i] == len) {
        ans.add(nums[i]);
        len--;
    }
    i--;
}
Collections.reverse(ans);

```
* **Longest Increasing subsequence**: Using Binary Search
   * For this what we can do is create a list in which we will enter the elements if they are greater than the last elemtent of the list, and increase the count.
   * If it is lesser than the last element then we will get the index at which it should be inserted using binary search. if it is not present then it will return -1 then we need to follow below if case.
```java
   int pos=Collections.binarySearch(temp,arr[i]);
   if(pos<0){
      pos=Math.abs(pos)-1;
   }
   temp.set(pos,arr[i]);
```

* **Largest Divisible Subset**:
   * Similar to LIS logic, previously we were just checking the number is greater than previous element or not, here first we will sort the array and then we will check if the element is divisible by previous element or not, if it is then we add it. And if we want to print it then we can follow above question's approach
* **Longest String Chain**:
   * Similar to LIS logic, previously we were checking the number comparison whether it is greater than the previous one, here we will compare the strings, if the string is not greater in length than the previous one then we will return false, and we will also check if they are both matching or not expect the last char, if both condition satisfy then we are good otherwise we will return false.
   * Also we need to sort the strings on basis of length, to make sure above logic works
* **Longest String Chain**: First increasing and then decreasing sequence
   * Similar to LIS, we need to first start from 0 index and then from length-1 index to get 2 dps, once you have both iterate over then and add the results of both -1 and then you will get the ans.
 * **Number of Longest Increasing Subsequences**:
   * Similar to LIS, here we need to maintain a count arr which will maintain the count of all the LIS we have so far. If the previous element is greater than the current we assign the old value of count to the new count index, but If the previous dp value + 1 is equal to current dp value in that case we increase the counter value by 1 to the previous value.
```java

   for(int i=0; i<n;i++){
      for(int prev=0; prev<i; prev++){
         if(arr[prev] < arr[i] && 1+dp[prev] > dp[i]) { // condition checking the LIS code which remains the same for all, just some tweak here and there based on ask
            dp[i] = 1+dp[prev];
            count[i] = count[j];
         }else if(arr[prev] < arr[i] && 1+dp[prev] == dp[i]) { // newly added condition for count
            count[i] = count[j+1]
         }
      }
      max = Math.max(max, dp[i]);
   }

   int nos = 0;
   for(int i=0; i<n;i++)
      if(dp[i] == max) nos += count[i];

   return nos;
```
* **Matrix Chain Multiplication**: Partition DP
   * As part of this problem we have given an matrix where we need to calculate the minimum cost required to multiple the matrices.
   * Here basically we need to partition the matrices in such a way that it results in min cost, for that we need to introduce the partition DP pattern where we will divide the array using 3 pointers and then we will take the best partition out of all.
   * Here we introduce new set of rules, which are 
      1) take the base cases 
      2) try out all the partitions
      3) return the min of all (this will change based on the test case).
   * Now what we do is we break the array in pieces using 3 pointers i, k and j.
   * i and k will start from the first index of the array and j will be the end of the array. we start from 1st index because we consider first index as row of first matrix, if we don't consider that the result will be 0 as on the 0th index the row size will be 0 and column size will be 10 (if 0th index value is 10);
   * Once we have done it we will iterate k from i to j to get min steps needed to multiply the matrix.
```java

   /**
    * If we want to multiply 2 matrix then the column of first and row of second should match
    * e.g. A = [10][30], B = [30][50]
    * In such cases it is possible to multiply these matrices, so the result will be 10 * 30 * 50
    * **/

   // call
   f(1, n-1, arr); 

   // base case
   if(i==j) return 0; // nothing to multiply with so we return 0

   int min=Integer.MAX_VALUE;

   for(int k = i; k<=j; k++) {
      int cost = arr[i-1] * arr[k] * arr[j] +  // this will change based on the question, as here we need to multiply the matrix so that's why we are doing such operations like 10*20*50  
               f(i, k, arr) +                  // here we start from i to k, the first partition
               f(k+1, j, arr);                 // here we start from k+1 to j, the second partition
      if(cost < min) min=cost;
   }

   return cost;

```
* **Minimum Cost to Cut the Stick**: Similar approach like above will be taken where we will divide the problems into partition and get the ans (chololate or rod cutting)
   * Before starting this problem we need to sort the array
   * Here again we use 3 pointers to divide the problem into partitions. But in this problem there is one change we can't use the k's value after cutting. Also we will start from 1 and n-2 for i and j.
   * Why we need to start from 1 we disucssed in last problems as well where we can't start partition from 0 cause there is nothing to cut from it. But here last will also follow the same pattern why because once we cut at last here there will be nothing to compare the value with.
   * Suppose we have an array [1,3,4,5] with lenght of stick as 7, then if we make a cut at index 0 i.e. of value 1 then the new paritions will be [1] and [1,3,4,5], now for these paritions if we calculate the final cost it will be (last+1) - (start-1) > Let us replaces the values, arr[last+1] - arr[start-1] > 7-0 > as you can see there will be no change in the final result of the length.
   * Now you ask why 7 and why 0 ... as there are no such values in the array, so what we are seeing is when we go beyond the last length of array we will reach the final length for cut which is nothing but 7, and before starting index 1 there is nothing on which we can cut with so it will be 0.
   * Here as I already mentioned there is one small change from above problem, we will not cosider the k's value as we have already discussed in approach.
```java

   // call
   f(1, n-1, arr); 

   // base case
   if(i>j) return 0; // nothing to return cause it is cross the cut boundary

   int min=Integer.MAX_VALUE;

   for(int k = i; k<=j; k++) {
      int cost = arr[j+1] - arr[i-1] +         // we have already considered k here
               f(i, k-1, arr) +                // here we start from i to k-1, the first partition
               f(k+1, j, arr);                 // here we start from k+1 to j, the second partition
      if(cost < min) min=cost;
   }

   return cost;
```
* **Burst Baloons/Mining Diamonds**: Similar approach which we have taken in above example, base case for multiplication will be given in the problem, take the previous * current * next value.
   * So if we start from 0th index, there is nothing behind it so as we are multiplying we take 1, similar goes for end index. and based on that just a small change will be made to the condition, and we are good to go.
```java

   // call
   f(1, n-1, arr); 

   // base case
   if(i>j) return 0; // nothing to return cause it is cross the cut boundary

   int min=Integer.MAX_VALUE;

   for(int k = i; k<=j; k++) {
      int cost = arr[i-1] * arr[k] * arr[j+1] +          // we have already considered k here
               f(i, k-1, arr) +                          // here we start from i to k-1, the first partition
               f(k+1, j, arr);                           // here we start from k+1 to j, the second partition
      if(cost < min) min=cost;
   }

   return cost;
```
* **Evaluate Boolean Expression to True**: Similar to partition DP problem, here we will be given an boolean expression and we need to find the total number of ways in which the result will be true
   * Que: T ^ F | T & F
   * Again we need to start with partitioning the problem into subproblems with partition DP, also here one more variable will be passed to evaluate true or false values based on the cases.
```java

   // call
   f(0, n-1, 1, arr); 

   // base case
   if(i>j) return 0; // nothing to return cause it is cross the cut boundary
   if(i==j){
      if(isTrue == 1) return arr[i] == 'T';
      if(istrue == 0) return arr[i] == 'F';
   }

   int ways=0;

   for(int k = i+1; k<=j-1; k+=2) { // here we need to increase the index by 2 values as we are only interested in the operators
      int lT = f(i, k-1, 1, arr);
      int lF = f(i, k-1, 0, arr);
      int rT = f(k+1, j, 1, arr);
      int rF = f(k+1, j, 0, arr);
      if(arr[k] == '&') {
         if(isTrue==1) ways += lT * rT// only True values will be considered 
         if(isTrue==0) ways += (lT* rF) + (lF * rT) + (lF * rF);
      } else if(arr[k] == '|') {
         // T|T >> T, T|F >> T, F|F >> F 
      } else {
         // T^T >> F, T|F >> T, F|F >> F 
      }
   }

   return ways;
```
* **Palindrome Partitioning - II | Front Partition**: This is a new pattern of DP where we do the front partition of the string to find all the substrings which are palindrome in nature.
   * We start from index 0 and then we check whether this string is palindrome or not if it is one then we increase the count and call the next recurrance by doing index+1.
```java

   f(0, n, str); //call

   if(i==n) return 0; // reached at the end of string

   int minCost = Integer.MAX_VALUE;
   String temp = "";

   for(k=i; k<n; k++) {
      temp += str[k];
      if(isPalindrome(i, k, str)){
         minCost = Math.min(minCost, 1 + f(k+1, n, str)); /// we are doing k+1 because till k we have found that the String is palindrome
      }
   }

   return minCost;
```
* **Partition Array for Maximum Sum | Front Partition**: Here we will be given an array from which we can divide it into multiple partitions but of fix size k, and replace that partition's all values with the max value present in that partition and do sum of all and then return the result.
   * This problem again follows the front partition problem, so here we will again start from index 0 and then take till k elements. 
   * Post that we will multiple the size of partition into the max element in that partition and then return the result
```java

   f(0, k, arr); //call

   if(i==arr.length) return 0; // reached at the end of arr

   int max = Integer.MIN_VALUE;
   int len = 0;
   int result = Integer.MIN_VALUE;

   for(j=i; j<Math.min(i+j, arr.length); j++) { // here we will only take max of k elements in an partition, also condition will be evaluated that we are not overflowing the array
      len++;
      max = Math.max(max, arr[j]);              // taking the max element from the parition
      int sum = len * max + f(j+1, k, arr);     // taking sum of all elements from the parition
      result = Math.max(result, sum);          
   }
   return result;
```
* **Maximum Rectangle Area with all 1's | DP on Rectangles**: This is a new pattern where we need to find the max area of a matrix which include all the 1's.
   * Here prerequites are we have solve the largestRectangleArea problem. post that we will call the matrix for all the combintations and then find the max area out of all of them and we are good to go.
```java
   int[] height = new int[n];
   int maxArea = Integer.MIN_VALUE;

   for(int i=0; i<m; i++) {
      for(int j=0; j<n; j++) {
         if(arr[i][j] == 1) height[j]++;
      }
      int area = largestRectangleArea(height);
      maxArea = Math.max(maxArea, area) ;
   }
   return maxArea;
```
* **Count Square Submatrices with All Ones | DP on Rectangles**: 
   * Here we start with recursion and then iterate over all the elements.
   * we take min of (i-1, j), (i-1,j-1) and (i, j-1) and add 1 to it and store. 
   * Then finally we iterate over the array to get the final result
```java
   for(int i=0; i<m;i++) dp[i][0] = arr[i][0];
   for(int j=0; j<n;j++) dp[0][j] = arr[0][j];

   for(int i=1; i<m; i++) {
      for(int j=1; j<n; j++) {
         if(arr[i][j] == 0) dp[i][j] = 0;
         else {
            dp[i][j] = 1 + Math.min(dp[i-1][j], Math.min(dp[i-1][j-1], dp[i][j-1]));
         }
      }
   }

   //iterate over dp add all values and return
```
