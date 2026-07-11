import { asyncHandler } from '../utils/asyncHandler.js';
import * as s3Service from '../services/s3.service.js';

export const uploadBlogImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided' });
  }

  const { key, publicUrl } = await s3Service.uploadFile(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype,
    'blogs/images'
  );

  res.status(200).json({ success: true, data: { imageUrl: publicUrl, key } });
});

export const uploadBlogPdf = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No PDF file provided' });
  }

  const { key, publicUrl } = await s3Service.uploadFile(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype,
    'blogs/pdfs'
  );

  res.status(200).json({ success: true, data: { pdfUrl: publicUrl, key } });
});