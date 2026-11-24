import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import { DEFAULT_SITE_CONFIG } from './src/data/defaultSite.ts';
import type {
  ContactMessage,
  MediaType,
  SiteConfig,
  UploadedAsset,
} from './src/types/site.ts';
import { sanitizeSiteConfig, sanitizeText } from './src/utils/siteSanitizer.ts';

const BOOTSTRAPPED_ADMIN_EMAIL = 'usat.jalung25@students.utdi.ac.id';

interface PersistedStore {
  site: SiteConfig;
}

interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

interface AdminRequest extends Request {
  adminUser?: VerifiedFirebaseUser;
  adminIdToken?: string;
}

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL
  ? path.resolve('/tmp', 'usat-jalung-data')
  : path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'site-store.json');
const MESSAGES_PATH = path.resolve(DATA_DIR, 'messages.json');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const REPO_SNAPSHOT_PATH = path.resolve(process.cwd(), 'src', 'data', 'site-snapshot.json');

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.jfif',
  '.pjpeg',
  '.pjp',
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

// --- Google Public X.509 Cert Cache for Cryptographic Firebase JWT Verification ---
let cachedCerts: Record<string, string> = {};
let cachedCertsExpiresAt = 0;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < cachedCertsExpiresAt && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }

  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
  );
  if (!res.ok) {
    if (Object.keys(cachedCerts).length > 0) return cachedCerts;
    throw new Error('Gagal mengambil sertifikat verifikasi Firebase.');
  }

  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const maxAgeMs = maxAgeMatch ? Math.min(Number(maxAgeMatch[1]), 21600) * 1000 : 3600 * 1000;
  cachedCerts = certs;
  cachedCertsExpiresAt = now + maxAgeMs;
  return certs;
}

async function verifyFirebaseIdToken(token: string): Promise<VerifiedFirebaseUser | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string;
      kid?: string;
    };
    if (header.alg !== 'RS256' || !header.kid) return null;

    const certs = await getFirebasePublicCerts();
    const pem = certs[header.kid];
    if (!pem) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const sigBuffer = Buffer.from(sigB64, 'base64url');
    if (!verifier.verify(pem, sigBuffer)) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      aud?: string;
      iss?: string;
      sub?: string;
      exp?: number;
      iat?: number;
      auth_time?: number;
      email?: string;
      email_verified?: boolean;
    };

    const nowSec = Math.floor(Date.now() / 1000);
    const expectedIss = `https://securetoken.google.com/${firebaseConfig.projectId}`;
    if (payload.aud !== firebaseConfig.projectId) return null;
    if (payload.iss !== expectedIss) return null;
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
    if (typeof payload.iat !== 'number' || payload.iat > nowSec + 120) return null;
    if (payload.email_verified !== true || typeof payload.email !== 'string') return null;

    return {
      uid: payload.sub,
      email: payload.email,
      emailVerified: true,
    };
  } catch {
    return null;
  }
}

async function verifyAdminDocInFirestore(uid: string, idToken: string): Promise<boolean> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) return false;
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/admins/${uid}?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function requireFirebaseAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token autentikasi admin wajib disertakan.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const user = await verifyFirebaseIdToken(token);
  if (!user) {
    res.status(401).json({ error: 'Sesi Google Admin tidak valid atau sudah kedaluwarsa.' });
    return;
  }

  const isBootstrapped = user.email === BOOTSTRAPPED_ADMIN_EMAIL;
  const isListedAdmin = isBootstrapped || (await verifyAdminDocInFirestore(user.uid, token));
  if (!isListedAdmin) {
    res.status(403).json({ error: 'Akun Google ini tidak memiliki hak akses admin.' });
    return;
  }

  req.adminUser = user;
  req.adminIdToken = token;
  next();
}

// --- Anti-Bot & Sliding-Window Rate Limiting ---
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const ipPenaltyBox = new Map<string, { strikes: number; blockedUntil: number }>();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function checkBucketRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets.entries()) {
      if (v.resetAt < now) rateBuckets.delete(k);
    }
  }
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count += 1;
  return true;
}

