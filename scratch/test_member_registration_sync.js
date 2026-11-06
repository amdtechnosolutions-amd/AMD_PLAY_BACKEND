import mongoose from 'mongoose';
import { memberService } from '../src/modules/members/member.service.js';
import { membershipService } from '../src/modules/memberships/membership.service.js';
import { HikvisionService } from '../src/modules/iot/hikvision.service.js';
import { Device } from '../src/modules/iot/device.model.js';
import { User } from '../src/modules/users/user.model.js';
import { MemberSubscription } from '../src/modules/memberships/memberSubscription.model.js';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:41111/amd_play');
  console.log('Connected to MongoDB');

  const tenantId = '6ad6bd7fd33a91a36c41ff44';
  const branchId = '6ad6bd7fd33a91a36c41ff46';
  const sportId = '6ad6bdead33a91a36c41ff5b';
  const planId = '6ae49b30e372a35231774e9d';

  const testSuffix = Math.floor(1000 + Math.random() * 9000);
  const testPhone = `98765${testSuffix}`;
  const testCard = `000${testSuffix}${Math.floor(100 + Math.random() * 900)}`;
  const testPin = `${testSuffix}`;

  console.log(`\n=== Testing Member Registration with Sync ===`);
  console.log(`Phone: ${testPhone}, Card: ${testCard}, PIN: ${testPin}`);

  const registrationData = {
    firstName: 'TestMember',
    lastName: `DeviceSync${testSuffix}`,
    phone: testPhone,
    email: `testmember_${testSuffix}@example.com`,
    planId,
    branchId,
    sportId,
    pin: testPin,
    cardNo: testCard,
    timeSlot: {
      startTime: '06:00',
      endTime: '07:00',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      slotName: '06:00 - 07:00',
    },
  };

  const result = await memberService.createMember(registrationData, { tenantId });
  console.log('\n--- Registration Result ---');
  console.log('Member ID:', result.member._id);
  console.log('Role:', result.member.role);
  console.log('EmployeeNo:', result.member.employeeNo);
  console.log('CardNo:', result.member.cardNo);
  console.log('PIN:', result.member.pin);
  console.log('Subscription Template:', result.subscription?.hikvisionPlanTemplateNo);

  // Now verify on the physical device DEV-ISA-ACCESS
  console.log('\n--- Verifying on Device DEV-ISA-ACCESS ---');
  const client = new HikvisionService(); // defaults to 64.4.193.66:4231
  const personCheck = await client.request('/ISAPI/AccessControl/UserInfo/Search?format=json', {
    method: 'POST',
    body: {
      UserInfoSearchCond: {
        searchID: '1',
        searchResultPosition: 0,
        maxResults: 10,
        EmployeeNoList: [{ employeeNo: result.member.employeeNo }],
      },
    },
  });
  console.log('Person on device count:', personCheck?.UserInfoSearch?.numOfMatches);
  const personRecord = personCheck?.UserInfoSearch?.UserInfo?.[0];
  console.log('Person record:', {
    employeeNo: personRecord?.employeeNo,
    name: personRecord?.name,
    userType: personRecord?.userType,
    numOfCard: personRecord?.numOfCard,
  });

  const cardCheck = await client.request('/ISAPI/AccessControl/CardInfo/Search?format=json', {
    method: 'POST',
    body: {
      CardInfoSearchCond: {
        searchID: '1',
        searchResultPosition: 0,
        maxResults: 10,
        CardNoList: [{ cardNo: testCard }],
      },
    },
  });
  console.log('Card on device count:', cardCheck?.CardInfoSearch?.numOfMatches);
  const cardRecord = cardCheck?.CardInfoSearch?.CardInfo?.[0];
  console.log('Card record:', {
    cardNo: cardRecord?.cardNo,
    employeeNo: cardRecord?.employeeNo,
    planTemplateNo: cardRecord?.planTemplateNo,
  });

  // Clean up test data from DB and device
  console.log('\n--- Cleaning up test records ---');
  await client.deletePerson(result.member.employeeNo);
  await User.deleteOne({ _id: result.member._id });
  if (result.subscription?._id) {
    await MemberSubscription.deleteOne({ _id: result.subscription._id });
  }
  console.log('Cleanup complete!');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
