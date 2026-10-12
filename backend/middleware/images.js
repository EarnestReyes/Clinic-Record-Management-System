import multer from 'multer';
import { validateFile } from './uploads.js';
import { ApiError } from './errors.js';
const parseImage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 } }).single('file');
export const imageUpload = (req, res, next) => { req.imageUpload = true; parseImage(req, res, next); };
export function image(file) {
  if (!file || file.buffer.length > 2 * 1024 * 1024 || !/\.(png|jpe?g)$/i.test(file.originalname)) throw new ApiError(400, 'Choose a PNG or JPEG image under 2 MB.');
  const { mime } = validateFile(file);
  return { bytes: file.buffer, mime };
}
