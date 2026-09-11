# Array

## Key Concepts
- Fixed size, index-based data structure
- Stored in contiguous memory
- **Time Complexity**: O(1) for access, O(n) for search/insertion/deletion
- **Space Complexity**: O(n) for storage

## Common Problems
- Two Sum
- Kadane's Algorithm (Maximum Subarray)
- Sliding Window Maximum
- Merge Intervals
- Trapping Rain Water

## Techniques / Patterns
- Two Pointers
- Sliding Window
- Prefix Sum
- Hashing (HashMap/HashSet)
- Sorting-based approaches

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Two Sum**
**Explanation**: Use a HashMap to store numbers we've seen. For each number, check if `target - current_number` exists in the map. This gives us O(n) time instead of O(n²) brute force.

```java
public int[] twoSum(int[] nums, int target) {
    HashMap<Integer, Integer> map = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        int complement = target - nums[i];
        if (map.containsKey(complement)) {
            return new int[] {map.get(complement), i};
        }
        map.put(nums[i], i);
    }
    return new int[] {};
}
```

**Similar Pattern Problems**: Two Sum II, Two Sum III, Three Sum, Four Sum

---

#### 2. **Maximum Subarray (Kadane's Algorithm)**
**Explanation**: At each position, decide whether to extend current subarray or start fresh. Track `maxSoFar` (global max) and `maxEndingHere` (max at current position). At each step: `maxEndingHere = max(nums[i], maxEndingHere + nums[i])`.

```java
public int maxSubArray(int[] nums) {
    int maxSoFar = nums[0];
    int maxEndingHere = nums[0];
    
    for (int i = 1; i < nums.length; i++) {
        maxEndingHere = Math.max(nums[i], maxEndingHere + nums[i]);
        maxSoFar = Math.max(maxSoFar, maxEndingHere);
    }
    
    return maxSoFar;
}
```

**Similar Pattern Problems**: Maximum Product Subarray, Maximum Sum Subarray of Size K

---

#### 3. **Best Time to Buy and Sell Stock**
**Explanation**: Track minimum price seen so far (best buying opportunity). Calculate profit at each point and update maximum profit when finding better selling price. Single pass O(n).

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

**Similar Pattern Problems**: Best Time to Buy and Sell Stock II, III, IV, Cooldown

---

#### 4. **Contains Duplicate**
**Explanation**: Use HashSet to track seen elements. Encounter a duplicate? Return true. Complete loop? No duplicates. Time: O(n), Space: O(n).

```java
public boolean containsDuplicate(int[] nums) {
    HashSet<Integer> seen = new HashSet<>();
    for (int num : nums) {
        if (seen.contains(num)) return true;
        seen.add(num);
    }
    return false;
}
```

**Similar Pattern Problems**: Contains Duplicate II, III, Find Duplicates

---

#### 5. **Single Number**
**Explanation**: Use XOR operation (^). Key: a ^ a = 0 and a ^ 0 = a. XORing all numbers cancels out pairs, leaving only the single number. Time: O(n), Space: O(1).

```java
public int singleNumber(int[] nums) {
    int result = 0;
    for (int num : nums) {
        result ^= num;
    }
    return result;
}
```

**Similar Pattern Problems**: Single Number II, III, Find the Duplicate Number

---

#### 6. **Move Zeroes**
**Explanation**: Use two-pointer approach. `leftPointer` tracks where next non-zero should go. Whenever finding non-zero, swap with position at leftPointer. Time: O(n), Space: O(1), in-place.

```java
public void moveZeroes(int[] nums) {
    int leftPointer = 0;
    
    for (int i = 0; i < nums.length; i++) {
        if (nums[i] != 0) {
            int temp = nums[leftPointer];
            nums[leftPointer] = nums[i];
            nums[i] = temp;
            leftPointer++;
        }
    }
}
```

**Similar Pattern Problems**: Remove Duplicates from Sorted Array, Remove Element

---

#### 7. **Rotate Array**
**Explanation**: Reverse entire array, then reverse first k elements, then reverse remaining. [1,2,3,4,5] with k=2: reverse all→[5,4,3,2,1]→reverse first 2→[4,5,3,2,1]→reverse last 3→[4,5,1,2,3]. Time: O(n), Space: O(1).

```java
public void rotate(int[] nums, int k) {
    k = k % nums.length;
    reverse(nums, 0, nums.length - 1);
    reverse(nums, 0, k - 1);
    reverse(nums, k, nums.length - 1);
}

private void reverse(int[] nums, int start, int end) {
    while (start < end) {
        int temp = nums[start];
        nums[start] = nums[end];
        nums[end] = temp;
        start++;
        end--;
    }
}
```

**Similar Pattern Problems**: Rotate Matrix, Rotate List

---

### Medium

#### 8. **3Sum**
**Explanation**: Sort array first. For each element, use two-pointer technique to find pairs summing to -element. Skip duplicates to ensure unique triplets. Time: O(n²), Space: O(1) excluding output.

```java
public List<List<Integer>> threeSum(int[] nums) {
    Arrays.sort(nums);
    List<List<Integer>> result = new ArrayList<>();
    
    for (int i = 0; i < nums.length - 2; i++) {
        if (nums[i] > 0) break;
        if (i > 0 && nums[i] == nums[i-1]) continue;
        
        int left = i + 1, right = nums.length - 1;
        while (left < right) {
            int sum = nums[i] + nums[left] + nums[right];
            if (sum == 0) {
                result.add(Arrays.asList(nums[i], nums[left], nums[right]));
                while (left < right && nums[left] == nums[left+1]) left++;
                while (left < right && nums[right] == nums[right-1]) right--;
                left++;
                right--;
            } else if (sum < 0) {
                left++;
            } else {
                right--;
            }
        }
    }
    
    return result;
}
```

