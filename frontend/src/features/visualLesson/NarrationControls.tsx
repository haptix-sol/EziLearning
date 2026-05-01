import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';

type Props = {
  audioUrl: string | null | undefined;
  narrationText: string;
  autoNarrate: boolean;
  onAutoNarrateChange: (v: boolean) => void;
};

const RATES = [0.85, 1, 1.15, 1.35];

export function NarrationControls({ audioUrl, narrationText, autoNarrate, onAutoNarrateChange }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [rateIdx, setRateIdx] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);

  const rate = RATES[rateIdx] ?? 1;
  const hasText = Boolean(narrationText?.trim());

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    setPlaying(false);
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [audioUrl, narrationText]);

  const speak = () => {
    if (!narrationText.trim() || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(narrationText);
    u.rate = rate;
    u.onend = () => setPlaying(false);
    window.speechSynthesis.speak(u);
    setPlaying(true);
  };

  const play = () => {
    if (muted) return;
    if (audioUrl) {
      const a = audioRef.current;
      if (!a) return;
      a.playbackRate = rate;
      void a
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
      return;
    }
    speak();
  };

  const pause = () => {
    const a = audioRef.current;
    if (a && !a.paused) a.pause();
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    setPlaying(false);
  };

  const replay = () => {
    pause();
    const a = audioRef.current;
    if (a) {
      a.currentTime = 0;
    }
    if (!muted) play();
  };

  return (
    <div className="ez-vlesson-audio">
      <div className="ez-vlesson-card__eyebrow">Narration</div>
      {audioUrl ? <audio ref={audioRef} src={audioUrl} preload="metadata" onEnded={() => setPlaying(false)} /> : null}
      {hasText ? (
        <p className="ez-vlesson-audio__script">{narrationText}</p>
      ) : (
        <p className="ez-vlesson-audio__script ez-vlesson-audio__script--empty">No narration text for this slide.</p>
      )}
      <div className="ez-vlesson-audio__toolbar">
        <div className="ez-vlesson-audio__transport">
          <button type="button" className="ez-vlesson-audio__btn" title={playing ? 'Pause' : 'Play'} onClick={() => (playing ? pause() : play())}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" className="ez-vlesson-audio__btn" title="Replay" onClick={replay}>
            <RotateCcw size={18} />
          </button>
          <button
            type="button"
            className={`ez-vlesson-audio__btn${muted ? ' ez-vlesson-audio__btn--on' : ''}`}
            title={muted ? 'Unmute' : 'Mute'}
            onClick={() => {
              setMuted((m) => !m);
              if (!muted) pause();
            }}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
        <label className="ez-vlesson-audio__auto">
          <input type="checkbox" checked={autoNarrate} onChange={(e) => onAutoNarrateChange(e.target.checked)} />
          Auto-narrate on slide change
        </label>
        <div className="ez-vlesson-audio__rate">
          <span>Speed</span>
          <select value={rateIdx} onChange={(e) => setRateIdx(Number(e.target.value))} className="ez-vlesson-audio__select">
            {RATES.map((r, i) => (
              <option key={r} value={i}>
                {r}×
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