function recordSuspiciousStrike(ip: string): void {
  const now = Date.now();
  const current = ipPenaltyBox.get(ip);
  const strikes = current && current.blockedUntil > now - 30 * 60 * 1000 ? current.strikes + 1 : 1;
  const blockedUntil = strikes >= 5 ? now + 30 * 60 * 1000 : 0;
  ipPenaltyBox.set(ip, { strikes, blockedUntil });
}

function isIpBlocked(ip: string): boolean {
  const current = ipPenaltyBox.get(ip);
  if (!current) return false;
  if (current.blockedUntil > Date.now()) return true;
  if (current.blockedUntil > 0) ipPenaltyBox.delete(ip);
  return false;
}

const SCANNER_UA_RE =
  /(sqlmap|nikto|nessus|masscan|zgrab|dirbuster|gobuster|wpscan|acunetix|nmap|hydra|havij|metasploit)/i;
const PROBE_PATH_RE =
  /(\/\.env|\/\.git|\/\.aws|\/wp-login\.php|\/wp-admin|\/xmlrpc\.php|\/phpmyadmin|\/config\.php|\/actuator|\/\.htaccess|\/vendor\/phpunit)/i;

function isSameOriginMutation(req: Request): boolean {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    return true;
  }
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (!hostHeader) return false;

  const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  if (originHeader) {
    try {
      const parsedOrigin = new URL(originHeader);
      return parsedOrigin.host.toLowerCase() === hostHeader;
    } catch {
      return false;
    }
  }

  const refererHeader = typeof req.headers.referer === 'string' ? req.headers.referer.trim() : '';
  if (refererHeader) {
    try {
      const parsedReferer = new URL(refererHeader);
      return parsedReferer.host.toLowerCase() === hostHeader;
    } catch {
      return false;
    }
  }

  // Require either matching Origin, Referer, or Bearer Authorization on API mutations
  return Boolean(req.headers.authorization?.startsWith('Bearer '));
}

// --- In-Memory LRU Cache for /api/media/:file ---
interface CachedMediaEntry {
  buffer: Buffer;
  mimeType: string;
  cachedAt: number;
}
const mediaMemoryCache = new Map<string, CachedMediaEntry>();
const MEDIA_CACHE_MAX_BYTES = 48 * 1024 * 1024;
const MEDIA_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function getCachedMedia(assetId: string): CachedMediaEntry | null {
  const hit = mediaMemoryCache.get(assetId);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > MEDIA_CACHE_TTL_MS) {
    mediaMemoryCache.delete(assetId);
    return null;
  }
  // Refresh LRU order
  mediaMemoryCache.delete(assetId);
  mediaMemoryCache.set(assetId, hit);
  return hit;
}

function setCachedMedia(assetId: string, entry: CachedMediaEntry): void {
  if (entry.buffer.length > 16 * 1024 * 1024) return;
  mediaMemoryCache.set(assetId, entry);
  let totalBytes = 0;
  for (const val of mediaMemoryCache.values()) {
    totalBytes += val.buffer.length;
  }
  while (totalBytes > MEDIA_CACHE_MAX_BYTES && mediaMemoryCache.size > 1) {
    const oldestKey = mediaMemoryCache.keys().next().value;
    if (!oldestKey) break;
    const removed = mediaMemoryCache.get(oldestKey);
    mediaMemoryCache.delete(oldestKey);
    if (removed) totalBytes -= removed.buffer.length;
  }
}

// --- Site Store Helpers ---
function ensureDirectories(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function readCommittedSnapshot(): SiteConfig {
  try {
    if (fs.existsSync(REPO_SNAPSHOT_PATH)) {
      const raw = JSON.parse(fs.readFileSync(REPO_SNAPSHOT_PATH, 'utf8')) as Partial<SiteConfig>;
      return sanitizeSiteConfig(raw, DEFAULT_SITE_CONFIG);
    }
  } catch {
    // Fallback to DEFAULT_SITE_CONFIG
  }
  return structuredClone(DEFAULT_SITE_CONFIG);
}

function readStore(): PersistedStore {
  ensureDirectories();
  const baseline = readCommittedSnapshot();

  if (!fs.existsSync(STORE_PATH)) {
    const initial: PersistedStore = { site: baseline };
    try {
      fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    } catch {
      // Read-only filesystem
    }
    return initial;
  }

  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedStore>;
    if (!parsed.site) return { site: baseline };
    return {
      site: sanitizeSiteConfig(parsed.site, baseline),
    };
  } catch {
    return { site: baseline };
  }
}

