const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, LevelFormat,
  ShadingType, Footer, PageNumber,
} = require('C:/Users/tsunami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/docx');

const project = path.resolve(__dirname, '..', '..');
const source = path.join(project, '宪法学课程教学大纲_内容稿.md');
const output = path.join(project, '宪法学课程教学大纲_内容稿.docx');
const ink = '253542';
const line = 'C9D1D2';

function plain(value) {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
}

function para(value, options = {}) {
  return new Paragraph({
    ...options,
    children: [new TextRun({ text: plain(value), font: 'Microsoft YaHei', size: options.size || 21, color: ink })],
    spacing: { after: options.after ?? 110, line: 310 },
  });
}

function tableFromMarkdown(rows) {
  const widths = [950, 1550, 6100, 850];
  const border = { style: BorderStyle.SINGLE, color: line, size: 5 };
  return new Table({
    width: { size: 9450, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((cells, rowIndex) => new TableRow({
      cantSplit: true,
      tableHeader: rowIndex === 0,
      children: cells.map((cell, i) => new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: rowIndex === 0 ? { fill: 'E7EBE9', type: ShadingType.CLEAR } : undefined,
        borders: { top: border, bottom: border, left: border, right: border },
        margins: { top: 70, bottom: 70, left: 100, right: 100 },
        children: [new Paragraph({
          alignment: i === 3 ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text: plain(cell), font: 'Microsoft YaHei', size: rowIndex === 0 ? 19 : 18, bold: rowIndex === 0, color: ink })],
          spacing: { after: 0, line: 245 },
        })],
      })),
    })),
  });
}

async function main() {
  const lines = fs.readFileSync(source, 'utf8').split(/\r?\n/);
  const children = [];
  for (let i = 0; i < lines.length; i++) {
    const value = lines[i].trim();
    if (!value) continue;
    if (value.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const parts = lines[i].trim().split('|').slice(1, -1).map((part) => part.trim());
        if (!parts.every((part) => /^:?-{2,}:?$/.test(part))) rows.push(parts);
        i++;
      }
      i--;
      if (rows.length) children.push(tableFromMarkdown(rows));
      children.push(para('', { after: 70 }));
      continue;
    }
    if (value.startsWith('# ')) {
      children.push(para(value.slice(2), { heading: HeadingLevel.TITLE, size: 32, after: 320 }));
    } else if (value.startsWith('## ')) {
      children.push(para(value.slice(3), { heading: HeadingLevel.HEADING_1, size: 27, after: 220 }));
    } else if (/^\d+\. /.test(value)) {
      children.push(new Paragraph({
        numbering: { reference: 'course-points', level: 0 },
        children: [new TextRun({ text: plain(value.replace(/^\d+\. /, '')), font: 'Microsoft YaHei', size: 21, color: ink })],
        spacing: { after: 100, line: 310 },
      }));
    } else if (value.startsWith('- ')) {
      children.push(new Paragraph({
        numbering: { reference: 'course-bullets', level: 0 },
        children: [new TextRun({ text: plain(value.slice(2)), font: 'Microsoft YaHei', size: 20, color: ink })],
        spacing: { after: 95, line: 305 },
      }));
    } else {
      children.push(para(value));
    }
  }
  children.push(para('网页来源的可点击链接见同名 Markdown 内容稿。', { size: 18, after: 0 }));
  const doc = new Document({
    creator: '宪法学课程教学组',
    title: '宪法学课程教学大纲（内容稿）',
    numbering: { config: [
      { reference: 'course-points', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 310 } } } }] },
      { reference: 'course-bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 310 } } } }] },
    ] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 900, bottom: 900, left: 1220, right: 1220 } } },
      children,
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '《宪法学》课程教学大纲·内容稿  —  ', font: 'Microsoft YaHei', size: 16, color: '66727B' }), new TextRun({ children: [PageNumber.CURRENT], font: 'Microsoft YaHei', size: 16, color: '66727B' })],
      })] }) },
    }],
  });
  fs.writeFileSync(output, await Packer.toBuffer(doc));
  process.stdout.write(`${output}\n`);
}

main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
