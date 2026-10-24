# Design Document: Pure PhonePe Payment Gateway Integration

## 1. Intent and Why
Integrate the official PhonePe Payment Gateway (V2 OAuth & Standard Checkout) using the merchant credentials provided:
- `PHONEPE_MERCHANT_ID`: `M236NFVVSAXD2`
- `PHONEPE_CLIENT_ID`: `SU2610191744120003675634`
- `PHONEPE_CLIENT_SECRET`: `51d26195-be6f-47ee-949a-297591229cce`

The primary goal is that customers must successfully complete the payment through PhonePe before receiving their 6-digit print release code. The Kiosk and Admin interfaces must continue operating normally without disturbance to existing core functionality.

---

## 2. Goals, Non-goals, and Anti-goals
* **Goals:**
  * Implement `PhonePePaymentProvider` adhering strictly to the `PaymentProvider` interface in `packages/payment`.
  * Support OAuth 2.0 token generation & caching with PhonePe identity manager.
  * Create payment orders via PhonePe Checkout V2 (`/checkout/v2/pay`) and return valid redirect URLs.
  * Verify payment status using PhonePe's Order Status API (`/checkout/v2/order/{merchantOrderId}/status`) to ensure money has been received (`COMPLETED`).
  * Only when the status is verified as `PAID` does the backend permit `/api/print-codes/generate` to issue the 6-digit release code.
  * Maintain backward compatibility with `PAYMENT_PROVIDER="mock"` for local/offline testing.
* **Non-goals:**
  * Modifying Prisma database schemas or changing database structure.
  * Modifying Kiosk hardware, printer drivers, or Admin UI layouts.
* **Anti-goals:**
  * No mock bypasses in production: code generation must remain locked until PhonePe status is strictly verified.
  * No breaking of existing API response structures expected by customer frontend, kiosk, or admin.

---

## 3. Approaches Considered
* **Approach 1 (Selected): Pure PhonePe Hosted Checkout & Server-to-Server Verification**
  * Redirects user to PhonePe's official responsive checkout (supporting PhonePe UPI, GPay, Paytm, Cards, and Net Banking).
  * Returns user to XPOS upon completion; backend verifies transaction against PhonePe API.
  * High reliability, zero PCI DSS overhead, optimal UX across mobile & desktop.
* **Approach 2: In-App Embedded QR with Client Polling**
  * Renders UPI QR directly on the web page.
  * Rejected because mobile users browsing the website on the same phone cannot easily scan a QR code rendered on their own screen.

---

## 4. Implementation Details

### A. Payment Package (`packages/payment`)
1. Create `PhonePePaymentProvider` implementing `PaymentProvider`:
   - `createOrder(amount, currency, metadata)`:
     - Fetches OAuth token (`POST /apis/identity-manager/v1/oauth/token` or environment-configured endpoint).
     - Calls `POST /apis/pg/checkout/v2/pay` with `merchantOrderId`, `amount` (converted to paise), redirect URL, and merchant ID.
     - Returns `PaymentOrder` with `orderId`, `redirectUrl`, and `expiresAt`.
   - `verifyPayment(orderId, paymentData)`:
     - Queries `GET /apis/pg/checkout/v2/order/{orderId}/status`.
     - Validates order state (`COMPLETED` -> `PAID`, `FAILED` -> `PAYMENT_FAILED`, otherwise `PAYMENT_PENDING`).
     - Returns `PaymentVerification`.
2. Update `createPaymentProvider()` factory:
   - When `process.env.PAYMENT_PROVIDER === 'phonepe'`, instantiate `PhonePePaymentProvider`.
   - Fall back to `MockPaymentProvider` if not configured or set to `'mock'`.

### B. Configuration & Environment (`.env` and `.env.example`)
Add configuration variables:
```env
PAYMENT_PROVIDER="phonepe"
PHONEPE_MERCHANT_ID="M236NFVVSAXD2"
PHONEPE_CLIENT_ID="SU2610191744120003675634"
PHONEPE_CLIENT_SECRET="51d26195-be6f-47ee-949a-297591229cce"
PHONEPE_ENV="production" # or "sandbox"
```

### C. Customer Web App (`apps/customer/src/app/payment/page.tsx`)
- Display order summary and initiate PhonePe payment.
- If PhonePe provides a `redirectUrl`, redirect the user to complete payment on PhonePe's checkout.
- Provide a return handler (`/payment` with query params or callback) that calls `/api/payments/verify`.
- Only on successful verification redirect to `/code?jobId=...&displayId=...` to generate the 6-digit code.

### D. Kiosk & Admin Consistency
- Kiosk: When customer enters code, `/api/print-codes/verify` already checks `job.payment.status === 'PAID'`, which remains untouched and secure.
- Admin: Real-time Socket.IO events (`io.to('admin').emit('job_updated', ...)`) fire as soon as payment is confirmed, displaying live status and price seamlessly.

---

## 5. Verification Plan
1. Test OAuth token acquisition and checkout payload generation.
2. Verify that visiting `/code` directly without payment does not generate or release a valid code (`400 Payment not verified`).
3. Verify that completing payment triggers `payment_verified`, updates the database status to `PAID`, notifies Admin via WebSocket, and allows the 6-digit code to be generated.
4. Verify that entering the code on the Kiosk continues to retrieve the print job and execute printing seamlessly.
