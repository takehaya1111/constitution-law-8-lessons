"""从仓库内教材PDF生成逐页定位的辅助文本，不改动原件。"""
from pathlib import Path
import hashlib
import fitz

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'textbook'
PDF = BASE / '宪法学_马工程_第二版_完整教材.pdf'
OUT = BASE / '分页检索文本'
OUT.mkdir(parents=True, exist_ok=True)
doc = fitz.open(PDF)
digest = hashlib.sha256(PDF.read_bytes()).hexdigest()
links = []
empty = []
for start in range(0, len(doc), 40):
    stop = min(start + 40, len(doc))
    name = f'pdf-{start+1:03}-{stop:03}.md'
    body = [f'# 教材检索文本：PDF第{start+1}—{stop}页', '',
            '本文件直接提取自同目录上一级的完整教材PDF文字层，未逐字校订。页号为PDF物理页序，不能直接当作教材印刷页码。重要文字须回看原PDF同页；识别错字、漏字和顺序异常仍可能存在。', '',
            f'原PDF SHA-256：`{digest}`', '']
    for i in range(start, stop):
        content = doc[i].get_text('text').strip()
        body += [f'## PDF第{i+1}页', '', content or '【本页没有可提取文字，请查看原PDF图像。】', '']
        if not content:
            empty.append(i+1)
    (OUT / name).write_text('\n'.join(body), encoding='utf-8')
    links.append(f'- [PDF第{start+1}—{stop}页]({name})')
(OUT / 'README.md').write_text('\n'.join([
    '# 教材分页检索文本', '',
    f'来自373页完整教材。按每40页分段，共{len(links)}份；包含每个PDF物理页的定位标题。', '',
    *links, '', '无可提取文字的PDF页：' + '、'.join(map(str, empty)) + '。请回看原图。', '',
    '已完成全部页的机械文字提取；这不表示已经阅读全文或完成逐字校对。', ''
]), encoding='utf-8')
proof = BASE / '版本核实页'
proof.mkdir(exist_ok=True)
for page, name in [(0, '封面.png'), (2, '版权页.png')]:
    doc[page].get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).save(proof / name)
toc = ['# 教材目录文字辅助', '', '以下为PDF第8—14页文字识别层的直接提取。目录页印刷顺序与识别顺序可能不同，请回PDF图像核对。', '']
for i in range(7,14):
    toc += [f'## PDF第{i+1}页', '', doc[i].get_text('text').strip(), '']
(BASE / '教材目录_文字辅助.md').write_text('\n'.join(toc), encoding='utf-8')
print(f'PDF页数={len(doc)}；辅助文本={len(links)}份；无文字页={empty}；SHA256={digest}')
