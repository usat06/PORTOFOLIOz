import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { PortfolioWork } from '../types/site';

interface LightboxProps {
  work: PortfolioWork | null;
  works: PortfolioWork[];
  onClose: () => void;
  onNavigate: (work: PortfolioWork) => void;
}

export function Lightbox({ work, works, onClose, onNavigate }: LightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [mediaFailed, setMediaFailed] = useState(false);

  useEffect(() => {
    setMediaFailed(false);
  }, [work?.id, work?.imageUrl, work?.mediaType]);

  useEffect(() => {
    if (!work) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'ArrowRight' && works.length > 1) {
        const currentIndex = works.findIndex((item) => item.id === work.id);
        const nextIndex = (currentIndex + 1) % works.length;
        onNavigate(works[nextIndex]);
        return;
      }

      if (event.key === 'ArrowLeft' && works.length > 1) {
        const currentIndex = works.findIndex((item) => item.id === work.id);
        const prevIndex = (currentIndex - 1 + works.length) % works.length;
        onNavigate(works[prevIndex]);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [work, works, onClose, onNavigate]);

  if (!work) return null;

  const rawIndex = works.findIndex((item) => item.id === work.id);
  const currentIndex = rawIndex >= 0 ? rawIndex : 0;
  const hasMultiple = works.length > 1;

  const handlePrev = () => {
    const prevIndex = (currentIndex - 1 + works.length) % works.length;
    onNavigate(works[prevIndex]);
  };

  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % works.length;
    onNavigate(works[nextIndex]);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Tampilan media: ${work.title}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(19,19,18,0.96)] px-[5%] pb-[50px] pt-[70px]"
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Tutup tampilan"
        className="absolute right-8 top-[27px] flex h-11 w-11 items-center justify-center border-0 bg-transparent p-2.5 text-white transition-opacity duration-150 hover:opacity-75"
      >
        <X className="h-[27px] w-[27px]" />
      </button>

      {hasMultiple && (
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Media sebelumnya"
          className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center border-0 bg-transparent text-white/80 transition-colors duration-150 hover:text-white md:left-6"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}

      <div className="flex max-h-full max-w-[min(1100px,100%)] flex-col items-center gap-[17px]">
        {mediaFailed ? (
          <div className="flex h-[320px] w-[min(540px,85vw)] flex-col items-center justify-center gap-3 border border-white/15 bg-white/5 px-6 text-center text-white/75">
            <Camera className="h-8 w-8 stroke-[1.5]" />
            <p className="m-0 text-sm">Media tidak dapat dimuat.</p>
          </div>
        ) : work.mediaType === 'video' ? (
          <video
            key={work.imageUrl}
            src={work.imageUrl}
            controls
            autoPlay
            playsInline
            onError={() => setMediaFailed(true)}
            className="block max-h-[calc(100vh-145px)] max-w-full bg-black object-contain"
          />
        ) : (
          <img
            src={work.imageUrl}
            alt={work.alt}
            referrerPolicy="no-referrer"
            onError={() => setMediaFailed(true)}
            className="block max-h-[calc(100vh-145px)] max-w-full object-contain"
          />
        )}
        <div className="flex items-center gap-3 text-center text-[12px] uppercase tracking-[0.13em] text-[#eeeeee]">
          <span>{work.title}</span>
          <span aria-hidden="true" className="text-white/40">
            ·
          </span>
          <span className="text-white/70">{work.categoryLabel}</span>
          {hasMultiple && (
            <>
              <span aria-hidden="true" className="text-white/40">
                ·
              </span>
              <span className="tabular-nums text-white/60">
                {String(currentIndex + 1).padStart(2, '0')} / {String(works.length).padStart(2, '0')}
              </span>
            </>
          )}
        </div>
      </div>

      {hasMultiple && (
        <button
          type="button"
          onClick={handleNext}
          aria-label="Media berikutnya"
          className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center border-0 bg-transparent text-white/80 transition-colors duration-150 hover:text-white md:right-6"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      )}
    </div>
  );
}
