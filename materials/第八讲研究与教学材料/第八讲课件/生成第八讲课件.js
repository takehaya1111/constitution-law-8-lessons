'use strict';

// 第八讲专用生成器；正文与出处由同目录第8讲.json维护。
// 本文件不读取、不覆盖前七讲课件，所有文字、线条与色块均为可编辑对象。
const fs = require('fs');
const path = require('path');
const PptxGenJS = require('C:/Users/tsunami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs');
const JSZip = require('C:/Users/tsunami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/jszip');

const ROOT = __dirname;
const W = 13.333;
const H = 7.5;
const FONT = 'Microsoft YaHei';
const C = { ink: '20303D', deep: '142735', paper: 'F8F6F1', white: 'FFFFFF', red: 'B13D38', muted: '64717A', line: 'D9D9D3', pale: 'EEEAE1' };
const geometry = [];
let activePage = 0;

function fail(message) { throw new Error(`第${activePage || '?'}页：${message}`); }
function need(condition, message) { if (!condition) fail(message); }
function chars(value) { return Array.from(value).length; }
function stringField(object, key, max, allowEmpty = false) {
  need(typeof object[key] === 'string', `字段 ${key} 必须为字符串`);
  need(allowEmpty || object[key].trim().length > 0, `字段 ${key} 不能为空`);
  if (max !== undefined) need(chars(object[key]) <= max, `字段 ${key} 超过容量 ${max} 字（实际${chars(object[key])}）`);
}
function arrayField(object, key, min, max) {
  need(Array.isArray(object[key]), `字段 ${key} 必须为数组`);
  need(object[key].length >= min && object[key].length <= max, `字段 ${key} 应有 ${min}—${max} 项，实际${object[key].length}`);
}
function optionalString(object, key, max) {
  if (object[key] !== undefined) stringField(object, key, max, true);
}
function plainText(value) {
  return Array.isArray(value) ? value.map(run => run.text).join('') : String(value);
}

