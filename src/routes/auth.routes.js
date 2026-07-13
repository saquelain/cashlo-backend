import express from 'express';
import { login, getMe, changePassword, createUser } from '../controllers/auth.controller.js';
import { protect, restrictTo } from '../middlewares/auth.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/change-password', protect, changePassword);
router.post('/users', protect, restrictTo('admin'), createUser);

export default router;