import mongoose from 'mongoose';
import { Device } from '../src/modules/iot/device.model.js';

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:41111/amd_play');
  const devices = await Device.find({}).lean();
  console.log('Total Devices in DB:', devices.length);
  for (const d of devices) {
    console.log({
      id: d._id,
      name: d.name,
      code: d.code,
      type: d.type,
      tenantId: d.tenantId,
      branchId: d.branchId,
      sportId: d.sportId,
      sportIds: d.sportIds,
      resourceId: d.resourceId,
      resourceIds: d.resourceIds,
      ipAddress: d.ipAddress,
      internalIp: d.internalIp,
      status: d.status,
    });
  }
  await mongoose.disconnect();
}

main().catch(console.error);
