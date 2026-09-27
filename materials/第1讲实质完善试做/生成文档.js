'use strict';

// 只把三份Markdown源文档排成Word；不推断、补写或删减教学内容。
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, HeadingLevel, AlignmentType,
  LevelFormat, Footer, PageNumber, ExternalHyperlink, TableLayoutType,
} = require('C:/Users/tsunami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/docx');

const ROOT = __dirname;
const FONT = 'Microsoft YaHei';
const FONT_FAMILY = { ascii: FONT, hAnsi: FONT, eastAsia: FONT, cs: FONT };
const WIDTH = 9426;
const INK = '233541';
const INPUTS = ['01_教学设计与关键讲解', '02_学生材料', '03_参考答案', '04_课件文字与备注'];
let PROFILE = { name: '', size: 22, line: 310, after: 100, headingBefore: 150, headingAfter: 100, quoteAfter: 105, quoteLine: 320 };

function inline(source, options = {}) {
  const output = [];
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/gu;
  let offset = 0;
  let match;
  const run = (text, extra = {}) => new TextRun({ text, font: FONT_FAMILY, size: 22, color: INK, ...options, ...extra });
  while ((match = pattern.exec(source)) !== null) {
    if (match.index > offset) output.push(run(source.substring(offset, match.index)));
    if (match[2] !== undefined) output.push(run(match[2], { bold: true }));
    else if (match[3] !== undefined) output.push(run(match[3]));
    else if (/^(?:https?|mailto|ftp|ftps|tel):/iu.test(match[5])) output.push(new ExternalHyperlink({ link: match[5], children: [run(match[4], { color: '255D79', underline: {} })] }));
    else output.push(run(match[4]));
    offset = match.index + match[0].length;
  }
  if (offset < source.length || output.length === 0) output.push(run(source.substring(offset)));
  return output;
}

