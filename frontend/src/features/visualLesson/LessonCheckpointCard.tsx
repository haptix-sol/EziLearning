type Props = {
  question: string;
  options: string[];
  answerIndex: number;
  choice: number | null;
  onPick: (index: number) => void;
  heading?: string;
};

export function LessonCheckpointCard({
  question,
  options,
  answerIndex,
  choice,
  onPick,
  heading = 'Check your understanding',
}: Props) {
  return (
    <div className="ez-vlesson-quiz">
      <div className="ez-vlesson-card__eyebrow">{heading}</div>
      <p className="ez-vlesson-quiz__q">{question}</p>
      <div className="ez-vlesson-quiz__opts" role="group" aria-label="Answer choices">
        {options.map((o, i) => (
          <button
            key={`opt-${i}`}
            type="button"
            className={`ez-vlesson-quiz__opt${choice === i ? ' ez-vlesson-quiz__opt--picked' : ''}${
              choice != null && i === answerIndex ? ' ez-vlesson-quiz__opt--ok' : ''
            }${choice != null && choice === i && i !== answerIndex ? ' ez-vlesson-quiz__opt--bad' : ''}`}
            onClick={() => onPick(i)}
          >
            <span className="ez-vlesson-quiz__opt-index">{String.fromCharCode(65 + i)}</span>
            <span className="ez-vlesson-quiz__opt-text">{o}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
