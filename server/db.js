
import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is missing');
  process.exit(1);
}
const ssl = connectionString.includes('sslmode=require') ? { rejectUnauthorized: False } : (process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: False } : false);

export const pool = new Pool({
  connectionString,
  ssl: ssl ? { rejectUnauthorized: false } : false
});

export async function query(q, params) {
  const client = await pool.connect();
  try {
    return await client.query(q, params);
  } finally {
    client.release();
  }
}
