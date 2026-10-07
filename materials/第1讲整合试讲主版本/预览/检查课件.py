"""核当前课程内容与实际PPT、PDF、PNG、SVG的同版性；不认证视觉或教学效果。"""
from pathlib import Path
import hashlib
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
import fitz

OUT = Path(__file__).resolve().parent
ROOT = OUT.parent
SOURCE = ROOT / '课程内容.json'
PPT = ROOT / '第1讲_宪法总论_整合试讲主版本.pptx'
PDF = OUT / '第1讲_宪法总论_整合试讲主版本.pdf'
NS = {'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
data = json.loads(SOURCE.read_text(encoding='utf-8'))
pages = data['pages']
geo = json.loads((OUT / '几何与同版记录.json').read_text(encoding='utf-8'))
norm = lambda text: re.sub(r'\s+', '', text or '')
sha = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
def text_of(xml):
    root = ET.fromstring(xml)
    return ''.join(t.text or '' for t in root.findall('.//a:t', NS))

issues, page_checks = [], []
visible_total = note_total = short_total = 0
doc = fitz.open(PDF)
if not pages or len(doc) != len(pages):
    issues.append({'kind':'page_count','source':len(pages),'pdf':len(doc)})
if geo['inputSHA256'] != sha(SOURCE):
    issues.append({'kind':'stale_geometry'})
for sub, suffix in [('逐页PNG','.png'), ('同源SVG','.svg')]:
    expected = {f'{i:02d}{suffix}' for i in range(1,len(pages)+1)}
    actual = {p.name for p in (OUT/sub).glob('*'+suffix)}
    if expected != actual:
        issues.append({'kind':'page_files','directory':sub,'missing':sorted(expected-actual),'extra':sorted(actual-expected)})
hidden_pages = []
note_xml_chunks = []
with zipfile.ZipFile(PPT) as z:
    slides = [n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)]
    notes = [n for n in z.namelist() if re.fullmatch(r'ppt/notesSlides/notesSlide\d+\.xml', n)]
    if len(slides) != len(pages) or len(notes) != len(pages):
        issues.append({'kind':'ppt_counts','slides':len(slides),'notes':len(notes)})
    for index,p in enumerate(pages,1):
        local=[]
        xml=z.read(f'ppt/slides/slide{index}.xml')
        sx=ET.fromstring(xml)
        hidden = sx.attrib.get('show') == '0'
        if hidden: hidden_pages.append(index)
        if hidden != bool(p.get('hidden')):
            local.append('隐藏状态与内容源不符')
        actual_text=norm(text_of(xml))
        pdf_text=norm(doc[index-1].get_text())
        note_xml = z.read(f'ppt/notesSlides/notesSlide{index}.xml')
        note_xml_chunks.append(note_xml)
        actual_notes=norm(text_of(note_xml))
        fields=[p['title'],p.get('section',''),p.get('bottom',''),p.get('source','')]
        fields += [v for b in p['blocks'] for v in [b.get('label',''),b.get('text','')]]
        fields += p.get('arrowLabels',[])
        fields = [v for v in fields if v]
        for value in fields:
            if norm(value) not in actual_text: local.append('PPT文字缺失:'+value)
            if norm(value) not in pdf_text: local.append('PDF文字缺失:'+value)
        position=0
        for step in p['steps']:
            needle=norm(step['text'])
            found=actual_notes.find(needle,position)
            if found<0: local.append('备注步骤缺失或乱序:'+step['text'])
            else: position=found+len(needle)
        for value in p.get('teacherNotes',[]):
            if norm(value) not in actual_notes: local.append('教师备查缺失:'+value)
        for ref in p.get('refs',[]):
            for key in ['label','url','locator']:
                if norm(ref.get(key,'')) not in actual_notes: local.append('备注来源缺失:'+str(ref))
        sv=p.get('shortVersion')
        if sv:
            short_total+=1
            for key in ['id','title','instruction','text']:
                if norm(sv[key]) not in actual_notes: local.append('完整短讲缺失:'+key)
        adjustment=p.get('unitAdjustment')
        if adjustment:
            for key in ['id','title','instruction','text']:
                if norm(adjustment[key]) not in actual_notes: local.append('完整单元缩讲缺失:'+key)
        if not p.get('optional'):
            if norm(geo['timeRanges'][p['id']]) not in actual_notes:
                local.append('分节时间定位缺失')
        if re.search(r'(100|50|一百|五十)分钟', actual_notes+actual_text):
            local.append('仍含旧课时选项')
        # 只检查实际文字是否越出画布；相邻关系和视觉层级仍靠逐页看图。
        for block in doc[index-1].get_text('dict')['blocks']:
            for line in block.get('lines',[]):
                for span in line.get('spans',[]):
                    x0,y0,x1,y1=span['bbox']
                    if x0<0 or y0<0 or x1>doc[index-1].rect.width+0.1 or y1>doc[index-1].rect.height+0.1:
                        local.append('PDF文字越界:'+span['text'])
        visible_total+=len(fields)
        note_total+=len(p['steps'])
        page_checks.append({'page':index,'hidden':hidden,'visible_fields':len(fields),'note_steps':len(p['steps']),'short_version':sv['id'] if sv else None,'issues':local})
        issues += [{'page':index,'issue':issue} for issue in local]
for half in [1, 2]:
    index = next(p['id'] for p in pages if not p.get('optional') and p.get('half') == half)
    if not geo['timeRanges'].get(index,'').startswith('本节约0—'):
        issues.append({'kind':'half_not_reset','page':index})
report={'checked_at':'2026-10-07','source_json_sha256':sha(SOURCE),'pptx_sha256':sha(PPT),'pdf_sha256':sha(PDF),'notes_xml_sha256':hashlib.sha256(b'\0'.join(note_xml_chunks)).hexdigest(),'notes_hash_method':'按当前实际幻灯片顺序连接对应备注XML原字节，以单个零字节分隔后取SHA-256。','pages':len(pages),'hidden_pages':hidden_pages,'visible_fields_checked':visible_total,'note_steps_checked':note_total,'complete_short_versions_checked':short_total,'issues':issues,'page_checks':page_checks,'scope':'实际文件文字、步骤顺序、完整短讲、隐藏标记、分节定位及页数；不是逐页视觉和真人教学验证。'}
(OUT/'内容与备注核对.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['page_checks']},ensure_ascii=False,indent=2))
sys.exit(1 if issues else 0)