function writeStore(store: PersistedStore): void {
  ensureDirectories();
  const tempPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tempPath, STORE_PATH);

  if (!IS_VERCEL) {
    try {
      const snapTmp = `${REPO_SNAPSHOT_PATH}.tmp`;
      fs.writeFileSync(snapTmp, JSON.stringify(store.site, null, 2) + '\n', 'utf8');
      fs.renameSync(snapTmp, REPO_SNAPSHOT_PATH);
    } catch {
      // Ignore if repo path isn't writable
    }
  }
}

function readMessages(): ContactMessage[] {
  ensureDirectories();
  if (!fs.existsSync(MESSAGES_PATH)) return [];
  try {
    const raw = fs.readFileSync(MESSAGES_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ContactMessage[]) : [];
  } catch {
    return [];
  }
}

function writeMessages(messages: ContactMessage[]): void {
  ensureDirectories();
  const tempPath = `${MESSAGES_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(messages, null, 2), 'utf8');
  fs.renameSync(tempPath, MESSAGES_PATH);
}

// --- GitHub Contents API Integration (Server-Side Only) ---
function getGitHubConfig(): { token: string; repo: string; branch: string } {
  const token = (process.env.GITHUB_TOKEN ?? '').trim();
  const repo = (process.env.GITHUB_REPO ?? '').trim();
  const branch = (process.env.GITHUB_BRANCH ?? 'main').trim() || 'main';
  const validRepo = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo) ? repo : '';
  const validBranch = /^[a-zA-Z0-9._\/-]+$/.test(branch) ? branch : 'main';
  return { token, repo: validRepo, branch: validBranch };
}

async function upsertGitHubFile(params: {
  token: string;
  repo: string;
  branch: string;
  repoPath: string;
  contentBase64: string;
  message: string;
}): Promise<{ commitUrl?: string; commitSha?: string }> {
  const encodedPath = params.repoPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const apiUrl = `https://api.github.com/repos/${params.repo}/contents/${encodedPath}`;
  const headers = {
    Authorization: `Bearer ${params.token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'UsatJalung-Portfolio-Sync',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  let existingSha: string | undefined;
  const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(params.branch)}`, { headers });
  if (getRes.ok) {
    const json = (await getRes.json()) as { sha?: string };
    existingSha = json.sha;
  }

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: params.message,
      content: params.contentBase64,
      branch: params.branch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });

  if (!putRes.ok) {
    const errJson = (await putRes.json().catch(() => ({}))) as { message?: string };
    throw new Error(errJson.message || `GitHub API error (${putRes.status})`);
  }

  const putJson = (await putRes.json()) as {
    commit?: { html_url?: string; sha?: string };
  };
  return {
    commitUrl: putJson.commit?.html_url,
    commitSha: putJson.commit?.sha,
  };
}

// --- Legacy Upload Support (Gated Strictly by Firebase Admin) ---
const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpeg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
  'image/tiff': '.tiff',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/ogg': '.ogg',
  'application/ogg': '.ogg',
  'video/x-matroska': '.mkv',
  'application/x-matroska': '.mkv',
  'video/3gpp': '.3gp',
  'video/x-msvideo': '.avi',
  'video/avi': '.avi',
};

