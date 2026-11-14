# Cashfree Payment Gateway & Multi-Gateway Architecture Documentation

This document describes the **Cashfree Payment Gateway Integration** implemented alongside the existing **Razorpay Gateway** for **AMD Play / Sports Academy**.

> [!IMPORTANT]
> **Razorpay is 100% Preserved & Untouched**: All existing Razorpay endpoints (`/bookings/razorpay/order`, `/bookings/razorpay/verify`, `/memberships/razorpay/*`, etc.) remain fully operational. No changes have been made to existing Razorpay workflows.
>
> **Multi-Gateway Dynamic Switching**: Academy Administrators can select whether **Cashfree** or **Razorpay** is the active gateway in Academy Settings (`settings.paymentGateways.activeGateway`).

---

## 1. Overview of Payment Gateways

| Feature | Razorpay | Cashfree |
| :--- | :--- | :--- |
| **API Version** | Standard Orders v1 | PG Orders `2023-08-01` |
| **Identifier** | `keyId` & `keySecret` | `appId` & `secretKey` |
| **Client Checkout Key** | `razorpay_order_id` & `keyId` | `payment_session_id` & `order_id` |
| **SDK Library** | `https://checkout.razorpay.com/v1/checkout.js` | `@cashfreepayments/cashfree-js` or `https://sdk.cashfree.com/js/v3/cashfree.js` |
| **Direct Order Endpoint** | `POST /api/v1/bookings/razorpay/order` | `POST /api/v1/bookings/cashfree/order` |
| **Direct Verify Endpoint** | `POST /api/v1/bookings/razorpay/verify` | `POST /api/v1/bookings/cashfree/verify` |
| **Dynamic Unified Endpoint** | `POST /api/v1/bookings/payment/order` | `POST /api/v1/bookings/payment/order` |
| **Webhook Endpoint** | `POST /api/v1/finance/webhook/razorpay` | `POST /api/v1/finance/webhook/cashfree` |

---

## 2. Admin Academy Settings: Configuring & Selecting Gateway

### A. Updating Active Payment Gateway

Academy Admins can configure credentials and choose the active payment gateway via:

- **Endpoint**: `PATCH /api/v1/settings`
- **Headers**:
  ```http
  Authorization: Bearer <ADMIN_JWT_TOKEN>
  Content-Type: application/json
  ```
- **Payload Example**:
  ```json
  {
    "paymentGateways": {
      "activeGateway": "cashfree",
      "cashfree": {
        "enabled": true,
        "appId": "YOUR_CASHFREE_APP_ID",
        "secretKey": "YOUR_CASHFREE_SECRET_KEY",
        "apiVersion": "2023-08-01",
        "environment": "TEST" 
      },
      "razorpay": {
        "enabled": true,
        "keyId": "rzp_live_xxxxxxxxxxxx",
        "keySecret": "xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
  ```
  *(Note: set `environment: "PROD"` for live production transactions, or `"TEST"` for sandbox testing).*

### B. Testing Gateway Connectivity

Admins can test credentials before saving:

- **Endpoint**: `POST /api/v1/settings/payment-gateways/test`
- **Payload**:
  ```json
  {
    "gateway": "cashfree",
    "credentials": {
      "appId": "YOUR_CASHFREE_APP_ID",
      "secretKey": "YOUR_CASHFREE_SECRET_KEY",
      "environment": "TEST"
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Payment gateway connection verified",
    "data": {
      "success": true,
      "mode": "sandbox/test",
      "message": "Cashfree credentials verified successfully (Sandbox Mode)",
      "appId": "YOUR_CASHFREE_APP_ID",
      "environment": "TEST"
    }
  }
  ```

---

## 3. Dedicated Cashfree Booking Endpoints

Use these endpoints when the frontend explicitly targets Cashfree.

### A. Create Cashfree Order

- **Endpoint**: `POST /api/v1/bookings/cashfree/order`
- **Authentication**: Optional (authenticated user token from `localStorage`, or unauthenticated guest details in `customer`).
- **Headers**:
  ```http
  Authorization: Bearer <OPTIONAL_TOKEN>
  Content-Type: application/json
  ```
- **Single Slot Request**:
  ```json
  {
    "resourceId": "68ea23c4a638b97dcf5e7912",
    "date": "2026-11-18",
    "startTime": "18:00",
    "endTime": "19:00",
    "returnUrl": "https://myapp.com/payment-status?order_id={order_id}",
    "customer": {
      "name": "Priya Sharma",
      "phone": "9876543210",
      "email": "priya@example.com"
    }
  }
  ```
