import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const useSsl = process.env.DB_SSL === 'true';

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'infirmary_system',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

export async function checkDatabaseConnection() {
  const client = await pool.connect();

  try {
    await client.query('SELECT NOW()');
  } finally {
    client.release();
  }
}
