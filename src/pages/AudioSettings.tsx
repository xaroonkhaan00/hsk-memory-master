/**
 * Audio settings and diagnostics.
 *
 * The diagnostics half exists because "no sound" is otherwise unanswerable on a
 * phone: it reports what the app can actually see — which backend, whether the
 * engine started, whether Chinese is installed, which voice was chosen, and the
 * real error from the last attempt. Nothing here is a placeholder or a guess.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Segmented, TopBar, useToast } from '../components/ui';
import { Toggle } from '../components/scene';
import { useStore } from '../store';
import { REPEAT_OPTIONS, SPEED_OPTIONS, speakChinese } from '../services/audio';
import {
  initSpeech,
  lastSpeechReport,
  mandarinVoices,
  onSpeechChanged,
  refreshVoices,
  secondVoiceId,
  speechState,
  type VoiceInfo,
} from '../services/speech';
import { platformName } from '../services/platform';

const TEST_LINE = '你好，我正在学习汉语。';

function voiceLabel(v: VoiceInfo): string {
  const bits = [v.lang];
  if (v.mainland) bits.push('mainland');
  if (v.gender) bits.push(v.gender);
  bits.push(v.offline ? 'works offline' : 'needs internet');
  return bits.join(' · ');
}

function VoiceCard({
  label,
  hint,
  value,
  onChange,
  voices,
  autoLabel,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  voices: VoiceInfo[];
  autoLabel: string;
}) {
  const { state } = useStore();
  const id = `voice-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const chosen = voices.find((v) => v.id === value);
  return (
    <div className="voicecard">
      <label className="voicecard__label" htmlFor={id}>
        {label}
      </label>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{autoLabel}</option>
        {voices.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <div className="tiny muted">{chosen ? voiceLabel(chosen) : (hint ?? 'Chosen for you')}</div>
      <button
        className="btn btn--soft btn--sm"
        type="button"
        onClick={() =>
          void speakChinese(TEST_LINE, { ...state.settings.audio, voiceId: value }, { repeat: 1 })
        }
      >
        Preview
      </button>
    </div>
  );
}

export default function AudioSettings() {
  const { state, setAudio } = useStore();
  const [toast, showToast] = useToast();
  const [, setTick] = useState(0);
  const [testing, setTesting] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const audio = state.settings.audio;

  useEffect(() => {
    void initSpeech();
    return onSpeechChanged(() => setTick((n) => n + 1));
  }, []);

  const s = speechState();
  const voices = mandarinVoices();
  const report = lastSpeechReport();
  const voiceCount = voices.length;

  const backendLabel =
    s.backend === 'native'
      ? 'Native Android speech'
      : s.backend === 'web'
        ? 'Browser speech'
        : 'None';

  const runTest = async () => {
    setTesting(true);
    const res = await speakChinese(TEST_LINE, audio, { repeat: 1 });
    setTesting(false);
    setTick((n) => n + 1);
    if (res.completed) showToast('Audio played.');
    else if (res.cancelled) showToast('Audio was stopped.');
    else showToast(res.error ?? 'Audio failed.');
  };

  return (
    <>
      <TopBar title="Audio & voice" back="/settings" backLabel="Settings" />
      <div className="page stack">
        {s.backend === 'none' && (
          <div className="card trick">
            <span className="label">No speech engine</span>
            This device offers no speech at all, so listening practice cannot run here.
          </div>
        )}

        {s.backend !== 'none' && !s.languageAvailable && (
          <div className="card trick">
            <span className="label">No Chinese voice found yet</span>
            {platformName() === 'android'
              ? 'Open Settings → System → Languages & input → Text-to-speech output, choose an engine, then install the Chinese (Mandarin) voice data. It works offline once installed.'
              : "Add a Chinese voice in your system's speech settings and it will appear here."}
            <div className="row row--wrap" style={{ marginTop: 10 }}>
              <button
                className="btn btn--soft btn--sm"
                type="button"
                onClick={() => {
                  void refreshVoices().then(() => setTick((n) => n + 1));
                  showToast('Checked again');
                }}
              >
                Check again
              </button>
              <button className="btn btn--soft btn--sm" type="button" onClick={() => void runTest()}>
                Try anyway
              </button>
            </div>
          </div>
        )}

        <div className="card stack--sm">
          <div className="section-title" style={{ marginTop: 0 }}>
            Mandarin voice
          </div>
          {voices.length === 0 ? (
            <p className="small muted">
              No voice list is available on this device. The app still asks the engine for zh-CN,
              which works on many systems — use Test audio below to hear whether it does.
            </p>
          ) : (
            <VoiceCard
              label="Voice"
              value={audio.voiceId}
              onChange={(id) => setAudio({ voiceId: id })}
              voices={voices}
              autoLabel="Best available (recommended)"
            />
          )}

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

          <button
            className="btn btn--primary btn--block"
            type="button"
            disabled={testing}
            onClick={() => void runTest()}
          >
            {testing ? 'Playing…' : 'Test Chinese audio'}
          </button>
          <p className="tiny muted center">Speaks 你好，我正在学习汉语。</p>
        </div>

        <div className="card stack--sm">
          <div className="section-title" style={{ marginTop: 0 }}>
            Conversation speakers
          </div>
          {voiceCount === 0 ? (
            <p className="tiny muted">
              No voice list is available here, so both speakers use whatever the engine gives for
              zh-CN and the scene tells them apart on screen instead.
            </p>
          ) : voiceCount === 1 ? (
            <p className="tiny muted">
              This device has one Mandarin voice, so both speakers use it and the scene tells them
              apart on screen instead. An accurate voice matters more than invented variety.
            </p>
          ) : (
            <>
              <VoiceCard
                label="Speaker A"
                value={audio.speakerAVoiceId}
                onChange={(id) => setAudio({ speakerAVoiceId: id })}
                voices={voices}
                autoLabel="Same as the main voice"
              />
              <VoiceCard
                label="Speaker B"
                value={audio.speakerBVoiceId}
                onChange={(id) => setAudio({ speakerBVoiceId: id })}
                voices={voices}
                autoLabel={`Automatic (${
                  voices.find((v) => v.id === secondVoiceId(audio.voiceId))?.name ?? 'second voice'
                })`}
              />
            </>
          )}
        </div>

        <div className="card stack--sm">
          <div className="section-title" style={{ marginTop: 0 }}>
            Play by itself
          </div>
          <Toggle
            label="Vocabulary"
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
          <Toggle
            label="Listening questions"
            hint="Play the audio when a listening question appears"
            on={audio.autoListening}
            onChange={(v) => setAudio({ autoListening: v })}
          />
        </div>

        <details
          className="disclosure"
          open={showDiagnostics}
          onToggle={(e) => setShowDiagnostics((e.target as HTMLDetailsElement).open)}
        >
          <summary>
            Audio diagnostics
            <span className="hint">{backendLabel}</span>
          </summary>
          <div className="disclosure__body">
            <div className="diag">
              <div>
                <span>Platform</span>
                <b>{platformName() === 'android' ? 'Android' : platformName() === 'ios' ? 'iOS' : 'Web'}</b>
              </div>
              <div>
                <span>Backend</span>
                <b>{backendLabel}</b>
              </div>
              <div>
                <span>Engine started</span>
                <b>{s.ready ? 'Yes' : 'No'}</b>
              </div>
              <div>
                <span>Mandarin available</span>
                <b>{s.languageAvailable ? 'Yes' : 'Not detected'}</b>
              </div>
              <div>
                <span>Locale requested</span>
                <b>zh-CN</b>
              </div>
              <div>
                <span>Engine</span>
                <b>{s.engine || '—'}</b>
              </div>
              <div>
                <span>Voices found</span>
                <b>{voices.length}</b>
              </div>
              <div>
                <span>Selected voice</span>
                <b>
                  {voices.find((v) => v.id === audio.voiceId)?.name ??
                    voices[0]?.name ??
                    'engine default'}
                </b>
              </div>
              <div>
                <span>Speech rate</span>
                <b>{audio.rate}×</b>
              </div>
              <div>
                <span>Last text</span>
                <b className="hanzi" lang="zh">
                  {report.text || '—'}
                </b>
              </div>
              <div>
                <span>Last result</span>
                <b>
                  {report.result === 'success'
                    ? 'SUCCESS'
                    : report.result === 'failed'
                      ? 'FAILED'
                      : report.result === 'cancelled'
                        ? 'STOPPED'
                        : 'not attempted yet'}
                </b>
              </div>
              <div>
                <span>Last error</span>
                <b>{report.error || s.error || 'none'}</b>
              </div>
            </div>

            {voices.length > 0 && (
              <>
                <div className="section-title">Mandarin voices on this device</div>
                <div className="list">
                  {voices.map((v) => (
                    <div className="list__item" key={v.id}>
                      <span className="list__mid">
                        <span className="py">{v.name}</span>
                        <div className="mn">{voiceLabel(v)}</div>
                      </span>
                      <button
                        className="chip chip--button"
                        type="button"
                        onClick={() =>
                          void speakChinese(TEST_LINE, { ...audio, voiceId: v.id }, { repeat: 1 })
                        }
                      >
                        Play
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="row row--wrap">
              <button
                className="btn btn--soft btn--sm"
                type="button"
                onClick={() => {
                  void refreshVoices().then(() => setTick((n) => n + 1));
                }}
              >
                Re-check the engine
              </button>
              <Link className="btn btn--ghost btn--sm" to="/settings">
                Back to settings
              </Link>
            </div>
          </div>
        </details>
      </div>
      {toast}
    </>
  );
}
