# Shopping Cart

## Problem Statement

Design a shopping cart and checkout system for an e-commerce platform like Amazon, Flipkart, or Shopify. Users browse a catalog, add items to a cart, apply coupons and promotions, compute taxes and shipping, and place orders with payment. The system must handle **inventory reservation**, **price snapshots**, **promotion stacking rules**, **tax calculation per region**, and **idempotent order placement**.

**Reused primitives (see reference files):**
- Money arithmetic: `03-atm.md` §6.1 (`Money` with `BigDecimal`)
- Order lifecycle + state machine: `13-food-delivery-order.md` §4 (order states)
- Idempotency + payment authorize/capture: `15-airline-reservation.md` §4.4, §6.4
- Inventory atomic reservation: `11-movie-ticket-booking.md` §6.6
- Refund policy: `11-movie-ticket-booking.md` §6.9

**New concepts unique to this problem:**
1. **Cart vs Order** — cart is mutable pre-purchase; order is an immutable snapshot
2. **Price snapshot** — the price at add-to-cart vs at checkout; handling price changes
3. **Promotion engine** — coupons + automatic discounts + stacking rules + conflicts
4. **Tax calculation** — per-region (state/country), per-item-category
5. **Shipping calculation** — by weight, by seller, by delivery speed
6. **Inventory reservation on cart** — soft hold vs hard hold at order
7. **Multi-seller split** — one cart with items from multiple sellers → multiple orders
8. **Cart abandonment** — merging carts when user logs in; expiry of stale carts

---

## 1. Requirements

### Functional

- **Browse catalog**: list of products (with variants: size, color)
- **Cart**: add/remove/update quantity; multiple items per seller; multiple sellers
- **Cart persistence**: saved per user; guest carts merge on login
- **Price display**: line subtotal + running total
- **Promotions**: coupon codes + automatic discounts
- **Shipping estimate**: by destination and delivery speed
- **Tax estimate**: by destination (state) and product category
- **Checkout**: convert cart to order(s)
- **Inventory**: soft-check at add; hard-reserve at checkout
- **Payment**: authorize at checkout; capture at shipping
- **Order split**: multi-seller cart → separate orders per seller

### Non-Functional

- **Thread-safe**: concurrent cart mutations by same user (multiple tabs)
- **Idempotent**: checkout retries safe
- **Consistent**: totals always sum correctly (line items → subtotal → tax → shipping → discount → total)
- **Extensible**: new promotion types, tax rules, shipping methods
- **Snapshot-correct**: prices captured at order; later catalog changes don't affect orders
- **Low latency**: cart ops < 100 ms; checkout < 3 s

### Out of Scope

- Catalog management (admin)
- Search / recommendations
- Reviews / ratings
- Real payment gateway
- Fulfillment logistics (see Food Delivery / Cab Booking for delivery)
- Returns / refunds after shipping (separate service)

---

## 2. Use Cases (brief)

| # | Use Case | Actor |
|---|---|---|
| UC1 | Add item to cart | Customer |
| UC2 | Update quantity | Customer |
| UC3 | Remove item | Customer |
| UC4 | Apply coupon | Customer |
| UC5 | View cart totals | Customer |
| UC6 | Estimate shipping + tax | System |
| UC7 | Checkout (convert to order) | Customer |
| UC8 | Cancel before payment | Customer |
| UC9 | Merge guest cart on login | System |
| UC10 | Expire stale cart | System |

---

## 3. Core Entities (delta)

**New entities:**

| Entity | Responsibility |
|---|---|
| `Product` | A catalog item (id, name, category, base price) |
| `ProductVariant` | A specific SKU (size, color); price may differ |
| `Seller` | The merchant fulfilling an item |
| `Cart` | Mutable per-user pre-purchase state |
| `CartItem` | Line item with product, quantity, price snapshot |
| `Order` | Immutable post-checkout record |
| `OrderItem` | Order line with snapshot price + product info |
| `Coupon` | User-applied promo code |
| `Promotion` | Automatic discount (rule-based) |
| `AppliedDiscount` | A resolved discount with amount + reason |
| `Address` | Shipping destination (region for tax) |
| `ShippingQuote` | Cost + ETA per seller |
| `TaxQuote` | Tax amount per item category |

**Enums:**

| Enum | Values |
|---|---|
| `CartStatus` | ACTIVE, CHECKED_OUT, ABANDONED, MERGED |
| `OrderStatus` | PENDING, PAYMENT_AUTHORIZED, CONFIRMED, SHIPPED, DELIVERED, CANCELLED |
| `DiscountType` | PERCENTAGE, FLAT, BOGO, FREE_SHIPPING |
| `CouponStatus` | VALID, EXPIRED, USAGE_LIMIT_REACHED, NOT_APPLICABLE |
| `ShippingSpeed` | STANDARD, EXPRESS, SAME_DAY |

**Reused from references:**
- `Money` — `03-atm.md` §6.1
- `Order state machine` — `13-food-delivery-order.md` §4
- `Idempotency key` — `15-airline-reservation.md` §4.4
- `Inventory reservation` — `11-movie-ticket-booking.md` §6.6

---

## 4. What's New — the Four Hard Parts

### 4.1 Cart vs Order

**Cart** is mutable and tied to a user. **Order** is immutable and represents a purchase commitment.

**Key differences:**

| Aspect | Cart | Order |
|---|---|---|
| Mutability | Mutable (add/remove/update) | Immutable |
| Pricing | Live (recomputed on view) | Snapshot at checkout |
| Inventory | Soft-check | Hard-reserved |
| Payment | None | Authorized |
| Lifetime | Until checkout or expiry (30 days) | Permanent record |

