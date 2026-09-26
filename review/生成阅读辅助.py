"""只读原始 Office 内容，生成供仓库审阅的文字与预览索引。"""
from pathlib import Path
import hashlib, json, posixpath, re, shutil, sys, zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'review'
MAT = ROOT / 'materials'
NS = {'p':'http://schemas.openxmlformats.org/presentationml/2006/main',
      'a':'http://schemas.openxmlformats.org/drawingml/2006/main',
      'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def relative(path): return path.relative_to(ROOT).as_posix()
def href(path): return str(path).replace(' ','%20').replace('(','%28').replace(')','%29')
def link(path): return href('../../' + relative(path))
def relationships(z, part):
    rp = posixpath.join(posixpath.dirname(part), '_rels', posixpath.basename(part)+'.rels')
    if rp not in z.namelist(): return {}
    return {x.attrib['Id']:(posixpath.normpath(posixpath.join(posixpath.dirname(part),x.attrib['Target'])),x.attrib['Type'])
            for x in ET.fromstring(z.read(rp)) if x.attrib.get('TargetMode') != 'External'}

def para_text(p):
    bits=[]
    for n in p.iter():
        if n.tag == '{'+NS['a']+'}t': bits.append(n.text or '')
        elif n.tag == '{'+NS['a']+'}br': bits.append('\n')
        elif n.tag == '{'+NS['a']+'}tab': bits.append('\t')
    return ''.join(bits).strip()

def shape_texts(root, notes=False):
    chunks=[]
    tree=root.find('p:cSld/p:spTree',NS)
    if tree is None: return chunks
    for item in tree:
        if notes:
            ph=item.find('.//p:ph',NS)
            if ph is not None and ph.attrib.get('type') in ('sldNum','hdr','ftr','dt','sldImg'): continue
        ps=[para_text(p) for p in item.findall('.//a:p',NS)]
        ps=[p for p in ps if p]
        if ps: chunks.append('\n\n'.join(ps))
    return chunks

def ppt_extract(path, group):
    with zipfile.ZipFile(path) as z:
        rel=relationships(z,'ppt/presentation.xml')
        pres=ET.fromstring(z.read('ppt/presentation.xml'))
        slide_parts=[rel[s.attrib['{'+NS['r']+'}id']][0] for s in pres.findall('p:sldIdLst/p:sldId',NS)]
        lines=[f'# {path.stem}｜逐页文字提取','',f'原件：[{path.name}]({link(path)})','',f'幻灯片数：{len(slide_parts)}。原件 SHA-256：`{sha(path)}`。','',
               '这是 Office 文件内部文字的机械提取，供检索和逐页对照。保留幻灯片顺序、形状中的段落及非空讲授备注；形状顺序不必然等同于视觉阅读顺序。图片、截图、图表图像、公式图像、视频和动画未转写；不表示其中图像已被阅读。需要理解版面或图示时请回到原件或课件预览。','']
        note_pages=0
        for i,part in enumerate(slide_parts,1):
            root=ET.fromstring(z.read(part))
            chunks=shape_texts(root)
            lines += [f'## 原PPT第 {i} 页','', '### 页面文字','']
            lines += ['\n\n---\n\n'.join(chunks) if chunks else '（未提取到页面文字；本页可能含图片或其他非文字内容。）','']
            notes=[]
            for target,typ in relationships(z,part).values():
                if typ.endswith('/notesSlide'): notes += shape_texts(ET.fromstring(z.read(target)), True)
            if notes:
                note_pages+=1
                lines+=['### 讲授备注','', '\n\n'.join(notes),'']
        target=OUT/group/(path.stem+'.md')
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text('\n'.join(lines),encoding='utf-8')
        return {'source':relative(path),'source_sha256':sha(path),'text':relative(target),'slides':len(slide_parts),'note_pages':note_pages}

def word_p(p):
    bits=[]
    for x in p.iter():
        if x.tag == '{'+NS['w']+'}t': bits.append(x.text or '')
        elif x.tag in ('{'+NS['w']+'}br','{'+NS['w']+'}cr'): bits.append('\n')
        elif x.tag == '{'+NS['w']+'}tab': bits.append('\t')
    return ''.join(bits).strip()

def word_blocks(container, state):
    out=[]
    for child in container:
        if child.tag == '{'+NS['w']+'}p':
            txt=word_p(child)
            if txt:
                state['paragraphs']+=1
                out.append(txt)
        elif child.tag == '{'+NS['w']+'}tbl':
            state['tables']+=1
            rows=[]
            for row in child.findall('w:tr',NS):
                cells=[]
                for cell in row.findall('w:tc',NS):
                    cells.append('<br>'.join(word_blocks(cell,state)).replace('|','\\|').replace('\n','<br>'))
                rows.append(cells)
            if rows:
                width=max(map(len,rows)); rows=[r+['']*(width-len(r)) for r in rows]
                text=['| '+' | '.join(rows[0])+' |','| '+' | '.join(['---']*width)+' |']
                text += ['| '+' | '.join(r)+' |' for r in rows[1:]]
                out.append('\n'.join(text))
        elif child.tag == '{'+NS['w']+'}sdt':
            content=child.find('w:sdtContent',NS)
            if content is not None: out += word_blocks(content,state)
    return out

def docx_extract(path):
    state={'paragraphs':0,'tables':0}
    with zipfile.ZipFile(path) as z:
        root=ET.fromstring(z.read('word/document.xml'))
        content=word_blocks(root.find('w:body',NS),state)
    target=OUT/'原始文档文字'/(path.stem+'.md')
    target.parent.mkdir(parents=True,exist_ok=True)
    lines=[f'# {path.stem}｜正文提取','',f'原件：[{path.name}]({link(path)})','',f'原件 SHA-256：`{sha(path)}`。','',
           '本文件仅为全文检索辅助，不能替代原件版面。按照正文的段落与表格顺序提取；表格首行只是用于 Markdown 显示，不意味着原件将其设为标题。图片、浮动对象、页眉页脚、自动编号与分页不保证被保留，合并单元格会展开成顺序单元格。','']+content
    target.write_text('\n\n'.join(lines),encoding='utf-8')
    return {'source':relative(path),'source_sha256':sha(path),'text':relative(target),**state}

def extract():
    new=sorted((MAT/'前七讲转化稿'/'新版课件初稿').glob('*.pptx'))
    new+=sorted((MAT/'第八讲研究与教学材料'/'第八讲课件').glob('*.pptx'))
    old=sorted((MAT/'宪法内容剥离'/'课件原件').glob('*.pptx'))
    docs=sorted((MAT/'原始材料').glob('*.docx'))
    data={'新版课件':[ppt_extract(p,'新版课件文字') for p in new],
          '原始课件':[ppt_extract(p,'原始课件文字') for p in old],
          '原始文档':[docx_extract(p) for p in docs]}
    (OUT/'提取核对.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:{'files':len(v),'slides':sum(x.get('slides',0) for x in v),'notes':sum(x.get('note_pages',0) for x in v)} for k,v in data.items()},ensure_ascii=False))

def previews():
    import fitz
    from PIL import Image, ImageDraw, ImageFont
    data=json.loads((OUT/'提取核对.json').read_text(encoding='utf-8'))
    out=OUT/'课件预览'; out.mkdir(exist_ok=True)
    temp=Path(r'C:\Users\tsunami\AppData\Local\Temp\pdfread\constitution-repo-previews')
    font=ImageFont.truetype(r'C:\Windows\Fonts\msyh.ttc',22)
    for d in data['新版课件']:
        source=ROOT/d['source']; name=source.stem
        if name.startswith('第8讲'):
            pdf=source.with_name(name+'_预览.pdf')
        else: pdf=temp/(name+'.pdf')
        dest=out/(name+'_预览.pdf'); shutil.copy2(pdf,dest)
        doc=fitz.open(dest)
        assert len(doc)==d['slides'], f'Page mismatch: {name}'
        contacts=[]
        for start in range(0,len(doc),8):
            stop=min(start+8,len(doc)); n=stop-start
            tilew=960; gap=20; label=42
            h=round(tilew*doc[0].rect.height/doc[0].rect.width)
            rows=(n+1)//2
            canvas=Image.new('RGB',(tilew*2+gap*3,rows*(h+label)+gap*(rows+1)),'#e7e9ee')
            draw=ImageDraw.Draw(canvas)
            for j,i in enumerate(range(start,stop)):
                pix=doc[i].get_pixmap(matrix=fitz.Matrix(tilew/doc[i].rect.width,tilew/doc[i].rect.width),alpha=False)
                im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
                x=gap+(j%2)*(tilew+gap); y=gap+(j//2)*(h+label+gap)
                draw.text((x,y+6),f'{name} · 第 {i+1} 页',font=font,fill='#172334')
                canvas.paste(im,(x,y+label))
            destimg=out/f'{name}_第{start+1:02d}-{stop:02d}页.jpg'
            canvas.save(destimg,quality=90,optimize=True)
            contacts.append(relative(destimg))
        d['preview_pdf']=relative(dest);d['preview_pages']=len(doc);d['preview_sha256']=sha(dest);d['contacts']=contacts
        print(f'{name}: {len(doc)}页; {len(contacts)}张联系图')
    (OUT/'提取核对.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    lines=['# 材料阅读辅助','',
           '本目录用于让审阅者直接检索课件及原始教学文件，并查看八讲课件的静态版面。所有提取对应材料快照，来源及校验值见[提取核对记录](提取核对.json)。','',
           '## 阅读界限','',
           '- 逐页文字保留原 PPT 页码、文字段落与非空讲授备注，不代表图片、视频、图示和动画已经被阅读。请结合原件与预览。',
           '- 原始 Word 的正文提取仅供检索，不能替代原件版面；图片、自动编号、合并单元格、页眉页脚可能无法完整呈现。',
           '- 前七讲 PDF 由当前仓库课件静态转换，第八讲复用对应已核预览；每张联系图不超过八页，明确标注 PPT 页码。静态预览无法展示动画、视频及交互行为。',
           '- 已机械核对新版课件页数与预览页数一致；联系图是提供给审阅者的查看材料，不构成已完成全部页面视觉审阅的声明。','',
           '## 新版课件：8份，116页','', '| 课件 | 逐页文字 | 预览 | 联系图 |','| --- | --- | --- | --- |']
    for d in data['新版课件']:
        rp=lambda p:Path(p).relative_to('review').as_posix()
        pics=' · '.join(f'[第{i*8+1}–{min((i+1)*8,d["slides"])}页]({rp(p)})' for i,p in enumerate(d['contacts']))
        lines.append(f'| {Path(d["source"]).stem}（{d["slides"]}页） | [文字]({rp(d["text"])}) | [PDF]({rp(d["preview_pdf"])}) | {pics} |')
    lines += ['',f'## 原始宪法课件：{len(data["原始课件"])}份，{sum(d["slides"] for d in data["原始课件"])}页','']
    for d in data['原始课件']:
        lines.append(f'- [{Path(d["source"]).stem}（{d["slides"]}页）]({href(Path(d["text"]).relative_to("review").as_posix())})')
    lines += ['','## 原始教学文档：2份','']
    for d in data['原始文档']:
        lines.append(f'- [{Path(d["source"]).stem}]({Path(d["text"]).relative_to("review").as_posix()})')
    lines += ['','## 复现','',
              '`生成阅读辅助.py` 使用 Python 标准库提取 Office 的 XML 内容；预览联系图使用 PyMuPDF 和 Pillow。先运行 `extract`，用 LibreOffice 将前七讲转换至脚本声明的临时目录，再运行 `previews`。脚本只写入本目录，不修改原材料。','']
    (OUT/'README.md').write_text('\n'.join(lines),encoding='utf-8')

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='previews': previews()
    else: extract()
