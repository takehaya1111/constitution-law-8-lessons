'use strict';

// 唯一文字输入为同目录01_完整讲稿.md；不读取旧JSON或调用旧生成器。
// --inspect仅解析并检查文字，不创建DOCX、不写文件。
// 首次真实生成前，由调用者按文档技能记录操作开始标记。
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const DOCX_PACKAGE = 'C:/Users/tsunami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/docx';
const SOURCE = path.join(__dirname, '01_完整讲稿.md');
const OUTPUT = path.join(__dirname, '01_完整讲稿.docx');
const DEFAULT_RECORDS = path.join(os.tmpdir(), 'pdfread', 'constitution-lesson1-proof-20261008', 'export-paragraphs.json');
const PAGE = { width: 11906, height: 16838 };
const MARGINS = { top: 1020, bottom: 1000, left: 1134, right: 1134, header: 400, footer: 400 };
const CONTENT_WIDTH = PAGE.width - MARGINS.left - MARGINS.right;
const FONT = { ascii: 'Calibri', hAnsi: 'Calibri', eastAsia: '宋体', cs: 'Calibri' };
const HEADING_FONT = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: '黑体', cs: 'Arial' };

function hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function samePath(a, b) {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

// 只转换排版标记；引文、字词、数字、标点原样保留。
function inlineAtoms(source, inherited = {}) {
  const atoms = [];
  const pattern = /(\*\*([^*]+)\*\*|\u0060([^\u0060]+)\u0060|\[\^([^\]]+)\]|\[([^\]]+)\]\(([^)\n]+)\))/gu;
  let offset = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > offset) atoms.push({ text: source.slice(offset, match.index), ...inherited });
    if (match[2] !== undefined) atoms.push(...inlineAtoms(match[2], { ...inherited, bold: true }));
    else if (match[3] !== undefined) atoms.push({ text: match[3], ...inherited, code: true });
    else if (match[4] !== undefined) atoms.push({ text: '[' + match[4] + ']', ...inherited, footnote: match[4] });
    else {
      const href = match[6].replace(/^<|>$/gu, '');
      atoms.push(...inlineAtoms(match[5], { ...inherited, href }));
    }
    offset = match.index + match[0].length;
  }
  if (offset < source.length) atoms.push({ text: source.slice(offset), ...inherited });
  if (atoms.length === 0) atoms.push({ text: '', ...inherited });
  return atoms;
}

function atomText(atoms, omitReferences = false) {
  return atoms.filter(atom => !omitReferences || !atom.footnote).map(atom => atom.text).join('');
}

function tableCells(line) {
  let value = line.trim();
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|') && !value.endsWith('\\|')) value = value.slice(0, -1);
  return value.split(/(?<!\\)\|/u).map(cell => cell.trim().replace(/\\\|/gu, '|'));
}

