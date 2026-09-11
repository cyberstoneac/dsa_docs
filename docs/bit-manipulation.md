# Bit Manipulation

## Key Concepts
- Operations at bit-level for speed and space efficiency
- Bitwise operators: AND (&), OR (|), XOR (^), NOT (~), LEFT SHIFT (<<), RIGHT SHIFT (>>)
- Bit masking and flagging
- Two's complement representation for negative numbers

## Common Problems
- Check if power of 2
- Count set bits (number of 1s)
- Single number (XOR duplicates)
- Missing number
- Reverse bits
- Maximum XOR

## Patterns / Techniques
- XOR properties (a ^ a = 0, a ^ 0 = a)
- Bit masking for conditions
- Bit counting (Brian Kernighan's algorithm)
- Bit manipulation for swaps without temp variable

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Single Number**
**Explanation**: XOR all numbers. Pairs cancel out (a ^ a = 0), leaving single number. Time: O(n), Space: O(1).

```java
public int singleNumber(int[] nums) {
    int result = 0;
    for (int num : nums) {
        result ^= num;
    }
    return result;
}
```

**Similar Pattern Problems**: Single Number II, III, Find Duplicate

---

#### 2. **Number of 1 Bits**
**Explanation**: Count set bits. Use n & 1 to check last bit, right shift n. Or use Brian Kernighan's algorithm: n & (n-1) removes rightmost 1 bit. Time: O(log n), Space: O(1).

```java
public int hammingWeight(int n) {
    int count = 0;
    
    while (n != 0) {
        count += (n & 1);
        n >>>= 1; // Unsigned right shift
    }
    
    return count;
}

// Kernighan's algorithm (faster):
// public int hammingWeight(int n) {
//     int count = 0;
//     while (n != 0) {
//         n &= (n - 1);
//         count++;
//     }
//     return count;
// }
```

**Similar Pattern Problems**: Count Total Set Bits, Bit Parity

---

#### 3. **Power of Two**
**Explanation**: Power of 2 has exactly one set bit. Check if n > 0 && (n & (n-1)) == 0. Time: O(1), Space: O(1).

```java
public boolean isPowerOfTwo(int n) {
    return n > 0 && (n & (n - 1)) == 0;
}
```

**Similar Pattern Problems**: Power of Three (use division), Power of Four

---

#### 4. **Missing Number**
**Explanation**: XOR all array elements with indices 0 to n. Expected XOR cancels actual, leaving missing. Time: O(n), Space: O(1).

```java
public int missingNumber(int[] nums) {
    int xor = 0;
    
    for (int i = 0; i < nums.length; i++) {
        xor ^= i ^ nums[i];
    }
    
    return xor ^ nums.length;
}
```

**Similar Pattern Problems**: Duplicate Number, Find Disappeared Numbers

---

#### 5. **Reverse Bits**
**Explanation**: Extract least significant bit, shift result left, add bit. Repeat for 32 bits. Time: O(1) (32 iterations), Space: O(1).

```java
public int reverseBits(int n) {
    int result = 0;
    
    for (int i = 0; i < 32; i++) {
        result = (result << 1) | (n & 1);
        n >>>= 1;
    }
    
    return result;
}
```

**Similar Pattern Problems**: Reverse Digits, Binary String Operations

---

### Medium

#### 6. **Sum of Two Integers**
**Explanation**: Use XOR for addition without carry, AND for carry bits shifted left. Repeat until no carry. Time: O(1) (max 32 iterations), Space: O(1).

```java
public int getSum(int a, int b) {
    while (b != 0) {
        int carry = (a & b) << 1;
        a = a ^ b;
        b = carry;
    }
    return a;
}
```

**Similar Pattern Problems**: Add Two Numbers (linked list), Multiply Integers

---

#### 7. **Counting Bits**
**Explanation**: dp[i] = number of 1s in i. dp[i] = dp[i >> 1] + (i & 1). Or dp[i] = dp[i & (i-1)] + 1. Time: O(n), Space: O(n).

```java
public int[] countBits(int n) {
    int[] dp = new int[n + 1];
    
    for (int i = 1; i <= n; i++) {
        dp[i] = dp[i >> 1] + (i & 1);
    }
    
    return dp;
}

// Alternative:
// dp[i] = dp[i & (i - 1)] + 1;
```

**Similar Pattern Problems**: Popcount, Bit Count Array

---

#### 8. **Bitwise AND of Numbers Range**
**Explanation**: Find common prefix of binary representations of start and end. Shift both right until equal, then shift result left. Time: O(log max(m,n)), Space: O(1).

```java
public int rangeBitwiseAnd(int m, int n) {
    int shift = 0;
    
    while (m != n) {
        m >>= 1;
        n >>= 1;
        shift++;
    }
    
    return m << shift;
}
```

**Similar Pattern Problems**: Bitwise OR/XOR Range

---

### Hard

#### 9. **Maximum XOR of Two Numbers in an Array**
**Explanation**: Build numbers bit by bit using greedy approach with trie. For each bit position (from MSB to LSB), check if two numbers can have different bits. Use set to track prefixes. Time: O(n * 32), Space: O(n * 32).

```java
public int findMaximumXOR(int[] nums) {
    int maxXor = 0;
    int mask = 0;
    
    for (int i = 31; i >= 0; i--) {
        mask = mask | (1 << i);
        
        HashSet<Integer> prefixes = new HashSet<>();
        for (int num : nums) {
            prefixes.add(num & mask);
        }
        
        int temp = maxXor | (1 << i);
        
        for (int prefix : prefixes) {
            if (prefixes.contains(temp ^ prefix)) {
                maxXor = temp;
                break;
            }
        }
    }
    
    return maxXor;
}
```

**Similar Pattern Problems**: Maximum XOR with Constraint, XOR Maximization

---

#### 10. **Number of Distinct Subsequences**
**Explanation**: DP problem with bit optimization. dp[i] = number of distinct subsequences ending at i. Use last seen index for repeated characters. Time: O(n), Space: O(26).

```java
public int distinctSubsequences(String s) {
    int mod = 1000000007;
    long dp = 1; // Empty subsequence
    long[] last = new long[26];
    
    for (char c : s.toCharArray()) {
        int idx = c - 'a';
        dp = (2 * dp - last[idx] + mod) % mod;
        last[idx] = dp;
    }
    
    return (int) dp;
}
```

**Similar Pattern Problems**: Number of Subsequences, Distinct Subsequences II

---

## 📌 Key Bit Operations Reference

### Common Bit Operations
```
x & 1           // Check if odd
x << 1          // Multiply by 2
x >> 1          // Divide by 2
x & (-x)        // Isolate lowest set bit
x & (x-1)       // Remove lowest set bit
x | (x+1)       // Set all bits below
```

### Bit Tricks
- Check power of 2: `(x & (x-1)) == 0`
- Count bits: Kernighan's algorithm or lookup
- Swap without temp: `a = a ^ b; b = a ^ b; a = a ^ b;`
- Check bit i: `(x >> i) & 1`
- Set bit i: `x | (1 << i)`
- Clear bit i: `x & ~(1 << i)`
- Toggle bit i: `x ^ (1 << i)`

---

## 🎯 Common Pitfalls to Avoid

- ❌ Integer overflow (use long for intermediate results)
- ❌ Confusing signed and unsigned shifts
- ❌ Not handling negative numbers correctly
- ❌ Off-by-one in bit positions
- ❌ Forgetting modulo in large results
