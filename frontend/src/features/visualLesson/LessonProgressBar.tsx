type Props = {
  index: number;
  total: number;
  /** Short labels per slide (e.g. first letter or truncated title) */
  labels?: string[];
  /** Full slide titles for the step rail */
  slideTitles?: string[];
  onJumpTo?: (i: number) => void;
};

function truncate(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function LessonProgressBar({ index, total, labels, slideTitles, onJumpTo }: Props) {
  const pct = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;
  const titles = slideTitles?.length === total ? slideTitles : null;

  return (
    <div
      className="ez-vlesson-progress"
      role="progressbar"
      aria-valuenow={index + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Slide ${index + 1} of ${total}`}
    >
      <div className="ez-vlesson-progress__top">
        <span className="ez-vlesson-progress__label">
          Slide {index + 1} of {total}
        </span>
        <span className="ez-vlesson-progress__pct">{pct}%</span>
      </div>
      <div className="ez-vlesson-progress__track">
        <div className="ez-vlesson-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      {titles && (
        <div className="ez-vlesson-rail" role="tablist" aria-label="Slides">
          {titles.map((title, i) => {
            const active = i === index;
            const done = i < index;
            return (
              <button
                key={`step-${i}`}
                type="button"
                role="tab"
                aria-selected={active}
                className={`ez-vlesson-rail__chip${active ? ' ez-vlesson-rail__chip--active' : ''}${done ? ' ez-vlesson-rail__chip--done' : ''}`}
                title={title}
                disabled={!onJumpTo}
                onClick={() => onJumpTo?.(i)}
              >
                <span className="ez-vlesson-rail__chip-num">{i + 1}</span>
                <span className="ez-vlesson-rail__chip-text">{truncate(title, 22)}</span>
              </button>
            );
          })}
        </div>
      )}
      {!titles && labels && labels.length > 0 && (
        <div className="ez-vlesson-progress__dots" aria-hidden>
          {labels.map((_, i) => (
            <span key={i} className={`ez-vlesson-progress__dot${i <= index ? ' ez-vlesson-progress__dot--on' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}
