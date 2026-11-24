import { useEffect, useState } from 'react';
import { ArrowRight, Terminal } from 'lucide-react';
import type { HeroExtraText, SiteConfig } from '../types/site';

interface HeroProps {
  site: SiteConfig;
}

function isDarkHexColor(hex?: string): boolean {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex.trim())) return false;
  const clean = hex.trim().slice(1);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.45;
}

function renderExtraTexts(extraTexts: HeroExtraText[] | undefined, isDarkSurface: boolean) {
  if (!extraTexts || extraTexts.length === 0) return null;

  return (
    <div className="mb-3 space-y-2">
      {extraTexts
        .filter((item) => item.text.trim().length > 0)
        .map((item) => {
          if (item.variant === 'heading') {
            return (
              <div
                key={item.id}
                className={`font-serif text-[clamp(22px,2.8vw,34px)] font-bold uppercase leading-tight tracking-[-0.02em] ${
                  isDarkSurface ? 'text-white' : 'text-ink'
                }`}
              >
                {item.text}
              </div>
            );
          }

          if (item.variant === 'body') {
            return (
              <p
                key={item.id}
                className={`m-0 max-w-[440px] text-[13px] leading-relaxed ${
                  isDarkSurface ? 'text-white/90' : 'text-muted'
                }`}
              >
                {item.text}
              </p>
            );
          }

          return (
            <div
              key={item.id}
              className={`inline-block border-l-2 border-accent pl-3 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] ${
                isDarkSurface ? 'text-white' : 'text-ink'
              }`}
            >
              {item.text}
            </div>
          );
        })}
    </div>
  );
}

