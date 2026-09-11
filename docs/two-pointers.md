# Two Pointers

## Key Concepts
- **Two Pointers**: Start from opposite ends or same point
- **Converging**: Left and right move towards each other
- **Following**: One moves faster, finds relationship
- **Array must be sorted** for most problems
- **Time**: O(n) instead of O(n²) from nested loops
- **Space**: O(1) extra space (excluding output)

## Patterns
1. **Converging from ends**: left at start, right at end
2. **Following pace**: slow and fast pointers on same direction
3. **Split array**: front/back split with different speeds
4. **Partition pattern**: separate elements by condition

## When to Use
- Sorted array/list problems
- Finding pairs/triplets with conditions
- Reversing sequences
- Removing duplicates/elements
- Cycle detection in linked list

## Complexity
- Time: O(n) - each element visited once
- Space: O(1) - no extra data structures

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Valid Palindrome**
**Explanation**: Two pointers from ends. Skip non-alphanumeric, compare characters. Time: O(n), Space: O(1).

```java
public boolean isPalindrome(String s) {
    int left = 0, right = s.length() - 1;
    
    while (left < right) {
        while (left < right && !Character.isAlphanumeric(s.charAt(left))) {
            left++;
        }
        while (left < right && !Character.isAlphanumeric(s.charAt(right))) {
            right--;
        }
        
        if (Character.toLowerCase(s.charAt(left)) != Character.toLowerCase(s.charAt(right))) {
            return false;
        }
        
        left++;
        right--;
    }
    
    return true;
}
```

**Similar Pattern Problems**: Valid Palindrome II (one character skip), Palindrome Pairs

---

#### 2. **Reverse String**
**Explanation**: Swap characters from ends moving inward. Time: O(n), Space: O(1) excluding output.

```java
public void reverseString(char[] s) {
    int left = 0, right = s.length - 1;
    
    while (left < right) {
        char temp = s[left];
        s[left] = s[right];
        s[right] = temp;
        
        left++;
        right--;
    }
}
```

**Similar Pattern Problems**: Reverse Array, Reverse Linked List

---

### Medium

#### 3. **Two Sum II (Sorted Array)**
**Explanation**: Converge from ends. If sum < target move left right, if > move right left. Time: O(n), Space: O(1).

```java
public int[] twoSum(int[] numbers, int target) {
    int left = 0, right = numbers.length - 1;
    
    while (left < right) {
        int sum = numbers[left] + numbers[right];
        
        if (sum == target) {
            return new int[]{left + 1, right + 1};
        } else if (sum < target) {
            left++;
        } else {
            right--;
        }
    }
    
    return new int[]{};
}
```

**Similar Pattern Problems**: Two Sum, 3Sum, 4Sum

---

#### 4. **Container With Most Water**
**Explanation**: Maximize area = min(height) * width. Start from widest, move inward. Time: O(n), Space: O(1).

```java
public int maxArea(int[] height) {
    int left = 0, right = height.length - 1;
    int maxArea = 0;
    
    while (left < right) {
        int width = right - left;
        int currentHeight = Math.min(height[left], height[right]);
        int area = width * currentHeight;
        maxArea = Math.max(maxArea, area);
        
        if (height[left] < height[right]) {
            left++;
        } else {
            right--;
        }
    }
    
    return maxArea;
}
```

**Similar Pattern Problems**: Trapping Rain Water, Pour Water Between Buckets

---

#### 5. **3Sum**
**Explanation**: Sort array, fix one element, use two pointers for remaining two. Time: O(n²), Space: O(1).

```java
public List<List<Integer>> threeSum(int[] nums) {
    List<List<Integer>> result = new ArrayList<>();
    Arrays.sort(nums);
    
    for (int i = 0; i < nums.length - 2; i++) {
        if (i > 0 && nums[i] == nums[i - 1]) continue;
        if (nums[i] > 0) break;
        
        int left = i + 1, right = nums.length - 1;
        
        while (left < right) {
            int sum = nums[i] + nums[left] + nums[right];
            
            if (sum == 0) {
                result.add(Arrays.asList(nums[i], nums[left], nums[right]));
                
                while (left < right && nums[left] == nums[left + 1]) left++;
                while (left < right && nums[right] == nums[right - 1]) right--;
                
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

**Similar Pattern Problems**: 3Sum Closest, 4Sum, 3Sum Smaller

---

### Hard

#### 6. **Trapping Rain Water**
**Explanation**: Left/right pointers track max heights. Add water based on min boundary. Time: O(n), Space: O(1).

```java
public int trap(int[] height) {
    if (height == null || height.length == 0) return 0;
    
    int left = 0, right = height.length - 1;
    int leftMax = 0, rightMax = 0;
    int water = 0;
    
    while (left < right) {
        if (height[left] < height[right]) {
            if (height[left] >= leftMax) {
                leftMax = height[left];
            } else {
                water += leftMax - height[left];
            }
            left++;
        } else {
            if (height[right] >= rightMax) {
                rightMax = height[right];
            } else {
                water += rightMax - height[right];
            }
            right--;
        }
    }
    
    return water;
}
```

**Similar Pattern Problems**: Rain Water II, Trapping Rain Water III (3D)

---

## 📌 Key Patterns & Techniques

### 1. **Converging Pointers**
- Start: left at 0, right at end
- Move: towards center
- Use: Sorted array problems

### 2. **Diverging Pointers**
- Start: both at center
- Move: away from center
- Use: Expanding/window problems

### 3. **Following Pace (Slow/Fast)**
- Slow: moves 1 step
- Fast: moves 2 steps
- Use: Cycle detection, finding middle

### 4. **Partition Pattern**
- Separate elements by condition
- Two pointers from ends
- Swap when needed

---

## 🎯 Common Pitfalls to Avoid

- ❌ Forgetting array must be sorted
- ❌ Moving pointers in wrong direction
- ❌ Not handling duplicates
- ❌ Off-by-one errors in boundary checks
- ❌ Incorrect pointer initialization
- ❌ Not comparing values correctly
