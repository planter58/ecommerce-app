import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { isCloudEnabled } from '../utils/cloudinary.js';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Use in-memory storage if Cloudinary is enabled; otherwise write to local disk
const storage = isCloudEnabled()
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
        cb(null, name);
      }
    });

export const upload = multer({ storage });
