import type { ExtraBlockPlacement, SiteConfig } from '../types/site';

interface ExtraBlocksSectionProps {
  site: SiteConfig;
  placement: ExtraBlockPlacement;
}

export function ExtraBlocksSection({ site, placement }: ExtraBlocksSectionProps) {
  const blocks = site.extraBlocks.filter(
    (block) => block.visible && block.placement === placement,
  );

  if (blocks.length === 0) return null;

  return (
    <>
      {blocks.map((block) => (
        <section
          key={block.id}
          className="border-b border-line bg-paper py-14 sm:py-20 lg:py-24"
        >
          <div className="w-full px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1.4fr] md:gap-[8%]">
              <div>
                {block.eyebrow && (
                  <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-accent">
                    {block.eyebrow}
                  </div>
                )}
                <h2 className="mb-0 mt-3 font-serif text-[clamp(32px,4vw,56px)] font-normal leading-[1.15] tracking-[-0.035em] text-ink">
                  {block.title}
                </h2>
              </div>

              <div className="space-y-4 pt-1 text-[15px] leading-[1.85] text-ink/85">
                {block.body
                  .split(/\n{2,}/)
                  .map((paragraph) => paragraph.trim())
                  .filter(Boolean)
                  .map((paragraph, idx) => (
                    <p key={idx} className="m-0 whitespace-pre-line">
                      {paragraph}
                    </p>
                  ))}
              </div>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
