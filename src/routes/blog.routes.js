import express from 'express';
import {
  getAllBlogs, getBlogBySlug, getBlogById,
  createBlog, updateBlog, deleteBlog, getBlogsGrouped,
} from '../controllers/blog.controller.js';
import { protect, restrictTo } from '../middlewares/auth.js';

const router = express.Router();

router.get('/grouped', getBlogsGrouped);
router.get('/', getAllBlogs);
router.get('/id/:id', getBlogById);
router.get('/:slug', getBlogBySlug);

router.use(protect);
router.use(restrictTo('admin', 'editor'));
router.post('/', createBlog);
router.patch('/:id', updateBlog);
router.delete('/:id', deleteBlog);

export default router;