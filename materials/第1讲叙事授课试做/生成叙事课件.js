'use strict';

// 唯一内容源为01_讲授内容.json；屏幕文字、教师备注、逐字稿由同一份数据导出。
const fs = require('fs');
const path = require('path');
const PptxGenJS = require('C:/Users/tsunami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs');
const JSZip = require('C:/Users/tsunami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/jszip');
const ImageSize = require('C:/Users/tsunami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/image-size');
const imageSize = typeof ImageSize === 'function' ? ImageSize : ImageSize.imageSize;

const ROOT = __dirname;
const W = 13.333;
const H = 7.5;
const FONT = 'Microsoft YaHei';
const SONG = 'SimSun';
const C = { deep: '173238', paper: 'F5F1E7', red: 'A1372F', gold: 'B89A5B', ink: '1D3438', muted: '64706A', pale: 'E5E5D9', line: 'CCCABB', white: 'FFFFFF' };
const geometry = [];
const imageGeometry = [];
let page = 0;

function fail(message) { throw new Error(`第${page || '?'}页：${message}`); }
function requireValue(condition, message) { if (!condition) fail(message); }
function string(object, key, max, empty = false) {
  requireValue(typeof object[key] === 'string', `${key}必须为字符串`);
  requireValue(empty || object[key].trim().length > 0, `${key}不得为空`);
  if (max !== undefined) requireValue(Array.from(object[key]).length <= max, `${key}超出${max}字容量，请移入讲述或拆页，不可截字`);
}
function optional(object, key, max) { if (object[key] !== undefined) string(object, key, max, true); }
function array(object, key, min, max) {
  requireValue(Array.isArray(object[key]), `${key}必须为数组`);
  requireValue(object[key].length >= min && object[key].length <= max, `${key}须有${min}—${max}项`);
}
function plain(value) { return Array.isArray(value) ? value.map(item => item.text).join('') : String(value); }
function lineCount(value, width, size) {
  const capacity = width * 72 / size;
  let count = 0;
  for (const para of plain(value).split('\n')) {
    let used = 0;
    let lines = 1;
    for (const ch of para) {
      const amount = /\s/u.test(ch) ? 0.32 : ch.codePointAt(0) < 256 ? 0.56 : 1;
      if (used > 0 && used + amount > capacity) { lines += 1; used = 0; }
      used += amount;
    }
    count += lines;
  }
  return count;
}
function box(x, y, w, h, role, content = true) {
  requireValue([x, y, w, h].every(Number.isFinite) && w > 0 && h > 0, `${role}坐标或尺寸无效`);
  requireValue(x >= -0.001 && y >= -0.001 && x + w <= W + 0.001 && y + h <= H + 0.001, `${role}超出画布`);
  if (content) requireValue(x >= 0.7 && x + w <= 12.633 && y >= 0.35 && y + h <= 6.7, `${role}超出正文安全区：${[x, y, w, h].join(',')}`);
}
function text(slide, value, options) {
  const opts = { fontFace: FONT, fontSize: 24, margin: 0, color: C.ink, valign: 'top', breakLine: false, lineSpacingMultiple: 1.08, paraSpaceAfterPt: 0, ...options };
  const role = opts.role || '正文';
  delete opts.role;
  box(opts.x, opts.y, opts.w, opts.h, role, role !== '页脚');
  const lines = lineCount(value, opts.w, opts.fontSize);
  const requiredHeight = lines * opts.fontSize * 1.08 / 72;
  requireValue(requiredHeight <= opts.h + 0.035, `${role}容量不足：${plain(value)}（${lines}行需${requiredHeight.toFixed(2)}英寸，现有${opts.h}）`);
  geometry.push({ page, x: opts.x, y: opts.y, w: opts.w, h: opts.h, text: plain(value), size: opts.fontSize, fontFace: opts.fontFace, role, estimatedLines: lines });
  slide.addText(value, opts);
}
function rect(slide, x, y, w, h, fill, line = fill, background = false) {
  box(x, y, w, h, '矩形', !background);
  slide.addShape('rect', { x, y, w, h, fill: { color: fill }, line: { color: line, width: 1, transparency: line === fill ? 100 : 0 } });
}
function segment(slide, from, to, color = C.gold, arrow = false, width = 1.4) {
  for (const point of [from, to]) requireValue(Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && point[0] >= 0.7 && point[0] <= 12.633 && point[1] >= 0.35 && point[1] <= 6.7, '连线端点越界');
  const w = Math.abs(to[0] - from[0]);
  const h = Math.abs(to[1] - from[1]);
  requireValue(w + h > 0, '连接线不得含零长度线段');
  slide.addShape('line', { x: Math.min(from[0], to[0]), y: Math.min(from[1], to[1]), w, h, flipH: to[0] < from[0], flipV: to[1] < from[1], line: { color, width, ...(arrow ? { endArrowType: 'triangle' } : {}) } });
}
function heading(slide, data, dark = false) {
  const twoLines = lineCount(data.title, 11.73, 38) > 1;
  text(slide, data.title, { x: 0.8, y: twoLines ? 0.4 : 0.52, w: 11.73, h: twoLines ? 1.13 : 0.73, fontSize: twoLines ? 36 : 38, bold: true, color: dark ? C.paper : C.deep, role: '标题' });
  if (data.subtitle) text(slide, data.subtitle, { x: 0.82, y: twoLines ? 1.59 : 1.33, w: 11.68, h: twoLines ? 0.31 : 0.38, fontSize: twoLines ? 16 : 18, color: dark ? 'D8D5C9' : C.muted, role: '副标题' });
}
function footer(slide, data, total, dark = false) {
  const color = dark ? 'D3D0C4' : C.muted;
  text(slide, data.source, { x: 0.8, y: 7.02, w: 10.5, h: 0.26, fontSize: 12, color, role: '页脚' });
  text(slide, `${page} / ${total}`, { x: 11.53, y: 7.02, w: 1.0, h: 0.26, fontSize: 12, color, align: 'right', role: '页脚' });
}
function conclusion(slide, value, dark = false, y = 6.14) {
  if (!value) return;
  text(slide, value, { x: 0.85, y, w: 11.58, h: 0.5, fontSize: 24, bold: true, color: dark ? C.gold : C.red, role: '收束句' });
}
function photo(slide, relativePath, target, caption) {
  const file = path.resolve(ROOT, relativePath);
  const relative = path.relative(ROOT, file);
  requireValue(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'photo必须指向本目录内的史料文件');
  requireValue(fs.existsSync(file), `缺少史料图片：${relativePath}`);
  const dimensions = imageSize(fs.readFileSync(file));
  requireValue(dimensions.width > 0 && dimensions.height > 0, `不能读取图片宽高：${relativePath}`);
  const scale = Math.min(target.w / dimensions.width, target.h / dimensions.height);
  const w = dimensions.width * scale;
  const h = dimensions.height * scale;
  const x = target.x + (target.w - w) / 2;
  const y = target.y + (target.h - h) / 2;
  box(x, y, w, h, '史料图片');
  slide.addImage({ path: file, x, y, w, h, altText: caption || '' });
  imageGeometry.push({ page, source: relativePath, x, y, w, h, originalWidth: dimensions.width, originalHeight: dimensions.height, mode: 'contain' });
}

