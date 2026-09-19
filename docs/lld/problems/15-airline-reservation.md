# Airline Reservation

## Problem Statement

Design an airline reservation system like Sabre, Amadeus, or the booking engines behind IndiGo, Delta, or Emirates. The system sells seats on **multi-leg flights**, manages **fare classes** (Economy, Premium, Business, First) with distinct inventory, handles **PNRs** (Passenger Name Records), supports **one-way / round-trip / multi-city** itineraries, and coordinates with **ancillaries** (baggage, meals, seat selection).

**Reused primitives (see reference files):**
- Seat map & booking holds: `11-movie-ticket-booking.md` §3-6 (state machine, atomic hold)
- Multi-leg itinerary + state machine: `13-food-delivery-order.md` §4 (state machine with many states)
- Pricing strategies: `11-movie-ticket-booking.md` §6.7 and `06-hotel-management.md` §6.5
- Payment: `03-atm.md` §6.7 (authorize/capture/refund)

**New concepts unique to this problem:**
1. **Multi-leg itineraries** — a single booking spans multiple flights, possibly with layovers
2. **Fare classes & inventory** — Economy/Premium/Business/First, each with its own seat count and rules (RBDs — Reservation Booking Designators)
3. **PNR** — one record per booking, containing all passengers and segments
4. **Passenger types** — Adult, Child, Infant with different pricing
5. **Fare rules** — change fees, cancellation windows, refundability (class-dependent)
6. **Seat selection as ancillary** — not all fares include seat selection
7. **Overbooking** — airlines intentionally overbook (10% typical)
8. **Ticketing deadline** — a hold is only valid until `ticketTimeLimit` (TTL), usually 24h
9. **Schedule changes** — airline changes flight time; system must re-accommodate
10. **Multi-passenger atomic booking** — all-or-nothing across passengers and segments

---

## 1. Requirements

### Functional

- **Search flights**: origin, destination, date, cabin class, passengers
- **Multi-leg results**: direct + 1-2 stop itineraries
- **Fare classes**: Economy / Premium / Business / First with distinct rules
- **Book itinerary**: multi-segment, multi-passenger
- **PNR**: single reference for the whole booking
- **Hold + ticket**: hold seats with a Ticket Time Limit (TTL); ticket later (or pay)
- **Seat selection**: per-segment, per-passenger (ancillary)
- **Ancillaries**: baggage, meals, priority boarding
- **Change booking**: modify date/flight (subject to fare rules)
- **Cancel booking**: refund per fare rules
- **Check-in**: 24h before departure; assign seats if not selected
- **Schedule change**: airline changes flight; notify passengers; re-accommodate or refund

### Non-Functional

- **Scale**: 100K bookings/day; peak 5x
- **Latency**: search < 2 s; booking < 3 s
- **Thread-safe**: concurrent bookings on last seat of a class
- **Idempotent**: booking retries safe (idempotency key)
- **Consistent**: inventory decremented exactly once per confirmed booking
- **Auditable**: full booking history
- **Extensible**: new fare classes, ancillaries, loyalty programs

### Out of Scope

- Loyalty / miles accrual (mentioned in extensions)
- Real-time pricing (yield management) — assume price per (flight, class)
- Visa / passport checks
- Interline / codeshare
- Crew scheduling
- Aircraft maintenance

---

## 2. Use Cases (brief)

| # | Use Case | Actor |
|---|---|---|
| UC1 | Search flights (origin, dest, date, cabin) | Passenger |
| UC2 | Select itinerary | Passenger |
| UC3 | Add passenger details | Passenger |
| UC4 | Select seats (optional) | Passenger |
| UC5 | Add ancillaries (baggage, meals) | Passenger |
| UC6 | Confirm booking → PNR + hold | System |
| UC7 | Ticket / pay within TTL | Passenger |
| UC8 | Cancel booking | Passenger |
| UC9 | Change booking (re-book) | Passenger |
| UC10 | Check-in | Passenger |
| UC11 | Airline changes schedule | Airline |
| UC12 | Auto-release un-ticketed holds | Scheduler |

---

## 3. Core Entities (delta)

**New entities:**