- **Multi-Slot Request**:
  ```json
  {
    "returnUrl": "https://myapp.com/payment-status?order_id={order_id}",
    "customer": {
      "name": "Priya Sharma",
      "phone": "9876543210",
      "email": "priya@example.com"
    },
    "slots": [
      {
        "resourceId": "68ea23c4a638b97dcf5e7912",
        "date": "2026-11-18",
        "startTime": "18:00",
        "endTime": "19:00"
      },
      {
        "resourceId": "68ea23c4a638b97dcf5e7912",
        "date": "2026-11-18",
        "startTime": "19:00",
        "endTime": "20:00"
      }
    ]
  }
  ```

- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Cashfree booking order created successfully",
    "data": {
      "orderId": "cf_1794676500_1234",
      "cfOrderId": "10492812",
      "paymentSessionId": "session_6U58m3m2wQ99...",
      "amount": 354,
      "currency": "INR",
      "gateway": "cashfree",
      "environment": "TEST",
      "pricing": {
        "basePrice": 300,
        "taxRate": 18,
        "taxAmount": 54,
        "discountAmount": 0,
        "totalAmount": 354
      },
      "slot": {
        "resourceId": "68ea23c4a638b97dcf5e7912",
        "resourceName": "Badminton Court 1",
        "date": "2026-11-18",
        "startTime": "18:00",
        "endTime": "19:00",
        "basePrice": 300
      },
      "customer": {
        "id": "cust_1794676500",
        "name": "Priya Sharma",
        "email": "priya@example.com",
        "phone": "9876543210"
      }
    }
  }
  ```

### B. Verify Cashfree Payment & Confirm Booking

After Cashfree checkout completes on the client side, call this endpoint to finalize the reservation, provision the door PIN pass, trigger Hikvision biometric access, and schedule smart court lighting.

- **Endpoint**: `POST /api/v1/bookings/cashfree/verify`
- **Request Body**:
  ```json
  {
    "orderId": "cf_1794676500_1234",
    "cfPaymentId": "10492815",
    "resourceId": "68ea23c4a638b97dcf5e7912",
    "date": "2026-11-18",
    "startTime": "18:00",
    "endTime": "19:00",
    "name": "Priya Sharma",
    "phone": "9876543210",
    "email": "priya@example.com"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Booking confirmed and Cashfree payment verified successfully",
    "data": {
      "_id": "6901a9b23f81e4b3",
      "bookingNumber": "BK-20261118-91AB42",
      "status": "confirmed",
      "accessCode": "842915",
      "qrCodeUrl": "https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=PIN%3A842915...",
      "pricing": {
        "basePrice": 300,
        "taxAmount": 54,
        "totalAmount": 354
      },
      "payment": {
        "method": "cashfree",
        "status": "success",
        "transactionId": "10492815"
      }
    }
  }
  ```

---

## 4. Unified Gateway Routing Endpoints (Recommended for Frontend)

The Unified endpoints automatically route to whichever gateway the Admin activated (`activeGateway` in academy settings):

- **Order Endpoint**: `POST /api/v1/bookings/payment/order`
  - Accepts an optional `"gateway": "cashfree" | "razorpay"`. If omitted, automatically uses the Academy's active gateway.
  - Returns `paymentSessionId` (if Cashfree) or `orderId` + `keyId` (if Razorpay).
  - Also returns `data.gateway = "cashfree" | "razorpay"` so the frontend knows which SDK modal to launch!

- **Verify Endpoint**: `POST /api/v1/bookings/payment/verify`
  - Accepts Cashfree (`orderId`, `cfPaymentId`) or Razorpay (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`).
  - Auto-detects the gateway and finalizes the booking!

---

## 5. Complete Frontend Integration Example

### Step A: Install Cashfree SDK
In your React / Vue / Angular application:
```bash
npm install @cashfreepayments/cashfree-js
```
Or include the CDN script in your HTML `index.html`:
```html
<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
```

### Step B: Unified Frontend Payment Component (React / JS)

