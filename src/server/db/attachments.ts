import mongoose, { Types } from 'mongoose';
import { badRequest, notFound } from '../errors';

const { GridFSBucket } = mongoose.mongo;
type GridFSFile = mongoose.mongo.GridFSFile;

export const ATTACHMENT_BUCKET = 'attachments';
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_TICKET = 3;

export const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
]);

export interface AttachmentMeta {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: Date;
}

function bucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection is not ready.');
  return new GridFSBucket(db, { bucketName: ATTACHMENT_BUCKET });
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '');
  return cleaned.slice(0, 120) || 'file';
}

export function assertUploadable(file: { name: string; type: string; size: number }): void {
  if (file.size === 0) throw badRequest(`"${file.name}" is empty.`);

  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw badRequest(
      `"${file.name}" is larger than ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB.`,
    );
  }

  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    throw badRequest(
      `"${file.name}" has an unsupported type. Allowed: images, PDF, plain text and CSV.`,
    );
  }
}

export async function storeAttachment(
  ticketId: Types.ObjectId,
  file: { name: string; type: string; size: number; buffer: Buffer },
): Promise<AttachmentMeta> {
  assertUploadable(file);

  const filename = sanitizeFilename(file.name);
  const upload = bucket().openUploadStream(filename, {
    metadata: { ticketId, contentType: file.type },
  });

  await new Promise<void>((resolve, reject) => {
    upload.on('error', reject);
    upload.on('finish', () => resolve());
    upload.end(file.buffer);
  });

  return {
    id: upload.id.toString(),
    filename,
    contentType: file.type,
    size: file.size,
    uploadedAt: new Date(),
  };
}

export async function listAttachments(ticketId: Types.ObjectId): Promise<AttachmentMeta[]> {
  const files = await bucket().find({ 'metadata.ticketId': ticketId }).toArray();

  return files.map((file: GridFSFile) => ({
    id: file._id.toString(),
    filename: file.filename,
    contentType: attachmentContentType(file),
    size: file.length,
    uploadedAt: file.uploadDate,
  }));
}

export function attachmentContentType(file: GridFSFile): string {
  const meta = file.metadata as { contentType?: string } | undefined;
  const declared = meta?.contentType;
  return declared && ALLOWED_ATTACHMENT_TYPES.has(declared)
    ? declared
    : 'application/octet-stream';
}

export async function findAttachment(
  attachmentId: string,
): Promise<{ file: GridFSFile; ticketId: Types.ObjectId }> {
  if (!Types.ObjectId.isValid(attachmentId)) throw notFound('Attachment not found.');

  const [file] = await bucket()
    .find({ _id: new Types.ObjectId(attachmentId) })
    .toArray();

  if (!file) throw notFound('Attachment not found.');

  const ticketId = (file.metadata as { ticketId?: Types.ObjectId } | undefined)?.ticketId;
  if (!ticketId) throw notFound('Attachment not found.');

  return { file, ticketId };
}

export function openAttachmentDownload(attachmentId: string): NodeJS.ReadableStream {
  return bucket().openDownloadStream(new Types.ObjectId(attachmentId));
}

export async function deleteAttachmentsForTicket(ticketId: Types.ObjectId): Promise<void> {
  const files = await bucket().find({ 'metadata.ticketId': ticketId }).toArray();
  await Promise.all(files.map((file) => bucket().delete(file._id)));
}
