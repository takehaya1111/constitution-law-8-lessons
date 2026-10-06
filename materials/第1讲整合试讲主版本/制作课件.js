'use strict';

// 内容只从课程内容.json读取。本文件负责布局、备注及实际PPT预览，不补写课程正文。
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const MODULES = process.env.COURSE_NODE_MODULES || 'C:/Users/tsunami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const PptxGenJS = require(path.join(MODULES, 'pptxgenjs'));
const JSZip = require(path.join(MODULES, 'jszip'));
const imageModule = require(path.join(MODULES, 'image-size'));
const imageSize = typeof imageModule === 'function' ? imageModule : imageModule.imageSize;
const ROOT = __dirname;
const INPUT = path.join(ROOT, '课程内容.json');
const OUT = path.join(ROOT, '预览');
const SVG = path.join(OUT, '同源SVG');
const PNG = path.join(OUT, '逐页PNG');
const PPT = path.join(ROOT, '第1讲_宪法总论_整合试讲主版本.pptx');
const PDF = path.join(OUT, '第1讲_宪法总论_整合试讲主版本.pdf');
const W = 13.333333, H = 7.5, SCALE = 120;
const FONT = 'Microsoft YaHei';
const C = { paper: 'F7F4ED', white: 'FFFFFF', ink: '2B302F', muted: '616966', red: '9B3D32', deep: '343E3B', pale: 'E8ECE6', paleRed: 'F1E7DF', line: 'CBCDC5', light: 'E8E4D9' };
const geometry = [];
const timeRanges = new Map();
const wordBoundaries = new Intl.Segmenter('zh-CN', { granularity: 'word' });
let page, slide, svgItems;
function check(ok, message) { if (!ok) throw new Error(`第${page?.id || '?'}页：${message}`); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function units(ch) { return /\s/u.test(ch) ? 0.35 : ch.codePointAt(0) < 256 ? 0.55 : 1; }
function wrap(value, width, size) {
  const capacity = width * 72 / size * 0.94;
  const result = [];
  for (const paragraph of String(value).split('\n')) {
    const paragraphStart = result.length;
    let line = '', used = 0;
    for (const ch of paragraph) {
      const weight = units(ch);
      if (line && used + weight > capacity) {
        if (/[，。；：！？、）》」』】]/u.test(ch)) {
          const last = Array.from(line).pop();
          result.push(line.slice(0, -last.length)); line = last; used = units(last);
        } else { result.push(line); line = ''; used = 0; }
      }
      line += ch; used += weight;
    }
    result.push(line);
    // 两行中的末行若仅剩几字，按中文词边界重新分配；不删字、不压缩字号。
    if (result.length - paragraphStart >= 2 && Array.from(result.at(-1).trim()).length <= 4) {
      const combined = result.at(-2) + result.at(-1);
      const widthOf = s => Array.from(s).reduce((sum, ch) => sum + units(ch), 0);
      const insideTerm = new Set();
      for (const term of ['地方性法规', '法律效力', '国家权力', '普通法律', '宪法要求', '依法履职', '赔偿义务机关', '人身自由', '人民代表大会', '监督关系', '国家赔偿', '具体法律', '基本权利']) {
        const start = combined.indexOf(term);
        if (start >= 0) for (let j = 1; j < term.length; j += 1) insideTerm.add(start + j);
      }
      const candidates = Array.from(wordBoundaries.segment(combined)).map(s => s.index).filter(i => i > 0 && !insideTerm.has(i) && !/^[，。；：！？、）》」』】]/u.test(combined.slice(i))).map(i => ({ i, left: widthOf(combined.slice(0, i)), right: widthOf(combined.slice(i)) })).filter(c => c.left <= capacity && c.right <= capacity && c.left > 3 && c.right > 3).sort((a, b) => Math.abs(a.left - a.right) - Math.abs(b.left - b.right));
      if (candidates.length) {
        const cut = candidates[0].i;
        result.splice(-2, 2, combined.slice(0, cut), combined.slice(cut));
      }
    }
  }
  return result;
}
function tx(value, x, y, w, h, size = 24, options = {}) {
  if (value === undefined || value === null || value === '') return;
  const color = options.color || C.ink;
  const lines = wrap(value, w, size);
  const lineStep = size / 72 * 1.2;
  const need = lines.length * lineStep;
  check(need <= h + 0.02, `${options.role || '文本'}容量不足：${size}磅${lines.length}行需要${need.toFixed(2)}英寸，现有${h.toFixed(2)}；内容=${value}`);
  check(x >= 0.55 && y >= 0.25 && x + w <= W - 0.55 && y + h <= H - 0.15, '文本越出安全边距');
  const opts = { x, y, w, h, fontFace: FONT, fontSize: size, color, bold: !!options.bold,
    margin: 0, valign: 'top', align: options.align || 'left', breakLine: false, wrap: false,
    lineSpacingMultiple: 1.05, paraSpaceAfterPt: 0, lang: 'zh-CN' };
  slide.addText(lines.join('\n'), opts);
  const xSvg = (options.align === 'center' ? x + w / 2 : options.align === 'right' ? x + w : x) * SCALE;
  const anchor = options.align === 'center' ? 'middle' : options.align === 'right' ? 'end' : 'start';
  svgItems.push(`<text x="${xSvg}" y="${(y + size / 72 * 0.9) * SCALE}" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif" font-size="${size / 72 * SCALE}" font-weight="${options.bold ? 700 : 400}" fill="#${color}" text-anchor="${anchor}">${lines.map((line, i) => `<tspan x="${xSvg}" dy="${i ? lineStep * SCALE : 0}">${esc(line)}</tspan>`).join('')}</text>`);
  geometry.push({ id: page.id, role: options.role || '正文', text: String(value), lines, x, y, w, h, fontSize: size });
}
function rect(x, y, w, h, fill, line) {
  slide.addShape('rect', { x, y, w, h, fill: { color: fill }, line: { color: line || fill, transparency: line ? 0 : 100, width: 1 } });
  svgItems.push(`<rect x="${x * SCALE}" y="${y * SCALE}" width="${w * SCALE}" height="${h * SCALE}" fill="#${fill}"${line ? ` stroke="#${line}" stroke-width="1.6"` : ''}/>`);
}
function line(x1, y1, x2, y2, color = C.line, arrow = false) {
  slide.addShape('line', { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1, line: { color, width: 1.3, ...(arrow ? { endArrowType: 'triangle' } : {}) } });
  svgItems.push(`<line x1="${x1 * SCALE}" y1="${y1 * SCALE}" x2="${x2 * SCALE}" y2="${y2 * SCALE}" stroke="#${color}" stroke-width="2"${arrow ? ' marker-end="url(#arrow)"' : ''}/>`);
}
function photo(value, x, y, w, h) {
  const relative = typeof value === 'string' ? value : value.path;
  check(typeof relative === 'string', '照片需要本地相对路径');
  const file = path.resolve(ROOT, relative);
  const repoRoot = path.resolve(ROOT, '../..');
  check(!path.relative(repoRoot, file).startsWith('..'), '照片必须位于本仓库');
  check(fs.existsSync(file), `图片不存在：${relative}`);
  const bytes = fs.readFileSync(file);
  const dimensions = imageSize(bytes);
  const ratio = Math.min(w / dimensions.width, h / dimensions.height);
  const ww = dimensions.width * ratio, hh = dimensions.height * ratio;
  const xx = x + (w - ww) / 2, yy = y + (h - hh) / 2;
  slide.addImage({ path: file, x: xx, y: yy, w: ww, h: hh });
  const type = /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
  svgItems.push(`<image href="data:${type};base64,${bytes.toString('base64')}" x="${xx * SCALE}" y="${yy * SCALE}" width="${ww * SCALE}" height="${hh * SCALE}"/>`);
}
function heading(dark = false) {
  tx(sectionLabel(page), 0.78, 0.35, 11.8, 0.36, 17, { color: dark ? C.light : C.red, bold: true, role: '章节标识' });
  tx(page.title, 0.76, 0.94, 11.82, 1.08, 36, { color: dark ? C.paper : C.deep, bold: true, role: '标题' });
}
function sectionLabel(p) { return `${p.half ? (p.half === 1 ? '上节｜' : '下节｜') : ''}${p.section || ''}`; }
function foot(index, total, dark = false) {
  const muted = dark ? C.light : C.muted;
  tx(page.source || '', 0.78, 7.02, 10.55, 0.31, 12, { color: muted, role: '来源' });
  tx(`${index + 1} / ${total}`, 11.58, 7.02, 0.98, 0.31, 12, { color: muted, align: 'right', role: '页码' });
}
function bottom(dark = false) {
  if (!page.bottom) return;
  const count = wrap(page.bottom, 11.76, 24).length;
  tx(page.bottom, 0.79, count > 1 ? 6.04 : 6.36, 11.76, count > 1 ? 0.85 : 0.47, 24, { color: dark ? C.light : C.red, bold: true, role: '回收判断' });
}
function contentEnd() { return !page.bottom ? 6.65 : wrap(page.bottom, 11.76, 24).length > 1 ? 5.75 : 6.08; }
function displayLabel(value) {
  const breaks = {
    '06': { '现行宪法第5条第3款': '现行宪法\n第5条第3款' },
    '11': { '坚持中国共产党的领导': '坚持\n中国共产党的领导' },
    '31': { '用两三句话回答': '用两三句话\n回答', '给一个具体支撑': '给一个\n具体支撑' },
    '33': { '应当保留的区别': '应当保留的\n区别' },
    '25': { '继续刚才的疑问｜教学设定': '继续刚才的疑问｜\n教学设定' },
    '26': { '国家赔偿法第12条（教学提要）': '国家赔偿法第12条\n（教学提要）' }
  };
  return breaks[page.id]?.[value] || value;
}
function rows(blocks, kind = 'text') {
  const top = 2.1, end = contentEnd();
  const n = blocks.length;
  const gap = n >= 4 ? 0.18 : 0.27;
  const labelW = ['25','26'].includes(page.id) ? 3.4 : kind === 'principles' ? 3.16 : 2.6;
  const bodyX = 0.83 + labelW + 0.3;
  const needs = blocks.map(b => Math.max(wrap(displayLabel(b.label || ''), labelW - 0.2, 24).length, wrap(b.text || '', 12.5 - bodyX, 24).length) * 24 / 72 * 1.2 + 0.12);
  const used = needs.reduce((a, b) => a + b, 0) + gap * (n - 1);
  check(used <= end - top + 0.02, `${kind}条目需要${used.toFixed(2)}英寸，正文仅${(end - top).toFixed(2)}英寸；请拆显示状态或调整各块分配`);
  const spare = (end - top - used) / n;
  let y = top;
  blocks.forEach((b, i) => {
    const rowH = needs[i] + spare;
    if (kind === 'answer') rect(0.78, y, 0.08, rowH, C.red);
    if (n >= 3 && i > 0) line(0.83, y - gap / 2, 12.5, y - gap / 2);
    tx(displayLabel(b.label || ''), kind === 'answer' ? 1.01 : 0.83, y + 0.05, labelW - 0.2, rowH - 0.05, 24, { bold: true, color: C.red, role: '条目名称' });
    tx(b.text || '', bodyX, y + 0.05, 12.5 - bodyX, rowH - 0.05, 24, { role: '条目内容' });
    y += rowH + gap;
  });
}
function layout() {
  const b = page.blocks;
  if (page.layout === 'cover') {
    slide.background = { color: C.deep }; svgItems.push(`<rect width="1600" height="900" fill="#${C.deep}"/>`);
    tx(sectionLabel(page), 0.87, 0.65, 11.6, 0.45, 20, { color: C.light, role: '章节标识' });
    tx(page.title, 0.85, 1.68, page.photo ? 6.0 : 11.58, 1.35, 44, { bold: true, color: C.paper, role: '封面标题' });
    let y = 3.38;
    b.forEach(item => {
      if (item.label) tx(item.label, 0.91, y, page.photo ? 5.7 : 3.15, 0.6, 24, { color: C.light, bold: true });
      tx(item.text, page.photo ? 0.91 : item.label ? 4.22 : 0.91, page.photo ? y + 0.7 : y, page.photo ? 5.7 : item.label ? 8.12 : 11.45, page.photo ? 1.2 : 0.83, 26, { color: C.paper });
      y += 0.95;
    });
    if (page.photo) photo(page.photo, 7.05, 1.76, 5.5, 4.35);
    bottom(true); return true;
  }
  heading();
  if (page.layout === 'history' && !page.photo) {
    check(b.length <= 2, '无照片历史对照最多两组');
    b.forEach((item, i) => {
      const y = 2.12 + i * 1.93;
      const parts = item.label.match(/^(\d{4})\s*(.*)$/u);
      if (parts) {
        tx(parts[1], 0.84, y, 3.15, 0.66, 32, { bold: true, color: C.red });
        tx(parts[2], 0.86, y + 0.76, 3.25, 0.85, 24, { bold: true, color: C.red });
      } else tx(item.label, 0.86, y, 3.25, 1.5, 24, { bold: true, color: C.red });
      tx(item.text, 4.62, y + 0.13, 7.86, 1.58, 25);
    });
  } else if (page.layout === 'history' && page.photo) {
    photo(page.photo, 0.8, 2.05, 6.35, 3.8);
    const rh = (contentEnd() - 2.1) / b.length;
    b.forEach((item, i) => {
      const y = 2.1 + i * rh;
      tx(item.label || '', 7.55, y, 4.85, 0.58, 25, { bold: true, color: C.red });
      tx(item.text, 7.55, y + 0.7, 4.85, rh - 0.75, 24);
    });
  } else if (page.layout === 'compare') {
    check(b.length === 2 || b.length === 3, '并置版式应为两栏，可附一项共同判断');
    const gap = 0.48, width = 5.66;
    const boxEnd = b.length === 3 ? 4.6 : contentEnd();
    b.slice(0, 2).forEach((item, i) => {
      const x = 0.78 + i * (width + gap);
      rect(x, 2.08, width, boxEnd - 2.08, i ? C.pale : C.white);
      tx(item.label, x + 0.22, 2.3, width - 0.44, 0.6, 24, { bold: true, color: C.red });
      const displayText = page.id === '14' ? item.text.replace('全体代表的', '全体代表的\n') : item.text;
      tx(displayText, x + 0.22, 3.06, width - 0.44, boxEnd - 3.23, 24, { role: '对读文字' });
    });
    if (b.length === 3) {
      tx(b[2].label, 0.84, 4.9, 2.1, 0.85, 24, { bold: true, color: C.red });
      tx(b[2].text, 3.0, 4.9, 9.43, contentEnd() - 4.93, 24, { role: '对照后的共同判断' });
    }
  } else if (page.layout === 'chain' && page.arrowLabels) {
    // 本页箭头只承担产生关系；负责与监督由右侧明确主客体的文字承担。
    check(b.length === 3 && page.arrowLabels.length === 2, '机关图须有三个位置与两条产生关系');
    const top = 2.12, rh = 1.0, gap = 0.43;
    b.forEach((item, i) => {
      const y = top + i * (rh + gap);
      rect(0.88, y, 4.08, rh, i === 0 ? C.deep : C.pale);
      tx(item.label, 1.06, y + 0.1, 3.72, 0.84, 24, { bold: true, color: i === 0 ? C.paper : C.deep });
      tx(item.text, 5.38, y + 0.1, 6.96, 0.85, 24);
      if (i < b.length - 1) {
        line(2.5, y + rh + 0.03, 2.5, y + rh + gap - 0.03, C.red, true);
        tx(page.arrowLabels[i], 2.8, y + rh + 0.065, 2.22, 0.35, 18, { color: C.red, role: '产生关系标注' });
      }
    });
  } else if (page.layout === 'chain') {
    check(b.length >= 2 && b.length <= 4, '关系图应有2—4个位置');
    const top = 2.14, gap = 0.19, rh = (contentEnd() - top - gap * (b.length - 1)) / b.length;
    b.forEach((item, i) => {
      const y = top + i * (rh + gap);
      rect(0.88, y, 3.76, rh, i === 0 ? C.deep : C.pale);
      tx(item.label, 1.06, y + 0.13, 3.4, rh - 0.2, 24, { bold: true, color: i === 0 ? C.paper : C.deep });
      tx(item.text, 5.05, y + 0.1, 7.3, rh - 0.13, 24);
      if (i < b.length - 1) line(2.76, y + rh + 0.02, 2.76, y + rh + gap - 0.02, C.red, true);
    });
  } else if (page.layout === 'question') {
    if (b.length === 1) {
      tx(b[0].label || '', 0.88, 2.12, 11.5, 0.5, 24, { bold: true, color: C.red });
      tx(b[0].text, 0.88, 2.92, 11.5, contentEnd() - 2.95, 30, { role: '题面' });
    } else if (b.length >= 3) {
      // 三项题面采用标签在左、内容在右；保留所有条件，避免纵向重复标题吃掉作答题面空间。
      rows(b, 'question');
    } else {
      const h = (contentEnd() - 2.1 - 0.25 * (b.length - 1)) / b.length;
      b.forEach((item, i) => {
        const y = 2.1 + i * (h + 0.25);
        tx(item.label || '', 0.87, y, 11.52, 0.5, 24, { bold: true, color: C.red });
        tx(item.text, 0.87, y + 0.58, 11.52, h - 0.59, 26, { role: '题面' });
      });
    }
  } else if (page.layout === 'principles') {
    // 五项原则共同作用；并列展示，不画自动因果箭头。
    rows(b, 'principles');
  } else if (page.layout === 'answer') {
    rows(b, 'answer');
  } else if (page.layout === 'text' && b.length === 2 && b[0].text.length > 60) {
    // 长条文保留横向阅读宽度，后接一次条件辨认；不把条文号挤成窄侧栏。
    tx(b[0].label, 0.85, 2.12, 11.58, 0.6, 24, { bold: true, color: C.red });
    tx(b[0].text, 0.85, 2.88, 11.58, 1.86, 24, { role: '长条文' });
    tx(b[1].label, 0.85, 5.08, 2.6, 0.85, 24, { bold: true, color: C.red });
    tx(b[1].text, 3.8, 5.08, 8.6, 0.9, 24);
  } else if (b.length === 1) {
    tx(b[0].label || '', 0.86, 2.18, 11.6, 0.56, 24, { color: C.red, bold: true });
    tx(b[0].text, 0.86, 2.98, 11.6, contentEnd() - 3.05, 28, { role: '主文' });
  } else {
    rows(page.section === '课后查读' ? b.map(item => ({ ...item, text: item.text.replace(/；/g, '；\n') })) : b);
  }
  bottom(); return false;
}
function notes(p) {
  const content = [`${p.id}｜${p.title}`, p.optional ? (p.hidden ? '节内备用页：常规放映隐藏。按本节容量报告调用，不追加课时。' : '课后来源页，不计主线口述。') : `${p.half === 1 ? '上' : '下'}节（本节0—45分钟）｜${timeRanges.get(p.id)}`];
  if (!p.optional) content.push('页定位按180汉字/分钟与计划独立活动粗列，不是实测；口读校正、多语速、活动情景及调整路径见双45分钟容量报告。');
  if (p.hidden) {
    const id = Number(p.id);
    content.push(id === 36 ? '上节第14页讲完第64条后调用本页；若同选E1，依容量报告完成本页及第32—33页后返回第15页。仅用本页时直接返回第15页。' : [32,33].includes(id) ? '上节第14页后依次调用第32—33页；若同选E3，完成本组与第36页后返回第15页。仅用本组时直接返回第15页。' : id === 37 ? '下节第30页后调用本页；与E2同选时先完成第34—35页，再用本页，最后返回第31页收束。' : '下节第30页后依次调用第34—35页；仅用E2时回第31页，同选E4时先到第37页，最后回第31页收束。');
  }
  for (const [i, step] of p.steps.entries()) content.push(`${i + 1}. ${step.kind === 'speech' ? '逐字讲述' : '活动，不朗读'}${step.minutes ? `（${step.minutes}分钟）` : ''}`, step.text);
  if (p.teacherNotes?.length) content.push('教师备查，不朗读', ...p.teacherNotes);
  if (p.shortVersion) content.push(`节内短讲${p.shortVersion.id}：${p.shortVersion.title}`, p.shortVersion.instruction, '以下短讲替换本页全部口述；不要与上面的主讲重复朗读。', p.shortVersion.text);
  content.push('本页出处', p.source || '', '来源及定位', ...(p.refs || []).map(r => `${r.label}\n${r.url || ''}\n${r.locator || ''}`));
  return content.join('\n\n');
}
async function fixOrder(file) {
  const z = await JSZip.loadAsync(fs.readFileSync(file));
  let xml = await z.file('ppt/presentation.xml').async('string');
  const node = xml.match(/<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/u);
  if (node && xml.indexOf('<p:sldIdLst>') < node.index) {
    xml = xml.replace(node[0], '').replace('<p:sldIdLst>', `${node[0]}<p:sldIdLst>`);
    z.file('ppt/presentation.xml', xml); fs.writeFileSync(file, await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  }
}
async function main() {
  check(fs.existsSync(INPUT), '尚未提供课程内容.json；不生成代替正文');
  const bytes = fs.readFileSync(INPUT);
  const data = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  check(Array.isArray(data.pages) && data.pages.length > 0, 'pages必须为非空数组');
  let half = null, elapsed = 0;
  for (const p of data.pages.filter(p => !p.optional)) {
    if (p.half !== half) { half = p.half; elapsed = 0; }
    timeRanges.set(p.id, `本节约${Number(elapsed.toFixed(1))}—${Number((elapsed + p.minutes).toFixed(1))}分钟`);
    elapsed += p.minutes;
  }
  fs.mkdirSync(SVG, { recursive: true }); fs.mkdirSync(PNG, { recursive: true });
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'COURSE_WIDE', width: W, height: H }); pptx.layout = 'COURSE_WIDE';
  pptx.author = '宪法学课程备课组'; pptx.subject = '第一讲整合试讲主版本'; pptx.title = data.title; pptx.lang = 'zh-CN';
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT, lang: 'zh-CN' };
  const allNotes = [];
  for (const [i, p] of data.pages.entries()) {
    page = p;
    check(p.title && Array.isArray(p.blocks) && Array.isArray(p.steps), '缺少title/blocks/steps');
    check(['cover', 'history', 'text', 'compare', 'chain', 'principles', 'question', 'answer', 'recap'].includes(p.layout), `未知版式${p.layout}`);
    check(p.blocks.length >= 1 && p.blocks.length <= 5, '每页须有1—5个正文块');
    slide = pptx.addSlide(); slide.background = { color: C.paper }; slide.hidden = !!p.hidden;
    svgItems = [`<rect width="1600" height="900" fill="#${C.paper}"/>`];
    const dark = layout(); foot(i, data.pages.length, dark);
    const n = notes(p); slide.addNotes(n); allNotes.push({ id: p.id, notes: n });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1600 900" width="1600" height="900"><title>${esc(p.title)}</title><desc>由课程内容源生成的可回查SVG，实际PPT导出预览见PDF及逐页PNG。</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#${C.red}"/></marker></defs>${svgItems.join('')}</svg>`;
    fs.writeFileSync(path.join(SVG, `${String(i + 1).padStart(2, '0')}.svg`), svg, 'utf8');
  }
  await pptx.writeFile({ fileName: PPT }); await fixOrder(PPT);
  fs.writeFileSync(path.join(OUT, '几何与同版记录.json'), JSON.stringify({ input: path.basename(INPUT), inputSHA256: crypto.createHash('sha256').update(bytes).digest('hex'), pageCount: data.pages.length, hiddenPages: data.pages.filter(p=>p.hidden).map(p=>Number(p.id)), timeRanges:Object.fromEntries(timeRanges), textBoxes: geometry, notes: allNotes }, null, 2), 'utf8');
  const visible = ['# 第一讲整合试讲主版本：课件文字与逐页备注', '', '此文件与实际PPTX同由课程内容.json生成。屏幕文字、逐字讲述和活动分别列出；图片实显及字体以实际PPT导出的预览为准。', '', `内容源SHA-256：\`${crypto.createHash('sha256').update(bytes).digest('hex')}\``, ''];
  data.pages.forEach(p => {
    visible.push(`## 第${p.id}页｜${p.title}`, '', `**章节：**${sectionLabel(p)}`, '', `**放映与时间：**${p.hidden ? '常规隐藏，节内按需调用' : p.optional ? '课后查读' : timeRanges.get(p.id)}`, '', '### 屏幕', '');
    p.blocks.forEach(b => { if (b.label) visible.push(`**${b.label}**`, ''); visible.push(b.text, ''); });
    if (p.arrowLabels) visible.push(`**向下箭头：**${p.arrowLabels.join('；')}`, '');
    if (p.bottom) visible.push(`**页末：**${p.bottom}`, '');
    visible.push(`**出处：**${p.source || ''}`, '', '### 完整备注（按实际顺序）', '', notes(p), '');
  });
  fs.writeFileSync(path.join(ROOT, '课件文字.md'), visible.join('\n'), 'utf8');
  const previewIndex = ['# 第一讲实际课件预览', '', '[实际PPT导出的完整PDF](第1讲_宪法总论_整合试讲主版本.pdf) · [逐页课件文字与完整备注](../课件文字.md) · [制作检查记录](视觉检查记录.md)', '', '本讲一份课件，内部上、下两节各45分钟。1—16页上节，17—31页下节；32—37页已设置为隐藏幻灯片，常规放映跳过，38页为来源。备用材料按容量报告在相应节内调用；可在支持编号跳转的放映软件中输入页码，或从幻灯片列表选页，完成后返回原主线。PDF为便于审阅而导出全部38页，包含隐藏页；顺序阅读PDF不会自动跳过备用内容。', '', '下列PNG由本轮PPTX经LibreOffice导出PDF后逐页渲染。SVG来自同一内容与版面源，便于回查和另行渲染，不替代实际PPT画面。仓库中可回查这些文件，不等于Pro已在其当前环境成功打开二进制画面或完成视觉审阅。', '', `内容源SHA-256：\`${crypto.createHash('sha256').update(bytes).digest('hex')}\``, ''];
  data.pages.forEach((p, i) => { const no = String(i + 1).padStart(2, '0'); previewIndex.push(`## ${no}｜${p.title}`, '', `[同源SVG](同源SVG/${no}.svg)`, '', `![第${no}页实际PPT导出画面](逐页PNG/${no}.png)`, ''); });
  fs.writeFileSync(path.join(OUT, 'README.md'), previewIndex.join('\n'), 'utf8');
  fs.writeFileSync(path.join(OUT, '逐页预览.md'), previewIndex.join('\n'), 'utf8');
  console.log(`已生成 ${data.pages.length} 页可编辑PPTX及同源SVG；文本未截断。`);
  if (process.argv.includes('--render')) {
    const soffice = 'C:/Program Files/LibreOffice/program/soffice.exe';
    const profile = path.join(process.env.LOCALAPPDATA || 'C:/Users/tsunami/AppData/Local', 'Temp/pdfread/constitution-integrated-lo').replace(/\\/g, '/');
    const result = cp.spawnSync(soffice, [`-env:UserInstallation=file:///${profile}`, '--headless', '--convert-to', 'pdf:impress_pdf_Export:{"UseTaggedPDF":{"type":"boolean","value":"false"},"ExportHiddenSlides":{"type":"boolean","value":"true"}}', '--outdir', OUT, PPT], { encoding: 'utf8', windowsHide: true, timeout: 180000 });
    check(result.status === 0, `LibreOffice导出失败：${result.stderr || result.stdout}`);
    check(fs.existsSync(PDF), 'LibreOffice未生成PDF');
    const program = `import fitz,sys,pathlib\npdf=fitz.open(sys.argv[1])\nassert len(pdf)==int(sys.argv[3]),f'导出页数{len(pdf)}，预期{sys.argv[3]}；隐藏页必须包含于完整预览'\nout=pathlib.Path(sys.argv[2])\nfor i,p in enumerate(pdf):\n p.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(out/f'{i+1:02d}.png')\nprint(f'实际PPT导出PDF共{len(pdf)}页，逐页PNG已保存')\n`;
    const render = cp.spawnSync('python', ['-c', program, PDF, PNG, String(data.pages.length)], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, windowsHide: true, timeout: 120000 });
    check(render.status === 0, `PDF逐页渲染失败：${render.stderr}`);
    console.log('LibreOffice已将本次PPTX实际导出为PDF。'); console.log(render.stdout.trim());
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
