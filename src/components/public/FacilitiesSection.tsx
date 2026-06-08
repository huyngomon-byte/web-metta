import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FacilityImage } from '@/types/cms';

// Bento span theo vị trí: ảnh đầu là hero lớn (full-width trên tablet, 2x2 trên desktop)
const BENTO_SPAN = [
  'md:col-span-2 lg:col-span-2 lg:row-span-2',
  '',
  '',
];

type FacilitiesSectionProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  images?: FacilityImage[];
};

export function FacilitiesSection({
  eyebrow = 'Không gian học tập',
  title = 'Cơ sở vật chất tại METTA Academy',
  description = 'Không gian học tập hiện đại, chỉn chu và truyền cảm hứng, giúp học viên thoải mái phát triển mỗi ngày.',
  images = [],
}: FacilitiesSectionProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  /* ── Mobile carousel ── */
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const goToSlide = useCallback((index: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  }, []);

  /* ── Lightbox controls ── */
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const showPrev = useCallback(
    () => setLightboxIndex((current) => (current === null ? null : (current - 1 + images.length) % images.length)),
    [images.length],
  );
  const showNext = useCallback(
    () => setLightboxIndex((current) => (current === null ? null : (current + 1) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') showPrev();
      if (event.key === 'ArrowRight') showNext();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, closeLightbox, showPrev, showNext]);

  // Không có ảnh thì không render
  if (images.length === 0) return null;

  return (
    <section id="facilities" className="bg-[#F8FAFC] py-10 lg:py-14">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-page">
        {/* Header */}
        <div className="mx-auto mb-7 lg:mb-9 max-w-2xl text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-navy-deep/10 bg-white px-5 py-2 text-xs font-bold uppercase tracking-widest text-cta-orange shadow-sm">
            ✦ {eyebrow}
          </span>
          <h2 className="font-montserrat font-extrabold text-[28px] lg:text-[40px] text-navy-deep leading-tight">
            {title}
          </h2>
          {description && (
            <p className="mt-4 text-on-surface-variant text-[15px] lg:text-base leading-7">
              {description}
            </p>
          )}
        </div>

        {/* ── Desktop / Tablet: Bento grid ── */}
        <div className="hidden md:grid md:grid-cols-2 md:auto-rows-[220px] lg:grid-cols-3 lg:auto-rows-[250px] gap-4">
          {images.map((image, i) => (
            <FacilityCard
              key={`${image.src}-${i}`}
              image={image}
              className={BENTO_SPAN[i] || ''}
              onClick={() => setLightboxIndex(i)}
            />
          ))}
        </div>

        {/* ── Mobile: swipe carousel ── */}
        <div className="md:hidden">
          <div
            ref={trackRef}
            onScroll={handleScroll}
            className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth gap-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((image, i) => (
              <div key={`${image.src}-${i}`} className="snap-center shrink-0 w-full">
                <FacilityCard image={image} className="h-[300px]" onClick={() => setLightboxIndex(i)} />
              </div>
            ))}
          </div>
          {/* Dots */}
          {images.length > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {images.map((image, i) => (
                <button
                  key={`${image.src}-${i}`}
                  type="button"
                  aria-label={`Xem ảnh ${i + 1}`}
                  onClick={() => goToSlide(i)}
                  className={`h-2 rounded-full transition-all ${i === active ? 'w-6 bg-cta-orange' : 'w-2 bg-navy-deep/20'}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={showPrev}
          onNext={showNext}
        />
      )}
    </section>
  );
}

/* ── Single image card with overlay + optional caption ── */
function FacilityCard({
  image,
  className = '',
  onClick,
}: {
  image: FacilityImage;
  className?: string;
  onClick: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const hasCaption = Boolean(image.title?.trim());
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full h-full overflow-hidden rounded-[22px] shadow-sm ring-1 ring-navy-deep/5 transition-shadow hover:shadow-xl ${className}`}
    >
      {/* Gradient placeholder hiển thị khi ảnh chưa tải / thiếu */}
      <div className="absolute inset-0 bg-gradient-to-br from-navy-deep/15 via-slate-200 to-accent-cyan/15" />
      <img
        src={image.src}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`relative h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* Overlay gradient + caption — chỉ hiện khi có title */}
      {hasCaption && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-deep/70 via-navy-deep/5 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 lg:p-5 text-left">
            <span className="font-montserrat text-sm lg:text-[15px] font-bold text-pure-white drop-shadow">
              {image.title}
            </span>
          </div>
        </>
      )}
    </button>
  );
}

/* ── Fullscreen lightbox ── */
function Lightbox({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  images: FacilityImage[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const image = images[index];
  const showNav = images.length > 1;

  // Vuốt/kéo để chuyển ảnh (touch + chuột)
  const dragStart = useRef<number | null>(null);
  const dragDelta = useRef(0);
  const [dragX, setDragX] = useState(0);
  const SWIPE_THRESHOLD = 60;

  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = e.clientX;
    dragDelta.current = 0;
    setDragX(0);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragStart.current === null) return;
    const delta = e.clientX - dragStart.current;
    dragDelta.current = delta;
    setDragX(delta);
  }
  function endDrag() {
    if (dragStart.current === null) return;
    const delta = dragDelta.current;
    dragStart.current = null;
    dragDelta.current = 0;
    if (showNav && delta <= -SWIPE_THRESHOLD) onNext();
    else if (showNav && delta >= SWIPE_THRESHOLD) onPrev();
    setDragX(0);
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-navy-deep/90 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={image.title || image.alt}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng"
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X size={22} />
      </button>

      {/* Prev */}
      {showNav && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          aria-label="Ảnh trước"
          className="absolute left-3 lg:left-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Image — vuốt/kéo ngang để chuyển ảnh */}
      <figure
        className={`relative max-h-[85vh] max-w-[90vw] select-none ${showNav ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ touchAction: 'pan-y' }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={showNav ? onPointerDown : undefined}
        onPointerMove={showNav ? onPointerMove : undefined}
        onPointerUp={showNav ? endDrag : undefined}
        onPointerLeave={showNav ? endDrag : undefined}
        onPointerCancel={showNav ? endDrag : undefined}
      >
        <img
          src={image.src}
          alt={image.alt}
          draggable={false}
          style={{
            transform: `translateX(${dragX}px)`,
            transition: dragStart.current === null ? 'transform 0.2s ease-out' : 'none',
          }}
          className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
        />
        <figcaption className="mt-3 text-center text-sm font-semibold text-white/90">
          {image.title || image.alt}
          <span className="ml-2 text-white/50">{index + 1} / {images.length}</span>
        </figcaption>
      </figure>

      {/* Next */}
      {showNav && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          aria-label="Ảnh kế tiếp"
          className="absolute right-3 lg:right-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <ChevronRight size={24} />
        </button>
      )}
    </div>
  );
}
