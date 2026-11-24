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
import siteSnapshotJson from '../data/site-snapshot.json';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  FIRESTORE_QUOTA_UPGRADE_URL,
  handleFirestoreError,
  isQuotaExceededError,
  OperationType,
} from '../lib/firebase';
import type { ContactMessage, MediaType, SiteConfig, UploadedAsset } from '../types/site';
import { sanitizeSiteConfig, sanitizeText } from '../utils/siteSanitizer';

export const COMMITTED_SITE_CONFIG: SiteConfig = sanitizeSiteConfig(
  siteSnapshotJson as Partial<SiteConfig>,
  DEFAULT_SITE_CONFIG,
);

const SITE_CACHE_KEY = 'uj_site_snapshot_v3';
const ADMIN_DRAFT_PREFIX = 'uj_admin_draft_v3_';
const CONTACT_COOLDOWN_KEY = 'uj_contact_cooldown_v1';
const IDB_NAME = 'uj_portfolio_vault';
const IDB_VERSION = 1;
const IDB_MEDIA_STORE = 'media_blobs';

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

interface CachedSiteRecord {
  site: SiteConfig;
  savedAt: string;
}

export interface AdminDraftRecord {
  draft: SiteConfig;
  savedAt: string;
}

export interface GitHubSyncStatus {
  configured: boolean;
  repo: string;
  branch: string;
}

export interface GitHubPublishResult {
  ok: boolean;
  commitUrl?: string;
  commitSha?: string;
  committedFiles?: string[];
  site: SiteConfig;
}

function openVaultDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(IDB_MEDIA_STORE)) {
          database.createObjectStore(IDB_MEDIA_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readMediaBlobFromVault(
  assetId: string,
): Promise<{ blob: Blob; mimeType: string; filename?: string } | null> {
  const database = await openVaultDb();
  if (!database) return null;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(IDB_MEDIA_STORE, 'readonly');
      const req = tx.objectStore(IDB_MEDIA_STORE).get(assetId);
      req.onsuccess = () => {
        const record = req.result as
          | { id: string; blob?: Blob; mimeType?: string; filename?: string }
          | undefined;
        if (record?.blob instanceof Blob) {
          resolve({
            blob: record.blob,
            mimeType: record.mimeType || record.blob.type || 'application/octet-stream',
            filename: record.filename,
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeMediaBlobToVault(
  assetId: string,
  blob: Blob,
  mimeType: string,
  filename?: string,
): Promise<void> {
  const database = await openVaultDb();
  if (!database) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = database.transaction(IDB_MEDIA_STORE, 'readwrite');
      tx.objectStore(IDB_MEDIA_STORE).put({
        id: assetId,
        blob,
        mimeType,
        filename: filename || assetId,
        savedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function deleteMediaBlobFromVault(assetId: string): Promise<void> {
  const database = await openVaultDb();
  if (!database) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = database.transaction(IDB_MEDIA_STORE, 'readwrite');
      tx.objectStore(IDB_MEDIA_STORE).delete(assetId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function readCachedSiteSnapshot(): SiteConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SITE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedSiteRecord>;
    if (!parsed?.site || typeof parsed.site !== 'object') return null;
    return sanitizeSiteConfig(parsed.site, COMMITTED_SITE_CONFIG);
  } catch {
    return null;
  }
}

export function writeCachedSiteSnapshot(site: SiteConfig): void {
  if (typeof window === 'undefined') return;
  try {
    const record: CachedSiteRecord = {
      site,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SITE_CACHE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage quota errors
  }
}

export function getInitialSiteConfig(): SiteConfig {
  return readCachedSiteSnapshot() ?? structuredClone(COMMITTED_SITE_CONFIG);
}

export function loadAdminDraftLocal(uid: string): AdminDraftRecord | null {
  if (typeof window === 'undefined' || !uid) return null;
  try {
    const raw = window.localStorage.getItem(`${ADMIN_DRAFT_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminDraftRecord>;
    if (!parsed?.draft || typeof parsed.draft !== 'object') return null;
    return {
      draft: sanitizeSiteConfig(parsed.draft, COMMITTED_SITE_CONFIG),
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveAdminDraftLocal(uid: string, draft: SiteConfig): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    const record: AdminDraftRecord = {
      draft,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(`${ADMIN_DRAFT_PREFIX}${uid}`, JSON.stringify(record));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearAdminDraftLocal(uid: string): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.removeItem(`${ADMIN_DRAFT_PREFIX}${uid}`);
  } catch {
    // Ignore
  }
}

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
      const vaultHit = await readMediaBlobFromVault(assetId);
      if (vaultHit) {
        const objectUrl = URL.createObjectURL(vaultHit.blob);
        resolvedMediaCache.set(url, objectUrl);
        return objectUrl;
      }

      const metaSnap = await getDoc(doc(db, 'media_assets', assetId));
      if (!metaSnap.exists()) return url;

      const meta = metaSnap.data() as {
        chunkCount?: number;
        mimeType?: string;
        mediaType?: MediaType;
        filename?: string;
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
      await writeMediaBlobToVault(assetId, blob, mimeType, meta.filename);
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
  let receivedCloudDoc = false;

  void fetch('/api/site')
    .then((res) => (res.ok ? res.json() : null))
    .then((serverSite: Partial<SiteConfig> | null) => {
      if (receivedCloudDoc || !serverSite || typeof serverSite !== 'object') return;
      const sanitizedServer = sanitizeSiteConfig(serverSite, COMMITTED_SITE_CONFIG);
      const localCached = readCachedSiteSnapshot();
      if (!localCached) {
        writeCachedSiteSnapshot(sanitizedServer);
        onData(sanitizedServer);
      }
    })
    .catch(() => {});

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        // Never wipe locally cached or GitHub-committed site back to blank defaults when cloud doc is missing
        const fallback = readCachedSiteSnapshot() ?? structuredClone(COMMITTED_SITE_CONFIG);
        onData(fallback);
        return;
      }
      receivedCloudDoc = true;
      const raw = snap.data() as Partial<SiteConfig> & { updatedAt?: unknown; updatedBy?: unknown };
      const clean = sanitizeSiteConfig(raw, COMMITTED_SITE_CONFIG);
      writeCachedSiteSnapshot(clean);
      onData(clean);
    },
    (error) => {
      console.error('Firestore site subscription error:', error);
      onError?.(error);
    },
  );
}

export async function saveSiteConfigToCloud(site: SiteConfig, user: User): Promise<SiteConfig> {
  const clean = sanitizeSiteConfig(site, COMMITTED_SITE_CONFIG);
  writeCachedSiteSnapshot(clean);

  // Sync to local server snapshot if running locally / non-Vercel Node server
  try {
    const idToken = await user.getIdToken();
    await fetch('/api/site', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(clean),
    }).catch(() => {});
  } catch {
    // Non-fatal if serverless filesystem is read-only
  }

  const path = 'site/main';
  try {
    await setDoc(doc(db, 'site', 'main'), {
      ...clean,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
    return clean;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw new Error(
        `Kuota baca/tulis harian gratis Firestore tercapai, tetapi perubahan sudah diamankan di perangkat ini. Anda bisa menerbitkan ke GitHub atau meninjau kuota di: ${FIRESTORE_QUOTA_UPGRADE_URL}`,
      );
    }
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

  // Cache media blob in browser IndexedDB vault immediately
  await writeMediaBlobToVault(assetId, blob, mimeType, cleanOriginal);

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
    if (isQuotaExceededError(error)) {
      throw new Error(
        `Kuota harian gratis Firestore tercapai saat mengunggah file. Tunggu reset kuota harian atau tingkatkan kuota database di Firebase Console.`,
      );
    }
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
    if (isQuotaExceededError(error)) {
      throw new Error('Kuota harian Firestore tercapai saat menyimpan potongan file.');
    }
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
    if (isQuotaExceededError(error)) {
      return [];
    }
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteCloudMediaAsset(assetId: string): Promise<void> {
  const path = `media_assets/${assetId}`;
  await deleteMediaBlobFromVault(assetId).catch(() => {});
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

function collectMediaUrlsFromSite(site: SiteConfig): string[] {
  const urls = new Set<string>();
  const add = (value: string | undefined) => {
    if (value && value.startsWith('/api/media/')) {
      urls.add(value.trim());
    }
  };
  add(site.logo?.imageUrl);
  add(site.hero?.imageUrl);
  add(site.hero?.portraitUrl);
  add(site.about?.showcaseImageUrl);
  site.projects.forEach((p) => add(p.imageUrl));
  site.certificates.forEach((c) => add(c.imageUrl));
  site.works.forEach((w) => add(w.imageUrl));
  site.pages.forEach((p) => add(p.coverUrl));
  return Array.from(urls);
}

async function readMediaBase64ForPublish(
  url: string,
): Promise<{ filename: string; base64: string; url: string } | null> {
  const assetId = extractMediaAssetId(url);
  if (!assetId) return null;
  const filename = url.slice('/api/media/'.length).split(/[?#]/)[0];

  try {
    const vaultHit = await readMediaBlobFromVault(assetId);
    if (vaultHit && vaultHit.blob.size <= 3_500_000) {
      const buffer = await vaultHit.blob.arrayBuffer();
      return {
        url,
        filename,
        base64: arrayBufferToBase64(buffer),
      };
    }

    const resolved = await resolveCloudMediaUrl(url);
    const res = await fetch(resolved);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size > 3_500_000) return null;
    const buffer = await blob.arrayBuffer();
    return {
      url,
      filename,
      base64: arrayBufferToBase64(buffer),
    };
  } catch {
    return null;
  }
}

export async function getGitHubSyncStatus(user: User): Promise<GitHubSyncStatus> {
  try {
    const idToken = await user.getIdToken();
    const res = await fetch('/api/github/status', {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!res.ok) {
      return { configured: false, repo: '', branch: 'main' };
    }
    return (await res.json()) as GitHubSyncStatus;
  } catch {
    return { configured: false, repo: '', branch: 'main' };
  }
}

export async function publishSiteToGitHub(
  site: SiteConfig,
  user: User,
  commitMessage?: string,
): Promise<GitHubPublishResult> {
  const cleanSite = sanitizeSiteConfig(site, COMMITTED_SITE_CONFIG);
  const idToken = await user.getIdToken();

  // First commit any small-to-medium referenced /api/media/* files directly into public/media/ on GitHub
  const referencedMediaUrls = collectMediaUrlsFromSite(cleanSite);
  const rewrittenMap = new Map<string, string>();

  for (const mediaUrl of referencedMediaUrls) {
    const payload = await readMediaBase64ForPublish(mediaUrl);
    if (!payload) continue;
    const mediaRes = await fetch('/api/github/publish-media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        filename: payload.filename,
        contentBase64: payload.base64,
      }),
    });
    if (mediaRes.ok) {
      const result = (await mediaRes.json()) as { publicUrl?: string };
      if (result.publicUrl) {
        rewrittenMap.set(mediaUrl, result.publicUrl);
      }
    }
  }

  const rewriteUrl = (val: string): string => rewrittenMap.get(val) || val;
  const siteForGitHub: SiteConfig =
    rewrittenMap.size === 0
      ? cleanSite
      : {
          ...cleanSite,
          logo: { ...cleanSite.logo, imageUrl: rewriteUrl(cleanSite.logo.imageUrl) },
          hero: {
            ...cleanSite.hero,
            imageUrl: rewriteUrl(cleanSite.hero.imageUrl),
            portraitUrl: rewriteUrl(cleanSite.hero.portraitUrl),
          },
          about: {
            ...cleanSite.about,
            showcaseImageUrl: rewriteUrl(cleanSite.about.showcaseImageUrl),
          },
          projects: cleanSite.projects.map((p) => ({ ...p, imageUrl: rewriteUrl(p.imageUrl) })),
          certificates: cleanSite.certificates.map((c) => ({
            ...c,
            imageUrl: rewriteUrl(c.imageUrl),
          })),
          works: cleanSite.works.map((w) => ({ ...w, imageUrl: rewriteUrl(w.imageUrl) })),
          pages: cleanSite.pages.map((p) => ({ ...p, coverUrl: rewriteUrl(p.coverUrl) })),
        };

  const res = await fetch('/api/github/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      site: siteForGitHub,
      commitMessage: commitMessage || `Update portofolio (${new Date().toISOString().slice(0, 16)})`,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as GitHubPublishResult & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Gagal menyimpan data ke repositori GitHub.');
  }

  writeCachedSiteSnapshot(siteForGitHub);
  return {
    ...data,
    site: siteForGitHub,
  };
}

export async function submitContactMessageToCloud(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  honeypot?: string;
  dwellMs?: number;
  challengeA?: number;
  challengeB?: number;
  challengeAnswer?: string;
}): Promise<string> {
  if (input.honeypot && input.honeypot.trim().length > 0) {
    throw new Error('Permintaan ditolak oleh sistem anti-bot.');
  }

  if (typeof input.dwellMs === 'number' && input.dwellMs < 2000) {
    throw new Error('Mohon luangkan beberapa detik sebelum mengirim pesan.');
  }

  if (
    typeof input.challengeA === 'number' &&
    typeof input.challengeB === 'number' &&
    Number(String(input.challengeAnswer ?? '').trim()) !== input.challengeA + input.challengeB
  ) {
    throw new Error('Jawaban verifikasi manusia tidak sesuai.');
  }

  if (typeof window !== 'undefined') {
    const lastSent = Number(window.localStorage.getItem(CONTACT_COOLDOWN_KEY) || '0');
    if (lastSent && Date.now() - lastSent < 45_000) {
      throw new Error('Mohon tunggu 45 detik sebelum mengirim pesan berikutnya.');
    }
  }

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
  if (message.length < 3) {
    throw new Error('Pesan terlalu singkat.');
  }
  const urlMatches = message.match(/https?:\/\//gi) || [];
  if (urlMatches.length > 2) {
    throw new Error('Pesan mengandung terlalu banyak tautan.');
  }

  // Verify through server anti-bot endpoint first when available
  const serverRes = await fetch('/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
    },
    body: JSON.stringify({
      name,
      email,
      subject,
      message,
      honeypot: input.honeypot || '',
      dwellMs: input.dwellMs ?? 3000,
      challengeA: input.challengeA ?? 0,
      challengeB: input.challengeB ?? 0,
      challengeAnswer: input.challengeAnswer ?? '0',
    }),
  }).catch(() => null);

  if (serverRes && !serverRes.ok) {
    const payload = (await serverRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || 'Permintaan ditolak oleh pelindung keamanan server.');
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
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CONTACT_COOLDOWN_KEY, String(Date.now()));
    }
    return id;
  } catch (error) {
    if (isQuotaExceededError(error) && serverRes?.ok) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CONTACT_COOLDOWN_KEY, String(Date.now()));
      }
      return id;
    }
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
    if (isQuotaExceededError(error)) {
      return [];
    }
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
