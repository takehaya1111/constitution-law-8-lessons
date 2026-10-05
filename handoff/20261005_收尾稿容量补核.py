"""对本轮实际收尾稿作诊断，不宣称通过新增统一方案的全部要求。"""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SPEEDS = [140, 150, 180, 200, 220]

def han(text):
    return len(re.findall(r'[\u4e00-\u9fff]', text))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

sources = [ROOT/'materials/第1讲整合试讲主版本/课程内容.json',
           ROOT/'materials/第1讲整合试讲主版本/用时核算.json',
           ROOT/'materials/第2讲实质备课/01_完整讲述.md',
           ROOT/'materials/第2讲实质备课/用时核算.json']
lesson1 = json.loads(sources[0].read_text(encoding='utf-8'))
data1 = json.loads(sources[1].read_text(encoding='utf-8'))
text2 = sources[2].read_text(encoding='utf-8')
data2 = json.loads(sources[3].read_text(encoding='utf-8'))
rows = []
for i, (lo, hi) in enumerate([(0, 16), (16, 31)], 1):
    pages = lesson1['pages'][lo:hi]
    speeches = [''.join(s['text'] for s in p['steps'] if s['kind']=='speech') for p in pages]
    counts = [han(s) for s in speeches]
    assert counts == [p['han'] for p in data1[lo:hi]]
    activity = sum(s['minutes'] for p in pages for s in p['steps'] if s['kind']=='activity')
    assert abs(activity-sum(p['activity'] for p in data1[lo:hi])) < 0.000001
    rows.append({'lesson':1, 'half':i, 'han':sum(counts), 'activity_minutes':activity,
                 'transition_minutes':len(pages)*5/60, 'source_parts':[p['id'] for p in pages]})

parts = []
for heading, body in re.findall(r'^## ([^\n]+)\n(.*?)(?=^## |\Z)', text2, re.S|re.M):
    speeches = re.findall(r'^### 讲述\s*\n(.*?)(?=^### |\Z)', body, re.S|re.M)
    if speeches:
        parts.append((heading, han(''.join(speeches))))
assert len(parts)==15, len(parts)
assert [n for _,n in parts]==[p['han'] for p in data2['parts']], parts
for i, (lo,hi) in enumerate([(0,7),(7,13)],1):
    selected = data2['parts'][lo:hi]
    assert all(p['core'] for p in selected)
    rows.append({'lesson':2, 'half':i, 'han':sum(p['han'] for p in selected),
                 'activity_minutes':sum(p['student_activity_minutes'] for p in selected),
                 'transition_minutes':len(selected)*10/60,
                 'source_parts':[p['part'] for p in selected]})

for row in rows:
    row['scenarios'] = [{'han_per_minute_assumption':s,
        'estimated_minutes':round(row['han']/s+row['activity_minutes']+row['transition_minutes'],2),
        'difference_from_45_minutes':round(row['han']/s+row['activity_minutes']+row['transition_minutes']-45,2)} for s in SPEEDS]

report = {'date':'2026-10-05',
    'scope':'最终稿现有主线及既定活动的补充诊断；非新增统一方案的全部执行或验收',
    'inputs':{str(p.relative_to(ROOT)).replace('\\','/'):digest(p) for p in sources},
    'rows':rows,
    'limits':['仅统计纯汉字，数字与条文号的口头读法尚未校正，速度单位也为汉字/分钟。',
              '活动沿用实际备课安排，独立于口述；未将教师讲评、备用分支或机动空白另加。',
              '切换沿用每页5秒/每部分10秒的分析假设；若与口述重叠，实际总时长还会减少。',
              '未模拟长短回应等新活动情景，未为新增要求补写深化/压缩分支，不能据此宣布通过新方案。',
              '无真人试读、学生结果或教师实测语速。']}
out = Path(__file__).with_suffix('.json')
out.write_bytes((json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
print(json.dumps({'rows':rows,'output':str(out)},ensure_ascii=True,indent=2))
