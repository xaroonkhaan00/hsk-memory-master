#!/usr/bin/env python3
"""Extract the 600 HSK-3 vocabulary records from the source PDF.

    pip install pypdfium2
    python3 scripts/extract_pdf.py docs/HSK3_VOCABULARY_CHIENG.pdf src/data/hsk3-source.json

The PDF is a six-column table (No. / Word / Pinyin / Parts of Speech / Meaning /
Example) whose cells are drawn with real ruling lines. Reading the text stream
alone is not enough: several rows wrap their number across two lines (row 218
prints "21" then "8"), long meanings wrap inside their cell, and words with more
than one sense are split by half-width rules that only cross the last three
columns.

So the extraction works off the geometry instead:

  * vertical rules  -> exact column boundaries
  * full-width horizontal rules -> one vocabulary record each
  * half-width horizontal rules -> sense divisions inside a record
  * characters are assigned to a cell by their x position, then joined in the
    PDF's own reading order, with a line break inserted where the y position
    jumps

The result is the SOURCE layer: exactly what the PDF says, with nothing added.
All memory aids live in the separate raw files under src/data/ and are merged in
by scripts/build_data.py.
"""
import json
import os
import re
import sys

import pypdfium2 as pdfium
import pypdfium2.raw as pr


def cluster(values, tol=1.5):
    out = []
    for v in sorted(values):
        if out and v - out[-1][-1] <= tol:
            out[-1].append(v)
        else:
            out.append([v])
    return [sum(g) / len(g) for g in out]


def page_grid(page):
    """Return (full-width rule ys, part-width rule ys, column boundary xs)."""
    horizontals = {}
    verticals = []
    for obj in page.get_objects():
        if obj.type == pr.FPDF_PAGEOBJ_TEXT:
            continue
        left, bottom, right, top = obj.get_bounds()
        if top - bottom <= 1.2 and right - left > 3:
            y = round((bottom + top) / 2, 1)
            prev = horizontals.get(y, (left, right))
            horizontals[y] = (min(prev[0], left), max(prev[1], right))
        if right - left <= 1.2 and top - bottom > 3:
            verticals.append((left + right) / 2)
    columns = cluster(verticals)
    full, part = [], []
    for y, (left, _right) in horizontals.items():
        (full if left < columns[0] + 5 else part).append(y)
    return sorted(full, reverse=True), sorted(part, reverse=True), columns


def page_chars(page):
    textpage = page.get_textpage()
    chars = []
    for i in range(textpage.count_chars()):
        ch = textpage.get_text_range(i, 1)
        if ch in ('\r', '\n', '﻿'):
            continue
        left, bottom, _right, top = textpage.get_charbox(i)
        chars.append({'i': i, 'y': (bottom + top) / 2, 'x': left, 'c': ch})
    return chars


def cells_of(chars, columns):
    """Split characters into per-column strings, in the PDF's reading order."""
    ncol = len(columns) - 1
    buckets = [[] for _ in range(ncol)]
    for ch in chars:
        for k in range(ncol):
            if columns[k] - 1 <= ch['x'] < columns[k + 1] - 1:
                buckets[k].append(ch)
                break
    out = []
    for bucket in buckets:
        bucket.sort(key=lambda c: c['i'])
        segments, current, prev_y = [], '', None
        for ch in bucket:
            if prev_y is not None and prev_y - ch['y'] > 5:
                segments.append(current)
                current = ''
            current += ch['c']
            prev_y = ch['y']
        segments.append(current)
        out.append([s.strip() for s in segments if s.strip()])
    return out


def join_meaning(segments):
    text = ''
    for seg in segments:
        if not text:
            text = seg
        elif re.match(r'^[.,;:)\]]', seg) or text.endswith('-'):
            text += seg
        else:
            text += ' ' + seg
    return re.sub(r'\s+', ' ', text).strip()


def split_examples(segments):
    """A wrapped example continues; a finished one ends in 。？！"""
    examples, current = [], ''
    for seg in segments:
        current = (current + seg) if current else seg
        if re.search(r'[。？！?!]$', current.strip()):
            examples.append(current.strip())
            current = ''
    if current.strip():
        examples.append(current.strip())
    return examples


def extract(pdf_path):
    pdf = pdfium.PdfDocument(pdf_path)
    records = []
    for page_index in range(len(pdf)):
        page = pdf[page_index]
        full, part, columns = page_grid(page)
        if len(columns) < 7:
            continue
        chars = page_chars(page)
        for i in range(len(full) - 1):
            top, bottom = full[i], full[i + 1]
            if top - bottom < 5:
                continue
            band = [c for c in chars if bottom < c['y'] < top]
            if not band:
                continue
            whole = cells_of(band, columns)
            if not whole[0] or whole[0][0].startswith('序号'):
                continue  # table header
            number = ''.join(whole[0]).replace(' ', '')
            if not re.fullmatch(r'\d+', number):
                continue
            hanzi = ''.join(whole[1]).strip()
            m = re.fullmatch(r'【(.+?)】', hanzi)
            if m:
                hanzi = m.group(1)
            pinyin = ' '.join(whole[2]).strip() if len(whole[2]) > 1 else (whole[2][0] if whole[2] else '')

            cuts = [top] + sorted([y for y in part if bottom < y < top], reverse=True) + [bottom]
            senses = []
            for k in range(len(cuts) - 1):
                sub = [c for c in band if cuts[k + 1] < c['y'] < cuts[k]]
                cells = cells_of(sub, columns)
                pos = ' '.join(cells[3]).strip()
                meaning = join_meaning(cells[4])
                examples = split_examples(cells[5])
                if pos or meaning or examples:
                    senses.append({'pos': pos, 'meaning': meaning, 'examples': examples})
            records.append({'id': int(number), 'hanzi': hanzi, 'pinyin': pinyin, 'senses': senses})
    records.sort(key=lambda r: r['id'])
    return records


def validate(records):
    problems = []
    ids = [r['id'] for r in records]
    if len(records) != 600:
        problems.append(f'expected 600 records, got {len(records)}')
    missing = [i for i in range(1, 601) if i not in set(ids)]
    if missing:
        problems.append(f'missing ids: {missing}')
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        problems.append(f'duplicate ids: {dupes}')
    for r in records:
        if not r['hanzi']:
            problems.append(f'#{r["id"]} has no hanzi')
        if not r['pinyin']:
            problems.append(f'#{r["id"]} has no pinyin')
        if not any(s['meaning'] for s in r['senses']):
            problems.append(f'#{r["id"]} has no meaning')
        if not any(s['examples'] for s in r['senses']):
            problems.append(f'#{r["id"]} has no example')
    return problems


def main():
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else 'docs/HSK3_VOCABULARY_CHIENG.pdf'
    out_path = sys.argv[2] if len(sys.argv) > 2 else 'src/data/hsk3-source.json'
    if not os.path.exists(pdf_path):
        sys.exit(f'source PDF not found: {pdf_path}')
    records = extract(pdf_path)
    problems = validate(records)
    print(f'extracted {len(records)} records from {pdf_path}')
    if problems:
        print('VALIDATION PROBLEMS:')
        for p in problems:
            print('  -', p)
        sys.exit(1)
    print('validation: 600 records, ids 1-600 complete, no duplicates, no empty fields')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=1)
    print('wrote', out_path)


if __name__ == '__main__':
    main()