**CartItem:**

```java
public final class CartItem {
    private final String itemId;            // unique per line (usually variantId)
    private final String variantId;
    private final String sellerId;
    private final String productName;       // for display
    private final Money unitPriceSnapshot;  // captured at add-to-cart
    private final java.time.Instant addedAt;
    private int quantity;
    private String couponApplied;           // optional, per-line coupon

    public CartItem(String itemId, String variantId, String sellerId,
                    String productName, Money unitPriceSnapshot, int quantity) {
        if (quantity <= 0) throw new IllegalArgumentException("Quantity must be positive");
        this.itemId = itemId;
        this.variantId = variantId;
        this.sellerId = sellerId;
        this.productName = productName;
        this.unitPriceSnapshot = unitPriceSnapshot;
        this.quantity = quantity;
        this.addedAt = java.time.Instant.now();
    }

    public String itemId() { return itemId; }
    public String variantId() { return variantId; }
    public String sellerId() { return sellerId; }
    public String productName() { return productName; }
    public Money unitPriceSnapshot() { return unitPriceSnapshot; }
    public int quantity() { return quantity; }
    public void setQuantity(int q) {
        if (q <= 0) throw new IllegalArgumentException("Quantity must be positive");
        this.quantity = q;
    }
    public Money lineTotal() { return unitPriceSnapshot.multiply(quantity); }
}
```

**Cart:**

```java
public final class Cart {
    private final String id;
    private final String userId;            // null for guest cart
    private final java.util.Map<String, CartItem> items = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.List<String> couponCodes = new java.util.concurrent.CopyOnWriteArrayList<>();
    private final java.util.concurrent.locks.ReentrantLock lock = new java.util.concurrent.locks.ReentrantLock();

    private CartStatus status;
    private String guestSessionId;          // if guest
    private java.time.Instant lastModified;

    public Cart(String id, String userId, String guestSessionId) {
        this.id = id;
        this.userId = userId;
        this.guestSessionId = guestSessionId;
        this.status = CartStatus.ACTIVE;
        this.lastModified = java.time.Instant.now();
    }

    public String id() { return id; }
    public String userId() { return userId; }
    public String guestSessionId() { return guestSessionId; }
    public CartStatus status() { lock.lock(); try { return status; } finally { lock.unlock(); } }
    public java.time.Instant lastModified() { lock.lock(); try { return lastModified; } finally { lock.unlock(); } }

    public void addItem(CartItem item) {
        lock.lock();
        try {
            CartItem existing = items.get(item.itemId());
            if (existing != null) {
                existing.setQuantity(existing.quantity() + item.quantity());
            } else {
                items.put(item.itemId(), item);
            }
            lastModified = java.time.Instant.now();
        } finally { lock.unlock(); }
    }

    public void removeItem(String itemId) {
        lock.lock();
        try {
            items.remove(itemId);
            lastModified = java.time.Instant.now();
        } finally { lock.unlock(); }
    }

    public void updateQuantity(String itemId, int quantity) {
        lock.lock();
        try {
            CartItem item = items.get(itemId);
            if (item == null) throw new IllegalArgumentException("Unknown item: " + itemId);
            item.setQuantity(quantity);
            lastModified = java.time.Instant.now();
        } finally { lock.unlock(); }
    }

    public java.util.List<CartItem> items() {
        return java.util.List.copyOf(items.values());
    }

    public void addCoupon(String code) {
        lock.lock();
        try {
            if (!couponCodes.contains(code)) couponCodes.add(code);
            lastModified = java.time.Instant.now();
        } finally { lock.unlock(); }
    }

    public java.util.List<String> couponCodes() {
        return java.util.List.copyOf(couponCodes);
    }

    public void clear() {
        lock.lock();
        try {
            items.clear();
            couponCodes.clear();
            lastModified = java.time.Instant.now();
        } finally { lock.unlock(); }
    }
}
```

### 4.2 Promotion Engine

Promotions are **rules** that produce **discounts** applied to a cart. Two kinds:

- **Coupon codes** — user-entered codes (e.g., "SAVE20")
- **Automatic promotions** — applied when conditions match (e.g., "20% off electronics")

**Model:**

```java
public interface Promotion {
    /** Evaluate whether this promotion applies to the cart. */
    boolean applies(Cart cart, java.util.Map<String, ProductVariant> catalog);

    /** Compute the discount, or empty if not applicable. */
    java.util.Optional<AppliedDiscount> evaluate(Cart cart, java.util.Map<String, ProductVariant> catalog);

    String name();

    /** Higher priority wins conflicts. */
    int priority();

    /** Whether this promotion can stack with others. */
    boolean stackable();
}
```

**Applied discount:**

```java
public record AppliedDiscount(String promotionName, DiscountType type,
                              Money amount, java.util.List<String> appliedToItemIds) {}
```

**Example promotions:**