| Entity | Responsibility |
|---|---|
| `Flight` | One physical flight (number, route, aircraft, departure/arrival times) |
| `FlightInstance` | A specific date's flight (same `Flight` on a particular day) |
| `Segment` | One leg in an itinerary (flightInstance + cabin + fare class) |
| `Itinerary` | Ordered list of segments (multi-leg) |
| `FareClass` | Economy / Premium / Business / First with rules (RBD) |
| `FareInventory` | Seat count + availability per (flightInstance, fareClass) |
| `Fare` | Price + rules (changeable? refundable? baggage) per segment |
| `Passenger` | Person travelling (Adult / Child / Infant) |
| `PNR` | Booking record: reference + passengers + segments + ancillaries |
| `SeatAssignment` | Per-passenger, per-segment seat |
| `Ancillary` | Baggage, meal, priority boarding |
| `FareRule` | Change fees, cancellation windows, refundability |
| `TicketTimeLimit` | Deadline to ticket a held booking |

**Enums:**

| Enum | Values |
|---|---|
| `CabinClass` | ECONOMY, PREMIUM, BUSINESS, FIRST |
| `PassengerType` | ADULT, CHILD, INFANT |
| `PNRStatus` | HELD, TICKETED, CANCELLED, CHECKED_IN, COMPLETED |
| `SegmentStatus` | CONFIRMED, WAITLISTED, CANCELLED |
| `AncillaryType` | BAGGAGE, MEAL, SEAT, PRIORITY_BOARDING |

**Entities reused from references:**
- `Money`, `Payment` — see `03-atm.md` §6.1, §6.7
- `PricingStrategy` — see `11-movie-ticket-booking.md` §6.7
- `RefundPolicy` — see `11-movie-ticket-booking.md` §6.9
- `Seat`/`ShowSeat` — pattern adapted to `SeatAssignment` per passenger

---

## 4. What's New — the Four Hard Parts

### 4.1 Multi-leg Itineraries

A single booking covers N segments (legs). Each segment is an independent flight instance, but the whole itinerary succeeds or fails as a unit.

**Key concepts:**
- **Connection time**: minimum layover (MCT — Minimum Connecting Time) between segments
- **Through-fare**: a single price for the itinerary, not sum of segments
- **Through baggage**: bags tagged to final destination
- **Segment dependencies**: if leg 1 is delayed, leg 2 must be re-accommodated

**Itinerary model:**

```java
public record Itinerary(java.util.List<Segment> segments) {
    public Itinerary {
        if (segments == null || segments.isEmpty()) throw new IllegalArgumentException("Segments required");
    }

    public java.time.ZonedDateTime departure() { return segments.get(0).flightInstance().departure(); }
    public java.time.ZonedDateTime arrival() { return segments.get(segments.size() - 1).flightInstance().arrival(); }
    public int stops() { return segments.size() - 1; }
    public java.time.Duration totalDuration() {
        return java.time.Duration.between(departure().toInstant(), arrival().toInstant());
    }

    /** Check MCT between consecutive segments. */
    public boolean isValidConnection(java.time.Duration minConnection) {
        for (int i = 0; i < segments.size() - 1; i++) {
            java.time.ZonedDateTime arrive = segments.get(i).flightInstance().arrival();
            java.time.ZonedDateTime depart = segments.get(i + 1).flightInstance().departure();
            if (java.time.Duration.between(arrive.toInstant(), depart.toInstant()).compareTo(minConnection) < 0) {
                return false;
            }
        }
        return true;
    }
}
```

**Search across legs:**

Search is a **graph search** across flight instances:
- Nodes: `(airport, time)` — one per arrival/departure event
- Edges: either a flight segment (with duration + price) or a connection (with MCT + transfer time)
- Find k-shortest paths from origin to destination (k = 5-10 for UI)

For LLD, we can implement a simplified BFS/DFS with pruning rather than full k-shortest paths.

### 4.2 Fare Classes & Inventory (RBDs)

Each flight has inventory per **Reservation Booking Designator (RBD)** — a letter code (Y = full-fare economy, B/M/K = discounted economy, J/C = business, F/A = first).

**Model:**

```java
public enum CabinClass { ECONOMY, PREMIUM, BUSINESS, FIRST }

public final class FareClass {
    private final String rbd;               // e.g., "Y", "B", "M", "J", "F"
    private final CabinClass cabin;
    private final Money basePrice;
    private final FareRule rule;
    private final int baggageAllowanceKg;

    public FareClass(String rbd, CabinClass cabin, Money basePrice,
                     FareRule rule, int baggageAllowanceKg) {
        this.rbd = rbd;
        this.cabin = cabin;
        this.basePrice = basePrice;
        this.rule = rule;
        this.baggageAllowanceKg = baggageAllowanceKg;
    }

    public String rbd() { return rbd; }
    public CabinClass cabin() { return cabin; }
    public Money basePrice() { return basePrice; }
    public FareRule rule() { return rule; }
    public int baggageAllowanceKg() { return baggageAllowanceKg; }
}
```

