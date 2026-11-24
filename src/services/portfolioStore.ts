import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { DEFAULT_SITE_CONFIG } from '../data/defaultSite';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import type { ContactMessage, MediaType, SiteConfig, UploadedAsset } from '../types/site';
import { sanitizeSiteConfig, sanitizeText } from '../utils/siteSanitizer';

const CHUNK_CHAR_LIMIT = 600_000;
const MAX_MEDIA_BYTES = 18 * 1024 * 1024;
const MAX_CHUNKS = 40;

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.jfif',
  '.webp',
  '.gif',
  '.avif',
  '.bmp',
  '.ico',
  '.tiff',
  '.tif',
  '.heic',
  '.heif',
  '.svg',
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.m4v',
  '.webm',
  '.mov',
  '.ogg',
  '.ogv',
  '.mkv',
  '.3gp',
  '.avi',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'image/x-icon': '.ico',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/ogg': '.ogg',
  'video/x-matroska': '.mkv',
};

const resolvedMediaCache = new Map<string, string>();
const inflightMediaCache = new Map<string, Promise<string>>();

function timestampToIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

function getFileExtension(filename: string, mimeType: string): string {
  const cleanMime = mimeType.toLowerCase().split(';')[0].trim();
  const match = /\.[a-z0-9]{1,8}$/i.exec(filename.trim());
  const rawExt = match ? match[0].toLowerCase() : '';
  if (IMAGE_EXTENSIONS.has(rawExt) || VIDEO_EXTENSIONS.has(rawExt)) {
    return rawExt;
  }
  return MIME_TO_EXT[cleanMime] || '.bin';
}

function detectMediaType(filename: string, mimeType: string): MediaType | null {
  const cleanMime = mimeType.toLowerCase().split(';')[0].trim();
  const ext = getFileExtension(filename, cleanMime);
  if (VIDEO_EXTENSIONS.has(ext) || cleanMime.startsWith('video/')) return 'video';
  if (IMAGE_EXTENSIONS.has(ext) || cleanMime.startsWith('image/')) return 'image';
  return null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const blockSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += blockSize) {
    const slice = bytes.subarray(i, Math.min(i + blockSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function optimizeUploadBlob(
  file: File,
  mediaType: MediaType,
): Promise<{ blob: Blob; mimeType: string; ext: string }> {
  const rawMime = (file.type || '').toLowerCase().split(';')[0].trim();
  const rawExt = getFileExtension(file.name, rawMime);

  if (mediaType === 'image' && rawExt === '.svg') {
    const text = await file.text();
    if (/<script\b/i.test(text) || /<foreignObject\b/i.test(text)) {
      throw new Error('File SVG mengandung skrip yang tidak diperbolehkan.');
    }
    const cleaned = text
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/javascript:/gi, '');
    return {
      blob: new Blob([cleaned], { type: 'image/svg+xml' }),
      mimeType: 'image/svg+xml',
      ext: '.svg',
    };
  }

  if (
    mediaType !== 'image' ||
    rawExt === '.gif' ||
    rawExt === '.ico' ||
    file.size <= 380_000
  ) {
    const fallbackMime =
      rawMime ||
      (mediaType === 'video' ? 'video/mp4' : rawExt === '.png' ? 'image/png' : 'image/jpeg');
    return { blob: file, mimeType: fallbackMime, ext: rawExt };
  }

  try {
    const bitmapUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Image decode failed'));
      element.src = bitmapUrl;
    });
    URL.revokeObjectURL(bitmapUrl);

    const maxDim = 2048;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { blob: file, mimeType: rawMime || 'image/jpeg', ext: rawExt };
    }
    ctx.drawImage(img, 0, 0, width, height);

    let hasTransparency = false;
    if (rawExt === '.png' || rawExt === '.webp') {
      const sample = ctx.getImageData(0, 0, Math.min(width, 256), Math.min(height, 256)).data;
      for (let i = 3; i < sample.length; i += 16) {
        if (sample[i] < 252) {
          hasTransparency = true;
          break;
        }
      }
    }

    const targetMime = hasTransparency ? 'image/png' : 'image/webp';
    const targetExt = hasTransparency ? '.png' : '.webp';

    const encoded = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, targetMime, 0.86),
    );

    if (encoded && encoded.size > 0 && encoded.size < file.size) {
      return { blob: encoded, mimeType: targetMime, ext: targetExt };
    }
  } catch {
    // Keep original file if browser canvas optimization isn't supported (e.g. HEIC)
  }

  return {
    blob: file,
    mimeType: rawMime || 'image/jpeg',
    ext: rawExt,
  };
}

