import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, Copy, Send } from 'lucide-react';
import { submitContactMessageToCloud } from '../services/portfolioStore';
import type { SiteConfig } from '../types/site';

interface ContactSectionProps {
  site: SiteConfig;
}

export function ContactSection({ site }: ContactSectionProps) {
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [sendError, setSendError] = useState<string | null>(null);

  const labels = site.uiLabels;

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(site.contact.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendStatus('idle');
    setSendError(null);

    try {
      await submitContactMessageToCloud({ name, email, subject, message });
      setSendStatus('sent');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setSendStatus('error');
      setSendError(err instanceof Error ? err.message : 'Gagal mengirim pesan.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      id="kontak"
      aria-labelledby="contact-title"
      className="scroll-mt-16 bg-paper-alt py-16 pb-20 text-center sm:py-24 md:scroll-mt-20 lg:py-28 2xl:py-32"
    >
      <div className="w-full px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-accent">
          {site.contact.eyebrow}
        </div>
        <h2
          id="contact-title"
          className="mx-auto mb-[25px] mt-5 max-w-[840px] font-serif text-[clamp(36px,5.2vw,74px)] font-bold uppercase leading-[1.0] tracking-[-0.025em] text-ink"
        >
          {site.contact.title}
        </h2>
        <p className="mx-auto mb-[38px] mt-0 max-w-[560px] text-[15px] leading-[1.8] text-muted">
          {site.contact.description}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href={`mailto:${site.contact.email}`}
            className="inline-flex max-w-full items-center gap-3 break-all border-b-2 border-ink pb-[10px] font-serif text-[clamp(20px,2.8vw,38px)] tracking-[-0.015em] text-ink transition-colors duration-200 hover:border-accent hover:text-accent sm:gap-[18px] sm:break-normal"
          >
            {site.contact.email}
            <ArrowUpRight className="h-5 w-5 shrink-0 sm:h-[24px] sm:w-[24px]" />
          </a>

          <button
            type="button"
            onClick={handleCopyEmail}
            aria-label={labels?.contactCopyLabel || 'Salin Email'}
            className="inline-flex items-center gap-1.5 border border-line bg-paper px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? (labels?.contactCopiedLabel || 'Disalin') : (labels?.contactCopyLabel || 'Salin Email')}
          </button>
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={() => {
              setShowForm((prev) => !prev);
              setSendStatus('idle');
            }}
            className="inline-flex items-center gap-2 border border-ink bg-ink px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-paper transition-colors hover:border-accent hover:bg-accent"
          >
            <Send className="h-3.5 w-3.5" />
            {labels?.contactFormToggleLabel || 'Kirim Pesan Langsung'}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-8 max-w-[640px] border border-line bg-paper p-6 text-left md:p-8"
          >
            <h3 className="mb-1 mt-0 font-serif text-2xl font-bold uppercase text-ink">
              {labels?.contactFormHeading || 'Tinggalkan Pesan'}
            </h3>
            <p className="mb-5 mt-0 text-xs text-muted">
              {labels?.contactFormSubheading ||
                'Pesan akan tersimpan langsung dan dapat dibaca melalui panel admin.'}
            </p>

            {sendStatus === 'sent' && (
              <div className="mb-4 flex items-center gap-2 border border-accent/40 bg-paper-alt px-4 py-3 text-xs font-medium text-ink">
                <Check className="h-4 w-4 text-accent" />
                Terima kasih! Pesan Anda sudah terkirim.
              </div>
            )}

            {sendStatus === 'error' && sendError && (
              <div
                role="alert"
                className="mb-4 border border-red-300 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
              >
                {sendError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Nama Anda
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama lengkap"
                  className="w-full border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Email Anda
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Subjek
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Kolaborasi proyek, pemotretan, atau pertanyaan..."
                  className="w-full border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Pesan
                </label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tuliskan pesan Anda di sini..."
                  className="w-full border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-2 border-0 bg-ink px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-paper transition-colors hover:bg-accent disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {sending ? 'Mengirim...' : labels?.contactFormSubmitLabel || 'Kirim Pesan'}
              </button>
            </div>
          </form>
        )}

        {(site.contact.location || site.contact.socials.length > 0) && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            {site.contact.location && (
              <>
                <span>{site.contact.location}</span>
                {site.contact.socials.length > 0 && <span aria-hidden="true">·</span>}
              </>
            )}
            {site.contact.socials.map((social, idx) => (
              <a
                key={`${social.label}-${idx}`}
                href={social.url}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-accent"
              >
                {social.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
