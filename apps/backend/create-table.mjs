import { Client } from 'pg';

const url = 'postgres://postgres.pabkqdqtmrwpumconajz:fire%40Base2241@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';

const client = new Client({ connectionString: url });

async function run() {
  try {
    await client.connect();
    console.log('Connected!');
    
    // Create Message table
    const query = `
      CREATE TABLE IF NOT EXISTS "Message" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "taskId" TEXT NOT NULL REFERENCES "Task"("id"),
        "senderId" TEXT NOT NULL REFERENCES "User"("id"),
        "text" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await client.query(query);
    console.log('Message table created!');
  } catch (err) {
    console.error('Failed', err);
  } finally {
    await client.end();
  }
}

run();
