"""核对正文传递与文件版本；不替代逐页图像审阅。"""
from pathlib import Path
import hashlib
import json
import re
from zipfile import ZipFile
import xml.etree.ElementTree as ET
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
ITEMS = [('01_完整讲述', '完整讲述'), ('02_学生史料与问题', '学生史料与问题'), ('03_逐题讲评', '逐题讲评')]
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def visible_markdown(s):
    lines = []
    for raw in s.splitlines():
        line = raw.strip()
        if not line or line == '>' or line == '<!-- PAGEBREAK -->' or re.fullmatch(r'_{10,}', line) or re.fullmatch(r'\|[-: |]+\|', line):
            continue
        line = re.sub(r'^#{1,3} ', '', line)
        line = re.sub(r'^(> |- )', '', line)
        line = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', line)
        line = line.replace('**', '')
        if line.startswith('|'):
            line = ''.join(x.strip() for x in line.split('|')[1:-1])
        lines.append(line)
    return ''.join(lines)

def normalize(s):
    return re.sub(r'\s+', '', s)

result = []
for stem, kind in ITEMS:
    md = ROOT / (stem + '.md')
    docx = ROOT / (stem + '.docx')
    pdf = ROOT / (stem + '.pdf')
    expected = normalize(visible_markdown(md.read_text(encoding='utf-8')))
    with ZipFile(docx) as z:
        root = ET.fromstring(z.read('word/document.xml'))
        actual = normalize(''.join(t.text or '' for t in root.findall('.//w:t', NS)))
        page = root.find('.//w:pgSz', NS)
        size = {k.split('}')[-1]: v for k,v in page.attrib.items()}
        links = len(ET.fromstring(z.read('word/_rels/document.xml.rels')).findall("{*}Relationship[@TargetMode='External']"))
    reader = PdfReader(pdf)
    text = ''.join(re.sub(r'宪法的发展\s*' + re.escape(kind) + r'\s*\d+\s*', '', p.extract_text() or '') for p in reader.pages)
    pdf_actual = normalize(text)
    # PDF 提取器可能重排表格阅读顺序；逐段检查补充整串检查，不把它冒作语义证明。
    body_paragraphs = [normalize(''.join(t.text or '' for t in p.findall('.//w:t', NS))) for p in root.findall('.//w:p', NS)]
    missing = [p for p in body_paragraphs if p and p not in pdf_actual]
    rec = {'stem': stem, 'markdown_sha256': sha(md), 'docx_sha256': sha(docx), 'pdf_sha256': sha(pdf),
           'pdf_pages': len(reader.pages), 'page_twips': size, 'external_links': links,
           'markdown_to_docx_exact_after_formatting_removed': expected == actual,
           'docx_to_pdf_exact_after_whitespace_and_footer_removed': actual == pdf_actual,
           'missing_docx_paragraphs_in_pdf': missing,
           'docx_body_characters_without_whitespace': len(actual), 'pdf_body_characters_without_whitespace': len(pdf_actual)}
    if actual != expected:
        mismatch = next((i for i,(a,b) in enumerate(zip(actual, expected)) if a!=b), min(len(actual),len(expected)))
        rec['first_markdown_docx_difference'] = {'index': mismatch, 'markdown': expected[max(0,mismatch-35):mismatch+100], 'docx': actual[max(0,mismatch-35):mismatch+100]}
    result.append(rec)
(ROOT / '本轮文档核对.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(result, ensure_ascii=True, indent=2))
if any(not x['markdown_to_docx_exact_after_formatting_removed'] or x['missing_docx_paragraphs_in_pdf'] for x in result):
    raise SystemExit(1)
