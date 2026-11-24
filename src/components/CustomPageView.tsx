import { useEffect, useState } from 'react';
import { ArrowLeft, Camera, Play } from 'lucide-react';
import type { CustomPage, PortfolioWork, SiteConfig } from '../types/site';
import { CloudImg, CloudVideo } from './CloudMedia';

interface CustomPageViewProps {
  page: CustomPage;
  site: SiteConfig;
  onBackHome: () => void;
  onSelectWork: (work: PortfolioWork, visibleWorks: PortfolioWork[]) => void;
}

export function CustomPageView({ page, site, onBackHome, onSelectWork }: CustomPageViewProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [failedWorks, setFailedWorks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCoverFailed(false);
    setFailedWorks({});
  }, [page.id, page.coverUrl, page.coverMediaType]);

  const attachedWorks = site.works.filter((item) => page.mediaIds.includes(item.id));
  const paragraphs = page.content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <article className="min-h-[calc(100svh-64px)] py-10 sm:py-14 md:min-h-[calc(100svh-76px)] lg:py-20">
      <div className="w-full px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16">
        <button
          type="button"
          onClick={onBackHome}
          className="mb-8 inline-flex items-center gap-3 border-0 bg-transparent p-0 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted transition-colors hover:text-accent sm:mb-10"
        >
          <ArrowLeft className="h-4 w-4" />
          {site.uiLabels?.pageBackLabel || 'Kembali ke Beranda'}
        </button>

        {page.eyebrow && (
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-accent">
            {page.eyebrow}
          </div>
        )}

        <h1 className="mb-6 mt-4 font-serif text-[clamp(36px,6vw,84px)] font-bold uppercase leading-[1.0] tracking-[-0.025em] text-ink">
          {page.title}
        </h1>

        {page.lead && (
          <p className="mb-10 max-w-[820px] font-accent text-[clamp(22px,2.8vw,36px)] italic leading-[1.35] text-ink/90">
            {page.lead}
          </p>
        )}

        {page.coverUrl && !coverFailed && (
          <div className="mb-10 overflow-hidden bg-paper-alt sm:mb-12">
            {page.coverMediaType === 'video' ? (
              <CloudVideo
                src={page.coverUrl}
                controls
                playsInline
                onError={() => setCoverFailed(true)}
                className="max-h-[75svh] w-full object-cover"
              />
            ) : (
              <CloudImg
                src={page.coverUrl}
                alt={page.title}
                referrerPolicy="no-referrer"
                onError={() => setCoverFailed(true)}
                className="max-h-[75svh] w-full object-cover"
              />
            )}
          </div>
        )}

        {paragraphs.length > 0 && (
          <div className="max-w-[820px] space-y-6 text-[16px] leading-[1.9] text-ink/85">
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="m-0 whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </div>
        )}

        {attachedWorks.length > 0 && (
          <div className="mt-14 border-t border-line pt-10 sm:mt-16 sm:pt-12">
            <h2 className="mb-8 font-serif text-3xl font-bold uppercase tracking-[-0.02em] text-ink">
              {site.uiLabels?.pageRelatedGalleryLabel || 'Galeri Terkait'}
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 xl:grid-cols-3">
              {attachedWorks.map((work) => {
                const isFailed = Boolean(failedWorks[work.id]);
                return (
                  <article key={work.id}>
                    <button
                      type="button"
                      onClick={() => onSelectWork(work, attachedWorks)}
                      className="group relative block aspect-[4/3] w-full overflow-hidden border-0 bg-line p-0 text-left"
                    >
                      {!isFailed ? (
                        work.mediaType === 'video' ? (
                          <>
                            <CloudVideo
                              src={work.imageUrl}
                              muted
                              loop
                              playsInline
                              autoPlay
                              onError={() => setFailedWorks((prev) => ({ ...prev, [work.id]: true }))}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                            <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white">
                              <Play className="h-4 w-4 fill-current" />
                            </span>
                          </>
                        ) : (
                          <CloudImg
                            src={work.imageUrl}
                            alt={work.alt}
                            referrerPolicy="no-referrer"
                            onError={() => setFailedWorks((prev) => ({ ...prev, [work.id]: true }))}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        )
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-paper-alt text-muted">
                          <Camera className="h-6 w-6 stroke-[1.5]" />
                          <span className="font-serif text-lg uppercase text-ink">{work.title}</span>
                        </div>
                      )}
                    </button>
                    <div className="flex items-baseline justify-between gap-4 pt-4">
                      <h3 className="m-0 font-serif text-xl font-bold uppercase text-ink">{work.title}</h3>
                      <span className="font-mono text-[10px] uppercase tracking-[0.17em] text-muted">
                        {work.categoryLabel}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
