import express from 'express';
import {
  login,
  getMe,
  changePassword,
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
} from '../controllers/auth.controller.js';
import { protect, restrictTo } from '../middlewares/auth.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/change-password', protect, changePassword);
router.post('/users', protect, restrictTo('admin'), createUser);
router.get('/users', protect, restrictTo('admin'), listUsers);
router.get('/users/:id', protect, restrictTo('admin'), getUser);
router.patch('/users/:id', protect, restrictTo('admin'), updateUser);
router.delete('/users/:id', protect, restrictTo('admin'), deleteUser);

export default router;