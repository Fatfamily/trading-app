import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;
const isRender = !!process.env.RENDER;

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

export async function query(q, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(q, params);
    return res;
  } finally {
    client.release();
  }
}
