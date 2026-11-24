import { useRef } from 'react';
import type { SiteConfig } from '../types/site';
import { BrandLogo } from './BrandLogo';

interface FooterProps {
  site: SiteConfig;
  onNavigateHome: (sectionId?: string) => void;
  onHiddenAdminTrigger: () => void;
}

export function Footer({ site, onNavigateHome, onHiddenAdminTrigger }: FooterProps) {
  const tapCountRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const handleSecretTap = () => {
    tapCountRef.current += 1;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      onHiddenAdminTrigger();
      return;
    }
    timerRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
    }, 900);
  };

  return (
    <footer className="flex w-full flex-wrap items-center justify-between gap-4 border-t border-line bg-paper px-4 py-6 font-mono text-[11px] tracking-[0.08em] text-muted sm:flex-nowrap sm:px-6 sm:py-7 md:px-10 lg:px-12 xl:px-16">
      <a
        href="#beranda"
        onClick={(e) => {
          e.preventDefault();
          onNavigateHome('beranda');
        }}
        className="w-full sm:w-auto"
      >
        <BrandLogo site={site} size="sm" />
      </a>
      <span onClick={handleSecretTap} className="select-none">
        {site.footerCopyright}
      </span>
      <a
        href="#beranda"
        onClick={(e) => {
          e.preventDefault();
          onNavigateHome('beranda');
        }}
        className="shrink-0 whitespace-nowrap font-bold uppercase tracking-[0.15em] transition-colors duration-200 hover:text-accent"
      >
        {site.uiLabels?.footerBackToTopLabel || 'Kembali ke atas ↑'}
      </a>
    </footer>
  );
}