```java
public final class PercentageCoupon implements Promotion {

    private final String code;
    private final double percentOff;
    private final Money minOrderValue;
    private final java.time.Instant validUntil;

    public PercentageCoupon(String code, double percentOff, Money minOrderValue,
                            java.time.Instant validUntil) {
        this.code = code;
        this.percentOff = percentOff;
        this.minOrderValue = minOrderValue;
        this.validUntil = validUntil;
    }

    @Override
    public boolean applies(Cart cart, java.util.Map<String, ProductVariant> catalog) {
        if (!cart.couponCodes().contains(code)) return false;
        if (java.time.Instant.now().isAfter(validUntil)) return false;
        Money subtotal = cart.items().stream()
                .map(CartItem::lineTotal)
                .reduce(Money.zero(), Money::plus);
        return subtotal.amount().compareTo(minOrderValue.amount()) >= 0;
    }

    @Override
    public java.util.Optional<AppliedDiscount> evaluate(Cart cart,
                                                        java.util.Map<String, ProductVariant> catalog) {
        if (!applies(cart, catalog)) return java.util.Optional.empty();
        Money subtotal = cart.items().stream()
                .map(CartItem::lineTotal)
                .reduce(Money.zero(), Money::plus);
        Money discount = subtotal.multiply(percentOff / 100.0);
        return java.util.Optional.of(new AppliedDiscount(code, DiscountType.PERCENTAGE,
                discount, cart.items().stream().map(CartItem::itemId).toList()));
    }

    @Override public String name() { return code; }
    @Override public int priority() { return 50; }
    @Override public boolean stackable() { return true; }
}
```

```java
public final class BuyTwoGetOneFree implements Promotion {

    private final String categoryCode;

    public BuyTwoGetOneFree(String categoryCode) {
        this.categoryCode = categoryCode;
    }

    @Override
    public boolean applies(Cart cart, java.util.Map<String, ProductVariant> catalog) {
        return cart.items().stream().anyMatch(i -> {
            ProductVariant v = catalog.get(i.variantId());
            return v != null && v.category().equals(categoryCode);
        });
    }

    @Override
    public java.util.Optional<AppliedDiscount> evaluate(Cart cart,
                                                        java.util.Map<String, ProductVariant> catalog) {
        Money discount = Money.zero();
        java.util.List<String> itemIds = new java.util.ArrayList<>();
        for (CartItem item : cart.items()) {
            ProductVariant v = catalog.get(item.variantId());
            if (v == null || !v.category().equals(categoryCode)) continue;
            int freeCount = item.quantity() / 3;
            if (freeCount > 0) {
                discount = discount.plus(item.unitPriceSnapshot().multiply(freeCount));
                itemIds.add(item.itemId());
            }
        }
        if (discount.isZero()) return java.util.Optional.empty();
        return java.util.Optional.of(new AppliedDiscount("B2G1-" + categoryCode,
                DiscountType.BOGO, discount, itemIds));
    }

    @Override public String name() { return "Buy 2 Get 1 Free"; }
    @Override public int priority() { return 80; }
    @Override public boolean stackable() { return false; }
}
```

**Promotion engine with stacking rules:**

```java
public final class PromotionEngine {

    private final java.util.List<Promotion> promotions;

    public PromotionEngine(java.util.List<Promotion> promotions) {
        this.promotions = new java.util.ArrayList<>(promotions);
        this.promotions.sort(java.util.Comparator.comparingInt(Promotion::priority).reversed());
    }

    /**
     * Evaluate all promotions, respecting stacking rules.
     * Rule: non-stackable promotions are mutually exclusive; the highest-priority
     * applicable one wins. Stackable ones all apply, but their combined discount
     * is capped at the subtotal.
     */
    public java.util.List<AppliedDiscount> evaluate(Cart cart,
                                                    java.util.Map<String, ProductVariant> catalog) {
        java.util.List<AppliedDiscount> applied = new java.util.ArrayList<>();
        Money subtotal = cart.items().stream().map(CartItem::lineTotal).reduce(Money.zero(), Money::plus);

        boolean nonStackableApplied = false;
        Money accumulated = Money.zero();

        for (Promotion p : promotions) {
            if (nonStackableApplied && !p.stackable()) continue;

            var result = p.evaluate(cart, catalog);
            if (result.isEmpty()) continue;

            AppliedDiscount d = result.get();

            // Cap: don't let total discount exceed subtotal
            Money newTotal = accumulated.plus(d.amount());
            if (newTotal.amount().compareTo(subtotal.amount()) > 0) {
                // Trim to fit
                Money trimmed = subtotal.minus(accumulated);
                if (trimmed.isZero()) break;
                applied.add(new AppliedDiscount(d.promotionName(), d.type(), trimmed, d.appliedToItemIds()));
                accumulated = subtotal;
                break;
            }

            applied.add(d);
            accumulated = newTotal;

            if (!p.stackable()) nonStackableApplied = true;
        }
        return applied;
    }
}
```

**Rules:**
- **Non-stackable** promotions are mutually exclusive; highest priority wins.
- **Stackable** promotions combine; total discount capped at subtotal.
- Priority order is deterministic (sorted descending).

### 4.3 Tax Calculation (per region + category)

Tax depends on **destination** (state/country) and **product category** (food exempt, electronics taxed, etc.).

```java
public interface TaxCalculator {
    Money computeTax(Address destination, java.util.List<CartItem> items,
                     java.util.Map<String, ProductVariant> catalog);
}
```

```java
public record TaxRate(String regionCode, String categoryCode, double rate) {}

public final class RegionCategoryTaxCalculator implements TaxCalculator {

    private final java.util.List<TaxRate> rates;

    public RegionCategoryTaxCalculator(java.util.List<TaxRate> rates) {
        this.rates = java.util.List.copyOf(rates);
    }

    @Override
    public Money computeTax(Address destination, java.util.List<CartItem> items,
                            java.util.Map<String, ProductVariant> catalog) {
        Money total = Money.zero();
        for (CartItem item : items) {
            ProductVariant v = catalog.get(item.variantId());
            if (v == null) continue;
            double rate = findRate(destination.regionCode(), v.category());
            total = total.plus(item.lineTotal().multiply(rate));
        }
        return total;
    }

    private double findRate(String region, String category) {
        return rates.stream()
                .filter(r -> r.regionCode().equals(region) && r.categoryCode().equals(category))
                .map(TaxRate::rate)
                .findFirst()
                .orElse(0.0);
    }
}
```

