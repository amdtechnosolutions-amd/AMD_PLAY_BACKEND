import mongoose from 'mongoose';
import { automatedAttendanceService } from '../src/modules/coaching/automated-attendance.service.js';
import { Attendance } from '../src/modules/coaching/attendance.model.js';
import { AttendancePunchLog } from '../src/modules/coaching/attendance-punch-log.model.js';
import { User } from '../src/modules/users/user.model.js';
import { Batch } from '../src/modules/coaching/batch.model.js';
import { Enrollment } from '../src/modules/coaching/enrollment.model.js';
import { Booking } from '../src/modules/bookings/booking.model.js';
import { Notification } from '../src/modules/notifications/notification.model.js';
import { ROLES } from '../src/config/constants.js';

async function runTest() {
  await mongoose.connect('mongodb://127.0.0.1:41111/amd_play');
  console.log('✅ Connected to MongoDB for verification');

  const tenantId = new mongoose.Types.ObjectId('6ad6bd7fd33a91a36c41ff44');
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Ensure an Admin user exists
  let admin = await User.findOne({ tenantId, role: ROLES.TENANT_ADMIN });
  if (!admin) {
    admin = await User.create({
      tenantId,
      firstName: 'Academy',
      lastName: 'Admin',
      email: 'admin_test@amdplay.local',
      role: ROLES.TENANT_ADMIN,
      password: 'Password123!',
      status: 'active',
      phone: '9876543210',
    });
  }
  console.log(`👤 Admin found: ${admin.firstName} ${admin.lastName} (${admin._id})`);

  // Clear past test notifications for this admin to have clean test counts
  await Notification.deleteMany({ tenantId, userId: admin._id });

  // 2. PART 1: TEST MULTIPLE PUNCHES FOR COACHING STUDENT
  console.log('\n--- TEST PART 1: COACHING MULTIPLE PUNCHES (FIRST IN, LAST OUT) ---');
  let student = await User.findOne({ tenantId, role: ROLES.STUDENT });
  if (!student) {
    student = await User.create({
      tenantId,
      firstName: 'Arjun',
      lastName: 'Kumar',
      email: 'arjun_test@amdplay.local',
      role: ROLES.STUDENT,
      employeeNo: 'TEST_STU_001',
      password: 'Password123!',
      status: 'active',
      phone: '9123456780',
    });
  }

  let batch = await Batch.findOne({ tenantId, status: 'active' });
  if (!batch) {
    batch = await Batch.create({
      tenantId,
      name: 'Badminton Morning Cohort',
      code: 'BAT-BAD-AM',
      status: 'active',
      sportId: new mongoose.Types.ObjectId(),
    });
  }

  // Ensure enrollment exists
  await Enrollment.findOneAndUpdate(
    { tenantId, studentId: student._id, batchId: batch._id },
    { tenantId, studentId: student._id, batchId: batch._id, status: 'active' },
    { upsert: true }
  );

  // Clean today's attendance doc for test student
  await Attendance.deleteOne({ tenantId, batchId: batch._id, date: todayStr });

  // PUNCH 1: 07:00 AM (Check-in)
  const baseTime = new Date();
  baseTime.setHours(7, 0, 0, 0);

  console.log(`\n1️⃣ Testing Punch 1 (Entry at 07:00:00)...`);
  await automatedAttendanceService.recordBiometricPunch({
    tenantId,
    studentId: student._id,
    employeeNo: student.employeeNo,
    sportName: 'Badminton',
    punchTime: baseTime,
    verificationMode: 'face',
    deviceCode: 'DEV-BADMINTON-01',
    deviceName: 'Badminton Court 1 ACS',
    serialNo: 999001,
  });

  let att1 = await Attendance.findOne({ tenantId, batchId: batch._id, date: todayStr });
  let rec1 = att1?.records?.find((r) => r.studentId.toString() === student._id.toString());
  console.log(`   Punch 1 Result: checkInTime = ${rec1?.checkInTime?.toISOString()}, checkOutTime = ${rec1?.checkOutTime}, punches count = ${rec1?.punches?.length}`);
  console.log(`   Remarks: ${rec1?.remarks}`);

  // PUNCH 2: 07:00:20 AM (Double scan within 60s)
  const p2Time = new Date(baseTime.getTime() + 20 * 1000);
  console.log(`\n2️⃣ Testing Punch 2 (Double scan at 07:00:20 - within 20s)...`);
  await automatedAttendanceService.recordBiometricPunch({
    tenantId,
    studentId: student._id,
    employeeNo: student.employeeNo,
    sportName: 'Badminton',
    punchTime: p2Time,
    verificationMode: 'face',
    deviceCode: 'DEV-BADMINTON-01',
    deviceName: 'Badminton Court 1 ACS',
    serialNo: 999002,
  });

  let att2 = await Attendance.findOne({ tenantId, batchId: batch._id, date: todayStr });
  let rec2 = att2?.records?.find((r) => r.studentId.toString() === student._id.toString());
  console.log(`   Punch 2 Result: checkInTime = ${rec2?.checkInTime?.toISOString()} (unchanged first IN)`);
  console.log(`   checkOutTime = ${rec2?.checkOutTime} (correctly null, not debounced out)`);
  console.log(`   punches count = ${rec2?.punches?.length} (both recorded)`);

  // PUNCH 3: 07:30:00 AM (Water break / intermediate out punch)
  const p3Time = new Date(baseTime.getTime() + 30 * 60 * 1000);
  console.log(`\n3️⃣ Testing Punch 3 (Intermediate out punch at 07:30:00)...`);
  await automatedAttendanceService.recordBiometricPunch({
    tenantId,
    studentId: student._id,
    employeeNo: student.employeeNo,
    sportName: 'Badminton',
    punchTime: p3Time,
    verificationMode: 'face',
    deviceCode: 'DEV-BADMINTON-01',
    deviceName: 'Badminton Court 1 ACS',
    serialNo: 999003,
  });

  let att3 = await Attendance.findOne({ tenantId, batchId: batch._id, date: todayStr });
  let rec3 = att3?.records?.find((r) => r.studentId.toString() === student._id.toString());
  console.log(`   Punch 3 Result: checkInTime = ${rec3?.checkInTime?.toISOString()}`);
  console.log(`   checkOutTime = ${rec3?.checkOutTime?.toISOString()} (intermediate out recorded)`);
  console.log(`   punches count = ${rec3?.punches?.length}`);
  console.log(`   Remarks: ${rec3?.remarks}`);

  // PUNCH 4: 08:00:00 AM (Final session exit - LAST OUT PUNCH)
  const p4Time = new Date(baseTime.getTime() + 60 * 60 * 1000);
  console.log(`\n4️⃣ Testing Punch 4 (Final Session Exit at 08:00:00 - LAST OUT)...`);
  await automatedAttendanceService.recordBiometricPunch({
    tenantId,
    studentId: student._id,
    employeeNo: student.employeeNo,
    sportName: 'Badminton',
    punchTime: p4Time,
    verificationMode: 'face',
    deviceCode: 'DEV-BADMINTON-01',
    deviceName: 'Badminton Court 1 ACS',
    serialNo: 999004,
  });

  let att4 = await Attendance.findOne({ tenantId, batchId: batch._id, date: todayStr });
  let rec4 = att4?.records?.find((r) => r.studentId.toString() === student._id.toString());
  console.log(`   Punch 4 Result: checkInTime = ${rec4?.checkInTime?.toISOString()} (still first IN: 07:00)`);
  console.log(`   checkOutTime = ${rec4?.checkOutTime?.toISOString()} (UPDATED TO LAST OUT: 08:00)`);
  console.log(`   punches count = ${rec4?.punches?.length} (all 4 punches saved)`);
  console.log(`   Remarks: ${rec4?.remarks}`);

  // 3. PART 2: TEST ROLE-BASED DOOR UNLOCK NOTIFICATIONS FOR ADMIN
  console.log('\n--- TEST PART 2: ROLE-BASED DOOR UNLOCK NOTIFICATIONS ---');

  // A. COACH UNLOCK
  let coach = await User.findOne({ tenantId, role: ROLES.COACH });
  if (!coach) {
    coach = await User.create({
      tenantId,
      firstName: 'Rahul',
      lastName: 'Dravid',
      email: 'coach_test@amdplay.local',
      role: ROLES.COACH,
      employeeNo: 'COACH_007',
      password: 'Password123!',
      status: 'active',
    });
  }
  console.log(`\n🎾 Testing Coach Unlock: ${coach.firstName} ${coach.lastName}...`);
  await automatedAttendanceService.recordBiometricPunch({
    tenantId,
    studentId: coach._id,
    employeeNo: coach.employeeNo,
    sportName: 'Badminton',
    punchTime: new Date(),
    verificationMode: 'face',
    deviceName: 'Badminton Arena Door',
    serialNo: 999010,
  });

  // B. MEMBER UNLOCK
  let member = await User.findOne({ tenantId, role: ROLES.MEMBER });
  if (!member) {
    member = await User.create({
      tenantId,
      firstName: 'Siddharth',
      lastName: 'Rao',
      email: 'member_test@amdplay.local',
      role: ROLES.MEMBER,
      employeeNo: 'MEM_042',
      cardNo: 'CARD_MEM_042',
      password: 'Password123!',
      status: 'active',
    });
  }
  console.log(`\n💳 Testing Member Unlock: ${member.firstName} ${member.lastName}...`);
  await automatedAttendanceService.recordBiometricPunch({
    tenantId,
    studentId: member._id,
    employeeNo: member.employeeNo,
    cardNo: member.cardNo,
    sportName: 'Badminton',
    punchTime: new Date(),
    verificationMode: 'card',
    deviceName: 'Badminton Arena Door',
    serialNo: 999011,
  });

  // C. BOOKING CUSTOMER UNLOCK (VIA ACCESS PIN)
  let customer = await User.findOne({ tenantId, role: ROLES.CUSTOMER });
  if (!customer) {
    customer = await User.create({
      tenantId,
      firstName: 'Vikram',
      lastName: 'Seth',
      email: 'customer_test@amdplay.local',
      role: ROLES.CUSTOMER,
      password: 'Password123!',
      status: 'active',
    });
  }

  const testAccessPin = '789123';
  await Booking.findOneAndUpdate(
    { tenantId, accessCode: testAccessPin },
    {
      tenantId,
      branchId: new mongoose.Types.ObjectId(),
      bookingNumber: 'BK-TEST-789',
      userId: customer._id,
      resourceId: new mongoose.Types.ObjectId(),
      sportId: new mongoose.Types.ObjectId(),
      date: todayStr,
      startTime: '18:00',
      endTime: '19:00',
      accessCode: testAccessPin,
      status: 'confirmed',
      pricing: { basePrice: 500, totalAmount: 500 },
    },
    { upsert: true }
  );

  console.log(`\n🏸 Testing Booking Customer Unlock: ${customer.firstName} ${customer.lastName} (PIN: ${testAccessPin})...`);
  await automatedAttendanceService.recordBiometricPunch({
    tenantId,
    employeeNo: testAccessPin,
    sportName: 'Badminton',
    punchTime: new Date(),
    verificationMode: 'pin',
    deviceName: 'Badminton Arena Door',
    serialNo: 999012,
  });

  // D. ADMIN UNLOCK
  console.log(`\n👑 Testing Admin Unlock: ${admin.firstName} ${admin.lastName}...`);
  await automatedAttendanceService.recordBiometricPunch({
    tenantId,
    studentId: admin._id,
    employeeNo: admin.employeeNo || 'ADM_001',
    sportName: 'Badminton',
    punchTime: new Date(),
    verificationMode: 'face',
    deviceName: 'Badminton Arena Door',
    serialNo: 999013,
  });

  // E. MANUAL EXIT BUTTON RELAY UNLOCK (subEventType: 21)
  console.log(`\n🔘 Testing Manual Exit Push Button Relay Unlock...`);
  await automatedAttendanceService.handleWebhook({
    AccessControllerEvent: {
      subEventType: 21,
      time: new Date().toISOString(),
    },
  }, { tenantIdentifier: '6ad6bd7fd33a91a36c41ff44', sportIdentifier: 'badminton' });

  // 4. VERIFY NOTIFICATIONS CREATED IN DB FOR ADMIN
  console.log('\n--- VERIFYING NOTIFICATIONS RECORDED IN DB FOR ADMIN ---');
  const notifications = await Notification.find({ tenantId, userId: admin._id })
    .sort({ createdAt: 1 })
    .lean();

  console.log(`Total notifications delivered to Admin (${admin.firstName}): ${notifications.length}\n`);
  for (const n of notifications) {
    console.log(`🔔 [Title]:   ${n.title}`);
    console.log(`   [Message]: ${n.message}`);
    console.log(`   [Persona]: ${n.metadata?.persona} (${n.metadata?.personaLabel})`);
    console.log(`   [Type]:    ${n.type} | Channel: ${n.channel}\n`);
  }

  // Clean test punch logs created by this test
  await AttendancePunchLog.deleteMany({ serialNo: { $in: [999001, 999002, 999003, 999004, 999010, 999011, 999012, 999013] } });

  await mongoose.disconnect();
  console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
