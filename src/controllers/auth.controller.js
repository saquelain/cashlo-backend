import User from '../models/User.js';
import { signToken } from '../utils/jwt.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const ALLOWED_ROLES = ['admin', 'editor', 'sales'];

// POST /api/v1/auth/users — admin only, creates a new user with any role
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    const error = new Error('name, email, password, and role are required');
    error.statusCode = 400;
    throw error;
  }

  if (!ALLOWED_ROLES.includes(role)) {
    const error = new Error(`role must be one of: ${ALLOWED_ROLES.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    const error = new Error('A user with this email already exists');
    error.statusCode = 409;
    throw error;
  }

  const user = await User.create({ name, email: email.toLowerCase().trim(), password, role });

  res.status(201).json({
    success: true,
    data: { _id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const user = await User.findOne({ email, isActive: true }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = signToken({ id: user._id, role: user.role });

  res.status(200).json({
    success: true,
    data: {
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: req.user });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({ success: true, message: 'Password changed successfully' });
});