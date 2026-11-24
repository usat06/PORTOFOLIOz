import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { SectionVisibility, SiteConfig } from '../types/site';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  site: SiteConfig;
  activePageSlug: string | null;
  onNavigateHome: (sectionId?: string) => void;
  onNavigatePage: (slug: string) => void;
}

export function Header({ site, activePageSlug, onNavigateHome, onNavigatePage }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const publishedPages = site.pages.filter((page) => page.published);
  const sections = site.sections ?? {
    about: true,
    skills: true,
    projects: true,
    certificates: true,
    gallery: true,
    contact: true,
  };
  const nav = site.navLabels ?? {
    about: 'Tentang',
    skills: 'Keahlian',
    projects: 'Proyek',
    certificates: 'Sertifikat',
    gallery: 'Galeri',
    contact: 'Kontak',
    headerCta: 'Hubungi',
    showHeaderCta: true,
  };

  const sectionLinks: { id: string; label: string; key: keyof SectionVisibility }[] = [
    { id: 'tentang', label: nav.about, key: 'about' },
    { id: 'keahlian', label: nav.skills, key: 'skills' },
    { id: 'proyek', label: nav.projects, key: 'projects' },
    { id: 'sertifikat', label: nav.certificates, key: 'certificates' },
    { id: 'karya', label: nav.gallery, key: 'gallery' },
    { id: 'kontak', label: nav.contact, key: 'contact' },
  ];

  const visibleSectionLinks = sectionLinks.filter(
    (link) => sections[link.key] !== false && (!nav.showHeaderCta || link.key !== 'contact'),
  );

  const handleSectionClick = (sectionId: string) => {
    setMenuOpen(false);
    onNavigateHome(sectionId);
  };

  const handlePageClick = (slug: string) => {
    setMenuOpen(false);
    onNavigatePage(slug);
  };

  const brandAria = site.brandSuffix.trim()
    ? `${site.brandName}${site.brandDot}${site.brandSuffix}`
    : site.brandName;

  return (
    <header
      id="beranda"
      className="sticky top-0 z-20 flex h-[72px] items-center justify-between gap-6 border-b border-line/80 bg-paper/95 px-[5.5%] backdrop-blur-md transition-colors duration-200 md:h-[80px]"
    >
      <a
        href="#beranda"
        onClick={(e) => {
          e.preventDefault();
          handleSectionClick('beranda');
        }}
        aria-label={`${brandAria}, kembali ke beranda`}
        className="shrink-0 whitespace-nowrap"
      >
        <BrandLogo site={site} />
      </a>

      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
        aria-expanded={menuOpen}
        aria-controls="main-nav"
        className="flex h-11 w-11 items-center justify-center border-0 bg-transparent p-2 text-ink lg:hidden"
      >
        {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      <nav
        id="main-nav"
        aria-label="Navigasi utama"
        className={`${
          menuOpen ? 'flex' : 'hidden'
        } absolute left-0 right-0 top-[72px] flex-col items-start gap-5 border-b border-line bg-paper px-[6%] pb-7 pt-5 shadow-[0_14px_20px_rgba(0,0,0,0.08)] lg:static lg:flex lg:flex-row lg:items-center lg:gap-7 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
      >
        {visibleSectionLinks.map((link) => (
          <a
            key={link.id}
            href={`#${link.id}`}
            onClick={(e) => {
              e.preventDefault();
              handleSectionClick(link.id);
            }}
            className="shrink-0 whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.12em] text-ink/85 transition-colors duration-200 hover:text-accent"
          >
            {link.label}
          </a>
        ))}

        {publishedPages.map((page) => (
          <a
            key={page.id}
            href={`#/p/${page.slug}`}
            onClick={(e) => {
              e.preventDefault();
              handlePageClick(page.slug);
            }}
            className={`shrink-0 whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors duration-200 hover:text-accent ${
              activePageSlug === page.slug ? 'text-accent underline underline-offset-8' : 'text-ink/85'
            }`}
          >
            {page.navLabel || page.title}
          </a>
        ))}

        {nav.showHeaderCta && sections.contact !== false && (
          <a
            href="#kontak"
            onClick={(e) => {
              e.preventDefault();
              handleSectionClick('kontak');
            }}
            className="shrink-0 whitespace-nowrap border border-ink bg-ink px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] text-paper transition-colors duration-200 hover:border-accent hover:bg-accent"
          >
            {nav.headerCta}
          </a>
        )}
      </nav>
    </header>
  );
}