**Extensibility:** new rules (e.g., threshold-based, category-tiered) = new `TaxCalculator`.

### 4.4 Shipping Calculation

Shipping is **per seller** because sellers ship independently.

```java
public interface ShippingCalculator {
    java.util.Map<String, ShippingQuote> compute(Address destination,
                                                 java.util.Map<String, java.util.List<CartItem>> bySeller,
                                                 ShippingSpeed speed);
}

public record ShippingQuote(String sellerId, Money cost, java.time.Duration eta) {}
```

```java
public final class WeightBasedShippingCalculator implements ShippingCalculator {

    private final java.util.Map<ShippingSpeed, Money> baseRateBySpeed;
    private final Money perKg;

    public WeightBasedShippingCalculator(java.util.Map<ShippingSpeed, Money> baseRateBySpeed,
                                         Money perKg) {
        this.baseRateBySpeed = java.util.Map.copyOf(baseRateBySpeed);
        this.perKg = perKg;
    }

    @Override
    public java.util.Map<String, ShippingQuote> compute(Address destination,
                                                        java.util.Map<String, java.util.List<CartItem>> bySeller,
                                                        ShippingSpeed speed) {
        java.util.Map<String, ShippingQuote> quotes = new java.util.HashMap<>();
        for (var entry : bySeller.entrySet()) {
            double weightKg = 0.0;
            for (CartItem item : entry.getValue()) {
                weightKg += 0.5 * item.quantity();   // simplified: 0.5 kg/item
            }
            Money base = baseRateBySpeed.get(speed);
            Money cost = base.plus(perKg.multiply(weightKg));
            quotes.put(entry.getKey(), new ShippingQuote(entry.getKey(), cost, etaFor(speed)));
        }
        return quotes;
    }

    private java.time.Duration etaFor(ShippingSpeed speed) {
        return switch (speed) {
            case STANDARD -> java.time.Duration.ofDays(5);
            case EXPRESS -> java.time.Duration.ofDays(2);
            case SAME_DAY -> java.time.Duration.ofHours(6);
        };
    }
}
```

**Multi-seller split:** at checkout, the cart splits into N orders — one per seller — each with its own shipping cost.

### 4.5 Inventory: Soft Check vs Hard Reserve

**At add-to-cart:** soft check only — verify the item exists and quantity is plausible. No reservation.

**At checkout:** hard reserve — decrement inventory atomically.

**Why:** carts are often abandoned. Reserving inventory on add-to-cart would lock stock for users who never check out.

```java
public interface InventoryService {
    boolean available(String variantId, int qty);
    boolean tryReserve(String variantId, int qty);
    void release(String variantId, int qty);
}
```

```java
public final class InMemoryInventoryService implements InventoryService {

    private final java.util.Map<String, java.util.concurrent.atomic.AtomicInteger> stock =
            new java.util.concurrent.ConcurrentHashMap<>();

    public void setStock(String variantId, int qty) {
        stock.put(variantId, new java.util.concurrent.atomic.AtomicInteger(qty));
    }

    @Override
    public boolean available(String variantId, int qty) {
        var s = stock.get(variantId);
        return s != null && s.get() >= qty;
    }

    @Override
    public boolean tryReserve(String variantId, int qty) {
        var s = stock.get(variantId);
        if (s == null) return false;
        while (true) {
            int current = s.get();
            if (current < qty) return false;
            if (s.compareAndSet(current, current - qty)) return true;
        }
    }

    @Override
    public void release(String variantId, int qty) {
        var s = stock.get(variantId);
        if (s != null) s.addAndGet(qty);
    }
}
```

### 4.6 Order Placement (checkout)

Checkout converts a cart into one or more orders, one per seller, atomically:

```java
public final class CartService {

    private final java.util.Map<String, Cart> carts = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<String, String> cartsByUser = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<String, String> cartsByGuest = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<String, ProductVariant> catalog = new java.util.concurrent.ConcurrentHashMap<>();
    private final PromotionEngine promotions;
    private final TaxCalculator taxCalculator;
    private final ShippingCalculator shippingCalculator;
    private final InventoryService inventory;
    private final PaymentGateway paymentGateway;
    private final java.util.Map<String, String> ordersByKey = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<String, Order> orders = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.time.Clock clock;

    public CartService(PromotionEngine promotions, TaxCalculator taxCalculator,
                       ShippingCalculator shippingCalculator, InventoryService inventory,
                       PaymentGateway paymentGateway, java.time.Clock clock) {
        this.promotions = promotions;
        this.taxCalculator = taxCalculator;
        this.shippingCalculator = shippingCalculator;
        this.inventory = inventory;
        this.paymentGateway = paymentGateway;
        this.clock = clock;
    }

    // ----- Catalog registration -----

    public void registerVariant(ProductVariant v) { catalog.put(v.id(), v); }

    // ----- Cart lifecycle -----

    public Cart forUser(String userId) {
        return cartsByUser.computeIfAbsent(userId, uid -> {
            Cart c = new Cart(java.util.UUID.randomUUID().toString(), uid, null);
            carts.put(c.id(), c);
            return c.id();
        }) != null ? carts.get(cartsByUser.get(userId)) : null;
    }

    public Cart forGuest(String guestSessionId) {
        String existingId = cartsByGuest.get(guestSessionId);
        if (existingId != null) return carts.get(existingId);
        Cart c = new Cart(java.util.UUID.randomUUID().toString(), null, guestSessionId);
        carts.put(c.id(), c);
        cartsByGuest.put(guestSessionId, c.id());
        return c;
    }

    /** Merge guest cart into user cart; clear guest cart. */
    public Cart mergeOnLogin(String guestSessionId, String userId) {
        Cart userCart = forUser(userId);
        String guestCartId = cartsByGuest.get(guestSessionId);
        if (guestCartId == null) return userCart;
        Cart guestCart = carts.get(guestCartId);
        if (guestCart != null) {
            for (CartItem item : guestCart.items()) {
                userCart.addItem(item);
            }
            for (String code : guestCart.couponCodes()) {
                userCart.addCoupon(code);
            }
            guestCart.clear();
        }
        return userCart;
    }

    // ----- Totals -----

    public CartTotals totals(Cart cart, Address destination, ShippingSpeed speed) {
        Money subtotal = cart.items().stream().map(CartItem::lineTotal).reduce(Money.zero(), Money::plus);

        java.util.List<AppliedDiscount> discounts = promotions.evaluate(cart, catalog);
        Money discountTotal = discounts.stream().map(AppliedDiscount::amount).reduce(Money.zero(), Money::plus);

        Money tax = taxCalculator.computeTax(destination, cart.items(), catalog);

        java.util.Map<String, java.util.List<CartItem>> bySeller = new java.util.HashMap<>();
        for (CartItem item : cart.items()) {
            bySeller.computeIfAbsent(item.sellerId(), k -> new java.util.ArrayList<>()).add(item);
        }
        java.util.Map<String, ShippingQuote> shipping = shippingCalculator.compute(destination, bySeller, speed);
        Money shippingTotal = shipping.values().stream().map(ShippingQuote::cost).reduce(Money.zero(), Money::plus);

        Money total = subtotal.plus(tax).plus(shippingTotal).minus(discountTotal);

        return new CartTotals(subtotal, tax, shippingTotal, discountTotal, total, discounts, shipping);
    }

    // ----- Checkout -----

    public java.util.List<Order> checkout(String cartId, Address destination, ShippingSpeed speed,
                                          String paymentMethod, String idempotencyKey) {
        String existingOrderId = ordersByKey.get(idempotencyKey);
        if (existingOrderId != null) {
            // Return the previously created orders (simplified: one)
            return java.util.List.of(orders.get(existingOrderId));
        }

        Cart cart = carts.get(cartId);
        if (cart == null) throw new IllegalArgumentException("Unknown cart");
        if (cart.status() != CartStatus.ACTIVE) throw new IllegalStateException("Cart not active");

        // Reserve inventory
        java.util.List<CartItem> reserved = new java.util.ArrayList<>();
        try {
            for (CartItem item : cart.items()) {
                if (!inventory.tryReserve(item.variantId(), item.quantity())) {
                    throw new IllegalStateException("Out of stock: " + item.productName());
                }
                reserved.add(item);
            }

            // Compute totals
            CartTotals totals = totals(cart, destination, speed);

            // Authorize payment
            var result = paymentGateway.authorize(idempotencyKey, totals.total());
            if (!result.success()) throw new IllegalStateException("Payment failed");

            // Split by seller, create one order per seller
            java.util.List<Order> createdOrders = new java.util.ArrayList<>();
            java.util.Map<String, java.util.List<CartItem>> bySeller = new java.util.HashMap<>();
            for (CartItem item : cart.items()) {
                bySeller.computeIfAbsent(item.sellerId(), k -> new java.util.ArrayList<>()).add(item);
            }

            for (var entry : bySeller.entrySet()) {
                java.util.List<OrderItem> orderItems = entry.getValue().stream()
                        .map(ci -> new OrderItem(ci.variantId(), ci.productName(),
                                ci.unitPriceSnapshot(), ci.quantity()))
                        .toList();

                Money sellerSubtotal = orderItems.stream()
                        .map(OrderItem::lineTotal).reduce(Money.zero(), Money::plus);

                Order order = new Order(java.util.UUID.randomUUID().toString(),
                        cart.userId(), entry.getKey(), orderItems,
                        destination, sellerSubtotal, Money.zero(),
                        Money.zero(), sellerSubtotal, idempotencyKey + ":" + entry.getKey());
                orders.put(order.id(), order);
                createdOrders.add(order);
            }

            ordersByKey.put(idempotencyKey, createdOrders.get(0).id());
            cart.clear();
            return createdOrders;

        } catch (Exception e) {
            // Rollback inventory
            for (CartItem item : reserved) {
                inventory.release(item.variantId(), item.quantity());
            }
            throw e;
        }
    }
}
```

### 4.7 Cart Totals

