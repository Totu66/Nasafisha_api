import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import type { File } from 'multer';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class StorageService {
  private readonly bucket = process.env.S3_BUCKET;
  private readonly s3 = this.bucket
    ? new S3Client({
        region: process.env.S3_REGION || 'auto',
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: !!process.env.S3_ENDPOINT,
        credentials: process.env.S3_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY,
              secretAccessKey: process.env.S3_SECRET_KEY ?? '',
            }
          : undefined,
      })
    : null;

  async save(file: File, folder: string): Promise<string> {
    const ext =
      (file.mimetype.split('/')[1] ?? 'jpg')
        .replace('jpeg', 'jpg')
        .replace(/[^a-z0-9]/gi, '') || 'jpg';
    const key = `${folder}/${randomUUID()}.${ext}`;

    if (this.s3 && this.bucket) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } else {
      await mkdir(join(process.cwd(), 'uploads', folder), {
        recursive: true,
      });
      await writeFile(join(process.cwd(), 'uploads', key), file.buffer);
    }
    return key;
  }

  async urlFor(key?: string | null): Promise<string | null> {
    if (!key) return null;
    if (this.s3 && this.bucket) {
      return getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn: 3600 },
      );
    }
    return `${process.env.PUBLIC_API_URL ?? 'http://localhost:3000'}/uploads/${key}`;
  }
}
