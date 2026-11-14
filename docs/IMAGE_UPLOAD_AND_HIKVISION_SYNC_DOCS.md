# Image Upload & Hikvision Biometric Face Sync API Documentation

This document provides complete technical specifications, API endpoint definitions, request/response formats, device sync workflows, and frontend integration code snippets for uploading face images and synchronizing them across **Hikvision biometric face recognition terminals ("hi devices")** for **Students**, **Members**, and **Coaches / Staff**.

---

## 1. Architecture & Synchronization Workflow

```
┌────────────────────────────────┐
│   Frontend / Mobile Client     │
│ (Web / Flutter / React Native) │
└───────────────┬────────────────┘
                │
                │ 1. POST /api/v1/{students|members|staff}/:id/face
                │    Payload: { "faceImageBase64": "data:image/jpeg;base64,..." }
                ▼
┌────────────────────────────────────────────────────────┐
│             Sports Academy Backend API                 │
│         https://amdplayapi.amdtechno.in                │
├────────────────────────────────────────────────────────┤
│ 1. Validate user & permission                          │
│ 2. Decode Base64 & save JPEG to `uploads/avatars/`     │
│ 3. Update User document:                               │
│    - `user.avatar` = `/api/v1/uploads/avatars/...jpg`  │
│    - `user.metadata.facePhotoUrl` = avatarUrl          │
└───────┬────────────────────────────────────────┬───────┘
        │                                        │
        │ 4. Direct ISAPI Digest Push            │ 5. Offline fallback
        ▼                                        ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  Hikvision Biometric Terminals│        │     Device Sync Queue        │
│  - DEV-ISA-ACCESS (Port 4231)│        │ (Automated offline retry via │
│  - DEV-ISA-TRUF   (Port 4211)│        │  device-sync-queue.service)  │
├──────────────────────────────┤        └──────────────────────────────┘
│ • /ISAPI/AccessControl/      │
│   UserInfo/Record            │
│ • /ISAPI/Intelligent/FDLib/  │
│   FaceDataRecord (Multipart) │
│ • /ISAPI/Intelligent/FDLib/  │
│   FDSetUp (Face Update)      │
└──────────────────────────────┘
```

---

## 2. API Endpoints Overview

| Target Role | Endpoint | HTTP Method | Allowed Roles / Auth |
| :--- | :--- | :--- | :--- |
| **Students** | `/api/v1/students/:id/face` | `POST` | `tenant_admin`, `branch_manager`, `coach`, `student` (self/sibling) |
| **Students (Coaching Alias)** | `/api/v1/coaching/students/:id/face` | `POST` | `tenant_admin`, `branch_manager`, `coach` |
| **Members** | `/api/v1/members/:id/face` | `POST` | `tenant_admin`, `branch_manager`, `staff`, `member` (self) |
| **Coaches & Staff** | `/api/v1/staff/:id/face` | `POST` | `tenant_admin`, `branch_manager`, `staff`, `coach` (self) |
| **Current User (Self)** | `/api/v1/users/me/face` | `POST` | Any authenticated user (Student, Member, Coach) |
| **Admin Generic User** | `/api/v1/users/:id/face` | `POST` | `tenant_admin`, `branch_manager`, `super_admin` |
| **Serve Avatar Image** | `/api/v1/uploads/avatars/:filename` | `GET` | **Public** (Supports direct `<img src="...">` rendering) |

---

## 3. Image & Photo Specifications for Hikvision Biometric Terminals

For the terminal's onboard facial recognition AI model to extract biometric feature points (eyes, nose, mouth) successfully:

- **Image Format**: JPEG/JPG (recommended) or PNG.
- **Recommended Resolution**: `640 x 480` px to `1280 x 720` px (minimum `200 x 200` px).
- **File Size**: Between **50 KB** and **2 MB**.
- **Facial Requirements**:
  - Front-facing portrait (head tilted less than 15 degrees).
  - Clear facial features with good, balanced lighting.
  - Neutral facial expression, mouth closed, eyes open.
  - No dark sunglasses, hats, or face masks.
  - Single person in the photo (no multiple faces in background).

---

## 4. Endpoint Specifications

### 4.1. Upload Student Face Photo
- **URL**: `POST /api/v1/students/:id/face`
- **Headers**:
  ```http
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "faceImageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."
  }
  ```
  *(Note: `faceImageBase64`, `photo`, `avatar`, or `image` field keys are all supported. Data URI headers like `data:image/jpeg;base64,` are automatically stripped).*

- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Student face photo uploaded and synced successfully",
    "data": {
      "userId": "6ae3bfa56989d6280874ef35",
      "employeeNo": "isabd003",
      "name": "Keshika Devan",
      "role": "student",
      "avatarUrl": "/api/v1/uploads/avatars/6ae3bfa56989d6280874ef35_1794648543207.jpg",
      "devices": [
        {
          "deviceId": "6ad8c1d0dd7f06d75726aa29",
          "code": "DEV-ISA-ACCESS",
          "name": "ISA_BADMINTON_ACCESS",
          "ipAddress": "64.4.193.66",
          "port": 4231,
          "status": "SUCCESS",
          "message": "Face photo registered on terminal",
          "details": {
            "statusCode": 1,
            "statusString": "OK",
            "subStatusCode": "ok"
          }
        },
        {
          "deviceId": "6ad8c6c5449015c23d2e3dbe",
          "code": "DEV-ISA-TRUF",
          "name": "ISA_TRUF",
          "ipAddress": "64.4.193.66",
          "port": 4211,
          "status": "SUCCESS",
          "message": "Face photo registered on terminal",
          "details": {
            "statusCode": 1,
            "statusString": "OK",
            "subStatusCode": "ok"
          }
        }
      ]
    }
  }
  ```

---

### 4.2. Upload Member Face Photo
- **URL**: `POST /api/v1/members/:id/face`
- **Headers**:
  ```http
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "faceImageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Member face photo uploaded and synced to biometric terminals successfully",
    "data": {
      "userId": "6ad9db91aafcc283764b5ed6",
      "employeeNo": "inembd008",
      "name": "Arun",
      "role": "member",
      "avatarUrl": "/api/v1/uploads/avatars/6ad9db91aafcc283764b5ed6_1794648547317.jpg",
      "devices": [
        {
          "deviceId": "6ad8c1d0dd7f06d75726aa29",
          "code": "DEV-ISA-ACCESS",
          "name": "ISA_BADMINTON_ACCESS",
          "ipAddress": "64.4.193.66",
          "port": 4231,
          "status": "SUCCESS",
          "message": "Face photo registered on terminal"
        }
      ]
    }
  }
  ```

---

### 4.3. Upload Coach / Staff Face Photo
- **URL**: `POST /api/v1/staff/:id/face`
- **Headers**:
  ```http
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "faceImageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Staff/Coach face photo uploaded and synced to biometric terminals successfully",
    "data": {
      "userId": "6adf447b60f40fbec7d827a8",
      "employeeNo": "9894789477",
      "name": "Arunmozhidevan",
      "role": "coach",
      "avatarUrl": "/api/v1/uploads/avatars/6adf447b60f40fbec7d827a8_1794648549338.jpg",
      "devices": [
        {
          "deviceId": "6ad8c1d0dd7f06d75726aa29",
          "code": "DEV-ISA-ACCESS",
          "name": "ISA_BADMINTON_ACCESS",
          "ipAddress": "64.4.193.66",
          "port": 4231,
          "status": "SUCCESS",
          "message": "Face photo registered on terminal"
        }
      ]
    }
  }
  ```

---

### 4.4. Current User Self Face Upload
- **URL**: `POST /api/v1/users/me/face`
- **Headers**:
  ```http
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```
- Allows any logged-in user (Student, Member, or Coach) to upload their own face photo without needing admin privileges.

---

### 4.5. Stream Uploaded Avatar / Face Photo
- **URL**: `GET /api/v1/uploads/avatars/:filename`
- **Example**: `GET https://amdplayapi.amdtechno.in/api/v1/uploads/avatars/6ae3bfa56989d6280874ef35_1794648543207.jpg`
- **Response Headers**:
  ```http
  Content-Type: image/jpeg
  Cache-Control: public, max-age=604800, must-revalidate
  ```
- Returns raw binary image data directly.

---

## 5. Frontend Integration Snippets

### 5.1. React / Vue / Vanilla JavaScript
```javascript
async function uploadFacePhoto(role, userId, file, token) {
  // 1. Convert File to Base64
  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // 2. Select endpoint based on role: 'students', 'members', 'staff', or 'users/me'
  const endpoint = role === 'self' 
    ? '/api/v1/users/me/face' 
    : `/api/v1/${role}/${userId}/face`;

  // 3. Send upload request
  const response = await fetch(`https://amdplayapi.amdtechno.in${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      faceImageBase64: base64Data
    })
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || 'Failed to upload face photo');
  }

  console.log('Upload & Sync successful:', result.data);
  return result.data;
}
```

---

### 5.2. Flutter / Dart
```dart
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

Future<Map<String, dynamic>> uploadFacePhoto({
  required String role, // 'students', 'members', 'staff', or 'users/me'
  required String userId,
  required File imageFile,
  required String token,
}) async {
  // 1. Read bytes and convert to Base64
  final bytes = await imageFile.readAsBytes();
  final base64Image = base64Encode(bytes);

  final url = role == 'self'
      ? 'https://amdplayapi.amdtechno.in/api/v1/users/me/face'
      : 'https://amdplayapi.amdtechno.in/api/v1/$role/$userId/face';

  // 2. Send POST request
  final response = await http.post(
    Uri.parse(url),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode({
      'faceImageBase64': 'data:image/jpeg;base64,$base64Image',
    }),
  );

  final resData = jsonDecode(response.body);
  if (response.statusCode == 200 && resData['success'] == true) {
    print('Avatar URL: ${resData['data']['avatarUrl']}');
    return resData['data'];
  } else {
    throw Exception(resData['message'] ?? 'Failed to upload face photo');
  }
}
```

---

## 6. How Hikvision Biometric Terminal Sync Works Under the Hood

1. **Pre-enrollment (`UserInfo/Record`)**:
   The backend ensures the user exists on the Hikvision terminal with their `employeeNo`, `name`, `role`, card number, and door access permissions.
2. **Face Registration (`FaceDataRecord` Multipart)**:
   The backend constructs an HTTP multipart request with:
   - Part 1: JSON payload (`faceLibType: "blackFD"`, `FDID: "1"`, `FPID: employeeNo`).
   - Part 2: Binary JPEG buffer (`name="img"`, `filename="<employeeNo>.jpg"`).
3. **Face Update (`FDSetUp` PUT)**:
   If the user already has a face on the terminal (`deviceUserAlreadyExistFace`), the backend automatically issues a `PUT /ISAPI/Intelligent/FDLib/FDSetUp?format=json` multipart request to overwrite the existing face data.
4. **Offline Fault Tolerance (`DeviceSyncQueue`)**:
   If a biometric terminal is offline or unreachable during the upload, the backend stores the job in `DeviceSyncQueue` (`action: "UPLOAD_FACE"`). The queue worker automatically retries pushing the face once the terminal comes back online.
