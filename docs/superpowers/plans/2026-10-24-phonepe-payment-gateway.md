# Pure PhonePe Payment Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the official PhonePe V2 Payment Gateway into XPOS Cloud so that a 6-digit print release code is only issued after verified payment, while keeping existing Kiosk, Admin, and printing operations completely intact.

**Architecture:** Implement a modular `PhonePePaymentProvider` in `packages/payment` fulfilling the existing `PaymentProvider` interface. Use PhonePe's OAuth 2.0 endpoint for token generation, Checkout V2 (`/checkout/v2/pay`) for orders, and the Order Status API (`/checkout/v2/order/{id}/status`) for verification. In `apps/customer`, redirect users to PhonePe's hosted checkout and verify payment server-to-server before allowing release code generation.

**Tech Stack:** TypeScript, Node.js (Express), Next.js (Customer Frontend), Prisma, Socket.IO, PhonePe PG V2 API.

**Spec:** `docs/superpowers/specs/2026-10-24-phonepe-payment-gateway-design.md`

## Global Constraints
- `PHONEPE_MERCHANT_ID`: `"M236NFVVSAXD2"`
- `PHONEPE_CLIENT_ID`: `"SU2610191744120003675634"`
- `PHONEPE_CLIENT_SECRET`: `"51d26195-be6f-47ee-949a-297591229cce"`
- Zero changes to Prisma schema or SQLite/Postgres database tables.
- Zero changes to Kiosk keypad or hardware print release logic (`/api/print-codes/verify`).
- No mock auto-verifications when `PAYMENT_PROVIDER="phonepe"`.

## Review Focus
- Attempting to access `/api/print-codes/generate` before payment is completed must return `400 Payment not verified`.
- PhonePe token expiration or renewal must be handled automatically in `PhonePePaymentProvider`.
- Customer returning from PhonePe checkout should see an immediate verifying state and redirect smoothly to `/code`.
- Failed or cancelled payments on PhonePe must show a clear failure state and not issue any code.
- Kiosk entry of code and real-time Admin portal socket updates must function identically to the existing system.

---

### Task 1: Implement PhonePe Provider in `@xpos/payment`

**Files:**
- Create: `packages/payment/src/phonepe.ts`
- Modify: `packages/payment/src/index.ts`

**Interfaces:**
- Consumes: `PaymentProvider`, `PaymentOrder`, `PaymentVerification`, `RefundResult` from `@xpos/types`
- Produces: `PhonePePaymentProvider` class and updated `createPaymentProvider()` factory

- [ ] **Step 1: Write unit test / verification script for PhonePe provider**
Test file: `packages/payment/src/phonepe.test.ts` verifying `createPaymentProvider()` instantiates `PhonePePaymentProvider` when `PAYMENT_PROVIDER="phonepe"` and that `createOrder` returns expected structure.

- [ ] **Step 2: Create `packages/payment/src/phonepe.ts`**
Implement:
```typescript
export class PhonePePaymentProvider implements PaymentProvider {
  name = 'phonepe';
  // OAuth token retrieval & in-memory caching
  // createOrder(amount, currency, metadata) -> calls /checkout/v2/pay
  // verifyPayment(orderId, paymentData) -> calls /checkout/v2/order/{orderId}/status
  // initiateRefund(paymentId, amount) -> calls refund endpoint
}
```

- [ ] **Step 3: Update `packages/payment/src/index.ts`**
Export `PhonePePaymentProvider` and update `createPaymentProvider()`:
```typescript
case 'phonepe':
  return new PhonePePaymentProvider();
```

- [ ] **Step 4: Verify `@xpos/payment` builds cleanly**
Run build in `packages/payment`.

---

### Task 2: Configure Environment Variables

**Files:**
- Modify: `.env`
- Modify: `.env.example`

- [ ] **Step 1: Update `.env.example`**
Add:
```env
# Payment (PhonePe)
PAYMENT_PROVIDER="phonepe"
PHONEPE_MERCHANT_ID="M236NFVVSAXD2"
PHONEPE_CLIENT_ID="SU2610191744120003675634"
PHONEPE_CLIENT_SECRET="51d26195-be6f-47ee-949a-297591229cce"
PHONEPE_ENV="production"
```

- [ ] **Step 2: Update `.env`**
Set `PAYMENT_PROVIDER="phonepe"` and add the PhonePe credentials.

---

### Task 3: Backend Payments Route Handling

**Files:**
- Modify: `apps/api/src/routes/payments.ts`

**Interfaces:**
- Consumes: `req.app.locals.payment`, `req.app.locals.prisma`, `req.app.locals.io`
- Produces: `POST /api/payments/create`, `POST /api/payments/verify`, `GET/POST /api/payments/callback`

- [ ] **Step 1: Enhance `POST /api/payments/create`**
Ensure `redirectUrl` from `PhonePePaymentProvider.createOrder` is passed in `res.json({ data: { redirectUrl, ... } })`.

- [ ] **Step 2: Enhance `POST /api/payments/verify`**
Ensure it takes `orderId` or `paymentId`, queries the active payment provider (`PhonePePaymentProvider`), updates database status to `PAID` only when provider confirms `verified === true`, and emits `payment_verified` to `session:${sessionId}` and `admin`.

- [ ] **Step 3: Add optional callback route `GET /api/payments/callback`**
Accepts redirect callback from PhonePe and redirects customer to `/payment?jobId=...&check=true`.

---

### Task 4: Customer Frontend Checkout Flow

**Files:**
- Modify: `apps/customer/src/app/payment/page.tsx`
- Modify: `apps/customer/src/lib/api.ts`

- [ ] **Step 1: Update `apps/customer/src/lib/api.ts`**
Ensure `createPayment` and `verifyPayment` types pass `redirectUrl` and necessary metadata.

- [ ] **Step 2: Update `apps/customer/src/app/payment/page.tsx`**
- Remove 2-second mock auto-approval.
- When `redirectUrl` is received from PhonePe:
  - If user is on payment page, provide a prominent "Proceed to PhonePe" button or direct redirect.
  - Render PhonePe QR code if QR data is available, with a manual or polling "Check Status" button.
- When user returns after payment (or when status poll fires), call `verifyPayment`.
- When status is confirmed `PAID`, redirect to `/code?jobId=${jobId}&displayId=${displayId}`.

---

### Task 5: End-to-End System Integrity Verification

**Files:**
- Test across `apps/api`, `apps/customer`, `apps/kiosk`, `apps/admin`

- [ ] **Step 1: Test Unpaid Job Lockout**
Verify `/api/print-codes/generate` rejects unpaid jobs with `400 Payment not verified`.

- [ ] **Step 2: Test Payment Flow**
Verify order creation against PhonePe, verify callback handling, and verify code generation after `PAID` status.

- [ ] **Step 3: Verify Kiosk & Admin**
Confirm Kiosk code verification (`/api/print-codes/verify`) and WebSocket live updates on Admin portal operate without error.
