from pathlib import Path
import fitz, json, zipfile, hashlib

BASE = Path(__file__).resolve().parent
REPO = BASE.parents[1]
OUT = REPO / 'deliverables'
OUT.mkdir(exist_ok=True)
doc = fitz.open()
toc, index = [], []
for label, name in [('导读','00_导读.pdf'),('完整逐字稿','02_逐字稿.pdf'),('课件画面','第1讲_叙事授课版.pdf'),('课堂材料与教师答案','03_课堂材料与答案.pdf')]:
    src = fitz.open(BASE/'预览'/name)
    start = len(doc)+1
    doc.insert_pdf(src)
    toc.append([1,label,start])
    index.append({'部分':label,'起页':start,'止页':len(doc),'来源文件':name})

src = fitz.open(BASE/'来源/国家赔偿沿革/H01_国务院公报1994第31号.pdf')
start = len(doc)+1
doc.insert_pdf(src, from_page=55, to_page=58)
toc.append([1,'同期史料：1994年实施通知（原PDF56—59页）',start])
index.append({'部分':'同期实施通知原页','起页':start,'止页':len(doc),'定位':'公报印刷1208—1211页；原PDF56—59页'})
doc.set_toc(toc)
doc.set_metadata({'title':'第一讲叙事授课试做审阅包','author':'宪法学课程教学组','subject':'完整逐字稿、课件与课堂材料；待教师试读及Pro审阅，不代表真人教学效果验证'})
pdf = OUT/'第1讲_叙事试做审阅包.pdf'
doc.save(pdf, garbage=4, deflate=True)
pages = len(doc)
doc.close()

zip_path = OUT/'第1讲_叙事试做审阅包.zip'
members = [(pdf,pdf.name)]
for p in BASE.rglob('*'):
    if not p.is_file() or '__pycache__' in p.parts: continue
    rel = p.relative_to(BASE)
    # 合订PDF已有所有主预览；分发PDF和概览图另外保留，避免重复数份同内容PDF。
    if rel.parts[0]=='预览' and p.name not in ['学生分发版.pdf','教师答案版.pdf','叙事课件六页概览.jpg']: continue
    members.append((p,rel.as_posix()))
guide = '''# 第一讲叙事试做审阅包

先打开合订PDF，可直接查看完整逐字稿、26页课件、学生材料与答案，以及国家赔偿法实施通知原页。PDF有目录书签。Word用于修改讲稿，PPT用于放映；Markdown和内容JSON用于检索和逐页核对。

这是一版教师新授权的叙事与视觉试做，原第一讲实质稿仍保留。主轨约8700个汉字，90分钟为编排预算，未进行真人试讲，也未完成Pro对新稿的审阅。课堂分发只用“预览/学生分发版.pdf”，不要把教师答案提前发出。

执行记录、来源核对、访问记录、生成脚本、检查与待审问题都在包内及GitHub仓库。Pro恢复后可独立评价叙事、学理、口语和视觉，也可建议回退或重排；当前候选不视为已经批准的定稿。
'''
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    z.writestr('请先读.md',guide)
    for p,name in members:z.write(p,name)
with zipfile.ZipFile(zip_path) as z:
    assert z.testzip() is None
    for p,name in members:assert z.read(name)==p.read_bytes(),name
check = fitz.open(pdf)
assert len(check.get_toc())==5
result={'性质':'叙事与视觉候选，供教师和Pro审阅','部分':index,'PDF页数':pages,'PDF字节数':pdf.stat().st_size,'ZIP字节数':zip_path.stat().st_size,'ZIP文件数':len(members)+1,'PDF_SHA256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'ZIP_SHA256':hashlib.sha256(zip_path.read_bytes()).hexdigest()}
(OUT/'第1讲_叙事审阅包校验.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(result,ensure_ascii=False))