function cover(slide, data, lesson) {
  slide.background = { color: C.deep };
  text(slide, '宪法学 · 第一讲', { x: 0.92, y: 0.74, w: 6.8, h: 0.44, fontSize: 22, color: C.gold, role: '课程标识' });
  const available = data.photo ? 6.4 : 11.4;
  text(slide, data.title || lesson.title, { x: 0.92, y: 2.0, w: available, h: 1.95, fontSize: 48, bold: true, color: C.paper, role: '标题' });
  text(slide, data.subtitle || lesson.subtitle, { x: 0.97, y: 4.45, w: available, h: 1.16, fontSize: 26, color: 'E7E0CF', role: '副标题' });
  if (data.photo) {
    photo(slide, data.photo, { x: 7.72, y: 1.65, w: 4.65, h: 4.35 }, data.caption || data.source);
    text(slide, data.caption || data.source, { x: 7.72, y: 6.12, w: 4.65, h: 0.46, fontSize: 14, color: 'D0CABB', role: '图片说明' });
  }
  text(slide, '公安专业一年级 · 两学时', { x: 0.98, y: 6.21, w: 6.4, h: 0.38, fontSize: 18, color: 'D0CABB', role: '授课对象' });
}
function archive(slide, data) {
  heading(slide, data);
  if (data.photo) {
    text(slide, data.year, { x: 0.81, y: 2.0, w: 4.2, h: 1.06, fontSize: 68, color: C.red, bold: true, role: '年份' });
    text(slide, data.body, { x: 0.86, y: 3.39, w: 4.15, h: 1.95, fontSize: 26, fontFace: SONG, color: C.deep, role: '史料正文' });
    photo(slide, data.photo, { x: 5.47, y: 1.97, w: 7.0, h: 3.3 }, data.caption);
    text(slide, data.caption, { x: 5.48, y: 5.43, w: 6.99, h: 0.37, fontSize: 14, color: C.muted, role: '图片说明' });
  } else {
    text(slide, data.year, { x: 0.82, y: 2.18, w: 3.15, h: 1.23, fontSize: 68, color: C.red, bold: true, role: '年份' });
    segment(slide, [4.12, 2.02], [4.12, 5.66], C.gold, false, 1.3);
    text(slide, data.body, { x: 4.55, y: 2.04, w: 7.75, h: 3.31, fontSize: 30, fontFace: SONG, color: C.deep, role: '史料正文' });
    text(slide, data.caption, { x: 4.56, y: 5.55, w: 7.75, h: 0.36, fontSize: 14, color: C.muted, role: '史料说明' });
  }
  conclusion(slide, data.question);
}
function timeline(slide, data) {
  heading(slide, data);
  const gap = 0.3;
  const itemW = (11.6 - (data.events.length - 1) * gap) / data.events.length;
  segment(slide, [0.96, 3.11], [12.31, 3.11], C.gold, false, 1.8);
  data.events.forEach((event, i) => {
    const x = 0.85 + i * (itemW + gap);
    text(slide, event.year, { x, y: 2.05, w: itemW, h: 0.81, fontSize: 42, color: i === 0 ? C.red : C.deep, bold: true, role: '时间点' });
    slide.addShape('ellipse', { x: x + 0.08, y: 3.035, w: 0.15, h: 0.15, fill: { color: C.red }, line: { transparency: 100 } });
    text(slide, event.label, { x, y: 3.52, w: itemW, h: 0.81, fontSize: 26, bold: true, color: C.deep, role: '事件名称' });
    text(slide, event.body, { x, y: 4.49, w: itemW, h: 1.43, fontSize: 24, color: C.ink, role: '事件说明' });
  });
  conclusion(slide, data.conclusion);
}
function map(slide, data) {
  heading(slide, data);
  for (const edge of data.edges) for (let i = 1; i < edge.points.length; i += 1) segment(slide, edge.points[i - 1], edge.points[i], C.gold, edge.arrow !== false && i === edge.points.length - 1);
  const tones = { deep: C.deep, dark: C.deep, ink: C.deep, red: C.red, gold: C.gold, paper: C.paper, pale: C.pale, light: C.pale, white: C.white };
  for (const node of data.nodes) {
    const tone = node.tone || 'paper';
    requireValue(tones[tone], `未知节点色调：${tone}`);
    const dark = ['deep', 'dark', 'ink', 'red'].includes(tone);
    rect(slide, node.x, node.y, node.w, node.h, tones[tone], dark ? tones[tone] : C.gold);
    const content = node.body ? [{ text: `${node.title}\n`, options: { bold: true } }, { text: node.body, options: { bold: false } }] : node.title;
    text(slide, content, { x: node.x + 0.2, y: node.y + 0.17, w: node.w - 0.4, h: node.h - 0.34, fontSize: 24, bold: !node.body, align: 'center', valign: 'mid', color: dark ? C.paper : C.deep, role: '关系节点' });
  }
  conclusion(slide, data.conclusion);
}
function statement(slide, data) {
  heading(slide, data);
  if (data.tag) text(slide, data.tag, { x: 0.86, y: 1.97, w: 10.8, h: 0.38, fontSize: 18, color: C.red, bold: true, role: '提示标签' });
  text(slide, data.lead, { x: 0.84, y: data.tag ? 2.61 : 2.11, w: 11.55, h: 1.93, fontSize: 42, fontFace: SONG, color: C.deep, bold: true, role: '核心句' });
  text(slide, data.body, { x: 0.9, y: 5.0, w: 11.35, h: 1.42, fontSize: 26, color: C.muted, role: '展开说明' });
}
function compare(slide, data) {
  heading(slide, data);
  segment(slide, [6.665, 2.0], [6.665, 5.8], C.gold, false, 1.1);
  const xs = [0.86, 7.16];
  ['left', 'right'].forEach((key, i) => {
    text(slide, data[`${key}Title`], { x: xs[i], y: 2.0, w: 5.1, h: 0.84, fontSize: 28, color: i === 0 ? C.deep : C.red, bold: true, role: '对照标题' });
    text(slide, data[key], { x: xs[i], y: 3.06, w: 5.1, h: 2.56, fontSize: 26, color: C.ink, role: '对照正文' });
  });
  conclusion(slide, data.conclusion);
}
function law(slide, data) {
  heading(slide, data);
  text(slide, data.article, { x: 0.85, y: 1.97, w: 7.05, h: 0.43, fontSize: 24, color: C.red, bold: true, role: '条号' });
  text(slide, data.quote, { x: 0.87, y: 2.7, w: 7.05, h: 3.9, fontSize: 30, fontFace: SONG, color: C.deep, role: '法条原文' });
  segment(slide, [8.28, 1.96], [8.28, 6.59], C.gold, false, 1.3);
  const rowH = 4.62 / data.annotations.length;
  data.annotations.forEach((item, i) => {
    const value = [{ text: `${item.label}\n`, options: { bold: true, color: C.red } }, { text: item.body, options: { color: C.ink } }];
    text(slide, value, { x: 8.69, y: 1.99 + i * rowH, w: 3.78, h: rowH - 0.11, fontSize: 24, role: '条文注释' });
  });
}
function question(slide, data) {
  slide.background = { color: C.deep };
  heading(slide, data, true);
  text(slide, data.scene, { x: 0.87, y: 1.96, w: 11.47, h: 1.52, fontSize: 24, color: 'E0DDCF', role: '题设' });
  text(slide, data.question, { x: 0.85, y: 3.8, w: 11.48, h: 1.76, fontSize: 36, color: C.paper, bold: true, role: '焦点问题' });
  if (data.hint) text(slide, data.hint, { x: 0.9, y: 6.04, w: 11.37, h: 0.58, fontSize: 24, color: C.gold, role: '作答提示' });
}
function answer(slide, data) {
  heading(slide, data);
  const step = data.items.length === 3 ? 1.31 : 1.95;
  data.items.forEach((item, i) => {
    const y = 1.99 + i * step;
    text(slide, String(i + 1).padStart(2, '0'), { x: 0.87, y: y + 0.02, w: 0.58, h: 0.49, fontSize: 26, bold: true, color: C.gold, role: '讲评序号' });
    text(slide, item.label, { x: 1.71, y, w: 2.5, h: step - 0.26, fontSize: 26, bold: true, color: C.red, role: '讲评标题' });
    text(slide, item.body, { x: 4.63, y, w: 7.62, h: step - 0.24, fontSize: 24, color: C.ink, role: '讲评正文' });
    if (i < data.items.length - 1) segment(slide, [1.7, y + step - 0.15], [12.3, y + step - 0.15], C.line, false, 0.7);
  });
  conclusion(slide, data.conclusion);
}
function principles(slide, data) {
  heading(slide, data);
  const places = [
    { x: 4.73, y: 1.92, w: 3.87, h: 1.38 },
    { x: 0.8, y: 2.4, w: 3.85, h: 1.62 },
    { x: 8.9, y: 2.4, w: 3.63, h: 1.62 },
    { x: 0.8, y: 4.91, w: 4.02, h: 1.61 },
    { x: 8.54, y: 4.91, w: 3.99, h: 1.61 },
  ];
  const center = { x: 5.12, y: 3.79, w: 3.05, h: 1.11 };
  const links = [
    [[6.65, 3.3], [6.65, 3.79]],
    [[4.65, 3.48], [5.12, 4.21]],
    [[8.9, 3.48], [8.17, 4.21]],
    [[4.82, 5.12], [5.18, 4.71]],
    [[8.54, 5.12], [8.11, 4.71]],
  ];
  links.forEach(points => segment(slide, points[0], points[1], C.gold, false, 1.7));
  slide.addShape('ellipse', { ...center, fill: { color: C.deep }, line: { color: C.deep, transparency: 100 } });
  text(slide, data.center, { x: center.x + 0.15, y: center.y + 0.15, w: center.w - 0.3, h: center.h - 0.3, fontSize: 24, bold: true, color: C.paper, align: 'center', valign: 'mid', role: '共同中心' });
  data.items.forEach((item, i) => {
    const p = places[i];
    const value = [{ text: `${item.label}\n`, options: { bold: true, color: C.red } }, { text: item.body, options: { color: C.deep } }];
    text(slide, value, { ...p, fontSize: 24, align: 'center', role: '原则关系' });
  });
}
function closing(slide, data) {
  slide.background = { color: C.deep };
  heading(slide, data, true);
  text(slide, data.lead, { x: 0.9, y: 2.0, w: 11.38, h: 1.23, fontSize: 38, color: C.gold, fontFace: SONG, bold: true, role: '结语核心句' });
  data.lines.forEach((line, i) => text(slide, line, { x: 0.97, y: 3.66 + i * 0.9, w: 11.25, h: 0.74, fontSize: 26, color: C.paper, role: '结语' }));
}
function sources(slide, data) {
  heading(slide, data);
  const rowH = 4.7 / data.items.length;
  data.items.forEach((item, i) => {
    const y = 1.96 + i * rowH;
    text(slide, item.label, { x: 0.88, y, w: 11.42, h: 0.43, fontSize: 24, bold: true, color: C.deep, role: '来源名称', ...(item.url ? { hyperlink: { url: item.url } } : {}) });
    text(slide, item.locator, { x: 0.91, y: y + 0.54, w: 11.37, h: rowH - 0.66, fontSize: 18, color: C.muted, role: '来源定位' });
    if (i < data.items.length - 1) segment(slide, [0.9, y + rowH - 0.13], [12.3, y + rowH - 0.13], C.line, false, 0.7);
  });
}

