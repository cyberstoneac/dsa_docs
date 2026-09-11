# Intervals

## Key Concepts
- **Interval**: Pair [start, end] representing a range
- **Overlap**: Two intervals overlap if one doesn't end before other starts
- **Merge**: Combine overlapping intervals
- **Sort**: Usually by start time, then by end time
- **Sweep Line**: Process events (start/end) in order
- **Common Problems**: Meeting rooms, interval scheduling, skyline

## Overlap Condition
- **Not Overlapping**: a.end < b.start or b.end < a.start
- **Overlapping**: a.start ≤ b.end and b.start ≤ a.end
- **Merged Interval**: [min(starts), max(ends)]

## Patterns
1. **Sort & Merge**: Sort by start, merge adjacent
2. **Sweep Line**: Track active intervals at each point
3. **Priority Queue**: Process intervals by priority

## Complexity
- Sort: O(n log n)
- Merge: O(n)
- Total: Usually O(n log n)

---

## 🔹 Practice Problems by Topic

### Easy

#### 1. **Merge Intervals**
**Explanation**: Sort by start time, merge overlapping intervals. Time: O(n log n), Space: O(1).

```java
public int[][] merge(int[][] intervals) {
    if (intervals.length <= 1) return intervals;
    
    Arrays.sort(intervals, (a, b) -> a[0] - b[0]);
    
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
    return merged.toArray(new int[0][]);
}
```

**Similar Pattern Problems**: Insert Interval, Remove Interval Overlap

---

#### 2. **Insert Interval**
**Explanation**: Insert new interval and merge. Handle non-overlapping before/after. Time: O(n), Space: O(n).

```java
public int[][] insert(int[][] intervals, int[] newInterval) {
    List<int[]> result = new ArrayList<>();
    int i = 0;
    
    // Add intervals before newInterval
    while (i < intervals.length && intervals[i][1] < newInterval[0]) {
        result.add(intervals[i++]);
    }
    
    // Merge overlapping intervals
    while (i < intervals.length && intervals[i][0] <= newInterval[1]) {
        newInterval[0] = Math.min(newInterval[0], intervals[i][0]);
        newInterval[1] = Math.max(newInterval[1], intervals[i][1]);
        i++;
    }
    
    result.add(newInterval);
    
    // Add remaining intervals
    while (i < intervals.length) {
        result.add(intervals[i++]);
    }
    
    return result.toArray(new int[0][]);
}
```

**Similar Pattern Problems**: Insert Range, Merge Sorted Intervals

---

### Medium

#### 3. **Meeting Rooms**
**Explanation**: Sort by start time, check if any two meetings overlap. Time: O(n log n), Space: O(1).

```java
public boolean canAttendMeetings(int[][] intervals) {
    Arrays.sort(intervals, (a, b) -> a[0] - b[0]);
    
    for (int i = 1; i < intervals.length; i++) {
        if (intervals[i][0] < intervals[i - 1][1]) {
            return false;
        }
    }
    
    return true;
}
```

**Similar Pattern Problems**: Meeting Rooms II, Minimum Rooms Required

---

#### 4. **Meeting Rooms II (Minimum Rooms)**
**Explanation**: Count max concurrent meetings. Use heap or sweep line. Time: O(n log n), Space: O(n).

```java
public int minMeetingRooms(int[][] intervals) {
    int[] starts = new int[intervals.length];
    int[] ends = new int[intervals.length];
    
    for (int i = 0; i < intervals.length; i++) {
        starts[i] = intervals[i][0];
        ends[i] = intervals[i][1];
    }
    
    Arrays.sort(starts);
    Arrays.sort(ends);
    
    int rooms = 0, maxRooms = 0;
    int i = 0, j = 0;
    
    while (i < intervals.length) {
        if (starts[i] < ends[j]) {
            rooms++;
            i++;
        } else {
            rooms--;
            j++;
        }
        maxRooms = Math.max(maxRooms, rooms);
    }
    
    return maxRooms;
}
```

**Similar Pattern Problems**: Minimum Flights to Connect All Cities, Rooms Required

---

#### 5. **Non-overlapping Intervals**
**Explanation**: Remove minimum intervals to make rest non-overlapping. Greedy by end time. Time: O(n log n), Space: O(1).

```java
public int eraseOverlapIntervals(int[][] intervals) {
    if (intervals.length <= 1) return 0;
    
    Arrays.sort(intervals, (a, b) -> a[1] - b[1]);
    
    int removed = 0;
    int prevEnd = intervals[0][1];
    
    for (int i = 1; i < intervals.length; i++) {
        if (intervals[i][0] < prevEnd) {
            removed++;
        } else {
            prevEnd = intervals[i][1];
        }
    }
    
    return removed;
}
```

**Similar Pattern Problems**: Maximum Non-overlapping Intervals, Interval Scheduling

---

### Hard

#### 6. **Skyline Problem**
**Explanation**: Merge building heights at each x-coordinate. Use sweep line with multiset. Time: O(n log n), Space: O(n).

```java
public List<List<Integer>> getSkyline(int[][] buildings) {
    List<List<Integer>> result = new ArrayList<>();
    List<int[]> events = new ArrayList<>();
    
    for (int[] b : buildings) {
        events.add(new int[]{b[0], 0, b[2]}); // start, type (0=start, 1=end), height
        events.add(new int[]{b[1], 1, b[2]});
    }
    
    events.sort((a, b) -> a[0] == b[0] ? a[1] - b[1] : a[0] - b[0]);
    
    TreeMap<Integer, Integer> heightCount = new TreeMap<>();
    heightCount.put(0, 1);
    int prevMaxHeight = 0;
    
    for (int[] event : events) {
        int x = event[0], type = event[1], h = event[2];
        
        if (type == 0) {
            heightCount.put(h, heightCount.getOrDefault(h, 0) + 1);
        } else {
            heightCount.put(h, heightCount.get(h) - 1);
            if (heightCount.get(h) == 0) heightCount.remove(h);
        }
        
        int maxHeight = heightCount.lastKey();
        
        if (maxHeight != prevMaxHeight) {
            result.add(Arrays.asList(x, maxHeight));
            prevMaxHeight = maxHeight;
        }
    }
    
    return result;
}
```

**Similar Pattern Problems**: Rectangle Area II, Largest Rectangle in Histogram

---

## 📌 Key Patterns & Techniques

### 1. **Merge Pattern**
- Sort by start time
- Merge when overlapping
- Update end to max of current and next

### 2. **Sweep Line Pattern**
- Create events for start/end
- Process in order
- Track active intervals/height/count

### 3. **Greedy Interval Selection**
- Sort by end time
- Pick interval, skip overlapping
- Maximizes non-overlapping count

### 4. **Comparison for Overlaps**
- a.end >= b.start (inclusive end)
- a.end > b.start (exclusive end)
- Depends on problem definition

---

## 🎯 Common Pitfalls to Avoid

- ❌ Wrong overlap condition
- ❌ Not handling edge cases (touching intervals)
- ❌ Forgetting to sort
- ❌ Incorrect comparison for interval sorting
- ❌ Off-by-one in merge condition
- ❌ Not considering inclusive vs exclusive ends