// 以中文全角字宽估计换行。此检查用于提前拒绝明显超量的内容；视觉检查仍须查看实际渲染。
function emWidth(character) {
  if (/\s/u.test(character)) return 0.32;
  return character.codePointAt(0) < 256 ? 0.57 : 1;
}
function lineEstimate(value, width, size) {
  const capacity = width * 72 / size;
  let total = 0;
  for (const paragraph of plainText(value).split('\n')) {
    let used = 0;
    let lines = 1;
    for (const character of paragraph) {
      const amount = emWidth(character);
      if (used && used + amount > capacity) { lines += 1; used = 0; }
      used += amount;
    }
    total += lines;
  }
  return total;
}
function estimatedHeight(value, width, size) {
  return lineEstimate(value, width, size) * size * 1.08 / 72;
}
function rectWithin(x, y, w, h, label, content = true) {
  need([x, y, w, h].every(Number.isFinite), `${label} 坐标必须为有限数值`);
  need(w > 0 && h > 0, `${label} 宽高必须大于零`);
  need(x >= -0.001 && y >= -0.001 && x + w <= W + 0.001 && y + h <= H + 0.001, `${label} 超出画布：${[x, y, w, h].join(', ')}`);
  if (content) need(x >= 0.7 && x + w <= 12.633 && y + h <= 6.7, `${label} 超出正文安全区`);
}
function text(slide, value, options) {
  const opts = { fontFace: FONT, color: C.ink, margin: 0, valign: 'top', breakLine: false, lineSpacingMultiple: 1.08, paraSpaceAfterPt: 0, ...options };
  const { role = 'body', allowCapacity = false } = opts;
  delete opts.role;
  delete opts.allowCapacity;
  rectWithin(opts.x, opts.y, opts.w, opts.h, `${role}文本框`, role !== 'footer');
  const estimate = estimatedHeight(value, opts.w, opts.fontSize);
  if (!allowCapacity) need(estimate <= opts.h + 0.05, `${role}文本框容量不足：${plainText(value)}（预计${estimate.toFixed(2)}英寸，框高${opts.h}）`);
  geometry.push({ page: activePage, x: opts.x, y: opts.y, w: opts.w, h: opts.h, text: plainText(value), size: opts.fontSize, role, estimatedLines: lineEstimate(value, opts.w, opts.fontSize) });
  slide.addText(value, opts);
}
function rect(slide, x, y, w, h, fill, line = fill, background = false) {
  rectWithin(x, y, w, h, '矩形', !background);
  slide.addShape('rect', { x, y, w, h, line: { color: line, transparency: line === fill ? 100 : 0, width: 0.8 }, fill: { color: fill } });
}
function heading(slide, data) {
  text(slide, data.title, { x: 0.78, y: 0.52, w: 11.75, h: 0.65, fontSize: 32, bold: true, color: C.deep, role: 'title' });
  if (data.subtitle) text(slide, data.subtitle, { x: 0.8, y: 1.28, w: 11.7, h: 0.42, fontSize: 16, color: C.muted, role: 'subtitle' });
}
function footer(slide, lesson, data, total) {
  const dark = data.kind === 'cover';
  const color = dark ? 'DDD9D0' : '46545E';
  rect(slide, 0.72, 6.88, 11.89, 0.012, dark ? '53616B' : C.line, dark ? '53616B' : C.line, true);
  text(slide, `宪法学 · 第${lesson.lessonNumber}讲`, { x: 0.75, y: 7.0, w: 2.5, h: 0.28, fontSize: 11, color, role: 'footer' });
  text(slide, data.source, { x: 3.45, y: 7.0, w: 7.35, h: 0.28, fontSize: 11, color, align: 'center', role: 'footer' });
  text(slide, `${activePage} / ${total}`, { x: 11.15, y: 7.0, w: 1.45, h: 0.28, fontSize: 11, color, align: 'right', role: 'footer' });
}
function callout(slide, value, y = 5.86, h = 0.68) {
  if (!value) return;
  rect(slide, 0.84, y, 11.65, h, C.pale);
  const pad = h < 0.6 ? 0.05 : 0.13;
  text(slide, value, { x: 1.08, y: y + pad, w: 11.17, h: h - pad * 2, fontSize: 22, bold: true, color: C.deep, role: 'callout' });
}
function cover(slide, lesson, data) {
  slide.background = { color: C.deep };
  rect(slide, 0.75, 1.07, 0.12, 4.91, C.red);
  text(slide, String(lesson.lessonNumber).padStart(2, '0'), { x: 1.08, y: 0.8, w: 1.5, h: 0.68, fontSize: 34, color: C.red, bold: true, role: 'section' });
  text(slide, '宪法学', { x: 1.08, y: 1.84, w: 5, h: 0.55, fontSize: 22, color: 'D9D5CA', role: 'course' });
  text(slide, data.title, { x: 1.08, y: 2.52, w: 11.2, h: 1.13, fontSize: 34, color: C.white, bold: true, role: 'title' });
  text(slide, data.subtitle, { x: 1.1, y: 4.05, w: 10.9, h: 1.13, fontSize: 24, color: 'E8E3D9', role: 'subtitle' });
  text(slide, '公安专业一年级 · 两学时', { x: 1.1, y: 6.15, w: 7.5, h: 0.4, fontSize: 16, color: 'CCC7BC', role: 'audience' });
}
function cards(slide, lesson, data) {
  heading(slide, data);
  const n = data.items.length;
  const gap = 0.25;
  const boxW = (11.65 - (n - 1) * gap) / n;
  const height = data.callout ? 3.57 : 4.45;
  data.items.forEach((item, i) => {
    const x = 0.84 + i * (boxW + gap);
    rect(slide, x, 1.94, boxW, height, C.white, C.line);
    text(slide, item.label, { x: x + 0.25, y: 2.17, w: boxW - 0.5, h: 0.74, fontSize: 24, bold: true, color: C.red, role: 'cardLabel' });
    text(slide, item.body, { x: x + 0.25, y: 3.12, w: boxW - 0.5, h: height - 1.42, fontSize: 22, role: 'cardBody' });
  });
  callout(slide, data.callout);
}
function highlightedQuote(value, highlights) {
  const needles = highlights === undefined ? [] : typeof highlights === 'string' ? [highlights] : highlights;
  if (!needles.length) return value;
  const ranges = [];
  for (const needle of needles) {
    let from = 0;
    while (from < value.length) {
      const start = value.indexOf(needle, from);
      if (start < 0) break;
      ranges.push([start, start + needle.length]);
      from = start + needle.length;
    }
  }
  const runs = [];
  let current = '';
  let highlighted = false;
  for (let i = 0; i < value.length; i += 1) {
    const now = ranges.some(([start, end]) => i >= start && i < end);
    if (current && now !== highlighted) { runs.push({ text: current, options: { color: highlighted ? C.red : C.deep, bold: highlighted } }); current = ''; }
    highlighted = now;
    current += value[i];
  }
  if (current) runs.push({ text: current, options: { color: highlighted ? C.red : C.deep, bold: highlighted } });
  need(runs.map(run => run.text).join('') === value, '引文富文本转换改变原文');
  return runs;
}
function quote(slide, lesson, data) {
  heading(slide, data);
  rect(slide, 0.84, 1.94, 11.65, 3.38, C.white, C.line);
  text(slide, data.tag || '原文节录', { x: 1.13, y: 2.14, w: 4, h: 0.31, fontSize: 14, color: C.red, bold: true, role: 'quoteTag' });
  text(slide, highlightedQuote(data.quote, data.highlight), { x: 1.13, y: 2.65, w: 11.05, h: 2.02, fontSize: 26, color: C.deep, role: 'quote' });
  text(slide, data.quoteLabel, { x: 1.14, y: 4.83, w: 11.05, h: 0.3, fontSize: 14, color: C.muted, align: 'right', role: 'quoteLabel' });
  text(slide, data.prompt, { x: 0.95, y: 5.69, w: 11.35, h: 0.85, fontSize: 22, bold: true, color: C.deep, role: 'prompt' });
}
function table(slide, lesson, data) {
  heading(slide, data);
  const widths = (data.widths || data.headers.map(() => 100 / data.headers.length)).map(pct => pct / 100 * 11.65);
  const bodyHeight = data.callout ? 3.4 : 3.81;
  const rowH = bodyHeight / data.rows.length;
  const rowPadding = data.callout ? 0.09 : 0.12;
  let size = null;
  for (const candidate of [22, 21, 20]) {
    if (data.rows.every(row => row.every((value, col) => estimatedHeight(value, widths[col] - 0.38, candidate) <= rowH - rowPadding * 2 + 0.05))) { size = candidate; break; }
  }
  need(size !== null, '表格在20—22磅下仍超容量，请精简或拆页');
  let x = 0.84;
  data.headers.forEach((value, col) => {
    rect(slide, x, 1.94, widths[col], 0.7, C.deep, C.paper);
    text(slide, value, { x: x + 0.19, y: 2.11, w: widths[col] - 0.38, h: 0.4, fontSize: 22, bold: true, color: C.white, role: 'tableHeader' });
    x += widths[col];
  });
  data.rows.forEach((row, r) => {
    let cellX = 0.84;
    const y = 2.64 + r * rowH;
    row.forEach((value, col) => {
      rect(slide, cellX, y, widths[col], rowH, r % 2 === 0 ? C.white : C.pale, C.paper);
      text(slide, value, { x: cellX + 0.19, y: y + rowPadding, w: widths[col] - 0.38, h: rowH - rowPadding * 2, fontSize: size, bold: col === 0, color: C.deep, role: 'tableCell' });
      cellX += widths[col];
    });
  });
  callout(slide, data.callout, 6.18, 0.46);
}
function compare(slide, lesson, data) {
  heading(slide, data);
  const xs = [0.84, 6.8];
  const w = 5.69;
  const h = data.callout ? 3.57 : 4.45;
  ['left', 'right'].forEach((key, i) => {
    const x = xs[i];
    rect(slide, x, 1.94, w, h, C.white, C.line);
    rect(slide, x, 1.94, w, 0.72, i === 0 ? C.deep : C.red);
    text(slide, data[`${key}Title`], { x: x + 0.24, y: 2.1, w: w - 0.48, h: 0.4, fontSize: 24, color: C.white, bold: true, role: 'compareLabel' });
    text(slide, data[key], { x: x + 0.26, y: 2.96, w: w - 0.52, h: h - 1.23, fontSize: 22, role: 'compareBody' });
  });
  callout(slide, data.callout);
}
function summary(slide, lesson, data) {
  heading(slide, data);
  const step = data.callout ? 1.19 : 1.43;
  data.items.forEach((value, i) => {
    const y = 1.94 + i * step;
    const h = step - 0.19;
    rect(slide, 0.84, y, 11.65, h, i === 0 ? C.deep : C.white, i === 0 ? C.deep : C.line);
    text(slide, String(i + 1).padStart(2, '0'), { x: 1.1, y: y + 0.23, w: 0.6, h: 0.4, fontSize: 22, color: i === 0 ? 'EBC8C3' : C.red, bold: true, role: 'summaryNumber' });
    text(slide, value, { x: 1.94, y: y + 0.15, w: 10.17, h: h - 0.27, fontSize: 24, color: i === 0 ? C.white : C.deep, bold: true, role: 'summaryBody' });
  });
  callout(slide, data.callout);
}
function lineSegment(slide, from, to, arrow) {
  const x = Math.min(from[0], to[0]);
  const y = Math.min(from[1], to[1]);
  const w = Math.abs(to[0] - from[0]);
  const h = Math.abs(to[1] - from[1]);
  need(w > 0 || h > 0, '连接线不得包含零长度线段');
  slide.addShape('line', { x, y, w, h, flipH: to[0] < from[0], flipV: to[1] < from[1], line: { color: C.muted, width: 1.6, ...(arrow ? { endArrowType: 'triangle' } : {}) } });
}
function diagram(slide, lesson, data) {
  heading(slide, data);
  for (const edge of data.edges) {
    for (let i = 1; i < edge.points.length; i += 1) lineSegment(slide, edge.points[i - 1], edge.points[i], i === edge.points.length - 1);
  }
  for (const node of data.nodes) {
    const dark = node.fill === 'deep';
    const fill = C[node.fill];
    rect(slide, node.x, node.y, node.w, node.h, fill, dark ? fill : C.line);
    const hasBody = node.body.trim().length > 0;
    const titleH = hasBody ? 0.47 : node.h - 0.3;
    text(slide, node.title, { x: node.x + 0.18, y: node.y + 0.15, w: node.w - 0.36, h: titleH, fontSize: 22, bold: true, color: dark ? C.white : C.deep, align: 'center', valign: hasBody ? 'top' : 'mid', role: 'nodeTitle' });
    if (hasBody) text(slide, node.body, { x: node.x + 0.18, y: node.y + 0.77, w: node.w - 0.36, h: node.h - 0.94, fontSize: 22, color: dark ? 'ECE8DF' : C.ink, align: 'center', role: 'nodeBody' });
  }
  for (const edge of data.edges) {
    if (edge.label) {
      const box = edge.labelBox;
      rect(slide, box.x, box.y, box.w, box.h, C.paper);
      text(slide, edge.label, { ...box, fontSize: 18, bold: true, color: C.muted, align: 'center', valign: 'mid', role: 'edgeLabel' });
    }
  }
  const calloutY = Math.max(5.86, ...data.nodes.map(node => node.y + node.h + 0.12));
  callout(slide, data.callout, calloutY, Math.min(0.68, 6.66 - calloutY));
}
function exercise(slide, lesson, data) {
  heading(slide, data);
  ['left', 'right'].forEach((key, i) => {
    const x = i === 0 ? 0.84 : 6.8;
    rect(slide, x, 1.94, 5.69, 2.5, C.white, C.line);
    text(slide, data[`${key}Title`], { x: x + 0.25, y: 2.14, w: 5.19, h: 0.42, fontSize: 24, color: i === 0 ? C.deep : C.red, bold: true, role: 'exerciseLabel' });
    text(slide, data[key], { x: x + 0.25, y: 2.85, w: 5.19, h: 1.33, fontSize: 22, role: 'exerciseMaterial' });
  });
  text(slide, data.context, { x: 0.94, y: 4.7, w: 11.45, h: 0.7, fontSize: 22, color: C.muted, role: 'exerciseContext' });
  rect(slide, 0.84, 5.66, 11.65, 0.96, C.deep);
  text(slide, data.prompt, { x: 1.08, y: 5.84, w: 11.17, h: 0.62, fontSize: 22, bold: true, color: C.white, role: 'exercisePrompt' });
}
function sources(slide, lesson, data) {
  heading(slide, data);
  const rowH = 4.47 / data.items.length;
  data.items.forEach((item, i) => {
    const y = 1.94 + i * rowH;
    rect(slide, 0.84, y, 11.65, rowH - 0.16, C.white, C.line);
    text(slide, item.label, { x: 1.13, y: y + 0.14, w: 10.98, h: 0.39, fontSize: 22, bold: true, color: C.deep, ...(item.url ? { hyperlink: { url: item.url } } : {}), role: 'sourceLabel' });
    text(slide, item.locator, { x: 1.13, y: y + 0.62, w: 10.98, h: rowH - 0.86, fontSize: 18, color: C.muted, role: 'sourceLocator' });
  });
}

