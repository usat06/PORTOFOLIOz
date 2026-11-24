import type { User } from 'firebase/auth';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Award,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderGit2,
  GitBranch,
  Home,
  Image as ImageIcon,
  Lock,
  LogOut,
  Mail,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import {
  ACCENT_FONT_OPTIONS,
  ASPECT_RATIO_OPTIONS,
  BODY_FONT_OPTIONS,
  COLOR_PRESETS,
  DEFAULT_SITE_CONFIG,
  DISPLAY_FONT_OPTIONS,
  PLACEMENT_OPTIONS,
} from '../data/defaultSite';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../lib/firebase';
import {
  clearAdminDraftLocal,
  deleteCloudMediaAsset,
  deleteContactMessageFromCloud,
  getGitHubSyncStatus,
  grantAdminAccess,
  listCloudMediaAssets,
  listContactMessagesFromCloud,
  loadAdminDraftLocal,
  publishSiteToGitHub,
  saveAdminDraftLocal,
  saveSiteConfigToCloud,
  uploadMediaToCloud,
  type GitHubSyncStatus,
} from '../services/portfolioStore';
import type {
  CardRadius,
  CertificateItem,
  ContactMessage,
  CustomPage,
  ExtraBlockPlacement,
  ExtraTextBlock,
  GalleryLayout,
  HeadingScale,
  HeroBackdropMode,
  HeroExtraText,
  HeroLayout,
  LogoFit,
  LogoMode,
  LogoShape,
  MediaType,
  PortfolioWork,
  ProgramItem,
  ProjectItem,
  SectionVisibility,
  SiteConfig,
  SkillGroup,
  UploadedAsset,
} from '../types/site';
import { applySiteTheme } from '../utils/theme';
import { BrandLogo } from './BrandLogo';
import { CloudImg, CloudVideo } from './CloudMedia';

type AdminTab =
  | 'home'
  | 'skills'
  | 'projects'
  | 'certificates'
  | 'media'
  | 'theme'
  | 'pages'
  | 'messages'
  | 'security';

interface AdminWorkspaceProps {
  site: SiteConfig;
  user: User;
  cloudSyncWarning?: string | null;
  onSiteSaved: (updated: SiteConfig) => void;
  onLogout: (reason?: string) => void;
  onExit: () => void;
}

const ACCEPTED_MEDIA_TYPES =
  'image/*,video/*,.png,.jpg,.jpeg,.jfif,.webp,.gif,.avif,.svg,.bmp,.ico,.heic,.heif,.mp4,.webm,.mov,.m4v,.ogg,.mkv,.3gp,.avi';

const ACCEPTED_IMAGE_TYPES =
  'image/*,.png,.jpg,.jpeg,.jfif,.webp,.gif,.avif,.svg,.bmp,.ico,.heic,.heif';

