import type { SiteConfig } from '../types/site';

interface SkillsSectionProps {
  site: SiteConfig;
}

export function SkillsSection({ site }: SkillsSectionProps) {
  const countSuffix = site.uiLabels?.skillsCountSuffix || 'Program & Teknologi';

  return (
    <section
      id="keahlian"
      aria-labelledby="skills-title"
      className="scroll-mt-20 border-b border-line bg-paper py-[85px] md:py-[120px]"
    >
      <div className="mx-auto max-w-[1500px] px-[5.5%]">
        <div className="mb-14 text-center md:mb-16">
          {site.skillsEyebrow && (
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-accent">
              {site.skillsEyebrow}
            </div>
          )}
          <h2
            id="skills-title"
            className="mb-0 mt-4 font-serif text-[clamp(38px,5vw,72px)] font-bold uppercase leading-[0.98] tracking-[-0.025em] text-ink"
          >
            {site.skillsTitle}
          </h2>
          {site.skillsNote && (
            <p className="mx-auto mb-0 mt-4 max-w-[540px] text-[14px] leading-[1.75] text-muted">
              {site.skillsNote}
            </p>
          )}
        </div>

        {/* 4-Column Numbered Reference Layout */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {site.skills.map((skill, index) => (
            <article
              key={skill.id}
              className="flex flex-col justify-between border-l border-line pl-6 transition-colors duration-200 hover:border-accent"
            >
              <div>
                <div className="mb-5 font-serif text-[42px] font-bold leading-none tracking-[-0.02em] text-ink/20 tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <h3 className="mb-2.5 mt-0 font-serif text-[22px] font-bold uppercase tracking-[-0.01em] text-ink md:text-[24px]">
                  {skill.title}
                </h3>
                <p className="mb-5 mt-0 text-[13px] leading-[1.75] text-muted">
                  {skill.summary}
                </p>
              </div>

              <ul className="m-0 list-none space-y-2 border-t border-line/70 p-0 pt-4">
                {skill.items.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2.5 text-[13px] font-medium text-ink/90"
                  >
                    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        {site.programs.length > 0 && (
          <div className="mt-20">
            <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4 border-b border-ink pb-4">
              <h3 className="m-0 font-serif text-[clamp(28px,3.2vw,42px)] font-bold uppercase tracking-[-0.02em] text-ink">
                {site.programsTitle}
              </h3>
              <span className="font-mono text-[11px] tabular-nums uppercase tracking-[0.16em] text-muted">
                {site.programs.length} {countSuffix}
              </span>
            </div>

            <div className="divide-y divide-line border-b border-line">
              {site.programs.map((program) => (
                <div
                  key={program.id}
                  className="grid grid-cols-1 items-center gap-2 py-4 transition-colors hover:bg-paper-alt/60 sm:grid-cols-12 sm:px-2"
                >
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:col-span-4">
                    {program.category}
                  </div>
                  <div className="text-[15px] font-bold text-ink sm:col-span-5">
                    {program.name}
                  </div>
                  <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent sm:col-span-3 sm:text-right">
                    {program.level}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