```java
public final class FareInventory {
    private final String flightInstanceId;
    private final String rbd;
    private final java.util.concurrent.atomic.AtomicInteger availableSeats;
    private final int authorizedSeats;       // total capacity for this RBD

    public FareInventory(String flightInstanceId, String rbd, int authorizedSeats) {
        this.flightInstanceId = flightInstanceId;
        this.rbd = rbd;
        this.availableSeats = new java.util.concurrent.atomic.AtomicInteger(authorizedSeats);
        this.authorizedSeats = authorizedSeats;
    }

    public int available() { return availableSeats.get(); }

    /** Atomically try to decrement. Returns true on success. */
    public boolean tryDecrement() {
        while (true) {
            int current = availableSeats.get();
            if (current <= 0) return false;
            if (availableSeats.compareAndSet(current, current - 1)) return true;
        }
    }

    public void increment() { availableSeats.incrementAndGet(); }
}
```

**CAS-based decrement** — same pattern as `ShowSeat` in Movie Booking. For multi-seat (multi-passenger) bookings, we need atomicity across **all** decrements — see §4.4.

### 4.3 PNR (Passenger Name Record)

A PNR is the booking record: unique 6-char reference (e.g., `K7X9P2`), passengers, segments, ancillaries, ticket info.

**Model:**

```java
public final class PNR {
    private final String reference;              // 6-char alphanumeric
    private final java.util.List<Passenger> passengers;
    private final Itinerary itinerary;
    private final Money totalPrice;
    private final java.time.Instant createdAt;
    private final java.time.Instant ticketTimeLimit;
    private final java.util.concurrent.locks.ReentrantLock lock = new java.util.concurrent.locks.ReentrantLock();

    private PNRStatus status;
    private java.util.List<Ancillary> ancillaries = new java.util.ArrayList<>();
    private java.util.List<SeatAssignment> seats = new java.util.ArrayList<>();

    public PNR(String reference, java.util.List<Passenger> passengers, Itinerary itinerary,
               Money totalPrice, java.time.Instant createdAt, java.time.Instant ticketTimeLimit) {
        this.reference = reference;
        this.passengers = java.util.List.copyOf(passengers);
        this.itinerary = itinerary;
        this.totalPrice = totalPrice;
        this.createdAt = createdAt;
        this.ticketTimeLimit = ticketTimeLimit;
        this.status = PNRStatus.HELD;
    }

    public String reference() { return reference; }
    public java.util.List<Passenger> passengers() { return passengers; }
    public Itinerary itinerary() { return itinerary; }
    public Money totalPrice() { return totalPrice; }
    public java.time.Instant ticketTimeLimit() { return ticketTimeLimit; }
    public PNRStatus status() { lock.lock(); try { return status; } finally { lock.unlock(); } }
    public java.util.List<Ancillary> ancillaries() { lock.lock(); try { return java.util.List.copyOf(ancillaries); } finally { lock.unlock(); } }
    public java.util.List<SeatAssignment> seats() { lock.lock(); try { return java.util.List.copyOf(seats); } finally { lock.unlock(); } }

    public void addAncillary(Ancillary a) { lock.lock(); try { ancillaries.add(a); } finally { lock.unlock(); } }
    public void addSeat(SeatAssignment s) { lock.lock(); try { seats.add(s); } finally { lock.unlock(); } }

    public void ticket() {
        lock.lock();
        try {
            if (status != PNRStatus.HELD) throw new IllegalStateException("Cannot ticket: " + status);
            status = PNRStatus.TICKETED;
        } finally { lock.unlock(); }
    }

    public void cancel() {
        lock.lock();
        try {
            if (status == PNRStatus.COMPLETED) throw new IllegalStateException("Completed");
            status = PNRStatus.CANCELLED;
        } finally { lock.unlock(); }
    }

    public boolean isExpired(java.time.Instant now) {
        return status == PNRStatus.HELD && now.isAfter(ticketTimeLimit);
    }
}
```

### 4.4 Multi-Passenger + Multi-Segment Atomic Booking

Booking N passengers on M segments means decrementing N × M inventory cells **atomically** — either all succeed or none.

**Approach: two-phase commit with rollback.**

