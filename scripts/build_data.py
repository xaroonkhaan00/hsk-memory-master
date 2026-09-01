#!/usr/bin/env python3
"""Compile the raw, hand-authored data files into the JSON the app loads.

SOURCE data (src/data/hsk3-source.json) is produced by scripts/extract_pdf.py and is
never modified here.  Everything this script adds is ENRICHMENT and is kept in
separate fields so the two layers stay distinguishable in the UI.
"""
import json, os, re, unicodedata, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'src', 'data')
OUT = os.path.join(D, 'generated')
os.makedirs(OUT, exist_ok=True)

def raw(name):
    with open(os.path.join(D, name), encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            if line.strip() and not line.startswith('#'):
                yield line

source = json.load(open(os.path.join(D, 'hsk3-source.json'), encoding='utf-8'))

# ---------------------------------------------------------------- characters
CHARS = {}
for line in raw('characters.raw.txt'):
    c, p, g = line.split('|')
    CHARS[c] = {'char': c, 'pinyin': p, 'gloss': g}

HOOKS = {}
for line in raw('soundhooks.raw.txt'):
    b, h = line.split('|', 1)
    HOOKS[b] = h

ENRICH = {}
for line in raw('enrichment.raw.txt'):
    i, cat, room, story = line.split('|', 3)
    ENRICH[int(i)] = {'category': cat, 'room': room, 'story': story}

EN = {}
for line in raw('example-en.raw.txt'):
    i, t = line.split('|', 1)
    EN[int(i)] = t

LEX = {}
for line in raw('lexicon.raw.txt'):
    a, b = line.split('|')
    LEX[a] = b

# ---------------------------------------------------------------- pinyin utils
INI = ['zh','ch','sh','b','p','m','f','d','t','n','l','g','k','h','j','q','x','r','z','c','s']
FIN = ['a','o','e','ai','ei','ao','ou','an','en','ang','eng','ong','er',
       'i','ia','ie','iao','iu','iou','ian','in','iang','ing','iong',
       'u','ua','uo','uai','ui','uei','uan','un','uen','uang','ueng',
       'v','ve','van','vn']
VALID = set()
for i in INI:
    for f in FIN:
        if f == 'er':
            continue
        VALID.add(i + f)
VALID |= set('a o e ai ei ao ou an en ang eng er yi ya ye yao you yan yin yang ying yong yu yue yuan yun wu wa wo wai wei wan wen wang weng'.split())
VALID |= {'r','ju','qu','xu','jue','que','xue','juan','quan','xuan','jun','qun','xun','yo'}

TONEMARKS = {}
for idx, row in enumerate(['āēīōūǖ', 'áéíóúǘ', 'ǎěǐǒǔǚ', 'àèìòùǜ']):
    for ch in row:
        TONEMARKS[ch] = idx + 1

def tone_of(s):
    for ch in s:
        if ch in TONEMARKS:
            return TONEMARKS[ch]
    return 5

def strip_tone(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if c not in '̀́̄̌')
    return unicodedata.normalize('NFC', s)

def split_base(base):
    base = base.lower().replace('ü', 'v')
    n = len(base)
    memo = {}
    def go(i):
        if i == n:
            return []
        if i in memo:
            return memo[i]
        for L in range(min(6, n - i), 0, -1):
            piece = base[i:i + L]
            if i > 0 and piece[0] in 'aoe':
                continue
            if piece in VALID:
                rest = go(i + L)
                if rest is not None:
                    memo[i] = [piece] + rest
                    return memo[i]
        memo[i] = None
        return None
    return go(0)

LETTERS = 'A-Za-zÀ-ÿāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹ'

def syllabify(pinyin):
    out = []
    for part in re.split('([^' + LETTERS + '])', pinyin):
        if not part:
            continue
        if not re.fullmatch('[' + LETTERS + ']+', part):
            continue
        segs = split_base(strip_tone(part))
        if segs is None:
            out.append({'raw': part, 'base': strip_tone(part).lower(), 'tone': tone_of(part)})
            continue
        pos = 0
        for s in segs:
            piece = part[pos:pos + len(s)]
            pos += len(s)
            out.append({'raw': piece, 'base': s, 'tone': tone_of(piece)})
    return out

# ---------------------------------------------------------------- example pinyin
# Readings for characters that are ambiguous on their own. 个 is listed by the
# PDF as gè, but in running text as a measure word it is always the neutral ge.
POLY_DEFAULT = {'都':'dōu','还':'hái','少':'shǎo','喂':'wèi','只':'zhǐ','长':'cháng',
                '得':'de','种':'zhǒng','着':'zhe','教':'jiāo','个':'ge'}
POLY_OVERRIDE = {
    '405.0.0': {'还':'huán'},
    '584.0.0': {'只':'zhī'}, '584.0.1': {'只':'zhī'},
    '545.0.0': {'长':'zhǎng'}, '560.0.0': {'长':'zhǎng'},
    '373.1.0': {'得':'dé'},
    '305.1.0': {'着':'zháo'},
}
lexicon = dict(LEX)
for e in source:
    hz = e['hanzi']
    if '（' in hz or '…' in hz:
        continue
    lexicon.setdefault(hz, e['pinyin'])
lexicon.setdefault('那', 'nà')
lexicon.setdefault('这', 'zhè')
MAXLEX = max(len(k) for k in lexicon)

def tokenize(text, key):
    ov = POLY_OVERRIDE.get(key, {})
    toks, i = [], 0
    while i < len(text):
        ch = text[i]
        if not ('一' <= ch <= '鿿'):
            toks.append({'z': ch})
            i += 1
            continue
        hit = None
        for L in range(min(MAXLEX, len(text) - i), 1, -1):
            sub = text[i:i + L]
            if sub in lexicon:
                hit = (sub, lexicon[sub])
                break
        if hit:
            toks.append({'z': hit[0], 'p': hit[1]})
            i += len(hit[0])
        else:
            p = ov.get(ch) or POLY_DEFAULT.get(ch) or CHARS.get(ch, {}).get('pinyin', '?')
            if '/' in p:
                p = p.split('/')[0]
            toks.append({'z': ch, 'p': p})
            i += 1
    # tone sandhi for 不 and 一
    for idx, t in enumerate(toks):
        if 'p' not in t or len(t['z']) != 1:
            continue
        nxt = next((toks[j] for j in range(idx + 1, len(toks)) if 'p' in toks[j]), None)
        if t['z'] == '不':
            t['p'] = 'bú' if (nxt and tone_of(nxt['p'].split()[0]) == 4) else 'bù'
        elif t['z'] == '一':
            prev = toks[idx - 1] if idx > 0 else None
            if prev and prev.get('z') in '第十二三四五六七八九':
                t['p'] = 'yī'
            elif nxt is None:
                t['p'] = 'yī'
            elif nxt.get('z') == '个':
                # 个 is written neutral but is underlyingly 4th tone, so 一个
                # takes the 4th-tone sandhi: yí ge.
                t['p'] = 'yí'
            else:
                t['p'] = 'yí' if tone_of(nxt['p'].split()[0]) == 4 else 'yì'
    return toks

# ---------------------------------------------------------------- build words
def level_of(i):
    return 1 if i <= 150 else (2 if i <= 300 else 3)

words = []
ex_index = 0
warnings = []
for e in source:
    eid = e['id']
    enr = ENRICH[eid]
    hz = e['hanzi']
    frame_parts = [p for p in hz.split('……') if p]
    plain = hz.split('（')[0].replace('……', '')
    syl = syllabify(e['pinyin'])
    hchars = [c for c in hz if '一' <= c <= '鿿']
    charinfo = []
    for idx, c in enumerate(hchars):
        info = CHARS.get(c)
        charinfo.append({
            'char': c,
            'gloss': info['gloss'] if info else '',
            'pinyin': syl[idx]['raw'] if idx < len(syl) else (info['pinyin'] if info else ''),
        })
    senses = []
    for si, s in enumerate(e['senses']):
        examples = []
        for xi, x in enumerate(s['examples']):
            if len(frame_parts) > 1:
                res, k = '', 0
                for ch in x:
                    if ch in '～~':
                        res += frame_parts[min(k, len(frame_parts) - 1)]
                        k += 1
                    else:
                        res += ch
                zh = res
            else:
                zh = x.replace('～', plain).replace('~', plain)
            toks = tokenize(zh, '%d.%d.%d' % (eid, si, xi))
            pin = ' '.join(t['p'] for t in toks if 'p' in t)
            if '?' in pin:
                unknown = ''.join(t['z'] for t in toks if t.get('p') == '?')
                warnings.append('word %d example %d: no reading for %s' % (eid, xi, unknown))
            examples.append({
                'zh': zh,
                'cloze': x,
                'tokens': toks,
                'pinyin': pin,
                'en': EN[ex_index],
            })
            ex_index += 1
        meanings = [m.strip() for m in re.split(r';(?![^(]*\))', s['meaning']) if m.strip()]
        senses.append({'pos': s['pos'], 'meaning': s['meaning'], 'meanings': meanings,
                       'examples': examples})
    if not senses:
        warnings.append('word %d has no senses' % eid)
    hooks = [{'syllable': sy['raw'], 'base': sy['base'], 'tone': sy['tone'],
              'hook': HOOKS.get(sy['base'], '')} for sy in syl]
    missing_hook = [h['base'] for h in hooks if not h['hook']]
    if missing_hook:
        warnings.append('word %d missing sound hook for %s' % (eid, ','.join(missing_hook)))
    logic = None
    if len(charinfo) > 1 and all(c['gloss'] for c in charinfo):
        # Show up to two senses per character. Taking only the first is
        # misleading where the word uses a secondary reading — 音乐 is
        # sound + MUSIC, not sound + happy.
        def short(gloss):
            return '; '.join(g.strip() for g in gloss.split(';')[:2])
        parts = ' + '.join('%s (%s)' % (c['char'], short(c['gloss'])) for c in charinfo)
        primary = senses[0]['meanings'][0] if senses and senses[0]['meanings'] else ''
        logic = '%s  →  %s' % (parts, primary)
    words.append({
        'id': eid,
        'level': level_of(eid),
        'hanzi': hz,
        'plain': plain,
        'pinyin': e['pinyin'],
        'pinyinPlain': strip_tone(e['pinyin']).lower(),
        'syllables': syl,
        'tones': [s['tone'] for s in syl],
        'senses': senses,
        'chars': charinfo,
        'category': enr['category'],
        'room': enr['room'],
        'story': enr['story'],
        'soundHooks': hooks,
        'charLogic': logic,
        'primaryMeaning': senses[0]['meanings'][0] if senses and senses[0]['meanings'] else '',
        'allMeanings': [m for s in senses for m in s['meanings']],
        'pos': [s['pos'] for s in senses if s['pos']],
    })

byid = {w['id']: w for w in words}

# The PDF lists six headwords twice — once per reading or sense, and 长 simply
# twice. Cross-link them rather than silently merging or dropping either entry.
same_hanzi = collections.defaultdict(list)
for w in words:
    same_hanzi[w['hanzi']].append(w['id'])
for w in words:
    w['alsoListedAs'] = [i for i in same_hanzi[w['hanzi']] if i != w['id']]
repeated_headwords = [
    {'hanzi': hz, 'words': sorted(ids)} for hz, ids in same_hanzi.items() if len(ids) > 1
]
repeated_headwords.sort(key=lambda r: r['words'][0])

# ---------------------------------------------------------------- character hubs
charwords = collections.defaultdict(list)
for w in words:
    for c in {c['char'] for c in w['chars']}:
        charwords[c].append(w['id'])
char_hubs = []
for c, ids in charwords.items():
    info = CHARS.get(c, {'pinyin': '', 'gloss': ''})
    char_hubs.append({'char': c, 'pinyin': info['pinyin'], 'gloss': info['gloss'],
                      'words': sorted(ids)})
char_hubs.sort(key=lambda h: (-len(h['words']), h['char']))

# ---------------------------------------------------------------- sound families
sylwords = collections.defaultdict(list)
for w in words:
    for s in w['syllables']:
        if w['id'] not in sylwords[s['base']]:
            sylwords[s['base']].append(w['id'])
sounds = []
for b, ids in sylwords.items():
    sounds.append({'base': b, 'hook': HOOKS.get(b, ''), 'words': sorted(ids)})
sounds.sort(key=lambda s: (-len(s['words']), s['base']))

CONFUSING_GROUPS = [
    {'key': 'zh-z', 'label': 'zh / z', 'initials': ['zh', 'z'],
     'tip': 'zh curls the tongue back; z is flat, like the "ds" in "beds".'},
    {'key': 'ch-c', 'label': 'ch / c', 'initials': ['ch', 'c'],
     'tip': 'ch curls the tongue back; c is flat, like the "ts" in "cats".'},
    {'key': 'sh-s', 'label': 'sh / s', 'initials': ['sh', 's'],
     'tip': 'sh curls the tongue back; s is a plain English s.'},
    {'key': 'j-q-x', 'label': 'j / q / x', 'initials': ['j', 'q', 'x'],
     'tip': 'All three are made with a smiling mouth: j = unaspirated, q = the same with a puff of air, x = the hiss.'},
    {'key': 'n-l', 'label': 'n / l', 'initials': ['n', 'l'],
     'tip': 'n sends the air through the nose; l lets it flow round the tongue.'},
    {'key': 'an-ang', 'label': '-an / -ang', 'finals': ['an', 'ang'],
     'tip': '-an ends at the teeth; -ang ends at the back of the throat.'},
    {'key': 'in-ing', 'label': '-in / -ing', 'finals': ['in', 'ing'],
     'tip': '-in is closed at the front; -ing hums at the back.'},
    {'key': 'en-eng', 'label': '-en / -eng', 'finals': ['en', 'eng'],
     'tip': '-en is short and closed; -eng opens into the throat.'},
    {'key': 'u-v', 'label': 'u / ü', 'finals': ['u', 'v'],
     'tip': 'For ü, say "ee" and then round your lips without moving your tongue.'},
]
def initial_of(base):
    for i in ['zh', 'ch', 'sh', 'b','p','m','f','d','t','n','l','g','k','h','j','q','x','r','z','c','s']:
        if base.startswith(i):
            return i
    return ''
def final_of(base):
    return base[len(initial_of(base)):]
sound_groups = []
for g in CONFUSING_GROUPS:
    members = []
    for s in sounds:
        b = s['base']
        if 'initials' in g and initial_of(b) in g['initials']:
            members.append(s['base'])
        elif 'finals' in g and final_of(b) in g['finals']:
            members.append(s['base'])
    ids = sorted({i for b in members for i in sylwords[b]})
    sound_groups.append({'key': g['key'], 'label': g['label'], 'tip': g['tip'],
                         'syllables': sorted(set(members)), 'words': ids})

# ---------------------------------------------------------------- word families
CHAR_DF = {c: len(ids) for c, ids in charwords.items()}
related = collections.defaultdict(list)
for c, ids in charwords.items():
    if len(ids) < 2 or len(ids) > 30:
        continue
    for a in ids:
        for b in ids:
            if a != b:
                related[a].append((b, 1.0 / CHAR_DF[c], c))
for w in words:
    scored = collections.defaultdict(lambda: [0.0, []])
    for b, sc, c in related[w['id']]:
        scored[b][0] += sc
        scored[b][1].append(c)
    ranked = sorted(scored.items(), key=lambda kv: -kv[1][0])[:8]
    w['related'] = [{'id': b, 'via': v[1]} for b, v in ranked]

# families built from a shared character (only those with 2..12 members)
families = []
for hub in char_hubs:
    if 2 <= len(hub['words']) <= 12:
        families.append({'char': hub['char'], 'pinyin': hub['pinyin'], 'gloss': hub['gloss'],
                         'words': hub['words']})
families.sort(key=lambda f: -len(f['words']))

# ---------------------------------------------------------------- confusions
confusions = []
for idx, line in enumerate(raw('confusions.raw.txt')):
    ids, kind, title, rule = line.split('|', 3)
    wl = [int(x) for x in ids.split(',')]
    for i in wl:
        if i not in byid:
            warnings.append('confusion set %d references unknown word %d' % (idx, i))
    confusions.append({'key': 'c%d' % idx, 'words': wl, 'kind': kind, 'title': title, 'rule': rule})

conf_of = collections.defaultdict(set)
for c in confusions:
    for a in c['words']:
        for b in c['words']:
            if a != b:
                conf_of[a].add(b)
# auto-detected: identical toneless pinyin, different word
by_plain = collections.defaultdict(list)
for w in words:
    by_plain[w['pinyinPlain']].append(w['id'])
auto_homophones = []
for p, ids in by_plain.items():
    if len(ids) > 1:
        auto_homophones.append({'pinyin': p, 'words': sorted(ids)})
        for a in ids:
            for b in ids:
                if a != b:
                    conf_of[a].add(b)
auto_homophones.sort(key=lambda h: h['pinyin'])

# Tone twins: same syllables, different tones. These are the pairs where the
# tone is the ONLY thing carrying the meaning.
tone_twins = []
for p, ids in by_plain.items():
    if len(ids) < 2:
        continue
    variants = {}
    for i in ids:
        variants.setdefault(byid[i]['pinyin'], []).append(i)
    if len(variants) > 1:
        tone_twins.append({
            'base': p,
            'variants': [{'pinyin': k, 'words': sorted(v)} for k, v in sorted(variants.items())],
        })
tone_twins.sort(key=lambda t: t['base'])
for w in words:
    w['confusable'] = sorted(conf_of[w['id']])

# ---------------------------------------------------------------- packs
CATEGORY_LABEL = {
    'family': 'Family', 'people': 'People', 'school': 'School', 'work': 'Work',
    'food': 'Food', 'restaurant': 'Eating out', 'transport': 'Transport',
    'places': 'Places', 'time': 'Time', 'dates': 'Days & dates', 'weather': 'Weather',
    'body': 'Body', 'health': 'Health', 'shopping': 'Shopping', 'money': 'Money',
    'travel': 'Travel', 'daily': 'Daily routine', 'communication': 'Talking',
    'direction': 'Directions', 'emotion': 'Feelings', 'action': 'Verbs',
    'adjective': 'Describing words', 'grammar': 'Grammar glue', 'connector': 'Connectors',
    'question': 'Question words', 'number': 'Numbers & measure words', 'nature': 'Nature',
    'home': 'Home', 'sport': 'Sport', 'clothing': 'Clothes', 'tech': 'Devices',
    'abstract': 'Abstract ideas', 'animal': 'Animals', 'adverb': 'Adverbs',
    'entertainment': 'Fun & media',
}
CAT_ORDER = ['number','people','family','question','grammar','adverb','connector',
             'action','adjective','time','dates','school','food','restaurant','home',
             'direction','places','transport','travel','shopping','money','work',
             'communication','emotion','body','health','weather','nature','animal',
             'clothing','sport','daily','tech','entertainment','abstract']
ROOM_LABEL = {
    'home': 'Front door & living room', 'bedroom': 'Bedroom', 'kitchen': 'Kitchen',
    'bathroom': 'Bathroom', 'university': 'University campus', 'classroom': 'Classroom',
    'restaurant': 'Restaurant', 'shop': 'Shop & market', 'street': 'The street',
    'busstop': 'Bus stop', 'airport': 'Airport', 'hospital': 'Hospital',
    'park': 'Park', 'office': 'Office',
}
ROOM_ICON = {'home':'🏠','bedroom':'🛏️','kitchen':'🍳','bathroom':'🛁','university':'🎓',
             'classroom':'📚','restaurant':'🍜','shop':'🛒','street':'🛣️','busstop':'🚏',
             'airport':'✈️','hospital':'🏥','park':'🌳','office':'💼'}

packs = []
PACK_SIZE = 20
for lvl in (1, 2, 3):
    pool = [w for w in words if w['level'] == lvl]
    buckets = collections.OrderedDict()
    for cat in CAT_ORDER:
        got = [w['id'] for w in pool if w['category'] == cat]
        if got:
            buckets[cat] = got
    for w in pool:
        if w['category'] not in buckets:
            buckets.setdefault('_other', []).append(w['id'])
    flat = []
    for cat, ids in buckets.items():
        for i in ids:
            flat.append((cat, i))
    k = max(1, round(len(flat) / PACK_SIZE))
    sizes = [len(flat) // k + (1 if j < len(flat) % k else 0) for j in range(k)]
    pos = 0
    for size in sizes:
        chunk = flat[pos:pos + size]
        pos += size
        cats = collections.Counter(c for c, _ in chunk)
        top = [c for c, _ in cats.most_common(2) if c != '_other']
        if not top:
            label = 'Mixed pack'
        elif len(top) == 1 or cats[top[0]] >= len(chunk) * 0.75:
            label = CATEGORY_LABEL.get(top[0], top[0].title())
        else:
            label = '%s + %s' % (CATEGORY_LABEL.get(top[0], top[0]),
                                 CATEGORY_LABEL.get(top[1], top[1]))
        packs.append({'index': len(packs), 'level': lvl, 'label': label,
                      'words': [i for _, i in chunk],
                      'categories': sorted(cats)})
for p in packs:
    p['id'] = 'pack-%02d' % (p['index'] + 1)
    p['title'] = 'Pack %d · %s' % (p['index'] + 1, p['label'])
for p in packs:
    for i in p['words']:
        byid[i]['pack'] = p['id']

# ---------------------------------------------------------------- palace + journey
palace = []
for room, label in ROOM_LABEL.items():
    ids = sorted(w['id'] for w in words if w['room'] == room)
    palace.append({'key': room, 'label': label, 'icon': ROOM_ICON.get(room, '📍'), 'words': ids})
JOURNEY = [
    ('bedroom', 'You wake up'), ('bathroom', 'You wash'), ('kitchen', 'You eat'),
    ('home', 'You leave the house'), ('street', 'You walk down the street'),
    ('busstop', 'You wait for the bus'), ('classroom', 'You reach class'),
    ('university', 'You cross the campus'), ('office', 'You go to work'),
    ('restaurant', 'You eat out'), ('shop', 'You shop on the way back'),
    ('hospital', 'You visit the clinic'), ('park', 'You take a walk'),
    ('airport', 'You fly away'),
]
journey = [{'step': i + 1, 'room': r, 'caption': cap, 'label': ROOM_LABEL[r],
            'icon': ROOM_ICON.get(r, '📍'),
            'words': sorted(w['id'] for w in words if w['room'] == r)}
           for i, (r, cap) in enumerate(JOURNEY)]

# ---------------------------------------------------------------- measure words
measure = []
for line in raw('measurewords.raw.txt'):
    mw, py, wid, counts, rule, examples, trap = line.split('|')
    exs = []
    for ex in examples.split(';;'):
        zh, pin, en = [p.strip() for p in ex.split('~')]
        exs.append({'zh': zh, 'pinyin': pin, 'en': en})
    measure.append({'mw': mw, 'pinyin': py, 'wordId': int(wid), 'counts': counts,
                    'rule': rule, 'examples': exs, 'trap': trap})

# ---------------------------------------------------------------- dialogues
# Target words are derived from the text so the list can never drift from what
# the dialogue actually says.
word_by_hanzi = {}
for w in words:
    word_by_hanzi.setdefault(w['plain'], w['id'])
MAXWORD = max(len(k) for k in word_by_hanzi)

def targets_in(text):
    found, i = [], 0
    while i < len(text):
        hit = None
        for L in range(min(MAXWORD, len(text) - i), 0, -1):
            sub = text[i:i + L]
            if sub in word_by_hanzi:
                hit = (sub, word_by_hanzi[sub])
                break
        if hit:
            if hit[1] not in found:
                found.append(hit[1])
            i += len(hit[0])
        else:
            i += 1
    return found

dialogues = []
for idx, line in enumerate(raw('dialogues.raw.txt')):
    title, body = line.split('|', 1)
    lines = []
    joined = ''
    for chunk in body.split(';;'):
        speaker, zh, en = [p.strip() for p in chunk.split('~')]
        toks = tokenize(zh, 'dlg.%d' % idx)
        joined += zh
        pin = ' '.join(t['p'] for t in toks if 'p' in t)
        if '?' in pin:
            unknown = ''.join(t['z'] for t in toks if t.get('p') == '?')
            warnings.append('dialogue "%s": no reading for %s' % (title.strip(), unknown))
        lines.append({'speaker': speaker, 'zh': zh, 'en': en, 'tokens': toks, 'pinyin': pin})
    found = targets_in(joined)
    # Rank by how much a learner gains: longer words and rarer ones first.
    found.sort(key=lambda i: (-len(byid[i]['plain']), byid[i]['id']))
    dialogues.append({'id': 'dlg-%02d' % (idx + 1), 'title': title.strip(),
                      'lines': lines, 'targets': found[:8], 'allWords': found})

# ---------------------------------------------------------------- stories
STORY_SIZE = 10
story_chains = []
for p in packs:
    ids = p['words'][:STORY_SIZE]
    story_chains.append({'packId': p['id'], 'title': p['title'], 'words': ids})

# ---------------------------------------------------------------- validation
ids = [w['id'] for w in words]
dupes = [i for i, n in collections.Counter(ids).items() if n > 1]
missing_ids = [i for i in range(1, 601) if i not in set(ids)]
no_pos = [w['id'] for w in words if not w['pos']]
no_example = [w['id'] for w in words if not any(s['examples'] for s in w['senses'])]
no_pinyin = [w['id'] for w in words if not w['pinyin']]
no_meaning = [w['id'] for w in words if not w['primaryMeaning']]
missing_chars = sorted({c for w in words for c in w['chars'] if not c['gloss']})
missing_hooks = sorted({h['base'] for w in words for h in w['soundHooks'] if not h['hook']})
mismatch = [w['id'] for w in words
            if len([c for c in w['hanzi'] if '一' <= c <= '鿿']) != len(w['syllables'])]

meta = {
    'generatedFrom': 'HSK3_VOCABULARY_CHIENG.pdf (New HSK Level 3 Vocabulary, Chinese-English)',
    'totalWords': len(words),
    'totalExamples': sum(len(s['examples']) for w in words for s in w['senses']),
    'totalSenses': sum(len(w['senses']) for w in words),
    'uniqueCharacters': len(char_hubs),
    'uniqueSyllables': len(sounds),
    'packs': len(packs),
    'confusionSets': len(confusions),
    'toneTwins': len(tone_twins),
    'measureWords': len(measure),
    'dialogues': len(dialogues),
    'idsCovered': len(set(ids)),
    'duplicateIds': dupes,
    'missingIds': missing_ids,
    'missingPinyin': no_pinyin,
    'missingMeaning': no_meaning,
    'missingExample': no_example,
    'posAbsentInPdf': no_pos,
    'repeatedHeadwords': repeated_headwords,
    'charactersWithoutGloss': missing_chars,
    'syllablesWithoutHook': missing_hooks,
    'syllableCountMismatch': mismatch,
    'warnings': warnings,
    'levels': dict(collections.Counter(w['level'] for w in words)),
    'categories': dict(collections.Counter(w['category'] for w in words)),
    'categoryLabels': CATEGORY_LABEL,
}

def dump(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    print('%-22s %8d bytes' % (name, os.path.getsize(os.path.join(OUT, name))))

dump('vocab.json', words)
dump('characters.json', char_hubs)
dump('sounds.json', {'syllables': sounds, 'groups': sound_groups})
dump('families.json', families)
dump('packs.json', packs)
dump('confusions.json', {'sets': confusions, 'homophones': auto_homophones,
                         'toneTwins': tone_twins})
dump('measurewords.json', measure)
dump('palace.json', {'rooms': palace, 'journey': journey})
dump('dialogues.json', dialogues)
dump('stories.json', story_chains)
dump('meta.json', meta)
print()
print('words %d | examples %d | packs %d | chars %d | syllables %d'
      % (len(words), meta['totalExamples'], len(packs), len(char_hubs), len(sounds)))
if warnings:
    print('WARNINGS:')
    for w in warnings[:20]:
        print('  -', w)
    raise SystemExit(1)