const RENDERERS = { cover, cards, quote, table, compare, summary, diagram, exercise, sources };
function validateSlide(data, index) {
  activePage = index + 1;
  need(data && typeof data === 'object' && !Array.isArray(data), '幻灯片须为对象');
  stringField(data, 'kind', 20);
  need(Object.hasOwn(RENDERERS, data.kind), `未知页型 ${data.kind}`);
  stringField(data, 'title', data.kind === 'cover' ? 40 : 25);
  stringField(data, 'subtitle', 48, true);
  stringField(data, 'source', 44);
  stringField(data, 'phase', 40);
  stringField(data, 'notes');
  arrayField(data, 'sourceRefs', 0, 16);
  for (const ref of data.sourceRefs) {
    stringField(ref, 'label'); stringField(ref, 'url', undefined, true); stringField(ref, 'locator', undefined, true);
    need(ref.url === '' || /^https?:\/\//u.test(ref.url), `来源地址须为完整网址或表示本地材料的空字符串：${ref.url}`);
  }
  optionalString(data, 'callout', 38);
  if (data.kind === 'cards') {
    arrayField(data, 'items', 2, 3);
    for (const item of data.items) { stringField(item, 'label', 18); stringField(item, 'body', data.items.length === 3 ? 90 : 130); }
  } else if (data.kind === 'quote') {
    stringField(data, 'quote'); stringField(data, 'quoteLabel', 52); stringField(data, 'prompt', 65);
    optionalString(data, 'tag', 20);
    if (data.highlight !== undefined) {
      const needles = typeof data.highlight === 'string' ? [data.highlight] : data.highlight;
      need(Array.isArray(needles) && needles.length > 0, 'highlight 必须为非空字符串或数组');
      for (const needle of needles) need(typeof needle === 'string' && needle.length > 0 && data.quote.includes(needle), `高亮文字不是引文的完整子串：${needle}`);
    }
  } else if (data.kind === 'table') {
    arrayField(data, 'headers', 2, 4); arrayField(data, 'rows', 1, 4);
    for (const value of data.headers) need(typeof value === 'string' && value.length > 0, '表头须为非空字符串');
    for (const row of data.rows) need(Array.isArray(row) && row.length === data.headers.length && row.every(value => typeof value === 'string'), '表格行列数不一致或包含非字符串单元格');
    if (data.widths !== undefined) need(Array.isArray(data.widths) && data.widths.length === data.headers.length && data.widths.every(v => Number.isFinite(v) && v > 0) && Math.abs(data.widths.reduce((a, b) => a + b, 0) - 100) < 0.01, '表格 widths 须与列数一致且合计100');
  } else if (data.kind === 'compare' || data.kind === 'exercise') {
    stringField(data, 'leftTitle', 15); stringField(data, 'rightTitle', 15);
    stringField(data, 'left', data.kind === 'exercise' ? 60 : 120); stringField(data, 'right', data.kind === 'exercise' ? 60 : 120);
    if (data.kind === 'exercise') { stringField(data, 'context', 65); stringField(data, 'prompt', 60); }
  } else if (data.kind === 'summary') {
    arrayField(data, 'items', 3, 3);
    for (const item of data.items) need(typeof item === 'string' && chars(item) <= 52, '总结每项必须是52字以内字符串');
  } else if (data.kind === 'diagram') {
    arrayField(data, 'nodes', 1, 12); arrayField(data, 'edges', 0, 24);
    const ids = new Set();
    for (const node of data.nodes) {
      stringField(node, 'id'); need(!ids.has(node.id), `重复节点id ${node.id}`); ids.add(node.id);
      stringField(node, 'title', 24); stringField(node, 'body', 65, true);
      need(['deep', 'white', 'pale'].includes(node.fill), '节点 fill 仅可为 deep/white/pale');
      rectWithin(node.x, node.y, node.w, node.h, `节点 ${node.id}`);
      need(node.y >= 1.85, `节点 ${node.id} 进入标题区`);
      if (data.callout) need(node.y + node.h <= 6.12, `节点 ${node.id} 未为底部强调句留出空间`);
    }
    for (const edge of data.edges) {
      arrayField(edge, 'points', 2, 12);
      for (const point of edge.points) need(Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && point[0] >= 0.7 && point[0] <= 12.633 && point[1] >= 1.85 && point[1] <= 6.7, '连接点超出正文安全区');
      if (edge.label !== undefined) {
        stringField(edge, 'label', 24);
        need(edge.labelBox && typeof edge.labelBox === 'object', '有label时须提供labelBox坐标');
        const box = edge.labelBox; rectWithin(box.x, box.y, box.w, box.h, '连线标注');
      }
    }
  } else if (data.kind === 'sources') {
    arrayField(data, 'items', 1, 4);
    for (const item of data.items) {
      stringField(item, 'label', 34); stringField(item, 'locator', 65); stringField(item, 'url', undefined, true);
      need(item.url === '' || /^https?:\/\//u.test(item.url), '来源项目url须为完整网址或表示本地材料的空字符串');
    }
  }
}
async function repairPresentationElementOrder(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const item = zip.file('ppt/presentation.xml');
  if (!item) throw new Error(`缺少 ppt/presentation.xml：${file}`);
  let xml = await item.async('string');
  const notes = xml.match(/<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/u);
  if (notes && xml.indexOf('<p:sldIdLst>') < notes.index) {
    xml = xml.replace(notes[0], '').replace('<p:sldIdLst>', `${notes[0]}<p:sldIdLst>`);
    zip.file('ppt/presentation.xml', xml);
    fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } }));
  }
}
async function build() {
  const input = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, '第8讲.json');
  const lesson = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/u, ''));
  need(lesson && typeof lesson === 'object' && !Array.isArray(lesson), '输入顶层须为一个对象');
  need(lesson.lessonNumber === 8, '本生成器只接受第8讲');
  stringField(lesson, 'title', 40);
  arrayField(lesson, 'slides', 1, 60);
  lesson.slides.forEach(validateSlide);

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'LESSON8', width: W, height: H });
  pptx.layout = 'LESSON8';
  pptx.author = '宪法学课程教学组';
  pptx.subject = '公安专业一年级宪法学课程';
  pptx.title = `宪法学 第8讲 ${lesson.title}`;
  pptx.lang = 'zh-CN';
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT, lang: 'zh-CN' };
  lesson.slides.forEach((data, index) => {
    activePage = index + 1;
    const slide = pptx.addSlide();
    slide.background = { color: C.paper };
    RENDERERS[data.kind](slide, lesson, data);
    footer(slide, lesson, data, lesson.slides.length);
    const referenceLines = data.sourceRefs.map((ref, i) => `${i + 1}. ${ref.label}\n定位：${ref.locator || '见所列页面'}\n${ref.url}`);
    const notes = [`第${activePage}页 / 共${lesson.slides.length}页`, `教学环节：${data.phase}`, data.notes, '本页来源', ...referenceLines];
    if (data.kind === 'sources') notes.push('本页可点击来源清单', ...data.items.map(item => `${item.label}\n${item.locator}\n${item.url}`));
    slide.addNotes(notes.join('\n\n'));
  });
  const output = path.join(ROOT, '第8讲_宪法实施与监督.pptx');
  await pptx.writeFile({ fileName: output });
  await repairPresentationElementOrder(output);
  const geometryPath = path.join(ROOT, '文本框几何记录.json');
  fs.writeFileSync(geometryPath, JSON.stringify({ canvas: { width: W, height: H }, fontFace: FONT, unit: 'inch', source: path.basename(input), slideCount: lesson.slides.length, textBoxes: geometry }, null, 2), 'utf8');
  process.stdout.write(`${output}\n${geometryPath}\n已生成${lesson.slides.length}页，登记${geometry.length}个文本框。\n`);
}

if (require.main === module) build().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
module.exports = { build, validateSlide, lineEstimate, estimatedHeight };
