"""本轮只读成品检查；结果写入指定JSON，不据此宣称视觉或课堂验收。"""
from pathlib import Path
from zipfile import ZipFile
import hashlib, json, re, subprocess, sys, xml.etree.ElementTree as ET
from urllib.parse import unquote
from pypdf import PdfReader
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
L1 = ROOT / 'materials/第1讲整合试讲主版本'
L2 = ROOT / 'materials/第2讲实质备课稿'
BASE = 'deb919c51d98b5d882c65051063ea2c1d5baf675'
ns = {'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
norm = lambda s: re.sub(r'\s+', '', s)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
data = json.loads((L1/'课程内容.json').read_text(encoding='utf-8-sig'))
issues = []
result = {'base':BASE,'scope':'结构、同源文字、时间与本地链接；视觉另记，未做真人试讲'}
ppt = next(L1.glob('*.pptx'))
pdf = L1/'预览'/f'{ppt.stem}.pdf'
visible = steps = notes_checked = refs_checked = 0
page_checks = []
with ZipFile(ppt) as z:
    slides = [n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)]
    result['ppt_slides'] = len(slides)
    for i,p in enumerate(data['pages'],1):
        xml = ET.fromstring(z.read(f'ppt/slides/slide{i}.xml'))
        shown = norm(''.join(x.text or '' for x in xml.findall('.//a:t', ns)))
        note = ET.fromstring(z.read(f'ppt/notesSlides/notesSlide{i}.xml'))
        noted = norm(''.join(x.text or '' for x in note.findall('.//a:t', ns)))
        fields = [p.get(k,'') for k in ('title','section','bottom','source')]+[str(b.get(k,'')) for b in p.get('blocks',[]) for k in ('label','text')]+p.get('arrowLabels',[])
        for field in fields:
            if field:
                visible += 1
                if norm(field) not in shown: issues.append(f'PPT{i}画面字段缺失: {field[:60]}')
        for s in p.get('steps',[]):
            steps += 1
            if norm(s['text']) not in noted: issues.append(f'PPT{i}备注步骤缺失: {s["text"][:60]}')
        for n in p.get('teacherNotes',[]):
            notes_checked += 1
            if norm(n) not in noted: issues.append(f'PPT{i}教师备查缺失: {n[:60]}')
        for ref in p.get('refs',[]):
            for key in ('label','url','locator'):
                if ref.get(key):
                    refs_checked += 1
                    if norm(ref[key]) not in noted: issues.append(f'PPT{i}来源缺失: {ref[key][:60]}')
        page_checks.append({'page':i,'visible_fields':sum(bool(f) for f in fields),'speech_activity_steps':len(p.get('steps',[])),'note_items':len(p.get('teacherNotes',[])),'refs':len(p.get('refs',[]))})
result.update(visible_fields_checked=visible,note_steps_checked=steps,teacher_notes_checked=notes_checked,reference_fields_checked=refs_checked)
result['page_checks']=page_checks
result['ppt_pdf_pages'] = len(PdfReader(pdf).pages)
result['png_pages'] = len(list((L1/'预览/逐页PNG').glob('*.png')))
result['svg_pages'] = len(list((L1/'预览/同源SVG').glob('*.svg')))
result['png_actual_dimensions'] = sorted({Image.open(p).size for p in (L1/'预览/逐页PNG').glob('*.png')})
if any(result[k]!=36 for k in ['ppt_slides','ppt_pdf_pages','png_pages','svg_pages']): issues.append('36页数量不一致')
result['core_minutes'] = [sum(float(p['minutes']) for p in data['pages'][:16]),sum(float(p['minutes']) for p in data['pages'][16:31])]
result['with_extensions_minutes'] = sum(float(p['minutes']) for p in data['pages'])
result['core_han_chars'] = len(re.findall(r'[\u4e00-\u9fff]', ''.join(s['text'] for p in data['pages'][:31] for s in p['steps'] if s['kind']=='speech')))
if result['core_minutes'] != [45,45] or result['with_extensions_minutes']!=100: issues.append('时间总和不是45+45/100')
result['documents']={}
for stem in ['01_完整讲稿','02_学生材料','03_逐题讲评']:
    docx,dpdf = L1/f'{stem}.docx',L1/f'{stem}.pdf'
    with ZipFile(docx) as z:
        for n in z.namelist():
            if n.endswith('.xml'): ET.fromstring(z.read(n))
        dt = norm(''.join(ET.fromstring(z.read('word/document.xml')).itertext()))
    reader=PdfReader(dpdf)
    pt=norm(''.join(p.extract_text() or '' for p in reader.pages))
    result['documents'][stem]={'pages':len(reader.pages),'docx_sha256':sha(docx),'pdf_sha256':sha(dpdf)}
    if stem=='01_完整讲稿':
        for p in data['pages']:
            for s in p['steps']:
                if norm(s['text']) not in dt: issues.append(f'讲稿DOCX缺页{p["id"]}段落: {s["text"][:40]}')
                if norm(s['text']) not in pt: issues.append(f'讲稿PDF缺页{p["id"]}段落: {s["text"][:40]}')
mds = list(L1.rglob('*.md'))+list(L2.rglob('*.md'))+[ROOT/'CURRENT_STATE.md',ROOT/'START_HERE.md',ROOT/'handoff/20260930_第一讲收尾与第二讲备课执行记录.md']
count=0
for p in mds:
    for target in re.findall(r'\]\(([^)]+)\)',p.read_text(encoding='utf-8-sig')):
        target=unquote(target.split('#')[0].strip('<>'))
        if not target or re.match(r'^[a-z]+:',target): continue
        count+=1
        if not (p.parent/target).exists(): issues.append(f'失效链接 {p.relative_to(ROOT)} -> {target}')
result['local_links_checked']=count
result['sha256']={'source':sha(L1/'课程内容.json'),'pptx':sha(ppt),'ppt_pdf':sha(pdf)}
result['issues']=issues
dest=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'.work/验证结果.json'
dest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
sys.exit(1 if issues else 0)