function plain(source) {
  return source.replace(/\[([^\]]+)\]\(([^)]+)\)/gu, '$1').replace(/\*\*([^*]+)\*\*/gu, '$1').replace(/`([^`]+)`/gu, '$1');
}

function paragraph(source, options = {}) {
  const { size = PROFILE.size, bold = false, ...properties } = options;
  return new Paragraph({
    children: inline(source, { size, bold }),
    spacing: { after: PROFILE.after, line: PROFILE.line },
    widowControl: true,
    ...properties,
  });
}

function tableCells(line) {
  let value = line.trim();
  if (value.startsWith('|')) value = value.substring(1);
  if (value.endsWith('|') && !value.endsWith('\\|')) value = value.substring(0, value.length - 1);
  return value.split(/(?<!\\)\|/u).map(cell => cell.trim().replace(/\\\|/gu, '|'));
}

function columnWidths(rows) {
  const count = rows[0].length;
  if (count < 2 || count > 5) throw new Error(`表格只支持2—5列，实际${count}列`);
  const headers = rows[0].map(plain);
  if (count === 5 && headers[0] === '时间' && headers[1] === '内容及产出') {
    const result = [13, 48, 10, 14, 15].map(percent => Math.floor(WIDTH * percent / 100));
    result[result.length - 1] += WIDTH - result.reduce((sum, width) => sum + width, 0);
    return result;
  }
  const weights = headers.map((header, column) => {
    const lengths = rows.map(row => Math.max(...plain(row[column]).split(/<br\s*\/?>/iu).map(line => Array.from(line).reduce((sum, char) => sum + (char.codePointAt(0) < 256 ? 0.55 : 1), 0))));
    const average = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
    let weight = Math.sqrt(Math.max(4, average));
    if (/^(时间|分钟|时长|用时|序号|题号|学时)$/u.test(header)) weight = Math.min(weight, 2.1);
    if (/^(环节|阶段|步骤)$/u.test(header)) weight = Math.min(weight, 3.5);
    return weight;
  });
  const minimums = headers.map(header => /^(时间|分钟|时长|用时|序号|题号|学时)$/u.test(header) ? 780 : count === 5 ? 1100 : 1250);
  const remainder = WIDTH - minimums.reduce((sum, width) => sum + width, 0);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const result = weights.map((weight, i) => minimums[i] + Math.floor(remainder * weight / totalWeight));
  result[result.length - 1] += WIDTH - result.reduce((sum, width) => sum + width, 0);
  return result;
}

function makeTable(rows) {
  if (rows.length < 1) throw new Error('空表格');
  const count = rows[0].length;
  if (!rows.every(row => row.length === count)) throw new Error('表格行列数不一致，请检查Markdown中的竖线');
  const widths = columnWidths(rows);
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD3D6' };
  return new Table({
    width: { size: WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: widths,
    rows: rows.map((cells, rowIndex) => new TableRow({
      cantSplit: true,
      tableHeader: rowIndex === 0,
      children: cells.map((cell, colIndex) => new TableCell({
        width: { size: widths[colIndex], type: WidthType.DXA },
        borders: { top: border, bottom: border, left: border, right: border },
        margins: { top: 100, bottom: 100, left: 110, right: 110 },
        shading: rowIndex === 0 ? { type: ShadingType.CLEAR, fill: 'E9EEEC' } : undefined,
        children: cell.split(/<br\s*\/?>/iu).map(part => paragraph(part, {
          size: 20, bold: rowIndex === 0,
          spacing: { after: 25, line: 275 },
          keepNext: rowIndex === 0 || rowIndex === rows.length - 1,
        })),
      })),
    })),
  });
}

function parseMarkdown(markdown) {
  const lines = markdown.replace(/^\uFEFF/u, '').split(/\r?\n/u);
  const children = [];
  const numbering = [{
    reference: 'bullet',
    levels: Array.from({ length: 6 }, (_, level) => ({
      level, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 400 + level * 300, hanging: 200 } } },
    })),
  }];
  let pendingBreak = false;
  let listNumber = 0;
  let slideSectionCount = 0;
  function appendParagraph(value, options = {}) {
    children.push(paragraph(value, { ...options, ...(pendingBreak ? { pageBreakBefore: true } : {}) }));
    pendingBreak = false;
  }
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const value = raw.trim();
    if (!value) continue;
    if (value === '<!-- PAGEBREAK -->') { pendingBreak = true; continue; }
    if (/^<!--.*-->$/u.test(value)) continue;
    if (/^\|/u.test(value)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/u.test(lines[i])) {
        const cells = tableCells(lines[i]);
        if (!cells.every(cell => /^:?-{2,}:?$/u.test(cell))) rows.push(cells);
        i += 1;
      }
      i -= 1;
      if (pendingBreak) {
        children.push(paragraph('', { pageBreakBefore: true, keepNext: true, spacing: { before: 0, after: 0, line: 20 }, size: 2 }));
        pendingBreak = false;
      }
      children.push(makeTable(rows));
      children.push(paragraph('', { spacing: { after: 45, line: 20 }, size: 2, keepNext: true }));
      continue;
    }
    const heading = value.match(/^(#{1,4})\s+(.+)$/u);
    if (heading) {
      const depth = heading[1].length;
      const levels = [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
      const slideNotesSection = PROFILE.name.startsWith('04_') && depth === 2 && /^第\d+页/u.test(heading[2]);
      if (slideNotesSection) slideSectionCount += 1;
      const forceBreak = (PROFILE.name.startsWith('01_') && depth === 2 && /^六、/u.test(heading[2])) || (PROFILE.name.startsWith('03_') && depth === 2 && /^任务[45]\s/u.test(heading[2])) || (slideNotesSection && slideSectionCount > 1);
      if (forceBreak) pendingBreak = true;
      const sizes = PROFILE.name.startsWith('04_') ? [30, 24, 22, 21] : PROFILE.name.startsWith('02_') ? [30, 26, 23, 22] : [34, 28, 24, 22];
      appendParagraph(heading[2], {
        heading: levels[depth - 1], size: sizes[depth - 1], bold: true, keepNext: true,
        spacing: { before: depth === 1 ? 0 : PROFILE.headingBefore, after: depth === 1 ? 140 : PROFILE.headingAfter, line: PROFILE.name.startsWith('04_') ? 290 : depth === 1 ? 360 : 305 },
      });
      continue;
    }
    if (value.startsWith('>')) {
      if (value === '>') continue;
      appendParagraph(value.replace(/^>\s?/u, ''), {
        indent: { left: 180, right: 150 },
        shading: { type: ShadingType.CLEAR, fill: 'F2F5F3' },
        spacing: { after: PROFILE.quoteAfter, line: PROFILE.quoteLine },
      });
      continue;
    }
    const numbered = raw.match(/^(\s*)(\d+)([.)、．])\s+(.+)$/u);
    if (numbered) {
      listNumber += 1;
      const reference = `exact-number-${listNumber}`;
      const indent = 420 + Math.min(Math.floor(numbered[1].length / 2), 5) * 300;
      numbering.push({ reference, levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: `%1${numbered[3]}`, start: Number(numbered[2]), alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: indent, hanging: 240 } } },
      }] });
      appendParagraph(numbered[4], { numbering: { reference, level: 0 } });
      continue;
    }
    const bullet = raw.match(/^(\s*)[-+*]\s+(.+)$/u);
    if (bullet) {
      appendParagraph(bullet[2], { numbering: { reference: 'bullet', level: Math.min(Math.floor(bullet[1].length / 2), 5) } });
      continue;
    }
    if (/^([-*_])(?:\s*\1){2,}$/u.test(value)) {
      // 三个字符的分隔线属于Markdown格式；更长的下划线保留为学生作答线。
      if (/^_{4,}$/u.test(value)) appendParagraph(value);
      else appendParagraph('', { border: { bottom: { style: BorderStyle.SINGLE, color: 'CBD3D6', size: 4, space: 1 } }, spacing: { before: 80, after: 100, line: 40 }, size: 2 });
      continue;
    }
    // 普通行逐行保留；来源、题目和作答横线不由排版器改写。
    for (const part of value.split(/<br\s*\/?>/iu)) appendParagraph(part);
  }
  return { children, numbering, title: plain((lines.find(line => /^#\s+/u.test(line)) || '').replace(/^#\s+/u, '')) };
}

async function build(name) {
  const input = path.join(ROOT, `${name}.md`);
  if (!fs.existsSync(input)) throw new Error(`缺少源文档：${input}`);
  PROFILE = { name, size: 22, line: 310, after: 100, headingBefore: 150, headingAfter: 100, quoteAfter: 105, quoteLine: 320 };
  if (name.startsWith('02_')) PROFILE = { name, size: 21, line: 290, after: 80, headingBefore: 90, headingAfter: 65, quoteAfter: 65, quoteLine: 290 };
  if (name.startsWith('04_')) PROFILE = { name, size: 20, line: 250, after: 30, headingBefore: 110, headingAfter: 60, quoteAfter: 40, quoteLine: 260 };
  const parsed = parseMarkdown(fs.readFileSync(input, 'utf8'));
  const document = new Document({
    creator: '宪法学课程教学组', title: parsed.title || name,
    numbering: { config: parsed.numbering },
    styles: {
      default: { document: { run: { font: FONT_FAMILY, size: PROFILE.size, color: INK }, paragraph: { spacing: { line: PROFILE.line }, widowControl: true } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: FONT_FAMILY, bold: true, size: 34 }, paragraph: { keepNext: true } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT_FAMILY, bold: true, size: 28 }, paragraph: { outlineLevel: 0, keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT_FAMILY, bold: true, size: 24 }, paragraph: { outlineLevel: 1, keepNext: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT_FAMILY, bold: true, size: 22 }, paragraph: { outlineLevel: 2, keepNext: true } },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 900, bottom: 900, left: 1240, right: 1240 } } },
      children: parsed.children,
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: '宪法学 · 第一讲试做　', font: FONT_FAMILY, size: 17, color: '5B6871' }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT_FAMILY, size: 17, color: '5B6871' }),
        new TextRun({ text: ' / ', font: FONT_FAMILY, size: 17, color: '5B6871' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT_FAMILY, size: 17, color: '5B6871' }),
      ] })] }) },
    }],
  });
  const output = path.join(ROOT, `${name}.docx`);
  fs.writeFileSync(output, await Packer.toBuffer(document));
  process.stdout.write(`${output}\n`);
}

async function main() { for (const name of INPUTS) await build(name); }
if (require.main === module) main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
module.exports = { build, parseMarkdown, columnWidths };