const RENDER = { cover, archive, timeline, map, statement, compare, law, question, answer, principles, closing, sources };
function validate(data, index) {
  page = index + 1;
  requireValue(data && typeof data === 'object' && !Array.isArray(data), '每页必须为对象');
  requireValue(data.id === String(index + 1).padStart(2, '0'), 'id应为从01开始的连续两位数字');
  string(data, 'layout'); requireValue(Object.hasOwn(RENDER, data.layout), `未知版式${data.layout}`);
  string(data, 'title', 28); optional(data, 'subtitle', 48); string(data, 'source', 60);
  array(data, 'refs', 0, 20); array(data, 'speech', 0, 100); array(data, 'cue', 0, 30);
  for (const key of ['speech', 'cue']) data[key].forEach(value => requireValue(typeof value === 'string' && value.trim().length > 0, `${key}仅可含非空字符串段落`));
  if (data.inlineCues !== undefined) {
    array(data, 'inlineCues', 0, 30);
    data.inlineCues.forEach(cue => {
      requireValue(Number.isInteger(cue.afterParagraph) && cue.afterParagraph >= 1 && cue.afterParagraph <= data.speech.length, 'inlineCues.afterParagraph须指向实际讲述段落的一基序号');
      string(cue, 'text');
    });
  }
  for (const ref of data.refs) { string(ref, 'label'); string(ref, 'url', undefined, true); string(ref, 'locator', undefined, true); requireValue(ref.url === '' || /^https?:\/\//iu.test(ref.url), '来源须为http(s)网址或本地材料的空字符串'); }
  for (const key of ['minutes', 'silentMinutes', 'spokenMinutes']) requireValue(Number.isFinite(data[key]) && data[key] >= 0, `${key}须为非负分钟数`);
  requireValue(Math.abs(data.minutes - data.silentMinutes - data.spokenMinutes) <= 0.11, '总用时须等于讲述和非讲述用时之和');
  if (data.minutes > 0) requireValue(data.speech.length > 0, '有授课用时的页面必须有完整讲述段落');
  optional(data, 'photo');
  let bodyParts = [];
  if (data.layout === 'cover') { optional(data, 'subtitle', 80); }
  else if (data.layout === 'archive') { string(data, 'year', 18); string(data, 'body', 130); string(data, 'caption', 80); optional(data, 'question', 50); bodyParts = [data.body, data.question || '']; }
  else if (data.layout === 'timeline') {
    array(data, 'events', 2, 4); optional(data, 'conclusion', 45);
    data.events.forEach(event => { string(event, 'year', 16); string(event, 'label', 18); string(event, 'body', 55); bodyParts.push(event.label, event.body); });
    bodyParts.push(data.conclusion || '');
  } else if (data.layout === 'map') {
    array(data, 'nodes', 1, 12); array(data, 'edges', 0, 24); optional(data, 'conclusion', 45);
    const ids = new Set();
    data.nodes.forEach(node => { string(node, 'id'); requireValue(!ids.has(node.id), '关系图节点id重复'); ids.add(node.id); string(node, 'title', 24); optional(node, 'body', 45); optional(node, 'tone'); box(node.x, node.y, node.w, node.h, '关系节点'); requireValue(node.y >= 1.85, '关系节点侵入标题区'); if (data.conclusion) requireValue(node.y + node.h <= 5.96, '关系节点侵入收束句区域'); bodyParts.push(node.title, node.body || ''); });
    data.edges.forEach(edge => { array(edge, 'points', 2, 12); edge.points.forEach(point => requireValue(Array.isArray(point) && point.length === 2 && point.every(Number.isFinite), '关系图连线坐标无效')); if (edge.arrow !== undefined) requireValue(typeof edge.arrow === 'boolean', 'arrow须为布尔值'); });
    bodyParts.push(data.conclusion || '');
  } else if (data.layout === 'statement') { string(data, 'lead', 65); string(data, 'body', 100); optional(data, 'tag', 25); bodyParts = [data.lead, data.body]; }
  else if (data.layout === 'compare') { for (const key of ['leftTitle', 'rightTitle']) string(data, key, 20); for (const key of ['left', 'right']) string(data, key, 80); string(data, 'conclusion', 45); bodyParts = [data.left, data.right, data.conclusion]; }
  else if (data.layout === 'law') { string(data, 'article', 30); string(data, 'quote', 120); array(data, 'annotations', 1, 3); data.annotations.forEach(item => { string(item, 'label', 16); string(item, 'body', 35); }); }
  else if (data.layout === 'question') { string(data, 'scene', 100); string(data, 'question', 65); optional(data, 'hint', 50); bodyParts = [data.scene, data.question, data.hint || '']; }
  else if (data.layout === 'answer') { array(data, 'items', 1, 3); string(data, 'conclusion', 45); data.items.forEach(item => { string(item, 'label', 20); string(item, 'body', 75); bodyParts.push(item.label, item.body); }); bodyParts.push(data.conclusion); }
  else if (data.layout === 'principles') { string(data, 'center', 20); array(data, 'items', 5, 5); data.items.forEach(item => { string(item, 'label', 16); string(item, 'body', 25); bodyParts.push(item.label, item.body); }); bodyParts.push(data.center); }
  else if (data.layout === 'closing') { string(data, 'lead', 55); array(data, 'lines', 0, 3); data.lines.forEach(line => requireValue(typeof line === 'string' && Array.from(line).length <= 58, '结语各行须为58字以内字符串')); bodyParts = [data.lead, ...data.lines]; }
  else if (data.layout === 'sources') { array(data, 'items', 1, 4); data.items.forEach(item => { string(item, 'label', 40); string(item, 'locator', 85); string(item, 'url', undefined, true); requireValue(item.url === '' || /^https?:\/\//iu.test(item.url), '来源清单仅接受http(s)网址或空字符串'); }); }
  const count = Array.from(bodyParts.join('').replace(/\s/gu, '')).length;
  requireValue(count <= 130, `本页主体${count}字超过130字，请保留一个焦点，其余放入完整讲述`);
}

function number(value) { return Number(value.toFixed(2)).toString(); }
function sourceReferences(data) {
  const rows = [...data.refs];
  if (data.layout === 'sources') for (const item of data.items) if (!rows.some(ref => ref.label === item.label && ref.url === item.url && ref.locator === item.locator)) rows.push(item);
  return rows;
}
function references(data) { return sourceReferences(data).map(ref => `${ref.label}｜${ref.locator || '见原件'}${ref.url ? `\n${ref.url}` : ''}`); }
function referenceLinks(data) { return sourceReferences(data).map(ref => `- ${ref.url ? `[${ref.label}](${ref.url})` : ref.label}：${ref.locator || '见原件'}`); }
function speechWithCues(data, markdown = false) {
  const content = [];
  data.speech.forEach((paragraph, index) => {
    content.push(paragraph);
    for (const cue of (data.inlineCues || []).filter(item => item.afterParagraph === index + 1)) {
      content.push(markdown ? `> **操作提示，不朗读：**${cue.text}` : `【操作提示，不朗读】${cue.text}`);
    }
  });
  return content;
}
async function repairPresentationElementOrder(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const xmlFile = zip.file('ppt/presentation.xml');
  requireValue(xmlFile, '缺少ppt/presentation.xml');
  let xml = await xmlFile.async('string');
  const notes = xml.match(/<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/u);
  if (notes && xml.indexOf('<p:sldIdLst>') < notes.index) {
    xml = xml.replace(notes[0], '').replace('<p:sldIdLst>', `${notes[0]}<p:sldIdLst>`);
    zip.file('ppt/presentation.xml', xml);
    fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } }));
  }
}
async function build() {
  geometry.length = 0; imageGeometry.length = 0;
  const input = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, '01_讲授内容.json');
  const lesson = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/u, ''));
  string(lesson, 'title'); string(lesson, 'subtitle', undefined, true); array(lesson, 'slides', 1, 60);
  lesson.slides.forEach(validate);
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'NARRATIVE', width: W, height: H }); pptx.layout = 'NARRATIVE';
  pptx.author = '宪法学课程教学组'; pptx.subject = '公安专业一年级宪法学叙事授课试做'; pptx.title = lesson.title; pptx.lang = 'zh-CN';
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT, lang: 'zh-CN' };
  const totalMinutes = lesson.slides.reduce((sum, slide) => sum + slide.minutes, 0);
  const speechMinutes = lesson.slides.reduce((sum, slide) => sum + slide.spokenMinutes, 0);
  const silentMinutes = lesson.slides.reduce((sum, slide) => sum + slide.silentMinutes, 0);
  const transcript = [`# ${lesson.title}：完整逐字稿`, '', lesson.subtitle, '', `总用时${number(totalMinutes)}分钟，其中教师讲述${number(speechMinutes)}分钟，阅读、思考与交流等非讲述活动${number(silentMinutes)}分钟。以下“完整讲述”用于授课，“教学提示”供教师查看，不朗读。`, ''];
  const visible = [`# ${lesson.title}：课件可见文字`, '', '逐页记录实际写入的所有文字对象。史料图片的原件路径单独列出；图片中的文字属于原图，不冒充可编辑正文。', ''];
  let elapsed = 0;
  const renderFailures = [];
  lesson.slides.forEach((data, index) => {
    page = index + 1;
    const slide = pptx.addSlide(); slide.background = { color: C.paper };
    try {
      RENDER[data.layout](slide, data, lesson);
      const dark = ['cover', 'question', 'closing'].includes(data.layout);
      footer(slide, data, lesson.slides.length, dark);
    } catch (error) { renderFailures.push(error.message); }
    const time = data.minutes === 0 ? '课后查读' : `第${number(elapsed)}—${number(elapsed + data.minutes)}分钟`;
    const timing = `${time}；本页${number(data.minutes)}分钟，其中讲述${number(data.spokenMinutes)}分钟，非讲述活动${number(data.silentMinutes)}分钟。`;
    const refs = references(data);
    const notes = [`幻灯片${data.id}｜${data.title}`, timing];
    if (data.speech.length) notes.push('完整讲述', ...speechWithCues(data));
    else notes.push('课后查读，不朗读。');
    if (data.cue.length) notes.push('教学提示（不朗读）', ...data.cue);
    else if (data.speech.length) notes.push('教学提示（不朗读）', '无额外提示。');
    notes.push('页脚出处', data.source, '来源及定位', ...(refs.length ? refs : ['本页为课程组织或自主教学设例，无外部引文。']));
    slide.addNotes(notes.join('\n\n'));
    transcript.push(`## 幻灯片${data.id}　${data.title}｜${time}`, '', timing, '');
    if (data.speech.length) transcript.push('### 完整讲述', '', ...speechWithCues(data, true).flatMap(paragraph => [paragraph, '']));
    else transcript.push('课后查读，不朗读。', '');
    if (data.cue.length) transcript.push('### 教学提示（不朗读）', '', ...data.cue.flatMap(cue => [`- ${cue}`, '']));
    else if (data.speech.length) transcript.push('### 教学提示（不朗读）', '', '无额外提示。', '');
    transcript.push('### 来源', '', `页脚出处：${data.source}`, '', ...(refs.length ? referenceLinks(data).flatMap(ref => [ref, '']) : ['本页为课程组织或自主教学设例，无外部引文。', '']));
    visible.push(`## 幻灯片${data.id}　${data.title}`, '');
    for (const item of geometry.filter(item => item.page === page)) visible.push(item.text, '');
    if (data.photo) visible.push(`史料图片原件：${data.photo}`, '');
    elapsed += data.minutes;
  });
  if (renderFailures.length) throw new Error(`排版检查未通过，未写入输出文件：\n${renderFailures.join('\n')}`);
  const pptxFile = path.join(ROOT, '第1讲_叙事授课版.pptx');
  await pptx.writeFile({ fileName: pptxFile }); await repairPresentationElementOrder(pptxFile);
  const transcriptFile = path.join(ROOT, '02_逐字稿.md');
  fs.writeFileSync(transcriptFile, transcript.join('\n'), 'utf8');
  fs.writeFileSync(path.join(ROOT, '课件文字.md'), visible.join('\n'), 'utf8');
  fs.writeFileSync(path.join(ROOT, '几何记录.json'), JSON.stringify({ canvas: { width: W, height: H }, unit: 'inch', slideCount: lesson.slides.length, textBoxes: geometry, images: imageGeometry }, null, 2), 'utf8');
  await require('./生成文档.js').build('02_逐字稿');
  process.stdout.write(`${pptxFile}\n${transcriptFile}\n已生成${lesson.slides.length}页；${geometry.length}个文字对象；${imageGeometry.length}幅史料图片。\n`);
}
if (require.main === module) build().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
module.exports = { build, validate, lineCount };
