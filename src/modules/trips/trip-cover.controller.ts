import { Request, Response } from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { TripService } from './trip.service';
import { TripRepository } from './trip.repository';
import { ok, fail } from '../../shared/types/response.types';

function isSupportedImageMagicBytes(buf: Buffer): boolean {
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // WebP: RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return true;
  return false;
}

function readMagicBytes(filePath: string): Buffer {
  const buf = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, buf, 0, 12, 0);
  } finally {
    fs.closeSync(fd);
  }
  return buf;
}

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const tripId = req.params['tripId'] as string;
    const dir = path.join(UPLOADS_ROOT, 'trips', tripId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = /^\.(jpg|jpeg|png|webp)$/.test(ext) ? ext : '.jpg';
    cb(null, `cover-${Date.now()}${safeExt}`);
  },
});

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = /^\.(jpg|jpeg|png|webp)$/;

export const coverUploadMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      cb(new Error('INVALID_MIME'));
      return;
    }
    // Double-check extension to reject spoofed MIME types
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext && !ALLOWED_EXTENSIONS.test(ext)) {
      cb(new Error('INVALID_MIME'));
      return;
    }
    cb(null, true);
  },
}).single('cover');

const service = new TripService(new TripRepository());

export async function uploadTripCover(req: Request, res: Response): Promise<void> {
  try {
    if (req.tripRole === 'Editor' && !req.collaboratorPermissions?.canEditTripInfo) {
      res.status(403).json(fail('FORBIDDEN', 'Insufficient permission'));
      return;
    }
    const tripId = req.params['tripId'] as string;
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json(fail('NO_FILE', 'cover file is required'));
      return;
    }

    // Secondary magic-bytes check: multer's mimetype is browser-supplied and spoofable.
    // Read the actual file bytes to confirm the format.
    const magic = readMagicBytes(file.path);
    if (!isSupportedImageMagicBytes(magic)) {
      fs.unlinkSync(file.path);
      res.status(415).json(fail('INVALID_MIME', '只接受 JPG / PNG / WEBP 格式'));
      return;
    }

    const url = `/uploads/trips/${tripId}/${file.filename}`;
    const trip = await service.updateTrip(tripId, { coverImage: url }, req.user!.id);
    res.json(ok(trip));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Not allowed'));
    else res.status(500).json(fail('INTERNAL', 'Upload failed'));
  }
}

/** Centralised error handler for multer-rejected uploads. */
export function coverUploadErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: (e?: unknown) => void,
): void {
  if (!err) return next();
  if (err instanceof Error) {
    if (err.message === 'INVALID_MIME') {
      res.status(415).json(fail('INVALID_MIME', '只接受 JPG / PNG / WEBP 格式'));
      return;
    }
    if ('code' in err && (err as { code: string }).code === 'LIMIT_FILE_SIZE') {
      res.status(413).json(fail('FILE_TOO_LARGE', '檔案不能超過 5 MB'));
      return;
    }
  }
  next(err);
}
