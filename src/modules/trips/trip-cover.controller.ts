import { Request, Response } from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { TripService } from './trip.service';
import { TripRepository } from './trip.repository';
import { ok, fail } from '../../shared/types/response.types';

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

export const coverUploadMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      cb(new Error('INVALID_MIME'));
      return;
    }
    cb(null, true);
  },
}).single('cover');

const service = new TripService(new TripRepository());

export async function uploadTripCover(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.params['tripId'] as string;
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json(fail('NO_FILE', 'cover file is required'));
      return;
    }
    const url = `/uploads/trips/${tripId}/${file.filename}`;
    const trip = await service.updateTrip(tripId, { coverImage: url }, req.user!.id);
    res.json(ok(trip));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    if (msg === 'NOT_FOUND') res.status(404).json(fail('NOT_FOUND', 'Trip not found'));
    else if (msg === 'FORBIDDEN') res.status(403).json(fail('FORBIDDEN', 'Not allowed'));
    else res.status(500).json(fail('INTERNAL', msg));
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
