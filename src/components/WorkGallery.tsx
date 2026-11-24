import { useEffect, useMemo, useState } from 'react';
import { Camera, Play } from 'lucide-react';
import type { PortfolioWork, SiteConfig } from '../types/site';

interface WorkGalleryProps {
  site: SiteConfig;
  onSelectWork: (work: PortfolioWork, visibleWorks: PortfolioWork[]) => void;
}

export function WorkGallery({ site, onSelectWork }: WorkGalleryProps) {
  const [activeFilter, setActiveFilter] = useState<string>('semua');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setFailedImages({});
  }, [site.works]);

  const allLabel = site.uiLabels?.workAllFilterLabel || 'Semua';
  const emptyText = site.uiLabels?.workEmptyText || 'Belum ada karya pada kategori ini.';

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of site.works) {
      if (!map.has(item.category)) {
        map.set(item.category, item.categoryLabel);
      }
    }
    return [
      { id: 'semua', label: allLabel },
      ...Array.from(map.entries()).map(([id, label]) => ({ id, label })),
    ];
  }, [site.works, allLabel]);

  const effectiveFilter = categories.some((cat) => cat.id === activeFilter) ? activeFilter : 'semua';

  const visibleWorks =
    effectiveFilter === 'semua'
      ? site.works
      : site.works.filter((item) => item.category === effectiveFilter);

  const handleImageError = (id: string) => {
    setFailedImages((prev) => ({ ...prev, [id]: true }));
  };

  const radiusClass =
    site.design.cardRadius === 'editorial'
      ? 'rounded-2xl'
      : site.design.cardRadius === 'soft'
        ? 'rounded-lg'
        : 'rounded-none';

  const gridClass =
    site.design.galleryLayout === 'uniform-3'
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
      : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3';

  return (
    <section
      id="karya"
      aria-labelledby="work-title"
      className="scroll-mt-16 border-b border-line bg-paper-alt/40 py-14 pb-16 sm:py-20 sm:pb-24 md:scroll-mt-20 lg:py-24 lg:pb-28 2xl:py-28"
    >
      <div className="w-full px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16">
        <div className="mb-10 text-center md:mb-12">
          {site.workEyebrow && (
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-accent">
              {site.workEyebrow}
            </div>
          )}
          <h2
            id="work-title"
            className="mb-0 mt-4 font-serif text-[clamp(38px,5vw,72px)] font-bold uppercase leading-[0.98] tracking-[-0.025em] text-ink"
          >
            {site.workTitle}
          </h2>
          {site.workNote && (
            <p className="mx-auto mb-0 mt-4 max-w-[540px] text-[14px] leading-[1.75] text-muted">
              {site.workNote}
            </p>
          )}
        </div>

        <div
          role="group"
          aria-label="Filter kategori karya"
          className="mb-[42px] flex flex-wrap justify-center gap-x-[24px] gap-y-[12px] border-y border-line py-[18px] sm:gap-x-[34px]"
        >
          {categories.map((option) => {
            const isSelected = effectiveFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setActiveFilter(option.id)}
                className={`relative shrink-0 whitespace-nowrap border-0 bg-transparent px-0 py-[5px] font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors duration-200 ${
                  isSelected
                    ? "text-ink after:absolute after:-bottom-[6px] after:left-0 after:right-0 after:h-[2px] after:bg-accent after:content-['']"
                    : 'text-muted hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {visibleWorks.length === 0 ? (
          <div className="border border-line bg-paper px-6 py-16 text-center">
            <p className="m-0 font-serif text-2xl uppercase text-ink">{emptyText}</p>
          </div>
        ) : (
          <div
            className={`grid gap-10 sm:gap-x-[20px] sm:gap-y-[38px] md:gap-x-[28px] md:gap-y-[56px] ${gridClass}`}
          >
            {visibleWorks.map((work) => {
              const hasFailed = Boolean(failedImages[work.id]);
              const aspectClass =
                site.design.galleryLayout === 'editorial'
                  ? work.aspectClass
                  : 'aspect-[4/3]';

              return (
                <article key={work.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectWork(work, visibleWorks)}
                    aria-label={`Perbesar ${work.mediaType === 'video' ? 'video' : 'foto'} ${work.title}`}
                    className={`group relative block w-full overflow-hidden border border-line bg-line p-0 text-left ${aspectClass} ${radiusClass}`}
                  >
                    {!hasFailed ? (
                      work.mediaType === 'video' ? (
                        <>
                          <video
                            src={work.imageUrl}
                            muted
                            loop
                            playsInline
                            autoPlay
                            onError={() => handleImageError(work.id)}
                            className="block h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
                          >
                            <Play className="h-4 w-4 fill-current" />
                          </span>
                        </>
                      ) : (
                        <img
                          src={work.imageUrl}
                          alt={work.alt}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={() => handleImageError(work.id)}
                          className="block h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035]"
                        />
                      )
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-paper-alt px-6 text-center text-muted">
                        <Camera className="h-7 w-7 stroke-[1.5]" />
                        <span className="font-serif text-[20px] uppercase text-ink">{work.title}</span>
                      </div>
                    )}
                  </button>

                  <div className="block items-baseline justify-between gap-4 pt-[16px] md:flex">
                    <h3 className="mb-[5px] mt-0 font-serif text-[21px] font-bold uppercase tracking-[-0.015em] text-ink md:mb-0 md:text-[24px]">
                      {work.title}
                    </h3>
                    <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.17em] text-muted">
                      {work.categoryLabel}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