function resolveUploadExtension(originalname: string, mimetype: string): string {
  const ext = path.extname(originalname || '').toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext)) {
    return ext;
  }
  const cleanMime = (mimetype || '').toLowerCase().split(';')[0].trim();
  return MIME_TO_EXTENSION[cleanMime] ?? ext;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDirectories();
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = resolveUploadExtension(file.originalname, file.mimetype);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = resolveUploadExtension(file.originalname, file.mimetype);
    const mime = (file.mimetype || '').toLowerCase().split(';')[0].trim();
    const genericMime =
      !mime ||
      mime === 'application/octet-stream' ||
      mime === 'binary/octet-stream' ||
      mime === 'application/ogg' ||
      mime === 'application/x-matroska' ||
      mime === 'application/mp4';
    const isImage = IMAGE_EXTENSIONS.has(ext) && (genericMime || mime.startsWith('image/'));
    const isVideo = VIDEO_EXTENSIONS.has(ext) && (genericMime || mime.startsWith('video/'));
    if (isImage || isVideo) {
      cb(null, true);
      return;
    }
    cb(new Error('Format file tidak didukung.'));
  },
});

function sanitizeUploadedSvg(filePath: string): boolean {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (/<script\b/i.test(raw) || /<foreignObject\b/i.test(raw)) {
      fs.unlinkSync(filePath);
      return false;
    }
    const cleaned = raw
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/javascript:/gi, '');
    fs.writeFileSync(filePath, cleaned, 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function createApiApp(): express.Express {
  ensureDirectories();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Global Security Headers & Anti-Scanner Defense
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    const ip = getClientIp(req);
    if (isIpBlocked(ip)) {
      res.status(429).json({ error: 'Akses dibatasi sementara karena aktivitas mencurigakan.' });
      return;
    }

    const ua = String(req.headers['user-agent'] || '');
    if (PROBE_PATH_RE.test(req.path) || SCANNER_UA_RE.test(ua)) {
      recordSuspiciousStrike(ip);
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }

    if (req.path.startsWith('/api')) {
      if (!isSameOriginMutation(req)) {
        recordSuspiciousStrike(ip);
        res.status(403).json({ error: 'Permintaan lintas domain tidak diizinkan.' });
        return;
      }

      if (!checkBucketRateLimit(`api:${ip}`, 120, 60 * 1000)) {
        res.status(429).json({ error: 'Terlalu banyak permintaan. Coba sebentar lagi.' });
        return;
      }
    }

    next();
  });

  const jsonParser = express.json({ limit: '6mb' });
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      next();
      return;
    }
    jsonParser(req, res, next);
  });

  app.use(
    '/uploads',
    (req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (req.path.toLowerCase().endsWith('.svg')) {
        res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'");
      }
      next();
    },
    express.static(UPLOADS_DIR),
    (_req, res) => {
      res.status(404).json({ error: 'File tidak ditemukan.' });
    },
  );

  app.get('/api/media/:file', async (req, res) => {
    const ip = getClientIp(req);
    if (!checkBucketRateLimit(`media:${ip}`, 180, 60 * 1000)) {
      res.status(429).json({ error: 'Terlalu banyak permintaan media.' });
      return;
    }

    const rawFile = path.basename(req.params.file ?? '');
    const assetId = rawFile.split('.')[0];
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(assetId)) {
      res.status(400).json({ error: 'ID media tidak valid.' });
      return;
    }

    const sendMediaBuffer = (buffer: Buffer, mimeType: string) => {
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Accept-Ranges', 'bytes');
      if (mimeType === 'image/svg+xml') {
        res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'");
      }

      const rangeHeader = req.headers.range;
      if (rangeHeader && /^bytes=\d*-\d*$/.test(rangeHeader)) {
        const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
        const start = startStr ? parseInt(startStr, 10) : 0;
        const end = endStr ? Math.min(parseInt(endStr, 10), buffer.length - 1) : buffer.length - 1;
        if (start <= end && start < buffer.length) {
          const slice = buffer.subarray(start, end + 1);
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${buffer.length}`);
          res.setHeader('Content-Length', String(slice.length));
          res.send(slice);
          return;
        }
      }

      res.setHeader('Content-Length', String(buffer.length));
      res.send(buffer);
    };

    const cached = getCachedMedia(assetId);
    if (cached) {
      sendMediaBuffer(cached.buffer, cached.mimeType);
      return;
    }

    const baseDocUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/media_assets/${assetId}`;
    const apiKeyParam = `key=${encodeURIComponent(firebaseConfig.apiKey)}`;

    try {
      const metaRes = await fetch(`${baseDocUrl}?${apiKeyParam}`);
      if (metaRes.status === 404) {
        res.status(404).json({ error: 'Media tidak ditemukan.' });
        return;
      }
      if (metaRes.status === 429) {
        res.status(429).json({ error: 'Kuota baca harian cloud media sedang penuh.' });
        return;
      }
      if (!metaRes.ok) {
        res.status(502).json({ error: 'Gagal mengambil metadata media.' });
        return;
      }

      const metaJson = (await metaRes.json()) as {
        fields?: {
          mimeType?: { stringValue?: string };
          chunkCount?: { integerValue?: string };
          size?: { integerValue?: string };
        };
      };

      const mimeType = metaJson.fields?.mimeType?.stringValue || 'application/octet-stream';
      const chunkCount = Number(metaJson.fields?.chunkCount?.integerValue ?? '0');
      if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > 40) {
        res.status(404).json({ error: 'Data media tidak valid.' });
        return;
      }

      const chunkResponses = await Promise.all(
        Array.from({ length: chunkCount }, (_, i) =>
          fetch(`${baseDocUrl}/chunks/${i}?${apiKeyParam}`).then(async (r) => {
            if (!r.ok) return null;
            const json = (await r.json()) as { fields?: { data?: { stringValue?: string } } };
            return json.fields?.data?.stringValue ?? null;
          }),
        ),
      );

      if (chunkResponses.some((chunk) => !chunk)) {
        res.status(404).json({ error: 'Potongan media tidak lengkap.' });
        return;
      }

      const buffer = Buffer.concat(chunkResponses.map((b64) => Buffer.from(b64!, 'base64')));
      setCachedMedia(assetId, { buffer, mimeType, cachedAt: Date.now() });
      sendMediaBuffer(buffer, mimeType);
    } catch {
      res.status(500).json({ error: 'Gagal memuat media dari cloud storage.' });
    }
  });

  app.get('/api/site', (_req, res) => {
    const store = readStore();
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    res.json(store.site);
  });

  app.put('/api/site', requireFirebaseAdmin, (req: AdminRequest, res) => {
    const ip = getClientIp(req);
    if (!checkBucketRateLimit(`admin:${ip}`, 40, 5 * 60 * 1000)) {
      res.status(429).json({ error: 'Terlalu banyak permintaan admin.' });
      return;
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      res.status(400).json({ error: 'Format data situs tidak valid.' });
      return;
    }

    const store = readStore();
    const sanitized = sanitizeSiteConfig(req.body as Partial<SiteConfig>, store.site);
    store.site = sanitized;
    try {
      writeStore(store);
    } catch {
      // Read-only serverless environment still returns sanitized payload
    }
    res.json(store.site);
  });

  app.get('/api/github/status', requireFirebaseAdmin, (_req, res) => {
    const gh = getGitHubConfig();
    res.json({
      configured: Boolean(gh.token && gh.repo),
      repo: gh.repo,
      branch: gh.branch,
    });
  });

  app.post('/api/github/publish-media', requireFirebaseAdmin, async (req: AdminRequest, res) => {
    const ip = getClientIp(req);
    if (!checkBucketRateLimit(`admin:${ip}`, 40, 5 * 60 * 1000)) {
      res.status(429).json({ error: 'Terlalu banyak permintaan admin.' });
      return;
    }

    const gh = getGitHubConfig();
    if (!gh.token || !gh.repo) {
      res.status(400).json({
        error: 'GITHUB_TOKEN dan GITHUB_REPO belum disetel di environment server.',
      });
      return;
    }

    const filename = path.basename(String(req.body?.filename || '').trim());
    const contentBase64 = String(req.body?.contentBase64 || '').trim();
    if (
      !/^[a-zA-Z0-9_-]{1,128}\.(png|jpg|jpeg|webp|gif|avif|svg|bmp|ico|mp4|webm|mov|ogg|mkv)$/i.test(
        filename,
      )
    ) {
      res.status(400).json({ error: 'Nama file media untuk GitHub tidak valid.' });
      return;
    }
    if (!contentBase64 || contentBase64.length > 5_200_000 || !/^[A-Za-z0-9+/=]+$/.test(contentBase64)) {
      res.status(400).json({ error: 'Isi file media tidak valid atau terlalu besar.' });
      return;
    }

    if (filename.toLowerCase().endsWith('.svg')) {
      const svgText = Buffer.from(contentBase64, 'base64').toString('utf8');
      if (/<script\b/i.test(svgText) || /<foreignObject\b/i.test(svgText)) {
        res.status(400).json({ error: 'File SVG mengandung skrip berbahaya.' });
        return;
      }
    }

    try {
      await upsertGitHubFile({
        token: gh.token,
        repo: gh.repo,
        branch: gh.branch,
        repoPath: `public/media/${filename}`,
        contentBase64,
        message: `chore(media): simpan aset ${filename} oleh admin`,
      });
      res.json({
        ok: true,
        publicUrl: `/media/${filename}`,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Gagal mengunggah media ke GitHub.',
      });
    }
  });

  app.post('/api/github/publish', requireFirebaseAdmin, async (req: AdminRequest, res) => {
    const ip = getClientIp(req);
    if (!checkBucketRateLimit(`admin:${ip}`, 30, 5 * 60 * 1000)) {
      res.status(429).json({ error: 'Terlalu banyak permintaan admin.' });
      return;
    }

    const gh = getGitHubConfig();
    if (!gh.token || !gh.repo) {
      res.status(400).json({
        error:
          'GITHUB_TOKEN dan GITHUB_REPO belum disetel. Tambahkan keduanya di Vercel Environment Variables atau Secrets.',
      });
      return;
    }

    if (!req.body?.site || typeof req.body.site !== 'object' || Array.isArray(req.body.site)) {
      res.status(400).json({ error: 'Data situs tidak valid.' });
      return;
    }

    const store = readStore();
    const sanitized = sanitizeSiteConfig(req.body.site as Partial<SiteConfig>, store.site);
    const commitMessage =
      sanitizeText(req.body?.commitMessage, 140) ||
      `chore(data): perbarui data portofolio oleh ${req.adminUser?.email || 'admin'}`;

    try {
      const contentBase64 = Buffer.from(JSON.stringify(sanitized, null, 2) + '\n', 'utf8').toString(
        'base64',
      );
      const commitInfo = await upsertGitHubFile({
        token: gh.token,
        repo: gh.repo,
        branch: gh.branch,
        repoPath: 'src/data/site-snapshot.json',
        contentBase64,
        message: commitMessage,
      });

      store.site = sanitized;
      try {
        writeStore(store);
      } catch {
        // Read-only Vercel filesystem
      }

      res.json({
        ok: true,
        commitUrl: commitInfo.commitUrl,
        commitSha: commitInfo.commitSha,
        committedFiles: ['src/data/site-snapshot.json'],
        site: sanitized,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Gagal mengirim data ke GitHub.',
      });
    }
  });

  app.post('/api/contact', (req, res) => {
    const ip = getClientIp(req);
    if (!checkBucketRateLimit(`contact:${ip}`, 5, 15 * 60 * 1000)) {
      recordSuspiciousStrike(ip);
      res.status(429).json({ error: 'Terlalu banyak pesan dikirim. Coba 15 menit lagi.' });
      return;
    }

    // Honeypot check: real users never fill hidden field
    const honeypot = typeof req.body?.honeypot === 'string' ? req.body.honeypot.trim() : '';
    if (honeypot.length > 0) {
      recordSuspiciousStrike(ip);
      res.status(403).json({ error: 'Permintaan ditolak oleh pelindung anti-bot.' });
      return;
    }

    const dwellMs = Number(req.body?.dwellMs ?? 0);
    if (!Number.isFinite(dwellMs) || dwellMs < 2000) {
      res.status(400).json({ error: 'Mohon luangkan beberapa detik sebelum mengirim pesan.' });
      return;
    }

    const challengeA = Number(req.body?.challengeA ?? NaN);
    const challengeB = Number(req.body?.challengeB ?? NaN);
    const challengeAnswer = Number(String(req.body?.challengeAnswer ?? '').trim());
    if (
      !Number.isInteger(challengeA) ||
      !Number.isInteger(challengeB) ||
      challengeA < 1 ||
      challengeB < 1 ||
      challengeAnswer !== challengeA + challengeB
    ) {
      res.status(400).json({ error: 'Jawaban verifikasi manusia tidak tepat.' });
      return;
    }

    const name = sanitizeText(req.body?.name, 80);
    const email = sanitizeText(req.body?.email, 120);
    const subject = sanitizeText(req.body?.subject, 120) || 'Pesan Portofolio';
    const message = sanitizeText(req.body?.message, 2500);

    if (!name || !email || !message || message.length < 3) {
      res.status(400).json({ error: 'Nama, email, dan isi pesan wajib diisi.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Format email tidak valid.' });
      return;
    }
    if ((message.match(/https?:\/\//gi) || []).length > 2) {
      res.status(400).json({ error: 'Pesan mengandung terlalu banyak tautan.' });
      return;
    }

    const entry: ContactMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      name,
      email,
      subject,
      message,
      createdAt: new Date().toISOString(),
    };

    try {
      const messages = readMessages();
      messages.unshift(entry);
      writeMessages(messages.slice(0, 200));
    } catch {
      // Serverless /tmp optional persistence
    }
    res.status(201).json({ ok: true, id: entry.id });
  });

  app.get('/api/admin/messages', requireFirebaseAdmin, (_req, res) => {
    res.json(readMessages());
  });

  app.delete('/api/admin/messages/:id', requireFirebaseAdmin, (req, res) => {
    const id = sanitizeText(req.params.id, 60);
    const messages = readMessages();
    const next = messages.filter((m) => m.id !== id);
    writeMessages(next);
    res.json({ ok: true });
  });

  app.post('/api/upload', requireFirebaseAdmin, (req, res) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: 'Gagal mengunggah file.' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'Pilih file foto atau video terlebih dahulu.' });
        return;
      }
      const ext = path.extname(req.file.filename).toLowerCase();
      if (ext === '.svg' && !sanitizeUploadedSvg(req.file.path)) {
        res.status(400).json({ error: 'File SVG mengandung skrip yang tidak diperbolehkan.' });
        return;
      }
      const mediaType: MediaType = VIDEO_EXTENSIONS.has(ext) ? 'video' : 'image';
      res.status(201).json({
        filename: req.file.filename,
        url: `/uploads/${req.file.filename}`,
        mediaType,
        size: req.file.size,
        originalName: req.file.originalname,
      });
    });
  });

  app.get('/api/uploads', requireFirebaseAdmin, (_req, res) => {
    ensureDirectories();
    const files = fs.readdirSync(UPLOADS_DIR);
    const assets: UploadedAsset[] = files
      .map((filename) => {
        const fullPath = path.resolve(UPLOADS_DIR, filename);
        if (!fullPath.startsWith(UPLOADS_DIR + path.sep)) return null;
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) return null;
        const ext = path.extname(filename).toLowerCase();
        const mediaType: MediaType = VIDEO_EXTENSIONS.has(ext) ? 'video' : 'image';
        return {
          filename,
          url: `/uploads/${filename}`,
          mediaType,
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
        };
      })
      .filter((item): item is UploadedAsset => item !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json(assets);
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err && typeof err === 'object') {
      const errObj = err as { type?: string; status?: number };
      if (errObj.type === 'entity.too.large' || errObj.status === 413) {
        res.status(413).json({ error: 'Ukuran data terlalu besar. Kurangi teks atau media lalu coba lagi.' });
        return;
      }
      if (errObj.type === 'entity.parse.failed' || (err instanceof SyntaxError && errObj.status === 400)) {
        res.status(400).json({ error: 'Format JSON tidak valid.' });
        return;
      }
    }
    res.status(500).json({ error: 'Terjadi kesalahan internal pada server.' });
  });

  return app;
}
