"""合并已验证的成品预览，并生成供教师一次上传的审阅包。"""
from pathlib import Path
import json
import hashlib
import zipfile
import fitz

BASE = Path(__file__).resolve().parent
REPO = BASE.parents[1]
OUT = REPO / 'deliverables'
OUT.mkdir(exist_ok=True)
result = fitz.open()
toc = []
sections = []

def append_pdf(label, path):
    source = fitz.open(path)
    start = len(result) + 1
    result.insert_pdf(source)
    toc.append([1, label, start])
    sections.append({'部分': label, '起页': start, '止页': len(result), '原文件': str(path.relative_to(REPO)).replace('\\', '/')})

for label, filename in [
    ('使用与审阅说明', '00_使用与审阅说明.pdf'),
    ('教学设计与关键教师讲解', '01_教学设计与关键讲解.pdf'),
    ('学生材料与任务', '02_学生材料.pdf'),
    ('逐题参考答案与讲评', '03_参考答案.pdf'),
    ('课件画面（22页）', '第1讲_宪法总论_试做.pdf'),
    ('完整课件文字与讲授备注', '04_课件文字与备注.pdf'),
]:
    append_pdf(label, BASE / '预览' / filename)

book = fitz.open(REPO / 'textbook/宪法学_马工程_第二版_完整教材.pdf')
book_pages = [(18,33),(19,34),(20,35),(21,36),(89,104),(92,107),(95,110),(96,111),(100,115),(103,118)]
toc.append([1, '证据附录：本轮实际核对的教材原页', len(result)+1])
for printed, physical in book_pages:
    page_number = len(result)+1
    result.insert_pdf(book, from_page=physical-1, to_page=physical-1)
    toc.append([2, f'教材印刷第{printed}页（原PDF第{physical}页）', page_number])
sections.append({'部分':'教材原页证据','起页':len(result)-9,'止页':len(result),'原文件':'textbook/宪法学_马工程_第二版_完整教材.pdf'})

page = result.new_page(width=960, height=540)
page.insert_image(page.rect, filename=str(BASE / '来源核对/旧课件/原10第17页.png'), keep_proportion=True)
toc.append([1, '证据附录：原《10 宪法总论》第17页', len(result)])
sections.append({'部分':'旧课件第17页','起页':len(result),'止页':len(result),'原文件':'materials/宪法内容剥离/课件原件/10 宪法总论.pptx'})
result.set_toc(toc)
result.set_metadata({'title':'第1讲宪法总论实质完善试做小审阅包','author':'宪法学课程教学组','subject':'含教学正文、学生材料、答案、课件画面与备注；供教师和Pro审阅，非真人效果验证'})
pdf = OUT / '第1讲_小审阅包.pdf'
result.save(pdf, garbage=4, deflate=True)
result.close()

guide = '''# 第1讲小审阅包

先打开“第1讲_小审阅包.pdf”。它合并了教学正文、学生材料、逐题答案、22页课件画面、全部课件文字与备注，以及本轮核对的教材页和旧课件第17页，并带目录书签。可把这一个PDF直接上传给Pro查看画面。

本压缩包另含可检索Markdown、可编辑Word和PPT、来源与桌面试走记录。课件文字提取不是Pro视觉审阅；本轮还没有真人试讲，90分钟是含阅读、作答、反馈及转场的核心编排，另有两学时各加5分钟的方案。

审阅请重点看：根本法三方面是否解释充分；本质与人权原则是否有制度联系；宪法41条3款与国家赔偿法是否完成实质对读；任务和答案是否对应、是否在材料足够时作有限判断；两学时容量是否合理。

原始版本、完整教材和全部来源在私有仓库 takehaya1111/constitution-law-8-lessons。教材页码指原书印刷页和原PDF物理页，不是合订PDF的连续页码。本轮只完善第1讲，第2—7讲仅登记接口影响。
'''
zip_path = OUT / '第1讲_小审阅包.zip'
members = [(pdf, pdf.name)]
for stem in ['00_使用与审阅说明','01_教学设计与关键讲解','02_学生材料','03_参考答案','04_课件文字与备注']:
    for ext in ['.md','.docx']:
        members.append((BASE/(stem+ext),stem+ext))
for name in ['05_来源与核对.md','06_试走与检查记录.md','第1讲_宪法总论_试做.pptx','时间与一致性校核.json']:
    members.append((BASE/name,name))
for p in (BASE/'来源核对/教材').glob('*'):
    if p.is_file():members.append((p,p.relative_to(BASE).as_posix()))
for p in [BASE/'来源核对/规范/核对.md',BASE/'来源核对/旧课件/原10第17页.png']:
    members.append((p,p.relative_to(BASE).as_posix()))
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    z.writestr('请先读.md',guide)
    for p,name in members:z.write(p,name)
with zipfile.ZipFile(zip_path) as z:
    assert z.testzip() is None
    for p,name in members:assert z.read(name)==p.read_bytes(),name
check = fitz.open(pdf)
assert len(check.get_toc())==len(toc)==18
index = {'性质':'第一讲试做审阅包；尚待教师和Pro审阅','部分':sections,'PDF页数':len(check),'PDF字节数':pdf.stat().st_size,'ZIP字节数':zip_path.stat().st_size,'PDF_SHA256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'ZIP_SHA256':hashlib.sha256(zip_path.read_bytes()).hexdigest(),'ZIP文件数':len(members)+1}
(OUT/'第1讲_审阅包目录与校验.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(index,ensure_ascii=False))
