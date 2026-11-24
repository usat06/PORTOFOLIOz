import { useEffect, useState } from 'react';
import { Terminal } from 'lucide-react';
import type { SiteConfig } from '../types/site';
import { CloudImg } from './CloudMedia';

interface AboutSectionProps {
  site: SiteConfig;
}

export function AboutSection({ site }: AboutSectionProps) {
  const [showcaseFailed, setShowcaseFailed] = useState(false);

  useEffect(() => {
    setShowcaseFailed(false);
  }, [site.about.showcaseImageUrl]);

  const stats = site.about.stats ?? [];
  const codeLines = site.about.codeLines ?? [];

  const radiusClass =
    site.design.cardRadius === 'editorial'
      ? 'rounded-2xl'
      : site.design.cardRadius === 'soft'
        ? 'rounded-lg'
        : 'rounded-none';

  return (
    <section
      id="tentang"
      aria-labelledby="about-title"
      className="relative scroll-mt-16 overflow-hidden border-b border-line bg-paper-alt/60 py-14 transition-colors duration-200 sm:py-20 md:scroll-mt-20 lg:py-24 2xl:py-28"
    >
      <div className="w-full px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16">
        <div className="mb-12 text-center md:mb-16">
          {site.about.eyebrow && (
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-accent">
              {site.about.eyebrow}
            </div>
          )}
          <h2
            id="about-title"
            className="mx-auto mb-0 mt-4 max-w-[820px] font-serif text-[clamp(38px,5vw,72px)] font-bold uppercase leading-[0.98] tracking-[-0.025em] text-ink"
          >
            {site.about.title}
          </h2>
        </div>

        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-6">
            {site.about.statement && (
              <p className="mb-5 mt-0 text-[clamp(20px,2.2vw,28px)] font-semibold leading-[1.35] tracking-[-0.02em] text-ink">
                {site.about.statement}
              </p>
            )}
            {site.about.description && (
              <p className="m-0 max-w-[600px] text-[15px] leading-[1.85] text-muted">
                {site.about.description}
              </p>
            )}

            {stats.length > 0 && (
              <div className="mt-9 grid grid-cols-2 gap-6 border-t border-line pt-7 sm:grid-cols-3">
                {stats.map((stat, idx) => (
                  <div key={`${stat.label}-${idx}`}>
                    <div className="font-serif text-[clamp(36px,4vw,54px)] font-bold leading-none tracking-[-0.02em] text-ink tabular-nums">
                      {stat.value}
                    </div>
                    <div className="mt-2 text-[12px] font-medium text-muted">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}

            {site.about.facts.length > 0 && (
              <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-line pt-6 sm:grid-cols-2">
                {site.about.facts.map((fact, idx) => (
                  <div key={`${fact.label}-${idx}`}>
                    <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                      {fact.label}
                    </dt>
                    <dd className="m-0 mt-1 text-[14px] font-semibold text-ink">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div className="space-y-5 lg:col-span-6">
            {site.about.showcaseImageUrl && !showcaseFailed && (
              <div className={`overflow-hidden border border-line bg-paper ${radiusClass}`}>
                <CloudImg
                  src={site.about.showcaseImageUrl}
                  alt={site.about.title}
                  referrerPolicy="no-referrer"
                  onError={() => setShowcaseFailed(true)}
                  className="aspect-[16/10] w-full object-cover"
                />
              </div>
            )}

            <div className={`overflow-hidden border border-ink/15 bg-[#12141a] text-[#e5e7eb] shadow-[0_20px_45px_rgba(0,0,0,0.12)] ${radiusClass}`}>
              <div className="flex items-center justify-between border-b border-white/10 bg-[#191c24] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]/85" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]/85" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]/85" />
                </div>
                <div className="inline-flex items-center gap-2 font-mono text-[11px] text-white/75">
                  <Terminal className="h-3.5 w-3.5 text-accent" />
                  <span>{site.about.codeTitle || 'usat_jalung.profile.ts'}</span>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                  TS
                </span>
              </div>

              <div className="overflow-x-auto p-5 font-mono text-[12px] leading-[1.85] sm:p-6 sm:text-[13px]">
                {codeLines.map((line, i) => (
                  <div key={i} className="flex gap-4 whitespace-pre">
                    <span className="w-5 shrink-0 select-none text-right text-white/25 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="text-[#f4f4f6]">{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
