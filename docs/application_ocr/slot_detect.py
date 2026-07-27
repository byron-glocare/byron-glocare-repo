# -*- coding: utf-8 -*-
"""슬롯 탐지기 — 데이터가 아니라 '문서의 빈칸'을 기준으로 전수 열거.
AI는 이 목록의 각 슬롯에 대해 '어떤 필드가 들어가는가'만 고르면 된다(분류 문제).
"""
import json, re
from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ns = {'w': W}

def load(path='unpacked/word/document.xml'):
    tree = etree.parse(path)
    return tree, tree.getroot().find('w:body', ns)

def cell_text(tc):
    out = []
    for p in tc.findall('w:p', ns):
        out.append(''.join(x.text or '' for x in p.iter('{%s}t' % W)))
    return ' '.join(x.strip() for x in out if x.strip())

def build_grid(tbl):
    """gridSpan/vMerge를 반영해 셀의 실제 시각 열 위치(gc)를 계산."""
    grid = []
    for ri, tr in enumerate(tbl.findall('w:tr', ns)):
        gc = 0
        row = []
        for ci, tc in enumerate(tr.findall('w:tc', ns)):
            tcpr = tc.find('w:tcPr', ns)
            gs = tcpr.find('w:gridSpan', ns) if tcpr is not None else None
            vm = tcpr.find('w:vMerge', ns) if tcpr is not None else None
            span = int(gs.get('{%s}val' % W)) if gs is not None else 1
            # vMerge에 val="restart"가 없으면 '이어지는 껍데기 셀'(화면에 안 보임)
            cont = vm is not None and vm.get('{%s}val' % W) != 'restart'
            row.append({'ci': ci, 'gc': gc, 'span': span, 'ghost': cont, 'el': tc})
            gc += span
        grid.append(row)
    return grid

def left_label(grid, ri, cell):
    """같은 행에서 왼쪽으로 가장 가까운 '글자 있는' 셀 = 라벨 후보"""
    best = None
    for c in grid[ri]:
        if c['gc'] < cell['gc'] and not c['ghost']:
            t = cell_text(c['el'])
            if t: best = t
    return best

def above_label(grid, ri, cell):
    """같은 시각 열의 위쪽에서 가장 가까운 글자 있는 셀 = 헤더 후보"""
    for r in range(ri - 1, -1, -1):
        for c in grid[r]:
            if c['gc'] <= cell['gc'] < c['gc'] + c['span'] and not c['ghost']:
                t = cell_text(c['el'])
                if t: return t
    return None

ANCHOR_RE = re.compile(r'(@|년|월|일|관계\s*:|인증번호\s*:|확인번호\s*:|\(은행명\))')

def detect(tbls):
    slots = []
    sid = 0
    def nid():
        nonlocal sid
        sid += 1
        return f'S{sid:03d}'

    for ti, tbl in enumerate(tbls):
        grid = build_grid(tbl)
        for ri, row in enumerate(grid):
            # (a) 연속 빈 셀 = 글자칸 격자(주민번호 등)
            run = []
            def flush_run():
                if len(run) >= 4:
                    slots.append({
                        'id': nid(), 'kind': 'char_grid',
                        'addr': [f't{ti}.r{ri}.c{c["ci"]}' for c in run],
                        'boxes': len(run),
                        'label_left': left_label(grid, ri, run[0]),
                        'label_above': above_label(grid, ri, run[0]),
                    })
                    return True
                return False

            for c in row:
                if c['ghost']:
                    continue
                txt = cell_text(c['el'])
                if txt == '' :
                    run.append(c); continue
                if txt == '-' and run:
                    # 주민번호 하이픈: 격자를 앞/뒤로 끊음
                    flush_run(); run = []
                    continue
                if run and not flush_run():
                    for x in run:
                        slots.append({
                            'id': nid(), 'kind': 'text',
                            'addr': f't{ti}.r{ri}.c{x["ci"]}',
                            'label_left': left_label(grid, ri, x),
                            'label_above': above_label(grid, ri, x),
                        })
                run = []

                # (b) 체크박스: 셀 안의 □ 각각을 슬롯으로
                if '□' in txt:
                    opts = [o.strip() for o in re.split(r'□', txt)[1:]]
                    slots.append({
                        'id': nid(), 'kind': 'checkbox_group',
                        'addr': f't{ti}.r{ri}.c{c["ci"]}',
                        'options': [o[:24] for o in opts],
                        'label_left': left_label(grid, ri, c),
                        'label_above': above_label(grid, ri, c),
                    })
                # (c) 밑줄 탭 빈칸
                for pi, p in enumerate(c['el'].findall('w:p', ns)):
                    ublanks = 0
                    for r_ in p.findall('.//w:r', ns):
                        rpr = r_.find('w:rPr', ns)
                        if rpr is not None and rpr.find('w:u', ns) is not None and r_.find('w:tab', ns) is not None:
                            ublanks += 1
                    if ublanks:
                        ptxt = ''.join(x.text or '' for x in p.iter('{%s}t' % W))
                        slots.append({
                            'id': nid(), 'kind': 'underline_blank',
                            'addr': f't{ti}.r{ri}.c{c["ci"]}.p{pi}',
                            'blanks': ublanks, 'line_text': ptxt.strip()[:40],
                            'label_above': above_label(grid, ri, c),
                        })
                # (d) 앵커 분할 필요 셀
                if ANCHOR_RE.search(txt) and '□' not in txt and len(txt) < 40:
                    slots.append({
                        'id': nid(), 'kind': 'anchor_split',
                        'addr': f't{ti}.r{ri}.c{c["ci"]}',
                        'template': txt[:40],
                        'label_left': left_label(grid, ri, c),
                    })
            if run and not flush_run():
                for x in run:
                    slots.append({
                        'id': nid(), 'kind': 'text',
                        'addr': f't{ti}.r{ri}.c{x["ci"]}',
                        'label_left': left_label(grid, ri, x),
                        'label_above': above_label(grid, ri, x),
                    })
    return slots

if __name__ == '__main__':
    tree, body = load()
    tbls = [e for e in body if etree.QName(e).localname == 'tbl']
    slots = detect(tbls)
    json.dump(slots, open('slots.json', 'w'), ensure_ascii=False, indent=1)
    from collections import Counter
    print('탐지 슬롯 총계:', len(slots))
    for k, v in Counter(s['kind'] for s in slots).items():
        print(f'  {k}: {v}')
