import { useEffect, useState } from 'react';
import { ArrowUpRight, FolderGit2, Play } from 'lucide-react';
import type { PortfolioWork, ProjectItem, SiteConfig } from '../types/site';

interface ProjectsSectionProps {
  site: SiteConfig;
  onInspectMedia: (work: PortfolioWork) => void;
}

export function ProjectsSection({ site, onInspectMedia }: ProjectsSectionProps) {
  const [failedMedia, setFailedMedia] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setFailedMedia({});
  }, [site.projects]);
  const radiusClass =
    site.design.cardRadius === 'editorial'
      ? 'rounded-2xl'
      : site.design.cardRadius === 'soft'
        ? 'rounded-lg'
        : 'rounded-none';

  const viewLabel = site.uiLabels?.projectsViewLabel || 'Tinjau Proyek';
  const emptyText = site.uiLabels?.projectsEmptyText || 'Belum ada proyek yang ditambahkan.';

  const handleOpenMedia = (project: ProjectItem) => {
    if (!project.imageUrl) return;
    onInspectMedia({
      id: project.id,
      title: project.title,
      category: 'proyek',
      categoryLabel: `${project.role} · ${project.year}`,
      imageUrl: project.imageUrl,
      mediaType: project.mediaType,
      alt: project.title,
      aspectClass: 'aspect-[16/10]',
    });
  };

  return (
    <section
      id="proyek"
      aria-labelledby="projects-title"
      className="scroll-mt-20 border-b border-line bg-paper-alt/55 py-[85px] md:py-[120px]"
    >
      <div className="mx-auto max-w-[1500px] px-[5.5%]">
        <div className="mb-12 text-center md:mb-16">
          {site.projectsEyebrow && (
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-accent">
              {site.projectsEyebrow}
            </div>
          )}
          <h2
            id="projects-title"
            className="mb-0 mt-4 font-serif text-[clamp(38px,5vw,72px)] font-bold uppercase leading-[0.98] tracking-[-0.025em] text-ink"
          >
            {site.projectsTitle}
          </h2>
          {site.projectsNote && (
            <p className="mx-auto mb-0 mt-4 max-w-[540px] text-[14px] leading-[1.75] text-muted">
              {site.projectsNote}
            </p>
          )}
        </div>

        {site.projects.length === 0 ? (
          <div className="border border-line bg-paper px-6 py-12 text-center text-sm text-muted">
            {emptyText}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {site.projects.map((project, index) => (
              <article
                key={project.id}
                className={`flex flex-col justify-between overflow-hidden border border-line bg-paper transition-colors duration-200 hover:border-ink/40 ${radiusClass} ${
                  index === 0 && site.projects.length % 2 === 1 ? 'md:col-span-2' : ''
                }`}
              >
                <div>
                  {project.imageUrl &&
                    (failedMedia[project.id] ? (
                      <div className="flex aspect-[16/10] w-full items-center justify-center border-b border-line bg-paper-alt text-muted">
                        <FolderGit2 className="h-8 w-8 stroke-[1.5]" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenMedia(project)}
                        aria-label={`Lihat pratinjau proyek ${project.title}`}
                        className="group relative block aspect-[16/10] w-full overflow-hidden border-0 border-b border-line bg-line p-0 text-left"
                      >
                        {project.mediaType === 'video' ? (
                          <>
                            <video
                              src={project.imageUrl}
                              muted
                              loop
                              playsInline
                              autoPlay
                              onError={() => setFailedMedia((prev) => ({ ...prev, [project.id]: true }))}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                            <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white">
                              <Play className="h-4 w-4 fill-current" />
                            </span>
                          </>
                        ) : (
                          <img
                            src={project.imageUrl}
                            alt={project.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={() => setFailedMedia((prev) => ({ ...prev, [project.id]: true }))}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        )}
                      </button>
                    ))}

                  <div className="p-6 md:p-8">
                    <div className="mb-3 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                      <span className="font-bold tabular-nums text-accent">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span aria-hidden="true">/</span>
                      <span>{project.role}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{project.year}</span>
                    </div>

                    <h3 className="mb-3 mt-0 font-serif text-[26px] font-bold uppercase tracking-[-0.015em] text-ink md:text-[32px]">
                      {project.title}
                    </h3>

                    <p className="m-0 text-[14px] leading-[1.75] text-muted md:text-[15px]">
                      {project.summary}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line/70 px-6 py-4 md:px-8">
                  <div className="flex flex-wrap gap-2">
                    {project.techStack.map((tech, idx) => (
                      <span
                        key={`${tech}-${idx}`}
                        className="border border-line bg-paper-alt px-2 py-0.5 font-mono text-[11px] text-ink/85"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>

                  {project.linkUrl && (
                    <a
                      href={project.linkUrl}
                      target={project.linkUrl.startsWith('http') ? '_blank' : undefined}
                      rel={project.linkUrl.startsWith('http') ? 'noreferrer' : undefined}
                      className="inline-flex shrink-0 items-center gap-1.5 border-b border-ink pb-0.5 text-[11px] font-bold uppercase tracking-[0.16em] text-ink transition-colors hover:border-accent hover:text-accent"
                    >
                      {viewLabel}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
