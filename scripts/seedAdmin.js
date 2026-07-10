import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../src/config/database.js';
import User from '../src/models/User.js';
import mongoose from 'mongoose';

const run = async () => {
  await connectDB();

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@cashlo.in';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await User.findOne({ email });
  if (existing) {
    console.log('⚠️  Admin already exists:', email);
    process.exit(0);
  }

  await User.create({
    name: 'Cashlo Admin',
    email,
    password,
    role: 'admin',
  });

  console.log('✅ Admin created:', email);
  console.log('   Password:', password, '(change this after first login)');
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});