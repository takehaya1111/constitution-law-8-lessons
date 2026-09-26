const fs = require('fs');
const path = require('path');
const pptxgen = require('C:/Users/tsunami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs');
const JSZip = require('C:/Users/tsunami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/jszip');

const ROOT = __dirname;
const OUTPUT = path.join(ROOT, '..', '新版课件初稿');
const W = 13.333;
const H = 7.5;
const C = { ink: '20303D', deep: '142735', paper: 'F8F6F1', white: 'FFFFFF', red: 'B13D38', muted: '64717A', line: 'D9D9D3', pale: 'EEEAE1' };
const FONT = 'Microsoft YaHei';

function addText(slide, value, opts = {}) {
  slide.addText(String(value ?? ''), {
    fontFace: FONT, color: C.ink, margin: 0,
    breakLine: false, valign: 'mid', fit: 'shrink',
    ...opts,
  });
}

function rect(slide, x, y, w, h, fill, line = fill) {
  slide.addShape('rect', { x, y, w, h, line: { color: line, transparency: line === fill ? 100 : 0 }, fill: { color: fill } });
}

function baseSlide(pptx, lesson, index, total, source) {
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  rect(slide, 0, 0, W, 0.12, C.red);
  rect(slide, 0.72, 6.88, 11.89, 0.012, C.line);
  addText(slide, `宪法学  ·  第${lesson.lessonNumber}讲`, { x: 0.75, y: 6.99, w: 3.8, h: 0.3, fontSize: 11, color: '46545E' });
  addText(slide, source || '依据宪法文本与教学设计初稿', { x: 4.1, y: 6.99, w: 6.2, h: 0.3, fontSize: 11, color: '46545E', align: 'center' });
  addText(slide, `${index + 1} / ${total}`, { x: 11.1, y: 6.99, w: 1.5, h: 0.3, fontSize: 11, color: '46545E', align: 'right' });
  return slide;
}

function heading(slide, title, subtitle) {
  addText(slide, title, { x: 0.78, y: 0.58, w: 11.75, h: 0.65, fontSize: 30, bold: true, color: C.deep });
  if (subtitle) addText(slide, subtitle, { x: 0.8, y: 1.31, w: 11.7, h: 0.42, fontSize: 14, color: C.muted });
}

function cover(slide, lesson, data) {
  rect(slide, 0, 0, W, H, C.deep);
  rect(slide, 0.65, 1.02, 0.14, 4.96, C.red);
  addText(slide, `0${lesson.lessonNumber}`, { x: 0.93, y: 0.78, w: 1.8, h: 0.82, fontSize: 49, color: C.red, bold: true });
  addText(slide, '宪法学', { x: 1.0, y: 1.85, w: 5.0, h: 0.52, fontSize: 21, color: 'D9D5CA' });
  addText(slide, data.title || lesson.title, { x: 0.98, y: 2.48, w: 11.4, h: 1.08, fontSize: 39, bold: true, color: C.white });
  addText(slide, data.subtitle || lesson.question, { x: 1.0, y: 4.02, w: 10.9, h: 0.78, fontSize: 23, color: 'E8E3D9' });
  addText(slide, '公安专业一年级  ·  两学时', { x: 1.0, y: 6.57, w: 5.0, h: 0.3, fontSize: 13, color: 'BBB9B3' });
}

function points(slide, data) {
  heading(slide, data.title, data.subtitle);
  const items = (data.items || []).slice(0, 4);
  const step = items.length > 3 ? 1.07 : 1.36;
  items.forEach((item, i) => {
    const y = 1.95 + i * step;
    rect(slide, 0.84, y, 11.65, step - 0.17, C.white, C.line);
    rect(slide, 0.84, y, 0.085, step - 0.17, C.red);
    addText(slide, String(i + 1).padStart(2, '0'), { x: 1.14, y: y + 0.16, w: 0.6, h: 0.46, fontSize: 19, bold: true, color: C.red });
    addText(slide, item, { x: 1.88, y: y + 0.1, w: 10.15, h: step - 0.38, fontSize: item.length > 38 ? 19 : 21 });
  });
}