export function Hero({ site }: HeroProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);

  const { hero, design, typography } = site;

  useEffect(() => {
    setImageFailed(false);
  }, [hero.imageUrl, hero.mediaType]);

  useEffect(() => {
    setPortraitFailed(false);
  }, [hero.portraitUrl]);

  const headingSizeClass =
    typography.headingScale === 'compact'
      ? 'text-[clamp(44px,7vw,76px)] md:text-[clamp(56px,5.8vw,96px)]'
      : typography.headingScale === 'dramatic'
        ? 'text-[clamp(54px,11vw,108px)] md:text-[clamp(78px,8.2vw,138px)]'
        : 'text-[clamp(48px,9vw,88px)] md:text-[clamp(66px,6.8vw,116px)]';

  const glowPct = hero.glowIntensity ?? 32;
  const glowColor = hero.glowColor?.trim() || 'var(--accent)';
  const showGrid = hero.showGrid !== false;
  const gridOpacity = (hero.gridOpacity ?? 42) / 100;
  const backdropOpacity = (hero.backdropOpacity ?? 82) / 100;
  const overlayAlpha = (hero.overlayOpacity ?? 48) / 100;
  const customBg = hero.backgroundColor?.trim() || '';
  const customBgEnd = hero.backgroundGradientColor?.trim() || '';

  if (design.heroLayout === 'showcase') {
    const usePhotoBackdrop =
      hero.backdropMode === 'photo-cover' && !imageFailed && Boolean(hero.imageUrl);
    const contrastStyle = hero.textContrast ?? 'dark-scrim';
    const isDarkSurface =
      (usePhotoBackdrop && (contrastStyle === 'dark-scrim' || contrastStyle === 'card')) ||
      (!usePhotoBackdrop && isDarkHexColor(customBg || site.colors.paper));

    const sectionBackground =
      hero.backdropMode === 'solid-gradient' && customBg && customBgEnd
        ? `linear-gradient(135deg, ${customBg} 0%, ${customBgEnd} 100%)`
        : customBg || undefined;

    const fadeColor = customBg || 'var(--paper)';

    return (
      <section
        aria-labelledby="hero-title"
        style={{
          background: sectionBackground,
          backgroundColor: customBg || undefined,
        }}
        className={`relative min-h-[calc(100svh-64px)] w-full overflow-hidden border-b border-line md:min-h-[calc(100svh-76px)] ${
          !customBg ? 'bg-paper' : ''
        } ${isDarkSurface ? 'text-white' : 'text-ink'}`}
      >
        {/* Optional uploaded photo/video backdrop in photo-cover mode */}
        {usePhotoBackdrop && (
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{ opacity: backdropOpacity }}
          >
            {hero.mediaType === 'video' ? (
              <video
                src={hero.imageUrl}
                autoPlay
                muted
                loop
                playsInline
                onError={() => setImageFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={hero.imageUrl}
                alt={hero.alt}
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
                className="h-full w-full object-cover"
              />
            )}
          </div>
        )}

        {/* Scrim / Contrast Veil over Photo or Video Backdrop */}
        {usePhotoBackdrop && contrastStyle === 'dark-scrim' && overlayAlpha > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background: `linear-gradient(180deg, rgba(10,12,15,${Math.min(
                0.92,
                overlayAlpha + 0.12,
              ).toFixed(2)}) 0%, rgba(10,12,15,${(overlayAlpha * 0.72).toFixed(
                2,
              )}) 50%, rgba(10,12,15,${Math.min(0.95, overlayAlpha + 0.24).toFixed(2)}) 100%)`,
            }}
          />
        )}

        {usePhotoBackdrop && contrastStyle === 'light-scrim' && overlayAlpha > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              backgroundColor: 'var(--paper)',
              opacity: Math.min(0.9, overlayAlpha + 0.15),
            }}
          />
        )}

        {/* Subtle Informatics Blueprint Grid */}
        {showGrid && gridOpacity > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              opacity: gridOpacity,
              backgroundImage: isDarkSurface
                ? 'linear-gradient(to right, rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.16) 1px, transparent 1px)'
                : 'linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px)',
              backgroundSize: '72px 72px',
            }}
          />
        )}

        {/* Studio Radial Amber / Accent Glow */}
        {glowPct > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background: `radial-gradient(ellipse 68% 58% at 50% 42%, color-mix(in srgb, ${glowColor} ${Math.round(
                glowPct * 0.85,
              )}%, transparent) 0%, color-mix(in srgb, ${glowColor} ${Math.round(
                glowPct * 0.3,
              )}%, transparent) 44%, transparent 74%)`,
            }}
          />
        )}

        <div className="relative z-[3] flex min-h-[calc(100svh-64px)] w-full flex-col justify-between px-4 pb-6 pt-5 sm:px-6 sm:pb-8 sm:pt-6 md:min-h-[calc(100svh-76px)] md:px-10 md:pb-12 md:pt-8 lg:px-12 xl:px-16">
          {/* Top Technical Telemetry Line */}
          {(hero.indexLabel || hero.sideLabel) && (
            <div
              className={`flex flex-wrap items-center justify-between gap-3 border-b pb-3 font-mono text-[11px] uppercase tracking-[0.18em] ${
                isDarkSurface
                  ? 'border-white/20 text-white/75'
                  : 'border-line/70 text-muted'
              }`}
            >
              <span
                className={`inline-flex items-center gap-2 ${
                  isDarkSurface ? 'text-white' : 'text-ink/85'
                }`}
              >
                <Terminal className="h-3.5 w-3.5 text-accent" />
                {hero.indexLabel}
              </span>
              <span>{hero.sideLabel}</span>
            </div>
          )}

          {/* Expressive Serif Italic Greeting Layer Flanking Center Cutout */}
          {(hero.greetingLeft || hero.greetingRight) && (
            <div className="pointer-events-none relative z-[1] mt-6 grid grid-cols-2 items-center gap-4 md:mt-8">
              <div
                className={`text-left font-accent text-[clamp(36px,6vw,84px)] italic font-normal leading-none tracking-[-0.02em] md:pl-[8%] ${
                  isDarkSurface
                    ? 'text-white/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]'
                    : 'text-ink/90'
                }`}
              >
                {hero.greetingLeft}
              </div>
              <div
                className={`text-right font-accent text-[clamp(36px,6vw,84px)] italic font-normal leading-none tracking-[-0.02em] md:pr-[6%] ${
                  isDarkSurface
                    ? 'text-white/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]'
                    : 'text-ink/90'
                }`}
              >
                {hero.greetingRight}
              </div>
            </div>
          )}

          {/* Mid Info Row (Status Badge on Left, Bio Intro on Right) */}
          <div className="relative z-[4] my-auto grid grid-cols-1 items-start gap-6 py-6 md:grid-cols-12">
            <div
              className={`md:col-span-4 ${
                usePhotoBackdrop && contrastStyle === 'card'
                  ? 'bg-black/60 p-4 backdrop-blur-md'
                  : ''
              }`}
            >
              {hero.showStatusBadge && hero.statusBadge && (
                <div
                  className={`mb-4 inline-flex items-center gap-2.5 border px-3.5 py-2 text-[11px] font-semibold tracking-[0.06em] backdrop-blur-sm ${
                    isDarkSurface
                      ? 'border-white/25 bg-black/55 text-white'
                      : 'border-ink/15 bg-paper/95 text-ink'
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                  </span>
                  <span>{hero.statusBadge}</span>
                </div>
              )}

              {renderExtraTexts(hero.extraTexts, isDarkSurface)}

              {hero.eyebrow && (
                <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                  // {hero.eyebrow}
                </div>
              )}
            </div>

            <div className="md:col-span-4" />

            <div
              className={`p-4 backdrop-blur-sm md:col-span-4 md:text-right ${
                usePhotoBackdrop && contrastStyle === 'card'
                  ? 'bg-black/60 md:p-5'
                  : isDarkSurface
                    ? 'bg-black/35 md:bg-transparent md:p-0'
                    : 'bg-paper/80 md:bg-transparent md:p-0'
              }`}
            >
              {hero.description && (
                <p
                  className={`m-0 max-w-[330px] text-[14px] leading-[1.7] md:ml-auto md:text-[15px] ${
                    isDarkSurface ? 'text-white/90' : 'text-ink/85'
                  }`}
                >
                  {hero.description}
                </p>
              )}

              {(hero.ctaLabel || hero.secondaryCtaLabel) && (
                <div className="mt-5 flex flex-wrap items-center gap-5 md:justify-end">
                  {hero.ctaLabel && (
                    <a
                      href="#proyek"
                      className={`group inline-flex items-center gap-2.5 border px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] transition-colors ${
                        isDarkSurface
                          ? 'border-white bg-white text-black hover:border-accent hover:bg-accent hover:text-white'
                          : 'border-ink bg-ink text-paper hover:border-accent hover:bg-accent'
                      }`}
                    >
                      {hero.ctaLabel}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                    </a>
                  )}
                  {hero.secondaryCtaLabel && (
                    <a
                      href="#karya"
                      className={`inline-flex items-center border-b pb-1 text-[11px] font-bold uppercase tracking-[0.16em] transition-colors ${
                        isDarkSurface
                          ? 'border-white/60 text-white hover:border-accent hover:text-accent'
                          : 'border-ink/50 text-ink hover:border-accent hover:text-accent'
                      }`}
                    >
                      {hero.secondaryCtaLabel}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Oversized Bold Display Titles Flanking the Foreground Portrait */}
          <div className="relative z-[4] mt-auto grid grid-cols-1 items-end gap-4 pt-14 sm:pt-24 md:grid-cols-12 md:pt-10">
            <div className="md:col-span-7">
              {(hero.headlineLine1 || hero.headlineLine2) && (
                <h1
                  id="hero-title"
                  className={`m-0 font-serif font-bold uppercase leading-[0.88] tracking-[-0.03em] ${
                    isDarkSurface
                      ? 'text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.45)]'
                      : 'text-ink'
                  } ${headingSizeClass}`}
                >
                  {hero.headlineLine1}
                  {hero.headlineLine1 && hero.headlineLine2 && <br />}
                  {hero.headlineLine2}
                </h1>
              )}
            </div>

            {(hero.roleLine1 || hero.roleLine2) && (
              <div className="md:col-span-5 md:text-right">
                <div
                  className={`font-serif text-[clamp(26px,3.6vw,50px)] font-bold uppercase leading-[0.94] tracking-[-0.02em] ${
                    isDarkSurface ? 'text-white' : 'text-ink'
                  }`}
                >
                  {hero.roleLine1}
                  {hero.roleLine1 && hero.roleLine2 && <br />}
                  <span className="text-accent">{hero.roleLine2}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Centered Transparent Cutout Portrait Anchored Bottom Center */}
        {design.showPortrait && hero.portraitUrl && !portraitFailed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex h-[48%] items-end justify-center sm:h-[64%] md:h-[78%] lg:h-[84%]">
            <img
              src={hero.portraitUrl}
              alt={hero.portraitAlt}
              referrerPolicy="no-referrer"
              onError={() => setPortraitFailed(true)}
              className="h-full w-auto max-w-none select-none object-contain object-bottom drop-shadow-[0_22px_36px_rgba(0,0,0,0.28)]"
            />
            {!usePhotoBackdrop && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
                style={{
                  background: `linear-gradient(to top, ${fadeColor} 0%, transparent 100%)`,
                }}
              />
            )}
          </div>
        )}
      </section>
    );
  }

  if (design.heroLayout === 'split') {
    const splitSectionBg =
      hero.backdropMode === 'solid-gradient' && customBg && customBgEnd
        ? `linear-gradient(135deg, ${customBg} 0%, ${customBgEnd} 100%)`
        : customBg || undefined;
    const isSplitDark = isDarkHexColor(customBg || site.colors.paper);

    return (
      <section
        aria-labelledby="hero-title"
        style={{ background: splitSectionBg, backgroundColor: customBg || undefined }}
        className={`relative flex min-h-[calc(100svh-64px)] w-full flex-col justify-center border-b border-line py-8 sm:py-12 md:min-h-[calc(100svh-76px)] md:py-14 ${!customBg ? 'bg-paper' : ''} ${
          isSplitDark ? 'text-white' : 'text-ink'
        }`}
      >
        <div className="grid w-full flex-1 grid-cols-1 items-stretch gap-8 px-4 sm:px-6 md:grid-cols-12 md:gap-10 md:px-10 lg:px-12 xl:px-16">
          <div className="flex flex-col justify-between md:col-span-6 lg:col-span-7">
            <div className="my-auto py-4">
              {renderExtraTexts(hero.extraTexts, isSplitDark)}

              {hero.eyebrow && (
                <div className="flex items-center gap-[15px] font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-accent before:h-[1px] before:w-[35px] before:bg-current before:content-['']">
                  {hero.eyebrow}
                </div>
              )}

              {(hero.headlineLine1 || hero.headlineLine2) && (
                <h1
                  id="hero-title"
                  className={`mb-6 mt-5 font-serif font-bold uppercase leading-[0.95] tracking-[-0.03em] ${
                    isSplitDark ? 'text-white' : 'text-ink'
                  } ${headingSizeClass}`}
                >
                  {hero.headlineLine1}
                  {hero.headlineLine1 && hero.headlineLine2 && <br />}
                  {hero.headlineLine2}
                </h1>
              )}

              {hero.description && (
                <p
                  className={`mt-0 max-w-[440px] text-[15px] leading-[1.8] md:text-[16px] ${
                    isSplitDark ? 'text-white/85' : 'text-muted'
                  }`}
                >
                  {hero.description}
                </p>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-7">
                {hero.ctaLabel && (
                  <a
                    href="#proyek"
                    className={`group inline-flex items-center gap-4 border-b pb-[10px] text-[11px] font-bold uppercase tracking-[0.19em] transition-colors duration-200 hover:border-accent hover:text-accent ${
                      isSplitDark ? 'border-white/80 text-white' : 'border-ink text-ink'
                    }`}
                  >
                    {hero.ctaLabel}
                    <ArrowRight className="h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-[5px]" />
                  </a>
                )}
                {hero.secondaryCtaLabel && (
                  <a
                    href="#karya"
                    className={`inline-flex items-center border-b border-transparent pb-[10px] text-[11px] font-bold uppercase tracking-[0.19em] transition-colors duration-200 hover:border-accent hover:text-accent ${
                      isSplitDark ? 'text-white/75' : 'text-muted'
                    }`}
                  >
                    {hero.secondaryCtaLabel}
                  </a>
                )}
              </div>
            </div>
            <div
              className={`mt-8 flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.18em] ${
                isSplitDark ? 'text-white/70' : 'text-muted'
              }`}
            >
              <span className="tabular-nums">{hero.indexLabel}</span>
              <span aria-hidden="true" className="h-[1px] w-6 bg-line" />
              <span>{hero.sideLabel}</span>
            </div>
          </div>

          <div className="relative min-h-[320px] overflow-hidden bg-[#323b39] sm:min-h-[420px] md:col-span-6 md:min-h-[calc(100svh-190px)] lg:col-span-5">
            {!imageFailed && hero.imageUrl ? (
              hero.mediaType === 'video' ? (
                <video
                  src={hero.imageUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  onError={() => setImageFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={hero.imageUrl}
                  alt={hero.alt}
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                  className="h-full w-full object-cover"
                />
              )
            ) : (
              <div className="h-full w-full bg-paper-alt" />
            )}

            {design.showPortrait && hero.portraitUrl && !portraitFailed && (
              <div className="pointer-events-none absolute bottom-0 right-0 z-[2] flex h-[74%] w-full justify-end px-4">
                <img
                  src={hero.portraitUrl}
                  alt={hero.portraitAlt}
                  referrerPolicy="no-referrer"
                  onError={() => setPortraitFailed(true)}
                  className="h-full w-auto max-w-none select-none object-contain object-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
                />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (design.heroLayout === 'minimal') {
    const minimalBg =
      hero.backdropMode === 'solid-gradient' && customBg && customBgEnd
        ? `linear-gradient(135deg, ${customBg} 0%, ${customBgEnd} 100%)`
        : customBg || undefined;
    const isMinimalDark = isDarkHexColor(customBg || site.colors.paper);

    return (
      <section
        aria-labelledby="hero-title"
        style={{ background: minimalBg, backgroundColor: customBg || undefined }}
        className={`relative flex min-h-[calc(100svh-64px)] w-full items-center border-b border-line py-12 sm:py-16 md:min-h-[calc(100svh-76px)] md:py-20 ${!customBg ? 'bg-paper' : ''} ${
          isMinimalDark ? 'text-white' : 'text-ink'
        }`}
      >
        <div className="w-full px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16">
          <div className="flex flex-col justify-between gap-10 md:flex-row md:items-end">
            <div className="max-w-[860px]">
              {renderExtraTexts(hero.extraTexts, isMinimalDark)}

              {hero.eyebrow && (
                <div className="flex items-center gap-[15px] font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-accent before:h-[1px] before:w-[35px] before:bg-current before:content-['']">
                  {hero.eyebrow}
                </div>
              )}

              {(hero.headlineLine1 || hero.headlineLine2) && (
                <h1
                  id="hero-title"
                  className={`mb-6 mt-5 font-serif font-bold uppercase leading-[0.95] tracking-[-0.03em] ${
                    isMinimalDark ? 'text-white' : 'text-ink'
                  } ${headingSizeClass}`}
                >
                  {hero.headlineLine1}
                  {hero.headlineLine1 && hero.headlineLine2 && <br />}
                  {hero.headlineLine2}
                </h1>
              )}

              {hero.description && (
                <p
                  className={`mt-0 max-w-[460px] text-[16px] leading-[1.8] ${
                    isMinimalDark ? 'text-white/85' : 'text-muted'
                  }`}
                >
                  {hero.description}
                </p>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-7">
                {hero.ctaLabel && (
                  <a
                    href="#proyek"
                    className={`group inline-flex items-center gap-4 border-b pb-[10px] text-[11px] font-bold uppercase tracking-[0.19em] transition-colors duration-200 hover:border-accent hover:text-accent ${
                      isMinimalDark ? 'border-white/80 text-white' : 'border-ink text-ink'
                    }`}
                  >
                    {hero.ctaLabel}
                    <ArrowRight className="h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-[5px]" />
                  </a>
                )}
                {hero.secondaryCtaLabel && (
                  <a
                    href="#karya"
                    className={`inline-flex items-center border-b border-transparent pb-[10px] text-[11px] font-bold uppercase tracking-[0.19em] transition-colors duration-200 hover:border-accent hover:text-accent ${
                      isMinimalDark ? 'text-white/75' : 'text-muted'
                    }`}
                  >
                    {hero.secondaryCtaLabel}
                  </a>
                )}
              </div>
            </div>

            {design.showPortrait && hero.portraitUrl && !portraitFailed && (
              <div className="relative h-[260px] w-[220px] shrink-0 overflow-hidden bg-paper-alt md:h-[340px] md:w-[280px] lg:h-[400px] lg:w-[330px]">
                <img
                  src={hero.portraitUrl}
                  alt={hero.portraitAlt}
                  referrerPolicy="no-referrer"
                  onError={() => setPortraitFailed(true)}
                  className="h-full w-full object-contain object-bottom pt-4"
                />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  const contrastStyle = hero.textContrast ?? 'dark-scrim';
  const fullbleedBg = customBg || '#1e1e1c';

  return (
    <section
      aria-labelledby="hero-title"
      style={{ backgroundColor: fullbleedBg }}
      className="relative h-[calc(100svh-64px)] min-h-[520px] w-full overflow-hidden text-white md:h-[calc(100svh-76px)]"
    >
      {hero.backdropMode !== 'solid-gradient' && !imageFailed && hero.imageUrl ? (
        hero.mediaType === 'video' ? (
          <video
            src={hero.imageUrl}
            autoPlay
            muted
            loop
            playsInline
            onError={() => setImageFailed(true)}
            style={{ opacity: backdropOpacity }}
            className="absolute inset-0 block h-full w-full object-cover object-[58%_center] md:object-center"
          />
        ) : (
          <img
            src={hero.imageUrl}
            alt={hero.alt}
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            style={{ opacity: backdropOpacity }}
            className="absolute inset-0 block h-full w-full object-cover object-[58%_center] md:object-center"
          />
        )
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          style={{
            background:
              hero.backdropMode === 'solid-gradient' && customBg && customBgEnd
                ? `linear-gradient(135deg, ${customBg} 0%, ${customBgEnd} 100%)`
                : customBg ||
                  'radial-gradient(circle at 70% 35%, #4a5754 0%, #2d3533 55%, #1b2120 100%)',
          }}
        />
      )}

      {contrastStyle !== 'none' && overlayAlpha > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              contrastStyle === 'light-scrim'
                ? `rgba(255,255,255,${(overlayAlpha * 0.45).toFixed(2)})`
                : `linear-gradient(90deg, rgba(12,14,15,${Math.min(
                    0.94,
                    overlayAlpha + 0.3,
                  ).toFixed(2)}) 0%, rgba(12,14,15,${overlayAlpha.toFixed(
                    2,
                  )}) 48%, rgba(12,14,15,${(overlayAlpha * 0.25).toFixed(
                    2,
                  )}) 100%), linear-gradient(0deg, rgba(8,10,12,${overlayAlpha.toFixed(
                    2,
                  )}), transparent 45%)`,
          }}
        />
      )}

      {design.showPortrait && hero.portraitUrl && !portraitFailed && (
        <div className="pointer-events-none absolute bottom-0 right-0 z-[2] flex h-[38%] w-full justify-end px-3 sm:h-[48%] md:right-[3%] md:h-[78%] md:w-auto md:px-0 lg:right-[5%] lg:h-[86%]">
          <img
            src={hero.portraitUrl}
            alt={hero.portraitAlt}
            referrerPolicy="no-referrer"
            onError={() => setPortraitFailed(true)}
            className="h-full w-auto max-w-none select-none object-contain object-bottom brightness-[0.96] contrast-[1.03] drop-shadow-[0_24px_48px_rgba(0,0,0,0.55)]"
          />
        </div>
      )}

      <div className="relative z-[3] flex h-full w-full flex-col justify-between px-4 pb-6 pt-6 sm:px-6 md:px-10 md:pb-10 md:pt-8 lg:px-12 xl:px-16">
        <div
          className={`max-w-[540px] md:my-auto md:max-w-[640px] lg:max-w-[700px] ${
            contrastStyle === 'card'
              ? 'bg-black/55 p-6 backdrop-blur-md md:p-8'
              : ''
          }`}
        >
          {renderExtraTexts(hero.extraTexts, true)}

          {hero.eyebrow && (
            <div className="flex items-center gap-[15px] font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-white/95 before:h-[1px] before:w-[35px] before:bg-current before:content-['']">
              {hero.eyebrow}
            </div>
          )}

          {(hero.headlineLine1 || hero.headlineLine2) && (
            <h1
              id="hero-title"
              className={`mb-4 mt-4 font-serif font-bold uppercase leading-[0.94] tracking-[-0.03em] text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.35)] md:mb-[24px] md:mt-[20px] ${headingSizeClass}`}
            >
              {hero.headlineLine1}
              {hero.headlineLine1 && hero.headlineLine2 && <br />}
              {hero.headlineLine2}
            </h1>
          )}

          {hero.description && (
            <p className="mt-0 max-w-[360px] text-[14px] leading-[1.7] text-[#f4f1eb] md:max-w-[440px] md:text-[16px] md:leading-[1.8]">
              {hero.description}
            </p>
          )}

          {(hero.ctaLabel || hero.secondaryCtaLabel) && (
            <div className="mt-5 flex flex-wrap items-center gap-7 md:mt-[30px]">
              {hero.ctaLabel && (
                <a
                  href="#proyek"
                  className="group inline-flex items-center gap-4 border-b border-white/80 pb-[10px] text-[11px] font-bold uppercase tracking-[0.19em] text-white transition-colors duration-200 hover:border-white"
                >
                  {hero.ctaLabel}
                  <ArrowRight className="h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-[5px]" />
                </a>
              )}
              {hero.secondaryCtaLabel && (
                <a
                  href="#karya"
                  className="inline-flex items-center border-b border-transparent pb-[10px] text-[11px] font-bold uppercase tracking-[0.19em] text-white/85 transition-colors duration-200 hover:border-white/70 hover:text-white"
                >
                  {hero.secondaryCtaLabel}
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/90">
          <span className="tabular-nums">{hero.indexLabel}</span>
          <span aria-hidden="true" className="hidden h-[1px] w-6 bg-white/40 sm:inline-block" />
          <span className="hidden sm:inline">{hero.sideLabel}</span>
        </div>
      </div>
    </section>
  );
}
