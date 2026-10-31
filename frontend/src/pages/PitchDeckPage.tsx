import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Maximize2,
} from 'lucide-react';

export function PitchDeckPage() {
  const [currentSlide, setCurrentSlide] = useState(1);
  const totalSlides = 9;

  const handleNext = () => {
    setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => Math.max(prev - 1, 1));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlide((prev) => Math.max(prev - 1, 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#e9e4df', color: '#171717', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header Controls Bar */}
      <header
        style={{
          background: '#fdfbf9',
          borderBottom: '1.5px solid #171717',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link
            to="/showcase"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#f7efe9',
              border: '1.2px solid #171717',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              color: '#2b1a07',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={14} /> Back to Showcase
          </Link>

          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, fontWeight: 600, color: '#2b1a07' }}>
            ezilearning pitch deck
          </span>
          <span style={{ fontSize: 12, background: '#ff6f1e', color: '#fff', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
            16:9 Widescreen
          </span>
        </div>

        {/* Center slide paginator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handlePrev}
            disabled={currentSlide === 1}
            style={{
              background: '#fdfbf9',
              border: '1.2px solid #171717',
              borderRadius: 20,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: currentSlide === 1 ? 'not-allowed' : 'pointer',
              opacity: currentSlide === 1 ? 0.4 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ArrowLeft size={14} /> Prev
          </button>

          <span style={{ fontSize: 14, fontWeight: 700, color: '#2b1a07', minWidth: 60, textAlign: 'center' }}>
            {currentSlide} / {totalSlides}
          </span>

          <button
            onClick={handleNext}
            disabled={currentSlide === totalSlides}
            style={{
              background: '#fdfbf9',
              border: '1.2px solid #171717',
              borderRadius: 20,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: currentSlide === totalSlides ? 'not-allowed' : 'pointer',
              opacity: currentSlide === totalSlides ? 0.4 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Next <ArrowRight size={14} />
          </button>
        </div>

        {/* Right Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a
            href="/EziLearning_Pitch_Deck.pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#ff6f1e',
              color: '#fff',
              border: '1.2px solid #171717',
              borderRadius: 20,
              padding: '6px 16px',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Download size={14} /> Download PDF Slides
          </a>

          <a
            href="/pitch_deck.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#fdfbf9',
              color: '#171717',
              border: '1.2px solid #171717',
              borderRadius: 20,
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Open standalone presentation"
          >
            <Maximize2 size={14} />
          </a>
        </div>
      </header>

      {/* Embedded Slide Stage */}
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 16px' }}>
        <div
          style={{
            width: '100%',
            maxWidth: 1360,
            aspectRatio: '16 / 9',
            background: '#fff',
            borderRadius: 16,
            border: '2px solid #171717',
            boxShadow: 'rgba(0, 0, 0, 0.16) 0px 20px 48px',
            overflow: 'hidden',
          }}
        >
          <iframe
            src={`/pitch_deck.html#slide-${currentSlide}`}
            title="EziLearning Pitch Deck Presentation"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
            }}
          />
        </div>
      </main>

      {/* Bottom slide thumbnail ribbon */}
      <footer
        style={{
          background: '#fdfbf9',
          borderTop: '1.5px solid #171717',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
          overflowX: 'auto',
        }}
      >
        {Array.from({ length: totalSlides }, (_, i) => i + 1).map((idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            style={{
              background: currentSlide === idx ? '#ff6f1e' : '#f7efe9',
              color: currentSlide === idx ? '#fff' : '#2b1a07',
              border: currentSlide === idx ? '2px solid #171717' : '1px solid rgba(23,23,23,0.2)',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Slide {idx}
          </button>
        ))}
      </footer>
    </div>
  );
}