```java
public record CartTotals(Money subtotal, Money tax, Money shipping,
                         Money discount, Money total,
                         java.util.List<AppliedDiscount> appliedDiscounts,
                         java.util.Map<String, ShippingQuote> shippingQuotes) {}
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

enum CartStatus { ACTIVE CHECKED_OUT ABANDONED MERGED }
enum OrderStatus { PENDING PAYMENT_AUTHORIZED CONFIRMED SHIPPED DELIVERED CANCELLED }
enum DiscountType { PERCENTAGE FLAT BOGO FREE_SHIPPING }
enum CouponStatus { VALID EXPIRED USAGE_LIMIT_REACHED NOT_APPLICABLE }
enum ShippingSpeed { STANDARD EXPRESS SAME_DAY }

class Product { - String id - String name - String category }
class ProductVariant { - String id - String productId - String sku - Money price - String category }
class Seller { - String id - String name }

class CartItem {
  - String itemId
  - String variantId
  - String sellerId
  - Money unitPriceSnapshot
  - int quantity
  + Money lineTotal()
}

class Cart {
  - String id
  - String userId
  - String guestSessionId
  - Map<String, CartItem> items
  - List<String> couponCodes
  - CartStatus status
  + void addItem(CartItem item)
  + void removeItem(String itemId)
  + void updateQuantity(String itemId, int quantity)
  + void addCoupon(String code)
  + void clear()
}

class OrderItem {
  - String variantId
  - String productName
  - Money unitPriceSnapshot
  - int quantity
  + Money lineTotal()
}

class Order {
  - String id
  - String userId
  - String sellerId
  - List<OrderItem> items
  - Address destination
  - Money subtotal
  - Money tax
  - Money shipping
  - Money total
  - OrderStatus status
  - String idempotencyKey
}

interface Promotion {
  + boolean applies(Cart cart, Map catalog)
  + Optional<AppliedDiscount> evaluate(Cart cart, Map catalog)
  + String name()
  + int priority()
  + boolean stackable()
}

class PercentageCoupon implements Promotion
class BuyTwoGetOneFree implements Promotion

class AppliedDiscount {
  - String promotionName
  - DiscountType type
  - Money amount
  - List<String> appliedToItemIds
}

class PromotionEngine {
  + List<AppliedDiscount> evaluate(Cart cart, Map catalog)
}

interface TaxCalculator {
  + Money computeTax(Address dest, List<CartItem> items, Map catalog)
}

class RegionCategoryTaxCalculator implements TaxCalculator

interface ShippingCalculator {
  + Map<String, ShippingQuote> compute(Address dest, Map bySeller, ShippingSpeed speed)
}

class WeightBasedShippingCalculator implements ShippingCalculator

class ShippingQuote {
  - String sellerId
  - Money cost
  - Duration eta
}

interface InventoryService {
  + boolean available(String variantId, int qty)
  + boolean tryReserve(String variantId, int qty)
  + void release(String variantId, int qty)
}

class CartTotals {
  - Money subtotal
  - Money tax
  - Money shipping
  - Money discount
  - Money total
  - List<AppliedDiscount> appliedDiscounts
  - Map<String, ShippingQuote> shippingQuotes
}

class CartService {
  - Map<String, Cart> carts
  - Map<String, ProductVariant> catalog
  - PromotionEngine promotions
  - TaxCalculator taxCalculator
  - ShippingCalculator shippingCalculator
  - InventoryService inventory
  + Cart forUser(String userId)
  + Cart forGuest(String guestSessionId)
  + Cart mergeOnLogin(String guestSessionId, String userId)
  + CartTotals totals(Cart cart, Address dest, ShippingSpeed speed)
  + List<Order> checkout(String cartId, Address dest, ShippingSpeed speed,
                         String paymentMethod, String idempotencyKey)
}

CartService *-- Cart
CartService *-- Order
CartService --> PromotionEngine
CartService --> TaxCalculator
CartService --> ShippingCalculator
CartService --> InventoryService
Cart *-- CartItem
Order *-- OrderItem
PromotionEngine *-- Promotion
@enduml
```

---

## 6. Java Implementation (new parts only)

Most new code is already shown in §4. Remaining pieces:

### 6.1 Product / ProductVariant

```java
public record Product(String id, String name, String category) {}

public record ProductVariant(String id, String productId, String sku,
                             Money price, String category) {}
```

### 6.2 Address

```java
public record Address(String line1, String city, String regionCode,
                      String postalCode, String countryCode) {
    public Address {
        if (regionCode == null || regionCode.isBlank()) throw new IllegalArgumentException("regionCode required");
    }
}
```

### 6.3 Order / OrderItem

```java
public record OrderItem(String variantId, String productName,
                        Money unitPriceSnapshot, int quantity) {
    public Money lineTotal() { return unitPriceSnapshot.multiply(quantity); }
}
```

```java
public final class Order {
    private final String id;
    private final String userId;
    private final String sellerId;
    private final java.util.List<OrderItem> items;
    private final Address destination;
    private final Money subtotal;
    private final Money tax;
    private final Money shipping;
    private final Money total;
    private final String idempotencyKey;
    private final java.util.concurrent.locks.ReentrantLock lock = new java.util.concurrent.locks.ReentrantLock();

    private OrderStatus status;

    public Order(String id, String userId, String sellerId,
                 java.util.List<OrderItem> items, Address destination,
                 Money subtotal, Money tax, Money shipping, Money total,
                 String idempotencyKey) {
        this.id = id;
        this.userId = userId;
        this.sellerId = sellerId;
        this.items = java.util.List.copyOf(items);
        this.destination = destination;
        this.subtotal = subtotal;
        this.tax = tax;
        this.shipping = shipping;
        this.total = total;
        this.idempotencyKey = idempotencyKey;
        this.status = OrderStatus.PAYMENT_AUTHORIZED;
    }

    public String id() { return id; }
    public String sellerId() { return sellerId; }
    public java.util.List<OrderItem> items() { return items; }
    public Money total() { return total; }
    public OrderStatus status() { lock.lock(); try { return status; } finally { lock.unlock(); } }

    public void confirm() {
        lock.lock();
        try {
            if (status != OrderStatus.PAYMENT_AUTHORIZED) throw new IllegalStateException("Not authorized");
            status = OrderStatus.CONFIRMED;
        } finally { lock.unlock(); }
    }

    public void cancel() {
        lock.lock();
        try {
            if (status == OrderStatus.SHIPPED || status == OrderStatus.DELIVERED) {
                throw new IllegalStateException("Already shipped/delivered");
            }
            status = OrderStatus.CANCELLED;
        } finally { lock.unlock(); }
    }
}
```