**Similar Pattern Problems**: 3Sum Closest, 4Sum, K Sum Variants

---

#### 9. **Product of Array Except Self**
**Explanation**: Use prefix and suffix products approach. First pass calculates prefix products (product of all before current). Second pass calculates suffix (product of all after current) and multiplies with prefix. Time: O(n), Space: O(n).

```java
public int[] productExceptSelf(int[] nums) {
    int n = nums.length;
    int[] result = new int[n];
    
    result[0] = 1;
    for (int i = 1; i < n; i++) {
        result[i] = result[i-1] * nums[i-1];
    }
    
    int suffix = 1;
    for (int i = n - 1; i >= 0; i--) {
        result[i] *= suffix;
        suffix *= nums[i];
    }
    
    return result;
}
```

**Similar Pattern Problems**: Paint House, Trapping Rain Water (similar prefix/suffix idea)

---

#### 10. **Merge Intervals**
**Explanation**: Sort by start point. Iterate through sorted intervals and merge if current overlaps with previous (current start ≤ previous end). Two intervals overlap when: current.start ≤ previous.end. Time: O(n log n), Space: O(n).

```java
public int[][] merge(int[][] intervals) {
    Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
    
    List<int[]> merged = new ArrayList<>();
    int[] current = intervals[0];
    
    for (int i = 1; i < intervals.length; i++) {
        if (intervals[i][0] <= current[1]) {
            current[1] = Math.max(current[1], intervals[i][1]);
        } else {
            merged.add(current);
            current = intervals[i];
        }
    }
    merged.add(current);
    
    return merged.toArray(new int[merged.size()][]);
}
```

**Similar Pattern Problems**: Insert Interval, Meeting Rooms I & II

---

### Hard

#### 11. **Trapping Rain Water**
**Explanation**: At each position, water level = min(max_height_left, max_height_right). Trapped water = water_level - bar_height. Precompute max heights from left and right. Time: O(n), Space: O(n).

```java
public int trap(int[] height) {
    int n = height.length;
    if (n < 3) return 0;
    
    int[] leftMax = new int[n];
    int[] rightMax = new int[n];
    
    leftMax[0] = height[0];
    for (int i = 1; i < n; i++) {
        leftMax[i] = Math.max(leftMax[i-1], height[i]);
    }
    
    rightMax[n-1] = height[n-1];
    for (int i = n-2; i >= 0; i--) {
        rightMax[i] = Math.max(rightMax[i+1], height[i]);
    }
    
    int water = 0;
    for (int i = 0; i < n; i++) {
        water += Math.min(leftMax[i], rightMax[i]) - height[i];
    }
    
    return water;
}
```

**Similar Pattern Problems**: Trapping Rain Water II (2D), Rain Water II (Heap variant)

---

#### 12. **First Missing Positive**
**Explanation**: Place each number n in position n-1 (if 1 ≤ n ≤ length). Then scan array to find first position where arr[i] ≠ i+1. That i+1 is missing. Uses array as hash table. Time: O(n), Space: O(1).

```java
public int firstMissingPositive(int[] nums) {
    int n = nums.length;
    
    for (int i = 0; i < n; i++) {
        while (nums[i] > 0 && nums[i] <= n && nums[nums[i]-1] != nums[i]) {
            int correctIdx = nums[i] - 1;
            int temp = nums[i];
            nums[i] = nums[correctIdx];
            nums[correctIdx] = temp;
        }
    }
    
    for (int i = 0; i < n; i++) {
        if (nums[i] != i + 1) {
            return i + 1;
        }
    }
    
    return n + 1;
}
```

**Similar Pattern Problems**: Find Disappeared Numbers, First Missing Number in Range

---

#### 13. **Longest Consecutive Sequence**
**Explanation**: Use HashSet for O(1) lookups. For each number, check if it's sequence start (num-1 not in set). If yes, count consecutive sequence length. Time: O(n), Space: O(n).

```java
public int longestConsecutive(int[] nums) {
    HashSet<Integer> set = new HashSet<>();
    for (int num : nums) {
        set.add(num);
    }
    
    int longest = 0;
    for (int num : set) {
        if (!set.contains(num - 1)) {
            int current = num;
            int streak = 1;
            while (set.contains(current + 1)) {
                current++;
                streak++;
            }
            longest = Math.max(longest, streak);
        }
    }
    
    return longest;
}
```

**Similar Pattern Problems**: Consecutive Numbers Sum, Longest Substring

---

## 📌 Key Patterns & Techniques

### 1. **Two Pointers**
- Start from opposite ends or move same direction
- Move based on comparison condition
- Used for: Intersection, merging, pair finding

### 2. **Sliding Window**
- Maintain window of fixed or variable size
- Expand/contract based on condition
- Used for: Subarrays, max/min in window

### 3. **Prefix Sum**
- Precompute cumulative sums
- Query becomes O(1)
- Used for: Range sum queries, subarray problems

### 4. **Hashing**
- HashMap for element → index/count
- HashSet for existence checking
- Used for: Duplicate detection, pair finding

---

## 🎯 Common Pitfalls to Avoid

- ❌ Not handling edge cases (empty array, single element)
- ❌ Integer overflow (use long for large sums)
- ❌ Off-by-one errors in pointer movements
- ❌ Not sorting when needed for optimization
- ❌ Forgetting to handle duplicates in result