export type MediaType = 'image' | 'video';

export type HeroLayout = 'showcase' | 'fullbleed' | 'split' | 'minimal';
export type HeroBackdropMode = 'studio-glow' | 'photo-cover' | 'solid-gradient';
export type GalleryLayout = 'editorial' | 'uniform-2' | 'uniform-3';
export type CardRadius = 'sharp' | 'soft' | 'editorial';
export type HeadingScale = 'compact' | 'normal' | 'dramatic';

export type LogoMode = 'monogram' | 'image' | 'image-only' | 'text-only';
export type LogoShape = 'rounded' | 'circle' | 'square';
export type LogoFit = 'cover' | 'contain';

export interface BrandLogoConfig {
  mode: LogoMode;
  imageUrl: string;
  monogramText: string;
  shape: LogoShape;
  fit: LogoFit;
  heightPx: number;
}

export interface SectionVisibility {
  about: boolean;
  skills: boolean;
  projects: boolean;
  certificates: boolean;
  gallery: boolean;
  contact: boolean;
}

export interface NavLabels {
  about: string;
  skills: string;
  projects: string;
  certificates: string;
  gallery: string;
  contact: string;
  headerCta: string;
  showHeaderCta: boolean;
}

export interface UiLabels {
  skillsCountSuffix: string;
  projectsViewLabel: string;
  projectsEmptyText: string;
  certificatesVerifyLabel: string;
  certificatesIdPrefix: string;
  certificatesEmptyText: string;
  workAllFilterLabel: string;
  workEmptyText: string;
  contactCopyLabel: string;
  contactCopiedLabel: string;
  contactFormToggleLabel: string;
  contactFormHeading: string;
  contactFormSubheading: string;
  contactFormSubmitLabel: string;
  footerBackToTopLabel: string;
  pageBackLabel: string;
  pageRelatedGalleryLabel: string;
}

export type ExtraBlockPlacement =
  | 'after-hero'
  | 'after-about'
  | 'after-skills'
  | 'after-projects'
  | 'after-certificates'
  | 'after-gallery';

export interface SiteColors {
  paper: string;
  paperAlt: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
}

export interface SiteTypography {
  displayFont: string;
  bodyFont: string;
  accentFont: string;
  headingScale: HeadingScale;
}

export interface SiteDesign {
  heroLayout: HeroLayout;
  galleryLayout: GalleryLayout;
  cardRadius: CardRadius;
  showPortrait: boolean;
}

export interface HeroExtraText {
  id: string;
  text: string;
  variant: 'tag' | 'heading' | 'body';
}

export interface HeroContent {
  imageUrl: string;
  mediaType: MediaType;
  alt: string;
  portraitUrl: string;
  portraitAlt: string;
  backdropMode: HeroBackdropMode;
  backdropOpacity?: number;
  backgroundColor?: string;
  backgroundGradientColor?: string;
  glowColor?: string;
  glowIntensity?: number;
  showGrid?: boolean;
  gridOpacity?: number;
  overlayOpacity?: number;
  greetingLeft: string;
  greetingRight: string;
  statusBadge: string;
  showStatusBadge: boolean;
  eyebrow: string;
  headlineLine1: string;
  headlineLine2: string;
  roleLine1: string;
  roleLine2: string;
  description: string;
  ctaLabel: string;
  secondaryCtaLabel: string;
  indexLabel: string;
  sideLabel: string;
  textContrast?: 'dark-scrim' | 'light-scrim' | 'card' | 'none';
  extraTexts?: HeroExtraText[];
}

export interface ProfileFact {
  label: string;
  value: string;
}

export interface StatMetric {
  value: string;
  label: string;
}

export interface AboutContent {
  eyebrow: string;
  title: string;
  statement: string;
  description: string;
  facts: ProfileFact[];
  stats: StatMetric[];
  codeTitle: string;
  codeLines: string[];
  showcaseImageUrl: string;
}

export interface SkillGroup {
  id: string;
  title: string;
  summary: string;
  items: string[];
}

export interface ProgramItem {
  id: string;
  name: string;
  category: string;
  level: string;
}

export interface ProjectItem {
  id: string;
  title: string;
  role: string;
  year: string;
  summary: string;
  techStack: string[];
  imageUrl: string;
  mediaType: MediaType;
  linkUrl: string;
}

export interface CertificateItem {
  id: string;
  title: string;
  issuer: string;
  year: string;
  credentialId: string;
  imageUrl: string;
  verifyUrl: string;
}

export interface PortfolioWork {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  imageUrl: string;
  mediaType: MediaType;
  alt: string;
  aspectClass: string;
}

export interface ExtraTextBlock {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  placement: ExtraBlockPlacement;
  visible: boolean;
}

export interface SocialLink {
  label: string;
  url: string;
}

export interface ContactContent {
  eyebrow: string;
  title: string;
  description: string;
  email: string;
  location: string;
  socials: SocialLink[];
}

export interface CustomPage {
  id: string;
  slug: string;
  navLabel: string;
  title: string;
  eyebrow: string;
  lead: string;
  coverUrl: string;
  coverMediaType: MediaType;
  content: string;
  published: boolean;
  mediaIds: string[];
}

export interface SiteConfig {
  schemaVersion: number;
  brandName: string;
  brandDot: string;
  brandSuffix: string;
  brandTagline: string;
  logo: BrandLogoConfig;
  sections: SectionVisibility;
  navLabels: NavLabels;
  uiLabels: UiLabels;
  colors: SiteColors;
  typography: SiteTypography;
  design: SiteDesign;
  hero: HeroContent;
  about: AboutContent;
  skillsEyebrow: string;
  skillsTitle: string;
  skillsNote: string;
  skills: SkillGroup[];
  programsTitle: string;
  programs: ProgramItem[];
  projectsEyebrow: string;
  projectsTitle: string;
  projectsNote: string;
  projects: ProjectItem[];
  certificatesEyebrow: string;
  certificatesTitle: string;
  certificatesNote: string;
  certificates: CertificateItem[];
  workEyebrow: string;
  workTitle: string;
  workNote: string;
  works: PortfolioWork[];
  extraBlocks: ExtraTextBlock[];
  contact: ContactContent;
  footerCopyright: string;
  pages: CustomPage[];
}

export interface UploadedAsset {
  id?: string;
  filename: string;
  url: string;
  mediaType: MediaType;
  size: number;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}