function compare(slide, data) {
  heading(slide, data.title, data.subtitle);
  const colW = 5.58;
  const xs = [0.84, 6.93];
  [0, 1].forEach((n) => rect(slide, xs[n], 1.91, colW, 4.62, C.white, C.line));
  rect(slide, xs[0], 1.91, colW, 0.75, C.deep);
  rect(slide, xs[1], 1.91, colW, 0.75, C.red);
  addText(slide, data.leftTitle || '第一组', { x: xs[0] + 0.25, y: 2.1, w: colW - 0.5, h: 0.38, fontSize: 22, color: C.white, bold: true });
  addText(slide, data.rightTitle || '第二组', { x: xs[1] + 0.25, y: 2.1, w: colW - 0.5, h: 0.38, fontSize: 22, color: C.white, bold: true });
  [['left', 0], ['right', 1]].forEach(([key, n]) => {
    (data[key] || []).slice(0, 4).forEach((item, i) => {
      const y = 2.92 + i * 0.83;
      addText(slide, `${i + 1}.`, { x: xs[n] + 0.28, y, w: 0.32, h: 0.57, fontSize: 17, bold: true, color: n ? C.red : C.deep });
      addText(slide, item, { x: xs[n] + 0.68, y, w: colW - 0.98, h: 0.62, fontSize: item.length > 30 ? 16 : 18 });
    });
  });
}

function flow(slide, data) {
  heading(slide, data.title);
  const items = (data.items || []).slice(0, 5);
  const gap = 0.18;
  const boxW = (11.65 - gap * (items.length - 1)) / Math.max(items.length, 1);
  items.forEach((item, i) => {
    const x = 0.84 + i * (boxW + gap);
    rect(slide, x, 2.44, boxW, 2.2, i === 0 ? C.deep : C.white, i === 0 ? C.deep : C.line);
    addText(slide, String(i + 1).padStart(2, '0'), { x: x + 0.2, y: 2.66, w: boxW - 0.4, h: 0.45, fontSize: 20, bold: true, color: i === 0 ? 'EBC8C3' : C.red });
    addText(slide, item, { x: x + 0.2, y: 3.22, w: boxW - 0.4, h: 1.12, fontSize: item.length > 16 ? 18 : 21, color: i === 0 ? C.white : C.deep, bold: true });
  });
  if (data.subtitle) addText(slide, data.subtitle, { x: 1.0, y: 5.25, w: 11.35, h: 0.72, fontSize: 18, color: C.muted, align: 'center' });
}

function quote(slide, data) {
  heading(slide, data.title, data.subtitle);
  rect(slide, 0.84, 1.93, 11.65, 4.46, C.white, C.line);
  rect(slide, 0.84, 1.93, 0.1, 4.46, C.red);
  addText(slide, '“', { x: 1.23, y: 2.18, w: 0.9, h: 0.7, fontSize: 63, color: C.red, fontFace: 'SimSun' });
  const q = data.quote || (data.items || []).join('　');
  addText(slide, q, { x: 1.9, y: 2.6, w: 9.85, h: 2.35, fontSize: q.length > 80 ? 25 : 29, color: C.deep, bold: true });
  addText(slide, data.source || '', { x: 2.0, y: 5.43, w: 9.7, h: 0.42, fontSize: 16, color: C.muted, align: 'right' });
}

function exercise(slide, data) {
  heading(slide, data.title || '课堂练习', data.subtitle);
  rect(slide, 0.84, 1.9, 11.65, 1.5, C.deep);
  addText(slide, data.prompt || '请依据宪法文本判断。', { x: 1.18, y: 2.15, w: 10.95, h: 0.9, fontSize: 24, bold: true, color: C.white });
  (data.items || []).slice(0, 3).forEach((item, i) => {
    rect(slide, 0.84, 3.74 + i * 0.83, 11.65, 0.65, C.white, C.line);
    addText(slide, `${i + 1}  ${item}`, { x: 1.2, y: 3.82 + i * 0.83, w: 10.75, h: 0.45, fontSize: item.length > 42 ? 18 : 20, color: C.deep });
  });
}

