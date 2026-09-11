# String

## Key Concepts
- Immutable sequences of characters
- **StringBuilder** for efficient manipulation (mutable alternative)
- Character arrays for O(1) access
- Pattern matching and searching

## Common Problems
- Longest Substring Without Repeating Characters
- Anagram Check
- Palindromic Substrings
- String Compression
- Regular Expression Matching

## Patterns / Techniques
- Sliding Window
- Two Pointers
- Hashing (Character frequency)
- Dynamic Programming (Edit Distance, Palindromes)

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Valid Anagram**
**Explanation**: Two strings are anagrams if they contain same characters with same frequencies. Use character frequency map or sorting approach. Time: O(n log n) for sorting, O(n) for frequency.

```java
public boolean isAnagram(String s, String t) {
    if (s.length() != t.length()) return false;
    
    char[] arr1 = s.toCharArray();
    char[] arr2 = t.toCharArray();
    Arrays.sort(arr1);
    Arrays.sort(arr2);
    
    return Arrays.equals(arr1, arr2);
}
```

**Similar Pattern Problems**: Group Anagrams, Finding Anagrams

---

#### 2. **Implement strStr() - Find Substring**
**Explanation**: Find first occurrence of substring. Naive approach checks each position. Can use KMP algorithm for O(n+m). Simple approach with built-in: just iterate and compare substrings.

```java
public int strStr(String haystack, String needle) {
    if (needle.isEmpty()) return 0;
    
    for (int i = 0; i <= haystack.length() - needle.length(); i++) {
        if (haystack.substring(i, i + needle.length()).equals(needle)) {
            return i;
        }
    }
    
    return -1;
}
```

**Similar Pattern Problems**: Implement indexOf, String Matching with Wildcards

---

#### 3. **Reverse String**
**Explanation**: Reverse string in-place using two-pointer approach from both ends. Time: O(n), Space: O(1).

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

**Similar Pattern Problems**: Reverse Words, Reverse Vowels

---

#### 4. **First Unique Character in a String**
**Explanation**: Use HashMap to count character frequencies. Then iterate through string again to find first character with count = 1. Time: O(n), Space: O(1) since max 26 lowercase letters.

```java
public int firstUniqChar(String s) {
    HashMap<Character, Integer> map = new HashMap<>();
    for (char c : s.toCharArray()) {
        map.put(c, map.getOrDefault(c, 0) + 1);
    }
    
    for (int i = 0; i < s.length(); i++) {
        if (map.get(s.charAt(i)) == 1) {
            return i;
        }
    }
    
    return -1;
}
```

**Similar Pattern Problems**: First Unique Number, First Missing Positive

---

#### 5. **Valid Palindrome**
**Explanation**: Check if string is palindrome ignoring non-alphanumeric characters and case. Use two pointers from both ends, skip non-alphanumeric, compare characters (case-insensitive). Time: O(n), Space: O(1).

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

**Similar Pattern Problems**: Valid Palindrome II, Palindromic Substrings

---

### Medium

#### 6. **Longest Substring Without Repeating Characters**
**Explanation**: Use sliding window with HashMap tracking character indices. When duplicate found, move left pointer to index after previous occurrence. Track maximum window size. Time: O(n), Space: O(min(m, alphabet_size)).

```java
public int lengthOfLongestSubstring(String s) {
    HashMap<Character, Integer> map = new HashMap<>();
    int maxLen = 0, left = 0;
    
    for (int right = 0; right < s.length(); right++) {
        char c = s.charAt(right);
        
        if (map.containsKey(c)) {
            left = Math.max(left, map.get(c) + 1);
        }
        
        map.put(c, right);
        maxLen = Math.max(maxLen, right - left + 1);
    }
    
    return maxLen;
}
```

**Similar Pattern Problems**: Longest Repeating Character Replacement, Substring with K Distinct Characters

---

#### 7. **Longest Palindromic Substring**
**Explanation**: Expand around center approach. For each character (odd length) and between characters (even length) as center, expand outward while palindrome continues. Time: O(n²), Space: O(1).

```java
public String longestPalindrome(String s) {
    if (s.length() < 2) return s;
    
    int maxLen = 0, start = 0;
    
    for (int i = 0; i < s.length(); i++) {
        // Odd length palindromes
        int len1 = expandAroundCenter(s, i, i);
        // Even length palindromes
        int len2 = expandAroundCenter(s, i, i + 1);
        
        int len = Math.max(len1, len2);
        if (len > maxLen) {
            maxLen = len;
            start = i - (len - 1) / 2;
        }
    }
    
    return s.substring(start, start + maxLen);
}

private int expandAroundCenter(String s, int left, int right) {
    while (left >= 0 && right < s.length() && s.charAt(left) == s.charAt(right)) {
        left--;
        right++;
    }
    return right - left - 1;
}
```

**Similar Pattern Problems**: Longest Palindromic Subsequence, Palindromic Substrings Count

---

#### 8. **Group Anagrams**
**Explanation**: Sort characters in each string to create canonical form (anagrams have same sorted form). Use HashMap with sorted string as key. Time: O(n * k log k) where n = number of strings, k = max string length.

