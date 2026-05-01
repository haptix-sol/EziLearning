import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Layers, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import type { VisualLessonManifest, VisualLessonSlide } from './types';
import { BoardDiagramRenderer } from './diagram/BoardDiagramRenderer';
import { LessonCheckpointCard } from './LessonCheckpointCard';
import { LessonProgressBar } from './LessonProgressBar';
import { LessonRecapCard } from './LessonRecapCard';
import { NarrationControls } from './NarrationControls';

type Props = {
  dayId: string;
  manifest: VisualLessonManifest;
  initialSlide?: number;
  onComplete?: () => void;
};

const AUTO_MS = 14000;
const ANIM_MS = 1300;

const KIND_LABEL: Record<string, string> = {
  intro: 'Introduction',
  objectives: 'Objectives',
  concept: 'Concept',
  step: 'Step',
  code: 'Code',
  summary: 'Summary',
  recap: 'Recap',
  checkpoint: 'Checkpoint',
  practice: 'Practice',
};

function kindLabel(kind: string) {
  return KIND_LABEL[kind] || kind.replace(/-/g, ' ');
}

export function LessonSlidePlayer({ dayId, manifest, initialSlide = 0, onComplete }: Props) {
  const slides = manifest.slides;
  const [idx, setIdx] = useState(() => Math.min(Math.max(0, initialSlide), Math.max(0, slides.length - 1)));
  const [animStep, setAnimStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoNarrate, setAutoNarrate] = useState(false);
  const [cpChoice, setCpChoice] = useState<number | null>(null);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slide: VisualLessonSlide | undefined = slides[idx];
  const steps = slide?.animation_sequence?.steps?.length ? slide.animation_sequence.steps! : [{ id: 's' }];

  const slideTitles = useMemo(() => slides.map((s, i) => (s.title?.trim() ? s.title.trim() : `Slide ${i + 1}`)), [slides]);
  const dotLabels = useMemo(() => slides.map((s) => (s.title?.trim() ? s.title.trim().slice(0, 1) : '·')), [slides]);

  const postProgress = useCallback(
    (patch: { last_slide_index: number; completed_lesson?: boolean; viewed_slide_ids?: string[] }) => {
      if (progressDebounce.current) clearTimeout(progressDebounce.current);
      progressDebounce.current = setTimeout(() => {
        void api.post(`/study/days/${dayId}/visual-lesson/progress`, {
          topic_key: manifest.topic_key,
          last_slide_index: patch.last_slide_index,
          completed_lesson: patch.completed_lesson ?? false,
          viewed_slide_ids: patch.viewed_slide_ids,
        });
      }, 400);
    },
    [dayId, manifest.topic_key],
  );

  useEffect(() => {
    setAnimStep(0);
    setCpChoice(null);
    setQuizChoice(null);
  }, [idx]);

  useEffect(() => {
    if (animTimer.current) clearInterval(animTimer.current);
    if (steps.length <= 1) return;
    animTimer.current = setInterval(() => {
      setAnimStep((s) => (s + 1) % steps.length);
    }, ANIM_MS);
    return () => {
      if (animTimer.current) clearInterval(animTimer.current);
    };
  }, [idx, steps.length]);

  useEffect(() => {
    if (!slide) return;
    postProgress({ last_slide_index: idx, viewed_slide_ids: [slide.id] });
  }, [idx, slide, postProgress]);

  useEffect(() => {
    if (!autoPlay || !slide) return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      setIdx((i) => Math.min(i + 1, slides.length - 1));
    }, AUTO_MS);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, [autoPlay, idx, slide, slides.length]);

  useEffect(() => {
    if (!autoNarrate || !slide?.narration_text) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(slide.narration_text);
    u.rate = 1;
    window.speechSynthesis.speak(u);
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [autoNarrate, idx, slide?.narration_text]);

  const go = (dir: -1 | 1) => {
    setIdx((i) => Math.min(Math.max(0, i + dir), slides.length - 1));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(i + 1, slides.length - 1));
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      if (e.key === 'Home') setIdx(0);
      if (e.key === 'End') setIdx(slides.length - 1);
      if (e.key === ' ') {
        e.preventDefault();
        setAutoPlay((a) => !a);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const dx = end - start;
    if (dx < -48) go(1);
    if (dx > 48) go(-1);
  };

  const finishLesson = async () => {
    if (progressDebounce.current) clearTimeout(progressDebounce.current);
    try {
      await api.post(`/study/days/${dayId}/visual-lesson/progress`, {
        topic_key: manifest.topic_key,
        last_slide_index: slides.length - 1,
        completed_lesson: true,
        viewed_slide_ids: slides.map((s) => s.id),
      });
    } finally {
      onComplete?.();
    }
  };

  if (!slide) return null;

  const code = slide.code_example;
  const diagramType = slide.diagram_type === 'code_board' && code ? 'code_board' : slide.diagram_type;
  const practiceQuiz = slide.kind === 'practice' ? slide.quiz ?? null : null;

  return (
    <div className="ez-vlesson-player" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="ez-vlesson-stage">
        <aside className="ez-vlesson-card ez-vlesson-card--rail">
          <div className="ez-vlesson-card__head">
            <Layers size={16} strokeWidth={2} aria-hidden />
            <span>Progress</span>
          </div>
          <LessonProgressBar
            index={idx}
            total={slides.length}
            labels={dotLabels}
            slideTitles={slideTitles}
            onJumpTo={setIdx}
          />
        </aside>

        <div className="ez-vlesson-stage__main">
          <div key={slide.id} className="ez-vlesson-slide-surface">
            <section className="ez-vlesson-card ez-vlesson-card--intro">
              <div className="ez-vlesson-intro__row">
                <span className="ez-vlesson-intro__kind">{kindLabel(slide.kind)}</span>
                <span className="ez-vlesson-intro__index">
                  {idx + 1} / {slides.length}
                </span>
              </div>
              <h1 className="ez-vlesson-intro__title">{slide.title}</h1>
              {slide.short_explanation ? <p className="ez-vlesson-intro__lead">{slide.short_explanation}</p> : null}
              {(slide.caption_keywords || []).length > 0 ? (
                <div className="ez-vlesson-intro__tags" aria-label="Keywords">
                  {(slide.caption_keywords || []).map((k) => (
                    <span key={k} className="ez-vlesson-intro__tag">
                      {k}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="ez-vlesson-card ez-vlesson-card--visual">
              <div className="ez-vlesson-card__head">
                <span>Board</span>
              </div>
              <div className="ez-vlesson-visual__canvas">
                <BoardDiagramRenderer
                  diagramType={diagramType}
                  diagramData={slide.diagram_data || {}}
                  animStep={animStep}
                  steps={steps}
                />
              </div>
            </section>

            {code ? (
              <section className="ez-vlesson-card ez-vlesson-card--code">
                <div className="ez-vlesson-card__head">
                  <span>Code</span>
                  <span className="ez-vlesson-card__meta">{code.language}</span>
                </div>
                <pre className="ez-vlesson-code-block">
                  <code>
                    {code.code.split('\n').map((line, li) => (
                      <div
                        key={li}
                        className={`ez-vlesson-code-line${code.highlight_lines?.includes(li) ? ' ez-vlesson-code-line--hi' : ''}`}
                      >
                        {line || ' '}
                      </div>
                    ))}
                  </code>
                </pre>
              </section>
            ) : null}

            {slide.kind === 'checkpoint' &&
            slide.checkpoint_question &&
            slide.checkpoint_options &&
            slide.checkpoint_answer_index != null ? (
              <section className="ez-vlesson-card ez-vlesson-card--interactive">
                <LessonCheckpointCard
                  heading="Checkpoint"
                  question={slide.checkpoint_question}
                  options={slide.checkpoint_options}
                  answerIndex={slide.checkpoint_answer_index}
                  choice={cpChoice}
                  onPick={setCpChoice}
                />
              </section>
            ) : null}

            {practiceQuiz ? (
              <section className="ez-vlesson-card ez-vlesson-card--interactive">
                <LessonCheckpointCard
                  heading="Practice question"
                  question={practiceQuiz.question}
                  options={practiceQuiz.options}
                  answerIndex={practiceQuiz.answer_index}
                  choice={quizChoice}
                  onPick={setQuizChoice}
                />
              </section>
            ) : null}

            {slide.summary_points && slide.summary_points.length > 0 ? (
              <section className="ez-vlesson-card ez-vlesson-card--recap">
                <LessonRecapCard points={slide.summary_points} />
              </section>
            ) : null}

            <section className="ez-vlesson-card ez-vlesson-card--narration">
              <NarrationControls
                audioUrl={slide.audio_url}
                narrationText={slide.narration_text || ''}
                autoNarrate={autoNarrate}
                onAutoNarrateChange={setAutoNarrate}
              />
            </section>
          </div>

          <footer className="ez-vlesson-card ez-vlesson-card--footer">
            <div className="ez-vlesson-footer__cluster">
              <button type="button" className="ez-vlesson-footer__icon" onClick={() => go(-1)} disabled={idx <= 0} aria-label="Previous slide">
                <ChevronLeft size={22} strokeWidth={2} />
              </button>
            </div>
            <div className="ez-vlesson-footer__cluster ez-vlesson-footer__cluster--center">
              <button
                type="button"
                className={`ez-vlesson-footer__pill${autoPlay ? ' ez-vlesson-footer__pill--on' : ''}`}
                onClick={() => setAutoPlay((a) => !a)}
              >
                <Sparkles size={16} aria-hidden />
                Auto-advance
              </button>
              <button type="button" className="ez-vlesson-footer__ghost" onClick={() => setAnimStep(0)} title="Replay diagram animation from the start">
                Replay animation
              </button>
            </div>
            <div className="ez-vlesson-footer__cluster ez-vlesson-footer__cluster--end">
              {idx < slides.length - 1 ? (
                <button type="button" className="ez-vlesson-footer__icon" onClick={() => go(1)} aria-label="Next slide">
                  <ChevronRight size={22} strokeWidth={2} />
                </button>
              ) : (
                <button type="button" className="btn btn-primary ez-vlesson-footer__complete" onClick={finishLesson}>
                  Mark lesson complete
                </button>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
