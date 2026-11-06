import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function search() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const searchValues = ['0006244569', '6244569', 6244569];

  console.log('Searching MongoDB across collections for 0006244569 / 6244569...');
  let found = false;

  for (const coll of collections) {
    const cName = coll.name;
    const docs = await db.collection(cName).find({}).toArray();
    for (const d of docs) {
      const str = JSON.stringify(d);
      if (str.includes('6244569')) {
        console.log(`Found match in collection '${cName}':`, d);
        found = true;
      }
    }
  }

  if (!found) {
    console.log('0006244569 not found in any MongoDB collection.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

search().catch(err => {
  console.error(err);
  process.exit(1);
});
