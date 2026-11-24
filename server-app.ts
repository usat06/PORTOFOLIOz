import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { DEFAULT_SITE_CONFIG } from './src/data/defaultSite.ts';
import type {
  BrandLogoConfig,
  CertificateItem,
  ContactMessage,
  CustomPage,
  ExtraBlockPlacement,
  ExtraTextBlock,
  HeroExtraText,
  MediaType,
  NavLabels,
  PortfolioWork,
  ProfileFact,
  ProgramItem,
  ProjectItem,
  SectionVisibility,
  SiteConfig,
  SkillGroup,
  SocialLink,
  StatMetric,
  UiLabels,
  UploadedAsset,
} from './src/types/site.ts';

interface AdminAuthRecord {
  salt: string;
  hash: string;
  updatedAt: string;
}

interface PersistedStore {
  site: SiteConfig;
  adminAuth: AdminAuthRecord | null;
}

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL
  ? path.resolve('/tmp', 'usat-jalung-data')
  : path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'site-store.json');
const MESSAGES_PATH = path.resolve(DATA_DIR, 'messages.json');
const SESSION_SECRET_PATH = path.resolve(DATA_DIR, '.session-secret');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');

function loadOrCreateSessionSecret(): string {
  const envSecret = (process.env.SESSION_SECRET ?? '').trim();
  if (envSecret) return envSecret;

  const envPasscode = (process.env.ADMIN_PASSCODE ?? '').trim();
  if (IS_VERCEL && envPasscode) {
    return crypto
      .createHmac('sha256', envPasscode)
      .update('usat-jalung-vercel-session')
      .digest('hex');
  }

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(SESSION_SECRET_PATH)) {
      const existing = fs.readFileSync(SESSION_SECRET_PATH, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
  } catch {
    // Regenerate below if unreadable
  }

  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(SESSION_SECRET_PATH, generated, { encoding: 'utf8', mode: 0o600 });
  } catch {
    // Non-fatal in read-only filesystems
  }
  return generated;
}

const SESSION_SECRET = loadOrCreateSessionSecret();
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

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
const VALID_PLACEMENTS = new Set<ExtraBlockPlacement>([
  'after-hero',
  'after-about',
  'after-skills',
  'after-projects',
  'after-certificates',
  'after-gallery',
]);