function parseMarkdown(markdown) {
  const lines = markdown.replace(/^\uFEFF/u, '').split(/\r?\n/u);
  const blocks = [];
  const omittedFormatLines = [];
  const definitions = new Set();
  let session = null;
  let appendix = false;
  let pending = [];
  let pendingRole = null;
  let pendingStart = 0;
  const counts = { upper: 0, lower: 0 };

  function addParagraph(role, value, start, end, extra = {}) {
    const atoms = inlineAtoms(value);
    blocks.push({ kind: 'paragraph', role, session, sourceLineStart: start, sourceLineEnd: end, markdown: value, atoms, ...extra });
    if (role === 'body') counts[session] += 1;
  }
  function flush() {
    if (pending.length) addParagraph(pendingRole, pending.join('\n'), pendingStart, pendingStart + pending.length - 1);
    pending = [];
    pendingRole = null;
  }
  function addBodyParts(value, lineNumber) {
    // 混在正文中的教师提示也独立就近排列，不读入口播。
    const parts = value.split(/(【[^】]*】)/gu).filter(part => part.length);
    for (const part of parts) addParagraph(/^【[^】]*】$/u.test(part) ? 'teacher-note' : 'body', part, lineNumber, lineNumber);
  }

  for (let i = 0; i < lines.length; i += 1) {
    const value = lines[i].trim();
    const lineNumber = i + 1;
    if (!value || value === '>') { flush(); continue; }
    if (/^([-*_])(?:\s*\1){2,}$/u.test(value)) {
      flush();
      omittedFormatLines.push({ line: lineNumber, kind: 'markdown-separator' });
      continue;
    }
    if (/^\u0060{3}|^~~~|^<[^>]+>|^!\[/u.test(value)) throw new Error('第' + lineNumber + '行含本稿导出器未支持的块，请明确处理后再导出');
    const heading = value.match(/^(#{1,3})\s+(.+)$/u);
    if (heading) {
      flush();
      const depth = heading[1].length;
      const title = heading[2];
      if (depth === 2 && /^上节/u.test(title)) session = 'upper';
      else if (depth === 2 && /^下节/u.test(title)) session = 'lower';
      if (depth === 2 && /^教师附注/u.test(title)) appendix = true;
      const role = appendix ? 'appendix-heading' : depth === 1 ? 'title' : depth === 2 ? 'session-heading' : 'unit-heading';
      addParagraph(role, title, lineNumber, lineNumber, { depth });
      continue;
    }
    const definition = value.match(/^\[\^([^\]]+)\]:\s*(.*)$/u);
    if (definition) {
      flush();
      if (!appendix) throw new Error('第' + lineNumber + '行脚注定义不在文末附注层');
      if (definitions.has(definition[1])) throw new Error('重复脚注定义：' + definition[1]);
      definitions.add(definition[1]);
      addParagraph('source-note', definition[2], lineNumber, lineNumber, { footnoteId: definition[1] });
      continue;
    }
    if (value.startsWith('|')) {
      flush();
      const rows = [];
      const start = lineNumber;
      let separatorCount = 0;
      while (i < lines.length && /^\s*\|/u.test(lines[i])) {
        const cells = tableCells(lines[i]);
        if (cells.every(cell => /^:?-{2,}:?$/u.test(cell))) separatorCount += 1;
        else rows.push({ line: i + 1, cells });
        i += 1;
      }
      i -= 1;
      if (!appendix || separatorCount !== 1 || rows.length < 2) throw new Error('第' + start + '行表格结构或所在层不符合本稿约定');
      const columns = rows[0].cells.length;
      if (columns < 2 || columns > 5 || rows.some(row => row.cells.length !== columns)) throw new Error('第' + start + '行表格列数不一致');
      blocks.push({ kind: 'table', role: 'appendix-table', session, sourceLineStart: start, sourceLineEnd: i + 1, rows });
      continue;
    }
    const quote = value.startsWith('>');
    const text = quote ? value.replace(/^>\s?/u, '') : value;
    const role = appendix ? 'appendix-body' : quote || /^【[^】]*】$/u.test(text) ? 'teacher-note' : 'body';
    if (role === 'body' && !session) throw new Error('第' + lineNumber + '行正文未处于上节或下节');
    if (role === 'body' && /【[^】]*】/u.test(text)) {
      flush();
      addBodyParts(text, lineNumber);
      continue;
    }
    if (pendingRole !== role) flush();
    if (pending.length === 0) { pendingStart = lineNumber; pendingRole = role; }
    pending.push(text);
  }
  flush();
  const sessionHeadings = blocks.filter(block => block.role === 'session-heading');
  if (sessionHeadings.length !== 2 || sessionHeadings[0].session !== 'upper' || sessionHeadings[1].session !== 'lower') throw new Error('必须按上节、下节保留两节正文');
  if (!appendix || counts.upper === 0 || counts.lower === 0) throw new Error('缺少正文或文末教师附注');
  for (const block of blocks) {
    const atoms = block.kind === 'paragraph' ? block.atoms : block.rows.flatMap(row => row.cells.flatMap(cell => inlineAtoms(cell)));
    for (const atom of atoms) if (atom.footnote && !definitions.has(atom.footnote)) throw new Error('缺少脚注定义：' + atom.footnote);
  }
  return { blocks, omittedFormatLines, lineCount: lines.length - (lines.at(-1) === '' ? 1 : 0), counts };
}

function createDocument(parsed) {
  const d = require(DOCX_PACKAGE);
  const { Document, Paragraph, TextRun, ExternalHyperlink, InternalHyperlink, Bookmark, HeadingLevel,
    Header, Footer, PageNumber, AlignmentType, BorderStyle, ShadingType,
    Table, TableRow, TableCell, WidthType, TableLayoutType } = d;
  const paragraphs = [];
  const anchor = id => 'source_' + id.replace(/[^A-Za-z0-9_]/gu, '_');

  function runs(atoms, options = {}) {
    const result = [];
    for (const atom of atoms) {
      const runOptions = {
        font: FONT, size: 24, color: '000000', ...options,
        ...(atom.bold ? { bold: true } : {}),
        ...(atom.href ? { color: '24577B', underline: {} } : {}),
      };
      const parts = atom.text.split('\n');
      const children = [];
      parts.forEach((part, index) => {
        if (index) children.push(new TextRun({ ...runOptions, break: 1 }));
        children.push(new TextRun({ ...runOptions, text: part, ...(atom.footnote ? { superScript: true } : {}) }));
      });
      if (atom.footnote) result.push(new InternalHyperlink({ anchor: anchor(atom.footnote), children }));
      else if (atom.href) result.push(new ExternalHyperlink({ link: atom.href, children }));
      else result.push(...children);
    }
    return result;
  }
  function paragraph(block, extra = {}) {
    const isBody = block.role === 'body';
    const isHeading = /heading$|^title$/u.test(block.role);
    const atoms = block.footnoteId ? [{ text: '[' + block.footnoteId + '] ', bold: true }, ...block.atoms] : block.atoms;
    const renderedText = atomText(atoms);
    paragraphs.push({
      index: paragraphs.length + 1, role: block.role, session: block.session,
      sourceLineStart: block.sourceLineStart, sourceLineEnd: block.sourceLineEnd,
      markdown: block.markdown, renderedText,
      spokenText: isBody ? atomText(block.atoms, true) : null,
      inline: atoms,
      ...(block.tablePosition ? { tablePosition: block.tablePosition } : {}),
    });
    const runOptions = isHeading ? { font: HEADING_FONT, bold: true, size: block.role === 'title' ? 38 : block.depth === 2 ? 29 : 25 }
      : block.role === 'teacher-note' ? { color: '505050' }
        : block.role === 'source-note' || block.role === 'appendix-body' ? { color: '333333' } : {};
    let children = runs(atoms, runOptions);
    if (block.footnoteId) children = [new Bookmark({ id: anchor(block.footnoteId), children })];
    const options = { children, spacing: { after: 95, line: 330 }, widowControl: true, ...extra };
    if (block.role === 'title') Object.assign(options, { heading: HeadingLevel.TITLE, keepNext: true, spacing: { after: 220, line: 400 } });
    if (block.role === 'session-heading') Object.assign(options, { heading: HeadingLevel.HEADING_1, keepNext: true, pageBreakBefore: block.session === 'lower', spacing: { before: 170, after: 120, line: 360 } });
    if (block.role === 'unit-heading') Object.assign(options, { heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 110, after: 80, line: 330 } });
    if (block.role === 'teacher-note') Object.assign(options, { style: 'TeacherNote', indent: { left: 180, right: 120 }, spacing: { before: 60, after: 80, line: 315 } });
    if (block.role === 'source-note' || block.role === 'appendix-body') options.style = 'AppendixText';
    if (block.role === 'appendix-heading') Object.assign(options, { heading: block.depth === 2 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 170, after: 120, line: 350 } });
    return new Paragraph(options);
  }
  function table(block, tableIndex) {
    const count = block.rows[0].cells.length;
    const weights = count === 3 ? [30, 35, 35] : Array(count).fill(100 / count);
    const widths = weights.map(weight => Math.floor(CONTENT_WIDTH * weight / 100));
    widths[count - 1] += CONTENT_WIDTH - widths.reduce((sum, width) => sum + width, 0);
    const border = { style: BorderStyle.SINGLE, size: 4, color: 'BCC3C8' };
    return new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: widths,
      rows: block.rows.map((row, rowIndex) => new TableRow({
        tableHeader: rowIndex === 0, cantSplit: true,
        children: row.cells.map((cell, columnIndex) => new TableCell({
          width: { size: widths[columnIndex], type: WidthType.DXA },
          borders: { top: border, bottom: border, left: border, right: border },
          margins: { top: 90, bottom: 90, left: 110, right: 110 },
          shading: rowIndex === 0 ? { type: ShadingType.CLEAR, fill: 'EDEFF1' } : undefined,
          children: [paragraph({
            kind: 'paragraph', role: 'appendix-table-cell', session: block.session,
            sourceLineStart: row.line, sourceLineEnd: row.line, markdown: cell,
            atoms: inlineAtoms(cell, rowIndex === 0 ? { bold: true } : {}),
            tablePosition: { table: tableIndex, row: rowIndex + 1, column: columnIndex + 1 },
          }, { spacing: { after: 30, line: 300 } })],
        })),
      })),
    });
  }

  const children = [];
  let appendixStarted = false;
  let tableIndex = 0;
  parsed.blocks.forEach((block, index) => {
    if (block.kind === 'table') { tableIndex += 1; children.push(table(block, tableIndex)); return; }
    const extra = {};
    if (block.role === 'appendix-heading' && !appendixStarted) { extra.pageBreakBefore = true; appendixStarted = true; }
    // 就近提示与其后一正文同页；长正文允许自然跨页，保持孤行控制。
    if (block.role === 'teacher-note' && parsed.blocks[index + 1]?.role === 'body') extra.keepNext = true;
    children.push(paragraph(block, extra));
  });
  const document = new Document({
    creator: 'Codex', title: '第一讲《宪法总论》课堂口播主稿', subject: '待教师审阅；正文与教师提示、来源附注分层',
    styles: {
      default: { document: { run: { font: FONT, size: 24, color: '000000' }, paragraph: { spacing: { after: 95, line: 330 }, widowControl: true } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: HEADING_FONT, size: 38, bold: true }, paragraph: { keepNext: true } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: HEADING_FONT, size: 29, bold: true }, paragraph: { outlineLevel: 0, keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: HEADING_FONT, size: 25, bold: true }, paragraph: { outlineLevel: 1, keepNext: true } },
        { id: 'TeacherNote', name: 'Teacher Note', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 24, color: '505050' }, paragraph: { spacing: { line: 315 } } },
        { id: 'AppendixText', name: 'Appendix Text', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 24, color: '333333' }, paragraph: { spacing: { line: 315 } } },
      ],
    },
    sections: [{
      properties: { page: { size: PAGE, margin: MARGINS } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: '第一讲《宪法总论》　待教师审阅', font: FONT, size: 18, color: '606060' })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: '第 ', font: FONT, size: 18, color: '606060' }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: '606060' }),
        new TextRun({ text: ' 页 / 共 ', font: FONT, size: 18, color: '606060' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: '606060' }),
        new TextRun({ text: ' 页', font: FONT, size: 18, color: '606060' }),
      ] })] }) },
      children,
    }],
  });
  return { document, paragraphs };
}

