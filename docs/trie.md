# Trie (Prefix Tree)

## Key Concepts
- Prefix tree structure for efficient string search
- Each node represents a character
- Root node is empty
- **Time Complexity**: O(m) for insert/search/delete where m = word length
- **Space Complexity**: O(ALPHABET_SIZE * N) where N = number of words

## Common Problems
- Implement Trie (Insert, Search, StartsWith)
- Word Search II
- Replace Words
- Autocomplete/Prefix Matching
- Longest Word in Dictionary

## Patterns / Techniques
- TrieNode with children array
- DFS for word search
- Suffix tree variants
- Trie with deletion support

---

## 🔹 Practice Problems by Topic

### Medium

#### 1. **Implement Trie (Prefix Tree)**
**Explanation**: Create TrieNode with 26 children (lowercase letters). Insert: traverse/create nodes for each character, mark end of word. Search: traverse if possible, return if word found. StartsWith: similar to search but doesn't need end marker. Time: O(m), Space: O(1) amortized per insertion.

```java
class TrieNode {
    TrieNode[] children = new TrieNode[26];
    boolean isEnd = false;
}

class Trie {
    private TrieNode root;
    
    public Trie() {
        root = new TrieNode();
    }
    
    public void insert(String word) {
        TrieNode node = root;
        for (char c : word.toCharArray()) {
            int idx = c - 'a';
            if (node.children[idx] == null) {
                node.children[idx] = new TrieNode();
            }
            node = node.children[idx];
        }
        node.isEnd = true;
    }
    
    public boolean search(String word) {
        TrieNode node = root;
        for (char c : word.toCharArray()) {
            int idx = c - 'a';
            if (node.children[idx] == null) return false;
            node = node.children[idx];
        }
        return node.isEnd;
    }
    
    public boolean startsWith(String prefix) {
        TrieNode node = root;
        for (char c : prefix.toCharArray()) {
            int idx = c - 'a';
            if (node.children[idx] == null) return false;
            node = node.children[idx];
        }
        return true;
    }
}
```

**Similar Pattern Problems**: Autocomplete, Type-ahead Search

---

#### 2. **Replace Words**
**Explanation**: Build trie from dictionary words. For each word in sentence, find shortest matching prefix in trie. Replace if found. Time: O(S*L) where S = total sentence length, L = max word length.

```java
public String replaceWords(List<String> dictionary, String sentence) {
    TrieNode root = new TrieNode();
    
    for (String word : dictionary) {
        TrieNode node = root;
        for (char c : word.toCharArray()) {
            int idx = c - 'a';
            if (node.children[idx] == null) {
                node.children[idx] = new TrieNode();
            }
            node = node.children[idx];
        }
        node.isEnd = true;
    }
    
    String[] words = sentence.split(" ");
    StringBuilder result = new StringBuilder();
    
    for (String word : words) {
        TrieNode node = root;
        StringBuilder prefix = new StringBuilder();
        
        for (char c : word.toCharArray()) {
            int idx = c - 'a';
            if (node.children[idx] == null || node.isEnd) break;
            prefix.append(c);
            node = node.children[idx];
        }
        
        result.append(node.isEnd ? prefix.toString() : word).append(" ");
    }
    
    return result.toString().trim();
}
```

**Similar Pattern Problems**: Prefix Matching, Word Replacement

---

### Hard

#### 3. **Word Search II**
**Explanation**: Build trie from word list. Use DFS on board, backtracking with trie traversal. When reaching trie end node, word found. Time: O(M*N*4^L) worst case where M*N = board size, L = word length.

```java
public List<String> findWords(char[][] board, String[] words) {
    TrieNode root = new TrieNode();
    for (String word : words) {
        TrieNode node = root;
        for (char c : word.toCharArray()) {
            int idx = c - 'a';
            if (node.children[idx] == null) {
                node.children[idx] = new TrieNode();
            }
            node = node.children[idx];
        }
        node.isEnd = true;
        node.word = word;
    }
    
    Set<String> result = new HashSet<>();
    for (int i = 0; i < board.length; i++) {
        for (int j = 0; j < board[i].length; j++) {
            dfs(board, i, j, root, result);
        }
    }
    return new ArrayList<>(result);
}

private void dfs(char[][] board, int i, int j, TrieNode node, Set<String> result) {
    if (i < 0 || i >= board.length || j < 0 || j >= board[0].length) return;
    
    char c = board[i][j];
    if (c == '#') return; // Visited
    
    int idx = c - 'a';
    if (node.children[idx] == null) return;
    
    node = node.children[idx];
    if (node.isEnd && node.word != null) {
        result.add(node.word);
        node.word = null; // Avoid duplicates
    }
    
    board[i][j] = '#'; // Mark visited
    
    dfs(board, i+1, j, node, result);
    dfs(board, i-1, j, node, result);
    dfs(board, i, j+1, node, result);
    dfs(board, i, j-1, node, result);
    
    board[i][j] = c; // Restore
}
```

**Similar Pattern Problems**: Word Search, Boggle, Word Break

---

#### 4. **Palindrome Pairs**
**Explanation**: For each word, check if pairing with another word forms palindrome. Use trie to find matching words efficiently. Approach: for word A, find word B such that A+B is palindrome. This means B's reverse must have specific structure. Time: O(N*K²) where N = words, K = max word length.

```java
public List<List<Integer>> palindromePairs(String[] words) {
    List<List<Integer>> result = new ArrayList<>();
    HashMap<String, Integer> map = new HashMap<>();
    
    for (int i = 0; i < words.length; i++) {
        map.put(words[i], i);
    }
    
    for (int i = 0; i < words.length; i++) {
        String word = words[i];
        
        for (int j = 0; j <= word.length(); j++) {
            String left = word.substring(0, j);
            String right = word.substring(j);
            
            // Check if right is palindrome
            if (isPalindrome(right)) {
                String reverse = new StringBuilder(left).reverse().toString();
                if (map.containsKey(reverse) && map.get(reverse) != i) {
                    result.add(Arrays.asList(i, map.get(reverse)));
                }
            }
            
            // Check if left is palindrome
            if (isPalindrome(left)) {
                String reverse = new StringBuilder(right).reverse().toString();
                if (map.containsKey(reverse) && map.get(reverse) != i && j != word.length()) {
                    result.add(Arrays.asList(map.get(reverse), i));
                }
            }
        }
    }
    
    return result;
}

private boolean isPalindrome(String s) {
    int left = 0, right = s.length() - 1;
    while (left < right) {
        if (s.charAt(left++) != s.charAt(right--)) return false;
    }
    return true;
}
```

**Similar Pattern Problems**: Longest Palindrome Pairs, Palindrome Words

---

## 📌 Key Patterns & Techniques

### 1. **Trie Construction**
- Insert: traverse/create nodes per character
- Mark end nodes for word boundary
- Can extend with frequency/metadata

### 2. **Trie Traversal**
- DFS for word search/prefix matching
- Backtracking with restoration
- Early termination when path invalid

### 3. **Optimizations**
- Prune invalid branches early
- Mark words during traversal to avoid duplicates
- Use hashmap for lookups within trie

---

## 🎯 Common Pitfalls to Avoid

- ❌ Not marking end of words (only root matters)
- ❌ Off-by-one errors in character indices (char - 'a' for lowercase)
- ❌ Not restoring board in backtracking
- ❌ Forgetting to handle null children
- ❌ Not checking for existing word conditions