function ensureDirectories(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function readStore(): PersistedStore {
  ensureDirectories();
  if (!fs.existsSync(STORE_PATH)) {
    const initial: PersistedStore = {
      site: structuredClone(DEFAULT_SITE_CONFIG),
      adminAuth: null,
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }

  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedStore>;
    const existingSite = parsed.site;

    if (!existingSite || (existingSite.schemaVersion ?? 1) < 2) {
      const upgraded: PersistedStore = {
        site: structuredClone(DEFAULT_SITE_CONFIG),
        adminAuth: parsed.adminAuth ?? null,
      };
      writeStore(upgraded);
      return upgraded;
    }

    const needsVisualUpgrade = (existingSite.schemaVersion ?? 1) < 3;

    const isMissingUploadUrl = (url: unknown): boolean =>
      typeof url === 'string' &&
      url.startsWith('/uploads/') &&
      !fs.existsSync(path.resolve(UPLOADS_DIR, path.basename(url)));

    const isMissingUploadedHero = isMissingUploadUrl(existingSite.hero?.imageUrl);
    const isMissingUploadedPortrait = isMissingUploadUrl(existingSite.hero?.portraitUrl);
    const isMissingUploadedLogo = isMissingUploadUrl(existingSite.logo?.imageUrl);
    const isMissingUploadedAbout = isMissingUploadUrl(existingSite.about?.showcaseImageUrl);
    const repairedMissingMedia =
      isMissingUploadedHero ||
      isMissingUploadedPortrait ||
      isMissingUploadedLogo ||
      isMissingUploadedAbout;

    const mergedSite: SiteConfig = {
      ...structuredClone(DEFAULT_SITE_CONFIG),
      ...existingSite,
      schemaVersion: 3,
      logo: {
        ...DEFAULT_SITE_CONFIG.logo,
        ...(existingSite.logo ?? {}),
        ...(isMissingUploadedLogo ? { imageUrl: '' } : {}),
      },
      sections: { ...DEFAULT_SITE_CONFIG.sections, ...(existingSite.sections ?? {}) },
      navLabels: { ...DEFAULT_SITE_CONFIG.navLabels, ...(existingSite.navLabels ?? {}) },
      uiLabels: { ...DEFAULT_SITE_CONFIG.uiLabels, ...(existingSite.uiLabels ?? {}) },
      colors: needsVisualUpgrade
        ? structuredClone(DEFAULT_SITE_CONFIG.colors)
        : { ...DEFAULT_SITE_CONFIG.colors, ...(existingSite.colors ?? {}) },
      typography: needsVisualUpgrade
        ? structuredClone(DEFAULT_SITE_CONFIG.typography)
        : { ...DEFAULT_SITE_CONFIG.typography, ...(existingSite.typography ?? {}) },
      design: needsVisualUpgrade
        ? structuredClone(DEFAULT_SITE_CONFIG.design)
        : { ...DEFAULT_SITE_CONFIG.design, ...(existingSite.design ?? {}) },
      hero: {
        ...DEFAULT_SITE_CONFIG.hero,
        ...(existingSite.hero ?? {}),
        ...(isMissingUploadedHero ? { imageUrl: DEFAULT_SITE_CONFIG.hero.imageUrl } : {}),
        ...(isMissingUploadedPortrait ? { portraitUrl: DEFAULT_SITE_CONFIG.hero.portraitUrl } : {}),
        ...(needsVisualUpgrade
          ? {
              headlineLine1: DEFAULT_SITE_CONFIG.hero.headlineLine1,
              headlineLine2: DEFAULT_SITE_CONFIG.hero.headlineLine2,
              roleLine1: DEFAULT_SITE_CONFIG.hero.roleLine1,
              roleLine2: DEFAULT_SITE_CONFIG.hero.roleLine2,
              greetingLeft: DEFAULT_SITE_CONFIG.hero.greetingLeft,
              greetingRight: DEFAULT_SITE_CONFIG.hero.greetingRight,
              backdropMode: DEFAULT_SITE_CONFIG.hero.backdropMode,
            }
          : {}),
        extraTexts: Array.isArray(existingSite.hero?.extraTexts)
          ? existingSite.hero.extraTexts
          : structuredClone(DEFAULT_SITE_CONFIG.hero.extraTexts),
      },
      about: {
        ...DEFAULT_SITE_CONFIG.about,
        ...(existingSite.about ?? {}),
        ...(isMissingUploadedAbout ? { showcaseImageUrl: '' } : {}),
        facts: Array.isArray(existingSite.about?.facts)
          ? existingSite.about.facts
          : structuredClone(DEFAULT_SITE_CONFIG.about.facts),
        stats: Array.isArray(existingSite.about?.stats)
          ? existingSite.about.stats
          : structuredClone(DEFAULT_SITE_CONFIG.about.stats),
        codeLines: Array.isArray(existingSite.about?.codeLines)
          ? existingSite.about.codeLines
          : structuredClone(DEFAULT_SITE_CONFIG.about.codeLines),
      },
      contact: {
        ...DEFAULT_SITE_CONFIG.contact,
        ...(existingSite.contact ?? {}),
        socials: Array.isArray(existingSite.contact?.socials)
          ? existingSite.contact.socials
          : structuredClone(DEFAULT_SITE_CONFIG.contact.socials),
      },
      skills: Array.isArray(existingSite.skills)
        ? existingSite.skills
        : structuredClone(DEFAULT_SITE_CONFIG.skills),
      programs: Array.isArray(existingSite.programs)
        ? existingSite.programs
        : structuredClone(DEFAULT_SITE_CONFIG.programs),
      projects: Array.isArray(existingSite.projects)
        ? existingSite.projects
        : structuredClone(DEFAULT_SITE_CONFIG.projects),
      certificates: Array.isArray(existingSite.certificates)
        ? existingSite.certificates
        : structuredClone(DEFAULT_SITE_CONFIG.certificates),
      works: Array.isArray(existingSite.works)
        ? existingSite.works
        : structuredClone(DEFAULT_SITE_CONFIG.works),
      extraBlocks: Array.isArray(existingSite.extraBlocks) ? existingSite.extraBlocks : [],
      pages: Array.isArray(existingSite.pages) ? existingSite.pages : [],
    };
    const nextStore: PersistedStore = {
      site: mergedSite,
      adminAuth: parsed.adminAuth ?? null,
    };
    if (needsVisualUpgrade || repairedMissingMedia) {
      writeStore(nextStore);
    }
    return nextStore;
  } catch {
    return {
      site: structuredClone(DEFAULT_SITE_CONFIG),
      adminAuth: null,
    };
  }
}

function writeStore(store: PersistedStore): void {
  ensureDirectories();
  const tempPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tempPath, STORE_PATH);
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

function getEnvPasscode(): string {
  return (process.env.ADMIN_PASSCODE ?? '').trim();
}

function hashPassword(password: string, salt?: string): AdminAuthRecord {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return {
    salt: actualSalt,
    hash: derived,
    updatedAt: new Date().toISOString(),
  };
}

function verifyPasswordHash(password: string, record: AdminAuthRecord): boolean {
  if (!record || typeof record.salt !== 'string' || typeof record.hash !== 'string') {
    return false;
  }
  try {
    const derived = crypto.scryptSync(password, record.salt, 64);
    const expected = Buffer.from(record.hash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function verifyEnvPasscode(input: string, expected: string): boolean {
  const inputDigest = crypto.createHash('sha256').update(input).digest();
  const expectedDigest = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(inputDigest, expectedDigest);
}

function issueToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({
      role: 'admin',
      exp: expiresAt,
      nonce: crypto.randomBytes(8).toString('hex'),
    }),
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return {
    token: `${payload}.${signature}`,
    expiresAt,
  };
}

function verifyToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!payload || !signature) return false;

  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function isSafeUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return !trimmed.startsWith('//');
  if (trimmed.startsWith('#')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isSafeHexColor(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeText(value: unknown, maxLength: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

function sanitizeSlug(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function sanitizeSitePayload(payload: SiteConfig, existing: SiteConfig): SiteConfig {
  const colors = {
    paper: isSafeHexColor(payload.colors?.paper) ? payload.colors.paper : existing.colors.paper,
    paperAlt: isSafeHexColor(payload.colors?.paperAlt) ? payload.colors.paperAlt : existing.colors.paperAlt,
    ink: isSafeHexColor(payload.colors?.ink) ? payload.colors.ink : existing.colors.ink,
    muted: isSafeHexColor(payload.colors?.muted) ? payload.colors.muted : existing.colors.muted,
    line: isSafeHexColor(payload.colors?.line) ? payload.colors.line : existing.colors.line,
    accent: isSafeHexColor(payload.colors?.accent) ? payload.colors.accent : existing.colors.accent,
  };

  const facts: ProfileFact[] = Array.isArray(payload.about?.facts)
    ? payload.about.facts
        .filter((f) => f && typeof f.label === 'string')
        .slice(0, 8)
        .map((f) => ({
          label: sanitizeText(f.label, 50, 'Info'),
          value: sanitizeText(f.value, 120, '-'),
        }))
    : existing.about.facts;

  const stats: StatMetric[] = Array.isArray(payload.about?.stats)
    ? payload.about.stats
        .filter((s) => s && typeof s.value === 'string')
        .slice(0, 6)
        .map((s) => ({
          value: sanitizeText(s.value, 24, '10+'),
          label: sanitizeText(s.label, 80, 'Metrik'),
        }))
    : existing.about.stats;

  const skills: SkillGroup[] = Array.isArray(payload.skills)
    ? payload.skills
        .filter((s) => s && typeof s.title === 'string')
        .slice(0, 12)
        .map((s, idx) => ({
          id: sanitizeSlug(s.id) || `skill-${idx + 1}`,
          title: sanitizeText(s.title, 100, 'Keahlian'),
          summary: sanitizeText(s.summary, 300),
          items: Array.isArray(s.items)
            ? s.items.map((item) => sanitizeText(item, 80)).filter(Boolean).slice(0, 10)
            : [],
        }))
    : existing.skills;

  const programs: ProgramItem[] = Array.isArray(payload.programs)
    ? payload.programs
        .filter((p) => p && typeof p.name === 'string')
        .slice(0, 40)
        .map((p, idx) => ({
          id: sanitizeSlug(p.id) || `prog-${idx + 1}`,
          name: sanitizeText(p.name, 80, 'Program'),
          category: sanitizeText(p.category, 60, 'Teknologi'),
          level: sanitizeText(p.level, 40, 'Mahir'),
        }))
    : existing.programs;

  const projects: ProjectItem[] = Array.isArray(payload.projects)
    ? payload.projects
        .filter((p) => p && typeof p.title === 'string')
        .slice(0, 30)
        .map((p, idx) => ({
          id: sanitizeSlug(p.id) || `proj-${idx + 1}`,
          title: sanitizeText(p.title, 120, 'Proyek'),
          role: sanitizeText(p.role, 80, 'Developer'),
          year: sanitizeText(p.year, 20, '2025'),
          summary: sanitizeText(p.summary, 600),
          techStack: Array.isArray(p.techStack)
            ? p.techStack.map((t) => sanitizeText(t, 40)).filter(Boolean).slice(0, 12)
            : [],
          imageUrl: isSafeUrl(p.imageUrl ?? '') ? p.imageUrl.trim() : '',
          mediaType: p.mediaType === 'video' ? 'video' : 'image',
          linkUrl: isSafeUrl(p.linkUrl ?? '') ? p.linkUrl.trim() : '',
        }))
    : existing.projects;

  const certificates: CertificateItem[] = Array.isArray(payload.certificates)
    ? payload.certificates
        .filter((c) => c && typeof c.title === 'string')
        .slice(0, 40)
        .map((c, idx) => ({
          id: sanitizeSlug(c.id) || `cert-${idx + 1}`,
          title: sanitizeText(c.title, 140, 'Sertifikat'),
          issuer: sanitizeText(c.issuer, 120, 'Lembaga'),
          year: sanitizeText(c.year, 20, '2025'),
          credentialId: sanitizeText(c.credentialId, 80),
          imageUrl: isSafeUrl(c.imageUrl ?? '') ? c.imageUrl.trim() : '',
          verifyUrl: isSafeUrl(c.verifyUrl ?? '') ? c.verifyUrl.trim() : '',
        }))
    : existing.certificates;

  const works: PortfolioWork[] = Array.isArray(payload.works)
    ? payload.works
        .filter((item) => item && typeof item.title === 'string' && isSafeUrl(item.imageUrl ?? ''))
        .slice(0, 60)
        .map((item, idx) => {
          const categoryLabel = sanitizeText(item.categoryLabel, 40, 'Lainnya') || 'Lainnya';
          const category = sanitizeSlug(item.category || categoryLabel) || 'lainnya';
          const mediaType: MediaType = item.mediaType === 'video' ? 'video' : 'image';
          return {
            id: sanitizeSlug(item.id) || `karya-${idx + 1}`,
            title: sanitizeText(item.title, 120, 'Tanpa Judul'),
            category,
            categoryLabel,
            imageUrl: item.imageUrl.trim(),
            mediaType,
            alt: sanitizeText(item.alt, 240, sanitizeText(item.title, 120)),
            aspectClass: sanitizeText(item.aspectClass, 80, 'aspect-[1.08] sm:aspect-[1.05]'),
          };
        })
    : existing.works;

  const extraBlocks: ExtraTextBlock[] = Array.isArray(payload.extraBlocks)
    ? payload.extraBlocks
        .filter((b) => b && typeof b.title === 'string')
        .slice(0, 15)
        .map((b, idx) => ({
          id: sanitizeSlug(b.id) || `block-${idx + 1}`,
          eyebrow: sanitizeText(b.eyebrow, 80),
          title: sanitizeText(b.title, 140, 'Catatan'),
          body: sanitizeText(b.body, 5000),
          placement: VALID_PLACEMENTS.has(b.placement) ? b.placement : 'after-about',
          visible: Boolean(b.visible),
        }))
    : existing.extraBlocks;

  const socials: SocialLink[] = Array.isArray(payload.contact?.socials)
    ? payload.contact.socials
        .filter((s) => s && typeof s.label === 'string' && isSafeUrl(s.url ?? ''))
        .slice(0, 8)
        .map((s) => ({
          label: sanitizeText(s.label, 40),
          url: s.url.trim(),
        }))
    : existing.contact.socials;

  const pages: CustomPage[] = Array.isArray(payload.pages)
    ? payload.pages
        .filter((page) => page && typeof page.title === 'string')
        .slice(0, 20)
        .map((page, idx) => {
          const title = sanitizeText(page.title, 120, 'Halaman Baru');
          const slug = sanitizeSlug(page.slug || title) || `halaman-${idx + 1}`;
          const coverUrl = isSafeUrl(page.coverUrl ?? '') ? page.coverUrl.trim() : '';
          return {
            id: sanitizeSlug(page.id) || `page-${idx + 1}`,
            slug,
            navLabel: sanitizeText(page.navLabel, 32, title),
            title,
            eyebrow: sanitizeText(page.eyebrow, 80),
            lead: sanitizeText(page.lead, 400),
            coverUrl,
            coverMediaType: page.coverMediaType === 'video' ? 'video' : 'image',
            content: sanitizeText(page.content, 12000),
            published: Boolean(page.published),
            mediaIds: Array.isArray(page.mediaIds)
              ? page.mediaIds.filter((id): id is string => typeof id === 'string').slice(0, 30)
              : [],
          };
        })
    : existing.pages;

  const logo: BrandLogoConfig = {
    mode:
      payload.logo?.mode === 'image' ||
      payload.logo?.mode === 'image-only' ||
      payload.logo?.mode === 'text-only'
        ? payload.logo.mode
        : 'monogram',
    imageUrl: isSafeUrl(payload.logo?.imageUrl ?? '') ? payload.logo.imageUrl.trim() : '',
    monogramText: sanitizeText(payload.logo?.monogramText, 4, existing.logo?.monogramText || 'UJ') || 'UJ',
    shape:
      payload.logo?.shape === 'circle' || payload.logo?.shape === 'square'
        ? payload.logo.shape
        : 'rounded',
    fit: payload.logo?.fit === 'contain' ? 'contain' : 'cover',
    heightPx: Math.min(64, Math.max(24, Number(payload.logo?.heightPx) || existing.logo?.heightPx || 34)),
  };

  const sections: SectionVisibility = {
    about: payload.sections?.about !== false,
    skills: payload.sections?.skills !== false,
    projects: payload.sections?.projects !== false,
    certificates: payload.sections?.certificates !== false,
    gallery: payload.sections?.gallery !== false,
    contact: payload.sections?.contact !== false,
  };

  const navLabels: NavLabels = {
    about: sanitizeText(payload.navLabels?.about, 30, existing.navLabels.about) || existing.navLabels.about,
    skills: sanitizeText(payload.navLabels?.skills, 30, existing.navLabels.skills) || existing.navLabels.skills,
    projects:
      sanitizeText(payload.navLabels?.projects, 30, existing.navLabels.projects) || existing.navLabels.projects,
    certificates:
      sanitizeText(payload.navLabels?.certificates, 30, existing.navLabels.certificates) ||
      existing.navLabels.certificates,
    gallery:
      sanitizeText(payload.navLabels?.gallery, 30, existing.navLabels.gallery) || existing.navLabels.gallery,
    contact:
      sanitizeText(payload.navLabels?.contact, 30, existing.navLabels.contact) || existing.navLabels.contact,
    headerCta:
      sanitizeText(payload.navLabels?.headerCta, 30, existing.navLabels.headerCta) ||
      existing.navLabels.headerCta,
    showHeaderCta: payload.navLabels?.showHeaderCta !== false,
  };

  const uiLabels: UiLabels = {
    skillsCountSuffix: sanitizeText(payload.uiLabels?.skillsCountSuffix, 60, existing.uiLabels.skillsCountSuffix),
    projectsViewLabel: sanitizeText(payload.uiLabels?.projectsViewLabel, 40, existing.uiLabels.projectsViewLabel),
    projectsEmptyText: sanitizeText(payload.uiLabels?.projectsEmptyText, 120, existing.uiLabels.projectsEmptyText),
    certificatesVerifyLabel: sanitizeText(
      payload.uiLabels?.certificatesVerifyLabel,
      40,
      existing.uiLabels.certificatesVerifyLabel,
    ),
    certificatesIdPrefix: sanitizeText(
      payload.uiLabels?.certificatesIdPrefix,
      20,
      existing.uiLabels.certificatesIdPrefix,
    ),
    certificatesEmptyText: sanitizeText(
      payload.uiLabels?.certificatesEmptyText,
      120,
      existing.uiLabels.certificatesEmptyText,
    ),
    workAllFilterLabel: sanitizeText(payload.uiLabels?.workAllFilterLabel, 30, existing.uiLabels.workAllFilterLabel),
    workEmptyText: sanitizeText(payload.uiLabels?.workEmptyText, 120, existing.uiLabels.workEmptyText),
    contactCopyLabel: sanitizeText(payload.uiLabels?.contactCopyLabel, 40, existing.uiLabels.contactCopyLabel),
    contactCopiedLabel: sanitizeText(payload.uiLabels?.contactCopiedLabel, 40, existing.uiLabels.contactCopiedLabel),
    contactFormToggleLabel: sanitizeText(
      payload.uiLabels?.contactFormToggleLabel,
      50,
      existing.uiLabels.contactFormToggleLabel,
    ),
    contactFormHeading: sanitizeText(
      payload.uiLabels?.contactFormHeading,
      80,
      existing.uiLabels.contactFormHeading,
    ),
    contactFormSubheading: sanitizeText(
      payload.uiLabels?.contactFormSubheading,
      160,
      existing.uiLabels.contactFormSubheading,
    ),
    contactFormSubmitLabel: sanitizeText(
      payload.uiLabels?.contactFormSubmitLabel,
      40,
      existing.uiLabels.contactFormSubmitLabel,
    ),
    footerBackToTopLabel: sanitizeText(
      payload.uiLabels?.footerBackToTopLabel,
      50,
      existing.uiLabels.footerBackToTopLabel,
    ),
    pageBackLabel: sanitizeText(payload.uiLabels?.pageBackLabel, 50, existing.uiLabels.pageBackLabel),
    pageRelatedGalleryLabel: sanitizeText(
      payload.uiLabels?.pageRelatedGalleryLabel,
      60,
      existing.uiLabels.pageRelatedGalleryLabel,
    ),
  };

  return {
    schemaVersion: 3,
    brandName: sanitizeText(payload.brandName, 40, existing.brandName) || existing.brandName,
    brandDot: sanitizeText(payload.brandDot, 4, existing.brandDot),
    brandSuffix: sanitizeText(payload.brandSuffix, 40),
    brandTagline: sanitizeText(payload.brandTagline, 60),
    logo,
    sections,
    navLabels,
    uiLabels,
    colors,
    typography: {
      displayFont: sanitizeText(payload.typography?.displayFont, 60, existing.typography.displayFont),
      bodyFont: sanitizeText(payload.typography?.bodyFont, 60, existing.typography.bodyFont),
      accentFont: sanitizeText(payload.typography?.accentFont, 60, existing.typography.accentFont),
      headingScale:
        payload.typography?.headingScale === 'compact' ||
        payload.typography?.headingScale === 'dramatic'
          ? payload.typography.headingScale
          : 'normal',
    },
    design: {
      heroLayout:
        payload.design?.heroLayout === 'split' ||
        payload.design?.heroLayout === 'minimal' ||
        payload.design?.heroLayout === 'fullbleed'
          ? payload.design.heroLayout
          : 'showcase',
      galleryLayout:
        payload.design?.galleryLayout === 'uniform-2' || payload.design?.galleryLayout === 'uniform-3'
          ? payload.design.galleryLayout
          : 'editorial',
      cardRadius:
        payload.design?.cardRadius === 'soft' || payload.design?.cardRadius === 'editorial'
          ? payload.design.cardRadius
          : 'sharp',
      showPortrait: Boolean(payload.design?.showPortrait ?? existing.design.showPortrait),
    },
    hero: {
      imageUrl:
        typeof payload.hero?.imageUrl === 'string' && payload.hero.imageUrl.trim() === ''
          ? ''
          : isSafeUrl(payload.hero?.imageUrl)
            ? payload.hero.imageUrl.trim()
            : existing.hero.imageUrl,
      mediaType: payload.hero?.mediaType === 'video' ? 'video' : 'image',
      alt: sanitizeText(payload.hero?.alt, 240, existing.hero.alt),
      portraitUrl:
        typeof payload.hero?.portraitUrl === 'string' && payload.hero.portraitUrl.trim() === ''
          ? ''
          : isSafeUrl(payload.hero?.portraitUrl)
            ? payload.hero.portraitUrl.trim()
            : existing.hero.portraitUrl,
      portraitAlt: sanitizeText(payload.hero?.portraitAlt, 160, existing.hero.portraitAlt),
      backdropMode:
        payload.hero?.backdropMode === 'photo-cover' ||
        payload.hero?.backdropMode === 'solid-gradient'
          ? payload.hero.backdropMode
          : 'studio-glow',
      backdropOpacity: clampNumber(payload.hero?.backdropOpacity, 5, 100, 82),
      backgroundColor:
        typeof payload.hero?.backgroundColor === 'string' && isSafeHexColor(payload.hero.backgroundColor)
          ? payload.hero.backgroundColor.trim()
          : '',
      backgroundGradientColor:
        typeof payload.hero?.backgroundGradientColor === 'string' &&
        isSafeHexColor(payload.hero.backgroundGradientColor)
          ? payload.hero.backgroundGradientColor.trim()
          : '',
      glowColor:
        typeof payload.hero?.glowColor === 'string' && isSafeHexColor(payload.hero.glowColor)
          ? payload.hero.glowColor.trim()
          : '',
      glowIntensity: clampNumber(payload.hero?.glowIntensity, 0, 100, 32),
      showGrid: payload.hero?.showGrid !== false,
      gridOpacity: clampNumber(payload.hero?.gridOpacity, 0, 100, 42),
      overlayOpacity: clampNumber(payload.hero?.overlayOpacity, 0, 95, 48),
      greetingLeft: sanitizeText(payload.hero?.greetingLeft, 60),
      greetingRight: sanitizeText(payload.hero?.greetingRight, 60),
      statusBadge: sanitizeText(payload.hero?.statusBadge, 80),
      showStatusBadge: payload.hero?.showStatusBadge !== false,
      eyebrow: sanitizeText(payload.hero?.eyebrow, 80),
      headlineLine1: sanitizeText(payload.hero?.headlineLine1, 80),
      headlineLine2: sanitizeText(payload.hero?.headlineLine2, 80),
      roleLine1: sanitizeText(payload.hero?.roleLine1, 60),
      roleLine2: sanitizeText(payload.hero?.roleLine2, 60),
      description: sanitizeText(payload.hero?.description, 320),
      ctaLabel: sanitizeText(payload.hero?.ctaLabel, 60),
      secondaryCtaLabel: sanitizeText(payload.hero?.secondaryCtaLabel, 60),
      indexLabel: sanitizeText(payload.hero?.indexLabel, 30),
      sideLabel: sanitizeText(payload.hero?.sideLabel, 80),
      textContrast:
        payload.hero?.textContrast === 'light-scrim' ||
        payload.hero?.textContrast === 'card' ||
        payload.hero?.textContrast === 'none'
          ? payload.hero.textContrast
          : 'dark-scrim',
      extraTexts: Array.isArray(payload.hero?.extraTexts)
        ? payload.hero.extraTexts
            .filter((item) => item && typeof item.text === 'string')
            .slice(0, 8)
            .map((item, idx): HeroExtraText => ({
              id: sanitizeSlug(item.id) || `hero-extra-${idx + 1}`,
              text: sanitizeText(item.text, 240),
              variant:
                item.variant === 'heading' || item.variant === 'body' ? item.variant : 'tag',
            }))
        : existing.hero.extraTexts ?? [],
    },
    about: {
      eyebrow: sanitizeText(payload.about?.eyebrow, 80),
      title: sanitizeText(payload.about?.title, 120),
      statement: sanitizeText(payload.about?.statement, 360),
      description: sanitizeText(payload.about?.description, 2000),
      facts,
      stats,
      codeTitle: sanitizeText(payload.about?.codeTitle, 80, existing.about.codeTitle),
      codeLines: Array.isArray(payload.about?.codeLines)
        ? payload.about.codeLines
            .filter((l): l is string => typeof l === 'string')
            .slice(0, 16)
            .map((l) => l.slice(0, 120))
        : existing.about.codeLines,
      showcaseImageUrl: isSafeUrl(payload.about?.showcaseImageUrl ?? '')
        ? payload.about.showcaseImageUrl.trim()
        : '',
    },
    skillsEyebrow: sanitizeText(payload.skillsEyebrow, 80, existing.skillsEyebrow),
    skillsTitle: sanitizeText(payload.skillsTitle, 80, existing.skillsTitle),
    skillsNote: sanitizeText(payload.skillsNote, 240, existing.skillsNote),
    skills,
    programsTitle: sanitizeText(payload.programsTitle, 100, existing.programsTitle),
    programs,
    projectsEyebrow: sanitizeText(payload.projectsEyebrow, 80, existing.projectsEyebrow),
    projectsTitle: sanitizeText(payload.projectsTitle, 100, existing.projectsTitle),
    projectsNote: sanitizeText(payload.projectsNote, 240, existing.projectsNote),
    projects,
    certificatesEyebrow: sanitizeText(payload.certificatesEyebrow, 80, existing.certificatesEyebrow),
    certificatesTitle: sanitizeText(payload.certificatesTitle, 100, existing.certificatesTitle),
    certificatesNote: sanitizeText(payload.certificatesNote, 240, existing.certificatesNote),
    certificates,
    workEyebrow: sanitizeText(payload.workEyebrow, 80, existing.workEyebrow),
    workTitle: sanitizeText(payload.workTitle, 80, existing.workTitle),
    workNote: sanitizeText(payload.workNote, 240, existing.workNote),
    works,
    extraBlocks,
    contact: {
      eyebrow: sanitizeText(payload.contact?.eyebrow, 80, existing.contact.eyebrow),
      title: sanitizeText(payload.contact?.title, 140, existing.contact.title),
      description: sanitizeText(payload.contact?.description, 300, existing.contact.description),
      email: sanitizeText(payload.contact?.email, 120, existing.contact.email),
      location: sanitizeText(payload.contact?.location, 80, existing.contact.location),
      socials,
    },
    footerCopyright: sanitizeText(payload.footerCopyright, 160, existing.footerCopyright),
    pages,
  };
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count += 1;
  return true;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sesi admin tidak ditemukan. Silakan masuk terlebih dahulu.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  if (!verifyToken(token)) {
    res.status(401).json({ error: 'Sesi admin tidak valid atau sudah kedaluwarsa.' });
    return;
  }
  next();
}

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
    fileSize: 100 * 1024 * 1024,
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
    const isImage =
      IMAGE_EXTENSIONS.has(ext) && (genericMime || mime.startsWith('image/'));
    const isVideo =
      VIDEO_EXTENSIONS.has(ext) && (genericMime || mime.startsWith('video/'));
    if (isImage || isVideo) {
      cb(null, true);
      return;
    }
    cb(
      new Error(
        'Format file tidak didukung. Gunakan foto (PNG, JPG, WebP, GIF, AVIF, SVG, BMP, ICO, HEIC) atau video (MP4, WebM, MOV, MKV, M4V, OGG, 3GP, AVI).',
      ),
    );
  },
});

function formatUploadError(err: unknown): string {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return 'Ukuran file terlalu besar. Maksimal 100 MB per file.';
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return 'Maksimal 20 file sekaligus dalam sekali unggah.';
    }
    return 'Gagal memproses file yang diunggah.';
  }
  return err instanceof Error ? err.message : 'Gagal mengunggah file.';
}

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
  app.set('trust proxy', 1);
  const jsonParser = express.json({ limit: '4mb' });
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

  app.get('/api/site', (_req, res) => {
    const store = readStore();
    res.json(store.site);
  });

  app.get('/api/admin/auth-status', (_req, res) => {
    const store = readStore();
    const hasEnvPasscode = getEnvPasscode().length > 0;
    const needsSetup = !hasEnvPasscode && !store.adminAuth;
    res.json({
      needsSetup,
      hasEnvPasscode,
      isVercel: IS_VERCEL,
    });
  });

  app.post('/api/admin/setup', (req, res) => {
    const ip = req.ip ?? 'unknown';
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      return;
    }

    const store = readStore();
    if (getEnvPasscode().length > 0 || store.adminAuth) {
      res.status(403).json({ error: 'Kata sandi admin sudah dikonfigurasi.' });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
      return;
    }

    store.adminAuth = hashPassword(password);
    writeStore(store);
    const session = issueToken();
    res.status(201).json(session);
  });

  app.post('/api/admin/login', (req, res) => {
    const ip = req.ip ?? 'unknown';
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password) {
      res.status(400).json({ error: 'Masukkan kata sandi admin.' });
      return;
    }

    const envPasscode = getEnvPasscode();
    const store = readStore();

    if (envPasscode.length > 0) {
      if (!verifyEnvPasscode(password, envPasscode)) {
        res.status(401).json({ error: 'Kata sandi salah.' });
        return;
      }
      res.json(issueToken());
      return;
    }

    if (!store.adminAuth) {
      res.status(409).json({ error: 'Akun admin belum dibuat. Silakan buat kata sandi terlebih dahulu.' });
      return;
    }

    if (!verifyPasswordHash(password, store.adminAuth)) {
      res.status(401).json({ error: 'Kata sandi salah.' });
      return;
    }

    res.json(issueToken());
  });

  app.get('/api/admin/verify', requireAdmin, (_req, res) => {
    res.json({ authenticated: true });
  });

  app.post('/api/admin/change-password', requireAdmin, (req, res) => {
    if (getEnvPasscode().length > 0) {
      res.status(409).json({
        error: 'Kata sandi dikunci oleh variabel lingkungan ADMIN_PASSCODE di server.',
      });
      return;
    }

    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (newPassword.length < 6 || newPassword.length > 128) {
      res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
      return;
    }

    const store = readStore();
    if (!store.adminAuth || !verifyPasswordHash(currentPassword, store.adminAuth)) {
      res.status(401).json({ error: 'Kata sandi saat ini tidak sesuai.' });
      return;
    }

    store.adminAuth = hashPassword(newPassword);
    writeStore(store);
    res.json({ ok: true });
  });

  app.put('/api/site', requireAdmin, (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      res.status(400).json({ error: 'Format data situs tidak valid.' });
      return;
    }
    const store = readStore();
    const sanitized = sanitizeSitePayload(req.body as SiteConfig, store.site);
    store.site = sanitized;
    writeStore(store);
    res.json(store.site);
  });

  app.post('/api/contact', (req, res) => {
    const ip = req.ip ?? 'unknown';
    if (!checkRateLimit(`contact:${ip}`)) {
      res.status(429).json({ error: 'Terlalu banyak pesan dikirim. Coba beberapa saat lagi.' });
      return;
    }

    const name = sanitizeText(req.body?.name, 80);
    const email = sanitizeText(req.body?.email, 120);
    const subject = sanitizeText(req.body?.subject, 120) || 'Pesan Portofolio';
    const message = sanitizeText(req.body?.message, 2500);

    if (!name || !email || !message) {
      res.status(400).json({ error: 'Nama, email, dan isi pesan wajib diisi.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Format email tidak valid.' });
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

    const messages = readMessages();
    messages.unshift(entry);
    writeMessages(messages.slice(0, 200));
    res.status(201).json({ ok: true, id: entry.id });
  });

  app.get('/api/admin/messages', requireAdmin, (_req, res) => {
    res.json(readMessages());
  });

  app.delete('/api/admin/messages/:id', requireAdmin, (req, res) => {
    const id = sanitizeText(req.params.id, 60);
    const messages = readMessages();
    const next = messages.filter((m) => m.id !== id);
    writeMessages(next);
    res.json({ ok: true });
  });

  app.post('/api/admin/reset-site', requireAdmin, (_req, res) => {
    const store = readStore();
    store.site = structuredClone(DEFAULT_SITE_CONFIG);
    writeStore(store);
    res.json(store.site);
  });

  app.post('/api/upload', requireAdmin, (req, res) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: formatUploadError(err) });
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

  app.post('/api/uploads/batch', requireAdmin, (req, res) => {
    upload.array('files', 20)(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: formatUploadError(err) });
        return;
      }
      const files = Array.isArray(req.files) ? req.files : [];
      if (files.length === 0) {
        res.status(400).json({ error: 'Pilih minimal satu file foto atau video.' });
        return;
      }

      const results = files
        .map((file) => {
          const ext = path.extname(file.filename).toLowerCase();
          if (ext === '.svg' && !sanitizeUploadedSvg(file.path)) {
            return null;
          }
          const mediaType: MediaType = VIDEO_EXTENSIONS.has(ext) ? 'video' : 'image';
          return {
            filename: file.filename,
            url: `/uploads/${file.filename}`,
            mediaType,
            size: file.size,
            originalName: file.originalname,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      res.status(201).json(results);
    });
  });

  app.get('/api/uploads', requireAdmin, (_req, res) => {
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

  app.delete('/api/uploads/:filename', requireAdmin, (req, res) => {
    const filename = path.basename(req.params.filename ?? '');
    const resolved = path.resolve(UPLOADS_DIR, filename);
    if (!resolved.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'File tidak ditemukan.' });
      return;
    }
    fs.unlinkSync(resolved);
    res.json({ ok: true });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err && typeof err === 'object') {
      const errObj = err as { type?: string; status?: number; message?: string };
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