```java
public final class InventoryReserver {

    /**
     * Try to reserve `count` seats in each of the given inventories.
     * Returns true iff all reservations succeed; otherwise rolls back.
     */
    public boolean tryReserveAll(java.util.List<FareInventory> inventories, int count) {
        java.util.List<FareInventory> reserved = new java.util.ArrayList<>();
        for (FareInventory inv : inventories) {
            boolean ok = reserveN(inv, count);
            if (!ok) {
                // Rollback
                for (FareInventory r : reserved) releaseN(r, count);
                return false;
            }
            reserved.add(inv);
        }
        return true;
    }

    private boolean reserveN(FareInventory inv, int n) {
        for (int i = 0; i < n; i++) {
            if (!inv.tryDecrement()) {
                // Partial success in this inv — release what we took
                for (int j = 0; j < i; j++) inv.increment();
                return false;
            }
        }
        return true;
    }

    private void releaseN(FareInventory inv, int n) {
        for (int i = 0; i < n; i++) inv.increment();
    }
}
```

**Why rollback:** `AtomicInteger.decrementAndGet` per cell isn't atomic across cells. The two-phase approach gives us atomicity (all-or-nothing) at the cost of brief temporary reservation of some cells.

**Alternative: single lock per flightInstance** — simpler but less concurrent. For high-traffic flights, CAS with rollback is preferred.

### 4.5 Ancillaries, Fare Rules, and TTL

**Fare rules** dictate change/cancel policy:

```java
public record FareRule(
        boolean refundable,
        Money changeFee,
        boolean changeable,
        int changeWindowHours,       // must change >= N hours before departure
        int cancelWindowHours,       // must cancel >= N hours before departure
        boolean seatSelectionIncluded
) {}
```

**Ancillaries** — per-passenger, per-segment:

```java
public record Ancillary(
        AncillaryType type,
        String passengerId,
        String segmentId,
        Money price,
        String details          // e.g., "20 kg baggage", "Vegetarian meal"
) {}
```

**Seat assignments:**

```java
public record SeatAssignment(
        String passengerId,
        String segmentId,
        String seatNumber       // e.g., "12A"
) {}
```

**Ticket Time Limit (TTL):**

- On booking, PNR created with `status = HELD` and `ticketTimeLimit = now + 24h` (or shorter for high-demand fares).
- Scheduler sweeps expired holds and releases inventory.
- On ticket (payment), PNR → `TICKETED`; inventory stays decremented.

```java
public void autoReleaseExpired(java.time.Instant now) {
    for (PNR pnr : allPnrs.values()) {
        if (pnr.isExpired(now)) {
            releaseInventory(pnr);
            pnr.cancel();
        }
    }
}
```

---

## 5. Class Diagram (delta)

```plantuml
@startuml
!theme cerulean-outline
skinparam backgroundColor white
skinparam shadowing false
skinparam classAttributeIconSize 0
left to right direction
skinparam nodesep 20
skinparam ranksep 30

enum CabinClass { ECONOMY PREMIUM BUSINESS FIRST }
enum PassengerType { ADULT CHILD INFANT }
enum PNRStatus { HELD TICKETED CANCELLED CHECKED_IN COMPLETED }
enum SegmentStatus { CONFIRMED WAITLISTED CANCELLED }
enum AncillaryType { BAGGAGE MEAL SEAT PRIORITY_BOARDING }

class Flight {
  - String id
  - String flightNumber
  - String origin
  - String destination
  + String id()
}

class FlightInstance {
  - String id
  - String flightId
  - LocalDate date
  - ZonedDateTime departure
  - ZonedDateTime arrival
  + String id()
  + ZonedDateTime departure()
  + ZonedDateTime arrival()
}

class FareClass {
  - String rbd
  - CabinClass cabin
  - Money basePrice
  - FareRule rule
  - int baggageAllowanceKg
}

class FareRule {
  - boolean refundable
  - Money changeFee
  - boolean changeable
  - int changeWindowHours
  - int cancelWindowHours
  - boolean seatSelectionIncluded
}

class FareInventory {
  - String flightInstanceId
  - String rbd
  - AtomicInteger availableSeats
  + int available()
  + boolean tryDecrement()
  + void increment()
}

class Segment {
  - String id
  - FlightInstance flightInstance
  - FareClass fareClass
  - SegmentStatus status
}

class Itinerary {
  - List<Segment> segments
  + ZonedDateTime departure()
  + ZonedDateTime arrival()
  + int stops()
}

class Passenger {
  - String id
  - String name
  - PassengerType type
  - LocalDate dateOfBirth
}

class PNR {
  - String reference
  - List<Passenger> passengers
  - Itinerary itinerary
  - Money totalPrice
  - Instant ticketTimeLimit
  - PNRStatus status
  - List<Ancillary> ancillaries
  - List<SeatAssignment> seats
  + void ticket()
  + void cancel()
  + boolean isExpired(Instant now)
}

class Ancillary {
  - AncillaryType type
  - String passengerId
  - String segmentId
  - Money price
  - String details
}

class SeatAssignment {
  - String passengerId
  - String segmentId
  - String seatNumber
}

class InventoryReserver {
  + boolean tryReserveAll(List<FareInventory> invs, int count)
}

class AirlineReservationService {
  - Map<String, FlightInstance> instances
  - Map<String, FareInventory> inventories
  - Map<String, PNR> pnrs
  - Map<String, String> pnrsByKey
  - InventoryReserver reserver
  - Clock clock
  + List<Itinerary> search(String origin, String dest, LocalDate date, CabinClass cabin, int pax)
  + PNR book(Itinerary itinerary, List<Passenger> passengers, String idempotencyKey)
  + void ticket(String pnrRef, PaymentMethod method)
  + Money cancel(String pnrRef)
  + void autoReleaseExpired(Instant now)
}

AirlineReservationService --> InventoryReserver
AirlineReservationService *-- PNR
PNR *-- Passenger
PNR *-- Ancillary
PNR *-- SeatAssignment
PNR --> Itinerary
Itinerary *-- Segment
Segment --> FlightInstance
Segment --> FareClass
FareClass *-- FareRule
FareInventory -- FlightInstance
@enduml
```