export function extractMediaAssetId(url: string): string | null {
  if (!url.startsWith('/api/media/')) return null;
  const tail = url.slice('/api/media/'.length).split(/[?#]/)[0];
  const dotIndex = tail.indexOf('.');
  const rawId = dotIndex >= 0 ? tail.slice(0, dotIndex) : tail;
  return /^[a-zA-Z0-9_-]{1,128}$/.test(rawId) ? rawId : null;
}

export async function resolveCloudMediaUrl(url: string): Promise<string> {
  if (!url || !url.startsWith('/api/media/')) return url;
  const existingCached = resolvedMediaCache.get(url);
  if (existingCached) return existingCached;

  const inflight = inflightMediaCache.get(url);
  if (inflight) return inflight;

  const assetId = extractMediaAssetId(url);
  if (!assetId) return url;

  const task = (async () => {
    try {
      const metaSnap = await getDoc(doc(db, 'media_assets', assetId));
      if (!metaSnap.exists()) return url;

      const meta = metaSnap.data() as {
        chunkCount?: number;
        mimeType?: string;
        mediaType?: MediaType;
      };
      const chunkCount = Number(meta.chunkCount ?? 0);
      if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > MAX_CHUNKS) {
        return url;
      }

      const chunkSnaps = await Promise.all(
        Array.from({ length: chunkCount }, (_, i) =>
          getDoc(doc(db, 'media_assets', assetId, 'chunks', String(i))),
        ),
      );

      let combinedBase64 = '';
      for (const snap of chunkSnaps) {
        if (!snap.exists()) return url;
        const chunkData = snap.data()?.data;
        if (typeof chunkData !== 'string') return url;
        combinedBase64 += chunkData;
      }

      const bytes = base64ToUint8Array(combinedBase64);
      const mimeType =
        meta.mimeType || (meta.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);
      resolvedMediaCache.set(url, objectUrl);
      return objectUrl;
    } catch {
      return url;
    } finally {
      inflightMediaCache.delete(url);
    }
  })();

  inflightMediaCache.set(url, task);
  return task;
}

export function useCloudMediaUrl(url: string | undefined): string {
  const safeUrl = url || '';
  const [resolved, setResolved] = useState<string>(() => {
    if (!safeUrl.startsWith('/api/media/')) return safeUrl;
    return resolvedMediaCache.get(safeUrl) || safeUrl;
  });

  useEffect(() => {
    if (!safeUrl.startsWith('/api/media/')) {
      setResolved(safeUrl);
      return;
    }

    const cached = resolvedMediaCache.get(safeUrl);
    if (cached) {
      setResolved(cached);
      return;
    }

    let active = true;
    void resolveCloudMediaUrl(safeUrl).then((nextUrl) => {
      if (active) setResolved(nextUrl);
    });

    return () => {
      active = false;
    };
  }, [safeUrl]);

  return resolved;
}

export function subscribeToSiteConfig(
  onData: (site: SiteConfig) => void,
  onError?: (err: Error) => void,
): () => void {
  const ref = doc(db, 'site', 'main');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(structuredClone(DEFAULT_SITE_CONFIG));
        return;
      }
      const raw = snap.data() as Partial<SiteConfig> & { updatedAt?: unknown; updatedBy?: unknown };
      onData(sanitizeSiteConfig(raw, DEFAULT_SITE_CONFIG));
    },
    (error) => {
      console.error('Firestore site subscription error:', error);
      onError?.(error);
    },
  );
}

