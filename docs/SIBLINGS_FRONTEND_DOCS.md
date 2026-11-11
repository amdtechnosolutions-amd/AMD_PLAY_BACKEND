# 👨‍👩‍👦 Sibling & Family Management - Frontend Developer & Integration Guide

> **Target Platforms:** Flutter Web / Mobile (Dart + Dio) & Admin Web (React / TypeScript / Axios)  
> **Backend Base URL (Production):** `https://www.amdplayapi.amdtechno.in/api/v1`  
> **Backend Base URL (Local Dev):** `http://localhost:5005/api/v1`  
> **Interactive Swagger UI:** [https://www.amdplayapi.amdtechno.in/api/docs](https://www.amdplayapi.amdtechno.in/api/docs) *(Tag: `Students Management` / `Sibling Profiles`)*

---

## Table of Contents
1. [Executive Overview & UX Philosophy](#1-executive-overview--ux-philosophy)
2. [API Endpoints Quick Reference](#2-api-endpoints-quick-reference)
3. [Flutter / Dart Integration Guide (Dio)](#3-flutter--dart-integration-guide-dio)
   - [3.1 Dart Models (`lib/models/sibling_model.dart`)](#31-dart-models)
   - [3.2 Flutter Service (`lib/services/sibling_service.dart`)](#32-flutter-service)
   - [3.3 Flutter Controller / State (`lib/controllers/sibling_controller.dart`)](#33-flutter-controller)
   - [3.4 Ready-to-use Flutter UI Widgets](#34-ready-to-use-flutter-ui-widgets)
4. [React / TypeScript Integration Guide (Axios)](#4-react--typescript-integration-guide-axios)
   - [4.1 TypeScript Interfaces (`types/sibling.ts`)](#41-typescript-interfaces)
   - [4.2 Axios API Service (`services/siblingService.ts`)](#42-axios-api-service)
   - [4.3 React Hook (`hooks/useSiblings.ts`)](#43-react-hook)
5. [Step-by-Step UI Component Wireframes](#5-step-by-step-ui-component-wireframes)
   - [UI-1: Sibling Badge on Student Directory](#ui-1-sibling-badge-on-student-directory)
   - [UI-2: Link Existing Students as Siblings Dialog](#ui-2-link-existing-students-as-siblings-dialog)
   - [UI-3: Sibling Family Card & Edit Phone Dialog](#ui-3-sibling-family-card--edit-phone-dialog)
   - [UI-4: Mobile App Parent Multi-Profile Switcher](#ui-4-mobile-app-parent-multi-profile-switcher)
6. [Auto-Calculation Behavior on Student Registration Form](#6-auto-calculation-behavior-on-student-registration-form)
7. [Error Handling & Edge Cases](#7-error-handling--edge-cases)

---

## 1. Executive Overview & UX Philosophy

In Indian multi-sport academies, families frequently enroll **two or more children (siblings)** using a **single family mobile number**. 

The frontend needs to support two distinct experiences:
1. **Admin Panel & Coach Portal (Web/Tablet)**:
   - Identify siblings immediately with badges (`👨‍👩‍👦 Sibling (2)`).
   - View family clusters with aggregated student cards.
   - Manually link any two existing students with 1 click using **Master Student** + **New Student** IDs.
   - Assign/update an individual child's phone number when an older child receives their own smartphone, without breaking the parent's sibling group.
   - Unlink students cleanly if linked by mistake.
2. **Student & Parent Mobile App (Flutter)**:
   - Parent logs in once with their phone number.
   - App automatically detects all children and displays a **Multi-Child Profile Switcher** pill on the home screen.
   - 1-tap profile switching updates the active student context (schedule, attendance, 24-metric evaluation scorecards, and monthly fee invoices).

---

## 2. API Endpoints Quick Reference

| Action | HTTP Method | Endpoint | Description |
|:---|:---|:---|:---|
| **Link Siblings** | `POST` | `/api/v1/students/siblings` | Link 2 students using `masterStudentId` + `newStudentId` |
| **List Families** | `GET` | `/api/v1/students/siblings` | List all sibling groups with pagination & search |
| **Get Siblings** | `GET` | `/api/v1/students/:id/siblings` | Full sibling roster for a specific student ID |
| **My Siblings** | `GET` | `/api/v1/students/my/siblings` | Siblings for logged-in mobile user (Profile switcher) |
| **Assign Phone** | `PATCH` | `/api/v1/students/siblings/:id` | Assign distinct personal mobile to a sibling |
| **Unlink Student** | `DELETE` | `/api/v1/students/siblings/:id` | Detach a student from their sibling family group |

---

## 3. Flutter / Dart Integration Guide (Dio)

### 3.1 Dart Models (`lib/models/sibling_model.dart`)

```dart
// lib/models/sibling_model.dart

class SiblingStudent {
  final String id;
  final String studentId;
  final String fullName;
  final String firstName;
  final String lastName;
  final String regNo;
  final String phone;
  final String email;
  final String? siblingGroupId;
  final String parentName;
  final String parentPhone;
  final String? batchName;
  final String status;

  SiblingStudent({
    required this.id,
    required this.studentId,
    required this.fullName,
    required this.firstName,
    required this.lastName,
    required this.regNo,
    required this.phone,
    required this.email,
    this.siblingGroupId,
    required this.parentName,
    required this.parentPhone,
    this.batchName,
    required this.status,
  });

  factory SiblingStudent.fromMap(Map<String, dynamic> map) {
    return SiblingStudent(
      id: map['_id']?.toString() ?? map['id']?.toString() ?? map['studentId']?.toString() ?? '',
      studentId: map['studentId']?.toString() ?? map['id']?.toString() ?? map['_id']?.toString() ?? '',
      fullName: map['fullName'] ?? '${map['firstName'] ?? ''} ${map['lastName'] ?? ''}'.trim(),
      firstName: map['firstName'] ?? '',
      lastName: map['lastName'] ?? '',
      regNo: map['regNo'] ?? map['employeeNo'] ?? '',
      phone: map['phone'] ?? '',
      email: map['email'] ?? '',
      siblingGroupId: map['siblingGroupId']?.toString(),
      parentName: map['parentName'] ?? map['metadata']?['parentName'] ?? '',
      parentPhone: map['parentPhone'] ?? map['metadata']?['parentPhone'] ?? map['familyPhone'] ?? '',
      batchName: map['batchName'] ?? map['batch']?['name'] ?? '',
      status: map['status'] ?? 'active',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'studentId': studentId,
      'fullName': fullName,
      'firstName': firstName,
      'lastName': lastName,
      'regNo': regNo,
      'phone': phone,
      'email': email,
      'siblingGroupId': siblingGroupId,
      'parentName': parentName,
      'parentPhone': parentPhone,
      'batchName': batchName,
      'status': status,
    };
  }
}

class SiblingFamilyGroup {
  final String siblingGroupId;
  final String familyPhone;
  final String parentName;
  final int studentCount;
  final List<SiblingStudent> students;

  SiblingFamilyGroup({
    required this.siblingGroupId,
    required this.familyPhone,
    required this.parentName,
    required this.studentCount,
    required this.students,
  });

  factory SiblingFamilyGroup.fromMap(Map<String, dynamic> map) {
    return SiblingFamilyGroup(
      siblingGroupId: map['siblingGroupId']?.toString() ?? '',
      familyPhone: map['familyPhone'] ?? '',
      parentName: map['parentName'] ?? '',
      studentCount: (map['studentCount'] as num?)?.toInt() ?? (map['students'] as List?)?.length ?? 0,
      students: (map['students'] as List<dynamic>? ?? [])
          .map((item) => SiblingStudent.fromMap(item as Map<String, dynamic>))
          .toList(),
    );
  }
}

class StudentSiblingsResult {
  final SiblingStudent student;
  final bool hasSiblings;
  final int siblingCount;
  final String? siblingGroupId;
  final String familyPhone;
  final String parentName;
  final List<SiblingStudent> siblings;

  StudentSiblingsResult({
    required this.student,
    required this.hasSiblings,
    required this.siblingCount,
    this.siblingGroupId,
    required this.familyPhone,
    required this.parentName,
    required this.siblings,
  });

  factory StudentSiblingsResult.fromMap(Map<String, dynamic> map) {
    final studentMap = (map['student'] as Map<String, dynamic>?) ?? {};
    final siblingsList = (map['siblings'] as List<dynamic>? ?? [])
        .map((e) => SiblingStudent.fromMap(e as Map<String, dynamic>))
        .toList();

    return StudentSiblingsResult(
      student: SiblingStudent.fromMap(studentMap),
      hasSiblings: map['hasSiblings'] ?? (siblingsList.isNotEmpty),
      siblingCount: (map['siblingCount'] as num?)?.toInt() ?? siblingsList.length,
      siblingGroupId: map['siblingGroupId']?.toString(),
      familyPhone: map['familyPhone'] ?? '',
      parentName: map['parentName'] ?? '',
      siblings: siblingsList,
    );
  }
}
```

---

### 3.2 Flutter Service (`lib/services/sibling_service.dart`)

```dart
// lib/services/sibling_service.dart
import 'package:dio/dio.dart';
import '../models/sibling_model.dart';

class SiblingService {
  final Dio dio;

  SiblingService({required this.dio});

  /// 1. Link two existing students into a sibling group manually
  Future<StudentSiblingsResult> linkSiblings({
    required String masterStudentId,
    required String newStudentId,
  }) async {
    try {
      final response = await dio.post(
        '/students/siblings',
        data: {
          'masterStudentId': masterStudentId,
          'newStudentId': newStudentId,
        },
      );
      final body = response.data;
      if (body['success'] == true && body['data'] != null) {
        return StudentSiblingsResult.fromMap(body['data']);
      }
      throw Exception(body['message'] ?? 'Failed to link siblings');
    } on DioException catch (e) {
      final errMsg = e.response?.data?['error']?['message'] ??
          e.response?.data?['message'] ??
          e.message ??
          'Failed to link siblings';
      throw Exception(errMsg);
    }
  }

  /// 2. List all sibling families in the academy (Admin Panel)
  Future<List<SiblingFamilyGroup>> listSiblingFamilies({
    String? search,
    String? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final response = await dio.get(
        '/students/siblings',
        queryParameters: {
          if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
          if (branchId != null && branchId.isNotEmpty) 'branchId': branchId,
          'page': page,
          'limit': limit,
        },
      );
      final body = response.data;
      if (body['success'] == true && body['data'] is List) {
        return (body['data'] as List)
            .map((item) => SiblingFamilyGroup.fromMap(item as Map<String, dynamic>))
            .toList();
      }
      return [];
    } on DioException catch (e) {
      final errMsg = e.response?.data?['error']?['message'] ?? e.message;
      throw Exception(errMsg);
    }
  }

  /// 3. Get sibling records for a specific student ID
  Future<StudentSiblingsResult> getStudentSiblings(String studentId) async {
    try {
      final response = await dio.get('/students/$studentId/siblings');
      final body = response.data;
      if (body['success'] == true && body['data'] != null) {
        return StudentSiblingsResult.fromMap(body['data']);
      }
      throw Exception(body['message'] ?? 'Failed to retrieve siblings');
    } on DioException catch (e) {
      final errMsg = e.response?.data?['error']?['message'] ?? e.message;
      throw Exception(errMsg);
    }
  }

  /// 4. Get siblings of logged-in student (Mobile App profile switcher)
  Future<List<SiblingStudent>> getMySiblings() async {
    try {
      final response = await dio.get('/students/my/siblings');
      final body = response.data;
      if (body['success'] == true && body['data'] is List) {
        return (body['data'] as List)
            .map((e) => SiblingStudent.fromMap(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    } on DioException catch (e) {
      final errMsg = e.response?.data?['error']?['message'] ?? e.message;
      throw Exception(errMsg);
    }
  }

  /// 5. Assign/Update an individual phone number for a sibling
  Future<StudentSiblingsResult> assignSiblingPhone({
    required String studentId,
    required String newPhone,
  }) async {
    try {
      final response = await dio.patch(
        '/students/siblings/$studentId',
        data: {
          'phone': newPhone.trim(),
        },
      );
      final body = response.data;
      if (body['success'] == true && body['data'] != null) {
        return StudentSiblingsResult.fromMap(body['data']);
      }
      throw Exception(body['message'] ?? 'Failed to update sibling phone');
    } on DioException catch (e) {
      final errMsg = e.response?.data?['error']?['message'] ?? e.message;
      throw Exception(errMsg);
    }
  }

  /// 6. Unlink a student from their sibling group
  Future<bool> unlinkSibling(String studentId) async {
    try {
      final response = await dio.delete('/students/siblings/$studentId');
      final body = response.data;
      return body['success'] == true;
    } on DioException catch (e) {
      final errMsg = e.response?.data?['error']?['message'] ?? e.message;
      throw Exception(errMsg);
    }
  }
}
```

---

### 3.3 Flutter Controller / State (`lib/controllers/sibling_controller.dart`)

```dart
// lib/controllers/sibling_controller.dart
import 'package:flutter/material.dart';
import '../models/sibling_model.dart';
import '../services/sibling_service.dart';

class SiblingController extends ChangeNotifier {
  final SiblingService service;

  SiblingController({required this.service});

  bool isLoading = false;
  String? errorMessage;
  List<SiblingFamilyGroup> families = [];
  List<SiblingStudent> mySiblings = [];
  SiblingStudent? activeChild;

  /// Load all sibling families for Admin Directory
  Future<void> fetchFamilies({String? search, String? branchId}) async {
    isLoading = true;
    errorMessage = null;
    notifyListeners();

    try {
      families = await service.listSiblingFamilies(search: search, branchId: branchId);
    } catch (e) {
      errorMessage = e.toString();
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  /// Link two students
  Future<bool> linkStudents(String masterId, String newId) async {
    isLoading = true;
    errorMessage = null;
    notifyListeners();

    try {
      await service.linkSiblings(masterStudentId: masterId, newStudentId: newId);
      await fetchFamilies(); // Refresh table
      return true;
    } catch (e) {
      errorMessage = e.toString();
      return false;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  /// Update individual child phone
  Future<bool> updatePhone(String studentId, String phone) async {
    isLoading = true;
    notifyListeners();
    try {
      await service.assignSiblingPhone(studentId: studentId, newPhone: phone);
      await fetchFamilies();
      return true;
    } catch (e) {
      errorMessage = e.toString();
      return false;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  /// Unlink student
  Future<bool> unlink(String studentId) async {
    isLoading = true;
    notifyListeners();
    try {
      final success = await service.unlinkSibling(studentId);
      if (success) await fetchFamilies();
      return success;
    } catch (e) {
      errorMessage = e.toString();
      return false;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  /// Mobile App: Switch active child
  void switchChild(SiblingStudent child) {
    activeChild = child;
    notifyListeners();
  }
}
```

---

### 3.4 Ready-to-use Flutter UI Widgets

#### A. Sibling Badge Widget (for Student Table Row)
```dart
Widget buildSiblingBadge(BuildContext context, SiblingStudent student, VoidCallback onTap) {
  if (student.siblingGroupId == null || student.siblingGroupId!.isEmpty) {
    return const SizedBox.shrink();
  }

  return InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(16),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        border: Border.all(color: const Color(0xFF86EFAC)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.family_restroom, size: 14, color: Color(0xFF16A34A)),
          SizedBox(width: 4),
          Text(
            'Sibling',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Color(0xFF15803D),
            ),
          ),
        ],
      ),
    ),
  );
}
```

#### B. Link Sibling Dialog Widget
```dart
void showLinkSiblingDialog(BuildContext context, SiblingController controller, List<SiblingStudent> allStudents) {
  String? selectedMasterId;
  String? selectedNewId;

  showDialog(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (context, setState) {
        return AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.link, color: Color(0xFF1E40AF)),
              SizedBox(width: 8),
              Text('Link Existing Siblings'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Select Master Student and the New Student to link. Family contacts and sibling group will be auto-inherited.',
                style: TextStyle(fontSize: 13, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(labelText: 'Master / Primary Student'),
                items: allStudents.map((s) => DropdownMenuItem(value: s.studentId, child: Text('${s.fullName} (${s.regNo})'))).toList(),
                onChanged: (val) => setState(() => selectedMasterId = val),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(labelText: 'New Sibling Student to Link'),
                items: allStudents.map((s) => DropdownMenuItem(value: s.studentId, child: Text('${s.fullName} (${s.regNo})'))).toList(),
                onChanged: (val) => setState(() => selectedNewId = val),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: (selectedMasterId != null && selectedNewId != null && selectedMasterId != selectedNewId)
                  ? () async {
                      Navigator.pop(ctx);
                      final success = await controller.linkStudents(selectedMasterId!, selectedNewId!);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(success ? 'Siblings linked successfully!' : (controller.errorMessage ?? 'Failed to link')),
                            backgroundColor: success ? Colors.green : Colors.red,
                          ),
                        );
                      }
                    }
                  : null,
              child: const Text('Link as Siblings'),
            ),
          ],
        );
      },
    ),
  );
}
```

---

## 4. React / TypeScript Integration Guide (Axios)

### 4.1 TypeScript Interfaces (`types/sibling.ts`)

```typescript
// types/sibling.ts

export interface SiblingStudent {
  id: string;
  studentId: string;
  fullName: string;
  firstName: string;
  lastName?: string;
  regNo: string;
  phone: string;
  email?: string;
  siblingGroupId?: string | null;
  parentName?: string;
  parentPhone?: string;
  batchName?: string;
  status: 'active' | 'inactive' | 'suspended';
}

export interface SiblingFamilyGroup {
  siblingGroupId: string;
  familyPhone: string;
  parentName: string;
  studentCount: number;
  students: SiblingStudent[];
}

export interface LinkSiblingsPayload {
  masterStudentId: string;
  newStudentId: string;
}

export interface AssignSiblingPhonePayload {
  phone: string;
  parentPhone?: string;
  parentName?: string;
}
```

---

### 4.2 Axios API Service (`services/siblingService.ts`)

```typescript
// services/siblingService.ts
import axios from 'axios';
import { SiblingFamilyGroup, SiblingStudent, LinkSiblingsPayload, AssignSiblingPhonePayload } from '../types/sibling';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://www.amdplayapi.amdtechno.in/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const siblingService = {
  // 1. Link two students manually
  linkSiblings: async (payload: LinkSiblingsPayload) => {
    const { data } = await api.post('/students/siblings', payload);
    return data;
  },

  // 2. List all sibling families in academy
  listSiblingGroups: async (params?: { search?: string; branchId?: string; page?: number; limit?: number }) => {
    const { data } = await api.get<{ success: boolean; data: SiblingFamilyGroup[]; pagination: any }>(
      '/students/siblings',
      { params }
    );
    return data;
  },

  // 3. Get sibling records for a specific student ID
  getStudentSiblings: async (studentId: string) => {
    const { data } = await api.get(`/students/${studentId}/siblings`);
    return data.data;
  },

  // 4. Assign / Update individual phone for a sibling
  assignSiblingPhone: async (studentId: string, payload: AssignSiblingPhonePayload) => {
    const { data } = await api.patch(`/students/siblings/${studentId}`, payload);
    return data;
  },

  // 5. Unlink a student from sibling family group
  unlinkSibling: async (studentId: string) => {
    const { data } = await api.delete(`/students/siblings/${studentId}`);
    return data;
  },
};
```

---

### 4.3 React Hook (`hooks/useSiblings.ts`)

```typescript
// hooks/useSiblings.ts
import { useState, useCallback } from 'react';
import { siblingService } from '../services/siblingService';
import { SiblingFamilyGroup } from '../types/sibling';

export const useSiblings = () => {
  const [families, setFamilies] = useState<SiblingFamilyGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFamilies = useCallback(async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await siblingService.listSiblingGroups({ search });
      setFamilies(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load sibling families');
    } finally {
      setLoading(false);
    }
  }, []);

  const link = async (masterStudentId: string, newStudentId: string) => {
    setLoading(true);
    try {
      await siblingService.linkSiblings({ masterStudentId, newStudentId });
      await fetchFamilies();
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to link siblings');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updatePhone = async (studentId: string, phone: string) => {
    setLoading(true);
    try {
      await siblingService.assignSiblingPhone(studentId, { phone });
      await fetchFamilies();
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to update phone');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unlink = async (studentId: string) => {
    setLoading(true);
    try {
      await siblingService.unlinkSibling(studentId);
      await fetchFamilies();
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to unlink sibling');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { families, loading, error, fetchFamilies, link, updatePhone, unlink };
};
```

---

## 5. Step-by-Step UI Component Wireframes

### UI-1: Sibling Badge on Student Directory

```
+---------------------------------------------------------------------------------------------------------+
| REG NO    | STUDENT NAME          | BATCH                 | PHONE       | FAMILY STATUS | ACTIONS       |
+---------------------------------------------------------------------------------------------------------+
| isabd001  | Keshika Devan         | Morning Elite Stars   | 9894789477  | [👨‍👩‍👦 Sibling] | [View] [Edit] |
| isabd006  | Ruthvi Pandian        | Evening Beginners     | 9444154854  | [👨‍👩‍👦 Sibling] | [View] [Edit] |
| isabd012  | Aarav Sharma          | Weekend Coaching      | 9876543210  | -             | [View] [Edit] |
+---------------------------------------------------------------------------------------------------------+
```

---

### UI-2: Link Existing Students as Siblings Dialog

```
+-------------------------------------------------------------------------+
|  🔗 Link Existing Students as Siblings                                  |
+-------------------------------------------------------------------------+
|  Connect two existing students under the same family group.             |
|  Family contacts (parent name & phone) will be auto-inherited.          |
|                                                                         |
|  Master Student (Primary):                                              |
|  [ Keshika Devan (isabd001) - 9894789477                          ▼ ]   |
|                                                                         |
|  New Sibling Student to Link:                                           |
|  [ Ruthvi Pandian (isabd006) - 9444154854                         ▼ ]   |
|                                                                         |
|  [Cancel]                                       [ 🔗 Link as Siblings ] |
+-------------------------------------------------------------------------+
```

---

### UI-3: Sibling Family Card & Edit Phone Dialog

```
+-------------------------------------------------------------------------+
| 👨‍👩‍👦 Arunmozhidevan's Family (Family Phone: 9894789477) • 2 Students        |
+-------------------------------------------------------------------------+
|  1. Keshika Devan (isabd001)                                            |
|     Batch: Morning Elite Stars | Phone: 9894789477                      |
|     [Edit Phone] [Unlink]                                               |
|                                                                         |
|  2. Ruthvi Pandian (isabd006)                                           |
|     Batch: Evening Badminton Stars | Phone: 9444154854                  |
|     [Edit Phone] [Unlink]                                               |
+-------------------------------------------------------------------------+
```

When clicking **[Edit Phone]**:
```
+-------------------------------------------------------------------------+
| 📱 Assign Personal Mobile to Ruthvi Pandian                              |
+-------------------------------------------------------------------------+
| Student Phone:                                                          |
| [ 9444154854                                                          ] |
|                                                                         |
| * Family parent phone (9894789477) will remain safely linked for parent |
|   notifications and login.                                              |
|                                                                         |
| [Cancel]                                                [ Save Number ] |
+-------------------------------------------------------------------------+
```

---

### UI-4: Mobile App Parent Multi-Profile Switcher

```
+---------------------------------------+
|  ISA Badminton Academy            🔔  |
|                                       |
|  Active Student:                      |
|  +---------------------------------+  |
|  | 👧 Keshika Devan (isabd001)   ▼ |  |
|  +---------------------------------+  |
|                                       |
|  [ Attendance: 94% ]  [ Grade: A+ ]   |
|                                       |
|  Today's Batch:                       |
|  Morning Elite Stars (06:30 - 08:00)  |
+---------------------------------------+
```

Tapping the profile pill opens the **Bottom Sheet Selector**:
```
+---------------------------------------+
| Select Student Profile                |
+---------------------------------------+
|  (•) 👧 Keshika Devan                |
|      Reg: isabd001 | Morning Elite   |
|                                       |
|  ( ) 👧 Ruthvi Pandian                |
|      Reg: isabd006 | Evening Stars   |
+---------------------------------------+
```

---

## 6. Auto-Calculation Behavior on Student Registration Form

When building the **"Add Student"** form in the Admin Panel or Coach App:

1. As the user enters the `phone` field, trigger an auto-check or debounce search.
2. If another student already exists with that phone number:
   - Display an informational alert:
     > 💡 **Sibling Detected:** An existing student (*"Keshika Devan"*) is enrolled under this phone number. This new student will automatically be linked as a sibling under family parent *"Arunmozhidevan"*.
3. Leave `employeeNo` and `pin` empty — the backend will generate the next sequential registration number (e.g., `isabd006`) automatically.

---

## 7. Error Handling & Edge Cases

| Error Scenario | Backend HTTP Status | Error Message | Frontend Recommended Action |
|:---|:---|:---|:---|
| **Same Student ID selected for both** | `400 Bad Request` | `Both Master Student ID and New Student ID are required` | Disable the submit button if `masterStudentId === newStudentId`. |
| **Invalid or non-existent Student ID** | `404 Not Found` | `Student with ID '...' not found in this academy` | Display toast notification and refresh student dropdown. |
| **Empty or invalid phone number** | `400 Bad Request` | `New mobile number is required` | Validate 10-digit phone number regex prior to calling `assignSiblingPhone`. |
| **Already linked in same group** | `200 OK` | `Students linked into sibling family group successfully` | Idempotent operation: backend safely maintains existing group ID. |

---
*Created for AMD Sports SaaS Platform - Frontend Developer Reference*
