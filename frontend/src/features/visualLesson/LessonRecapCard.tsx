type Props = {
  points: string[];
};

export function LessonRecapCard({ points }: Props) {
  if (!points.length) return null;
  return (
    <div className="ez-vlesson-recap">
      <div className="ez-vlesson-card__eyebrow">Takeaways</div>
      <ul className="ez-vlesson-recap__list">
        {points.map((p) => (
          <li key={p} className="ez-vlesson-recap__item">
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
