import { useEffect, useState } from 'react';
import { Award, ExternalLink } from 'lucide-react';
import type { CertificateItem, PortfolioWork, SiteConfig } from '../types/site';

interface CertificatesSectionProps {
  site: SiteConfig;
  onInspectCertificate: (work: PortfolioWork, allCerts: PortfolioWork[]) => void;
}

export function CertificatesSection({ site, onInspectCertificate }: CertificatesSectionProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setFailedImages({});
  }, [site.certificates]);
  const radiusClass =
    site.design.cardRadius === 'editorial'
      ? 'rounded-2xl'
      : site.design.cardRadius === 'soft'
        ? 'rounded-lg'
        : 'rounded-none';

  const verifyLabel = site.uiLabels?.certificatesVerifyLabel || 'Verifikasi';
  const idPrefix = site.uiLabels?.certificatesIdPrefix || 'ID:';
  const emptyText = site.uiLabels?.certificatesEmptyText || 'Belum ada sertifikat yang ditambahkan.';

  const toWorkItem = (cert: CertificateItem): PortfolioWork => ({
    id: cert.id,
    title: cert.title,
    category: 'sertifikat',
    categoryLabel: `${cert.issuer} · ${cert.year}`,
    imageUrl: cert.imageUrl,
    mediaType: 'image',
    alt: cert.title,
    aspectClass: 'aspect-[4/3]',
  });

  const allCertWorks = site.certificates.filter((c) => Boolean(c.imageUrl)).map(toWorkItem);

  return (
    <section
      id="sertifikat"
      aria-labelledby="certificates-title"
      className="scroll-mt-20 border-b border-line bg-paper py-[85px] md:py-[120px]"
    >
      <div className="mx-auto max-w-[1500px] px-[5.5%]">
        <div className="mb-12 text-center md:mb-16">
          {site.certificatesEyebrow && (
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-accent">
              {site.certificatesEyebrow}
            </div>
          )}
          <h2
            id="certificates-title"
            className="mb-0 mt-4 font-serif text-[clamp(38px,5vw,72px)] font-bold uppercase leading-[0.98] tracking-[-0.025em] text-ink"
          >
            {site.certificatesTitle}
          </h2>
          {site.certificatesNote && (
            <p className="mx-auto mb-0 mt-4 max-w-[540px] text-[14px] leading-[1.75] text-muted">
              {site.certificatesNote}
            </p>
          )}
        </div>

        {site.certificates.length === 0 ? (
          <div className="border border-line bg-paper-alt px-6 py-12 text-center text-sm text-muted">
            {emptyText}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {site.certificates.map((cert) => (
              <article
                key={cert.id}
                className={`flex flex-col justify-between overflow-hidden border border-line bg-paper transition-colors duration-200 hover:border-ink/40 ${radiusClass}`}
              >
                <div>
                  {cert.imageUrl && !failedImages[cert.id] ? (
                    <button
                      type="button"
                      onClick={() => onInspectCertificate(toWorkItem(cert), allCertWorks)}
                      aria-label={`Perbesar sertifikat ${cert.title}`}
                      className="group block aspect-[4/3] w-full overflow-hidden border-0 border-b border-line bg-paper-alt p-0 text-left"
                    >
                      <img
                        src={cert.imageUrl}
                        alt={cert.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => setFailedImages((prev) => ({ ...prev, [cert.id]: true }))}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </button>
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center border-b border-line bg-paper-alt text-muted">
                      <Award className="h-8 w-8 stroke-[1.5]" />
                    </div>
                  )}

                  <div className="p-6">
                    <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
                      <span className="truncate font-semibold">{cert.issuer}</span>
                      <span className="shrink-0 tabular-nums text-muted">{cert.year}</span>
                    </div>
                    <h3 className="mb-2 mt-0 font-serif text-[22px] font-bold uppercase leading-[1.2] tracking-[-0.015em] text-ink">
                      {cert.title}
                    </h3>
                    {cert.credentialId && (
                      <div className="font-mono text-[11px] text-muted">
                        {idPrefix} {cert.credentialId}
                      </div>
                    )}
                  </div>
                </div>

                {cert.verifyUrl && (
                  <div className="border-t border-line/70 px-6 py-3.5">
                    <a
                      href={cert.verifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-ink hover:text-accent"
                    >
                      {verifyLabel}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
