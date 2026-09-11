# Maths

## Key Concepts
- Number theory basics (GCD, LCM, Primes)
- Modulo arithmetic for large numbers
- Digit manipulation and counting
- Mathematical patterns and formulas

## Common Problems
- Sieve of Eratosthenes (prime sieve)
- Modular Exponentiation (fast power)
- GCD and LCM calculations
- Prime factorization
- Digit operations

## Patterns / Techniques
- Euclidean Algorithm (GCD)
- Sieve of Eratosthenes (primes)
- Fast Exponentiation
- Digit DP
- Modular Arithmetic

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Count Primes**
**Explanation**: Use Sieve of Eratosthenes. Mark all multiples of each prime as non-prime. Time: O(n log log n), Space: O(n).

```java
public int countPrimes(int n) {
    if (n < 2) return 0;
    
    boolean[] isPrime = new boolean[n];
    for (int i = 2; i < n; i++) {
        isPrime[i] = true;
    }
    
    for (int i = 2; i * i < n; i++) {
        if (isPrime[i]) {
            for (int j = i * i; j < n; j += i) {
                isPrime[j] = false;
            }
        }
    }
    
    int count = 0;
    for (boolean prime : isPrime) {
        if (prime) count++;
    }
    return count;
}
```

**Similar Pattern Problems**: Prime Factorization, Smallest Prime Factor

---

#### 2. **Happy Number**
**Explanation**: Repeatedly sum squares of digits. If reaches 1, happy. If cycle detected, not happy. Use hashset to detect cycles. Time: O(log n), Space: O(log n).

```java
public boolean isHappy(int n) {
    HashSet<Integer> seen = new HashSet<>();
    
    while (n != 1 && !seen.contains(n)) {
        seen.add(n);
        int sum = 0;
        while (n > 0) {
            int digit = n % 10;
            sum += digit * digit;
            n /= 10;
        }
        n = sum;
    }
    
    return n == 1;
}
```

**Similar Pattern Problems**: Digit Cycle Detection, Sum of Digits

---

#### 3. **Ugly Number**
**Explanation**: Check if number only has prime factors 2, 3, 5. Repeatedly divide by these factors. If result is 1, ugly number. Time: O(log n), Space: O(1).

```java
public boolean isUgly(int n) {
    if (n <= 0) return false;
    
    while (n % 2 == 0) n /= 2;
    while (n % 3 == 0) n /= 3;
    while (n % 5 == 0) n /= 5;
    
    return n == 1;
}
```

**Similar Pattern Problems**: Ugly Number II, Super Ugly Number

---

### Medium

#### 4. **Power of Three**
**Explanation**: Check if n is power of 3. Method 1: keep dividing by 3. Method 2: use log (log_3(n) = log(n)/log(3)). Time: O(log n), Space: O(1).

```java
public boolean isPowerOfThree(int n) {
    if (n <= 0) return false;
    
    while (n % 3 == 0) {
        n /= 3;
    }
    
    return n == 1;
}
```

**Similar Pattern Problems**: Power of Two, Power of Four, Power of K

---

#### 5. **Excel Sheet Column Number**
**Explanation**: Treat as base-26 conversion. A=1, Z=26, AA=27. Build number by: result = result*26 + (char - 'A' + 1). Time: O(length), Space: O(1).

```java
public int titleToNumber(String columnTitle) {
    int result = 0;
    
    for (char c : columnTitle.toCharArray()) {
        result = result * 26 + (c - 'A' + 1);
    }
    
    return result;
}
```

**Similar Pattern Problems**: Excel Sheet Column Title, Number to Excel

---

#### 6. **Add Digits**
**Explanation**: Repeatedly sum digits until single digit. Or use digital root formula: root = 1 + (n-1) % 9. Time: O(log n), Space: O(1).

```java
public int addDigits(int num) {
    while (num >= 10) {
        int sum = 0;
        while (num > 0) {
            sum += num % 10;
            num /= 10;
        }
        num = sum;
    }
    return num;
}

// Or one-liner formula:
// return num == 0 ? 0 : 1 + (num - 1) % 9;
```

