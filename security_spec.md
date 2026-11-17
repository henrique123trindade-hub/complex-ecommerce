# COMPLEX Storefront — Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity Isolation**: A user's private profile (`/users/{userId}`) and saved addresses (`/users/{userId}/addresses/{addressId}`) can only be read or modified by `request.auth.uid == userId` or a verified admin.
2. **No Self-Assigned Privileges**: Users cannot write `role`, `isAdmin`, or `admin` fields into `/users/{userId}`, nor write to `/admins/{uid}`.
3. **Order Ownership & Integrity**: Orders in `/orders/{orderId}` must bind `userId == request.auth.uid` on creation with initial status `'demo_pending'` and `request.auth.token.email_verified == true`. Only admins may update order status or list all orders.
4. **Catalog & Editorial Protection**: `/products`, `/categories`, and `/editorial` are publicly readable without PII, and writable strictly by verified admins (`isAdmin()`).
5. **Newsletter & Coupon Privacy**: Visitors can subscribe to `/newsletter/{id}` (create only with `consent == true`), never list or read other subscribers. Coupons allow single-doc `get` by code, while listing and mutations are restricted to admins.
6. **Temporal Integrity**: Creation requires `createdAt == request.time`; updates require `updatedAt == request.time` and preserve immutable fields (`createdAt`, `userId`, `uid`).
7. **Path & Size Bounds**: Every document ID matches `^[a-zA-Z0-9_-]+$` (`<= 128` chars), and every string and array field is bounded in size.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Shadow Admin Escalation**: Authenticated user creates `/users/{uid}` with `{ uid, email, isAdmin: true, createdAt, updatedAt }` -> Rejected by `hasOnly` key allowlist.
2. **Cross-User Profile Read**: User A attempts `get` on `/users/{userB_uid}` -> Rejected (`!isOwner && !isAdmin`).
3. **Unverified Email Spoof**: User with `email: "henrique123trindade@gmail.com"` and `email_verified: false` attempts write to `/products/test` -> Rejected (`email_verified == true` check).
4. **Order Impersonation**: User A creates `/orders/ord1` with `userId: userB_uid` -> Rejected (`incoming().userId == request.auth.uid`).
5. **Order Status Bypass**: User A creates `/orders/ord1` with `status: "delivered"` -> Rejected (must start at `"demo_pending"`).
6. **Order Total Tampering After Creation**: User A updates `/orders/ord1` changing `totalBrl` -> Rejected (only `isAdmin()` may update orders).
7. **Blanket Order Scraping**: User A runs `list` on `/orders` without filtering to `userId == request.auth.uid` -> Rejected by `resource.data.userId == request.auth.uid` in `allow list`.
8. **Newsletter Email Harvesting**: Authenticated non-admin runs `list` or `get` on `/newsletter` -> Rejected (`isAdmin()` only).
9. **Newsletter Without Consent**: Visitor creates `/newsletter/sub1` with `consent: false` -> Rejected (`data.consent == true`).
10. **ID Poisoning**: Attacker writes `/orders/${'a'.repeat(500)}` or `/products/bad$id` -> Rejected by `isValidId()`.
11. **Oversized Array Exhaustion**: Attacker writes a product or order with `items.size() > 50` -> Rejected by array size check.
12. **Client Timestamp Spoofing**: User creates `/orders/ord1` with backdated `createdAt` instead of `request.time` -> Rejected (`data.createdAt == request.time`).
