import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

export const hashOtp = (otp) => bcrypt.hash(otp, SALT_ROUNDS);

export const compareOtp = (otp, hash) => bcrypt.compare(otp, hash);