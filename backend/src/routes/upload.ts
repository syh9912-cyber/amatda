import { Router, Request, Response } from 'express';
import Busboy from 'busboy';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';
import { storage } from '../services/firestore';
import { success, error } from '../utils/response';
import { logger } from '../utils/logger';

const router = Router();

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  // 오디오 (자장가 녹음 등)
  'audio/mp4': '.m4a',
  'audio/x-caf': '.caf',
  'audio/3gpp': '.3gp',
  'audio/wav': '.wav',
  'audio/aac': '.aac',
  'audio/mpeg': '.mp3',
  'audio/x-m4a': '.m4a',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * POST /api/upload
 * multipart/form-data → Firebase Storage → 공개 URL 반환
 *
 * Cloud Functions에서는 req.body가 이미 파싱되므로
 * req.rawBody (Buffer)를 busboy에 직접 전달해야 함
 */
router.post('/', authMiddleware, (req: Request, res: Response) => {
  const userId = req.userId!;

  const busboy = Busboy({
    headers: req.headers,
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  });

  let folder = 'pregnancy';
  let fileProcessed = false;

  busboy.on('field', (name: string, val: string) => {
    if (name === 'folder') folder = val.replace(/[^a-zA-Z0-9_\-/]/g, '').replace(/\.\.+/g, '');
  });

  busboy.on('file', (_fieldname: string, stream: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
    const { filename, mimeType } = info;

    if (!ALLOWED_MIME[mimeType]) {
      stream.resume();
      if (!res.headersSent) error(res, `허용되지 않는 파일 형식입니다: ${mimeType}`, 400);
      return;
    }

    fileProcessed = true;
    const ext = ALLOWED_MIME[mimeType];
    const storagePath = `${folder}/${userId}/${uuidv4()}${ext}`;
    const file = storage.file(storagePath);

    const chunks: Buffer[] = [];
    let totalSize = 0;

    stream.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize <= MAX_FILE_SIZE) {
        chunks.push(chunk);
      }
    });

    stream.on('end', async () => {
      if (totalSize > MAX_FILE_SIZE) {
        if (!res.headersSent) error(res, '파일 크기가 50MB를 초과합니다', 413);
        return;
      }

      try {
        const buffer = Buffer.concat(chunks);
        // Firebase 다운로드 토큰 — 추측 불가능한 UUID. 토큰이 metadata에 있으면
        // ?alt=media&token=<uuid> URL은 storage rules와 무관하게 동작 (Firebase 내부 검증).
        // 결과적으로 storage.rules의 anonymous public read 의존성 제거.
        const downloadToken = uuidv4();
        await file.save(buffer, {
          metadata: {
            contentType: mimeType,
            metadata: {
              uploadedBy: userId,
              originalName: filename,
              firebaseStorageDownloadTokens: downloadToken,
            },
          },
          resumable: false,
        });

        const bucketName = file.bucket.name;
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
        const mediaType = mimeType.startsWith('video') ? 'video' : mimeType.startsWith('audio') ? 'audio' : 'photo';
        if (!res.headersSent) success(res, { url: publicUrl, mediaType, storagePath });
      } catch (err) {
        logger.error('upload/storage', err);
        if (!res.headersSent) error(res, '파일 업로드 중 오류가 발생했습니다', 500);
      }
    });
  });

  busboy.on('finish', () => {
    if (!fileProcessed && !res.headersSent) {
      error(res, '파일이 첨부되지 않았습니다', 400);
    }
  });

  busboy.on('error', (err: Error) => {
    logger.error('upload/busboy', err);
    if (!res.headersSent) error(res, '업로드 처리 중 오류가 발생했습니다', 500);
  });

  // Cloud Functions: req.rawBody가 있으면 그걸 사용, 없으면 pipe
  const rawBody = (req as unknown as Record<string, unknown>).rawBody as Buffer | undefined;
  if (rawBody) {
    busboy.end(rawBody);
  } else {
    req.pipe(busboy);
  }
});

export default router;
