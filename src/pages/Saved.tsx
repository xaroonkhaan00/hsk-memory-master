/** Saved Scenes — stories, episodes and single lines the learner kept. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, TopBar } from '../components/ui';
import { LineBlock, SceneCard } from '../components/scene';
import {
  CONVERSATION_INDEX,
  STORY_INDEX,
  conversationRef,
  loadConversations,
  loadStories,
  storyRef,
} from '../data';
import { useStore } from '../store';
import type { Scene, SceneRef } from '../types';

interface SavedLine {
  key: string;
  scene: Scene;
  index: number;
  to: string;
}

export default function Saved() {
  const { state, toggleSaved } = useStore();
  const [lines, setLines] = useState<SavedLine[] | null>(null);
  const savedLineKeys = state.saved.lines.join('|');

  // Line text only loads when there is a saved line to show.
  useEffect(() => {
    const keys = savedLineKeys ? savedLineKeys.split('|') : [];
    if (keys.length === 0) {
      setLines([]);
      return;
    }
    let live = true;
    void Promise.all([loadStories(), loadConversations()]).then(([stories, convs]) => {
      if (!live) return;
      const out: SavedLine[] = [];
      for (const key of keys) {
        const [id, idx] = key.split(':');
        const i = Number(idx);
        if (!id || Number.isNaN(i)) continue;
        const story = stories.get(id);
        const conv = convs.get(id);
        const scene = story ?? conv;
        if (!scene || !scene.lines[i]) continue;
        out.push({ key, scene, index: i, to: story ? `/stories/${id}` : `/cinema/${id}` });
      }
      setLines(out);
    });
    return () => {
      live = false;
    };
  }, [savedLineKeys]);

  const stories = state.saved.stories.map(storyRef).filter((s): s is SceneRef => !!s);
  const convs = state.saved.conversations.map(conversationRef).filter((s): s is SceneRef => !!s);
  const empty = stories.length === 0 && convs.length === 0 && state.saved.lines.length === 0;

  return (
    <div className="page">
      <TopBar title="Saved scenes" sub="Your own collection" back="/" backLabel="Home" />
      {empty ? (
        <Empty
          title="Nothing saved yet"
          body="Tap the star on a story, an episode or a single line and it will wait for you here."
          action={
            <div className="row center row--wrap">
              <Link className="btn btn--soft" to="/stories">
                Browse stories
              </Link>
              <Link className="btn btn--soft" to="/cinema">
                Browse episodes
              </Link>
            </div>
          }
        />
      ) : (
        <>
          {stories.length > 0 && (
            <>
              <div className="section-title">
                Stories <span className="chip">{stories.length}</span>
              </div>
              <div className="stack--sm">
                {stories.map((s) => (
                  <SceneCard
                    key={s.id}
                    scene={s}
                    to={`/stories/${s.id}`}
                    done={state.stories.completed.includes(s.id)}
                    score={state.stories.scores[s.id]}
                  />
                ))}
              </div>
            </>
          )}

          {convs.length > 0 && (
            <>
              <div className="section-title">
                Episodes <span className="chip">{convs.length}</span>
              </div>
              <div className="stack--sm">
                {convs.map((s) => (
                  <SceneCard
                    key={s.id}
                    scene={s}
                    to={`/cinema/${s.id}`}
                    done={state.conversations.completed.includes(s.id)}
                    score={state.conversations.scores[s.id]}
                  />
                ))}
              </div>
            </>
          )}

          {state.saved.lines.length > 0 && (
            <>
              <div className="section-title">
                Lines <span className="chip">{state.saved.lines.length}</span>
              </div>
              {lines === null ? (
                <p className="small muted">Opening your saved lines…</p>
              ) : (
                <div className="card card--quiet" style={{ padding: 4 }}>
                  {lines.map((r) => (
                    <div key={r.key}>
                      <LineBlock
                        line={r.scene.lines[r.index]!}
                        index={r.index}
                        targets={new Set(r.scene.targets)}
                        captions={state.settings.captions}
                        active={false}
                        saved
                        onSave={() => toggleSaved('lines', r.key)}
                      />
                      <Link className="tiny muted" to={r.to} style={{ padding: '0 14px 10px', display: 'block' }}>
                        {r.scene.emoji} {r.scene.title} ›
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <p className="tiny muted">
            From {STORY_INDEX.length} stories and {CONVERSATION_INDEX.length} episodes.
          </p>
        </>
      )}
    </div>
  );
}
