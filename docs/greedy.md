# Greedy Algorithm

## Key Concepts
- Local optimal choice leads to global optimum
- Make best choice at each step without reconsidering
- Cannot be applied to all problems (prove greedy choice property)

## When to Use Greedy
- Optimal substructure exists
- Greedy choice property holds (local = global)
- Cannot work if future choices dependent on current

## Common Problems
- Activity Selection / Interval Scheduling
- Fractional Knapsack
- Jump Game
- Gas Station
- Candy Distribution
- Meeting Rooms

## Patterns / Techniques
- Sorting for greedy order
- Priority queues
- Two pointers with greedy condition
- Simulation with best choice at each step

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Assign Cookies**
**Explanation**: Greedy: match smallest cookie with smallest child greed factor. Sort both arrays, use two pointers. Time: O(n log n + m log m), Space: O(1).

```java
public int findContentChildren(int[] g, int[] s) {
    Arrays.sort(g);
    Arrays.sort(s);
    
    int childIdx = 0, cookieIdx = 0;
    while (childIdx < g.length && cookieIdx < s.length) {
        if (s[cookieIdx] >= g[childIdx]) {
            childIdx++;
        }
        cookieIdx++;
    }
    
    return childIdx;
}
```

**Similar Pattern Problems**: Two Sum Closest, Best Time to Trade

---

#### 2. **Jump Game**
**Explanation**: Track maximum reachable index. If current position > max reach, stuck. Time: O(n), Space: O(1).

```java
public boolean canJump(int[] nums) {
    int maxReach = 0;
    
    for (int i = 0; i < nums.length; i++) {
        if (i > maxReach) return false;
        maxReach = Math.max(maxReach, i + nums[i]);
        if (maxReach >= nums.length - 1) return true;
    }
    
    return false;
}
```

**Similar Pattern Problems**: Jump Game II, Jump Game III

---

#### 3. **Gas Station**
**Explanation**: Track total gas - cost. If negative, reset start. If overall total >= 0, answer exists. Time: O(n), Space: O(1).

```java
public int canCompleteCircuit(int[] gas, int[] cost) {
    int total = 0, current = 0, start = 0;
    
    for (int i = 0; i < gas.length; i++) {
        total += gas[i] - cost[i];
        current += gas[i] - cost[i];
        
        if (current < 0) {
            current = 0;
            start = i + 1;
        }
    }
    
    return total >= 0 ? start : -1;
}
```

**Similar Pattern Problems**: Gas Station II, Circular Rotation

---

#### 4. **Best Time to Buy and Sell Stock**
**Explanation**: Track minimum price, calculate max profit. Time: O(n), Space: O(1).

```java
public int maxProfit(int[] prices) {
    int minPrice = prices[0];
    int maxProfit = 0;
    
    for (int i = 1; i < prices.length; i++) {
        maxProfit = Math.max(maxProfit, prices[i] - minPrice);
        minPrice = Math.min(minPrice, prices[i]);
    }
    
    return maxProfit;
}
```

**Similar Pattern Problems**: Best Time to Buy Stock II, III

---

### Medium

#### 5. **Partition Labels**
**Explanation**: Find last occurrence of each character. When current index reaches last occurrence, partition found. Time: O(n), Space: O(26).

```java
public List<Integer> partitionLabels(String s) {
    int[] lastOccurrence = new int[26];
    for (int i = 0; i < s.length(); i++) {
        lastOccurrence[s.charAt(i) - 'a'] = i;
    }
    
    List<Integer> result = new ArrayList<>();
    int start = 0, end = 0;
    
    for (int i = 0; i < s.length(); i++) {
        end = Math.max(end, lastOccurrence[s.charAt(i) - 'a']);
        
        if (i == end) {
            result.add(end - start + 1);
            start = end + 1;
        }
    }
    
    return result;
}
```

**Similar Pattern Problems**: Merge Intervals, Video Stitching

---

#### 6. **Jump Game II**
**Explanation**: Track farthest reach in current jump level. When reaching end of level, increment jumps. Time: O(n), Space: O(1).

```java
public int jump(int[] nums) {
    int jumps = 0, farthest = 0, endOfJump = 0;
    
    for (int i = 0; i < nums.length - 1; i++) {
        farthest = Math.max(farthest, i + nums[i]);
        
        if (i == endOfJump) {
            jumps++;
            endOfJump = farthest;
        }
    }
    
    return jumps;
}
```

**Similar Pattern Problems**: Jump Game with Obstacles, Minimum Jumps

---

