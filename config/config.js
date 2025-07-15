import dotenv from 'dotenv';
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET;
export const DEFAULT_TEST_PASSWORD = process.env.DEFAULT_TEST_PASSWORD;
