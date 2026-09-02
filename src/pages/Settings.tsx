import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { mandarinVoices, onSpeechChanged, type VoiceInfo } from '../services/speech';
import { CONVERSATION_INDEX, PACKS, STORY_INDEX, TOTAL } from '../data';
import { Segmented, TopBar, useToast } from '../components/ui';
import { Toggle } from '../components/scene';
import { APP_NAME, BrandLockup, CREATOR, Credit, MONOGRAM } from '../brand/Logo';
import type { Dimension } from '../types';

export default function Settings() {
  const {
    state,
    setSettings,
    setCaptions,
    resetStats,
    resetAll,
    resetPack,
    exportJson,
    importJson,
  } = useStore();
  const [toast, showToast] = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [importText, setImportText] = useState('');
  const [voices, setVoices] = useState<VoiceInfo[]>(mandarinVoices());
  const fileRef = useRef<HTMLInputElement>(null);
  const audio = state.settings.audio;
  const captions = state.settings.captions;
  const cinema = state.settings.cinemaCaptions;

  useEffect(() => onSpeechChanged(() => setVoices([...mandarinVoices()])), []);

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learn-hsk-3-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Backup saved');
  };

  return (
    <>
      <TopBar title="Settings" back="/" backLabel="Home" />
      <div className="page stack">
        {/* ------------------------------------------------------- LEARNING */}
        <div className="card stack--sm">
          <div className="section-title">Learning</div>
          <label className="tiny muted">How long you want to study each day</label>
          <Segmented
            value={state.settings.dailyMinutes}
            onChange={(v) => setSettings({ dailyMinutes: v as 5 | 10 | 20 | 30 })}
            options={[5, 10, 20, 30].map((m) => ({
              value: m as 5 | 10 | 20 | 30,
              label: `${m} min`,
            }))}
            ariaLabel="Daily minutes"
          />

          <div className="section-title">Story difficulty</div>
          <Segmented
            value={state.settings.storyDifficulty}
            onChange={(v) => setSettings({ storyDifficulty: v })}
            options={[
              { value: 'easy' as const, label: 'Easy' },
              { value: 'normal' as const, label: 'Normal' },
              { value: 'challenge' as const, label: 'Challenge' },
            ]}
            ariaLabel="Story difficulty"
          />
          <p className="tiny muted">
            Easy reads slowly and shows pinyin in the check. Challenge speeds the reading up and
            asks you to answer from sound alone.
          </p>

          <div className="section-title">What feels hardest right now</div>
          <div className="row row--wrap">
            {(
              ['character', 'pinyin', 'tone', 'meaning', 'listening', 'all'] as (Dimension | 'all')[]
            ).map((d) => (
              <button
                key={d}
                type="button"
                className={`chip chip--button${
                  state.settings.selfReportedWeakness === d ? ' chip--on' : ''
                }`}
                aria-pressed={state.settings.selfReportedWeakness === d}
                onClick={() => setSettings({ selfReportedWeakness: d })}
              >
                {d === 'all' ? 'All of it' : d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <p className="tiny muted">
            Once your Memory Fingerprint has enough answers it takes over from this completely.
          </p>
        </div>

        {/* -------------------------------------------------- AUDIO & VOICE */}
        <div className="card stack--sm">
          <div className="section-title">Audio &amp; voice</div>
          <div className="row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', fontWeight: 660 }}>Mandarin voice</b>
              <span className="tiny muted">
                {voices.find((v) => v.id === audio.voiceId)?.name ??
                  voices[0]?.name ??
                  'Chosen automatically'}
              </span>
            </div>
            <span className="chip">{audio.rate}×</span>
          </div>
          <Link className="btn btn--soft btn--block" to="/settings/audio">
            Voice, speed, test and diagnostics
          </Link>
          <p className="tiny muted">
            Speech comes from this device. Nothing is downloaded while you study, so audio keeps
            working offline once a Chinese voice is installed.
          </p>
        </div>

        {/* --------------------------------------- STORIES & CONVERSATIONS */}
        <div className="card stack--sm">
          <div className="section-title">Stories &amp; conversations</div>
          <p className="tiny muted">
            Where each player starts. You can still change any of this inside a scene.
          </p>
          <div className="section-title">Story captions</div>
          <Toggle
            label="Chinese"
            hint="汉字 on screen"
            on={captions.hanzi}
            onChange={(v) => setCaptions({ hanzi: v })}
          />
          <Toggle
            label="Pinyin"
            hint="Sound written above each word"
            on={captions.pinyin}
            onChange={(v) => setCaptions({ pinyin: v })}
          />
          <Toggle
            label="English"
            hint="Off by default — understand first, then reveal"
            on={captions.english}
            onChange={(v) => setCaptions({ english: v })}
          />
          <Toggle
            label="Highlight your words"
            hint="Mark the words a scene is teaching"
            on={captions.highlightTargets}
            onChange={(v) => setCaptions({ highlightTargets: v })}
          />

          <div className="section-title">Conversation captions</div>
          <Toggle
            label="Chinese"
            hint="汉字 on screen"
            on={cinema.hanzi}
            onChange={(v) => setSettings({ cinemaCaptions: { ...cinema, hanzi: v } })}
          />
          <Toggle
            label="Pinyin"
            hint="Sound written above each word"
            on={cinema.pinyin}
            onChange={(v) => setSettings({ cinemaCaptions: { ...cinema, pinyin: v } })}
          />
          <Toggle
            label="English"
            hint="Off by default"
            on={cinema.english}
            onChange={(v) => setSettings({ cinemaCaptions: { ...cinema, english: v } })}
          />
          <Toggle
            label="Highlight your words"
            on={cinema.highlightTargets}
            onChange={(v) => setSettings({ cinemaCaptions: { ...cinema, highlightTargets: v } })}
          />
        </div>

        {/* ------------------------------------------------------- CAPTIONS */}
        <div className="card stack--sm">
          <div className="section-title">Pinyin</div>
          <label className="tiny muted">How pinyin is written on screen</label>
          <Segmented
            value={state.settings.pinyinDisplay}
            onChange={(v) => setSettings({ pinyinDisplay: v })}
            options={[
              { value: 'marks' as const, label: 'With tones' },
              { value: 'plain' as const, label: 'Plain' },
              { value: 'hidden' as const, label: 'Hidden' },
            ]}
            ariaLabel="Pinyin display"
          />
          <p className="tiny muted">
            The stored pronunciation always keeps its tone marks — this only changes what is drawn.
          </p>

          <div className="section-title">Typing pinyin</div>
          <Segmented
            value={state.settings.pinyinInput}
            onChange={(v) => setSettings({ pinyinInput: v })}
            options={[
              { value: 'lenient' as const, label: 'Tones optional' },
              { value: 'strict' as const, label: 'Tones required' },
            ]}
            ariaLabel="Typed pinyin"
          />
          <p className="tiny muted">
            With tones optional, typing <b>xuexi</b> counts as correct for <b>xuéxí</b>; xue2xi2
            works too. The tone-marked form is always shown back to you.
          </p>
          <Toggle
            label="Show pinyin on word cards"
            hint="Outside stories, in quizzes and lists"
            on={state.settings.showPinyinDefault}
            onChange={(v) => setSettings({ showPinyinDefault: v })}
          />
        </div>

        {/* ------------------------------------------------------ MOCK EXAM */}
        <div className="card stack--sm">
          <div className="section-title">Mock exam</div>
          <Toggle
            label="Strict exam conditions"
            hint="No pinyin, no meanings, one play per listening question"
            on={state.settings.examStrict}
            onChange={(v) => setSettings({ examStrict: v })}
          />
          <Toggle
            label="Story difficulty affects practice"
            hint="Uses the difficulty you set above"
            on={state.settings.storyDifficulty !== 'easy'}
            onChange={(v) => setSettings({ storyDifficulty: v ? 'normal' : 'easy' })}
          />
          <div className="row row--wrap">
            <Link className="btn btn--soft btn--sm" to="/exam">
              Open mock exams
            </Link>
            <span className="chip">{state.exams.history.length} taken</span>
          </div>
        </div>

        {/* ----------------------------------------------------- APPEARANCE */}
        <div className="card stack--sm">
          <div className="section-title">Appearance</div>
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
          <p className="tiny muted">
            Both themes are tuned separately so characters, pinyin and captions stay easy to read.
          </p>
        </div>

        {/* --------------------------------------------------- DATA & BACKUP */}
        <div className="card stack--sm">
          <div className="section-title">Data &amp; backup</div>
          <p className="small muted">
            Your progress lives on this device only. Export it before clearing app data or moving to
            a new phone.
          </p>
          <div className="row row--wrap">
            <button className="btn btn--primary" type="button" onClick={download}>
              Export my progress
            </button>
            <button className="btn btn--soft" type="button" onClick={() => fileRef.current?.click()}>
              Import a backup
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
              Paste a backup instead
            </summary>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste the contents of a backup file here…"
              style={{ marginTop: 8 }}
            />
            <button
              className="btn btn--soft btn--sm"
              type="button"
              onClick={() => {
                const res = importJson(importText);
                showToast(res.message);
                if (res.ok) setImportText('');
              }}
            >
              Import
            </button>
          </details>

          <details>
            <summary className="small muted" style={{ cursor: 'pointer' }}>
              Start one pack again
            </summary>
            <div className="stack--sm" style={{ marginTop: 8 }}>
              {PACKS.map((p) => (
                <button
                  className="btn btn--soft btn--sm"
                  type="button"
                  key={p.id}
                  onClick={() => {
                    resetPack(p.words);
                    showToast(`${p.title} starts again`);
                  }}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </details>

          <button
            className="btn btn--soft btn--block"
            type="button"
            onClick={() => {
              resetStats();
              showToast('Statistics cleared — your word progress is untouched');
            }}
          >
            Clear statistics only
          </button>

          {confirmReset ? (
            <div className="verdict verdict--bad stack--sm">
              <h3>Erase everything?</h3>
              <div className="body">
                This deletes all word progress, statistics, saved scenes, lists and achievements
                from this device, and cannot be undone. Export a backup first if you might want it
                back.
              </div>
              <div className="row">
                <button
                  className="btn btn--danger"
                  type="button"
                  onClick={() => {
                    void resetAll();
                    setConfirmReset(false);
                    showToast('Everything reset');
                  }}
                >
                  Yes, erase everything
                </button>
                <button
                  className="btn btn--soft"
                  type="button"
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn--danger btn--block"
              type="button"
              onClick={() => setConfirmReset(true)}
            >
              Erase everything…
            </button>
          )}
        </div>

        {/* -------------------------------------------------- ACCESSIBILITY */}
        <div className="card stack--sm">
          <div className="section-title">Accessibility</div>
          <p className="small muted">
            Every control is a real button or link, so screen readers and keyboards work without
            anything extra. Chinese is marked as Chinese so a screen reader reads it correctly, and
            animations stop when your system asks for reduced motion.
          </p>
          <p className="tiny muted">
            Keys: 1–9 pick an answer, Enter submits a typed answer and moves on.
          </p>
        </div>

        {/* ---------------------------------------------------------- ABOUT */}
        <div className="card stack--sm">
          <div className="section-title">About</div>
          <BrandLockup size={44} />
          <p className="small">
            <b>{APP_NAME}</b> — {TOTAL} words, {STORY_INDEX.length} stories and{' '}
            {CONVERSATION_INDEX.length} conversation episodes, all on your device.
          </p>
          <p className="small muted">
            <b>{MONOGRAM}</b> stands for <b>{CREATOR}</b>.
          </p>
          <div className="row row--wrap">
            <Link className="btn btn--soft btn--sm" to="/about">
              More about this app
            </Link>
            <Link className="btn btn--ghost btn--sm" to="/qa">
              Content check
            </Link>
          </div>
          <Credit />
        </div>
      </div>
      {toast}
    </>
  );
}