---

## 6. Java Implementation (new parts only)

### 6.1 Flight & FlightInstance

```java
public record Flight(String id, String flightNumber, String origin, String destination) {}
```

```java
public record FlightInstance(String id, String flightId, java.time.LocalDate date,
                             java.time.ZonedDateTime departure,
                             java.time.ZonedDateTime arrival) {

    public FlightInstance {
        if (departure == null || arrival == null) throw new IllegalArgumentException("Times required");
        if (!arrival.toInstant().isAfter(departure.toInstant())) {
            throw new IllegalArgumentException("Arrival must be after departure");
        }
    }
}
```

### 6.2 FareClass, FareRule

```java
public record FareRule(
        boolean refundable,
        Money changeFee,
        boolean changeable,
        int changeWindowHours,
        int cancelWindowHours,
        boolean seatSelectionIncluded) {}
```

```java
public final class FareClass {
    private final String rbd;
    private final CabinClass cabin;
    private final Money basePrice;
    private final FareRule rule;
    private final int baggageAllowanceKg;

    public FareClass(String rbd, CabinClass cabin, Money basePrice,
                     FareRule rule, int baggageAllowanceKg) {
        this.rbd = rbd;
        this.cabin = cabin;
        this.basePrice = basePrice;
        this.rule = rule;
        this.baggageAllowanceKg = baggageAllowanceKg;
    }

    public String rbd() { return rbd; }
    public CabinClass cabin() { return cabin; }
    public Money basePrice() { return basePrice; }
    public FareRule rule() { return rule; }
    public int baggageAllowanceKg() { return baggageAllowanceKg; }
}
```

### 6.3 Passenger

```java
public record Passenger(String id, String name, PassengerType type, java.time.LocalDate dateOfBirth) {}
```

### 6.4 AirlineReservationService

