import { useRef, useState } from 'react';
import { useStore } from '../store';
import { META } from '../data';
import { useToast } from '../components/ui';
import type { Dimension } from '../types';

const TIMES: { value: 5 | 10 | 20 | 30; label: string; blurb: string }[] = [
  { value: 5, label: '5 minutes', blurb: 'A quick daily touch. Roughly 30 retrievals.' },
  { value: 10, label: '10 minutes', blurb: 'The steady default. Around 60 retrievals.' },
  { value: 20, label: '20 minutes', blurb: 'Real progress. New words plus repair work.' },
  { value: 30, label: '30 minutes', blurb: 'Exam pace. Expect to be tired afterwards.' },
];

const WEAK: { value: Dimension | 'all'; label: string; blurb: string }[] = [
  { value: 'character', label: 'Characters', blurb: 'The shapes refuse to stick.' },
  { value: 'pinyin', label: 'Pinyin', blurb: 'I know it but cannot say it.' },
  { value: 'tone', label: 'Tones', blurb: 'I get the syllable and lose the tone.' },
  { value: 'meaning', label: 'Meaning', blurb: 'I read it and draw a blank.' },
  { value: 'listening', label: 'Listening', blurb: 'Spoken Chinese runs past me.' },
  { value: 'all', label: 'Honestly, everything', blurb: 'Start me balanced.' },
];

export default function Onboarding() {
  const { setSettings, importJson } = useStore();
  const [step, setStep] = useState(0);
  const [minutes, setMinutes] = useState<5 | 10 | 20 | 30>(10);
  const [weak, setWeak] = useState<Dimension | 'all'>('all');
  const [restoring, setRestoring] = useState(false);
  const [pasted, setPasted] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, showToast] = useToast();

  const restore = (raw: string) => {
    const res = importJson(raw);
    showToast(res.message);
    if (res.ok) setSettings({ onboarded: true });
  };

  return (
    <div className="page" style={{ paddingTop: 32 }}>
      {toast}
      {step === 0 && (
        <div className="stack">
          <div className="center stack">
            <div style={{ fontSize: '3rem' }}>🧠</div>
            <h1>HSK Memory Master</h1>
            <p className="muted">
              {META.totalWords} HSK-3 words, extracted from your PDF, turned into character
              families, sound families, memory scenes and places — then drilled by a coach that
              learns exactly how you forget.
            </p>
          </div>
          <div className="card stack--sm stack">
            <div className="row">
              <span className="chip chip--accent">{META.totalWords} words</span>
              <span className="chip">{META.totalExamples} example sentences</span>
            </div>
            <div className="row row--wrap">
              <span className="chip">{META.uniqueCharacters} characters</span>
              <span className="chip">{META.packs} packs</span>
              <span className="chip">{META.confusionSets} confusion sets</span>
              <span className="chip">{META.measureWords} measure words</span>
            </div>
            <p className="small muted">
              Everything is stored on this device only. No account, no server, no API key.
            </p>
          </div>
          <button className="btn btn--primary btn--lg btn--block" onClick={() => setStep(1)}>
            Get started
          </button>
          <button className="btn btn--ghost btn--block" onClick={() => setRestoring((r) => !r)}>
            I already have a backup
          </button>
          {restoring && (
            <div className="card stack--sm stack">
              <h3>Restore your progress</h3>
              <p className="small muted">
                Import an export from another device or from before a reset. It replaces whatever is
                on this device.
              </p>
              <button className="btn btn--soft" onClick={() => fileRef.current?.click()}>
                ⬆ Choose a backup file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => restore(String(reader.result));
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="…or paste the exported JSON here"
              />
              <button
                className="btn btn--soft"
                disabled={!pasted.trim()}
                onClick={() => restore(pasted)}
              >
                Import pasted JSON
              </button>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          <h1>How long do you want to study each day?</h1>
          <p className="muted small">You can change this at any time. The app adapts anyway.</p>
          <div className="stack--sm stack">
            {TIMES.map((t) => (
              <button
                key={t.value}
                className={`option${minutes === t.value ? ' option--picked' : ''}`}
                onClick={() => setMinutes(t.value)}
                type="button"
              >
                <span className="option__label">
                  <b>{t.label}</b>
                  <div className="option__sub">{t.blurb}</div>
                </span>
              </button>
            ))}
          </div>
          <button className="btn btn--primary btn--lg btn--block" onClick={() => setStep(2)}>
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <h1>What feels hardest right now?</h1>
          <p className="muted small">
            This is only a starting bias. After about 30 answers your real performance takes over.
          </p>
          <div className="stack--sm stack">
            {WEAK.map((w) => (
              <button
                key={w.value}
                className={`option${weak === w.value ? ' option--picked' : ''}`}
                onClick={() => setWeak(w.value)}
                type="button"
              >
                <span className="option__label">
                  <b>{w.label}</b>
                  <div className="option__sub">{w.blurb}</div>
                </span>
              </button>
            ))}
          </div>
          <button
            className="btn btn--primary btn--lg btn--block"
            onClick={() =>
              setSettings({ dailyMinutes: minutes, selfReportedWeakness: weak, onboarded: true })
            }
          >
            Start learning
          </button>
        </div>
      )}
    </div>
  );
}
