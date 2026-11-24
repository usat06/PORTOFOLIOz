import { useEffect, useState } from 'react';
import type { SiteConfig } from '../types/site';

interface BrandLogoProps {
  site: SiteConfig;
  size?: 'sm' | 'md';
}

export function BrandLogo({ site, size = 'md' }: BrandLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [site.logo?.imageUrl]);

  const logo = site.logo ?? {
    mode: 'monogram' as const,
    imageUrl: '',
    monogramText: 'UJ',
    shape: 'rounded' as const,
    fit: 'cover' as const,
    heightPx: 34,
  };

  const hasSuffix = site.brandSuffix.trim().length > 0;
  const baseHeight = size === 'sm' ? Math.max(24, Math.round(logo.heightPx * 0.8)) : logo.heightPx;
  const textSize = size === 'sm' ? 'text-[18px]' : 'text-[21px] md:text-[23px]';

  const shapeClass =
    logo.shape === 'circle'
      ? 'rounded-full'
      : logo.shape === 'square'
        ? 'rounded-none'
        : 'rounded-[6px]';

  const svgRx = logo.shape === 'circle' ? 18 : logo.shape === 'square' ? 0 : 6;
  const monogram = (logo.monogramText || 'UJ').trim().slice(0, 3).toUpperCase() || 'UJ';
  const showImage =
    (logo.mode === 'image' || logo.mode === 'image-only') && Boolean(logo.imageUrl.trim()) && !imgFailed;
  const showText = logo.mode !== 'image-only';

  const renderMonogramSvg = () => {
    if (monogram === 'UJ') {
      return (
        <svg
          viewBox="0 0 36 36"
          aria-hidden="true"
          style={{ height: baseHeight, width: baseHeight }}
          className="shrink-0"
        >
          <rect x="1" y="1" width="34" height="34" rx={svgRx} className="fill-ink" />
          <path
            d="M10 11v9.5c0 2.8 1.9 4.5 4.5 4.5s4.5-1.7 4.5-4.5V11"
            fill="none"
            stroke="var(--paper)"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <path
            d="M25 11.5v10c0 2.2-1.4 3.5-3.4 3.5"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <circle cx="25" cy="11.5" r="1.7" fill="var(--accent)" />
        </svg>
      );
    }

    const fontSize = monogram.length >= 3 ? 11 : monogram.length === 2 ? 14 : 17;
    return (
      <svg
        viewBox="0 0 36 36"
        aria-hidden="true"
        style={{ height: baseHeight, width: baseHeight }}
        className="shrink-0"
      >
        <rect x="1" y="1" width="34" height="34" rx={svgRx} className="fill-ink" />
        <text
          x="18"
          y="19"
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--paper)"
          fontSize={fontSize}
          fontWeight="700"
          letterSpacing="0.04em"
          fontFamily="var(--font-display), serif"
        >
          {monogram}
        </text>
        <circle cx="29" cy="7" r="2.2" fill="var(--accent)" />
      </svg>
    );
  };

  return (
    <span className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap">
      {logo.mode !== 'text-only' &&
        (showImage ? (
          <img
            src={logo.imageUrl}
            alt={site.brandName}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            style={{
              height: baseHeight,
              width: logo.mode === 'image-only' ? 'auto' : logo.fit === 'contain' ? 'auto' : baseHeight,
              maxWidth: logo.mode === 'image-only' ? 190 : 120,
            }}
            className={`shrink-0 ${
              logo.fit === 'contain' ? 'object-contain' : 'object-cover'
            } ${shapeClass}`}
          />
        ) : (
          renderMonogramSvg()
        ))}

      {showText && (
        <span className="flex flex-col leading-none">
          <span className={`font-serif tracking-[-0.045em] text-ink ${textSize}`}>
            {site.brandName}
            {hasSuffix && (
              <>
                <span className="text-accent">{site.brandDot}</span>
                {site.brandSuffix}
              </>
            )}
          </span>
          {size === 'md' && site.brandTagline.trim().length > 0 && (
            <span className="mt-1 hidden text-[9px] font-semibold uppercase tracking-[0.2em] text-muted sm:block">
              {site.brandTagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