const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|ogg|mkv|3gp|avi)(?:[?#].*)?$/i;

function looksLikeVideoUrl(url: string): boolean {
  const trimmed = url.trim();
  return VIDEO_EXT_RE.test(trimmed) || trimmed.startsWith('data:video/');
}

export function AdminWorkspace({
  site,
  user,
  cloudSyncWarning,
  onSiteSaved,
  onLogout,
  onExit,
}: AdminWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('home');
  const initialRecoveredRef = useRef<ReturnType<typeof loadAdminDraftLocal>>(
    loadAdminDraftLocal(user.uid),
  );
  const [draft, setDraft] = useState<SiteConfig>(() => {
    const recovered = initialRecoveredRef.current;
    if (recovered && JSON.stringify(recovered.draft) !== JSON.stringify(site)) {
      return structuredClone(recovered.draft);
    }
    return structuredClone(site);
  });
  const [recoveredDraftAt, setRecoveredDraftAt] = useState<string | null>(() => {
    const recovered = initialRecoveredRef.current;
    if (recovered && JSON.stringify(recovered.draft) !== JSON.stringify(site)) {
      return recovered.savedAt;
    }
    return null;
  });
  const [saving, setSaving] = useState(false);
  const [publishingGitHub, setPublishingGitHub] = useState(false);
  const [githubStatus, setGithubStatus] = useState<GitHubSyncStatus>({
    configured: false,
    repo: '',
    branch: 'main',
  });
  const [githubCommitUrl, setGithubCommitUrl] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [uploads, setUploads] = useState<UploadedAsset[]>([]);
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);

  // New gallery item state
  const [newWorkTitle, setNewWorkTitle] = useState('');
  const [newWorkCategory, setNewWorkCategory] = useState('Potret');
  const [newWorkUrl, setNewWorkUrl] = useState('');
  const [newWorkMediaType, setNewWorkMediaType] = useState<MediaType>('image');
  const [newWorkAspect, setNewWorkAspect] = useState(ASPECT_RATIO_OPTIONS[0].value);
  const [newWorkAlt, setNewWorkAlt] = useState('');

  // New program state
  const [newProgName, setNewProgName] = useState('');
  const [newProgCategory, setNewProgCategory] = useState('Bahasa Pemrograman');
  const [newProgLevel, setNewProgLevel] = useState('Mahir');

  // Custom page editor selection
  const [editingPageId, setEditingPageId] = useState<string | null>(null);

  // Security & system tab state
  const [extraAdminUid, setExtraAdminUid] = useState('');
  const [extraAdminEmail, setExtraAdminEmail] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const prevSiteJsonRef = useRef<string>(JSON.stringify(site));

  useEffect(() => {
    const nextSiteJson = JSON.stringify(site);
    if (nextSiteJson !== prevSiteJsonRef.current) {
      setDraft((currentDraft) => {
        if (JSON.stringify(currentDraft) === prevSiteJsonRef.current) {
          return structuredClone(site);
        }
        return currentDraft;
      });
      prevSiteJsonRef.current = nextSiteJson;
    }
  }, [site]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (JSON.stringify(draft) !== JSON.stringify(site)) {
        saveAdminDraftLocal(user.uid, draft);
      } else {
        clearAdminDraftLocal(user.uid);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, site, user.uid]);

  useEffect(() => {
    applySiteTheme(draft);
    return () => {
      applySiteTheme(site);
    };
  }, [draft, site]);

  useEffect(() => {
    let active = true;

    listCloudMediaAssets(user)
      .then((list) => {
        if (active) setUploads(list);
      })
      .catch(() => {});

    listContactMessagesFromCloud()
      .then((list) => {
        if (active) setMessages(list);
      })
      .catch(() => {});

    getGitHubSyncStatus(user)
      .then((status) => {
        if (active) setGithubStatus(status);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [user]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(site);

  const uploadMediaFile = async (file: File): Promise<{ url: string; mediaType: MediaType } | null> => {
    const uploaded = await uploadMediaToCloud(file, user);
    setUploads((prev) => [uploaded.asset, ...prev]);
    return { url: uploaded.url, mediaType: uploaded.mediaType };
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSaveMessage(null);

    try {
      const saved = await saveSiteConfigToCloud(draft, user);
      clearAdminDraftLocal(user.uid);
      setRecoveredDraftAt(null);
      prevSiteJsonRef.current = JSON.stringify(saved);
      setDraft(structuredClone(saved));
      onSiteSaved(saved);
      setSaveMessage('Semua perubahan tersimpan permanen di cloud & perangkat.');
      window.setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menyimpan perubahan ke cloud database.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePublishGitHub = async () => {
    setPublishingGitHub(true);
    setErrorMessage(null);
    setSaveMessage(null);
    setGithubCommitUrl(null);

    try {
      const result = await publishSiteToGitHub(draft, user);
      const updated = result.site;
      clearAdminDraftLocal(user.uid);
      setRecoveredDraftAt(null);
      prevSiteJsonRef.current = JSON.stringify(updated);
      setDraft(structuredClone(updated));
      onSiteSaved(updated);
      await saveSiteConfigToCloud(updated, user).catch(() => {});
      if (result.commitUrl) {
        setGithubCommitUrl(result.commitUrl);
      }
      setSaveMessage('Data & media berhasil disimpan langsung ke repositori GitHub.');
      window.setTimeout(() => setSaveMessage(null), 5000);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal mengirim data ke repositori GitHub.',
      );
    } finally {
      setPublishingGitHub(false);
    }
  };

  const handleDownloadGitHubSnapshot = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'site-snapshot.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    clearAdminDraftLocal(user.uid);
    setRecoveredDraftAt(null);
    setDraft(structuredClone(site));
    setSaveMessage(null);
    setErrorMessage(null);
  };

  const handleSingleUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    targetId: string,
    onSuccess: (url: string, mediaType: MediaType, filename: string) => void,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadingTarget(targetId);
    setErrorMessage(null);
    try {
      const uploaded = await uploadMediaFile(file);
      if (uploaded) {
        onSuccess(uploaded.url, uploaded.mediaType, file.name);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal mengunggah file.');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleBatchGalleryUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    event.target.value = '';
    if (!fileList || fileList.length === 0) return;

    setUploadingTarget('batch-gallery');
    setErrorMessage(null);
    try {
      const selectedFiles = Array.from(fileList).slice(0, 20);
      const uploadedResults: { asset: UploadedAsset; url: string; mediaType: MediaType; originalName: string }[] = [];

      for (const file of selectedFiles) {
        const res = await uploadMediaToCloud(file, user);
        uploadedResults.push({ ...res, originalName: file.name });
      }

      const categoryLabel = newWorkCategory.trim() || 'Galeri';
      const categorySlug =
        categoryLabel
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'galeri';

      const createdWorks: PortfolioWork[] = uploadedResults.map((item, idx) => {
        const cleanTitle =
          item.originalName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() ||
          `Karya ${idx + 1}`;
        return {
          id: `karya-${Date.now().toString(36)}-${idx}`,
          title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
          category: categorySlug,
          categoryLabel,
          imageUrl: item.url,
          mediaType: item.mediaType,
          alt: cleanTitle,
          aspectClass: newWorkAspect,
        };
      });

      setUploads((prev) => [...uploadedResults.map((r) => r.asset), ...prev]);
      setDraft((prev) => ({ ...prev, works: [...createdWorks, ...prev.works] }));
      setSaveMessage(
        `${createdWorks.length} file terunggah ke cloud dan masuk ke draf galeri. Klik Simpan Perubahan untuk menerbitkan.`,
      );
      window.setTimeout(() => setSaveMessage(null), 4500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal mengunggah file ke cloud.');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleCopyAssetUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      window.setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleDeleteMessage = async (id: string) => {
    try {
      await deleteContactMessageFromCloud(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setErrorMessage('Gagal menghapus pesan dari cloud database.');
    }
  };

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portofolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<SiteConfig>;
      if (!parsed || typeof parsed !== 'object' || !parsed.hero || !parsed.about) {
        setErrorMessage('File JSON bukan cadangan portofolio yang valid.');
        return;
      }
      setDraft((prev) => ({
        ...prev,
        ...parsed,
        logo: { ...prev.logo, ...(parsed.logo ?? {}) },
        sections: { ...prev.sections, ...(parsed.sections ?? {}) },
        navLabels: { ...prev.navLabels, ...(parsed.navLabels ?? {}) },
        uiLabels: { ...prev.uiLabels, ...(parsed.uiLabels ?? {}) },
        colors: { ...prev.colors, ...(parsed.colors ?? {}) },
        typography: { ...prev.typography, ...(parsed.typography ?? {}) },
        design: { ...prev.design, ...(parsed.design ?? {}) },
        hero: { ...prev.hero, ...(parsed.hero ?? {}) },
        about: { ...prev.about, ...(parsed.about ?? {}) },
        contact: { ...prev.contact, ...(parsed.contact ?? {}) },
      }));
      setSaveMessage('Cadangan dimuat ke draf. Klik Simpan Perubahan untuk menerapkan.');
      window.setTimeout(() => setSaveMessage(null), 4000);
    } catch {
      setErrorMessage('Gagal membaca file JSON cadangan.');
    }
  };

  const handleResetSiteToDefault = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const saved = await saveSiteConfigToCloud(DEFAULT_SITE_CONFIG, user);
      clearAdminDraftLocal(user.uid);
      setRecoveredDraftAt(null);
      prevSiteJsonRef.current = JSON.stringify(saved);
      setDraft(structuredClone(saved));
      onSiteSaved(saved);
      setConfirmReset(false);
      setSaveMessage('Situs berhasil dikembalikan ke pengaturan awal di cloud.');
      window.setTimeout(() => setSaveMessage(null), 3500);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal mereset situs ke pengaturan awal.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddWork = (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!newWorkTitle.trim() || !newWorkUrl.trim()) {
      setErrorMessage('Isi judul dan unggah foto/video atau masukkan URL media.');
      return;
    }

    const categoryLabel = newWorkCategory.trim() || 'Lainnya';
    const categorySlug =
      categoryLabel
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'lainnya';

    const newItem: PortfolioWork = {
      id: `karya-${Date.now().toString(36)}`,
      title: newWorkTitle.trim(),
      category: categorySlug,
      categoryLabel,
      imageUrl: newWorkUrl.trim(),
      mediaType: newWorkMediaType,
      alt: newWorkAlt.trim() || newWorkTitle.trim(),
      aspectClass: newWorkAspect,
    };

    setDraft((prev) => ({
      ...prev,
      works: [newItem, ...prev.works],
    }));

    setNewWorkTitle('');
    setNewWorkUrl('');
    setNewWorkAlt('');
    setNewWorkMediaType('image');
  };

  const handleAddExtraBlock = () => {
    const block: ExtraTextBlock = {
      id: `teks-${Date.now().toString(36)}`,
      eyebrow: 'Catatan Tambahan',
      title: 'Judul Bagian Baru',
      body: 'Tulis teks tambahan, pengalaman, pengumuman, atau cerita baru untuk ditampilkan di halaman utama.',
      placement: 'after-about',
      visible: true,
    };
    setDraft((prev) => ({ ...prev, extraBlocks: [...prev.extraBlocks, block] }));
  };

  const handleAddSkillGroup = () => {
    const group: SkillGroup = {
      id: `skill-${Date.now().toString(36)}`,
      title: 'Bidang Keahlian Baru',
      summary: 'Jelaskan ringkas pengalaman atau keahlian pada bidang ini.',
      items: ['Kemampuan 1', 'Kemampuan 2'],
    };
    setDraft((prev) => ({ ...prev, skills: [...prev.skills, group] }));
  };

  const handleAddProgram = (event: FormEvent) => {
    event.preventDefault();
    if (!newProgName.trim()) return;
    const item: ProgramItem = {
      id: `prog-${Date.now().toString(36)}`,
      name: newProgName.trim(),
      category: newProgCategory.trim() || 'Teknologi',
      level: newProgLevel.trim() || 'Mahir',
    };
    setDraft((prev) => ({ ...prev, programs: [...prev.programs, item] }));
    setNewProgName('');
  };

  const handleAddProject = () => {
    const project: ProjectItem = {
      id: `proj-${Date.now().toString(36)}`,
      title: 'Proyek Informatika Baru',
      role: 'Full-Stack Developer',
      year: String(new Date().getFullYear()),
      summary: 'Deskripsi singkat tujuan proyek, fitur utama, dan peran Anda dalam pengerjaan.',
      techStack: ['TypeScript', 'React', 'Node.js'],
      imageUrl: '',
      mediaType: 'image',
      linkUrl: '',
    };
    setDraft((prev) => ({ ...prev, projects: [project, ...prev.projects] }));
  };

  const handleAddCertificate = () => {
    const cert: CertificateItem = {
      id: `cert-${Date.now().toString(36)}`,
      title: 'Nama Sertifikat Baru',
      issuer: 'Lembaga Penerbit',
      year: String(new Date().getFullYear()),
      credentialId: '',
      imageUrl: '',
      verifyUrl: '',
    };
    setDraft((prev) => ({ ...prev, certificates: [cert, ...prev.certificates] }));
  };

  const handleCreatePage = () => {
    const idx = draft.pages.length + 1;
    const newPage: CustomPage = {
      id: `page-${Date.now().toString(36)}`,
      slug: `halaman-${idx}`,
      navLabel: `Halaman ${idx}`,
      title: `Halaman Baru ${idx}`,
      eyebrow: 'Arsip & Cerita',
      lead: 'Pengantar singkat untuk halaman khusus ini.',
      coverUrl: '',
      coverMediaType: 'image',
      content: 'Tulis isi halaman Anda di sini.',
      published: true,
      mediaIds: [],
    };
    setDraft((prev) => ({ ...prev, pages: [...prev.pages, newPage] }));
    setEditingPageId(newPage.id);
  };

  const updatePage = (id: string, patch: Partial<CustomPage>) => {
    setDraft((prev) => ({
      ...prev,
      pages: prev.pages.map((page) => (page.id === id ? { ...page, ...patch } : page)),
    }));
  };

  const handleDeleteUploadedAsset = async (asset: UploadedAsset) => {
    const assetId = asset.id || asset.url.split('/').pop()?.split('.')[0] || '';
    if (!assetId) return;
    try {
      await deleteCloudMediaAsset(assetId);
      setUploads((prev) =>
        prev.filter((item) => (item.id ? item.id !== assetId : item.url !== asset.url)),
      );
    } catch {
      setErrorMessage('Gagal menghapus file dari cloud database.');
    }
  };

  const handleGrantAdmin = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordStatus(null);
    setErrorMessage(null);

    try {
      await grantAdminAccess(extraAdminUid, extraAdminEmail);
      setExtraAdminUid('');
      setExtraAdminEmail('');
      setPasswordStatus('Akses admin tambahan berhasil disimpan di Firestore.');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menambahkan akun admin tambahan.',
      );
    }
  };

  const navTabs: { id: AdminTab; label: string; icon: typeof Home }[] = [
    { id: 'home', label: 'Halaman Utama & Logo', icon: Home },
    { id: 'skills', label: 'Keahlian & Program', icon: Code2 },
    { id: 'projects', label: 'Proyek Informatika', icon: FolderGit2 },
    { id: 'certificates', label: 'Sertifikat', icon: Award },
    { id: 'media', label: 'Galeri Foto & Video', icon: ImageIcon },
    { id: 'theme', label: 'Desain, Warna & Fon', icon: Palette },
    { id: 'pages', label: 'Halaman Kustom', icon: FileText },
    {
      id: 'messages',
      label: messages.length > 0 ? `Pesan Masuk (${messages.length})` : 'Pesan Masuk',
      icon: Mail,
    },
    { id: 'security', label: 'Keamanan & Backup', icon: Lock },
  ];

  const activePageBeingEdited =
    draft.pages.find((p) => p.id === editingPageId) ?? draft.pages[0] ?? null;

  return (
    <div className="min-h-screen bg-[#f6f6f5] font-sans text-[#18181b]">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[#e4e4e7] bg-white px-4 md:px-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap border border-[#e4e4e7] bg-white px-3 py-1.5 text-xs font-medium text-[#18181b] transition-colors hover:bg-[#f4f4f5]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Lihat Situs
          </button>
          <div className="hidden items-center gap-2 text-xs text-[#71717a] sm:flex">
            <span className="font-semibold text-[#18181b]">Panel Admin Usat Jalung</span>
            <span>/</span>
            <span>{navTabs.find((t) => t.id === activeTab)?.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {saveMessage && (
            <span className="hidden items-center gap-1.5 text-xs font-medium text-emerald-700 md:inline-flex">
              <Check className="h-3.5 w-3.5" />
              {saveMessage}
            </span>
          )}
          {hasChanges && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border border-[#d4d4d8] bg-white px-3 py-2 text-xs font-medium text-[#3f3f46] hover:bg-[#f4f4f5]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Batal
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || publishingGitHub}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-0 bg-[#18181b] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#27272a] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
          {githubStatus.configured && (
            <button
              type="button"
              onClick={handlePublishGitHub}
              disabled={saving || publishingGitHub}
              className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap border border-[#18181b] bg-white px-3 py-2 text-xs font-semibold text-[#18181b] transition-colors hover:bg-[#f4f4f5] disabled:opacity-50 sm:inline-flex"
            >
              <GitBranch className="h-3.5 w-3.5" />
              {publishingGitHub ? 'Push GitHub...' : 'Push ke GitHub'}
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-[#e4e4e7] bg-white md:min-h-[calc(100vh-64px)] md:w-[250px] md:border-b-0 md:border-r">
          <nav
            aria-label="Menu Admin"
            className="flex gap-1 overflow-x-auto p-3 md:flex-col md:gap-1 md:p-4"
          >
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center gap-3 whitespace-nowrap border-0 px-3.5 py-2.5 text-left text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#18181b] text-white'
                      : 'bg-transparent text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#18181b]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="hidden border-t border-[#e4e4e7] p-4 md:block">
            <button
              type="button"
              onClick={() => onLogout()}
              className="flex w-full items-center gap-2.5 border border-[#e4e4e7] bg-white px-3.5 py-2 text-xs font-medium text-[#52525b] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              Keluar Admin
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-5 md:p-8">
          {cloudSyncWarning && (
            <div
              role="status"
              className="mb-4 border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900"
            >
              {cloudSyncWarning}
            </div>
          )}

          {recoveredDraftAt && hasChanges && (
            <div
              role="status"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900"
            >
              <span>
                Draf editan terakhir Anda ({new Date(recoveredDraftAt).toLocaleString('id-ID')})
                dipulihkan otomatis agar tidak hilang saat menutup browser atau mematikan perangkat.
              </span>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="border-0 bg-sky-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-800"
              >
                Terbitkan Sekarang
              </button>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
            >
              {errorMessage}
            </div>
          )}

          {saveMessage && (
            <div className="mb-6 flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800 md:hidden">
              <Check className="h-4 w-4" />
              {saveMessage}
            </div>
          )}

          {activeTab === 'home' && (
            <div className="space-y-8">
              <section className="border border-[#e4e4e7] bg-white p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#f4f4f5] pb-4">
                  <div>
                    <h2 className="m-0 text-lg font-semibold text-[#18181b]">
                      Logo Situs (Foto atau Kustom)
                    </h2>
                    <p className="m-0 mt-1 text-xs text-[#71717a]">
                      Gunakan monogram huruf kustom, unggah foto/logo (PNG, JPG, WebP, SVG, ICO), atau tampilkan teks saja.
                    </p>
                  </div>
                  <div className="border border-[#e4e4e7] bg-paper px-4 py-2.5">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#71717a]">
                      Pratinjau Header
                    </div>
                    <BrandLogo site={draft} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Mode Tampilan Logo
                    </label>
                    <select
                      value={draft.logo?.mode ?? 'monogram'}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          logo: { ...p.logo, mode: e.target.value as LogoMode },
                        }))
                      }
                      className="w-full border border-[#d4d4d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    >
                      <option value="monogram">Monogram Kustom + Nama</option>
                      <option value="image">Foto / Gambar Logo + Nama</option>
                      <option value="image-only">Hanya Foto / Gambar Logo</option>
                      <option value="text-only">Hanya Teks Nama</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Ukuran Logo ({draft.logo?.heightPx ?? 34}px)
                    </label>
                    <input
                      type="range"
                      min={24}
                      max={60}
                      value={draft.logo?.heightPx ?? 34}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          logo: { ...p.logo, heightPx: Number(e.target.value) },
                        }))
                      }
                      className="mt-2 w-full cursor-pointer"
                    />
                  </div>

                  {(draft.logo?.mode === 'image' || draft.logo?.mode === 'image-only') ? (
                    <>
                      <div className="md:col-span-2">
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Foto / File Logo (PNG, JPG, WebP, SVG, GIF, ICO)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={draft.logo?.imageUrl ?? ''}
                            placeholder="Unggah foto/gambar logo atau tempel URL"
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                logo: { ...p.logo, imageUrl: e.target.value },
                              }))
                            }
                            className="flex-1 border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                          />
                          <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 border border-[#18181b] bg-[#18181b] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#27272a]">
                            <Upload className="h-3.5 w-3.5" />
                            {uploadingTarget === 'brandLogo' ? 'Mengunggah...' : 'Unggah Logo'}
                            <input
                              type="file"
                              accept={ACCEPTED_IMAGE_TYPES}
                              onChange={(e) =>
                                handleSingleUpload(e, 'brandLogo', (url) =>
                                  setDraft((p) => ({
                                    ...p,
                                    logo: {
                                      ...p.logo,
                                      mode: p.logo.mode === 'image-only' ? 'image-only' : 'image',
                                      imageUrl: url,
                                    },
                                  })),
                                )
                              }
                              className="sr-only"
                            />
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Bentuk Bingkai Foto Logo
                        </label>
                        <select
                          value={draft.logo?.shape ?? 'rounded'}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              logo: { ...p.logo, shape: e.target.value as LogoShape },
                            }))
                          }
                          className="w-full border border-[#d4d4d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                        >
                          <option value="rounded">Sudut Membulat</option>
                          <option value="circle">Lingkaran Penuh</option>
                          <option value="square">Kotak Tajam</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Penyesuaian Gambar Logo
                        </label>
                        <select
                          value={draft.logo?.fit ?? 'cover'}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              logo: { ...p.logo, fit: e.target.value as LogoFit },
                            }))
                          }
                          className="w-full border border-[#d4d4d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                        >
                          <option value="cover">Isi Bingkai (Cover — cocok untuk foto profil)</option>
                          <option value="contain">Utuh Tanpa Terpotong (Contain — cocok untuk logo PNG/SVG)</option>
                        </select>
                      </div>
                    </>
                  ) : draft.logo?.mode === 'monogram' ? (
                    <>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Huruf Monogram (1–3 karakter)
                        </label>
                        <input
                          type="text"
                          maxLength={3}
                          value={draft.logo?.monogramText ?? 'UJ'}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              logo: { ...p.logo, monogramText: e.target.value.toUpperCase() },
                            }))
                          }
                          placeholder="UJ"
                          className="w-full border border-[#d4d4d8] px-3 py-2 font-mono text-sm uppercase outline-none focus:border-[#18181b]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Bentuk Lencana Monogram
                        </label>
                        <select
                          value={draft.logo?.shape ?? 'rounded'}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              logo: { ...p.logo, shape: e.target.value as LogoShape },
                            }))
                          }
                          className="w-full border border-[#d4d4d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                        >
                          <option value="rounded">Sudut Membulat</option>
                          <option value="circle">Lingkaran</option>
                          <option value="square">Kotak Tajam</option>
                        </select>
                      </div>
                    </>
                  ) : null}

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Nama Logo Utama
                    </label>
                    <input
                      type="text"
                      value={draft.brandName}
                      onChange={(e) => setDraft((p) => ({ ...p, brandName: e.target.value }))}
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div className="grid grid-cols-[72px_1fr] gap-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        Pemisah
                      </label>
                      <input
                        type="text"
                        maxLength={3}
                        value={draft.brandDot}
                        onChange={(e) => setDraft((p) => ({ ...p, brandDot: e.target.value }))}
                        className="w-full border border-[#d4d4d8] px-3 py-2 text-center text-sm outline-none focus:border-[#18181b]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        Akhiran Logo (opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Kosongkan jika tidak perlu"
                        value={draft.brandSuffix}
                        onChange={(e) => setDraft((p) => ({ ...p, brandSuffix: e.target.value }))}
                        className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Tagline Di Bawah Nama Logo (opsional — kosongkan untuk menyembunyikan)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Informatika & Fotografi"
                      value={draft.brandTagline}
                      onChange={(e) => setDraft((p) => ({ ...p, brandTagline: e.target.value }))}
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                </div>
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="m-0 text-lg font-semibold text-[#18181b]">
                      Menu Navigasi & Tombol Header
                    </h2>
                    <p className="m-0 mt-1 text-xs text-[#71717a]">
                      Ubah seluruh label menu di bilah atas website dan tombol aksi kanan.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#18181b]">
                    <input
                      type="checkbox"
                      checked={draft.navLabels?.showHeaderCta ?? true}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          navLabels: { ...p.navLabels, showHeaderCta: e.target.checked },
                        }))
                      }
                    />
                    Tampilkan Tombol Kanan Header
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {(
                    [
                      ['about', 'Menu Tentang'],
                      ['skills', 'Menu Keahlian'],
                      ['projects', 'Menu Proyek'],
                      ['certificates', 'Menu Sertifikat'],
                      ['gallery', 'Menu Galeri'],
                      ['contact', 'Menu Kontak'],
                      ['headerCta', 'Teks Tombol Kanan'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        {label}
                      </label>
                      <input
                        type="text"
                        value={draft.navLabels?.[key] ?? ''}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            navLabels: { ...p.navLabels, [key]: e.target.value },
                          }))
                        }
                        className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-5 mt-0 text-lg font-semibold text-[#18181b]">
                  Hero, Teks & Foto Utama
                </h2>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Sapaan Italic Kiri (Showcase)
                    </label>
                    <input
                      type="text"
                      value={draft.hero.greetingLeft ?? ''}
                      placeholder="Contoh: Halo,"
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, hero: { ...p.hero, greetingLeft: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Sapaan Italic Kanan (Showcase)
                    </label>
                    <input
                      type="text"
                      value={draft.hero.greetingRight ?? ''}
                      placeholder="Contoh: selamat datang"
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, hero: { ...p.hero, greetingRight: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Judul Hero Baris 1
                    </label>
                    <input
                      type="text"
                      value={draft.hero.headlineLine1}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, hero: { ...p.hero, headlineLine1: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Judul Hero Baris 2
                    </label>
                    <input
                      type="text"
                      value={draft.hero.headlineLine2}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, hero: { ...p.hero, headlineLine2: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Peran / Spesialisasi Kanan Baris 1
                    </label>
                    <input
                      type="text"
                      value={draft.hero.roleLine1 ?? ''}
                      placeholder="Contoh: INFORMATICS"
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, hero: { ...p.hero, roleLine1: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Peran / Spesialisasi Kanan Baris 2
                    </label>
                    <input
                      type="text"
                      value={draft.hero.roleLine2 ?? ''}
                      placeholder="Contoh: & PHOTOGRAPHY"
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, hero: { ...p.hero, roleLine2: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-medium text-[#3f3f46]">
                        Lencana Status Hero
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs text-[#52525b]">
                        <input
                          type="checkbox"
                          checked={draft.hero.showStatusBadge ?? true}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              hero: { ...p.hero, showStatusBadge: e.target.checked },
                            }))
                          }
                        />
                        Tampilkan
                      </label>
                    </div>
                    <input
                      type="text"
                      value={draft.hero.statusBadge ?? ''}
                      placeholder="Contoh: Terbuka untuk Proyek & Kolaborasi"
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, hero: { ...p.hero, statusBadge: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Arahkan Gaya Latar Belakang Halaman Depan
                    </label>
                    <p className="m-0 text-xs text-[#71717a]">
                      Atur foto, video, warna, gradasi, cahaya glow, dan grid informatika pada kartu &ldquo;Latar Belakang Halaman Depan (Hero)&rdquo; tepat di bawah bagian ini.
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Subjudul / Eyebrow Hero
                    </label>
                    <input
                      type="text"
                      value={draft.hero.eyebrow}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, hero: { ...p.hero, eyebrow: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Deskripsi Hero
                    </label>
                    <textarea
                      rows={2}
                      value={draft.hero.description}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, hero: { ...p.hero, description: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>


                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-medium text-[#3f3f46]">
                        Foto Potret Anda di Hero
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs text-[#52525b]">
                        <input
                          type="checkbox"
                          checked={draft.design.showPortrait}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              design: { ...p.design, showPortrait: e.target.checked },
                            }))
                          }
                        />
                        Tampilkan
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={draft.hero.portraitUrl}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, hero: { ...p.hero, portraitUrl: e.target.value } }))
                        }
                        className="flex-1 border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                      />
                      <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 border border-[#d4d4d8] bg-[#fafafa] px-3 py-2 text-xs font-medium hover:bg-[#f4f4f5]">
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingTarget === 'heroPortrait' ? '...' : 'Unggah'}
                        <input
                          type="file"
                          accept={ACCEPTED_IMAGE_TYPES}
                          onChange={(e) =>
                            handleSingleUpload(e, 'heroPortrait', (url) =>
                              setDraft((p) => ({
                                ...p,
                                design: { ...p.design, showPortrait: true },
                                hero: { ...p.hero, portraitUrl: url },
                              })),
                            )
                          }
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Teks Alt Latar Hero (Aksesibilitas)
                    </label>
                    <input
                      type="text"
                      value={draft.hero.alt ?? ''}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, hero: { ...p.hero, alt: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Teks Alt Foto Potret (Aksesibilitas)
                    </label>
                    <input
                      type="text"
                      value={draft.hero.portraitAlt ?? ''}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, hero: { ...p.hero, portraitAlt: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Teks Tombol Utama Hero
                    </label>
                    <input
                      type="text"
                      value={draft.hero.ctaLabel}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, hero: { ...p.hero, ctaLabel: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Teks Tombol Kedua Hero
                    </label>
                    <input
                      type="text"
                      value={draft.hero.secondaryCtaLabel}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          hero: { ...p.hero, secondaryCtaLabel: e.target.value },
                        }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Label Bawah Kiri Hero
                    </label>
                    <input
                      type="text"
                      value={draft.hero.indexLabel}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, hero: { ...p.hero, indexLabel: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Label Bawah Samping Hero
                    </label>
                    <input
                      type="text"
                      value={draft.hero.sideLabel}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, hero: { ...p.hero, sideLabel: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div className="md:col-span-2 border-t border-[#e4e4e7] pt-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="m-0 text-base font-semibold text-[#18181b]">
                          Latar Belakang Halaman Depan (Hero)
                        </h3>
                        <p className="m-0 mt-0.5 text-xs text-[#71717a]">
                          Ubah foto/video latar, warna solid atau gradasi, pendaran cahaya studio, grid informatika, dan kontras teks di halaman depan.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((p) => ({
                            ...p,
                            hero: {
                              ...p.hero,
                              backdropMode: 'studio-glow',
                              backdropOpacity: 82,
                              backgroundColor: '',
                              backgroundGradientColor: '',
                              glowColor: '',
                              glowIntensity: 32,
                              showGrid: true,
                              gridOpacity: 42,
                              overlayOpacity: 48,
                              textContrast: 'dark-scrim',
                            },
                          }))
                        }
                        className="inline-flex items-center gap-1 border border-[#d4d4d8] bg-white px-2.5 py-1.5 text-xs font-medium text-[#18181b] hover:bg-[#f4f4f5]"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset Latar Bawaan
                      </button>
                    </div>

                    {/* Mini Pratinjau Latar Belakang */}
                    <div
                      className="relative mb-5 flex h-36 items-center justify-between overflow-hidden border border-[#d4d4d8] px-6"
                      style={{
                        background:
                          draft.hero.backdropMode === 'solid-gradient' &&
                          draft.hero.backgroundColor &&
                          draft.hero.backgroundGradientColor
                            ? `linear-gradient(135deg, ${draft.hero.backgroundColor} 0%, ${draft.hero.backgroundGradientColor} 100%)`
                            : draft.hero.backgroundColor || draft.colors.paper,
                      }}
                    >
                      {draft.hero.backdropMode === 'photo-cover' && draft.hero.imageUrl && (
                        <div
                          className="pointer-events-none absolute inset-0"
                          style={{ opacity: (draft.hero.backdropOpacity ?? 82) / 100 }}
                        >
                          {draft.hero.mediaType === 'video' ? (
                            <CloudVideo
                              src={draft.hero.imageUrl}
                              muted
                              autoPlay
                              loop
                              playsInline
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <CloudImg
                              src={draft.hero.imageUrl}
                              alt="Pratinjau latar"
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                      )}
                      {draft.hero.backdropMode === 'photo-cover' &&
                        (draft.hero.textContrast ?? 'dark-scrim') === 'dark-scrim' && (
                          <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                              backgroundColor: `rgba(10,12,15,${((draft.hero.overlayOpacity ?? 48) / 100).toFixed(2)})`,
                            }}
                          />
                        )}
                      {draft.hero.backdropMode === 'photo-cover' &&
                        draft.hero.textContrast === 'light-scrim' && (
                          <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                              backgroundColor: draft.colors.paper,
                              opacity: Math.min(0.9, ((draft.hero.overlayOpacity ?? 48) / 100) + 0.15),
                            }}
                          />
                        )}
                      {draft.hero.showGrid !== false && (
                        <div
                          className="pointer-events-none absolute inset-0"
                          style={{
                            opacity: (draft.hero.gridOpacity ?? 42) / 100,
                            backgroundImage:
                              draft.hero.backdropMode === 'photo-cover' &&
                              (draft.hero.textContrast ?? 'dark-scrim') === 'dark-scrim'
                                ? 'linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)'
                                : `linear-gradient(to right, ${draft.colors.line} 1px, transparent 1px), linear-gradient(to bottom, ${draft.colors.line} 1px, transparent 1px)`,
                            backgroundSize: '36px 36px',
                          }}
                        />
                      )}
                      {(draft.hero.glowIntensity ?? 32) > 0 && (
                        <div
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background: `radial-gradient(circle at 50% 45%, ${draft.hero.glowColor || draft.colors.accent}44 0%, transparent 65%)`,
                            opacity: (draft.hero.glowIntensity ?? 32) / 50,
                          }}
                        />
                      )}
                      <div
                        className={`relative z-[2] ${
                          draft.hero.backdropMode === 'photo-cover' &&
                          ((draft.hero.textContrast ?? 'dark-scrim') === 'dark-scrim' ||
                            draft.hero.textContrast === 'card')
                            ? 'text-white'
                            : 'text-[#18181b]'
                        }`}
                      >
                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-80">
                          Pratinjau Latar Halaman Depan
                        </div>
                        <div className="font-serif text-2xl font-bold uppercase tracking-tight">
                          {draft.hero.headlineLine1} {draft.hero.headlineLine2}
                        </div>
                      </div>
                      <span className="relative z-[2] border border-black/15 bg-white/90 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase text-[#18181b]">
                        {draft.hero.backdropMode === 'photo-cover'
                          ? `Foto/Video (${draft.hero.backdropOpacity ?? 82}%)`
                          : draft.hero.backdropMode === 'solid-gradient'
                            ? 'Warna / Gradasi'
                            : 'Studio Glow + Grid'}
                      </span>
                    </div>

                    {/* Pemilih Mode Latar */}
                    <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {(
                        [
                          ['studio-glow', 'Studio Glow + Grid', 'Bersih, terang/gelap sesuai tema dengan pendaran studio'],
                          ['photo-cover', 'Foto / Video Latar', 'Tampilkan foto atau video penuh di belakang teks hero'],
                          ['solid-gradient', 'Warna / Gradasi Kustom', 'Atur warna solid atau gradasi dua warna khusus'],
                        ] as [HeroBackdropMode, string, string][]
                      ).map(([mode, title, desc]) => {
                        const active = (draft.hero.backdropMode ?? 'studio-glow') === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() =>
                              setDraft((p) => ({
                                ...p,
                                hero: { ...p.hero, backdropMode: mode },
                              }))
                            }
                            className={`border p-3 text-left transition-colors ${
                              active
                                ? 'border-[#18181b] bg-[#18181b] text-white'
                                : 'border-[#d4d4d8] bg-[#fafafa] text-[#18181b] hover:border-[#18181b]'
                            }`}
                          >
                            <div className="text-xs font-semibold">{title}</div>
                            <div
                              className={`mt-0.5 text-[11px] leading-snug ${
                                active ? 'text-white/80' : 'text-[#71717a]'
                              }`}
                            >
                              {desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Unggah Foto / Video Latar + Opasitas */}
                    <div className="mb-5 grid grid-cols-1 gap-4 border border-[#e4e4e7] bg-[#fafafa] p-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="mb-1.5 block text-xs font-semibold text-[#18181b]">
                          File Foto / Video Latar Hero (PNG, JPG, WebP, GIF, SVG, MP4, WebM, MOV)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="text"
                            value={draft.hero.imageUrl}
                            placeholder="Tempel URL foto/video atau klik Unggah File..."
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraft((p) => ({
                                ...p,
                                hero: {
                                  ...p.hero,
                                  imageUrl: val,
                                  ...(looksLikeVideoUrl(val) ? { mediaType: 'video' } : {}),
                                },
                              }));
                            }}
                            className="min-w-[200px] flex-1 border border-[#d4d4d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                          />
                          <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 border border-[#18181b] bg-[#18181b] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#27272a]">
                            <Upload className="h-3.5 w-3.5" />
                            {uploadingTarget === 'heroBg' ? 'Mengunggah...' : 'Unggah Latar'}
                            <input
                              type="file"
                              accept={ACCEPTED_MEDIA_TYPES}
                              onChange={(e) =>
                                handleSingleUpload(e, 'heroBg', (url, mediaType) =>
                                  setDraft((p) => ({
                                    ...p,
                                    hero: {
                                      ...p.hero,
                                      backdropMode: 'photo-cover',
                                      imageUrl: url,
                                      mediaType,
                                    },
                                  })),
                                )
                              }
                              className="sr-only"
                            />
                          </label>
                          {draft.hero.imageUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setDraft((p) => ({
                                  ...p,
                                  hero: { ...p.hero, imageUrl: '', backdropMode: 'studio-glow' },
                                }))
                              }
                              className="border border-[#d4d4d8] bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Kosongkan
                            </button>
                          )}
                        </div>
                        <p className="m-0 mt-1.5 text-[11px] text-[#71717a]">
                          Mengunggah foto/video baru otomatis mengaktifkan mode <strong>Foto / Video Latar</strong>.
                        </p>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Jenis Media Latar
                        </label>
                        <select
                          value={draft.hero.mediaType}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              hero: { ...p.hero, mediaType: e.target.value as MediaType },
                            }))
                          }
                          className="w-full border border-[#d4d4d8] bg-white px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                        >
                          <option value="image">Foto / Gambar</option>
                          <option value="video">Video Putar Otomatis (MP4/WebM/MOV)</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Kejelasan Foto / Video Latar ({draft.hero.backdropOpacity ?? 82}%)
                        </label>
                        <input
                          type="range"
                          min={10}
                          max={100}
                          value={draft.hero.backdropOpacity ?? 82}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              hero: { ...p.hero, backdropOpacity: Number(e.target.value) },
                            }))
                          }
                          className="mt-2 w-full cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Lapisan Kontras Teks (Agar Tulisan Tetap Jelas)
                        </label>
                        <select
                          value={draft.hero.textContrast ?? 'dark-scrim'}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              hero: {
                                ...p.hero,
                                textContrast: e.target.value as
                                  | 'dark-scrim'
                                  | 'light-scrim'
                                  | 'card'
                                  | 'none',
                              },
                            }))
                          }
                          className="w-full border border-[#d4d4d8] bg-white px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                        >
                          <option value="dark-scrim">Lapisan Gelap + Teks Putih (Rekomendasi Foto)</option>
                          <option value="light-scrim">Lapisan Terang + Teks Hitam</option>
                          <option value="card">Kotak Pelindung Di Belakang Teks</option>
                          <option value="none">Tanpa Lapisan Tambahan</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Ketebalan Lapisan Overlay ({draft.hero.overlayOpacity ?? 48}%)
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={90}
                          value={draft.hero.overlayOpacity ?? 48}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              hero: { ...p.hero, overlayOpacity: Number(e.target.value) },
                            }))
                          }
                          className="mt-2 w-full cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Warna Latar, Cahaya Glow & Grid Informatika */}
                    <div className="grid grid-cols-1 gap-4 border border-[#e4e4e7] bg-[#fafafa] p-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Warna Latar Hero Khusus
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={draft.hero.backgroundColor || draft.colors.paper}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                hero: { ...p.hero, backgroundColor: e.target.value },
                              }))
                            }
                            className="h-9 w-12 cursor-pointer border border-[#d4d4d8] bg-white p-0.5"
                          />
                          <span className="flex-1 font-mono text-[11px] text-[#52525b]">
                            {draft.hero.backgroundColor || 'Ikut Tema'}
                          </span>
                          {draft.hero.backgroundColor && (
                            <button
                              type="button"
                              onClick={() =>
                                setDraft((p) => ({
                                  ...p,
                                  hero: { ...p.hero, backgroundColor: '' },
                                }))
                              }
                              className="border border-[#d4d4d8] bg-white px-2 py-1 text-[10px]"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Warna Kedua (Mode Gradasi)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={draft.hero.backgroundGradientColor || draft.colors.paperAlt}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                hero: {
                                  ...p.hero,
                                  backgroundColor: p.hero.backgroundColor || p.colors.paper,
                                  backgroundGradientColor: e.target.value,
                                  backdropMode: 'solid-gradient',
                                },
                              }))
                            }
                            className="h-9 w-12 cursor-pointer border border-[#d4d4d8] bg-white p-0.5"
                          />
                          <span className="flex-1 font-mono text-[11px] text-[#52525b]">
                            {draft.hero.backgroundGradientColor || 'Belum dipilih'}
                          </span>
                          {draft.hero.backgroundGradientColor && (
                            <button
                              type="button"
                              onClick={() =>
                                setDraft((p) => ({
                                  ...p,
                                  hero: { ...p.hero, backgroundGradientColor: '' },
                                }))
                              }
                              className="border border-[#d4d4d8] bg-white px-2 py-1 text-[10px]"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Warna Cahaya Studio Glow
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={draft.hero.glowColor || draft.colors.accent}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                hero: { ...p.hero, glowColor: e.target.value },
                              }))
                            }
                            className="h-9 w-12 cursor-pointer border border-[#d4d4d8] bg-white p-0.5"
                          />
                          <span className="flex-1 font-mono text-[11px] text-[#52525b]">
                            {draft.hero.glowColor || 'Ikut Aksen'}
                          </span>
                          {draft.hero.glowColor && (
                            <button
                              type="button"
                              onClick={() =>
                                setDraft((p) => ({
                                  ...p,
                                  hero: { ...p.hero, glowColor: '' },
                                }))
                              }
                              className="border border-[#d4d4d8] bg-white px-2 py-1 text-[10px]"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Intensitas Cahaya Glow ({draft.hero.glowIntensity ?? 32}%)
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={draft.hero.glowIntensity ?? 32}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              hero: { ...p.hero, glowIntensity: Number(e.target.value) },
                            }))
                          }
                          className="mt-2 w-full cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label className="text-xs font-medium text-[#3f3f46]">
                            Grid Informatika
                          </label>
                          <label className="inline-flex items-center gap-1.5 text-xs text-[#18181b]">
                            <input
                              type="checkbox"
                              checked={draft.hero.showGrid !== false}
                              onChange={(e) =>
                                setDraft((p) => ({
                                  ...p,
                                  hero: { ...p.hero, showGrid: e.target.checked },
                                }))
                              }
                            />
                            Tampilkan
                          </label>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          disabled={draft.hero.showGrid === false}
                          value={draft.hero.gridOpacity ?? 42}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              hero: { ...p.hero, gridOpacity: Number(e.target.value) },
                            }))
                          }
                          className="mt-2 w-full cursor-pointer disabled:opacity-40"
                        />
                        <div className="mt-0.5 text-[10px] text-[#71717a]">
                          Ketajaman garis grid ({draft.hero.gridOpacity ?? 42}%)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[#e4e4e7] pt-5 md:col-span-2">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="m-0 text-sm font-semibold text-[#18181b]">
                          Teks Tambahan di Area Hero (Kiri)
                        </h3>
                        <p className="m-0 mt-0.5 text-xs text-[#71717a]">
                          Tambahkan teks khusus di sisi kiri Hero, misalnya FOTOFOLIO USAT JALUNG.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newItem: HeroExtraText = {
                            id: `hero-extra-${Date.now().toString(36)}`,
                            text: 'FOTOFOLIO USAT JALUNG',
                            variant: 'tag',
                          };
                          setDraft((p) => ({
                            ...p,
                            hero: {
                              ...p.hero,
                              extraTexts: [...(p.hero.extraTexts ?? []), newItem],
                            },
                          }));
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 border border-[#18181b] bg-[#18181b] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#27272a]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Tambah Teks Hero
                      </button>
                    </div>

                    {(draft.hero.extraTexts ?? []).length === 0 ? (
                      <p className="m-0 text-xs italic text-[#71717a]">
                        Belum ada teks tambahan di Hero. Klik "Tambah Teks Hero" untuk menambahkannya.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {(draft.hero.extraTexts ?? []).map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex flex-col gap-2 border border-[#e4e4e7] bg-[#fafafa] p-3 sm:flex-row sm:items-center"
                          >
                            <input
                              type="text"
                              value={item.text}
                              placeholder="Contoh: FOTOFOLIO USAT JALUNG"
                              onChange={(e) => {
                                const val = e.target.value;
                                setDraft((p) => ({
                                  ...p,
                                  hero: {
                                    ...p.hero,
                                    extraTexts: (p.hero.extraTexts ?? []).map((t, i) =>
                                      i === idx ? { ...t, text: val } : t,
                                    ),
                                  },
                                }));
                              }}
                              className="flex-1 border border-[#d4d4d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                            />
                            <select
                              value={item.variant}
                              onChange={(e) => {
                                const variant = e.target.value as HeroExtraText['variant'];
                                setDraft((p) => ({
                                  ...p,
                                  hero: {
                                    ...p.hero,
                                    extraTexts: (p.hero.extraTexts ?? []).map((t, i) =>
                                      i === idx ? { ...t, variant } : t,
                                    ),
                                  },
                                }));
                              }}
                              className="border border-[#d4d4d8] bg-white px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                            >
                              <option value="tag">Label Aksen (Besar/Kapital)</option>
                              <option value="heading">Judul Tambahan</option>
                              <option value="body">Paragraf Pendek</option>
                            </select>
                            <button
                              type="button"
                              aria-label="Hapus teks hero"
                              onClick={() =>
                                setDraft((p) => ({
                                  ...p,
                                  hero: {
                                    ...p.hero,
                                    extraTexts: (p.hero.extraTexts ?? []).filter((_, i) => i !== idx),
                                  },
                                }))
                              }
                              className="inline-flex shrink-0 items-center justify-center border border-[#d4d4d8] bg-white p-2 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-5 mt-0 text-lg font-semibold text-[#18181b]">
                  Tentang Saya & Info Profil
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        Judul Tentang
                      </label>
                      <input
                        type="text"
                        value={draft.about.title}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, about: { ...p.about, title: e.target.value } }))
                        }
                        className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        Eyebrow Tentang
                      </label>
                      <input
                        type="text"
                        value={draft.about.eyebrow}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, about: { ...p.about, eyebrow: e.target.value } }))
                        }
                        className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Kutipan Utama
                    </label>
                    <textarea
                      rows={2}
                      value={draft.about.statement}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, about: { ...p.about, statement: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Biografi Lengkap
                    </label>
                    <textarea
                      rows={3}
                      value={draft.about.description}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, about: { ...p.about, description: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>

                  <div className="border-t border-[#f4f4f5] pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#52525b]">
                        Ringkasan Profil
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((p) => ({
                            ...p,
                            about: {
                              ...p.about,
                              facts: [...p.about.facts, { label: 'Info Baru', value: 'Isi detail' }],
                            },
                          }))
                        }
                        className="inline-flex items-center gap-1 border border-[#d4d4d8] bg-white px-2.5 py-1 text-xs font-medium hover:bg-[#f4f4f5]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Tambah Baris
                      </button>
                    </div>
                    <div className="space-y-2">
                      {draft.about.facts.map((fact, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                          <input
                            type="text"
                            value={fact.label}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                about: {
                                  ...p.about,
                                  facts: p.about.facts.map((f, i) =>
                                    i === idx ? { ...f, label: e.target.value } : f,
                                  ),
                                },
                              }))
                            }
                            placeholder="Label"
                            className="border border-[#d4d4d8] px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                          />
                          <input
                            type="text"
                            value={fact.value}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                about: {
                                  ...p.about,
                                  facts: p.about.facts.map((f, i) =>
                                    i === idx ? { ...f, value: e.target.value } : f,
                                  ),
                                },
                              }))
                            }
                            placeholder="Nilai"
                            className="border border-[#d4d4d8] px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((p) => ({
                                ...p,
                                about: {
                                  ...p.about,
                                  facts: p.about.facts.filter((_, i) => i !== idx),
                                },
                              }))
                            }
                            className="border border-[#e4e4e7] bg-white px-2.5 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#f4f4f5] pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#52525b]">
                        Statistik Angka Utama (Metrik Hero Tentang)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((p) => ({
                            ...p,
                            about: {
                              ...p.about,
                              stats: [...(p.about.stats ?? []), { value: '10+', label: 'Pencapaian Baru' }],
                            },
                          }))
                        }
                        className="inline-flex items-center gap-1 border border-[#d4d4d8] bg-white px-2.5 py-1 text-xs font-medium hover:bg-[#f4f4f5]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Tambah Metrik
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(draft.about.stats ?? []).map((stat, idx) => (
                        <div key={idx} className="grid grid-cols-[120px_1fr_auto] gap-2">
                          <input
                            type="text"
                            value={stat.value}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                about: {
                                  ...p.about,
                                  stats: (p.about.stats ?? []).map((s, i) =>
                                    i === idx ? { ...s, value: e.target.value } : s,
                                  ),
                                },
                              }))
                            }
                            placeholder="Contoh: 24+"
                            className="border border-[#d4d4d8] px-3 py-2 font-mono text-xs font-semibold outline-none focus:border-[#18181b]"
                          />
                          <input
                            type="text"
                            value={stat.label}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                about: {
                                  ...p.about,
                                  stats: (p.about.stats ?? []).map((s, i) =>
                                    i === idx ? { ...s, label: e.target.value } : s,
                                  ),
                                },
                              }))
                            }
                            placeholder="Label Metrik"
                            className="border border-[#d4d4d8] px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((p) => ({
                                ...p,
                                about: {
                                  ...p.about,
                                  stats: (p.about.stats ?? []).filter((_, i) => i !== idx),
                                },
                              }))
                            }
                            className="border border-[#e4e4e7] bg-white px-2.5 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#f4f4f5] pt-4 space-y-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#52525b]">
                      Kartu Kode Informatika & Foto Showcase Tentang
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Judul File Terminal Kode
                        </label>
                        <input
                          type="text"
                          value={draft.about.codeTitle ?? ''}
                          placeholder="usat-jalung.ts — informatics.profile"
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              about: { ...p.about, codeTitle: e.target.value },
                            }))
                          }
                          className="w-full border border-[#d4d4d8] px-3 py-2 font-mono text-xs outline-none focus:border-[#18181b]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                          Foto Workstation / Tambahan Tentang (opsional)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={draft.about.showcaseImageUrl ?? ''}
                            placeholder="Kosongkan untuk tampilkan Terminal Kode"
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                about: { ...p.about, showcaseImageUrl: e.target.value },
                              }))
                            }
                            className="flex-1 border border-[#d4d4d8] px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                          />
                          <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 border border-[#d4d4d8] bg-[#fafafa] px-3 py-2 text-xs font-medium hover:bg-[#f4f4f5]">
                            <Upload className="h-3.5 w-3.5" />
                            {uploadingTarget === 'aboutShowcase' ? '...' : 'Unggah'}
                            <input
                              type="file"
                              accept={ACCEPTED_IMAGE_TYPES}
                              onChange={(e) =>
                                handleSingleUpload(e, 'aboutShowcase', (url) =>
                                  setDraft((p) => ({
                                    ...p,
                                    about: { ...p.about, showcaseImageUrl: url },
                                  })),
                                )
                              }
                              className="sr-only"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        Baris Kode Terminal (Satu baris kode per baris)
                      </label>
                      <textarea
                        rows={6}
                        value={(draft.about.codeLines ?? []).join('\n')}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            about: { ...p.about, codeLines: e.target.value.split('\n') },
                          }))
                        }
                        className="w-full border border-[#d4d4d8] bg-[#18181b] px-3 py-2.5 font-mono text-xs leading-relaxed text-[#f4f1eb] outline-none focus:border-[#18181b]"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="m-0 text-lg font-semibold text-[#18181b]">
                      Tambah Blok Teks di Halaman Utama
                    </h2>
                    <p className="m-0 mt-1 text-xs text-[#71717a]">
                      Sisipkan bagian teks tambahan (pengalaman, catatan, layanan, atau pengumuman) langsung ke halaman utama.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddExtraBlock}
                    className="inline-flex items-center gap-1.5 border-0 bg-[#18181b] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-[#27272a]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Teks
                  </button>
                </div>

                {draft.extraBlocks.length === 0 ? (
                  <p className="m-0 border border-dashed border-[#d4d4d8] py-8 text-center text-xs text-[#71717a]">
                    Belum ada blok teks tambahan. Klik &ldquo;Tambah Teks&rdquo; untuk menyisipkan teks baru ke halaman utama.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {draft.extraBlocks.map((block) => (
                      <div key={block.id} className="border border-[#e4e4e7] bg-[#fafafa] p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <label className="inline-flex items-center gap-2 text-xs font-medium">
                            <input
                              type="checkbox"
                              checked={block.visible}
                              onChange={(e) =>
                                setDraft((p) => ({
                                  ...p,
                                  extraBlocks: p.extraBlocks.map((b) =>
                                    b.id === block.id ? { ...b, visible: e.target.checked } : b,
                                  ),
                                }))
                              }
                            />
                            Tampilkan di Halaman Utama
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((p) => ({
                                ...p,
                                extraBlocks: p.extraBlocks.filter((b) => b.id !== block.id),
                              }))
                            }
                            className="inline-flex items-center gap-1 border border-red-200 bg-white px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <input
                            type="text"
                            value={block.eyebrow}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                extraBlocks: p.extraBlocks.map((b) =>
                                  b.id === block.id ? { ...b, eyebrow: e.target.value } : b,
                                ),
                              }))
                            }
                            placeholder="Label kecil (Eyebrow)"
                            className="border border-[#d4d4d8] bg-white px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                          />
                          <input
                            type="text"
                            value={block.title}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                extraBlocks: p.extraBlocks.map((b) =>
                                  b.id === block.id ? { ...b, title: e.target.value } : b,
                                ),
                              }))
                            }
                            placeholder="Judul blok teks"
                            className="border border-[#d4d4d8] bg-white px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                          />
                          <select
                            value={block.placement}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                extraBlocks: p.extraBlocks.map((b) =>
                                  b.id === block.id
                                    ? { ...b, placement: e.target.value as ExtraBlockPlacement }
                                    : b,
                                ),
                              }))
                            }
                            className="border border-[#d4d4d8] bg-white px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                          >
                            {PLACEMENT_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                Posisi: {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <textarea
                          rows={3}
                          value={block.body}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              extraBlocks: p.extraBlocks.map((b) =>
                                b.id === block.id ? { ...b, body: e.target.value } : b,
                              ),
                            }))
                          }
                          placeholder="Isi paragraf teks..."
                          className="mt-3 w-full border border-[#d4d4d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-5 mt-0 text-lg font-semibold text-[#18181b]">
                  Kontak & Tautan Sosial
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Eyebrow Kontak
                    </label>
                    <input
                      type="text"
                      value={draft.contact.eyebrow}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, contact: { ...p.contact, eyebrow: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Judul Kontak
                    </label>
                    <input
                      type="text"
                      value={draft.contact.title}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, contact: { ...p.contact, title: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Deskripsi Kontak
                    </label>
                    <textarea
                      rows={2}
                      value={draft.contact.description}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          contact: { ...p.contact, description: e.target.value },
                        }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Email
                    </label>
                    <input
                      type="email"
                      value={draft.contact.email}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, contact: { ...p.contact, email: e.target.value } }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Lokasi
                    </label>
                    <input
                      type="text"
                      value={draft.contact.location}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          contact: { ...p.contact, location: e.target.value },
                        }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Teks Hak Cipta Footer
                    </label>
                    <input
                      type="text"
                      value={draft.footerCopyright}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, footerCopyright: e.target.value }))
                      }
                      className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-[#3f3f46]">Tautan Sosial</span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((p) => ({
                            ...p,
                            contact: {
                              ...p.contact,
                              socials: [...p.contact.socials, { label: 'GitHub', url: 'https://' }],
                            },
                          }))
                        }
                        className="inline-flex items-center gap-1 border border-[#d4d4d8] bg-white px-2.5 py-1 text-xs hover:bg-[#f4f4f5]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Tambah Tautan
                      </button>
                    </div>
                    <div className="space-y-2">
                      {draft.contact.socials.map((soc, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_1.6fr_auto] gap-2">
                          <input
                            type="text"
                            value={soc.label}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                contact: {
                                  ...p.contact,
                                  socials: p.contact.socials.map((s, i) =>
                                    i === idx ? { ...s, label: e.target.value } : s,
                                  ),
                                },
                              }))
                            }
                            placeholder="Nama (GitHub, IG...)"
                            className="border border-[#d4d4d8] px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                          />
                          <input
                            type="text"
                            value={soc.url}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                contact: {
                                  ...p.contact,
                                  socials: p.contact.socials.map((s, i) =>
                                    i === idx ? { ...s, url: e.target.value } : s,
                                  ),
                                },
                              }))
                            }
                            placeholder="https://..."
                            className="border border-[#d4d4d8] px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((p) => ({
                                ...p,
                                contact: {
                                  ...p.contact,
                                  socials: p.contact.socials.filter((_, i) => i !== idx),
                                },
                              }))
                            }
                            className="border border-[#e4e4e7] bg-white px-2.5 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-2 mt-0 text-lg font-semibold text-[#18181b]">
                  Semua Label Tombol, Filter & Pesan Sistem
                </h2>
                <p className="mb-5 mt-0 text-xs text-[#71717a]">
                  Ubah seluruh teks tombol, label filter, awalan ID sertifikat, dan pesan kosong di seluruh halaman website.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(
                    [
                      ['skillsCountSuffix', 'Akhiran Jumlah Program'],
                      ['projectsViewLabel', 'Teks Tautan Proyek'],
                      ['projectsEmptyText', 'Pesan Proyek Kosong'],
                      ['certificatesVerifyLabel', 'Tombol Verifikasi Sertifikat'],
                      ['certificatesIdPrefix', 'Awalan ID Sertifikat'],
                      ['certificatesEmptyText', 'Pesan Sertifikat Kosong'],
                      ['workAllFilterLabel', 'Filter Kategori Semua (Galeri)'],
                      ['workEmptyText', 'Pesan Galeri Kosong'],
                      ['contactCopyLabel', 'Tombol Salin Email'],
                      ['contactCopiedLabel', 'Status Email Tersalin'],
                      ['contactFormToggleLabel', 'Tombol Buka Form Pesan'],
                      ['contactFormHeading', 'Judul Form Pesan'],
                      ['contactFormSubheading', 'Subjudul Form Pesan'],
                      ['contactFormSubmitLabel', 'Tombol Kirim Form Pesan'],
                      ['footerBackToTopLabel', 'Tombol Kembali ke Atas (Footer)'],
                      ['pageBackLabel', 'Tombol Kembali (Halaman Kustom)'],
                      ['pageRelatedGalleryLabel', 'Judul Galeri Terkait (Halaman Kustom)'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        {label}
                      </label>
                      <input
                        type="text"
                        value={draft.uiLabels?.[key] ?? ''}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            uiLabels: { ...p.uiLabels, [key]: e.target.value },
                          }))
                        }
                        className="w-full border border-[#d4d4d8] px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-8">
              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-4 mt-0 text-base font-semibold text-[#18181b]">
                  Judul & Keterangan Bagian Keahlian
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <input
                    type="text"
                    value={draft.skillsEyebrow}
                    onChange={(e) => setDraft((p) => ({ ...p, skillsEyebrow: e.target.value }))}
                    placeholder="Eyebrow"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                  <input
                    type="text"
                    value={draft.skillsTitle}
                    onChange={(e) => setDraft((p) => ({ ...p, skillsTitle: e.target.value }))}
                    placeholder="Judul Utama"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                  <input
                    type="text"
                    value={draft.skillsNote}
                    onChange={(e) => setDraft((p) => ({ ...p, skillsNote: e.target.value }))}
                    placeholder="Catatan singkat bagian keahlian"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                  <input
                    type="text"
                    value={draft.programsTitle}
                    onChange={(e) => setDraft((p) => ({ ...p, programsTitle: e.target.value }))}
                    placeholder="Judul Sub-bagian Program"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                </div>
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="m-0 text-lg font-semibold text-[#18181b]">
                      Keahlian Informatika
                    </h2>
                    <p className="m-0 mt-1 text-xs text-[#71717a]">
                      Kelompokkan kemampuan utama Anda sebagai anak Informatika dan kreator visual.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSkillGroup}
                    className="inline-flex items-center gap-1.5 border-0 bg-[#18181b] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Keahlian
                  </button>
                </div>

                <div className="space-y-4">
                  {draft.skills.map((skill) => (
                    <div key={skill.id} className="border border-[#e4e4e7] bg-[#fafafa] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <input
                          type="text"
                          value={skill.title}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              skills: p.skills.map((s) =>
                                s.id === skill.id ? { ...s, title: e.target.value } : s,
                              ),
                            }))
                          }
                          className="flex-1 border border-[#d4d4d8] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#18181b]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((p) => ({
                              ...p,
                              skills: p.skills.filter((s) => s.id !== skill.id),
                            }))
                          }
                          className="border border-red-200 bg-white p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={skill.summary}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            skills: p.skills.map((s) =>
                              s.id === skill.id ? { ...s, summary: e.target.value } : s,
                            ),
                          }))
                        }
                        className="mb-3 w-full border border-[#d4d4d8] bg-white px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                      />
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-[#52525b]">
                          Daftar Poin (pisahkan dengan koma)
                        </label>
                        <input
                          type="text"
                          value={skill.items.join(', ')}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              skills: p.skills.map((s) =>
                                s.id === skill.id
                                  ? {
                                      ...s,
                                      items: e.target.value
                                        .split(',')
                                        .map((x) => x.trim())
                                        .filter(Boolean),
                                    }
                                  : s,
                              ),
                            }))
                          }
                          className="w-full border border-[#d4d4d8] bg-white px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-2 mt-0 text-lg font-semibold text-[#18181b]">
                  Program, Bahasa & Alat yang Dikuasai
                </h2>
                <p className="mb-5 mt-0 text-xs text-[#71717a]">
                  Tambahkan bahasa pemrograman, framework, basis data, IDE, atau software yang Anda kuasai.
                </p>

                <form onSubmit={handleAddProgram} className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <input
                    type="text"
                    value={newProgName}
                    onChange={(e) => setNewProgName(e.target.value)}
                    placeholder="Nama program (contoh: Laravel)"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                  <input
                    type="text"
                    value={newProgCategory}
                    onChange={(e) => setNewProgCategory(e.target.value)}
                    placeholder="Kategori (Backend, IDE...)"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                  <input
                    type="text"
                    value={newProgLevel}
                    onChange={(e) => setNewProgLevel(e.target.value)}
                    placeholder="Tingkat (Mahir, Menengah)"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1.5 border-0 bg-[#18181b] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Program
                  </button>
                </form>

                <div className="divide-y divide-[#e4e4e7] border-t border-[#e4e4e7]">
                  {draft.programs.map((prog) => (
                    <div
                      key={prog.id}
                      className="grid grid-cols-1 items-center gap-2 py-2.5 sm:grid-cols-[1.2fr_1fr_0.8fr_auto]"
                    >
                      <input
                        type="text"
                        value={prog.name}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            programs: p.programs.map((item) =>
                              item.id === prog.id ? { ...item, name: e.target.value } : item,
                            ),
                          }))
                        }
                        className="border border-[#d4d4d8] px-3 py-1.5 text-xs font-medium outline-none focus:border-[#18181b]"
                      />
                      <input
                        type="text"
                        value={prog.category}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            programs: p.programs.map((item) =>
                              item.id === prog.id ? { ...item, category: e.target.value } : item,
                            ),
                          }))
                        }
                        className="border border-[#d4d4d8] px-3 py-1.5 text-xs outline-none focus:border-[#18181b]"
                      />
                      <input
                        type="text"
                        value={prog.level}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            programs: p.programs.map((item) =>
                              item.id === prog.id ? { ...item, level: e.target.value } : item,
                            ),
                          }))
                        }
                        className="border border-[#d4d4d8] px-3 py-1.5 text-xs outline-none focus:border-[#18181b]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((p) => ({
                            ...p,
                            programs: p.programs.filter((item) => item.id !== prog.id),
                          }))
                        }
                        className="border border-[#e4e4e7] bg-white p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-6">
              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-4 mt-0 text-base font-semibold text-[#18181b]">
                  Judul & Keterangan Bagian Proyek
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <input
                    type="text"
                    value={draft.projectsEyebrow}
                    onChange={(e) => setDraft((p) => ({ ...p, projectsEyebrow: e.target.value }))}
                    placeholder="Eyebrow"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                  <input
                    type="text"
                    value={draft.projectsTitle}
                    onChange={(e) => setDraft((p) => ({ ...p, projectsTitle: e.target.value }))}
                    placeholder="Judul Utama"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                  <input
                    type="text"
                    value={draft.projectsNote}
                    onChange={(e) => setDraft((p) => ({ ...p, projectsNote: e.target.value }))}
                    placeholder="Catatan singkat"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                </div>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3 border border-[#e4e4e7] bg-white p-6">
                <div>
                  <h2 className="m-0 text-lg font-semibold text-[#18181b]">
                    Proyek yang Dikerjakan ({draft.projects.length})
                  </h2>
                  <p className="m-0 mt-1 text-xs text-[#71717a]">
                    Tambahkan proyek aplikasi, website, atau tugas akhir lengkap dengan foto/video pratinjau.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddProject}
                  className="inline-flex items-center gap-1.5 border-0 bg-[#18181b] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Proyek
                </button>
              </div>

              {draft.projects.map((project, index) => (
                <section key={project.id} className="border border-[#e4e4e7] bg-white p-6">
                  <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#f4f4f5] pb-3">
                    <h3 className="m-0 text-base font-semibold text-[#18181b]">{project.title}</h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() =>
                          setDraft((p) => {
                            const next = [...p.projects];
                            const [m] = next.splice(index, 1);
                            next.splice(index - 1, 0, m);
                            return { ...p, projects: next };
                          })
                        }
                        className="border border-[#e4e4e7] bg-white p-1.5 text-[#52525b] disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === draft.projects.length - 1}
                        onClick={() =>
                          setDraft((p) => {
                            const next = [...p.projects];
                            const [m] = next.splice(index, 1);
                            next.splice(index + 1, 0, m);
                            return { ...p, projects: next };
                          })
                        }
                        className="border border-[#e4e4e7] bg-white p-1.5 text-[#52525b] disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((p) => ({
                            ...p,
                            projects: p.projects.filter((item) => item.id !== project.id),
                          }))
                        }
                        className="inline-flex items-center gap-1 border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <input
                      type="text"
                      value={project.title}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          projects: p.projects.map((item) =>
                            item.id === project.id ? { ...item, title: e.target.value } : item,
                          ),
                        }))
                      }
                      placeholder="Judul Proyek"
                      className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                    <input
                      type="text"
                      value={project.role}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          projects: p.projects.map((item) =>
                            item.id === project.id ? { ...item, role: e.target.value } : item,
                          ),
                        }))
                      }
                      placeholder="Peran (Full-Stack Developer)"
                      className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                    <input
                      type="text"
                      value={project.year}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          projects: p.projects.map((item) =>
                            item.id === project.id ? { ...item, year: e.target.value } : item,
                          ),
                        }))
                      }
                      placeholder="Tahun"
                      className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />

                    <div className="md:col-span-3">
                      <textarea
                        rows={2}
                        value={project.summary}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            projects: p.projects.map((item) =>
                              item.id === project.id ? { ...item, summary: e.target.value } : item,
                            ),
                          }))
                        }
                        placeholder="Deskripsi singkat proyek..."
                        className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-[#52525b]">
                        Teknologi (pisahkan koma)
                      </label>
                      <input
                        type="text"
                        value={project.techStack.join(', ')}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            projects: p.projects.map((item) =>
                              item.id === project.id
                                ? {
                                    ...item,
                                    techStack: e.target.value
                                      .split(',')
                                      .map((t) => t.trim())
                                      .filter(Boolean),
                                  }
                                : item,
                            ),
                          }))
                        }
                        className="w-full border border-[#d4d4d8] px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-[#52525b]">
                        Tautan Proyek (opsional)
                      </label>
                      <input
                        type="text"
                        value={project.linkUrl}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            projects: p.projects.map((item) =>
                              item.id === project.id ? { ...item, linkUrl: e.target.value } : item,
                            ),
                          }))
                        }
                        placeholder="https://github.com/..."
                        className="w-full border border-[#d4d4d8] px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-[#52525b]">
                        Foto / Video Proyek
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={project.imageUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraft((p) => ({
                              ...p,
                              projects: p.projects.map((item) =>
                                item.id === project.id
                                  ? {
                                      ...item,
                                      imageUrl: val,
                                      ...(looksLikeVideoUrl(val) ? { mediaType: 'video' } : {}),
                                    }
                                  : item,
                              ),
                            }));
                          }}
                          placeholder="URL atau unggah"
                          className="flex-1 border border-[#d4d4d8] px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                        />
                        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 border border-[#d4d4d8] bg-[#fafafa] px-2.5 py-2 text-xs font-medium hover:bg-[#f4f4f5]">
                          <Upload className="h-3.5 w-3.5" />
                          {uploadingTarget === `proj-${project.id}` ? '...' : 'Unggah'}
                          <input
                            type="file"
                            accept={ACCEPTED_MEDIA_TYPES}
                            onChange={(e) =>
                              handleSingleUpload(e, `proj-${project.id}`, (url, mediaType) =>
                                setDraft((p) => ({
                                  ...p,
                                  projects: p.projects.map((item) =>
                                    item.id === project.id
                                      ? { ...item, imageUrl: url, mediaType }
                                      : item,
                                  ),
                                })),
                              )
                            }
                            className="sr-only"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}

          {activeTab === 'certificates' && (
            <div className="space-y-6">
              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-4 mt-0 text-base font-semibold text-[#18181b]">
                  Judul & Keterangan Bagian Sertifikat
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <input
                    type="text"
                    value={draft.certificatesEyebrow}
                    onChange={(e) => setDraft((p) => ({ ...p, certificatesEyebrow: e.target.value }))}
                    placeholder="Eyebrow"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                  <input
                    type="text"
                    value={draft.certificatesTitle}
                    onChange={(e) => setDraft((p) => ({ ...p, certificatesTitle: e.target.value }))}
                    placeholder="Judul Utama"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                  <input
                    type="text"
                    value={draft.certificatesNote}
                    onChange={(e) => setDraft((p) => ({ ...p, certificatesNote: e.target.value }))}
                    placeholder="Catatan singkat"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                </div>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3 border border-[#e4e4e7] bg-white p-6">
                <div>
                  <h2 className="m-0 text-lg font-semibold text-[#18181b]">
                    Sertifikat & Pencapaian ({draft.certificates.length})
                  </h2>
                  <p className="m-0 mt-1 text-xs text-[#71717a]">
                    Unggah foto/scan sertifikat (PNG, JPG, WebP, SVG, HEIC) langsung dari perangkat Anda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCertificate}
                  className="inline-flex items-center gap-1.5 border-0 bg-[#18181b] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Sertifikat
                </button>
              </div>

              {draft.certificates.map((cert, index) => (
                <section key={cert.id} className="border border-[#e4e4e7] bg-white p-6">
                  <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#f4f4f5] pb-3">
                    <h3 className="m-0 text-base font-semibold text-[#18181b]">{cert.title}</h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() =>
                          setDraft((p) => {
                            const next = [...p.certificates];
                            const [m] = next.splice(index, 1);
                            next.splice(index - 1, 0, m);
                            return { ...p, certificates: next };
                          })
                        }
                        className="border border-[#e4e4e7] bg-white p-1.5 text-[#52525b] disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === draft.certificates.length - 1}
                        onClick={() =>
                          setDraft((p) => {
                            const next = [...p.certificates];
                            const [m] = next.splice(index, 1);
                            next.splice(index + 1, 0, m);
                            return { ...p, certificates: next };
                          })
                        }
                        className="border border-[#e4e4e7] bg-white p-1.5 text-[#52525b] disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((p) => ({
                            ...p,
                            certificates: p.certificates.filter((item) => item.id !== cert.id),
                          }))
                        }
                        className="inline-flex items-center gap-1 border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <input
                      type="text"
                      value={cert.title}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          certificates: p.certificates.map((item) =>
                            item.id === cert.id ? { ...item, title: e.target.value } : item,
                          ),
                        }))
                      }
                      placeholder="Nama Sertifikat"
                      className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                    <input
                      type="text"
                      value={cert.issuer}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          certificates: p.certificates.map((item) =>
                            item.id === cert.id ? { ...item, issuer: e.target.value } : item,
                          ),
                        }))
                      }
                      placeholder="Penerbit (Dicoding, Kampus, Google...)"
                      className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                    <input
                      type="text"
                      value={cert.year}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          certificates: p.certificates.map((item) =>
                            item.id === cert.id ? { ...item, year: e.target.value } : item,
                          ),
                        }))
                      }
                      placeholder="Tahun"
                      className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                    <input
                      type="text"
                      value={cert.credentialId}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          certificates: p.certificates.map((item) =>
                            item.id === cert.id ? { ...item, credentialId: e.target.value } : item,
                          ),
                        }))
                      }
                      placeholder="Nomor / ID Kredensial (opsional)"
                      className="border border-[#d4d4d8] px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                    />
                    <input
                      type="text"
                      value={cert.verifyUrl}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          certificates: p.certificates.map((item) =>
                            item.id === cert.id ? { ...item, verifyUrl: e.target.value } : item,
                          ),
                        }))
                      }
                      placeholder="Link verifikasi sertifikat (opsional)"
                      className="border border-[#d4d4d8] px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={cert.imageUrl}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            certificates: p.certificates.map((item) =>
                              item.id === cert.id ? { ...item, imageUrl: e.target.value } : item,
                            ),
                          }))
                        }
                        placeholder="Foto sertifikat"
                        className="flex-1 border border-[#d4d4d8] px-3 py-2 text-xs outline-none focus:border-[#18181b]"
                      />
                      <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 border border-[#d4d4d8] bg-[#fafafa] px-2.5 py-2 text-xs font-medium hover:bg-[#f4f4f5]">
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingTarget === `cert-${cert.id}` ? '...' : 'Unggah'}
                        <input
                          type="file"
                          accept={ACCEPTED_IMAGE_TYPES}
                          onChange={(e) =>
                            handleSingleUpload(e, `cert-${cert.id}`, (url) =>
                              setDraft((p) => ({
                                ...p,
                                certificates: p.certificates.map((item) =>
                                  item.id === cert.id ? { ...item, imageUrl: url } : item,
                                ),
                              })),
                            )
                          }
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}

          {activeTab === 'media' && (
            <div className="space-y-8">
              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-4 mt-0 text-base font-semibold text-[#18181b]">
                  Judul & Keterangan Bagian Galeri
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <input
                    type="text"
                    value={draft.workEyebrow}
                    onChange={(e) => setDraft((p) => ({ ...p, workEyebrow: e.target.value }))}
                    placeholder="Eyebrow"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                  <input
                    type="text"
                    value={draft.workTitle}
                    onChange={(e) => setDraft((p) => ({ ...p, workTitle: e.target.value }))}
                    placeholder="Judul Galeri"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                  <input
                    type="text"
                    value={draft.workNote}
                    onChange={(e) => setDraft((p) => ({ ...p, workNote: e.target.value }))}
                    placeholder="Catatan singkat"
                    className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                  />
                </div>
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="mb-1 mt-0 text-lg font-semibold text-[#18181b]">
                      Tambah Foto atau Video ke Galeri
                    </h2>
                    <p className="m-0 text-xs text-[#71717a]">
                      Mendukung PNG, JPG, WebP, GIF, AVIF, SVG, BMP, ICO, HEIC, serta video MP4, WebM, MOV, MKV, M4V, OGG, 3GP, AVI hingga 100MB.
                    </p>
                  </div>
                  <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 border border-[#18181b] bg-[#18181b] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-[#27272a]">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingTarget === 'batch-gallery'
                      ? 'Mengunggah...'
                      : 'Unggah Banyak Sekaligus'}
                    <input
                      type="file"
                      multiple
                      accept={ACCEPTED_MEDIA_TYPES}
                      onChange={handleBatchGalleryUpload}
                      disabled={uploadingTarget === 'batch-gallery'}
                      className="sr-only"
                    />
                  </label>
                </div>

                <form onSubmit={handleAddWork} className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Unggah dari Perangkat
                    </label>
                    <label className="flex cursor-pointer items-center justify-center gap-2.5 border border-dashed border-[#a1a1aa] bg-[#fafafa] px-4 py-3 text-xs font-medium text-[#18181b] transition-colors hover:border-[#18181b] hover:bg-[#f4f4f5]">
                      <Upload className="h-4 w-4" />
                      {uploadingTarget === 'new-work'
                        ? 'Mengunggah...'
                        : 'Pilih Foto / Video dari Perangkat'}
                      <input
                        type="file"
                        accept={ACCEPTED_MEDIA_TYPES}
                        onChange={(e) =>
                          handleSingleUpload(e, 'new-work', (url, mediaType, filename) => {
                            setNewWorkUrl(url);
                            setNewWorkMediaType(mediaType);
                            if (!newWorkTitle.trim()) {
                              const cleanName = filename
                                .replace(/\.[^/.]+$/, '')
                                .replace(/[-_]+/g, ' ');
                              setNewWorkTitle(
                                cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
                              );
                            }
                          })
                        }
                        disabled={uploadingTarget === 'new-work'}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Atau URL Media
                    </label>
                    <input
                      type="text"
                      value={newWorkUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewWorkUrl(val);
                        if (looksLikeVideoUrl(val)) {
                          setNewWorkMediaType('video');
                        }
                      }}
                      placeholder="/uploads/... atau https://..."
                      className="w-full border border-[#d4d4d8] px-3 py-2.5 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Judul Foto / Video
                    </label>
                    <input
                      type="text"
                      value={newWorkTitle}
                      onChange={(e) => setNewWorkTitle(e.target.value)}
                      placeholder="Contoh: Senja di Kampus"
                      className="w-full border border-[#d4d4d8] px-3 py-2.5 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Kategori
                    </label>
                    <input
                      type="text"
                      value={newWorkCategory}
                      onChange={(e) => setNewWorkCategory(e.target.value)}
                      placeholder="Potret, Lanskap, Arsitektur, Video..."
                      className="w-full border border-[#d4d4d8] px-3 py-2.5 text-sm outline-none focus:border-[#18181b]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Jenis Media
                    </label>
                    <select
                      value={newWorkMediaType}
                      onChange={(e) => setNewWorkMediaType(e.target.value as MediaType)}
                      className="w-full border border-[#d4d4d8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#18181b]"
                    >
                      <option value="image">Foto (PNG / JPG / WebP)</option>
                      <option value="video">Video (MP4 / WebM / MOV)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                      Rasio Tampilan
                    </label>
                    <select
                      value={newWorkAspect}
                      onChange={(e) => setNewWorkAspect(e.target.value)}
                      className="w-full border border-[#d4d4d8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#18181b]"
                    >
                      {ASPECT_RATIO_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-[#f4f4f5] pt-4 md:col-span-2">
                    <input
                      type="text"
                      value={newWorkAlt}
                      onChange={(e) => setNewWorkAlt(e.target.value)}
                      placeholder="Deskripsi singkat foto/video (opsional)"
                      className="flex-1 border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                    />
                    <button
                      type="submit"
                      className="inline-flex shrink-0 items-center gap-2 border-0 bg-[#18181b] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-[#27272a]"
                    >
                      <Plus className="h-4 w-4" />
                      Tambahkan
                    </button>
                  </div>
                </form>
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-4 mt-0 text-lg font-semibold text-[#18181b]">
                  Daftar Foto & Video ({draft.works.length})
                </h2>

                <div className="divide-y divide-[#e4e4e7]">
                  {draft.works.map((work, index) => (
                    <div
                      key={work.id}
                      className="grid grid-cols-1 items-center gap-4 py-4 md:grid-cols-[88px_1fr_auto]"
                    >
                      <div className="h-20 w-[88px] overflow-hidden bg-[#f4f4f5]">
                        {work.mediaType === 'video' ? (
                          <CloudVideo
                            src={work.imageUrl}
                            muted
                            playsInline
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <CloudImg
                            src={work.imageUrl}
                            alt={work.alt}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <input
                          type="text"
                          value={work.title}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              works: p.works.map((w) =>
                                w.id === work.id ? { ...w, title: e.target.value } : w,
                              ),
                            }))
                          }
                          className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                        />
                        <input
                          type="text"
                          value={work.categoryLabel}
                          onChange={(e) => {
                            const label = e.target.value;
                            const slug =
                              label
                                .toLowerCase()
                                .trim()
                                .replace(/[^a-z0-9-]+/g, '-')
                                .replace(/^-+|-+$/g, '') || 'lainnya';
                            setDraft((p) => ({
                              ...p,
                              works: p.works.map((w) =>
                                w.id === work.id
                                  ? { ...w, categoryLabel: label, category: slug }
                                  : w,
                              ),
                            }));
                          }}
                          className="border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                        />
                        <select
                          value={work.aspectClass}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              works: p.works.map((w) =>
                                w.id === work.id ? { ...w, aspectClass: e.target.value } : w,
                              ),
                            }))
                          }
                          className="border border-[#d4d4d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                        >
                          {ASPECT_RATIO_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2 sm:col-span-2">
                          <input
                            type="text"
                            value={work.imageUrl}
                            placeholder="URL foto/video"
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraft((p) => ({
                                ...p,
                                works: p.works.map((w) =>
                                  w.id === work.id
                                    ? {
                                        ...w,
                                        imageUrl: val,
                                        ...(looksLikeVideoUrl(val) ? { mediaType: 'video' } : {}),
                                      }
                                    : w,
                                ),
                              }));
                            }}
                            className="flex-1 border border-[#d4d4d8] px-3 py-1.5 text-xs outline-none focus:border-[#18181b]"
                          />
                          <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 border border-[#d4d4d8] bg-[#fafafa] px-2.5 py-1.5 text-xs font-medium hover:bg-[#f4f4f5]">
                            <Upload className="h-3 w-3" />
                            {uploadingTarget === `work-${work.id}` ? '...' : 'Ganti'}
                            <input
                              type="file"
                              accept={ACCEPTED_MEDIA_TYPES}
                              onChange={(e) =>
                                handleSingleUpload(e, `work-${work.id}`, (url, mediaType) =>
                                  setDraft((p) => ({
                                    ...p,
                                    works: p.works.map((w) =>
                                      w.id === work.id ? { ...w, imageUrl: url, mediaType } : w,
                                    ),
                                  })),
                                )
                              }
                              className="sr-only"
                            />
                          </label>
                        </div>
                        <input
                          type="text"
                          value={work.alt}
                          placeholder="Deskripsi / Alt foto"
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              works: p.works.map((w) =>
                                w.id === work.id ? { ...w, alt: e.target.value } : w,
                              ),
                            }))
                          }
                          className="border border-[#d4d4d8] px-3 py-1.5 text-xs outline-none focus:border-[#18181b]"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="mr-2 inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-[#71717a]">
                          {work.mediaType === 'video' ? (
                            <Video className="h-3.5 w-3.5" />
                          ) : (
                            <ImageIcon className="h-3.5 w-3.5" />
                          )}
                          {work.mediaType}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (index === 0) return;
                            setDraft((p) => {
                              const next = [...p.works];
                              const [m] = next.splice(index, 1);
                              next.splice(index - 1, 0, m);
                              return { ...p, works: next };
                            });
                          }}
                          disabled={index === 0}
                          className="border border-[#e4e4e7] bg-white p-2 text-[#52525b] disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (index === draft.works.length - 1) return;
                            setDraft((p) => {
                              const next = [...p.works];
                              const [m] = next.splice(index, 1);
                              next.splice(index + 1, 0, m);
                              return { ...p, works: next };
                            });
                          }}
                          disabled={index === draft.works.length - 1}
                          className="border border-[#e4e4e7] bg-white p-2 text-[#52525b] disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((p) => ({
                              ...p,
                              works: p.works.filter((w) => w.id !== work.id),
                            }))
                          }
                          className="border border-[#e4e4e7] bg-white p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {uploads.length > 0 && (
                <section className="border border-[#e4e4e7] bg-white p-6">
                  <h2 className="mb-4 mt-0 text-lg font-semibold text-[#18181b]">
                    File yang Diunggah ({uploads.length})
                  </h2>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-5">
                    {uploads.map((asset) => (
                      <div key={asset.id || asset.url} className="border border-[#e4e4e7] bg-[#fafafa] p-2">
                        <div className="mb-2 aspect-square overflow-hidden bg-[#e4e4e7]">
                          {asset.mediaType === 'video' ? (
                            <CloudVideo
                              src={asset.url}
                              muted
                              playsInline
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <CloudImg
                              src={asset.url}
                              alt={asset.filename}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setNewWorkUrl(asset.url);
                                setNewWorkMediaType(asset.mediaType);
                              }}
                              className="border-0 bg-transparent p-0 text-[11px] font-semibold text-[#18181b] underline"
                            >
                              Galeri
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDraft((p) => ({
                                  ...p,
                                  hero: {
                                    ...p.hero,
                                    backdropMode: 'photo-cover',
                                    imageUrl: asset.url,
                                    mediaType: asset.mediaType,
                                  },
                                }));
                                setSaveMessage('Media dipilih sebagai Latar Belakang Halaman Depan. Klik Simpan Perubahan.');
                                window.setTimeout(() => setSaveMessage(null), 2800);
                              }}
                              className="border-0 bg-transparent p-0 text-[11px] font-semibold text-blue-700 underline"
                            >
                              Latar Hero
                            </button>
                            {asset.mediaType === 'image' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDraft((p) => ({
                                    ...p,
                                    logo: {
                                      ...p.logo,
                                      mode: p.logo.mode === 'image-only' ? 'image-only' : 'image',
                                      imageUrl: asset.url,
                                    },
                                  }));
                                  setSaveMessage('Foto dipilih sebagai Logo. Klik Simpan Perubahan.');
                                  window.setTimeout(() => setSaveMessage(null), 2500);
                                }}
                                className="border-0 bg-transparent p-0 text-[11px] font-semibold text-[#8b6b51] underline"
                              >
                                Jadi Logo
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCopyAssetUrl(asset.url)}
                              aria-label="Salin URL file"
                              className="inline-flex items-center gap-0.5 border-0 bg-transparent p-0 text-[11px] text-[#52525b] hover:text-[#18181b]"
                            >
                              <Copy className="h-3 w-3" />
                              {copiedUrl === asset.url ? 'Disalin' : 'URL'}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteUploadedAsset(asset)}
                            className="border-0 bg-transparent p-1 text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === 'theme' && (
            <div className="space-y-8">
              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-5 mt-0 text-lg font-semibold text-[#18181b]">
                  Desain Tata Letak
                </h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#52525b]">
                      Tata Letak Hero
                    </label>
                    <select
                      value={draft.design.heroLayout}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          design: { ...p.design, heroLayout: e.target.value as HeroLayout },
                        }))
                      }
                      className="w-full border border-[#d4d4d8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#18181b]"
                    >
                      <option value="showcase">Showcase Poster Informatika (Default)</option>
                      <option value="fullbleed">Full-Bleed Klasik</option>
                      <option value="split">Split 2-Kolom Editorial</option>
                      <option value="minimal">Minimalis Tipografi</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#52525b]">
                      Grid Galeri Foto
                    </label>
                    <select
                      value={draft.design.galleryLayout}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          design: { ...p.design, galleryLayout: e.target.value as GalleryLayout },
                        }))
                      }
                      className="w-full border border-[#d4d4d8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#18181b]"
                    >
                      <option value="editorial">Editorial Rasio Bervariasi</option>
                      <option value="uniform-2">2 Kolom Seragam</option>
                      <option value="uniform-3">3 Kolom Rapi</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#52525b]">
                      Sudut Kartu
                    </label>
                    <select
                      value={draft.design.cardRadius}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          design: { ...p.design, cardRadius: e.target.value as CardRadius },
                        }))
                      }
                      className="w-full border border-[#d4d4d8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#18181b]"
                    >
                      <option value="sharp">Tajam Klasik (0px)</option>
                      <option value="soft">Lembut (8px)</option>
                      <option value="editorial">Membulat (16px)</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 border-t border-[#e4e4e7] pt-5">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#52525b]">
                    Tampilkan / Sembunyikan Bagian Halaman Utama
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                    {(
                      [
                        ['about', 'Tentang Saya'],
                        ['skills', 'Keahlian & Program'],
                        ['projects', 'Proyek'],
                        ['certificates', 'Sertifikat'],
                        ['gallery', 'Galeri Visual'],
                        ['contact', 'Kontak'],
                      ] as [keyof SectionVisibility, string][]
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 border border-[#e4e4e7] bg-[#fafafa] px-3 py-2 text-xs font-medium text-[#18181b]"
                      >
                        <input
                          type="checkbox"
                          checked={draft.sections?.[key] ?? true}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              sections: {
                                ...(p.sections ?? {
                                  about: true,
                                  skills: true,
                                  projects: true,
                                  certificates: true,
                                  gallery: true,
                                  contact: true,
                                }),
                                [key]: e.target.checked,
                              },
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-2 mt-0 text-lg font-semibold text-[#18181b]">
                  Palet Warna Website
                </h2>
                <p className="mb-5 mt-0 text-xs text-[#71717a]">
                  Pilih preset warna atau ubah warna sesuka hati.
                </p>

                <div className="mb-6 flex flex-wrap gap-3">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, colors: { ...preset.colors } }))}
                      className="inline-flex items-center gap-2.5 border border-[#d4d4d8] bg-white px-3.5 py-2 text-xs font-medium text-[#18181b] hover:border-[#18181b]"
                    >
                      <span className="flex items-center gap-1">
                        <span
                          className="h-3.5 w-3.5 border border-black/15"
                          style={{ backgroundColor: preset.colors.paper }}
                        />
                        <span
                          className="h-3.5 w-3.5 border border-black/15"
                          style={{ backgroundColor: preset.colors.ink }}
                        />
                        <span
                          className="h-3.5 w-3.5 border border-black/15"
                          style={{ backgroundColor: preset.colors.accent }}
                        />
                      </span>
                      {preset.name}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(
                    [
                      ['paper', 'Latar Utama'],
                      ['paperAlt', 'Latar Sekunder'],
                      ['ink', 'Teks Utama'],
                      ['muted', 'Teks Sekunder'],
                      ['line', 'Garis Pembatas'],
                      ['accent', 'Warna Aksen'],
                    ] as const
                  ).map(([key, label]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between border border-[#e4e4e7] px-3.5 py-2.5"
                    >
                      <div>
                        <div className="text-xs font-medium text-[#18181b]">{label}</div>
                        <div className="font-mono text-[11px] uppercase text-[#71717a]">
                          {draft.colors[key]}
                        </div>
                      </div>
                      <input
                        type="color"
                        value={draft.colors[key]}
                        aria-label={label}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            colors: { ...p.colors, [key]: e.target.value },
                          }))
                        }
                        className="h-9 w-12 cursor-pointer border border-[#d4d4d8] bg-transparent p-0.5"
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-5 mt-0 text-lg font-semibold text-[#18181b]">
                  Desain Fon Teks
                </h2>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#52525b]">
                      Fon Judul (Display)
                    </label>
                    <select
                      value={draft.typography.displayFont}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          typography: { ...p.typography, displayFont: e.target.value },
                        }))
                      }
                      className="w-full border border-[#d4d4d8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#18181b]"
                    >
                      {DISPLAY_FONT_OPTIONS.map((font) => (
                        <option key={font.name} value={font.name}>
                          {font.name} ({font.category === 'serif' ? 'Serif' : 'Sans'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#52525b]">
                      Fon Aksen / Sapaan Italic
                    </label>
                    <select
                      value={draft.typography.accentFont ?? 'Instrument Serif'}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          typography: { ...p.typography, accentFont: e.target.value },
                        }))
                      }
                      className="w-full border border-[#d4d4d8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#18181b]"
                    >
                      {ACCENT_FONT_OPTIONS.map((font) => (
                        <option key={font.name} value={font.name}>
                          {font.name} (Serif Italic)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#52525b]">
                      Fon Isi Teks (Body)
                    </label>
                    <select
                      value={draft.typography.bodyFont}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          typography: { ...p.typography, bodyFont: e.target.value },
                        }))
                      }
                      className="w-full border border-[#d4d4d8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#18181b]"
                    >
                      {BODY_FONT_OPTIONS.map((font) => (
                        <option key={font.name} value={font.name}>
                          {font.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#52525b]">
                      Skala Ukuran Judul
                    </label>
                    <select
                      value={draft.typography.headingScale}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          typography: {
                            ...p.typography,
                            headingScale: e.target.value as HeadingScale,
                          },
                        }))
                      }
                      className="w-full border border-[#d4d4d8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#18181b]"
                    >
                      <option value="compact">Kompak</option>
                      <option value="normal">Normal</option>
                      <option value="dramatic">Dramatis Besar</option>
                    </select>
                  </div>
                </div>

                <div
                  className="mt-6 border p-8 transition-colors"
                  style={{
                    backgroundColor: draft.colors.paper,
                    color: draft.colors.ink,
                    borderColor: draft.colors.line,
                  }}
                >
                  <div
                    className="font-mono text-[11px] font-bold uppercase tracking-[0.25em]"
                    style={{ color: draft.colors.accent }}
                  >
                    Pratinjau Tipografi &amp; Warna
                  </div>
                  <div className="mt-3 font-accent text-3xl italic opacity-90">
                    {draft.hero.greetingLeft} {draft.hero.greetingRight}
                  </div>
                  <h3 className="mb-3 mt-1 font-serif text-4xl font-bold uppercase tracking-tight">
                    {draft.hero.headlineLine1} {draft.hero.headlineLine2}
                  </h3>
                  <p className="m-0 max-w-xl font-sans text-sm leading-relaxed" style={{ color: draft.colors.muted }}>
                    Contoh paragraf menggunakan fon isi {draft.typography.bodyFont}, judul {draft.typography.displayFont}, dan aksen italic {draft.typography.accentFont ?? 'Instrument Serif'}.
                  </p>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'pages' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
              <div className="border border-[#e4e4e7] bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="m-0 text-sm font-semibold text-[#18181b]">
                    Daftar Halaman ({draft.pages.length})
                  </h2>
                  <button
                    type="button"
                    onClick={handleCreatePage}
                    className="inline-flex items-center gap-1 border-0 bg-[#18181b] px-2.5 py-1.5 text-[11px] font-semibold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah
                  </button>
                </div>

                {draft.pages.length === 0 ? (
                  <p className="m-0 py-6 text-center text-xs text-[#71717a]">
                    Belum ada halaman kustom. Klik &ldquo;Tambah&rdquo; untuk membuat halaman baru di menu navigasi.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {draft.pages.map((page) => {
                      const selected = activePageBeingEdited?.id === page.id;
                      return (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => setEditingPageId(page.id)}
                          className={`flex w-full items-center justify-between border px-3 py-2.5 text-left text-xs ${
                            selected
                              ? 'border-[#18181b] bg-[#fafafa] font-semibold text-[#18181b]'
                              : 'border-[#e4e4e7] bg-white text-[#52525b] hover:bg-[#fafafa]'
                          }`}
                        >
                          <span className="truncate">{page.title}</span>
                          <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wider text-[#71717a]">
                            {page.published ? 'Aktif' : 'Draf'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {activePageBeingEdited ? (
                <div className="border border-[#e4e4e7] bg-white p-6">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#f4f4f5] pb-4">
                    <h2 className="m-0 text-lg font-semibold text-[#18181b]">
                      Edit Halaman: {activePageBeingEdited.title}
                    </h2>
                    <div className="flex items-center gap-4">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-[#3f3f46]">
                        <input
                          type="checkbox"
                          checked={activePageBeingEdited.published}
                          onChange={(e) =>
                            updatePage(activePageBeingEdited.id, { published: e.target.checked })
                          }
                        />
                        Tampilkan di Menu Navigasi
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft((p) => ({
                            ...p,
                            pages: p.pages.filter((item) => item.id !== activePageBeingEdited.id),
                          }));
                          setEditingPageId(null);
                        }}
                        className="inline-flex items-center gap-1.5 border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        Judul Halaman
                      </label>
                      <input
                        type="text"
                        value={activePageBeingEdited.title}
                        onChange={(e) =>
                          updatePage(activePageBeingEdited.id, { title: e.target.value })
                        }
                        className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        Label Menu Navigasi
                      </label>
                      <input
                        type="text"
                        value={activePageBeingEdited.navLabel}
                        onChange={(e) =>
                          updatePage(activePageBeingEdited.id, { navLabel: e.target.value })
                        }
                        className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        Slug URL (#/p/...)
                      </label>
                      <input
                        type="text"
                        value={activePageBeingEdited.slug}
                        onChange={(e) =>
                          updatePage(activePageBeingEdited.id, {
                            slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
                          })
                        }
                        className="w-full border border-[#d4d4d8] px-3 py-2 font-mono text-sm outline-none focus:border-[#18181b]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        Subjudul Kecil
                      </label>
                      <input
                        type="text"
                        value={activePageBeingEdited.eyebrow}
                        onChange={(e) =>
                          updatePage(activePageBeingEdited.id, { eyebrow: e.target.value })
                        }
                        className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        Sampul Foto / Video Halaman
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={activePageBeingEdited.coverUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            updatePage(activePageBeingEdited.id, {
                              coverUrl: val,
                              ...(looksLikeVideoUrl(val) ? { coverMediaType: 'video' } : {}),
                            });
                          }}
                          placeholder="Unggah dari perangkat atau tempel URL"
                          className="flex-1 border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                        />
                        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 border border-[#d4d4d8] bg-[#fafafa] px-3 py-2 text-xs font-medium hover:bg-[#f4f4f5]">
                          <Upload className="h-3.5 w-3.5" />
                          {uploadingTarget === `page-${activePageBeingEdited.id}` ? '...' : 'Unggah'}
                          <input
                            type="file"
                            accept={ACCEPTED_MEDIA_TYPES}
                            onChange={(e) =>
                              handleSingleUpload(e, `page-${activePageBeingEdited.id}`, (url, mediaType) =>
                                updatePage(activePageBeingEdited.id, {
                                  coverUrl: url,
                                  coverMediaType: mediaType,
                                }),
                              )
                            }
                            className="sr-only"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        Teks Pengantar
                      </label>
                      <input
                        type="text"
                        value={activePageBeingEdited.lead}
                        onChange={(e) =>
                          updatePage(activePageBeingEdited.id, { lead: e.target.value })
                        }
                        className="w-full border border-[#d4d4d8] px-3 py-2 text-sm outline-none focus:border-[#18181b]"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        Isi Halaman
                      </label>
                      <textarea
                        rows={6}
                        value={activePageBeingEdited.content}
                        onChange={(e) =>
                          updatePage(activePageBeingEdited.id, { content: e.target.value })
                        }
                        className="w-full border border-[#d4d4d8] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#18181b]"
                      />
                    </div>
                    {draft.works.length > 0 && (
                      <div className="border-t border-[#f4f4f5] pt-4 md:col-span-2">
                        <label className="mb-2 block text-xs font-medium text-[#3f3f46]">
                          Sertakan Foto / Video dari Galeri ke Halaman Ini ({activePageBeingEdited.mediaIds.length} dipilih)
                        </label>
                        <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto border border-[#e4e4e7] bg-[#fafafa] p-3 sm:grid-cols-3">
                          {draft.works.map((work) => {
                            const checked = activePageBeingEdited.mediaIds.includes(work.id);
                            return (
                              <label
                                key={work.id}
                                className="flex cursor-pointer items-center gap-2 border border-[#e4e4e7] bg-white p-2 text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const nextIds = e.target.checked
                                      ? [...activePageBeingEdited.mediaIds, work.id]
                                      : activePageBeingEdited.mediaIds.filter((id) => id !== work.id);
                                    updatePage(activePageBeingEdited.id, { mediaIds: nextIds });
                                  }}
                                />
                                <span className="truncate">{work.title}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center border border-[#e4e4e7] bg-white p-12 text-center">
                  <div>
                    <p className="mb-4 mt-0 text-sm text-[#71717a]">
                      Buat halaman tambahan untuk memperluas portofolio Anda.
                    </p>
                    <button
                      type="button"
                      onClick={handleCreatePage}
                      className="inline-flex items-center gap-2 border-0 bg-[#18181b] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white"
                    >
                      <Plus className="h-4 w-4" />
                      Buat Halaman Pertama
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-6">
              <section className="border border-[#e4e4e7] bg-white p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="m-0 text-lg font-semibold text-[#18181b]">
                      Pesan Masuk dari Pengunjung ({messages.length})
                    </h2>
                    <p className="m-0 mt-1 text-xs text-[#71717a]">
                      Pesan yang dikirim melalui formulir kontak di halaman utama portofolio.
                    </p>
                  </div>
                </div>

                {messages.length === 0 ? (
                  <p className="m-0 border border-dashed border-[#d4d4d8] py-12 text-center text-xs text-[#71717a]">
                    Belum ada pesan masuk dari pengunjung.
                  </p>
                ) : (
                  <div className="divide-y divide-[#e4e4e7] border-t border-[#e4e4e7]">
                    {messages.map((msg) => (
                      <article key={msg.id} className="py-5">
                        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="m-0 text-sm font-semibold text-[#18181b]">
                              {msg.subject}
                            </h3>
                            <div className="mt-1 text-xs text-[#52525b]">
                              Dari <span className="font-medium text-[#18181b]">{msg.name}</span> ({msg.email}) ·{' '}
                              {new Date(msg.createdAt).toLocaleString('id-ID')}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`mailto:${msg.email}?subject=${encodeURIComponent(`Re: ${msg.subject}`)}`}
                              className="border border-[#d4d4d8] bg-white px-3 py-1.5 text-xs font-medium text-[#18181b] hover:bg-[#f4f4f5]"
                            >
                              Balas Email
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100"
                              aria-label="Hapus pesan"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-[#3f3f46]">
                          {msg.message}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="max-w-2xl space-y-6">
              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-2 mt-0 text-lg font-semibold text-[#18181b]">
                  Status Penyimpanan Permanen & Akun Admin
                </h2>
                <p className="mb-4 mt-0 text-xs leading-relaxed text-[#71717a]">
                  Semua perubahan konten, tema, halaman, foto, dan video disimpan langsung ke cloud database Firestore sehingga tampil seragam di semua tautan (AI Studio, Vercel, dan perangkat mana pun).
                </p>

                <div className="mb-5 border border-[#e4e4e7] bg-[#fafafa] p-4 text-xs">
                  <div className="font-semibold text-[#18181b]">
                    Akun Aktif: {user.email || 'Admin Google'}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-[#52525b]">
                    UID: {user.uid}
                  </div>
                </div>

                {user.email === BOOTSTRAPPED_ADMIN_EMAIL && (
                  <form onSubmit={handleGrantAdmin} className="space-y-4 border-t border-[#f4f4f5] pt-4">
                    <h3 className="m-0 text-sm font-semibold text-[#18181b]">
                      Tambah Akun Google Admin Tambahan (Opsional)
                    </h3>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        UID Pengguna Firebase Auth
                      </label>
                      <input
                        type="text"
                        required
                        value={extraAdminUid}
                        onChange={(e) => setExtraAdminUid(e.target.value)}
                        placeholder="Tempel UID dari layar login admin"
                        className="w-full border border-[#d4d4d8] px-3 py-2.5 font-mono text-sm outline-none focus:border-[#18181b]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#3f3f46]">
                        Email Akun Google
                      </label>
                      <input
                        type="email"
                        required
                        value={extraAdminEmail}
                        onChange={(e) => setExtraAdminEmail(e.target.value)}
                        placeholder="email-admin@gmail.com"
                        className="w-full border border-[#d4d4d8] px-3 py-2.5 text-sm outline-none focus:border-[#18181b]"
                      />
                    </div>
                    {passwordStatus && (
                      <div className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        {passwordStatus}
                      </div>
                    )}
                    <button
                      type="submit"
                      className="border-0 bg-[#18181b] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-[#27272a]"
                    >
                      Beri Akses Admin
                    </button>
                  </form>
                )}
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-2 mt-0 flex items-center gap-2 text-lg font-semibold text-[#18181b]">
                  <GitBranch className="h-5 w-5" />
                  Sinkronisasi Data ke GitHub (Permanen Tanpa Kuota)
                </h2>
                <p className="mb-4 mt-0 text-xs leading-relaxed text-[#71717a]">
                  Simpan data teks, tema, proyek, sertifikat, galeri, serta foto/video langsung ke
                  repositori GitHub (<code>src/data/site-snapshot.json</code> &amp;{' '}
                  <code>public/media/</code>) agar data tidak pernah teriset meski perangkat
                  dimatikan atau kuota cloud gratis penuh.
                </p>

                {githubStatus.configured ? (
                  <div className="mb-4 space-y-3 border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950">
                    <div className="font-semibold">
                      Terhubung ke GitHub: <code>{githubStatus.repo}</code> (branch{' '}
                      <code>{githubStatus.branch}</code>)
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handlePublishGitHub}
                        disabled={publishingGitHub}
                        className="inline-flex items-center gap-2 border-0 bg-[#18181b] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-[#27272a] disabled:opacity-50"
                      >
                        <GitBranch className="h-3.5 w-3.5" />
                        {publishingGitHub
                          ? 'Mengirim ke GitHub...'
                          : 'Simpan & Push Data ke GitHub'}
                      </button>
                      {githubCommitUrl && (
                        <a
                          href={githubCommitUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-emerald-900 underline"
                        >
                          Lihat Commit GitHub
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 space-y-2 border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
                    <p className="m-0 font-semibold">
                      Mode Push Otomatis GitHub belum diaktifkan di server.
                    </p>
                    <p className="m-0">
                      Untuk menyimpan langsung ke GitHub dengan 1 klik dari sini, tambahkan variabel
                      lingkungan berikut di <strong>Vercel Environment Variables</strong> (atau{' '}
                      <strong>Secrets</strong>):
                    </p>
                    <ul className="m-0 list-disc space-y-1 pl-4 font-mono text-[11px]">
                      <li>GITHUB_TOKEN = Personal Access Token GitHub (Contents: Read &amp; Write)</li>
                      <li>GITHUB_REPO = username/nama-repo</li>
                      <li>GITHUB_BRANCH = main</li>
                    </ul>
                    <p className="m-0 pt-1">
                      Atau unduh file <code>site-snapshot.json</code> di bawah lalu gantikan file{' '}
                      <code>src/data/site-snapshot.json</code> di repositori GitHub Anda secara manual.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadGitHubSnapshot}
                    className="inline-flex items-center gap-2 border border-[#18181b] bg-white px-4 py-2.5 text-xs font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Unduh site-snapshot.json (untuk GitHub)
                  </button>
                </div>
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <h2 className="mb-2 mt-0 text-lg font-semibold text-[#18181b]">
                  Cadangan (Backup) & Reset Situs
                </h2>
                <p className="mb-4 mt-0 text-xs text-[#71717a]">
                  Unduh seluruh isi teks, proyek, sertifikat, halaman, logo, dan tema sebagai file JSON, atau pulihkan kembali kapan saja.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="inline-flex items-center gap-2 border border-[#18181b] bg-[#18181b] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#27272a]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Ekspor Backup (.json)
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-2 border border-[#d4d4d8] bg-white px-4 py-2.5 text-xs font-semibold text-[#18181b] hover:bg-[#f4f4f5]">
                    <Upload className="h-3.5 w-3.5" />
                    Impor Backup (.json)
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImportBackup}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div className="mt-6 border-t border-[#f4f4f5] pt-4">
                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="inline-flex items-center gap-2 border border-red-200 bg-white px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset Konten ke Pengaturan Awal
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                      <span>Yakin kembalikan konten ke bawaan? File unggahan tidak ikut terhapus.</span>
                      <button
                        type="button"
                        onClick={handleResetSiteToDefault}
                        disabled={saving}
                        className="border-0 bg-red-700 px-3 py-1.5 font-semibold text-white hover:bg-red-800"
                      >
                        Ya, Reset Sekarang
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="border border-red-200 bg-white px-3 py-1.5 font-medium text-[#18181b]"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <section className="border border-[#e4e4e7] bg-white p-6">
                <h3 className="mb-2 mt-0 text-sm font-semibold text-[#18181b]">
                  Cara Membuka Panel Admin Tersembunyi
                </h3>
                <ul className="m-0 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-[#52525b]">
                  <li>Buka alamat dengan akhiran <code>#/admin</code> atau <code>/admin</code>.</li>
                  <li>Tekan pintasan keyboard <code>Ctrl + Shift + A</code> (atau <code>Cmd + Shift + A</code> di Mac).</li>
                  <li>Klik 3 kali teks hak cipta di bagian footer bawah website.</li>
                </ul>
                <div className="mt-5 border-t border-[#f4f4f5] pt-4">
                  <button
                    type="button"
                    onClick={() => onLogout()}
                    className="inline-flex items-center gap-2 border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Keluar dari Panel Admin
                  </button>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