```java
public final class AirlineReservationService {

    public static final java.time.Duration DEFAULT_TTL = java.time.Duration.ofHours(24);
    public static final java.time.Duration DEFAULT_MCT = java.time.Duration.ofMinutes(60);

    private final java.util.Map<String, FlightInstance> instances = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<String, FareClass> fareClasses = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<String, FareInventory> inventories = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<String, PNR> pnrs = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<String, String> pnrsByKey = new java.util.concurrent.ConcurrentHashMap<>();

    private final InventoryReserver reserver;
    private final java.time.Clock clock;

    public AirlineReservationService(InventoryReserver reserver, java.time.Clock clock) {
        this.reserver = reserver;
        this.clock = clock;
    }

    // ----- Registration -----

    public void registerFlightInstance(FlightInstance instance, java.util.Map<String, Integer> capacityByRbd) {
        instances.put(instance.id(), instance);
        for (var entry : capacityByRbd.entrySet()) {
            String key = inventoryKey(instance.id(), entry.getKey());
            inventories.put(key, new FareInventory(instance.id(), entry.getKey(), entry.getValue()));
        }
    }

    public void registerFareClass(FareClass fc) { fareClasses.put(fc.rbd(), fc); }

    // ----- Search -----

    /** Simplified: direct + 1-stop search over a set of instances. */
    public java.util.List<Itinerary> search(String origin, String destination,
                                            java.time.LocalDate date, CabinClass cabin, int pax) {
        java.util.List<Itinerary> results = new java.util.ArrayList<>();

        // Direct flights
        for (FlightInstance f : instances.values()) {
            if (!f.date().equals(date)) continue;
            Flight fl = null; // In production: lookup Flight by f.flightId()
            // For demo, assume FlightInstance carries route info via flightId lookup
            // (skipped — see full HLD for details)
        }

        // Simplified: return empty (search is complex; see HLD "Maps & Routing" for graph search)
        return results;
    }

    // ----- Book -----

    public PNR book(Itinerary itinerary, java.util.List<Passenger> passengers, String idempotencyKey) {
        if (!itinerary.isValidConnection(DEFAULT_MCT)) {
            throw new IllegalStateException("Invalid connection time between segments");
        }

        String existingRef = pnrsByKey.get(idempotencyKey);
        if (existingRef != null) return pnrs.get(existingRef);

        // Collect all inventories to reserve
        java.util.List<FareInventory> toReserve = new java.util.ArrayList<>();
        for (Segment s : itinerary.segments()) {
            String key = inventoryKey(s.flightInstance().id(), s.fareClass().rbd());
            FareInventory inv = inventories.get(key);
            if (inv == null) throw new IllegalStateException("No inventory for " + key);
            toReserve.add(inv);
        }

        // Atomically reserve N seats in each
        int pax = passengers.size();
        boolean reserved = reserver.tryReserveAll(toReserve, pax);
        if (!reserved) throw new IllegalStateException("Not enough seats for " + pax + " passengers");

        // Compute total price
        Money total = Money.zero();
        for (Segment s : itinerary.segments()) {
            Money segPrice = s.fareClass().basePrice();
            for (Passenger p : passengers) {
                double factor = priceFactor(p.type());
                total = total.plus(segPrice.multiply(factor));
            }
        }

        // Create PNR
        String reference = generatePnrReference();
        java.time.Instant now = java.time.Instant.now(clock);
        PNR pnr = new PNR(reference, passengers, itinerary, total, now, now.plus(DEFAULT_TTL));
        pnrs.put(reference, pnr);
        pnrsByKey.put(idempotencyKey, reference);
        return pnr;
    }

    // ----- Ticket -----

    public void ticket(String pnrRef) {
        PNR pnr = requirePnr(pnrRef);
        pnr.ticket();
    }

    // ----- Cancel -----

    public Money cancel(String pnrRef) {
        PNR pnr = requirePnr(pnrRef);

        // Check if all segments are refundable
        for (Segment s : pnr.itinerary().segments()) {
            if (!s.fareClass().rule().refundable()) {
                throw new IllegalStateException("Non-refundable fare: " + s.fareClass().rbd());
            }
            java.time.ZonedDateTime dep = s.flightInstance().departure();
            java.time.Instant cancelDeadline = dep.toInstant()
                    .minus(java.time.Duration.ofHours(s.fareClass().rule().cancelWindowHours()));
            if (java.time.Instant.now(clock).isAfter(cancelDeadline)) {
                throw new IllegalStateException("Cancellation window closed for " + s.fareClass().rbd());
            }
        }

        // Release inventory
        releaseInventory(pnr);
        pnr.cancel();

        return pnr.totalPrice();   // assume full refund for demo
    }

    // ----- Auto-release expired holds -----

    public void autoReleaseExpired(java.time.Instant now) {
        for (PNR pnr : pnrs.values()) {
            if (pnr.isExpired(now)) {
                releaseInventory(pnr);
                pnr.cancel();
            }
        }
    }

    // ----- Helpers -----

    private void releaseInventory(PNR pnr) {
        int pax = pnr.passengers().size();
        for (Segment s : pnr.itinerary().segments()) {
            String key = inventoryKey(s.flightInstance().id(), s.fareClass().rbd());
            FareInventory inv = inventories.get(key);
            if (inv != null) {
                for (int i = 0; i < pax; i++) inv.increment();
            }
        }
    }

    private String inventoryKey(String flightInstanceId, String rbd) {
        return flightInstanceId + ":" + rbd;
    }

    private double priceFactor(PassengerType type) {
        return switch (type) {
            case ADULT -> 1.0;
            case CHILD -> 0.75;
            case INFANT -> 0.10;
        };
    }

    private String generatePnrReference() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no I/O/0/1
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(java.util.concurrent.ThreadLocalRandom.current().nextInt(chars.length())));
        }
        return sb.toString();
    }

    private PNR requirePnr(String ref) {
        PNR p = pnrs.get(ref);
        if (p == null) throw new IllegalArgumentException("Unknown PNR: " + ref);
        return p;
    }
}
```

