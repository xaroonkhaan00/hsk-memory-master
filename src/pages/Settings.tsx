import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { mandarinAvailable, voiceName, speak } from '../services/tts';
import { META, PACKS } from '../data';
import { Segmented, TopBar, useToast } from '../components/ui';
import type { Dimension } from '../types';

export default function Settings() {
  const { state, setSettings, resetStats, resetAll, resetPack, exportJson, importJson } = useStore();
  const [toast, showToast] = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [importText, setImportText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hsk-memory-master-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Backup downloaded');
  };

  return (
    <>
      <TopBar title="Settings" back="/" />
      <div className="page stack">
        <div className="card stack--sm stack">
          <h3>Daily target</h3>
          <Segmented
            value={state.settings.dailyMinutes}
            onChange={(v) => setSettings({ dailyMinutes: v as 5 | 10 | 20 | 30 })}
            options={[5, 10, 20, 30].map((m) => ({ value: m as 5 | 10 | 20 | 30, label: `${m} min` }))}
            ariaLabel="Daily minutes"
          />
          <h3 style={{ marginTop: 10 }}>Starting bias</h3>
          <div className="row row--wrap">
            {(['character', 'pinyin', 'tone', 'meaning', 'listening', 'all'] as (Dimension | 'all')[]).map(
              (d) => (
                <button
                  key={d}
                  className={`chip chip--button${state.settings.selfReportedWeakness === d ? ' chip--on' : ''}`}
                  onClick={() => setSettings({ selfReportedWeakness: d })}
                >
                  {d}
                </button>
              ),
            )}
          </div>
          <p className="tiny muted">
            Once your Memory Fingerprint has enough data it overrides this completely.
          </p>
        </div>

        <div className="card stack--sm stack">
          <h3>Appearance</h3>
          <Segmented
            value={state.settings.theme}
            onChange={(v) => setSettings({ theme: v as 'system' | 'light' | 'dark' })}
            options={[
              { value: 'system' as const, label: 'System' },
              { value: 'light' as const, label: 'Light' },
              { value: 'dark' as const, label: 'Dark' },
            ]}
            ariaLabel="Theme"
          />
        </div>

        <div className="card stack--sm stack">
          <h3>Audio</h3>
          {mandarinAvailable() ? (
            <>
              <p className="small">
                Mandarin voice found: <b>{voiceName()}</b>. Audio uses your browser's own speech
                engine — nothing is downloaded and no service is called.
              </p>
              <div className="row row--wrap">
                <button className="btn btn--soft btn--sm" onClick={() => speak('你好，我们开始学习汉语。')}>
                  Test the voice
                </button>
              </div>
              <label className="tiny muted" htmlFor="rate">
                Default speed: {state.settings.audioRate.toFixed(2)}×
              </label>
              <input
                id="rate"
                type="range"
                min="0.5"
                max="1.3"
                step="0.05"
                value={state.settings.audioRate}
                onChange={(e) => setSettings({ audioRate: Number(e.target.value) })}
              />
            </>
          ) : (
            <p className="small muted">
              No Mandarin voice is installed in this browser, so listening modes are hidden rather
              than played with a wrong-language voice. Adding a Chinese voice in your operating
              system's speech settings turns them on.
            </p>
          )}
        </div>

        <div className="card stack--sm stack">
          <h3>Backup</h3>
          <p className="small muted">
            All progress lives in this browser only. Export it before clearing site data or moving
            to another device.
          </p>
          <div className="row row--wrap">
            <button className="btn btn--primary" onClick={download}>
              ⬇ Export progress
            </button>
            <button className="btn btn--soft" onClick={() => fileRef.current?.click()}>
              ⬆ Import from file
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const res = importJson(String(reader.result));
                showToast(res.message);
              };
              reader.readAsText(file);
              e.target.value = '';
            }}
          />
          <details>
            <summary className="small muted" style={{ cursor: 'pointer' }}>
              Or paste a backup
            </summary>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste exported JSON here…"
              style={{ marginTop: 8 }}
            />
            <button
              className="btn btn--soft btn--sm"
              onClick={() => {
                const res = importJson(importText);
                showToast(res.message);
                if (res.ok) setImportText('');
              }}
            >
              Import pasted JSON
            </button>
          </details>
        </div>

        <div className="card stack--sm stack">
          <h3>Reset</h3>
          <details>
            <summary className="small muted" style={{ cursor: 'pointer' }}>
              Reset one pack
            </summary>
            <div className="stack--sm stack" style={{ marginTop: 8 }}>
              {PACKS.map((p) => (
                <button
                  className="btn btn--soft btn--sm"
                  key={p.id}
                  onClick={() => {
                    resetPack(p.words);
                    showToast(`${p.title} reset`);
                  }}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </details>
          <button
            className="btn btn--danger btn--block"
            onClick={() => {
              resetStats();
              showToast('Statistics cleared (word progress kept)');
            }}
          >
            Reset statistics only
          </button>
          {confirmReset ? (
            <div className="verdict verdict--bad stack--sm stack">
              <h3>Erase everything?</h3>
              <div className="body">
                This deletes all word progress, statistics, lists and achievements from this device.
                It cannot be undone. Export a backup first if you might want it back.
              </div>
              <div className="row">
                <button
                  className="btn btn--danger"
                  onClick={() => {
                    void resetAll();
                    setConfirmReset(false);
                    showToast('Everything reset');
                  }}
                >
                  Yes, erase everything
                </button>
                <button className="btn btn--soft" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn--danger btn--block" onClick={() => setConfirmReset(true)}>
              Full reset…
            </button>
          )}
        </div>

        <div className="card stack--sm stack">
          <h3>About the data</h3>
          <p className="small muted">
            Source: <b>{META.generatedFrom}</b>. {META.totalWords} words, {META.totalExamples} example
            sentences, {META.uniqueCharacters} characters, {META.measureWords} measure words. Source
            fields extracted from the PDF are kept separate from generated memory aids.
          </p>
          <Link className="btn btn--soft btn--sm" to="/qa">
            Open the data validation page
          </Link>
        </div>
      </div>
      {toast}
    </>
  );
}
