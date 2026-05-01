import type { VisualAnimationStep } from '../types';

type Props = {
  diagramType: string;
  diagramData: Record<string, unknown>;
  animStep: number;
  steps: VisualAnimationStep[];
};

function stepFlags(steps: VisualAnimationStep[], animStep: number): { hi: Set<string>; dim: Set<string>; rev: Set<string> } {
  const s = steps[Math.min(Math.max(0, animStep), Math.max(0, steps.length - 1))] || {};
  return {
    hi: new Set(s.highlight_ids || []),
    dim: new Set(s.dim_ids || []),
    rev: new Set(s.reveal_ids || []),
  };
}

function cls(id: string, kind: 'node' | 'box' | 'row' | 'col' | 'edge', flags: { hi: Set<string>; dim: Set<string> }) {
  const hot = flags.hi.has(id) ? ' ez-vlesson-diagram__el--hot' : '';
  const dim = flags.dim.has(id) ? ' ez-vlesson-diagram__el--dim' : '';
  return `ez-vlesson-diagram__${kind}${hot}${dim}`;
}

export function BoardDiagramRenderer({ diagramType, diagramData, animStep, steps }: Props) {
  const flags = stepFlags(steps, animStep);

  if (diagramType === 'flowchart') {
    const nodes = (diagramData.nodes as { id: string; label: string; kind: string; x: number; y: number }[]) || [];
    const edges = (diagramData.edges as { from: string; to: string; label?: string }[]) || [];
    return (
      <svg className="ez-vlesson-diagram ez-vlesson-diagram--svg" viewBox="0 0 520 260" role="img" aria-hidden>
        {edges.map((e, i) => {
          const a = nodes.find((n) => n.id === e.from);
          const b = nodes.find((n) => n.id === e.to);
          if (!a || !b) return null;
          const x1 = a.x + (a.kind === 'diamond' ? 50 : 55);
          const y1 = a.y + (a.kind === 'diamond' ? 36 : 28);
          const x2 = b.x + (b.kind === 'diamond' ? 50 : 55);
          const y2 = b.y + (b.kind === 'diamond' ? 36 : 28);
          const ec = cls(`edge-${e.from}-${e.to}`, 'edge', flags);
          return (
            <g key={i} className={ec}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="ez-vlesson-diagram__line" />
              {e.label && (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} className="ez-vlesson-diagram__edge-label" textAnchor="middle">
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const c = cls(n.id, 'node', flags);
          if (n.kind === 'diamond') {
            const pts = `${n.x + 50},${n.y} ${n.x + 100},${n.y + 36} ${n.x + 50},${n.y + 72} ${n.x},${n.y + 36}`;
            return (
              <g key={n.id} className={c} data-node-id={n.id}>
                <polygon points={pts} className="ez-vlesson-diagram__diamond" />
                <text x={n.x + 50} y={n.y + 40} textAnchor="middle" className="ez-vlesson-diagram__svg-text">
                  {n.label}
                </text>
              </g>
            );
          }
          return (
            <g key={n.id} className={c} data-node-id={n.id}>
              <rect x={n.x} y={n.y} width={110} height={56} rx="10" className="ez-vlesson-diagram__rect" />
              <text x={n.x + 55} y={n.y + 34} textAnchor="middle" className="ez-vlesson-diagram__svg-text">
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  if (diagramType === 'box_arrow') {
    const boxes = (diagramData.boxes as { id: string; label: string; x: number; y: number; w: number; h: number }[]) || [];
    const arrows = (diagramData.arrows as { from: string; to: string }[]) || [];
    return (
      <div className="ez-vlesson-diagram ez-vlesson-diagram--canvas">
        {boxes.map((b) => (
          <div
            key={b.id}
            className={cls(b.id, 'box', flags)}
            data-box-id={b.id}
            style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
          >
            {b.label}
          </div>
        ))}
        <svg className="ez-vlesson-diagram__arrow-layer" viewBox="0 0 560 200" preserveAspectRatio="none">
          {arrows.map((ar, i) => {
            const a = boxes.find((x) => x.id === ar.from);
            const b = boxes.find((x) => x.id === ar.to);
            if (!a || !b) return null;
            const x1 = a.x + a.w;
            const y1 = a.y + a.h / 2;
            const x2 = b.x;
            const y2 = b.y + b.h / 2;
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="ez-vlesson-diagram__line" />
            );
          })}
        </svg>
      </div>
    );
  }

  if (diagramType === 'step_chain') {
    const stepsChain = (diagramData.steps as { id: string; label: string }[]) || [];
    return (
      <div className="ez-vlesson-diagram ez-vlesson-diagram--chain">
        {stepsChain.map((s, i) => (
          <div key={s.id} className={cls(s.id, 'col', flags)} data-step-id={s.id}>
            <span className="ez-vlesson-diagram__chain-node">{s.label}</span>
            {i < stepsChain.length - 1 && <span className="ez-vlesson-diagram__chain-chev" aria-hidden />}
          </div>
        ))}
      </div>
    );
  }

  if (diagramType === 'ipo') {
    const il = String(diagramData.input_label || 'Input');
    const pl = String(diagramData.process_label || 'Process');
    const ol = String(diagramData.output_label || 'Output');
    return (
      <div className="ez-vlesson-diagram ez-vlesson-diagram--ipo">
        <div className={cls('input', 'col', flags)}>
          <span className="ez-vlesson-diagram__ipo-k">{il}</span>
        </div>
        <div className="ez-vlesson-diagram__ipo-arrow" aria-hidden />
        <div className={cls('process', 'col', flags)}>
          <span className="ez-vlesson-diagram__ipo-k">{pl}</span>
        </div>
        <div className="ez-vlesson-diagram__ipo-arrow" aria-hidden />
        <div className={cls('output', 'col', flags)}>
          <span className="ez-vlesson-diagram__ipo-k">{ol}</span>
        </div>
      </div>
    );
  }

  if (diagramType === 'request_response') {
    const cl = String((diagramData.client as { label?: string } | undefined)?.label || 'Client');
    const sr = String((diagramData.server as { label?: string } | undefined)?.label || 'Server');
    const out = String((diagramData.arrow_out as { label?: string } | undefined)?.label || 'Request');
    const back = String((diagramData.arrow_back as { label?: string } | undefined)?.label || 'Response');
    return (
      <div className="ez-vlesson-diagram ez-vlesson-diagram--rr">
        <div className={cls('client', 'box', flags)}>
          {cl}
        </div>
        <div className="ez-vlesson-diagram__rr-mid">
          <div className={cls('arrow_out', 'edge', flags)}>
            <span className="ez-vlesson-diagram__rr-label">{out}</span>
          </div>
          <div className={cls('server', 'box', flags)}>
            {sr}
          </div>
          <div className={cls('arrow_back', 'edge', flags)}>
            <span className="ez-vlesson-diagram__rr-label">{back}</span>
          </div>
        </div>
      </div>
    );
  }

  if (diagramType === 'memory_state') {
    const vars = (diagramData.vars as { name: string; before: string; after: string }[]) || [];
    return (
      <div className="ez-vlesson-diagram ez-vlesson-diagram--mem">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Before</th>
              <th>After body</th>
            </tr>
          </thead>
          <tbody>
            {vars.map((v) => (
              <tr key={v.name} className={cls(v.name, 'row', flags)}>
                <td>{v.name}</td>
                <td>{v.before}</td>
                <td>{v.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (diagramType === 'before_after') {
    const before = diagramData.before as { title?: string; body?: string };
    const after = diagramData.after as { title?: string; body?: string };
    return (
      <div className="ez-vlesson-diagram ez-vlesson-diagram--ba">
        <div className={cls('before', 'col', flags)}>
          <span className="ez-vlesson-diagram__ba-title">{before?.title}</span>
          <span className="ez-vlesson-diagram__ba-body">{before?.body}</span>
        </div>
        <div className="ez-vlesson-diagram__ba-div" aria-hidden />
        <div className={cls('after', 'col', flags)}>
          <span className="ez-vlesson-diagram__ba-title">{after?.title}</span>
          <span className="ez-vlesson-diagram__ba-body">{after?.body}</span>
        </div>
      </div>
    );
  }

  if (diagramType === 'code_board') {
    const ex = diagramData as { frame_caption?: string };
    return (
      <div className="ez-vlesson-diagram ez-vlesson-diagram--codeframe">
        {ex.frame_caption && <div className="ez-vlesson-diagram__code-cap">{ex.frame_caption}</div>}
        <div className="ez-vlesson-diagram__code-slot" />
      </div>
    );
  }

  if (diagramType === 'algorithm_trace') {
    const cols = (diagramData.columns as string[]) || [];
    const rows = (diagramData.rows as Record<string, string>[]) || [];
    const active = Number(diagramData.active_row ?? 0);
    return (
      <div className="ez-vlesson-diagram ez-vlesson-diagram--trace">
        <table>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i === active ? 'ez-vlesson-diagram__trace-row--active' : ''} data-row-id={`row-${i}`}>
                {cols.map((c) => (
                  <td key={c}>{r[c]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const headline = String(diagramData.headline || '');
  const sub = String(diagramData.sub || '');
  const bullets = (diagramData.bullets as string[]) || [];
  const prompt = String(diagramData.prompt || '');
  return (
    <div className="ez-vlesson-diagram ez-vlesson-diagram--generic">
      {headline && <div className="ez-vlesson-diagram__gh">{headline}</div>}
      {sub && <div className="ez-vlesson-diagram__gs">{sub}</div>}
      {prompt && <div className="ez-vlesson-diagram__gp">{prompt}</div>}
      {bullets.length > 0 && (
        <ul className="ez-vlesson-diagram__gul">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