### 6.5 Demo

```java
public class Demo {
    public static void main(String[] args) {
        AirlineReservationService service = new AirlineReservationService(
                new InventoryReserver(), java.time.Clock.systemUTC());

        FlightInstance inst = new FlightInstance(
                "FI-1", "F-IND-001", java.time.LocalDate.of(2026, 3, 15),
                java.time.ZonedDateTime.parse("2026-03-15T08:00:00+05:30[Asia/Kolkata]"),
                java.time.ZonedDateTime.parse("2026-03-15T11:00:00+05:30[Asia/Kolkata]"));
        service.registerFlightInstance(inst, java.util.Map.of("Y", 20, "M", 50, "J", 10));

        FareRule rule = new FareRule(true, Money.usd(50), true, 24, 4, true);
        service.registerFareClass(new FareClass("M", CabinClass.ECONOMY, Money.usd(150), rule, 15));

        // Build a one-segment itinerary
        Segment seg = new Segment("S1", inst,
                new FareClass("M", CabinClass.ECONOMY, Money.usd(150), rule, 15),
                SegmentStatus.CONFIRMED);
        Itinerary itinerary = new Itinerary(java.util.List.of(seg));

        java.util.List<Passenger> passengers = java.util.List.of(
                new Passenger("P1", "Alice", PassengerType.ADULT, java.time.LocalDate.of(1990, 1, 1)),
                new Passenger("P2", "Timmy", PassengerType.CHILD, java.time.LocalDate.of(2018, 1, 1))
        );

        PNR pnr = service.book(itinerary, passengers, "key-book-1");
        System.out.println("PNR: " + pnr.reference() + " total: $" + pnr.totalPrice().amount()
                + " status: " + pnr.status());

        service.ticket(pnr.reference());
        System.out.println("After ticket: " + pnr.status());
    }
}
```

---

## 7. Concurrency Considerations

Reused from `11-movie-ticket-booking.md` §7:
- Atomic inventory decrement via CAS
- Idempotency key for book
- Guarded status transitions on PNR

**New to Airline Reservation:**

- **Multi-cell atomic reservation** — `InventoryReserver.tryReserveAll` uses two-phase commit with rollback. This is the key new concern.
- **PNR status transitions** — locked with `ReentrantLock` on `PNR`.
- **Concurrent ticket + cancel** — both go through `PNR.lock`; only one wins.
- **Auto-release scheduler** — one thread; iterates `pnrs` (ConcurrentHashMap); each release is idempotent.
- **Cross-segment lock ordering** — sort segments by `flightInstanceId` before reserving, to avoid deadlock.
- **PNR reference uniqueness** — random 6-char from a 32-char alphabet = ~1.07B combinations. Collision rate is low; use `putIfAbsent` with retry.

---

## 8. Extensibility

| Feature | Change |
|---|---|
| Loyalty / miles | Add `LoyaltyAccount` + accrue on ticket; redeem on book |
| Dynamic pricing | `PricingStrategy` per (flight, RBD, time-to-departure) |
| Waitlist | Add `SegmentStatus.WAITLISTED`; promote on cancel |
| Codeshare | `Flight.operatingCarrier` + marketing carrier |
| Interline | Multi-PNR bookings across airlines |
| Ancillaries marketplace | Add `AncillaryProvider` interface |
| Group booking (10+ pax) | Add `GroupBookingService` with its own pricing |
| Multi-currency | `Money` already supports it; `FareClass.basePrice` in any currency |

---

## 9. Common Pitfalls

