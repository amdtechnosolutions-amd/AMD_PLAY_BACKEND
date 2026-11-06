import mongoose from 'mongoose';
import { HikvisionService } from '../src/modules/iot/hikvision.service.js';

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:41111/amd_play');
  const d = await mongoose.connection.db.collection('devices').findOne({ code: 'DEV-ISA-ACCESS' });

  const client = new HikvisionService({
    ip: d.ipAddress,
    port: d.port,
    username: d.username,
    password: d.password,
    protocol: d.protocol,
    timeout: 8000,
  });

  const payload = {
    CardInfo: {
      employeeNo: 'inembd005',
      cardNo: '0006244569',
      cardType: 'normalCard',
    },
  };
  try {
    const res = await client.request('/ISAPI/AccessControl/CardInfo/Modify?format=json', {
      method: 'PUT',
      body: payload,
    });
    console.log('Card Modify result:', res);
  } catch (err) {
    console.error('Card Modify error:', err.message, err.data || '');
  }

  // Also query CardInfo for inembd005
  try {
    const searchRes = await client.request('/ISAPI/AccessControl/CardInfo/Search?format=json', {
      method: 'POST',
      body: {
        CardInfoSearchCond: {
          searchID: '1',
          searchResultPosition: 0,
          maxResults: 5,
          EmployeeNoList: [{ employeeNo: 'inembd005' }],
        },
      },
    });
    console.log('Card Search result:', searchRes);
  } catch (err) {
    console.error('Card Search error:', err.message);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
