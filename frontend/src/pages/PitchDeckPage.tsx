import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Volume2,
  VolumeX,
  Maximize2,
  Home,
  FileText,
  Sparkles,
} from 'lucide-react';

export function PitchDeckPage() {
  const [currentSlide, setCurrentSlide] = useState(1);
  const totalSlides = 10;
  const [isAudioTourPlaying, setIsAudioTourPlaying] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const tourScripts = [
    "Welcome to EziLearning! I am Owlbert, your AI mentor. EziLearning is reimagining engineering education for the AI era by unifying theory, coding, custom video lessons, and 24/7 WhatsApp mentoring into one tactile notebook.",
    "Today, universities face an acute crisis: Learning Management Systems only offer passive PDF reading and multiple-choice quizzes. Students juggle over six disconnected tools, and 84 percent of engineering graduates lack day-one coding readiness.",
    "EziLearning replaces this fragmented toolchain with a single, game-inspired tactile workspace: adaptive AI roadmaps, customized video explainers, and real-time streak compounding.",
    "Our Varin Video Engine generates bespoke 90-second animated explainer videos whenever a student struggles with an algorithm. Here on slide 4, you can see our Dijkstra relaxation explainer captured at 1 minute 58 seconds.",
    "We bring mentoring directly to WhatsApp, where students already spend their time. Every morning at 8:30 AM, I send a 60-second quiz to fuel student streaks, and offer pocket doubt-clearing at zero friction.",
    "In our in-browser coding arena, students execute Python and C++ algorithms with live test cases and memory benchmarks, building verifiable recruiter-proof portfolios.",
    "We replace arbitrary course completion bars with our multi-factor Readiness Index, evaluating algorithmic mastery, real project commits, and daily streak consistency.",
    "This addresses a 34 billion dollar market across 4,200 engineering colleges facing urgent placement accreditation mandates. Generative AI allows us to deliver personalized tutoring at near-zero marginal cost.",
    "Our scalable business model combines annual campus SaaS subscriptions, student pro passes, and recruiter placement fees, delivering over 120 percent net revenue retention.",
    "With our live prototype, video engine, and WhatsApp bot active, we are rolling out to 50 flagship engineering institutions. Thank you for joining us on EziLearning's mission to build real engineering momentum!"
  ];

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

  const toggleAudioTour = () => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }
    const synth = window.speechSynthesis;
    if (isAudioTourPlaying) {
      synth.cancel();
      setIsAudioTourPlaying(false);
    } else {
      setIsAudioTourPlaying(true);
      playSlideAudio(currentSlide);
    }
  };

  const playSlideAudio = (slideIdx: number) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    if (slideIdx > totalSlides) {
      setIsAudioTourPlaying(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(tourScripts[slideIdx - 1]);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    utterance.onend = () => {
      if (slideIdx < totalSlides) {
        setTimeout(() => {
          setCurrentSlide(slideIdx + 1);
          playSlideAudio(slideIdx + 1);
        }, 1200);
      } else {
        setIsAudioTourPlaying(false);
      }
    };
    synth.speak(utterance);
  };

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
          <button
            onClick={() => setShowVideoModal(true)}
            style={{
              background: '#2b1a07',
              color: '#fff',
              border: '1.2px solid #171717',
              borderRadius: 20,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            🎬 Watch Tour Video (1080p)
          </button>

          <button
            onClick={toggleAudioTour}
            style={{
              background: isAudioTourPlaying ? '#22c55e' : '#f7efe9',
              color: isAudioTourPlaying ? '#fff' : '#2b1a07',
              border: '1.2px solid #171717',
              borderRadius: 20,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {isAudioTourPlaying ? <VolumeX size={15} /> : <Volume2 size={15} />}
            {isAudioTourPlaying ? 'Stop Voiceover' : '▶ Live Speech Tour'}
          </button>

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
            title="Open standalone HTML presentation"
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

      {/* 1080p Tour Video Modal */}
      {showVideoModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(23, 23, 23, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onClick={() => setShowVideoModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 960,
              background: '#fdfbf9',
              borderRadius: 20,
              border: '3px solid #171717',
              overflow: 'hidden',
              boxShadow: 'rgba(0, 0, 0, 0.3) 0 24px 64px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 20px',
                background: '#2b1a07',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>🦉</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  EziLearning Platform Tour &amp; Pitch Deck (1080p HD · Narrated by Owlbert)
                </span>
              </div>
              <button
                onClick={() => setShowVideoModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: 22,
                  cursor: 'pointer',
                  padding: '2px 8px',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#000' }}>
              <video
                controls
                autoPlay
                src="/videos/EziLearning_Platform_Tour_and_Pitch.mp4"
                style={{ width: '100%', maxHeight: '560px', display: 'block' }}
              >
                Your browser does not support the video tag.
              </video>
            </div>

            <div
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f7efe9',
                borderTop: '1.5px solid #171717',
              }}
            >
              <span style={{ fontSize: 13, color: '#6b655c' }}>
                Complete audiovisual walkthrough of all 10 slides with synchronized voiceover.
              </span>
              <a
                href="/videos/EziLearning_Platform_Tour_and_Pitch.mp4"
                download="EziLearning_Platform_Tour_and_Pitch.mp4"
                style={{
                  background: '#ff6f1e',
                  color: '#fff',
                  border: '1.2px solid #171717',
                  borderRadius: 20,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Download size={13} /> Download Video MP4
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