#### 7. **Task Scheduler**
**Explanation**: Greedy based on frequency. Arrange highest frequency tasks first with cooldown. Formula: (maxFreq - 1) * (cooldown + 1) + count of maxFreq tasks. Time: O(n), Space: O(26).

```java
public int leastInterval(char[] tasks, int n) {
    int[] freq = new int[26];
    for (char c : tasks) {
        freq[c - 'A']++;
    }
    
    Arrays.sort(freq);
    int maxFreq = freq[25];
    int intervals = (maxFreq - 1) * (n + 1);
    
    for (int i = 25; i >= 0 && freq[i] == maxFreq; i--) {
        intervals++;
    }
    
    return Math.max(intervals, tasks.length);
}
```

**Similar Pattern Problems**: Scheduler, Cooldown Scheduling

---

#### 8. **Queue Reconstruction by Height**
**Explanation**: Sort by height descending, position ascending. Insert each person at position (greedy insertion). Time: O(n²), Space: O(n).

```java
public int[][] reconstructQueue(int[][] people) {
    Arrays.sort(people, (a, b) -> a[0] == b[0] ? a[1] - b[1] : b[0] - a[0]);
    
    List<int[]> result = new LinkedList<>();
    for (int[] person : people) {
        result.add(person[1], person);
    }
    
    return result.toArray(new int[result.size()][]);
}
```

**Similar Pattern Problems**: Height Sorting, Queue Ordering

---

#### 9. **Candy**
**Explanation**: Two passes: ensure rating increase gets candy increase, and rating decrease gets candy decrease. Time: O(n), Space: O(n).

```java
public int distributeCandies(int[] ratings) {
    int n = ratings.length;
    int[] candies = new int[n];
    Arrays.fill(candies, 1);
    
    // Left to right: if rating increases, candy increases
    for (int i = 1; i < n; i++) {
        if (ratings[i] > ratings[i - 1]) {
            candies[i] = candies[i - 1] + 1;
        }
    }
    
    // Right to left: ensure decrease is respected
    for (int i = n - 2; i >= 0; i--) {
        if (ratings[i] > ratings[i + 1]) {
            candies[i] = Math.max(candies[i], candies[i + 1] + 1);
        }
    }
    
    int total = 0;
    for (int candy : candies) total += candy;
    return total;
}
```

**Similar Pattern Problems**: Candy Distribution Variants

---

### Hard

#### 10. **Merge Triplets to Form Target Triplet**
**Explanation**: Greedily select triplets that don't exceed target and contribute maximum matching values. Time: O(n*3), Space: O(3).

```java
public boolean mergeTriplets(int[][] triplets, int[] target) {
    int[] current = {0, 0, 0};
    
    for (int[] triplet : triplets) {
        // Only consider if doesn't exceed target
        if (triplet[0] <= target[0] && triplet[1] <= target[1] && triplet[2] <= target[2]) {
            current[0] = Math.max(current[0], triplet[0]);
            current[1] = Math.max(current[1], triplet[1]);
            current[2] = Math.max(current[2], triplet[2]);
        }
    }
    
    return Arrays.equals(current, target);
}
```

**Similar Pattern Problems**: Merge Pairs, Greedy Selection

---

#### 11. **Minimum Number of Refueling Stops**
**Explanation**: Greedy with heap. Drive as far as possible, use best previous fuel station when stuck. Time: O(n log n), Space: O(n).

```java
public int minRefuelStops(int target, int startFuel, int[][] stations) {
    PriorityQueue<Integer> maxHeap = new PriorityQueue<>((a, b) -> b - a);
    int reach = startFuel, i = 0, stops = 0;
    
    while (reach < target) {
        while (i < stations.length && stations[i][0] <= reach) {
            maxHeap.offer(stations[i][1]);
            i++;
        }
        
        if (maxHeap.isEmpty()) return -1;
        
        reach += maxHeap.poll();
        stops++;
    }
    
    return stops;
}
```

**Similar Pattern Problems**: Refueling Stations, Minimum Moves

---

## 📌 Key Patterns & Techniques

### 1. **Sorting for Greedy Order**
- Sort to establish optimal order
- Considers multiple criteria

### 2. **Two Pointers**
- Sweep through array making greedy choices
- Often with sorted input

### 3. **Priority Queue / Heap**
- Maintain best choices available
- Greedy selection from candidates

### 4. **Simulation**
- Follow algorithm step by step
- Make optimal choice at each step

---

## 🎯 Common Pitfalls to Avoid

- ❌ Applying greedy without proving optimality
- ❌ Not considering counter-examples
- ❌ Wrong ordering/sorting criteria
- ❌ Not handling edge cases (empty, single element)
- ❌ Greedily choosing locally without considering global impact
