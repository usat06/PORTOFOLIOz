import { ACCENT_FONT_OPTIONS, BODY_FONT_OPTIONS, DISPLAY_FONT_OPTIONS } from '../data/defaultSite';
import type { SiteConfig } from '../types/site';

const DYNAMIC_FONT_LINK_ID = 'ruang-cahaya-dynamic-fonts';

export function applySiteTheme(site: SiteConfig): void {
  const root = document.documentElement;
  root.style.setProperty('--paper', site.colors.paper);
  root.style.setProperty('--paper-alt', site.colors.paperAlt);
  root.style.setProperty('--ink', site.colors.ink);
  root.style.setProperty('--muted', site.colors.muted);
  root.style.setProperty('--line', site.colors.line);
  root.style.setProperty('--accent', site.colors.accent);

  const displayOpt = DISPLAY_FONT_OPTIONS.find((f) => f.name === site.typography.displayFont);
  const bodyOpt = BODY_FONT_OPTIONS.find((f) => f.name === site.typography.bodyFont);
  const accentOpt = ACCENT_FONT_OPTIONS.find((f) => f.name === site.typography.accentFont);

  const displayFallback = displayOpt?.category === 'serif' ? 'serif' : 'sans-serif';
  const bodyFallback = bodyOpt?.category === 'serif' ? 'serif' : 'sans-serif';

  root.style.setProperty('--font-display', `"${site.typography.displayFont}", ${displayFallback}`);
  root.style.setProperty('--font-body', `"${site.typography.bodyFont}", ${bodyFallback}`);
  root.style.setProperty(
    '--font-accent-serif',
    `"${site.typography.accentFont || 'Instrument Serif'}", Georgia, serif`,
  );

  const params = new Set<string>();
  if (displayOpt) params.add(`family=${displayOpt.googleParam}`);
  if (bodyOpt) params.add(`family=${bodyOpt.googleParam}`);
  if (accentOpt) params.add(`family=${accentOpt.googleParam}`);
  params.add('family=JetBrains+Mono:wght@400;500;600');

  if (params.size > 0) {
    const href = `https://fonts.googleapis.com/css2?${Array.from(params).join('&')}&display=swap`;
    let link = document.getElementById(DYNAMIC_FONT_LINK_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = DYNAMIC_FONT_LINK_ID;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== href) {
      link.href = href;
    }
  }

  const brandFull = site.brandSuffix.trim()
    ? `${site.brandName}${site.brandDot}${site.brandSuffix}`
    : site.brandName;
  if (brandFull.trim()) {
    document.title = site.brandTagline.trim()
      ? `${brandFull} — ${site.brandTagline}`
      : brandFull;
  }

  const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (favicon) {
    const logo = site.logo;
    if ((logo?.mode === 'image' || logo?.mode === 'image-only') && logo.imageUrl.trim()) {
      favicon.href = logo.imageUrl.trim();
    } else {
      const mono = (logo?.monogramText || 'UJ').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3) || 'UJ';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="7" fill="${site.colors.ink}"/><text x="18" y="19" text-anchor="middle" dominant-baseline="central" fill="${site.colors.paper}" font-family="Georgia,serif" font-size="14" font-weight="bold">${mono}</text></svg>`;
      favicon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
  }
}