```javascript
import React, { useState } from 'react';
import { load } from '@cashfreepayments/cashfree-js';

export function CourtCheckout({ bookingData }) {
  const [loading, setLoading] = useState(false);

  const handlePayAndBook = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // 1. Initialize Order via Unified Payment Endpoint
      const orderRes = await fetch('https://amdplayapi.amdtechno.in/api/v1/bookings/payment/order', {
        method: 'POST',
        headers,
        body: JSON.stringify(bookingData),
      });
      const orderResult = await orderRes.json();
      if (!orderResult.success) {
        throw new Error(orderResult.message || 'Failed to create order');
      }

      const orderData = orderResult.data;

      // 2A. Route to Cashfree Checkout if Cashfree is active
      if (orderData.gateway === 'cashfree') {
        const cashfree = await load({
          mode: orderData.environment?.toLowerCase() === 'prod' ? 'production' : 'sandbox',
        });

        // Launch Cashfree modal
        const cfCheckoutResult = await cashfree.checkout({
          paymentSessionId: orderData.paymentSessionId,
          redirectTarget: '_modal', // Opens sleek modal on top of your app
        });

        if (cfCheckoutResult.error) {
          alert('Cashfree payment failed or was closed: ' + cfCheckoutResult.error.message);
          setLoading(false);
          return;
        }

        // 3A. Verify Cashfree Payment
        const verifyRes = await fetch('https://amdplayapi.amdtechno.in/api/v1/bookings/payment/verify', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            gateway: 'cashfree',
            orderId: orderData.orderId,
            resourceId: bookingData.resourceId,
            date: bookingData.date,
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
            name: bookingData.customer?.name,
            phone: bookingData.customer?.phone,
            email: bookingData.customer?.email,
          }),
        });

        const verifyResult = await verifyRes.json();
        if (verifyResult.success) {
          alert(`Booking Confirmed! Access PIN: ${verifyResult.data.accessCode}`);
          window.location.href = `/booking-success?bookingNumber=${verifyResult.data.bookingNumber}`;
        }
      } 
      // 2B. Route to Razorpay Checkout if Razorpay is active
      else {
        const options = {
          key: orderData.keyId,
          amount: orderData.amountInPaise,
          currency: 'INR',
          order_id: orderData.orderId,
          name: 'Apex Sports Academy',
          description: `Booking for ${orderData.slot?.resourceName || 'Court'}`,
          handler: async function (response) {
            // 3B. Verify Razorpay Payment
            const verifyRes = await fetch('https://amdplayapi.amdtechno.in/api/v1/bookings/payment/verify', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                gateway: 'razorpay',
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                resourceId: bookingData.resourceId,
                date: bookingData.date,
                startTime: bookingData.startTime,
                endTime: bookingData.endTime,
                name: bookingData.customer?.name,
                phone: bookingData.customer?.phone,
                email: bookingData.customer?.email,
              }),
            });
            const verifyResult = await verifyRes.json();
            if (verifyResult.success) {
              alert(`Booking Confirmed! Access PIN: ${verifyResult.data.accessCode}`);
              window.location.href = `/booking-success?bookingNumber=${verifyResult.data.bookingNumber}`;
            }
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (err) {
      alert('Payment initialization failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handlePayAndBook} disabled={loading}>
      {loading ? 'Processing...' : 'Pay & Confirm Slot'}
    </button>
  );
}
```

---

## 6. Summary of All Available Endpoints

| Resource | Method | URL | Gateway Routing |
| :--- | :--- | :--- | :--- |
| **Settings** | `GET` | `/api/v1/settings` | Returns active gateway & configs |
| **Settings** | `PATCH` | `/api/v1/settings` | Updates active gateway & configs |
| **Settings** | `POST` | `/api/v1/settings/payment-gateways/test` | Tests Cashfree / Razorpay connectivity |
| **Court Bookings** | `POST` | `/api/v1/bookings/payment/order` | **Dynamic Router (Auto-selects active gateway)** |
| **Court Bookings** | `POST` | `/api/v1/bookings/payment/verify` | **Dynamic Router (Auto-verifies active gateway)** |
| **Court Bookings** | `POST` | `/api/v1/bookings/cashfree/order` | Dedicated Cashfree Order |
| **Court Bookings** | `POST` | `/api/v1/bookings/cashfree/verify` | Dedicated Cashfree Verify |
| **Court Bookings** | `POST` | `/api/v1/bookings/razorpay/order` | Dedicated Razorpay Order (Untouched) |
| **Court Bookings** | `POST` | `/api/v1/bookings/razorpay/verify` | Dedicated Razorpay Verify (Untouched) |
| **Memberships** | `POST` | `/api/v1/memberships/cashfree/order` | Dedicated Cashfree Membership Order |
| **Memberships** | `POST` | `/api/v1/memberships/cashfree/verify` | Dedicated Cashfree Membership Verify |
| **Memberships** | `POST` | `/api/v1/memberships/razorpay/order` | Dedicated Razorpay Membership Order (Untouched) |
| **Memberships** | `POST` | `/api/v1/memberships/razorpay/verify` | Dedicated Razorpay Membership Verify (Untouched) |
| **Monthly Fees** | `POST` | `/api/v1/finance/monthly-fees/:id/cashfree/order` | Cashfree Student Coaching Fee Order |
| **Monthly Fees** | `POST` | `/api/v1/finance/monthly-fees/:id/cashfree/verify` | Cashfree Student Coaching Fee Verify |
| **Webhooks** | `POST` | `/api/v1/finance/webhook/cashfree` | Cashfree Webhook Listener |
| **Webhooks** | `POST` | `/api/v1/finance/webhook/razorpay` | Razorpay Webhook Listener (Untouched) |
