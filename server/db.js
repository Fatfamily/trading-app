import pg from 'pg';

const { Pool } = pg;

// Render Postgres requires SSL in many cases
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
});

export default pool;