```java
public List<List<String>> groupAnagrams(String[] strs) {
    HashMap<String, List<String>> map = new HashMap<>();
    
    for (String str : strs) {
        char[] chars = str.toCharArray();
        Arrays.sort(chars);
        String sorted = new String(chars);
        
        map.putIfAbsent(sorted, new ArrayList<>());
        map.get(sorted).add(str);
    }
    
    return new ArrayList<>(map.values());
}
```

**Similar Pattern Problems**: Count Isomorphic Strings, Word Patterns

---

#### 9. **Edit Distance (Levenshtein Distance)**
**Explanation**: DP problem. dp[i][j] = minimum operations to convert s1[0...i-1] to s2[0...j-1]. Three operations: insert, delete, replace. If s1[i-1] == s2[j-1]: dp[i][j] = dp[i-1][j-1]. Otherwise: dp[i][j] = 1 + min(replace, insert, delete). Time: O(m*n), Space: O(m*n).

```java
public int minDistance(String word1, String word2) {
    int m = word1.length(), n = word2.length();
    int[][] dp = new int[m + 1][n + 1];
    
    for (int i = 0; i <= m; i++) dp[i][0] = i;
    for (int j = 0; j <= n; j++) dp[0][j] = j;
    
    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (word1.charAt(i - 1) == word2.charAt(j - 1)) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], 
                          Math.min(dp[i - 1][j], dp[i][j - 1]));
            }
        }
    }
    
    return dp[m][n];
}
```

**Similar Pattern Problems**: Edit Distance II, Minimum Window Substring

---

#### 10. **Minimum Window Substring**
**Explanation**: Sliding window with two-pointer. Track character frequencies needed. Expand window until all required characters found, then contract from left while still valid. Time: O(m + n), Space: O(alphabet_size).

```java
public String minWindow(String s, String t) {
    if (t.isEmpty()) return "";
    
    HashMap<Character, Integer> needed = new HashMap<>();
    for (char c : t.toCharArray()) {
        needed.put(c, needed.getOrDefault(c, 0) + 1);
    }
    
    int formed = 0, left = 0, minLen = Integer.MAX_VALUE, minStart = 0;
    HashMap<Character, Integer> window = new HashMap<>();
    
    for (int right = 0; right < s.length(); right++) {
        char c = s.charAt(right);
        window.put(c, window.getOrDefault(c, 0) + 1);
        
        if (needed.containsKey(c) && window.get(c).equals(needed.get(c))) {
            formed++;
        }
        
        while (left <= right && formed == needed.size()) {
            if (right - left + 1 < minLen) {
                minLen = right - left + 1;
                minStart = left;
            }
            
            char leftChar = s.charAt(left);
            window.put(leftChar, window.get(leftChar) - 1);
            if (needed.containsKey(leftChar) && window.get(leftChar) < needed.get(leftChar)) {
                formed--;
            }
            left++;
        }
    }
    
    return minLen == Integer.MAX_VALUE ? "" : s.substring(minStart, minStart + minLen);
}
```

**Similar Pattern Problems**: Permutation in String, Anagrams in Array

---

### Hard

#### 11. **Regular Expression Matching**
**Explanation**: DP problem. dp[i][j] = true if s[0...i-1] matches p[0...j-1]. Handle '.' (any char) and '*' (0 or more of previous). Time: O(m*n), Space: O(m*n).

```java
public boolean isMatch(String s, String p) {
    int m = s.length(), n = p.length();
    boolean[][] dp = new boolean[m + 1][n + 1];
    dp[0][0] = true;
    
    for (int j = 1; j <= n; j++) {
        if (p.charAt(j - 1) == '*') {
            dp[0][j] = dp[0][j - 2];
        }
    }
    
    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (p.charAt(j - 1) == '*') {
                dp[i][j] = dp[i][j - 2] || 
                           (dp[i - 1][j] && (p.charAt(j - 2) == '.' || p.charAt(j - 2) == s.charAt(i - 1)));
            } else {
                dp[i][j] = dp[i - 1][j - 1] && 
                           (p.charAt(j - 1) == '.' || p.charAt(j - 1) == s.charAt(i - 1));
            }
        }
    }
    
    return dp[m][n];
}
```

**Similar Pattern Problems**: Wildcard Matching, Word Pattern Matching

---

## 📌 Key Patterns & Techniques

### 1. **Sliding Window**
- Maintain window of characters
- Expand/contract based on condition
- Used for: Substrings, character frequency

### 2. **Two Pointers**
- Start from opposite ends
- Move towards center
- Used for: Palindromes, validation

### 3. **Dynamic Programming**
- Build solution from smaller subproblems
- Used for: Edit distance, pattern matching

### 4. **Hashing**
- Character frequency maps
- Canonical forms for anagrams
- Used for: Anagrams, duplicates

---

## 🎯 Common Pitfalls to Avoid

- ❌ Not handling empty strings
- ❌ Case sensitivity issues
- ❌ Not considering special characters
- ❌ String concatenation in loops (creates new objects)
- ❌ Inefficient string comparisons



