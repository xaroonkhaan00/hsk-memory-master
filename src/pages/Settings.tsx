import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import {
  mandarinAvailable,
  mandarinVoices,
  onVoicesChanged,
  secondVoiceId,
  ttsSupported,
  type VoiceInfo,
} from '../services/tts';
import { REPEAT_OPTIONS, SPEED_OPTIONS, play } from '../services/audio';
import { CONVERSATION_INDEX, PACKS, STORY_INDEX, TOTAL } from '../data';
import { Segmented, TopBar, useToast } from '../components/ui';
import { Toggle } from '../components/scene';
import { APP_NAME, BrandLockup, CREATOR, Credit, MONOGRAM } from '../brand/Logo';
import { platformName } from '../services/platform';
import type { Dimension } from '../types';

const SAMPLE = '你好，我们一起学习汉语。';

function voiceLabel(v: VoiceInfo): string {
  const bits: string[] = [v.lang];
  if (v.mainland) bits.push('mainland');
  if (v.gender) bits.push(v.gender);
  if (v.localService) bits.push('offline');
  return bits.join(' · ');
}

/** A picker over the Mandarin voices this device actually has. */
function VoicePicker({
  label,
  hint,
  value,
  onChange,
  voices,
  allowAuto,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  voices: VoiceInfo[];
  allowAuto?: string;
}) {
  const { state } = useStore();
  const id = `voice-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="stack--sm">
      <label className="section-title" htmlFor={id}>
        {label}
      </label>
      {hint && <p className="tiny muted">{hint}</p>}
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{allowAuto ?? 'Choose automatically'}</option>
        {voices.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} — {voiceLabel(v)}
          </option>
        ))}
      </select>
      <button
        className="btn btn--soft btn--sm"
        type="button"
        onClick={() =>
          play(SAMPLE, { ...state.settings.audio, voiceId: value ?? state.settings.audio.voiceId }, {
            repeat: 1,
          })
        }
      >
        Preview this voice
      </button>
    </div>
  );
}

export default function Settings() {
  const {
    state,
    setSettings,
    setAudio,
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

  useEffect(() => onVoicesChanged(() => setVoices([...mandarinVoices()])), []);

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

  const oneVoiceOnly = voices.length === 1;

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

        {/* ---------------------------------------------------------- AUDIO */}
        <div className="card stack--sm">
          <div className="section-title">Audio</div>
          {!ttsSupported() ? (
            <p className="small muted">
              This device does not offer speech, so listening practice is hidden rather than played
              with the wrong voice.
            </p>
          ) : !mandarinAvailable() ? (
            <div className="fact">
              <span className="label">No Mandarin voice yet</span>
              This {platformName() === 'android' ? 'phone' : 'device'} has no Chinese voice
              installed, so nothing is spoken — the app will not read Chinese with an English voice.
              {platformName() === 'android'
                ? ' Open Settings → System → Languages & input → Text-to-speech, then install the Chinese (Mandarin) voice data. It works offline once installed.'
                : " Add a Chinese voice in your system's speech settings and it will appear here."}
            </div>
          ) : (
            <>
              <p className="small muted">
                Speech comes from this device's own voices. Nothing is downloaded while you study
                and no service is called, so audio keeps working offline.
              </p>
              <VoicePicker
                label="Preferred voice"
                hint={`${voices.length} Mandarin ${voices.length === 1 ? 'voice' : 'voices'} found on this device.`}
                value={audio.voiceId}
                onChange={(id) => setAudio({ voiceId: id })}
                voices={voices}
                allowAuto="Best available (recommended)"
              />

              <div className="section-title">Speed</div>
              <Segmented
                value={audio.rate}
                onChange={(v) => setAudio({ rate: v })}
                options={SPEED_OPTIONS.map((o) => ({ value: o.value as number, label: o.label }))}
                ariaLabel="Speaking speed"
              />
              <p className="tiny muted">
                {SPEED_OPTIONS.find((o) => o.value === audio.rate)?.hint ??
                  'Slower than conversation, which is easier to copy.'}
              </p>

              <div className="section-title">Plays per tap</div>
              <Segmented
                value={audio.repeat}
                onChange={(v) => setAudio({ repeat: v })}
                options={REPEAT_OPTIONS}
                ariaLabel="Repeats"
              />

              <div className="section-title">Conversation speakers</div>
              {oneVoiceOnly ? (
                <p className="tiny muted">
                  This device has one Mandarin voice, so both speakers use it and the scene tells
                  them apart on screen instead. An accurate voice matters more than fake variety.
                </p>
              ) : (
                <>
                  <VoicePicker
                    label="Speaker A"
                    value={audio.speakerAVoiceId}
                    onChange={(id) => setAudio({ speakerAVoiceId: id })}
                    voices={voices}
                    allowAuto="Same as preferred voice"
                  />
                  <VoicePicker
                    label="Speaker B"
                    value={audio.speakerBVoiceId}
                    onChange={(id) => setAudio({ speakerBVoiceId: id })}
                    voices={voices}
                    allowAuto={`Automatic (${
                      voices.find((v) => v.id === secondVoiceId(audio.voiceId))?.name ?? 'second voice'
                    })`}
                  />
                </>
              )}

              <div className="section-title">Play by itself</div>
              <Toggle
                label="Words"
                hint="Speak a word when its page opens"
                on={audio.autoWord}
                onChange={(v) => setAudio({ autoWord: v })}
              />
              <Toggle
                label="Example sentences"
                hint="Speak the example under a word"
                on={audio.autoSentence}
                onChange={(v) => setAudio({ autoSentence: v })}
              />
              <Toggle
                label="Stories"
                hint="Start reading a story as soon as it opens"
                on={audio.autoStory}
                onChange={(v) => setAudio({ autoStory: v })}
              />
              <Toggle
                label="Conversations"
                hint="Start an episode as soon as it opens"
                on={audio.autoConversation}
                onChange={(v) => setAudio({ autoConversation: v })}
              />
            </>
          )}
        </div>

        {/* ------------------------------------------------------- CAPTIONS */}
        <div className="card stack--sm">
          <div className="section-title">Captions</div>
          <p className="tiny muted">
            The starting point for every story and episode. You can still change them inside a
            scene.
          </p>
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
            hint="Off by default — try to understand first, then reveal"
            on={captions.english}
            onChange={(v) => setCaptions({ english: v })}
          />
          <Toggle
            label="Highlight your words"
            hint="Mark the words a scene is teaching"
            on={captions.highlightTargets}
            onChange={(v) => setCaptions({ highlightTargets: v })}
          />
          <Toggle
            label="Show pinyin on word cards"
            hint="Outside stories, in quizzes and lists"
            on={state.settings.showPinyinDefault}
            onChange={(v) => setSettings({ showPinyinDefault: v })}
          />
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
