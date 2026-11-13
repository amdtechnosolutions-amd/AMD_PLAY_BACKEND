# 🏸 Court & Slot Booking - Complete Frontend & Mobile Integration Guide

> **Base URL (Production HTTPS):** `https://www.amdplayapi.amdtechno.in/api/v1`  
> **Direct Server URL:** `https://amdplayapi.amdtechno.in/api/v1`  
> **Local Staging URL:** `http://localhost:5005/api/v1`  
> **Interactive Swagger UI:** [https://www.amdplayapi.amdtechno.in/api/docs](https://www.amdplayapi.amdtechno.in/api/docs) *(Tag: `Sports & Resources Management` / `Bookings Management`)*  
> **Required Headers:**
> ```http
> Authorization: Bearer <ACCESS_TOKEN>
> x-tenant-id: <TENANT_ID>
> Content-Type: application/json
> ```

---

## Table of Contents
1. [Overview & Role-Based Navigation](#1-overview--role-based-navigation)
2. [Quick Endpoint Summary](#2-quick-endpoint-summary)
3. [Dashboard Integration: How to Show Slot Booking on the Home Screen](#3-dashboard-integration-how-to-show-slot-booking-on-the-home-screen)
   - [Student / Trainee Home Dashboard](#student--trainee-home-dashboard)
   - [Member / Pay & Play Player Home Dashboard](#member--pay--play-player-home-dashboard)
   - [Coach / Trainer Home Dashboard](#coach--trainer-home-dashboard)
4. [Step-by-Step Slot Booking Flow](#4-step-by-step-slot-booking-flow)
   - [Step 1: Sports & Active Courts Discovery](#step-1-sports--active-courts-discovery)
   - [Step 2: Real-Time Slot Availability Grid](#step-2-real-time-slot-availability-grid)
   - [Step 3: 5-Minute Atomic Slot Lock / Hold](#step-3-5-minute-atomic-slot-lock--hold)
   - [Step 4: Dynamic Price Calculation & Quote](#step-4-dynamic-price-calculation--quote)
   - [Step 5: Checkout & Payment (Razorpay SDK / Instant)](#step-5-checkout--payment-razorpay-sdk--instant)
   - [Step 6: Smart Gate Access Pass & 6-Digit PIN](#step-6-smart-gate-access-pass--6-digit-pin)
   - [Step 7: My Bookings & Pass History](#step-7-my-bookings--pass-history)
5. [Complete API Request & Response Specifications](#5-complete-api-request--response-specifications)
6. [Ready-to-Use Flutter Dart Implementation Code](#6-ready-to-use-flutter-dart-implementation-code)
   - [Widget 1: `DashboardBookingBanner` (Home Screen Quick Action Card)](#widget-1-dashboardbookingbanner-home-screen-quick-action-card)
   - [Widget 2: `CourtSlotBookingScreen` (Complete Booking Screen)](#widget-2-courtslotbookingscreen-complete-booking-screen)
   - [Widget 3: `BookingPassCard` (Gate Access Pass with PIN & QR)](#widget-3-bookingpasscard-gate-access-pass-with-pin--qr)
   - [Service: `BookingApiClient` (Dio Network Client)](#service-bookingapiclient-dio-network-client)

---

## 1. Overview & Role-Based Navigation

The platform supports **seamless court slot booking across all three authenticated roles**:

| User Role | Home Screen Experience | Bottom Nav Bar Position | Booking Privileges |
|:---|:---|:---:|:---|
| **Student** (`student`) | Coaching Academy Dashboard + Quick Practice Court Booking Card | **Tab Index 1** (`"Book"`) | Can book practice courts for self or linked siblings. Receives 6-digit gate PIN. |
| **Member / Player** (`customer`, `member`) | Large **"BOOK COURT SLOT NOW"** Hero Banner + Upcoming Passes | **Tab Index 1** (`"Book"`) | Standard Pay & Play court booking with Razorpay checkout & smart gate pass. |
| **Coach** (`coach`, `trainer`) | Today's Training Schedule + Quick "Book Training Court" Action | **Tab Index 3** (`"Book"`) | Can reserve slots for student 1-on-1 sessions, personal practice, or walk-ins. |

### Bottom Navigation Bar Tabs by Role
- **Student Navigation Tabs (5 tabs):**
  1. `Home` (Index 0) — Coaching Overview, Scorecards, Batches, Attendance, Fees & Quick Court Card
  2. `Book` (Index 1) — **Court Slot Booking Matrix**
  3. `Attendance` (Index 2) — Biometric Face/Punch Attendance Logs & Sibling Switcher
  4. `Payments` (Index 3) — Coaching Monthly Fees & Invoices
  5. `Profile` (Index 4) — Student & Sibling Family Profile
- **Member / Player Navigation Tabs (4 tabs):**
  1. `Home` (Index 0) — Hero Booking Card & Recent Passes
  2. `Book` (Index 1) — **Court Slot Booking Matrix**
  3. `Payments` (Index 2) — Payment Ledger & Invoices
  4. `Profile` (Index 3) — User Profile & Contact Info
- **Coach Navigation Tabs (5 tabs):**
  1. `Home` (Index 0) — Today's Schedule & Batches
  2. `Batches` (Index 1) — Assigned Student Batches
  3. `Evaluations` (Index 2) — 24-Metric Student Performance Scoring
  4. `Book` (Index 3) — **Court Slot Booking Matrix**
  5. `Profile` (Index 4) — Coach Profile

---

## 2. Quick Endpoint Summary

| # | Action | Method | URL Path | Description |
|:---|:---|:---:|:---|:---|
| 1 | **List Sports** | `GET` | `/sports` | Active sports catalog (Badminton, Turf, Pickleball, Tennis) |
| 2 | **List Active Courts** | `GET` | `/resources/active` | Active courts/turfs with branch and sport details |
| 3 | **List All Courts** | `GET` | `/resources` | Paginated courts catalog |
| 4 | **Slot Availability Grid** | `GET` | `/slots?resourceId=<id>&date=YYYY-MM-DD` | Hourly slot matrix (available, booked, held, coaching batch) |
| 5 | **Branch Slot Matrix** | `GET` | `/slots/grid?branchId=<id>&date=YYYY-MM-DD` | Multi-court visual grid for date |
| 6 | **Atomic Slot Hold** | `POST` | `/slots/hold` | Locks 1 or multiple slots for 5 mins during checkout |
| 7 | **Atomic Slot Release** | `POST` | `/slots/release` | Releases held slot(s) if user abandons checkout |
| 8 | **Calculate Price Quote** | `POST` | `/slots/calculate-price` | Computes subtotal, tax, member discount, and grand total |
| 9 | **Create Razorpay Order** | `POST` | `/bookings/razorpay/order` | Initializes Razorpay order with `orderId` and currency |
| 10 | **Verify Razorpay Payment** | `POST` | `/bookings/razorpay/verify` | Confirms payment, books court, and returns 6-digit gate PIN |
| 11 | **Instant / Walk-In Booking** | `POST` | `/bookings` | Direct booking confirmation (cash, admin desk, wallet) |
| 12 | **My Bookings & Passes** | `GET` | `/bookings/my` | Authenticated user's booking history and active gate PIN passes |
| 13 | **Booking Details & Invoice** | `GET` | `/bookings/:id` | Full booking details, receipts, and biometric gate code |
| 14 | **Cancel Booking** | `POST` | `/bookings/:id/cancel` | Cancels reservation and releases slot back to inventory |

---

## 3. Dashboard Integration: How to Show Slot Booking on the Home Screen

To ensure users never miss slot booking, **add a Quick Booking Action Card to the Home Dashboard** across all 3 logins.

### Student / Trainee Home Dashboard
On the student home dashboard (alongside coaching scorecards and attendance cards), insert the **"Book Practice Court"** card:
- **Title:** `Book Practice Court`
- **Subtitle:** `Reserve an open court for extra training or play with siblings`
- **CTA Button:** `CHECK OPEN SLOTS`
- **Action:** Calls `Navigator.pushNamed(context, '/slot-booking')` or sets bottom navigation tab index to `1`.

### Member / Pay & Play Player Home Dashboard
The home screen displays a prominent **Hero Banner**:
- **Title:** `BOOK COURT SLOT NOW`
- **Subtitle:** `Instant smart gate PIN & automated court lighting`
- **Sport Selector Chips:** `[🏸 Badminton, ⚽ Football Turf, 🏓 Table Tennis]`
- **Action:** Directly opens the slot grid for the selected sport.

### Coach / Trainer Home Dashboard
On the coach home screen (below Today's Batch Schedule):
- **Title:** `Reserve Court Slot`
- **Subtitle:** `Book an available court for personal training or private coaching`
- **CTA Button:** `OPEN SCHEDULE MATRIX`
- **Action:** Sets bottom navigation tab index to `3` (Book tab) or opens `/slot-booking`.

---

## 4. Step-by-Step Slot Booking Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SLOT BOOKING LIFECYCLE                          │
├────────────────────────────────────────────────────────────────────────┤
│ 1. DISCOVERY                                                           │
│    GET /api/v1/sports              -> Select Sport                     │
│    GET /api/v1/resources/active     -> Select Court (e.g. COURT 1)      │
│                                                                        │
│ 2. AVAILABILITY MATRIX                                                 │
│    GET /api/v1/slots?resourceId=...&date=YYYY-MM-DD                    │
│    -> Render Hourly Slots Grid (06:00 - 23:00)                          │
│                                                                        │
│ 3. 5-MINUTE ATOMIC HOLD (Anti-Double Booking)                         │
│    POST /api/v1/slots/hold                                             │
│    -> Slot status changes to 'held' with 5-minute countdown timer       │
│                                                                        │
│ 4. PRICING BREAKDOWN                                                   │
│    POST /api/v1/slots/calculate-price                                  │
│    -> Returns basePrice, taxes, discounts, finalAmount                 │
│                                                                        │
│ 5. CHECKOUT & PAYMENT                                                  │
│    POST /api/v1/bookings/razorpay/order  -> Receive Razorpay orderId    │
│    Razorpay Flutter SDK Payment Sheet                                  │
│    POST /api/v1/bookings/razorpay/verify -> Confirm & Generate Pass    │
│                                                                        │
│ 6. PASS GENERATION                                                     │
│    -> 6-Digit Gate Access PIN (e.g. 482190) + Dynamic Turnstile QR     │
│    -> Automated Court Lighting triggered at slot start time            │
│                                                                        │
│ 7. MY PASSES & HISTORY                                                 │
│    GET /api/v1/bookings/my                                             │
│    -> View active gate passes anytime                                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Complete API Request & Response Specifications

### Step 1: Active Courts & Sports Discovery

#### 1.1 List Sports Catalog
- **Endpoint:** `GET /api/v1/sports`
- **Auth:** Optional (`authenticateOptional`)
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "6ad6bdead33a91a36c41ff5b",
      "name": "Badminton",
      "icon": "badminton",
      "status": "active"
    },
    {
      "_id": "6ad6be011ee0aaebb67610aa",
      "name": "Football Turf",
      "icon": "sports_soccer",
      "status": "active"
    }
  ]
}
```

#### 1.2 List Active Courts
- **Endpoint:** `GET /api/v1/resources/active`
- **Auth:** Required (Bearer Token)
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "6ad6be7a1ee0aaebb67610be",
      "name": "COURT 1",
      "code": "TRF-C1",
      "surface": "Synthetic Wood",
      "sportId": "6ad6bdead33a91a36c41ff5b",
      "branchId": "6ad6bd7fd33a91a36c41ff46",
      "hourlyRate": 400,
      "status": "active"
    },
    {
      "_id": "6ad6be9a6fd55c09f9791083",
      "name": "COURT 2",
      "code": "TRF-C2",
      "surface": "Synthetic Wood",
      "sportId": "6ad6bdead33a91a36c41ff5b",
      "branchId": "6ad6bd7fd33a91a36c41ff46",
      "hourlyRate": 400,
      "status": "active"
    },
    {
      "_id": "6ad6beb7d33a91a36c41ff7b",
      "name": "COURT 3",
      "code": "TRF-C3",
      "surface": "Synthetic Wood",
      "sportId": "6ad6bdead33a91a36c41ff5b",
      "branchId": "6ad6bd7fd33a91a36c41ff46",
      "hourlyRate": 400,
      "status": "active"
    },
    {
      "_id": "6adfd230b968550380613b78",
      "name": "TRUF",
      "code": "TRF-T",
      "surface": "FIFA Artificial Turf",
      "sportId": "6ad6be011ee0aaebb67610aa",
      "branchId": "6ad6bd7fd33a91a36c41ff46",
      "hourlyRate": 1200,
      "status": "active"
    }
  ]
}
```

---

### Step 2: Slot Availability Grid

- **Endpoint:** `GET /api/v1/slots`
- **Query Parameters:**
  - `resourceId`: Court ID (e.g. `6ad6be7a1ee0aaebb67610be`)
  - `date`: `YYYY-MM-DD` (e.g. `2026-11-14`)
- **Headers:**
  ```http
  Authorization: Bearer <TOKEN>
  x-tenant-id: 6ad6bd7fd33a91a36c41ff44
  ```

#### Response (`200 OK`):
```json
{
  "success": true,
  "message": "Slots retrieved successfully",
  "data": {
    "date": "2026-11-14",
    "isOpen": true,
    "courtName": "COURT 1",
    "totalSlots": 24,
    "availableSlots": 20,
    "slots": [
      {
        "slotIndex": 6,
        "startTime": "06:00",
        "endTime": "07:00",
        "status": "coaching_batch",
        "isPeak": false,
        "price": 400,
        "reason": "Reserved for Academy Batch: Beginner Morning"
      },
      {
        "slotIndex": 7,
        "startTime": "07:00",
        "endTime": "08:00",
        "status": "available",
        "isPeak": false,
        "price": 400
      },
      {
        "slotIndex": 18,
        "startTime": "18:00",
        "endTime": "19:00",
        "status": "available",
        "isPeak": true,
        "price": 500
      },
      {
        "slotIndex": 19,
        "startTime": "19:00",
        "endTime": "20:00",
        "status": "booked",
        "isPeak": true,
        "price": 500
      }
    ]
  }
}
```

> **Slot Status Legend:**
> - `available` -> Green / Tap to select
> - `booked` -> Red / Already booked
> - `held` -> Orange / Locked by another user (5-minute checkout countdown)
> - `coaching_batch` -> Blue / Scheduled student coaching session
> - `maintenance` -> Grey / Court closed for maintenance

---

### Step 3: Atomic 5-Minute Slot Hold (Double-Booking Prevention)

Locks the slot across all users for 300 seconds while the player proceeds through checkout.

- **Endpoint:** `POST /api/v1/slots/hold`
- **Request Body (Single Slot or Multi-Slot):**
```json
{
  "resourceId": "6ad6be7a1ee0aaebb67610be",
  "date": "2026-11-14",
  "startTime": "07:00",
  "endTime": "08:00"
}
```
*Multi-Slot Variant:*
```json
{
  "slots": [
    {
      "resourceId": "6ad6be7a1ee0aaebb67610be",
      "date": "2026-11-14",
      "startTime": "07:00",
      "endTime": "08:00"
    },
    {
      "resourceId": "6ad6be7a1ee0aaebb67610be",
      "date": "2026-11-14",
      "startTime": "08:00",
      "endTime": "09:00"
    }
  ]
}
```

#### Response (`200 OK`):
```json
{
  "success": true,
  "message": "Slot(s) held successfully for 5 minutes",
  "data": {
    "held": true,
    "holdExpiresAt": "2026-11-14T01:35:00.000Z",
    "expiresInSeconds": 300
  }
}
```

*(If user cancels checkout, release the hold immediately via `POST /api/v1/slots/release` with the same payload).*

---

### Step 4: Calculate Dynamic Price Quote

- **Endpoint:** `POST /api/v1/slots/calculate-price`
- **Request Body:**
```json
{
  "slots": [
    {
      "resourceId": "6ad6be7a1ee0aaebb67610be",
      "date": "2026-11-14",
      "startTime": "07:00",
      "endTime": "08:00"
    }
  ]
}
```

#### Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "subtotal": 400,
    "discount": 0,
    "taxAmount": 72,
    "finalAmount": 472,
    "currency": "INR",
    "slots": [
      {
        "resourceId": "6ad6be7a1ee0aaebb67610be",
        "date": "2026-11-14",
        "startTime": "07:00",
        "endTime": "08:00",
        "basePrice": 400,
        "isPeak": false,
        "courtName": "COURT 1"
      }
    ]
  }
}
```

---

### Step 5: Checkout & Payment (Razorpay Flow)

#### 5.1 Initialize Razorpay Order
- **Endpoint:** `POST /api/v1/bookings/razorpay/order`
- **Request Body:**
```json
{
  "slots": [
    {
      "resourceId": "6ad6be7a1ee0aaebb67610be",
      "date": "2026-11-14",
      "startTime": "07:00",
      "endTime": "08:00"
    }
  ],
  "paymentMethod": "upi",
  "notes": "Morning badminton session"
}
```

#### Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "orderId": "order_Rp109823489123",
    "amount": 47200,
    "currency": "INR",
    "key": "rzp_live_xxxxxxxxxxxxxx",
    "bookingSummary": {
      "totalSlots": 1,
      "courtName": "COURT 1",
      "date": "2026-11-14",
      "startTime": "07:00",
      "endTime": "08:00"
    }
  }
}
```

#### 5.2 Verify Razorpay Payment & Confirm Booking
After the player completes the payment in the Razorpay Flutter SDK:
- **Endpoint:** `POST /api/v1/bookings/razorpay/verify`
- **Request Body:**
```json
{
  "razorpay_order_id": "order_Rp109823489123",
  "razorpay_payment_id": "pay_Rp109899182312",
  "razorpay_signature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "slots": [
    {
      "resourceId": "6ad6be7a1ee0aaebb67610be",
      "date": "2026-11-14",
      "startTime": "07:00",
      "endTime": "08:00"
    }
  ],
  "notes": "Morning badminton session"
}
```

#### Response (`200 OK`) — Instant Gate Access Pass & PIN:
```json
{
  "success": true,
  "message": "Payment verified and booking confirmed successfully",
  "data": {
    "bookingId": "6af812904a48312c84394001",
    "bookingNumber": "BK-20261114-0012",
    "status": "confirmed",
    "accessCode": "482190",
    "qrCode": "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=BK482190",
    "courtName": "COURT 1",
    "sportName": "Badminton",
    "date": "2026-11-14",
    "startTime": "07:00",
    "endTime": "08:00",
    "amountPaid": 472,
    "pinNotice": "Enter PIN 482190 on the entry gate keypad or scan QR code to unlock."
  }
}
```

---

### Step 6: Dedicated Personal Bookings & Passes (`GET /bookings/my`)

Retrieves all reservations for the logged-in user (Student, Member, or Coach) to populate the **"My Bookings"** tab.

- **Endpoint:** `GET /api/v1/bookings/my`
- **Headers:**
  ```http
  Authorization: Bearer <TOKEN>
  x-tenant-id: 6ad6bd7fd33a91a36c41ff44
  ```

#### Response (`200 OK`):
```json
{
  "success": true,
  "message": "Personal bookings retrieved successfully",
  "data": [
    {
      "_id": "6af812904a48312c84394001",
      "bookingNumber": "BK-20261114-0012",
      "status": "confirmed",
      "accessCode": "482190",
      "date": "2026-11-14",
      "startTime": "07:00",
      "endTime": "08:00",
      "resourceId": {
        "_id": "6ad6be7a1ee0aaebb67610be",
        "name": "COURT 1",
        "code": "TRF-C1"
      },
      "pricing": {
        "finalAmount": 472
      },
      "payment": {
        "status": "success",
        "method": "upi",
        "transactionId": "pay_Rp109899182312"
      },
      "createdAt": "2026-11-13T21:40:00.000Z"
    }
  ]
}
```

---

## 6. Ready-to-Use Flutter Dart Implementation Code

### Widget 1: `DashboardBookingBanner` (Home Screen Quick Action Card)
*Drop this widget directly into your Student, Member, or Coach Home Screen column:*

```dart
import 'package:flutter/material.dart';

class DashboardBookingBanner extends StatelessWidget {
  final String role; // 'student', 'coach', or 'customer'
  final VoidCallback onBookTap;

  const DashboardBookingBanner({
    Key? key,
    required this.role,
    required this.onBookTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final isStudent = role.toLowerCase() == 'student';
    final isCoach = role.toLowerCase() == 'coach' || role.toLowerCase() == 'trainer';

    final title = isCoach
        ? 'Reserve Training Court'
        : isStudent
            ? 'Book Practice Court'
            : 'BOOK COURT SLOT NOW';

    final subtitle = isCoach
        ? 'Book an open court for personal training or private coaching'
        : isStudent
            ? 'Reserve an open court for extra training or family play'
            : 'Instant smart gate PIN & automated court lighting';

    final buttonLabel = isCoach ? 'OPEN SCHEDULE' : 'BOOK COURT NOW';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF38BDF8).withOpacity(0.3), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF38BDF8).withOpacity(0.12),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF38BDF8).withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.sports_tennis, color: Color(0xFF38BDF8), size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.7),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: ElevatedButton.icon(
              onPressed: onBookTap,
              icon: const Icon(Icons.flash_on, size: 18, color: Colors.black),
              label: Text(
                buttonLabel,
                style: const TextStyle(
                  color: Colors.black,
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                  letterSpacing: 0.5,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF38BDF8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
```

---

### Widget 2: `BookingPassCard` (Gate Access Pass with PIN & QR)

```dart
import 'package:flutter/material.dart';

class BookingPassCard extends StatelessWidget {
  final Map<String, dynamic> booking;

  const BookingPassCard({Key? key, required this.booking}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final courtName = booking['resourceId']?['name'] ?? booking['courtName'] ?? 'Court';
    final date = booking['date'] ?? '';
    final startTime = booking['startTime'] ?? '';
    final endTime = booking['endTime'] ?? '';
    final accessCode = booking['accessCode'] ?? '------';
    final bookingNumber = booking['bookingNumber'] ?? '';

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      color: const Color(0xFF1E293B),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  courtName,
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.green.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text('CONFIRMED', style: TextStyle(color: Colors.green, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text('$date \u2022 $startTime - $endTime', style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13)),
            const Divider(color: Colors.white24, height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('GATE ACCESS PIN', style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(
                      accessCode,
                      style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 28, fontWeight: FontWeight.w900, letterSpacing: 4),
                    ),
                  ],
                ),
                Icon(Icons.qr_code_2, size: 52, color: Colors.white.withOpacity(0.85)),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Ref: $bookingNumber \u2022 Enter PIN on turnstile gate to enter.',
              style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

### Service: `BookingApiClient` (Dio Network Client)

```dart
import 'package:dio/dio.dart';

class BookingApiClient {
  final Dio dio;
  final String tenantId;

  BookingApiClient({required this.dio, required this.tenantId});

  /// 1. Fetch Sports
  Future<List<dynamic>> getSports() async {
    final res = await dio.get('/sports');
    return res.data['data'] as List<dynamic>;
  }

  /// 2. Fetch Active Courts
  Future<List<dynamic>> getActiveCourts() async {
    final res = await dio.get('/resources/active', options: Options(headers: {'x-tenant-id': tenantId}));
    return res.data['data'] as List<dynamic>;
  }

  /// 3. Fetch Slot Grid for Court & Date
  Future<Map<String, dynamic>> getSlots(String resourceId, String date) async {
    final res = await dio.get(
      '/slots',
      queryParameters: {'resourceId': resourceId, 'date': date},
      options: Options(headers: {'x-tenant-id': tenantId}),
    );
    return res.data['data'] as Map<String, dynamic>;
  }

  /// 4. Hold Slot for 5 Minutes
  Future<bool> holdSlot(String resourceId, String date, String startTime, String endTime) async {
    final res = await dio.post(
      '/slots/hold',
      data: {'resourceId': resourceId, 'date': date, 'startTime': startTime, 'endTime': endTime},
      options: Options(headers: {'x-tenant-id': tenantId}),
    );
    return res.data['data']?['held'] == true;
  }

  /// 5. Release Slot Hold
  Future<void> releaseSlot(String resourceId, String date, String startTime, String endTime) async {
    await dio.post(
      '/slots/release',
      data: {'resourceId': resourceId, 'date': date, 'startTime': startTime, 'endTime': endTime},
      options: Options(headers: {'x-tenant-id': tenantId}),
    );
  }

  /// 6. Initialize Razorpay Gateway Order
  Future<Map<String, dynamic>> createRazorpayOrder(List<Map<String, dynamic>> slots, {String? notes}) async {
    final res = await dio.post(
      '/bookings/razorpay/order',
      data: {'slots': slots, 'paymentMethod': 'upi', 'notes': notes},
      options: Options(headers: {'x-tenant-id': tenantId}),
    );
    return res.data['data'] as Map<String, dynamic>;
  }

  /// 7. Verify Payment & Confirm
  Future<Map<String, dynamic>> verifyRazorpayPayment({
    required String orderId,
    required String paymentId,
    required String signature,
    required List<Map<String, dynamic>> slots,
    String? notes,
  }) async {
    final res = await dio.post(
      '/bookings/razorpay/verify',
      data: {
        'razorpay_order_id': orderId,
        'razorpay_payment_id': paymentId,
        'razorpay_signature': signature,
        'slots': slots,
        'notes': notes,
      },
      options: Options(headers: {'x-tenant-id': tenantId}),
    );
    return res.data['data'] as Map<String, dynamic>;
  }

  /// 8. Fetch My Bookings & Passes
  Future<List<dynamic>> getMyBookings() async {
    final res = await dio.get('/bookings/my', options: Options(headers: {'x-tenant-id': tenantId}));
    return res.data['data'] as List<dynamic>;
  }
}
```

---
*Created for AMD Sports SaaS Platform - Slot Booking Frontend Integration Specification*