function summary(slide, data) {
  heading(slide, data.title || '这一讲，留下三个判断', data.subtitle);
  const items = (data.items || []).slice(0, 3);
  items.forEach((item, i) => {
    const y = 1.92 + i * 1.36;
    rect(slide, 0.85, y, 11.64, 1.08, i === 0 ? C.deep : C.white, i === 0 ? C.deep : C.line);
    addText(slide, `${i + 1}`, { x: 1.18, y: y + 0.27, w: 0.45, h: 0.43, fontSize: 22, bold: true, color: i === 0 ? 'EBC8C3' : C.red });
    addText(slide, item, { x: 1.82, y: y + 0.17, w: 10.22, h: 0.71, fontSize: item.length > 42 ? 18 : 21, color: i === 0 ? C.white : C.deep, bold: true });
  });
}

function institution(slide, data) {
  heading(slide, data.title, data.subtitle);
  rect(slide, 4.53, 2.02, 4.28, 0.91, C.deep);
  addText(slide, '相应的人民代表大会', { x: 4.78, y: 2.22, w: 3.78, h: 0.47, fontSize: 23, color: C.white, bold: true, align: 'center' });
  rect(slide, 6.65, 2.93, 0.024, 0.61, C.muted);
  rect(slide, 2.39, 3.52, 8.55, 0.024, C.muted);
  const labels = data.blanks ? ['（填写）', '（填写）', '（填写）'] : ['行政机关', '监察机关', '审判、检察机关'];
  const xs = [0.92, 4.55, 8.18];
  labels.forEach((label, i) => {
    rect(slide, xs[i] + 1.67, 3.52, 0.024, 0.62, C.muted);
    rect(slide, xs[i], 4.12, 3.29, 1.25, C.white, C.line);
    addText(slide, label, { x: xs[i] + 0.2, y: 4.36, w: 2.89, h: 0.65, fontSize: 22, bold: true, align: 'center', color: C.deep });
  });
  addText(slide, data.blanks ? '补机关名称与关系方向；注意机关设置依层级而异。' : '宪法第3条确立总体关系；具体机关设置依层级而异。', { x: 0.96, y: 5.86, w: 11.4, h: 0.58, fontSize: 20, color: C.muted, align: 'center' });
}

function renderSlide(pptx, lesson, data, index, total) {
  const slide = baseSlide(pptx, lesson, index, total, data.source);
  const kind = data.kind || 'points';
  ({ cover, points, compare, flow, quote, exercise, summary, institution }[kind] || points)(slide, kind === 'cover' ? lesson : data, data);
}

async function repairPresentationElementOrder(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const item = zip.file('ppt/presentation.xml');
  if (!item) throw new Error(`缺少 ppt/presentation.xml：${file}`);
  let xml = await item.async('string');
  const notes = xml.match(/<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/);
  if (notes && xml.indexOf('<p:sldIdLst>') < notes.index) {
    xml = xml.replace(notes[0], '').replace('<p:sldIdLst>', `${notes[0]}<p:sldIdLst>`);
    zip.file('ppt/presentation.xml', xml);
    fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } }));
  }
}

async function build() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const inputs = process.argv.length > 2 ? process.argv.slice(2) : ['第1-2讲.json', '第3-4讲.json', '第5-6讲.json', '第7讲.json'];
  const lessons = inputs.flatMap((name) => {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) throw new Error(`缺少课件数据：${file}`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  });
  if (process.argv.length === 2 && lessons.length !== 7) throw new Error(`预计7讲，实际${lessons.length}讲`);
  for (const lesson of lessons) {
    if (!Number.isInteger(lesson.lessonNumber) || !Array.isArray(lesson.slides) || lesson.slides.length < 8) throw new Error(`数据不足：第${lesson.lessonNumber}讲`);
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = '宪法学课程教学组';
    pptx.subject = '公安专业一年级宪法学课程';
    pptx.title = `宪法学 第${lesson.lessonNumber}讲 ${lesson.title}`;
    pptx.lang = 'zh-CN';
    lesson.slides.forEach((data, i) => renderSlide(pptx, lesson, data, i, lesson.slides.length));
    const out = path.join(OUTPUT, `第${lesson.lessonNumber}讲_${lesson.title}.pptx`);
    await pptx.writeFile({ fileName: out });
    await repairPresentationElementOrder(out);
    process.stdout.write(`${out}\t${lesson.slides.length}\n`);
  }
}

build().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
