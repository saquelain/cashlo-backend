import express from 'express';
import {
  getCategories, createCategory, updateCategory, deleteCategory,
} from '../controllers/category.controller.js';
import { protect, restrictTo } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', getCategories);

router.use(protect);
router.use(restrictTo('admin', 'editor'));
router.post('/', createCategory);
router.patch('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;