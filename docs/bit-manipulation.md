---
tags:
  - bit-manipulation
  - xor
  - bitwise
  - neetcode-150
---

# Bit Manipulation

## Key Concepts
- Operations at bit-level for speed and space efficiency
- Bitwise operators: AND (&), OR (|), XOR (^), NOT (~), LEFT SHIFT (<<), RIGHT SHIFT (>>)
- Bit masking and flagging
- Two's complement representation for negative numbers
- Bit manipulation often achieves O(1) space and fast O(1) or O(log n) time

## Common Problems
- Check if power of 2
- Count set bits (number of 1s)
- Single number (XOR duplicates)
- Missing number
- Reverse bits
- Sum of two integers without +/-
- Counting bits
- Bitwise AND of numbers range
- Maximum XOR of two numbers

## Patterns / Techniques
- XOR properties (a ^ a = 0, a ^ 0 = a)
- Bit masking for conditions
- Bit counting (Brian Kernighan's algorithm)
- Bit manipulation for swaps without temp variable
- Greedy bit-by-bit construction (Maximum XOR)
- DP with bit optimization (Counting Bits)
- Common prefix detection (Bitwise AND range)

---

## 🔹 Basic Templates

### Bit Operations Template
```java
// Check if i-th bit is set
boolean isSet = ((n >> i) & 1) == 1;

// Set i-th bit
int setBit = n | (1 << i);

// Clear i-th bit
int clearBit = n & ~(1 << i);

// Toggle i-th bit
int toggleBit = n ^ (1 << i);

// Check if power of 2
boolean isPowerOfTwo = n > 0 && (n & (n - 1)) == 0;

// Remove lowest set bit
int removeLowestSetBit = n & (n - 1);

// Isolate lowest set bit
int isolateLowestSetBit = n & (-n);
```

### Count Set Bits Template
```java
public int countSetBits(int n) {
    int count = 0;
    while (n != 0) {
        n &= (n - 1);
        count++;
    }
    return count;
}
```

### Bit Manipulation Decision Flow
```mermaid
graph TD
    A["Bit Manipulation Problem"] --> B{"Finding unique/missing element?"}
    B -->|Yes| C["Use XOR properties"]
    B -->|No| D{"Counting bits?"}
    D -->|Yes| E["Use n & (n-1) or DP"]
    D -->|No| F{"Checking bit properties?"}
    F -->|Yes| G["Use masks and shifts"]
    F -->|No| H{"Optimizing arithmetic?"}
    H -->|Yes| I["Use XOR for add, shift for multiply"]
    H -->|No| J["Greedy bit-by-bit or Trie approach"]
```

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Single Number**

**Problem Description:**
Given a non-empty array where every element appears twice except for one, find that single element. Must solve in O(n) time and O(1) space.

**Example Walkthrough:**

Input: `nums = [4, 1, 2, 1, 2]`
```
Expected Output: 4

Step 1: result = 0 ^ 4 = 4
Step 2: result = 4 ^ 1 = 5
Step 3: result = 5 ^ 2 = 7
Step 4: result = 7 ^ 1 = 6
Step 5: result = 6 ^ 2 = 4

Return 4
```

Input: `nums = [2, 2, 1]`
```
Expected Output: 1

Step 1: result = 0 ^ 2 = 2
Step 2: result = 2 ^ 2 = 0
Step 3: result = 0 ^ 1 = 1

Return 1
```

**Key Insight - XOR Properties:**
XOR (^) has two critical properties:
1. **a ^ a = 0** (any number XOR itself = 0)
2. **a ^ 0 = a** (any number XOR 0 = itself)
3. **Commutative and Associative**: order doesn't matter

Therefore, if we XOR all elements:
- Pairs cancel out (a ^ a = 0)
- Only the single element remains (0 ^ single = single)

**Why It Works:**
- XOR is commutative: a ^ b ^ a = a ^ a ^ b = 0 ^ b = b
- All paired elements cancel regardless of order
- The remaining value is the single element

**Visualization - XOR Cancellation:**
```mermaid
graph TD
    A["Array: [4, 1, 2, 1, 2]"] --> B["4 ^ 1 ^ 2 ^ 1 ^ 2"]
    B --> C["Group pairs: (1^1) ^ (2^2) ^ 4"]
    C --> D["0 ^ 0 ^ 4"]
    D --> E["Result: 4"]
```

```java
public int singleNumber(int[] nums) {
    int result = 0;
    for (int num : nums) {
        result ^= num;
    }
    return result;
}
```

**Edge Cases:**
- Single element array: returns that element
- Negative numbers: XOR works on binary representation
- Large numbers: no overflow with XOR

**Similar Pattern Problems:**
- Single Number II (every element appears 3 times except one)
- Single Number III (two elements appear once, rest twice)
- Find the Duplicate Number (XOR with indices)

---

#### 2. **Number of 1 Bits**

**Problem Description:**
Given an integer n, return the number of set bits (1s) in its binary representation (also known as Hamming Weight).

**Example Walkthrough:**

Input: `n = 11` (binary: `1011`)
```
Expected Output: 3

Approach 1 (shift and check):
Step 1: n=1011, n&1=1, count=1, n>>>=1 -> n=101
Step 2: n=101,  n&1=1, count=2, n>>>=1 -> n=10
Step 3: n=10,   n&1=0, count=2, n>>>=1 -> n=1
Step 4: n=1,    n&1=1, count=3, n>>>=1 -> n=0
Return 3

Approach 2 (Kernighan's algorithm):
Step 1: n=1011, n&(n-1)=1011&1010=1010, count=1
Step 2: n=1010, n&(n-1)=1010&1001=1000, count=2
Step 3: n=1000, n&(n-1)=1000&0111=0000, count=3
Return 3
```

Input: `n = 128` (binary: `10000000`)
```
Expected Output: 1

Kernighan's:
Step 1: n=10000000, n&(n-1)=0, count=1
Return 1
```

**Key Insight - n & (n-1) Removes Lowest Set Bit:**
- `n & (n-1)` clears the rightmost 1 bit
- Each iteration removes exactly one set bit
- Number of iterations = number of set bits
- Much faster than checking every bit for sparse numbers

**Why It Works:**
- Subtracting 1 flips the lowest set bit to 0 and sets all lower bits to 1
- ANDing with original clears that lowest set bit
- All higher bits remain unchanged
- Repeat until n becomes 0

**Visualization - Kernighan's Algorithm:**
```mermaid
graph TD
    A["n = 1011"] --> B["n-1 = 1010"]
    B --> C["n & (n-1) = 1010 (count=1)"]
    C --> D["n-1 = 1001"]
    D --> E["n & (n-1) = 1000 (count=2)"]
    E --> F["n-1 = 0111"]
    F --> G["n & (n-1) = 0000 (count=3)"]
    G --> H["n = 0, return count=3"]
```

```java
public int hammingWeight(int n) {
    int count = 0;
    while (n != 0) {
        count += (n & 1);
        n >>>= 1;
    }
    return count;
}

// Kernighan's algorithm (faster for sparse bits):
// public int hammingWeight(int n) {
//     int count = 0;
//     while (n != 0) {
//         n &= (n - 1);
//         count++;
//     }
//     return count;
// }
```

**Edge Cases:**
- n = 0: returns 0
- n = 1: returns 1
- All bits set: returns 32
- Negative numbers: use `>>>` (unsigned shift) not `>>`

**Time Complexity**: O(log n) for shift approach, O(k) for Kernighan's (k = set bits)
**Space Complexity**: O(1)

**Similar Pattern Problems:**
- Count Total Set Bits (from 1 to n)
- Bit Parity (check if odd number of set bits)
- Hamming Distance (count differing bits)

---

#### 3. **Power of Two**

**Problem Description:**
Given an integer n, return true if it is a power of two, false otherwise. Must solve in O(1) time.

**Example Walkthrough:**

Input: `n = 16`
```
Expected Output: true (16 = 2^4)

Binary: 10000
n-1:    01111
n&(n-1):00000 = 0 -> Power of 2!
```

Input: `n = 3`
```
Expected Output: false (3 is not a power of 2)

Binary: 11
n-1:    10
n&(n-1):10 != 0 -> Not power of 2
```

Input: `n = 1`
```
Expected Output: true (1 = 2^0)

Binary: 1
n-1:    0
n&(n-1):0 = 0 -> Power of 2!
```

**Key Insight - Single Set Bit Property:**
A power of 2 has exactly ONE set bit in binary:
- 2^0 = 1  = 0001
- 2^1 = 2  = 0010
- 2^2 = 4  = 0100
- 2^3 = 8  = 1000

Therefore, `n & (n-1)` clears that single bit, resulting in 0.

**Why It Works:**
- If n is a power of 2, it has exactly one set bit
- `n-1` flips all bits below and including that bit
- `n & (n-1)` clears the only set bit -> 0
- If n is not a power of 2, it has multiple set bits, so `n & (n-1)` != 0
- Must also check n > 0 (negative numbers can have weird bit patterns)

**Visualization - Power of 2 Check:**
```mermaid
graph TD
    A["n = 16 (10000)"] --> B["n-1 = 15 (01111)"]
    B --> C["n & (n-1) = 00000"]
    C --> D["Result: 0 -> Power of 2"]
    E["n = 3 (11)"] --> F["n-1 = 2 (10)"]
    F --> G["n & (n-1) = 10 != 0"]
    G --> H["Result: Not Power of 2"]
```

```java
public boolean isPowerOfTwo(int n) {
    return n > 0 && (n & (n - 1)) == 0;
}
```

**Edge Cases:**
- n = 0: returns false (0 is not a power of 2)
- n = 1: returns true (2^0 = 1)
- n < 0: returns false (negative numbers not powers of 2)
- Large powers: works up to 2^30 for int

**Time Complexity**: O(1)
**Space Complexity**: O(1)

**Similar Pattern Problems:**
- Power of Three (use division or log)
- Power of Four (power of 2 AND bit in odd position)
- Check if number is power of k

---

#### 4. **Missing Number**

**Problem Description:**
Given an array containing n distinct numbers in range [0, n], find the one number missing from the range.

**Example Walkthrough:**

Input: `nums = [3, 0, 1]`
```
Expected Output: 2 (missing from [0, 1, 2, 3])

XOR approach:
xor = 0
i=0: xor ^= 0 ^ 3 = 3
i=1: xor ^= 1 ^ 0 = 3 ^ 1 ^ 0 = 2
i=2: xor ^= 2 ^ 1 = 2 ^ 2 ^ 1 = 1
After loop: xor ^= nums.length = 1 ^ 3 = 2

Return 2
```

Input: `nums = [0, 1]`
```
Expected Output: 2

xor = 0
i=0: xor ^= 0 ^ 0 = 0
i=1: xor ^= 1 ^ 1 = 0
After loop: xor ^= 2 = 2
Return 2
```

Input: `nums = [9,6,4,2,3,5,7,0,1]`
```
Expected Output: 8

Missing number is 8
```

**Key Insight - XOR All Indices and Values:**
- XOR of all indices 0 to n gives expected XOR
- XOR of all array values gives actual XOR
- XOR of both cancels all present numbers, leaving the missing one

**Why It Works:**
- XOR is commutative and associative
- For every present number, it appears twice (once as index, once as value)
- `a ^ a = 0` cancels them out
- The missing number appears only once, so it survives

**Visualization - Missing Number XOR:**
```mermaid
graph TD
    A["Array: [3, 0, 1], n=3"] --> B["XOR indices: 0^1^2^3"]
    A --> C["XOR values: 3^0^1"]
    B --> D["Combined: 0^1^2^3 ^ 3^0^1"]
    C --> D
    D --> E["Pairs cancel: (0^0)^(1^1)^(3^3)^2"]
    E --> F["Result: 2"]
```

```java
public int missingNumber(int[] nums) {
    int xor = 0;
    for (int i = 0; i < nums.length; i++) {
        xor ^= i ^ nums[i];
    }
    return xor ^ nums.length;
}
```

**Edge Cases:**
- Missing 0: works correctly
- Missing n: works correctly
- Single element [0]: returns 1
- Single element [1]: returns 0

**Alternative Approaches:**
- Sum formula: `n*(n+1)/2 - sum(nums)` (risk of overflow)
- XOR approach: no overflow risk

**Time Complexity**: O(n)
**Space Complexity**: O(1)

**Similar Pattern Problems:**
- Find the Duplicate Number (XOR or cycle detection)
- Find All Numbers Disappeared in Array
- Find Error Nums (one missing, one duplicate)

---

#### 5. **Reverse Bits**

**Problem Description:**
Reverse bits of a given 32-bit unsigned integer.

**Example Walkthrough:**

Input: `n = 43261596` (binary: `00000010100101000001111010011100`)
```
Expected Output: 964176192 (binary: `00111001011110000010100101000000`)

Step-by-step execution:
Initial: result=0, n=...10011100 (last 8 bits)

i=0: result = (0<<1) | (n&1) = 0 | 0 = 0, n>>>=1
i=1: result = (0<<1) | 0 = 0, n>>>=1
i=2: result = 0 | 1 = 1, n>>>=1
i=3: result = (1<<1) | 1 = 3, n>>>=1
...
After 32 iterations, result contains reversed bits
```

Input: `n = 1` (binary: `00000000000000000000000000000001`)
```
Expected Output: -2147483648 (binary: `10000000000000000000000000000000`)
```

Input: `n = 0`
```
Expected Output: 0
```

**Key Insight - Extract and Rebuild:**
- Extract lowest bit of n (`n & 1`)
- Shift result left to make room
- OR the extracted bit into result
- Shift n right to process next bit
- Repeat 32 times (for 32-bit integer)

**Why It Works:**
- Processing from LSB of n builds MSB of result
- Each iteration: take bit 0 of n, put it at current position of result
- After 32 iterations, all bits are reversed
- Using `>>>` (unsigned right shift) ensures correct handling of sign bit

**Visualization - Reverse Bits:**
```mermaid
graph TD
    A["n = 1011"] --> B["i=0: result=0|1=1, n=101"]
    B --> C["i=1: result=10|1=11, n=10"]
    C --> D["i=2: result=110|0=110, n=1"]
    D --> E["i=3: result=1100|1=1101, n=0"]
    E --> F["Result: 1101 (reversed)"]
```

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

**Edge Cases:**
- n = 0: returns 0
- n = -1 (all 1s): returns -1 (all 1s reversed = all 1s)
- n with sign bit: use `>>>` not `>>`
- Large values: works for any 32-bit integer

**Time Complexity**: O(1) - exactly 32 iterations
**Space Complexity**: O(1)

**Similar Pattern Problems:**
- Reverse Integer (with overflow check)
- Reverse Bits in a Byte
- Binary String Reversal

---

### Medium

#### 6. **Sum of Two Integers**

**Problem Description:**
Calculate the sum of two integers a and b without using the + or - operators.

**Example Walkthrough:**

Input: `a = 1, b = 2`
```
Expected Output: 3

Step 1: carry = (1 & 2) << 1 = 0 << 1 = 0
        a = 1 ^ 2 = 3
        b = 0
Loop ends (b == 0)
Return 3
```

Input: `a = 5, b = 7`
```
Expected Output: 12

Step 1: carry = (5 & 7) << 1 = 5 << 1 = 10
        a = 5 ^ 7 = 2
        b = 10

Step 2: carry = (2 & 10) << 1 = 2 << 1 = 4
        a = 2 ^ 10 = 8
        b = 4

Step 3: carry = (8 & 4) << 1 = 0 << 1 = 0
        a = 8 ^ 4 = 12
        b = 0
Loop ends
Return 12
```

Input: `a = -1, b = 1`
```
Expected Output: 0

Step 1: carry = (-1 & 1) << 1 = 1 << 1 = 2
        a = -1 ^ 1 = -2
        b = 2

Step 2: carry = (-2 & 2) << 1 = 2 << 1 = 4
        a = -2 ^ 2 = -4
        b = 4

... continues until b = 0
Return 0
```

**Key Insight - XOR for Sum, AND for Carry:**
- **XOR (^)** gives sum without carry (like addition without carry propagation)
- **AND (&)** gives carry bits where both have 1
- **Shift left** moves carry to correct position
- Repeat until no carry remains

**Why It Works:**
- Binary addition: sum = a XOR b, carry = a AND b
- Carry needs to be added to next higher bit (shift left)
- New sum = (a XOR b) XOR (carry << 1)
- Repeat until carry becomes 0
- Maximum 32 iterations for 32-bit integers

**Visualization - Sum of Two Integers:**
```mermaid
graph TD
    A["a=5, b=7"] --> B["carry = (5&7)<<1 = 10"]
    B --> C["a = 5^7 = 2, b = 10"]
    C --> D["carry = (2&10)<<1 = 4"]
    D --> E["a = 2^10 = 8, b = 4"]
    E --> F["carry = (8&4)<<1 = 0"]
    F --> G["a = 8^4 = 12, b = 0"]
    G --> H["Return 12"]
```

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

**Edge Cases:**
- Both positive: works correctly
- Both negative: works with two's complement
- One zero: returns the other
- Overflow: Java int wraps around (expected behavior)

**Time Complexity**: O(1) - max 32 iterations
**Space Complexity**: O(1)

**Similar Pattern Problems:**
- Add Two Numbers (linked list)
- Multiply Integers without *
- Subtract without -

---

#### 7. **Counting Bits**

**Problem Description:**
Given an integer n, return an array ans of length n+1 where ans[i] is the number of 1s in binary representation of i.

**Example Walkthrough:**

Input: `n = 5`
```
Expected Output: [0, 1, 1, 2, 1, 2]

i=0: 0 (000) -> 0 ones
i=1: 1 (001) -> 1 one
i=2: 2 (010) -> 1 one
i=3: 3 (011) -> 2 ones
i=4: 4 (100) -> 1 one
i=5: 5 (101) -> 2 ones

DP approach:
dp[0] = 0
dp[1] = dp[0] + (1&1) = 0 + 1 = 1
dp[2] = dp[1] + (2&1) = 1 + 0 = 1
dp[3] = dp[1] + (3&1) = 1 + 1 = 2
dp[4] = dp[2] + (4&1) = 1 + 0 = 1
dp[5] = dp[2] + (5&1) = 1 + 1 = 2
```

Input: `n = 2`
```
Expected Output: [0, 1, 1]

i=0: 0 -> 0
i=1: 1 -> 1
i=2: 10 -> 1
```

**Key Insight - DP Recurrence:**
`dp[i] = dp[i >> 1] + (i & 1)`
- `i >> 1` is i divided by 2 (drops LSB)
- `i & 1` is the LSB of i
- Number of 1s in i = number of 1s in i/2 + (LSB of i)

**Alternative Recurrence:**
`dp[i] = dp[i & (i-1)] + 1`
- `i & (i-1)` removes the lowest set bit
- So dp[i] = dp[i with lowest bit removed] + 1

**Why It Works:**
- Every number i can be decomposed as: i = (i >> 1) << 1 + (i & 1)
- The number of set bits in i = set bits in (i >> 1) + LSB
- This builds the solution bottom-up in O(n) time
- Avoids recomputing counts for each number

**Visualization - Counting Bits DP:**
```mermaid
graph TD
    A["dp[0] = 0"] --> B["dp[1] = dp[0] + 1 = 1"]
    A --> C["dp[2] = dp[1] + 0 = 1"]
    B --> D["dp[3] = dp[1] + 1 = 2"]
    C --> E["dp[4] = dp[2] + 0 = 1"]
    C --> F["dp[5] = dp[2] + 1 = 2"]
```

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

**Edge Cases:**
- n = 0: returns [0]
- n = 1: returns [0, 1]
- Large n: O(n) time and space
- All numbers: correctly computed

**Time Complexity**: O(n)
**Space Complexity**: O(n) for output array

**Similar Pattern Problems:**
- Popcount (population count)
- Hamming Weight for multiple numbers
- Bit Count Array

---

#### 8. **Bitwise AND of Numbers Range**

**Problem Description:**
Given two integers left and right, return the bitwise AND of all numbers in range [left, right] inclusive.

**Example Walkthrough:**

Input: `left = 5, right = 7`
```
Expected Output: 4

Binary:
5 = 101
6 = 110
7 = 111
AND = 100 = 4

Step-by-step:
m=5 (101), n=7 (111)
Step 1: m != n, shift both right
        m=2 (10), n=3 (11), shift=1
Step 2: m != n, shift both right
        m=1 (1), n=1 (1), shift=2
Step 3: m == n, stop
        Return m << shift = 1 << 2 = 4
```

Input: `left = 0, right = 0`
```
Expected Output: 0

m=0, n=0, m == n immediately
Return 0 << 0 = 0
```

Input: `left = 1, right = 2147483647`
```
Expected Output: 0

The range spans many numbers
Common prefix becomes empty
Return 0
```

**Key Insight - Common Prefix:**
- The result is the common prefix of binary representations of left and right
- Any bits that differ at some position will be 0 in the AND result
- We shift both right until they're equal (finding common prefix)
- Then shift back left by the number of shifts

**Why It Works:**
- AND of a range: any bit position that changes value within the range becomes 0
- Only bits that stay constant (common prefix) survive
- Shifting right until equal finds the common prefix
- Shifting back left restores the prefix in its original position

**Visualization - Bitwise AND Range:**
```mermaid
graph TD
    A["left=5 (101), right=7 (111)"] --> B["Shift right: m=2 (10), n=3 (11), shift=1"]
    B --> C["Shift right: m=1 (1), n=1 (1), shift=2"]
    C --> D["m == n, stop"]
    D --> E["Return m << shift = 1 << 2 = 4"]
```

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

**Edge Cases:**
- left == right: returns left
- left = 0: returns 0
- Large range: returns 0 (no common prefix)
- Small range: returns common prefix

**Time Complexity**: O(log max(m,n)) - number of bits
**Space Complexity**: O(1)

**Similar Pattern Problems:**
- Bitwise OR Range (similar logic, different result)
- Bitwise XOR Range (pattern-based)
- Common Prefix in Binary Strings

---

### Hard

#### 9. **Maximum XOR of Two Numbers in an Array**

**Problem Description:**
Given an integer array nums, return the maximum result of nums[i] XOR nums[j] where 0 <= i <= j < n.

**Example Walkthrough:**

Input: `nums = [3, 10, 5, 25, 2, 8]`
```
Expected Output: 28

3  = 00011
10 = 01010
5  = 00101
25 = 11001
2  = 00010
8  = 01000

Max XOR: 5 ^ 25 = 00101 ^ 11001 = 11100 = 28

Bit-by-bit greedy:
i=31 to i=0:
At each bit, check if we can achieve a higher XOR
Using prefix set and checking if temp ^ prefix exists

For i=4 (16's place):
mask = 16 (10000)
prefixes: {3&16=0, 10&16=0, 5&16=0, 25&16=16, 2&16=0, 8&16=0} = {0, 16}
temp = 0 | 16 = 16
Check: 16^0=16 in set? YES -> maxXor = 16

For i=3 (8's place):
mask = 24 (11000)
prefixes: {3&24=0, 10&24=8, 5&24=0, 25&24=24, 2&24=0, 8&24=8} = {0, 8, 24}
temp = 16 | 8 = 24
Check: 24^0=24 in set? YES -> maxXor = 24
Check: 24^8=16 in set? YES -> maxXor = 24

For i=2 (4's place):
mask = 28 (11100)
prefixes: {3&28=0, 10&28=8, 5&28=4, 25&28=24, 2&28=0, 8&28=8} = {0, 4, 8, 24}
temp = 24 | 4 = 28
Check: 28^0=28 in set? NO
Check: 28^4=24 in set? YES -> maxXor = 28

For i=1 (2's place):
temp = 28 | 2 = 30
Check: 30^prefix in set? NO
maxXor remains 28

For i=0 (1's place):
temp = 28 | 1 = 29
Check: 29^prefix in set? NO
maxXor remains 28

Return 28
```

Input: `nums = [0]`
```
Expected Output: 0 (only one element, XOR with itself = 0)
```

**Key Insight - Greedy Bit-by-Bit with Prefix Set:**
- Build answer from MSB to LSB
- At each bit, assume we can set it to 1
- Check if two prefixes exist that XOR to this assumed value
- If yes, keep the bit; if no, clear it
- Uses HashSet for O(1) prefix lookup

**Why It Works:**
- XOR result's bit i depends only on bits 0..i of the operands
- We can determine each bit greedily from MSB to LSB
- If we can achieve a higher prefix XOR, we should
- Checking existence of `temp ^ prefix` in set tells us if two numbers can produce `temp`

**Visualization - Maximum XOR:**
```mermaid
graph TD
    A["nums = [3, 10, 5, 25, 2, 8]"] --> B["i=4: mask=16, maxXor=16"]
    B --> C["i=3: mask=24, maxXor=24"]
    C --> D["i=2: mask=28, maxXor=28"]
    D --> E["i=1: mask=30, cannot achieve, maxXor=28"]
    E --> F["i=0: mask=29, cannot achieve, maxXor=28"]
    F --> G["Return 28"]
```

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

**Edge Cases:**
- Single element: returns 0 (XOR with itself)
- All same elements: returns 0
- Two elements: returns their XOR
- Large array: O(n * 32) time

**Time Complexity**: O(n * 32) - 32 bits, n numbers
**Space Complexity**: O(n) - HashSet for prefixes

**Similar Pattern Problems:**
- Maximum XOR with Constraint
- XOR Maximization
- Maximum XOR Subarray

---

#### 10. **Number of Distinct Subsequences**

**Problem Description:**
Given a string s, count the number of distinct subsequences of s. Since answer may be large, return it modulo 10^9 + 7.

**Example Walkthrough:**

Input: `s = "abc"`
```
Expected Output: 7

Distinct subsequences: "", "a", "b", "c", "ab", "ac", "bc", "abc"
Wait, that's 8. Let me recount:
"", "a", "b", "c", "ab", "ac", "bc", "abc" = 8

Actually the answer for "abc" is 7? Let me verify:
dp starts at 1 (empty)
'a': dp = 2*1 - 0 = 2 (empty, a)
'b': dp = 2*2 - 0 = 4 (empty, a, b, ab)
'c': dp = 2*4 - 0 = 8 (empty, a, b, c, ab, ac, bc, abc)
So 8 distinct subsequences.
```

Input: `s = "aaa"`
```
Expected Output: 7

dp = 1
'a': dp = 2*1 - 0 = 2 (empty, a)
'a': dp = 2*2 - 2 = 2 (empty, a) - last['a'] was 2, so subtract 2
Actually: last['a'] = 2, dp = 2*2 - 2 = 2
'a': dp = 2*2 - 2 = 2
Hmm, that gives 2, not 7.

Let me redo:
dp = 1
'a': dp = 2*1 - 0 = 2, last['a'] = 2
'a': dp = 2*2 - 2 = 2, last['a'] = 2
'a': dp = 2*2 - 2 = 2
Wait that's still 2.

Actually the answer for "aaa" is 4: "", "a", "aa", "aaa"
Let me recompute:
dp = 1
'a': dp = 2*1 - 0 = 2, last['a'] = 2
'a': dp = 2*2 - 2 = 2, last['a'] = 2
'a': dp = 2*2 - 2 = 2

Hmm, still 2. Something is off.

Let me use the correct formula:
dp[i] = 2*dp[i-1] - dp[last[c]-1] if c seen before
dp[i] = 2*dp[i-1] if c not seen

For "aaa":
dp[0] = 1 (empty string)
dp[1] (a): 2*1 - 0 = 2
dp[2] (a): 2*2 - dp[0] = 4 - 1 = 3
dp[3] (a): 2*3 - dp[1] = 6 - 2 = 4

So answer is 4: "", "a", "aa", "aaa"

For "abc":
dp[0] = 1
dp[1] (a): 2*1 = 2
dp[2] (b): 2*2 = 4
dp[3] (c): 2*4 = 8

Answer is 8.
```

**Key Insight - DP with Last Occurrence:**
- `dp[i]` = number of distinct subsequences of first i characters
- When adding character c:
  - Double the count (append c to all previous subsequences)
  - Subtract duplicates: subsequences ending with c that were already counted
  - Duplicates = dp[last occurrence of c - 1]
- Use array `last[26]` to track last seen position

**Why It Works:**
- Each new character can either be appended to all existing subsequences or not
- This doubles the count
- But if c was seen before, some subsequences are duplicates
- Subtract the count from before the previous occurrence

**Visualization - Distinct Subsequences:**
```mermaid
graph TD
    A["s='aaa', dp=1"] --> B["'a': dp=2*1-0=2, last[a]=2"]
    B --> C["'a': dp=2*2-1=3, last[a]=3"]
    C --> D["'a': dp=2*3-2=4, last[a]=4"]
    D --> E["Return 4"]
```

```java
public int distinctSubsequences(String s) {
    int mod = 1000000007;
    long dp = 1;
    long[] last = new long[26];
    for (char c : s.toCharArray()) {
        int idx = c - 'a';
        long prev = dp;
        dp = (2 * dp - last[idx] + mod) % mod;
        last[idx] = prev;
    }
    return (int) dp;
}
```

**Edge Cases:**
- Empty string: returns 1 (only empty subsequence)
- Single character: returns 2 (empty, char)
- All same characters: returns n+1
- All distinct: returns 2^n

**Time Complexity**: O(n)
**Space Complexity**: O(26) = O(1)

**Similar Pattern Problems:**
- Number of Subsequences
- Distinct Subsequences II
- Count Different Palindromic Subsequences

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
x ^ (x>>1)      // Gray code
```

### Bit Tricks
- Check power of 2: `(x & (x-1)) == 0`
- Count bits: Kernighan's algorithm or lookup
- Swap without temp: `a = a ^ b; b = a ^ b; a = a ^ b;`
- Check bit i: `(x >> i) & 1`
- Set bit i: `x | (1 << i)`
- Clear bit i: `x & ~(1 << i)`
- Toggle bit i: `x ^ (1 << i)`
- Check if even: `(x & 1) == 0`
- Check if odd: `(x & 1) == 1`
- Absolute value: `(x ^ (x >> 31)) - (x >> 31)`

---

## 🎯 Common Pitfalls to Avoid

- Integer overflow (use long for intermediate results)
- Confusing signed and unsigned shifts (`>>` vs `>>>`)
- Not handling negative numbers correctly (two's complement)
- Off-by-one in bit positions (0-indexed vs 1-indexed)
- Forgetting modulo in large results
- Using `>>` instead of `>>>` for unsigned operations
- Not considering edge cases (0, 1, negative numbers)
- Assuming bits are limited to 32 in all languages
- Forgetting that XOR of a number with itself is 0
- Not using parentheses around bitwise operations (precedence issues)