### 6.4 PaymentGateway (shared interface)

Reuse from `15-airline-reservation.md` §6.10:

```java
public interface PaymentGateway {
    PaymentResult authorize(String idempotencyKey, Money amount);
    PaymentResult capture(String authId, Money amount);
    PaymentResult refund(String authId, Money amount);
}
```

```java
public record PaymentResult(boolean success, String authId, String message) {
    public static PaymentResult ok(String authId) { return new PaymentResult(true, authId, "OK"); }
    public static PaymentResult failure(String msg) { return new PaymentResult(false, null, msg); }
}
```

### 6.5 Demo

```java
public class Demo {
    public static void main(String[] args) {
        InventoryService inventory = new InMemoryInventoryService();
        ((InMemoryInventoryService) inventory).setStock("V1", 10);
        ((InMemoryInventoryService) inventory).setStock("V2", 5);

        PromotionEngine engine = new PromotionEngine(java.util.List.of(
                new PercentageCoupon("SAVE20", 20, Money.usd(50),
                        java.time.Instant.now().plus(java.time.Duration.ofDays(30))),
                new BuyTwoGetOneFree("ELECTRONICS")
        ));

        TaxCalculator tax = new RegionCategoryTaxCalculator(java.util.List.of(
                new TaxRate("MH", "ELECTRONICS", 0.18),
                new TaxRate("MH", "GROCERY", 0.05)
        ));

        ShippingCalculator shipping = new WeightBasedShippingCalculator(
                java.util.Map.of(
                        ShippingSpeed.STANDARD, Money.usd(5),
                        ShippingSpeed.EXPRESS, Money.usd(15),
                        ShippingSpeed.SAME_DAY, Money.usd(30)),
                Money.usd(1));

        CartService service = new CartService(engine, tax, shipping, inventory,
                key -> PaymentResult.ok("auth-1"), java.time.Clock.systemUTC());

        service.registerVariant(new ProductVariant("V1", "P1", "SKU-1", Money.usd(30), "ELECTRONICS"));
        service.registerVariant(new ProductVariant("V2", "P2", "SKU-2", Money.usd(10), "GROCERY"));

        Cart cart = service.forUser("U1");
        cart.addItem(new CartItem("I1", "V1", "S1", "Headphones", Money.usd(30), 3));
        cart.addItem(new CartItem("I2", "V2", "S1", "Coffee", Money.usd(10), 2));
        cart.addCoupon("SAVE20");

        Address dest = new Address("123 Main St", "Mumbai", "MH", "400050", "IN");
        CartTotals totals = service.totals(cart, dest, ShippingSpeed.STANDARD);
        System.out.println("Subtotal: " + totals.subtotal().amount());
        System.out.println("Tax: " + totals.tax().amount());
        System.out.println("Shipping: " + totals.shipping().amount());
        System.out.println("Discount: " + totals.discount().amount());
        System.out.println("Total: " + totals.total().amount());

        java.util.List<Order> orders = service.checkout(cart.id(), dest,
                ShippingSpeed.STANDARD, "CARD", "key-checkout-1");
        System.out.println("Orders: " + orders.size());
    }
}
```

---

## 7. Concurrency Considerations

Reused from `11-movie-ticket-booking.md` §7:
- `ConcurrentHashMap` for maps
- Idempotency key + dedup map
- Guarded state transitions

**New to Shopping Cart:**

- **Concurrent cart mutations** — same user with multiple tabs. `Cart` uses a `ReentrantLock` for all mutations. `addItem` merges quantities.
- **Add-to-cart race** — two adds for the same item. `CartItem.setQuantity` inside the cart lock ensures no lost updates.
- **Guest cart merge** — merge under lock; de-dupe coupons.
- **Checkout reservation** — atomic across multiple variants. `InventoryService.tryReserve` uses CAS per variant; rollback on failure (see `15-airline-reservation.md` §4.4 for the full pattern).
- **Multi-seller order split** — each seller's order is independent; but the cart is cleared atomically after all succeed.
- **Promotion engine is read-only** — no lock needed; deterministic evaluation.
- **Idempotency key on checkout** — dedup prevents duplicate orders.

**Locking for checkout:**

```java
synchronized (cart) {
    // check status, reserve, create orders, clear
}
```

If multiple services participate (inventory, payment), use a saga pattern in production — but for LLD, sequential with rollback is fine.

---

## 8. Extensibility

| Feature | Change |
|---|---|
| New promotion type | Implement `Promotion` |
| New tax rule | Implement `TaxCalculator` |
| New shipping method | Implement `ShippingCalculator` |
| Subscription discounts | Add `Subscription` check in a `Promotion` |
| Buy-online-pickup-in-store | Add `FulfillmentType`; adjust tax/shipping |
| Gift wrapping | Add as a `CartItem` or `AddOn` (similar to Airline ancillaries) |
| Multi-currency | `Money` already supports it; convert at checkout |
| Pre-order / back-order | Add `ProductVariant.availabilityStatus`; allow reservation for future stock |
| Cart sharing (wishlist) | Add `Cart.sharedWith` list; read-only for others |
| Cart abandonment recovery | Scheduler emits reminders; combine with email/push |

