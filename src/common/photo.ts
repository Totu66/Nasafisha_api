import { FileInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';
import { ApiError, ERROR_CODES } from './errors';
import type { Point } from './geo';

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export const PhotoUpload = FileInterceptor('photo', {
  limits: { fileSize: 25 * 1024 * 1024 },
});

export function requirePhoto(
  file: Multer.File | undefined,
  missingCode: string,
): Multer.File {
  if (!file) throw new ApiError(missingCode, 'A photo is required.', 422);
  if (!file.mimetype.startsWith('image/')) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_ERROR,
      'The file must be an image.',
      400,
    );
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new ApiError(
      'PHOTO_TOO_LARGE',
      'The photo is too big. Retake it at a lower quality.',
      413,
    );
  }
  return file;
}

export interface PhotoLocationInput {
  lat?: number;
  lng?: number;
  capturedAt?: string;
}

export function readLocation(input: PhotoLocationInput): {
  point: Point;
  capturedAt: Date;
} {
  const bad = () =>
    new ApiError(
      'LOCATION_UNAVAILABLE',
      "We need the photo's location and time to verify it.",
      422,
    );
  const { lat, lng, capturedAt } = input;

  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    throw bad();
  }
  if (!capturedAt) throw bad();

  const time = new Date(capturedAt);
  if (Number.isNaN(time.getTime()) || time.getTime() > Date.now() + 5 * 60_000) {
    throw bad();
  }

  return { point: { lat, lng }, capturedAt: time };
}