| Pitfall | Fix |
|---|---|
| Non-atomic multi-passenger reserve | Two-phase commit with rollback |
| Assuming PNR reference is unique without check | `putIfAbsent` with retry |
| Forgetting `MIN_CONNECT_TIME` | Validate `Itinerary.isValidConnection` before booking |
| Cancelling non-refundable fare | Check `FareRule.refundable` and window |
| Leaving inventory reserved on hold expiry | Scheduler auto-releases; tick PNR.cancel |
| Not handling passenger type pricing | `priceFactor` per `PassengerType` |
| Time zone mixups on cross-zone flights | Use `ZonedDateTime`; store in UTC on compare |
| Missing TTL | Every PNR has `ticketTimeLimit` |
| Race on last seat | CAS-based decrement per RBD |
| Partial reservation without rollback | Two-phase reserve; release on failure |

---

## 10. Follow-ups

### Q1: How do you handle overbooking?

**Answer:** Set `authorizedSeats > actual capacity` per RBD. Airlines overbook Economy by ~10%. When more passengers check in than seats, offer incentives for volunteers to take a later flight. Track `deniedBoarding` events for compensation and analytics.

### Q2: How do you handle schedule changes (flight time changed by airline)?

**Answer:** 
1. Airline updates `FlightInstance.departure/arrival`.
2. System scans all PNRs containing that instance.
3. For each, evaluate new connection times; if MCT violated, attempt re-accommodation.
4. If no alternative, offer refund or rebooking on partner airlines.
5. Notify passengers via email/SMS.

### Q3: How do you handle a passenger no-show?

**Answer:** At departure time, unclaimed seats remain empty. No refund for no-show (unless fare allows). For return legs, no-show may invalidate remaining segments (no-show → subsequent segments cancelled automatically). Track for revenue management.

### Q4: How do you test multi-leg atomic booking?

**Answer:** 
- Setup 3-segment itinerary where segment 3 has only 1 seat but 2 passengers.
- Booking should fail; assert segments 1 and 2 inventory unchanged.
- Repeat with concurrent threads to catch rollback bugs.

### Q5: How do you support k-shortest path search across multi-leg?

**Answer:** Use Yen's algorithm or a modified Dijkstra with a priority queue of itineraries. For LLD, a BFS with a max-stops parameter (0, 1, 2) and pruning by total duration + price is sufficient. The full algorithm is a HLD concern (see `57-maps-routing.md` for graph search).

---

## 11. Similar Problems

- **Movie Ticket Booking** (`11-movie-ticket-booking.md`) — seat hold + state machine; single-leg
- **Food Delivery** (`13-food-delivery-order.md`) — multi-leg (pickup + dropoff), rich state machine
- **Hotel Management** (`06-hotel-management.md`) — date-range booking; no multi-leg
- **Travel Booking (HLD #44)** — broader: hotels + flights + cars

Airline Reservation's unique additions: **multi-leg itinerary**, **RBD inventory**, **PNR**, **passenger types**, **TTL**, **fare rules**.

---

## 12. Key Takeaways

- **PNR is the booking record** — one reference, many passengers, many segments
- **Fare classes (RBDs)** partition inventory; each has its own rules and price
- **Multi-leg itinerary** — atomic booking across all segments
- **Two-phase commit for multi-cell inventory** — reserve all, or rollback
- **CAS-based decrement** per `FareInventory` — lock-free, fast
- **Ticket Time Limit** — held PNR expires; scheduler releases inventory
- **Idempotency key** — safe booking retries
- **Passenger types** — Adult / Child / Infant with price factors
- **Fare rules** — refundable, changeable, windows; check before cancel/change
- **MCT (minimum connecting time)** — validate between segments
- **PNR reference** — 6-char from collision-resistant alphabet; `putIfAbsent`
- **Cancellation** — check rules, release inventory, refund
- **Auto-release** — scheduler sweeps expired holds
- **Multi-segment lock order** — sort by `flightInstanceId` to avoid deadlock

### The Delta Recipe

For any **multi-leg booking with fare-class inventory** problem:

1. **Multi-segment itinerary** — atomic across segments
2. **Fare-class inventory** — separate counts per class, CAS-based decrement
3. **Two-phase commit** — reserve all, rollback on any failure
4. **PNR / booking record** — single reference for whole booking
5. **Passenger types** — pricing factors
6. **TTL / hold deadline** — auto-release on expiry
7. **Fare rules** — refundable, changeable, windows
8. **MCT / connection validation** — between segments
9. **Ancillaries** — per-passenger, per-segment
10. **Idempotency key** — safe retries
11. **Scheduler** — auto-release; schedule-change handling

This delta plus the seat-booking skeleton from #11 and the multi-leg state machine from #13 solves: Airline Reservation, Train Booking, Bus Booking, Cruise Booking, Package Travel — with variations in number of legs, fare classes, and ancillary options.