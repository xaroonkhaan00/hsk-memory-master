#!/usr/bin/env python3
"""Print the words still missing from Story Mode or Conversation Cinema."""
import json, sys
which = sys.argv[1] if len(sys.argv) > 1 else 'story'
meta = json.load(open('src/data/generated/meta.json'))
by = {w['id']: w for w in json.load(open('src/data/generated/vocab.json'))}
missing = meta['storyMissing' if which == 'story' else 'conversationMissing']
print(f'{which} gaps: {len(missing)}')
for i in range(0, len(missing), 10):
    row = missing[i:i + 10]
    print('  ' + '  '.join(f"{by[x]['hanzi']}({by[x]['primaryMeaning'][:11]})" for x in row))
