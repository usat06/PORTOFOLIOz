import { DEFAULT_SITE_CONFIG } from '../data/defaultSite';
import type {
  BrandLogoConfig,
  CertificateItem,
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
} from '../types/site';

const VALID_PLACEMENTS = new Set<ExtraBlockPlacement>([
  'after-hero',
  'after-about',
  'after-skills',
  'after-projects',
  'after-certificates',
  'after-gallery',
]);

export function isSafeUrl(value: unknown): boolean {
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

export function sanitizeText(value: unknown, maxLength: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

export function sanitizeSlug(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function sanitizeSiteConfig(
  payload: Partial<SiteConfig>,
  existing: SiteConfig = DEFAULT_SITE_CONFIG,
): SiteConfig {
  const colors = {
    paper: isSafeHexColor(payload.colors?.paper) ? payload.colors!.paper : existing.colors.paper,
    paperAlt: isSafeHexColor(payload.colors?.paperAlt)
      ? payload.colors!.paperAlt
      : existing.colors.paperAlt,
    ink: isSafeHexColor(payload.colors?.ink) ? payload.colors!.ink : existing.colors.ink,
    muted: isSafeHexColor(payload.colors?.muted) ? payload.colors!.muted : existing.colors.muted,
    line: isSafeHexColor(payload.colors?.line) ? payload.colors!.line : existing.colors.line,
    accent: isSafeHexColor(payload.colors?.accent) ? payload.colors!.accent : existing.colors.accent,
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
    imageUrl: isSafeUrl(payload.logo?.imageUrl ?? '') ? payload.logo!.imageUrl.trim() : '',
    monogramText:
      sanitizeText(payload.logo?.monogramText, 4, existing.logo?.monogramText || 'UJ') || 'UJ',
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
    about:
      sanitizeText(payload.navLabels?.about, 30, existing.navLabels.about) || existing.navLabels.about,
    skills:
      sanitizeText(payload.navLabels?.skills, 30, existing.navLabels.skills) ||
      existing.navLabels.skills,
    projects:
      sanitizeText(payload.navLabels?.projects, 30, existing.navLabels.projects) ||
      existing.navLabels.projects,
    certificates:
      sanitizeText(payload.navLabels?.certificates, 30, existing.navLabels.certificates) ||
      existing.navLabels.certificates,
    gallery:
      sanitizeText(payload.navLabels?.gallery, 30, existing.navLabels.gallery) ||
      existing.navLabels.gallery,
    contact:
      sanitizeText(payload.navLabels?.contact, 30, existing.navLabels.contact) ||
      existing.navLabels.contact,
    headerCta:
      sanitizeText(payload.navLabels?.headerCta, 30, existing.navLabels.headerCta) ||
      existing.navLabels.headerCta,
    showHeaderCta: payload.navLabels?.showHeaderCta !== false,
  };

  const uiLabels: UiLabels = {
    skillsCountSuffix: sanitizeText(
      payload.uiLabels?.skillsCountSuffix,
      60,
      existing.uiLabels.skillsCountSuffix,
    ),
    projectsViewLabel: sanitizeText(
      payload.uiLabels?.projectsViewLabel,
      40,
      existing.uiLabels.projectsViewLabel,
    ),
    projectsEmptyText: sanitizeText(
      payload.uiLabels?.projectsEmptyText,
      120,
      existing.uiLabels.projectsEmptyText,
    ),
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
    workAllFilterLabel: sanitizeText(
      payload.uiLabels?.workAllFilterLabel,
      30,
      existing.uiLabels.workAllFilterLabel,
    ),
    workEmptyText: sanitizeText(payload.uiLabels?.workEmptyText, 120, existing.uiLabels.workEmptyText),
    contactCopyLabel: sanitizeText(
      payload.uiLabels?.contactCopyLabel,
      40,
      existing.uiLabels.contactCopyLabel,
    ),
    contactCopiedLabel: sanitizeText(
      payload.uiLabels?.contactCopiedLabel,
      40,
      existing.uiLabels.contactCopiedLabel,
    ),
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
            ? payload.hero!.imageUrl.trim()
            : existing.hero.imageUrl,
      mediaType: payload.hero?.mediaType === 'video' ? 'video' : 'image',
      alt: sanitizeText(payload.hero?.alt, 240, existing.hero.alt),
      portraitUrl:
        typeof payload.hero?.portraitUrl === 'string' && payload.hero.portraitUrl.trim() === ''
          ? ''
          : isSafeUrl(payload.hero?.portraitUrl)
            ? payload.hero!.portraitUrl.trim()
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
        ? payload.about!.showcaseImageUrl.trim()
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
    certificatesEyebrow: sanitizeText(
      payload.certificatesEyebrow,
      80,
      existing.certificatesEyebrow,
    ),
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
