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

// GET /api/v1/auth/users — admin only, list all users
export const listUsers = asyncHandler(async (req, res) => {
  const { role, search, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (role) filter.role = role;
  if (search) {
    filter.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: users,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

// GET /api/v1/auth/users/:id — admin only
export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  res.status(200).json({ success: true, data: user });
});

// PATCH /api/v1/auth/users/:id — admin only. Can update name, email, role,
// isActive, and optionally reset password. Uses .save() (not
// findByIdAndUpdate) specifically so the password pre-save hook still fires
// when a new password is provided.
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, role, isActive, password } = req.body;

  const user = await User.findById(id);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (email && email.toLowerCase().trim() !== user.email) {
    const existing = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: id } });
    if (existing) {
      const error = new Error('A user with this email already exists');
      error.statusCode = 409;
      throw error;
    }
    user.email = email.toLowerCase().trim();
  }

  if (role) {
    if (!ALLOWED_ROLES.includes(role)) {
      const error = new Error(`role must be one of: ${ALLOWED_ROLES.join(', ')}`);
      error.statusCode = 400;
      throw error;
    }
    if (String(user._id) === String(req.user._id) && role !== 'admin') {
      const error = new Error('You cannot change your own role away from admin');
      error.statusCode = 400;
      throw error;
    }
    user.role = role;
  }

  if (typeof isActive === 'boolean') {
    if (String(user._id) === String(req.user._id) && isActive === false) {
      const error = new Error('You cannot deactivate your own account');
      error.statusCode = 400;
      throw error;
    }
    user.isActive = isActive;
  }

  if (name) user.name = name;
  if (password) user.password = password;

  await user.save();

  res.status(200).json({
    success: true,
    data: { _id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive },
  });
});

// DELETE /api/v1/auth/users/:id — admin only. Blocks self-deletion and
// deleting the last remaining admin, so the panel can never be locked out.
export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (String(id) === String(req.user._id)) {
    const error = new Error('You cannot delete your own account');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(id);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      const error = new Error('Cannot delete the last remaining admin');
      error.statusCode = 400;
      throw error;
    }
  }

  await user.deleteOne();

  res.status(200).json({ success: true, message: 'User deleted' });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true }).select('+password');

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