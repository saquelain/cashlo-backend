import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config/environment.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
  },
});

export const uploadFile = async (buffer, originalName, mimetype, folder = 'blogs') => {
  const ext = path.extname(originalName);
  const key = `${folder}/${uuidv4()}${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  }));

  return {
    key,
    publicUrl: `${config.r2.publicUrl}/${key}`,
  };
};

export const getPublicUrl = (key) => {
  if (!key) return null;
  if (key.startsWith('http')) return key;
  return `${config.r2.publicUrl}/${key}`;
};