**Similar Pattern Problems**: Sum of Digits, Digital Root Variants

---

#### 7. **Factorial Trailing Zeroes**
**Explanation**: Count pairs of 2 and 5. Since factors of 2 > 5, count 5s. Divide by 5, 25, 125... Time: O(log n), Space: O(1).

```java
public int trailingZeroes(int n) {
    int count = 0;
    
    while (n > 0) {
        n /= 5;
        count += n;
    }
    
    return count;
}
```

**Similar Pattern Problems**: Trailing Zeroes in Product, Prime Factorization Count

---

### Hard

#### 8. **Integer to English Words**
**Explanation**: Break number into groups (ones, thousands, millions, billions). Convert each group using helper functions. Combine with appropriate scale words. Time: O(1), Space: O(1).

```java
public String numberToWords(int num) {
    if (num == 0) return "Zero";
    
    String[] thousands = {"", "Thousand", "Million", "Billion"};
    String[] ones = {"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"};
    String[] teens = {"Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", 
                      "Sixteen", "Seventeen", "Eighteen", "Nineteen"};
    String[] tens = {"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"};
    
    List<String> result = new ArrayList<>();
    int groupIndex = 0;
    
    while (num > 0) {
        if (num % 1000 != 0) {
            result.add(0, convertHundred(num % 1000, ones, teens, tens) + thousands[groupIndex]);
        }
        num /= 1000;
        groupIndex++;
    }
    
    return String.join(" ", result).trim();
}

private String convertHundred(int num, String[] ones, String[] teens, String[] tens) {
    List<String> words = new ArrayList<>();
    
    if (num == 0) {
        return "";
    }
    
    if (num / 100 > 0) {
        words.add(ones[num / 100]);
        words.add("Hundred");
    }
    
    if (num % 100 >= 10 && num % 100 < 20) {
        words.add(teens[num % 100 - 10]);
    } else {
        if (num % 100 / 10 > 0) {
            words.add(tens[num % 100 / 10]);
        }
        if (num % 10 > 0) {
            words.add(ones[num % 10]);
        }
    }
    
    return String.join(" ", words);
}
```

**Similar Pattern Problems**: Roman to Integer, Integer to Roman

---

#### 9. **Super Power**
**Explanation**: Use modular exponentiation. Compute base^(2*k) = (base^k)^2. Process digits from left to right: result = (result^10 * base^digit) % mod. Time: O(n), Space: O(1).

```java
public int superPower(int base, int[] exponent) {
    int mod = 1337;
    int result = 1;
    
    for (int digit : exponent) {
        result = power(result, 10, mod);
        result = (result * power(base, digit, mod)) % mod;
    }
    
    return result;
}

private int power(int base, int exp, int mod) {
    int result = 1;
    base %= mod;
    
    while (exp > 0) {
        if (exp % 2 == 1) {
            result = (result * base) % mod;
        }
        base = (base * base) % mod;
        exp /= 2;
    }
    
    return result;
}
```

**Similar Pattern Problems**: Fast Exponentiation, Modular Arithmetic

---

## 📌 Key Patterns & Techniques

### 1. **Sieve of Eratosthenes**
- Mark multiples of primes as non-prime
- Efficient for prime range queries
- Time: O(n log log n)

### 2. **Modular Arithmetic**
- (a + b) % m = ((a % m) + (b % m)) % m
- (a * b) % m = ((a % m) * (b % m)) % m
- Use for preventing overflow

### 3. **Fast Exponentiation**
- Compute base^exp % mod efficiently
- Binary exponentiation approach
- Time: O(log exp)

### 4. **Digit Manipulation**
- Extract digits: num % 10
- Process from right to left
- Reconstruct numbers by building

---

## 🎯 Common Pitfalls to Avoid

- ❌ Integer overflow in multiplication
- ❌ Not handling edge cases (0, 1, negative numbers)
- ❌ Inefficient prime checking (O(n) instead of O(√n))
- ❌ Wrong modulo application order
- ❌ Off-by-one in digit counting

