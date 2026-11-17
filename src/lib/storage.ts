import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

/**
 * Storage Abstraction Provider Interface
 * Prepares the architecture for seamless migration to Cloud Object Storage (AWS S3, GCP Cloud Storage)
 */
export interface StorageProvider {
  save(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * Local Application-Managed Storage Provider
 * Stores private files outside the public directory. Access is mediated by authenticated API endpoints.
 */
export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(customDir?: string) {
    this.baseDir = customDir || path.join(process.cwd(), "storage", "photos");
  }

  private resolvePath(key: string): string {
    // Prevent directory traversal attacks
    const sanitizedKey = path.basename(key);
    if (!sanitizedKey || sanitizedKey.includes("..") || sanitizedKey !== key) {
      throw new Error("Invalid or unsafe file key specified.");
    }
    const targetPath = path.join(this.baseDir, sanitizedKey);
    const normalizedTarget = path.normalize(targetPath);
    const normalizedBase = path.normalize(this.baseDir);
    if (!normalizedTarget.startsWith(normalizedBase)) {
      throw new Error("Path traversal attempted.");
    }
    return targetPath;
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch {
      // ignore if exists
    }
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    await this.ensureDir();
    const filePath = this.resolvePath(key);
    await fs.writeFile(filePath, buffer);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const filePath = this.resolvePath(key);
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.resolvePath(key);
      await fs.unlink(filePath);
    } catch {
      // ignore if already deleted
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolvePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Global active storage provider instance
export const storageProvider: StorageProvider = new LocalStorageProvider();

/**
 * Validates actual binary content using magic numbers (file signatures)
 * Prevents disguised executable / script uploads.
 */
export function validateImageMagicBytes(buffer: Buffer): { valid: boolean; detectedMime?: string } {
  if (buffer.length < 12) return { valid: false };

  // JPEG signature: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedMime: "image/jpeg" };
  }

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedMime: "image/png" };
  }

  // WebP signature: 'RIFF'....'WEBP'
  const riff = buffer.toString("ascii", 0, 4);
  const webp = buffer.toString("ascii", 8, 12);
  if (riff === "RIFF" && webp === "WEBP") {
    return { valid: true, detectedMime: "image/webp" };
  }

  return { valid: false };
}

export interface ProcessedImageResult {
  fileKey: string;
  thumbnailKey: string;
  mainBuffer: Buffer;
  thumbBuffer: Buffer;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
}

/**
 * Process, sanitize, and compress an uploaded image buffer:
 * - Strips EXIF metadata (GPS location, camera serial) for security
 * - Auto-orients image based on orientation tag
 * - Compresses main image to WebP (max 1920x1920)
 * - Generates high-efficiency 300x300 thumbnail
 */
export async function processAndOptimizeImage(
  inputBuffer: Buffer,
  assetId: string
): Promise<ProcessedImageResult> {
  const validation = validateImageMagicBytes(inputBuffer);
  if (!validation.valid) {
    throw new Error("Invalid image file format. Only JPEG, PNG, and WebP images are permitted.");
  }

  // Generate unique storage keys
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const fileKey = `photo_${assetId}_${timestamp}_${randomSuffix}.webp`;
  const thumbnailKey = `thumb_${assetId}_${timestamp}_${randomSuffix}.webp`;

  // Process main image (auto-orient, strip metadata, resize if larger than 1920, compress to WebP)
  const image = sharp(inputBuffer).rotate(); // auto-rotate based on EXIF before stripping
  const metadata = await image.metadata();

  const mainBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: 1920,
      height: 1920,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  const mainMeta = await sharp(mainBuffer).metadata();

  // Generate 300x300 thumbnail
  const thumbBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: 300,
      height: 300,
      fit: "cover",
      position: "centre",
    })
    .webp({ quality: 80, effort: 3 })
    .toBuffer();

  return {
    fileKey,
    thumbnailKey,
    mainBuffer,
    thumbBuffer,
    mimeType: "image/webp",
    fileSize: mainBuffer.length,
    width: mainMeta.width || metadata.width || 0,
    height: mainMeta.height || metadata.height || 0,
  };
}