export async function saveSiteConfigToCloud(site: SiteConfig, user: User): Promise<SiteConfig> {
  const clean = sanitizeSiteConfig(site, DEFAULT_SITE_CONFIG);
  const path = 'site/main';
  try {
    await setDoc(doc(db, 'site', 'main'), {
      ...clean,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
    return clean;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function uploadMediaToCloud(
  file: File,
  user: User,
): Promise<{ asset: UploadedAsset; url: string; mediaType: MediaType }> {
  const mediaType = detectMediaType(file.name, file.type);
  if (!mediaType) {
    throw new Error(
      'Format file tidak didukung. Gunakan foto (PNG, JPG, WebP, GIF, AVIF, SVG, BMP, ICO, HEIC) atau video (MP4, WebM, MOV, MKV, M4V, OGG).',
    );
  }

  const { blob, mimeType, ext } = await optimizeUploadBlob(file, mediaType);
  if (blob.size > MAX_MEDIA_BYTES) {
    throw new Error('Ukuran file setelah optimasi masih melebihi batas 18 MB per file.');
  }

  const buffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += CHUNK_CHAR_LIMIT) {
    chunks.push(base64.slice(i, i + CHUNK_CHAR_LIMIT));
  }

  if (chunks.length === 0 || chunks.length > MAX_CHUNKS) {
    throw new Error('Ukuran file terlalu besar untuk disimpan di database.');
  }

  const assetId = `asset_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const filename = `${assetId}${ext}`;
  const cleanOriginal = sanitizeText(file.name, 160) || filename;
  const assetPath = `media_assets/${assetId}`;

  try {
    await setDoc(doc(db, 'media_assets', assetId), {
      id: assetId,
      filename: cleanOriginal,
      mimeType,
      mediaType,
      size: blob.size,
      chunkCount: chunks.length,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, assetPath);
  }

  try {
    for (let start = 0; start < chunks.length; start += 4) {
      const batch = chunks.slice(start, start + 4);
      await Promise.all(
        batch.map((dataSlice, offset) => {
          const index = start + offset;
          return setDoc(doc(db, 'media_assets', assetId, 'chunks', String(index)), {
            assetId,
            index,
            data: dataSlice,
            ownerId: user.uid,
            createdAt: serverTimestamp(),
          });
        }),
      );
    }
  } catch (error) {
    await deleteDoc(doc(db, 'media_assets', assetId)).catch(() => {});
    handleFirestoreError(error, OperationType.CREATE, `${assetPath}/chunks`);
  }

  const url = `/api/media/${filename}`;
  try {
    const objectUrl = URL.createObjectURL(blob);
    resolvedMediaCache.set(url, objectUrl);
  } catch {
    // Non-fatal
  }

  return {
    asset: {
      id: assetId,
      filename: cleanOriginal,
      url,
      mediaType,
      size: blob.size,
      createdAt: new Date().toISOString(),
    },
    url,
    mediaType,
  };
}

export async function listCloudMediaAssets(user: User): Promise<UploadedAsset[]> {
  const path = 'media_assets';
  try {
    const isPrimaryAdmin = user.email === BOOTSTRAPPED_ADMIN_EMAIL;
    const q = isPrimaryAdmin
      ? query(collection(db, 'media_assets'), orderBy('createdAt', 'desc'), limit(100))
      : query(collection(db, 'media_assets'), where('ownerId', '==', user.uid), limit(100));

    const snap = await getDocs(q);
    const items: UploadedAsset[] = snap.docs.map((docSnap) => {
      const data = docSnap.data() as {
        id: string;
        filename: string;
        mimeType?: string;
        mediaType?: MediaType;
        size?: number;
        createdAt?: unknown;
      };
      const ext = getFileExtension(data.filename || '', data.mimeType || '');
      return {
        id: data.id || docSnap.id,
        filename: data.filename || `${docSnap.id}${ext}`,
        url: `/api/media/${data.id || docSnap.id}${ext}`,
        mediaType: data.mediaType === 'video' ? 'video' : 'image',
        size: Number(data.size ?? 0),
        createdAt: timestampToIso(data.createdAt),
      };
    });

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteCloudMediaAsset(assetId: string): Promise<void> {
  const path = `media_assets/${assetId}`;
  try {
    const metaSnap = await getDoc(doc(db, 'media_assets', assetId));
    if (metaSnap.exists()) {
      const chunkCount = Number(metaSnap.data()?.chunkCount ?? 0);
      if (chunkCount > 0 && chunkCount <= MAX_CHUNKS) {
        await Promise.all(
          Array.from({ length: chunkCount }, (_, i) =>
            deleteDoc(doc(db, 'media_assets', assetId, 'chunks', String(i))).catch(() => {}),
          ),
        );
      }
    }
    await deleteDoc(doc(db, 'media_assets', assetId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function submitContactMessageToCloud(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<string> {
  const name = sanitizeText(input.name, 80);
  const email = sanitizeText(input.email, 120);
  const subject = sanitizeText(input.subject, 120) || 'Pesan Portofolio';
  const message = sanitizeText(input.message, 2500);

  if (!name || !email || !message) {
    throw new Error('Nama, email, dan isi pesan wajib diisi.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Format email tidak valid.');
  }

  const id = `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const path = `contact_messages/${id}`;

  try {
    await setDoc(doc(db, 'contact_messages', id), {
      id,
      name,
      email,
      subject,
      message,
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function listContactMessagesFromCloud(): Promise<ContactMessage[]> {
  const path = 'contact_messages';
  try {
    const snap = await getDocs(
      query(collection(db, 'contact_messages'), orderBy('createdAt', 'desc'), limit(200)),
    );
    return snap.docs.map((docSnap) => {
      const data = docSnap.data() as {
        id?: string;
        name?: string;
        email?: string;
        subject?: string;
        message?: string;
        createdAt?: unknown;
      };
      return {
        id: data.id || docSnap.id,
        name: data.name || 'Anonim',
        email: data.email || '',
        subject: data.subject || 'Pesan Portofolio',
        message: data.message || '',
        createdAt: timestampToIso(data.createdAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteContactMessageFromCloud(id: string): Promise<void> {
  const path = `contact_messages/${id}`;
  try {
    await deleteDoc(doc(db, 'contact_messages', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function grantAdminAccess(uid: string, email: string): Promise<void> {
  const cleanUid = sanitizeText(uid, 128);
  const cleanEmail = sanitizeText(email, 160);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(cleanUid)) {
    throw new Error('UID Google tidak valid.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Alamat email tidak valid.');
  }
  const path = `admins/${cleanUid}`;
  try {
    await setDoc(doc(db, 'admins', cleanUid), {
      uid: cleanUid,
      email: cleanEmail,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