function optionsFromArgs(args) {
  const options = { inspect: false, records: DEFAULT_RECORDS, help: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--inspect') options.inspect = true;
    else if (args[i] === '--help') options.help = true;
    else if (args[i] === '--records' && args[i + 1]) options.records = path.resolve(args[++i]);
    else throw new Error('未知参数或缺少参数值：' + args[i]);
  }
  if ([SOURCE, OUTPUT, path.join(__dirname, '01_完整讲稿.pdf')].some(file => samePath(file, options.records))) throw new Error('逐段记录不能覆盖源稿或文档');
  return options;
}

async function main() {
  const options = optionsFromArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write('用法：bundled-node 导出口播文档.js [--inspect] [--records 逐段记录路径]\n唯一源：同目录01_完整讲稿.md；输出：同目录01_完整讲稿.docx。\n--inspect不创建文档、不写记录；真实生成前由调用者执行文档技能开始标记。\n');
    return;
  }
  const sourceBytes = fs.readFileSync(SOURCE);
  const sourceHash = hash(sourceBytes);
  const parsed = parseMarkdown(sourceBytes.toString('utf8'));
  if (options.inspect) {
    process.stdout.write(JSON.stringify({
      source: SOURCE, sourceSha256: sourceHash, sourceLines: parsed.lineCount,
      blocks: parsed.blocks.length, bodyParagraphs: parsed.counts,
      teacherNotes: parsed.blocks.filter(block => block.role === 'teacher-note').length,
      sourceNotes: parsed.blocks.filter(block => block.role === 'source-note').length,
      appendixTables: parsed.blocks.filter(block => block.kind === 'table').length,
      generatedFiles: [],
    }, null, 2) + '\n');
    return;
  }
  const { document, paragraphs } = createDocument(parsed);
  const buffer = await require(DOCX_PACKAGE).Packer.toBuffer(document);
  if (hash(fs.readFileSync(SOURCE)) !== sourceHash) throw new Error('生成期间源稿发生变化，未替换导出件，请在源稿稳定后重试');
  const record = {
    schemaVersion: 1, createdAt: new Date().toISOString(),
    source: { path: SOURCE, sha256: sourceHash, lines: parsed.lineCount },
    docx: { path: OUTPUT, sha256: hash(buffer), bytes: buffer.length },
    layout: { paper: 'A4', page: PAGE, margins: MARGINS, bodyFont: '宋体', bodySizePt: 12 },
    paragraphCount: paragraphs.length, paragraphs,
    omittedFormatLines: parsed.omittedFormatLines,
    comparison: '按word/document.xml主文档内各w:p顺序比较renderedText；表格单元格已按行列顺序记录，页眉页脚另层，不计入口读。',
  };
  fs.mkdirSync(path.dirname(options.records), { recursive: true });
  const suffix = '.partial-' + process.pid + '-' + Date.now();
  const documentTemp = OUTPUT + suffix;
  const recordTemp = options.records + suffix;
  try {
    fs.writeFileSync(documentTemp, buffer);
    fs.writeFileSync(recordTemp, JSON.stringify(record, null, 2) + '\n', 'utf8');
    if (hash(fs.readFileSync(SOURCE)) !== sourceHash) throw new Error('写入前源稿发生变化，未替换导出件');
    fs.renameSync(documentTemp, OUTPUT);
    fs.renameSync(recordTemp, options.records);
  } finally {
    for (const temporary of [documentTemp, recordTemp]) if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  process.stdout.write(JSON.stringify({ docx: OUTPUT, records: options.records, sourceSha256: sourceHash, docxSha256: record.docx.sha256, paragraphCount: paragraphs.length }, null, 2) + '\n');
}

if (require.main === module) main().catch(error => { process.stderr.write((error.stack || error.message) + '\n'); process.exitCode = 1; });
module.exports = { inlineAtoms, atomText, tableCells, parseMarkdown, createDocument, optionsFromArgs };