---

## 9. Common Pitfalls

| Pitfall | Fix |
|---|---|
| Price changes between add and checkout | Snapshot `unitPriceSnapshot` on `CartItem`; refresh on explicit "update price" |
| Cart with items from multiple sellers → single order | Split into per-seller orders |
| Applying coupon twice | Track applied codes; evaluate idempotently |
| Discount > subtotal | Cap total discount at subtotal |
| Non-stackable + stackable conflict | Priority order; non-stackable blocks later non-stackables |
| Reserving inventory on add-to-cart | Soft-check only; reserve at checkout |
| Tax calculated on pre-discount amount | Depends on region; some compute on discounted subtotal |
| Shipping per item instead of per seller | Aggregate by seller; one quote per seller |
| Guest cart lost on login | Merge into user cart; preserve items + coupons |
| Race on last item in stock | CAS on `InventoryService` |
| Not rolling back on partial checkout failure | Rollback reserved inventory on exception |
| Cart cleared before order confirmed | Clear cart only after all orders created |
| `double` for money | `BigDecimal` / `Money` |
| Idempotency ignored | Dedup map keyed by `idempotencyKey` |

---

## 10. Follow-ups

### Q1: How do you handle a price drop between add-to-cart and checkout?

**Answer:** Two policies:
- **Snapshot pricing**: use the price at add-to-cart (locked in).
- **Live pricing**: refresh prices at checkout.

Recommendation: **refresh at checkout with user notification** — if the price increased since add-to-cart, warn the user; if decreased, apply the lower price. Store both `unitPriceSnapshot` and `currentPrice` on the cart view.

### Q2: How do you handle promotion conflicts?

**Answer:** Each `Promotion` declares `priority` and `stackable`. The `PromotionEngine`:
1. Sort by priority descending.
2. Apply stackable ones.
3. First non-stackable wins; subsequent non-stackables skipped.
4. Total discount capped at subtotal.

### Q3: How do you test the checkout flow?

**Answer:**
- **Unit tests** for promotion engine (stacking, capping), tax calculator, shipping calculator
- **Concurrency tests** — 100 threads checking out with same cart; assert 1 succeeds
- **Rollback tests** — inventory shortfall during checkout; assert no partial order
- **Idempotency tests** — same key twice → same orders
- **Multi-seller split** — 1 cart with 3 sellers → 3 orders
- **Property test** — invariant: `total == subtotal + tax + shipping − discount`

### Q4: How do you handle cart expiry?

**Answer:** A scheduler scans carts older than N days (typically 30) with `status = ACTIVE` and no recent modifications. Marks them `ABANDONED`. Optionally sends recovery email with a coupon. Guest carts expire faster (7 days).

### Q5: How do you support subscription-only discounts?

**Answer:** Add `Promotion` implementation that checks `cart.userId().subscriptionTier == PRIME`. Priority above coupons, non-stackable with other automatic promos. Same engine; new rule.

---

## 11. Similar Problems

- **Splitwise** (`10-splitwise.md`) — line items + totals + arithmetic
- **ATM** (`03-atm.md`) — payment authorize/capture
- **Food Delivery** (`13-food-delivery-order.md`) — order lifecycle + inventory
- **Airline Reservation** (`15-airline-reservation.md`) — multi-cell reservation + ancillaries
- **Movie Ticket Booking** (`11-movie-ticket-booking.md`) — item selection + payment

Shopping Cart's unique additions: **cart vs order**, **promotion engine**, **tax per region/category**, **shipping per seller**, **multi-seller split**.

---

## 12. Key Takeaways

- **Cart is mutable; Order is immutable** — snapshot prices, product info, totals at checkout
- **Price snapshot on CartItem** — decouples cart from live catalog
- **Promotion engine with priority + stackable flags** — deterministic evaluation
- **Discount capped at subtotal** — never negative total
- **Tax per (region, category)** — extensible via `TaxCalculator`
- **Shipping per seller** — one quote per seller, aggregated
- **Multi-seller cart → multi-seller orders** — split at checkout
- **Soft check on add; hard reserve on checkout** — avoid locking stock for abandoned carts
- **Inventory CAS + rollback** — atomic across variants
- **Cart lock for mutations** — safe multi-tab
- **Guest cart merge on login** — preserve items + coupons
- **Idempotency key** — dedup on checkout
- **`Money` is `BigDecimal`** — never `double`
- **`Clock` injected** — deterministic tests

### The Delta Recipe

For any **cart + checkout** problem:

1. **Cart (mutable)** vs **Order (immutable)** — snapshot at checkout
2. **Price snapshot** on line items
3. **Promotion engine** — priority + stackable + cap
4. **Tax calculator** — region + category
5. **Shipping calculator** — per seller, per speed
6. **Multi-seller split** — one order per seller
7. **Soft check on add; hard reserve on checkout**
8. **Idempotency key** on checkout
9. **Rollback on failure** — release inventory
10. **Cart lock for mutations** — safe concurrent updates
11. **Merge guest cart on login**
12. **Cart expiry scheduler**

This delta plus the cart/line-item skeleton from #10 and the payment skeleton from #15 solves: Shopping Cart, E-Commerce Checkout, Grocery Cart, Restaurant Menu Ordering, Subscription Boxes — with variations in promotion rules, tax regions, and fulfillment.