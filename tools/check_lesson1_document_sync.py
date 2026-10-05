"""核对第一讲三份 Markdown 经 DOCX 到 PDF 的正文传递，不替代视觉审阅。"""
from pathlib import Path
import hashlib
import json
import re
import zipfile
import xml.etree.ElementTree as ET

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1] / "materials" / "第1讲整合试讲主版本"
STEMS = ["01_完整讲稿", "02_学生材料", "03_逐题讲评"]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def norm(text):
    return re.sub(r"\s+", "", text)


def body_lines(markdown):
    for line in markdown.splitlines():
        line = line.strip()
        if not line or line == ">" or line.startswith("<!--") or re.fullmatch(r"_{10,}", line):
            continue
        line = re.sub(r"^#{1,3}\s+", "", line)
        line = re.sub(r"^>\s+", "", line)
        line = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line)
        line = line.replace("**", "")
        yield line


source = json.loads((ROOT / "课程内容.json").read_text(encoding="utf-8"))
result = {
    "source_json_sha256": sha256(ROOT / "课程内容.json"),
    "documents": {},
    "last_document_wording_sync": "2026-09-30",
    "renderer": {
        "office": "WPS Office 12.1.0.28505 through Word-compatible COM",
        "application_path": "D:/WPS Office/12.1.0.28505/office6",
        "pdf_rasterizer": "Codex bundled Poppler pdftoppm, 110 dpi",
    },
}
for stem in STEMS:
    md = ROOT / f"{stem}.md"
    docx = ROOT / f"{stem}.docx"
    pdf = ROOT / f"{stem}.pdf"
    with zipfile.ZipFile(docx) as package:
        corrupt_entry = package.testzip()
        if corrupt_entry:
            raise ValueError(f"DOCX ZIP损坏：{stem}/{corrupt_entry}")
        xml = ET.fromstring(package.read("word/document.xml"))
        docx_text = norm("".join(xml.itertext()))
    reader = PdfReader(pdf)
    pdf_text = norm("\n".join(page.extract_text() for page in reader.pages))
    missing_docx = []
    missing_pdf = []
    for line in body_lines(md.read_text(encoding="utf-8")):
        # 完整讲稿的教师备注列表按既有生成器去掉 Markdown 连字符。
        needle = norm(line)
        candidates = [needle, norm(re.sub(r"^-\s+", "", line))]
        if not any(value in docx_text for value in candidates):
            missing_docx.append(line)
        if not any(value in pdf_text for value in candidates):
            missing_pdf.append(line)
    missing_speech = []
    if stem == "01_完整讲稿":
        for page in source["pages"]:
            for step in page["steps"]:
                if step["kind"] == "speech" and norm(step["text"]) not in pdf_text:
                    missing_speech.append(page["id"])
    result["documents"][stem] = {
        "pages": len(reader.pages),
        "docx_bytes": docx.stat().st_size,
        "pdf_bytes": pdf.stat().st_size,
        "missing_body_lines": missing_docx,
        "missing_pdf_body_lines": missing_pdf,
        "missing_speech_pages": sorted(set(missing_speech)),
        "markdown_sha256": sha256(md),
        "docx_sha256": sha256(docx),
        "pdf_sha256": sha256(pdf),
    }
(ROOT / "文档内容校核.json").write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n"
)
for name, item in result["documents"].items():
    print(name, "pages=", item["pages"], "missing_docx=", len(item["missing_body_lines"]),
          "missing_pdf=", len(item["missing_pdf_body_lines"]), "missing_speech=", len(item["missing_speech_pages"]))
if any(item[key] for item in result["documents"].values()
       for key in ["missing_body_lines", "missing_pdf_body_lines", "missing_speech_pages"]):
    raise SystemExit(1)
