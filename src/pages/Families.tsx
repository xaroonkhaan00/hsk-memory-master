import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CHAR_HUBS, FAMILIES, SOUNDS, SOUND_GROUPS, categoryLabel, getWord, WORDS } from '../data';
import { Segmented, TopBar } from '../components/ui';

type Tab = 'character' | 'word' | 'sound';

export default function Families() {
  const [tab, setTab] = useState<Tab>('character');
  const [q, setQ] = useState('');

  const hubs = useMemo(
    () => CHAR_HUBS.filter((h) => h.words.length > 1 && (!q || h.char.includes(q) || h.gloss.toLowerCase().includes(q.toLowerCase()))),
    [q],
  );

  const semantic = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const w of WORDS) {
      const list = groups.get(w.category) ?? [];
      list.push(w.id);
      groups.set(w.category, list);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, []);

  return (
    <>
      <TopBar title="Families" sub="Learn one, see the rest" />
      <div className="page stack">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'character' as Tab, label: 'Characters' },
            { value: 'word' as Tab, label: 'Word families' },
            { value: 'sound' as Tab, label: 'Sounds' },
          ]}
          ariaLabel="Family type"
        />

        {tab === 'character' && (
          <>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a character or its meaning…"
            />
            <p className="small muted">
              {hubs.length} characters appear in more than one of your 600 words. These are the
              building blocks — learn the block and several words come free.
            </p>
            <div className="grid grid--auto">
              {hubs.slice(0, 120).map((h) => (
                <Link className="card pack-card" to={`/families/char/${encodeURIComponent(h.char)}`} key={h.char}>
                  <div className="row">
                    <span className="hanzi" style={{ fontSize: '2.2rem' }}>
                      {h.char}
                    </span>
                    <div style={{ flex: 1 }}>
                      <b>{h.pinyin}</b>
                      <div className="small muted">{h.gloss}</div>
                    </div>
                    <span className="chip">{h.words.length}</span>
                  </div>
                  <div className="hz hanzi">{h.words.slice(0, 5).map((id) => getWord(id).hanzi).join(' ')}</div>
                </Link>
              ))}
            </div>
          </>
        )}

        {tab === 'word' && (
          <>
            <p className="small muted">
              Meaning groups first, then the tightest character families. Learning 学习 next to
              学生 and 学校 is three words for the price of one.
            </p>
            <div className="section-title">By theme</div>
            <div className="grid grid--auto">
              {semantic.map(([cat, ids]) => (
                <Link className="card pack-card" to={`/browse?cat=${cat}`} key={cat}>
                  <div className="row">
                    <b style={{ flex: 1 }}>{categoryLabel(cat)}</b>
                    <span className="chip">{ids.length}</span>
                  </div>
                  <div className="hz hanzi">{ids.slice(0, 8).map((id) => getWord(id).hanzi).join(' ')}</div>
                </Link>
              ))}
            </div>
            <div className="section-title">Tight character families</div>
            <div className="stack--sm stack">
              {FAMILIES.slice(0, 60).map((f) => (
                <div className="card" key={f.char}>
                  <div className="row">
                    <Link className="hanzi" to={`/families/char/${encodeURIComponent(f.char)}`} style={{ fontSize: '1.8rem' }}>
                      {f.char}
                    </Link>
                    <div style={{ flex: 1 }}>
                      <b>{f.pinyin}</b> — <span className="small muted">{f.gloss}</span>
                    </div>
                  </div>
                  <div className="row row--wrap" style={{ marginTop: 6 }}>
                    {f.words.map((id) => {
                      const w = getWord(id);
                      return (
                        <Link className="chip chip--button" to={`/word/${id}`} key={id}>
                          <span className="hanzi">{w.hanzi}</span> {w.pinyin}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'sound' && (
          <>
            <div className="section-title">Confusable sound groups</div>
            <div className="stack--sm stack">
              {SOUND_GROUPS.map((g) => (
                <div className="card" key={g.key}>
                  <div className="row">
                    <b style={{ flex: 1 }}>{g.label}</b>
                    <span className="chip">{g.words.length} words</span>
                  </div>
                  <p className="small muted" style={{ marginTop: 4 }}>
                    {g.tip}
                  </p>
                  <div className="row row--wrap" style={{ marginTop: 6 }}>
                    {g.syllables.slice(0, 20).map((s) => (
                      <span className="chip mono" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                  <Link className="btn btn--soft btn--sm" style={{ marginTop: 8 }} to="/pinyin">
                    Drill this group
                  </Link>
                </div>
              ))}
            </div>
            <div className="section-title">Repeated syllables</div>
            <div className="card stack--sm stack">
              {SOUNDS.filter((s) => s.words.length > 1)
                .slice(0, 60)
                .map((s) => (
                  <div className="row row--wrap" key={s.base}>
                    <span className="chip chip--accent mono">{s.base}</span>
                    <span className="tiny muted" style={{ flex: 1 }}>
                      {s.hook}
                    </span>
                    <span className="row row--wrap">
                      {s.words.slice(0, 8).map((id) => {
                        const w = getWord(id);
                        return (
                          <Link className="chip chip--button" key={id} to={`/word/${id}`}>
                            <span className="hanzi">{w.hanzi}</span>
                          </Link>
                        );
                      })}
                    </span>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
