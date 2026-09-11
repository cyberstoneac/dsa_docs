# Sliding Window

## Key Concepts
- **Window**: Contiguous subarray/substring
- **Expand**: Extend window right to include more elements
- **Shrink**: Move left pointer to make window smaller
- **Invariant**: Maintain condition (max length, sum ≤ target, etc.)
- **Two Pointers**: Left and right boundaries of window
- **Time**: O(n) because each element visited at most twice

## When to Use
- Longest/shortest substring with constraint
- All subarrays matching pattern
- Maximum sum/product in window
- Anagrams, permutations in string
- Duplicate handling

## Pattern
1. Expand right pointer to add element
2. While condition violated: shrink from left
3. Update answer
4. Continue until right reaches end

## Complexity
- Time: O(n) - each element visited twice
- Space: O(min(n, k)) for hashmap/set

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Maximum Average Subarray I**
**Explanation**: Find subarray of size k with maximum average. Slide window, calculate averages. Time: O(n), Space: O(1).

```java
public double findMaxAverage(int[] nums, int k) {
    int sum = 0;
    for (int i = 0; i < k; i++) {
        sum += nums[i];
    }
    
    int maxSum = sum;
    for (int i = k; i < nums.length; i++) {
        sum = sum - nums[i - k] + nums[i];
        maxSum = Math.max(maxSum, sum);
    }
    
    return maxSum / (double) k;
}
```

**Similar Pattern Problems**: Maximum Sum Subarray, Minimum Average Subarray

---

#### 2. **Contains Duplicate II**
**Explanation**: Find duplicates within distance k. Use sliding window with HashSet. Time: O(n), Space: O(min(n, k)).

```java
public boolean containsNearbyDuplicate(int[] nums, int k) {
    Set<Integer> window = new HashSet<>();
    
    for (int i = 0; i < nums.length; i++) {
        if (window.contains(nums[i])) {
            return true;
        }
        
        window.add(nums[i]);
        
        if (window.size() > k) {
            window.remove(nums[i - k]);
        }
    }
    
    return false;
}
```

**Similar Pattern Problems**: Contains Duplicate III, Find Duplicates

---

### Medium

#### 3. **Longest Substring Without Repeating Characters**
**Explanation**: Expand right, shrink left when duplicate found. Track max length. Time: O(n), Space: O(min(n, charset)).

```java
public int lengthOfLongestSubstring(String s) {
    Map<Character, Integer> lastIndex = new HashMap<>();
    int left = 0, maxLen = 0;
    
    for (int right = 0; right < s.length(); right++) {
        char c = s.charAt(right);
        
        if (lastIndex.containsKey(c)) {
            left = Math.max(left, lastIndex.get(c) + 1);
        }
        
        lastIndex.put(c, right);
        maxLen = Math.max(maxLen, right - left + 1);
    }
    
    return maxLen;
}
```

**Similar Pattern Problems**: Longest Substring with At Most 2 Distinct Characters, Longest Repeating Character Replacement

---

#### 4. **Minimum Window Substring**
**Explanation**: Find smallest substring with all characters. Expand right, shrink left when valid. Time: O(n), Space: O(charset).

```java
public String minWindow(String s, String t) {
    if (t.length() > s.length()) return "";
    
    Map<Character, Integer> tCount = new HashMap<>();
    for (char c : t.toCharArray()) {
        tCount.put(c, tCount.getOrDefault(c, 0) + 1);
    }
    
    Map<Character, Integer> windowCount = new HashMap<>();
    int left = 0, minLen = Integer.MAX_VALUE, minStart = 0;
    int required = tCount.size();
    int formed = 0;
    
    for (int right = 0; right < s.length(); right++) {
        char c = s.charAt(right);
        windowCount.put(c, windowCount.getOrDefault(c, 0) + 1);
        
        if (tCount.containsKey(c) && windowCount.get(c).equals(tCount.get(c))) {
            formed++;
        }
        
        while (left <= right && formed == required) {
            if (right - left + 1 < minLen) {
                minLen = right - left + 1;
                minStart = left;
            }
            
            char leftChar = s.charAt(left);
            windowCount.put(leftChar, windowCount.get(leftChar) - 1);
            if (tCount.containsKey(leftChar) && windowCount.get(leftChar) < tCount.get(leftChar)) {
                formed--;
            }
            
            left++;
        }
    }
    
    return minLen == Integer.MAX_VALUE ? "" : s.substring(minStart, minStart + minLen);
}
```

**Similar Pattern Problems**: Minimum Window Subsequence, Smallest Range, Substring with Concatenation

---

#### 5. **Permutation in String**
**Explanation**: Check if permutation of s1 is substring of s2. Compare character counts. Time: O(n), Space: O(1).

```java
public boolean checkInclusion(String s1, String s2) {
    if (s1.length() > s2.length()) return false;
    
    int[] s1Count = new int[26];
    int[] windowCount = new int[26];
    
    for (char c : s1.toCharArray()) {
        s1Count[c - 'a']++;
    }
    
    for (int i = 0; i < s2.length(); i++) {
        windowCount[s2.charAt(i) - 'a']++;
        
        if (i >= s1.length()) {
            windowCount[s2.charAt(i - s1.length()) - 'a']--;
        }
        
        if (Arrays.equals(s1Count, windowCount)) {
            return true;
        }
    }
    
    return false;
}
```

**Similar Pattern Problems**: Find Anagram, Find All Anagrams in String

---

### Hard

#### 6. **Sliding Window Maximum**
**Explanation**: Maximum in every k-size window. Use deque tracking indices. Time: O(n), Space: O(k).

```java
public int[] maxSlidingWindow(int[] nums, int k) {
    if (nums == null || nums.length == 0) return new int[0];
    
    Deque<Integer> deque = new LinkedList<>();
    int[] result = new int[nums.length - k + 1];
    int index = 0;
    
    for (int i = 0; i < nums.length; i++) {
        // Remove indices outside window
        if (!deque.isEmpty() && deque.peekFirst() < i - k + 1) {
            deque.pollFirst();
        }
        
        // Remove smaller elements
        while (!deque.isEmpty() && nums[deque.peekLast()] < nums[i]) {
            deque.pollLast();
        }
        
        deque.addLast(i);
        
        if (i >= k - 1) {
            result[index++] = nums[deque.peekFirst()];
        }
    }
    
    return result;
}
```

**Similar Pattern Problems**: Sliding Window Minimum, Constrained Subsequence Sum

---

## 📌 Key Patterns & Techniques

### 1. **Fixed Window Size**
- Maintain window of exactly k elements
- Slide: remove leftmost, add rightmost
- O(n) time, O(1) space

### 2. **Variable Window Size**
- Expand right until condition met
- Shrink left while condition holds
- Track optimal during shrinking

### 3. **Character Frequency Pattern**
- Use array/hashmap for counts
- For anagrams, compare arrays
- Fixed alphabet size = O(1) space

### 4. **Deque Pattern**
- Maintain indices/elements in order
- Remove non-useful elements early
- Perfect for max/min in window

---

## 🎯 Common Pitfalls to Avoid

- ❌ Moving pointers in wrong order
- ❌ Not handling edge cases (empty string, k > n)
- ❌ Forgetting to update answer at right time
- ❌ Off-by-one errors in window boundaries
- ❌ Comparing characters vs indices incorrectly
- ❌ Not cleaning up deque properly
