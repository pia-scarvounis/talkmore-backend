// config.js
import dotenv from 'dotenv';
import pkg from 'pg';
 
dotenv.config();
 
const { Pool } = pkg;
 
export const JWT_SECRET = process.env.JWT_SECRET;
export const DEFAULT_TEST_PASSWORD = process.env.DEFAULT_TEST_PASSWORD;
 
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Viktig for Neon på Railway
});