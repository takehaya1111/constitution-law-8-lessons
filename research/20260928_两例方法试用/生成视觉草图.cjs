// Standalone, source-bound comparison sketches. No remote assets or dependencies are loaded by the HTML.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {PDFDocument}=require('pdf-lib');
const out = path.join(__dirname, '视觉草图');
fs.mkdirSync(out, {recursive:true});
const ink='#203541', blue='#23667c', rust='#9a572c', pale='#edf3f5', paper='#fbfaf7', line='#cad4d7';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function text(x,y,s,size=26,color=ink,weight=400){return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(s)}</text>`;}
function rich(x,y,s,size=26){return `<text x="${x}" y="${y}" font-size="${size}" fill="${ink}">${s}</text>`;}
function box(x,y,w,h,fill='none',stroke=line){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;}
function rule(x1,y1,x2,y2,stroke=line,width=2){return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"/>`;}
function span(s,color=blue){return `<tspan fill="${color}" font-weight="600">${esc(s)}</tspan>`;}
function hints(s){return `<g class="explain">${s}</g>`;}
function base(id,title,subtitle,content,source){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${esc(title)}</title><desc id="${id}-desc">${esc(subtitle)}</desc><rect width="1280" height="720" fill="${paper}"/><g font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif">${text(56,43,`${id} · ${subtitle}`,18,blue,600)}${text(56,102,title,40,ink,600)}${rule(56,126,1224,126)}${content}${rule(56,660,1224,660)}${text(56,692,source,17,'#53646b')}</g></svg>`;}
const sketches=[];
let s='';
s+=text(56,155,'教学设例｜均为中国公民，且未被依法剥夺政治权利',20);
s+=text(56,185,'判断范围：第34条规定的选举权和被选举权资格',20,blue,600);
s+=box(56,210,560,273)+box(644,210,580,273);
s+=text(84,246,'第一组：年龄不同',26,ink,600)+text(673,246,'第二组：财产、教育程度不同',26,ink,600);
s+=text(91,298,'甲',24)+text(354,298,'乙',24);
s+=text(89,366,'17',64,blue,600)+text(183,366,'周岁',24)+text(353,366,'18',64,blue,600)+text(447,366,'周岁',24);
s+=rule(326,270,326,405)+text(88,448,'第34条怎样处理这个条件？',24,rust);
s+=text(678,298,'丙',24)+text(954,298,'丁',24);
s+=text(676,352,'18周岁',38,blue,600)+text(952,352,'18周岁',38,blue,600);
s+=rule(932,270,932,405)+text(678,396,'财产、教育程度',22)+text(953,396,'与丙不同',22);
s+=text(678,448,'这些差别能否排除这项权利？',24,rust);
s+=hints(box(56,516,1168,115,pale,'none')+text(79,556,'第34条采用年龄条件，同时明确不分教育程度、财产状况等。',27,blue,600)+text(79,600,'另加一份规则，还要核查它是否与宪法相抵触（第5条）。',25));
sketches.push({id:'A1',title:'同是公民，差别怎样进入判断？',sub:'先比较情境，再找依据',svg:base('A1','同是公民，差别怎样进入判断？','先比较情境，再找依据',s,'依据：宪法第5、33、34条｜这里只判断条文列明的资格，不代替具体登记程序核查。')});
s=box(56,157,1168,84,pale,'none')+text(78,191,'第33条第2款',19,blue,600)+text(78,226,'中华人民共和国公民在法律面前一律平等。',30,ink,600);
s+=text(56,285,'第34条全文',21,blue,600);
s+=rich(56,331,'中华人民共和国'+span('年满十八周岁')+'的公民，不分民族、种族、性别、职业、家庭',27);
s+=rich(56,375,'出身、宗教信仰、'+span('教育程度、财产状况')+'、居住期限，都有选举权和被选举',27);
s+=rich(56,419,'权；但是'+span('依照法律被剥夺政治权利的人除外',rust)+'。',27);
s+=hints(rule(56,456,1224,456)+text(56,505,'采用的条件',27,blue,600)+text(470,505,'被排除的差别',27,blue,600)+text(904,505,'明示的例外',27,rust,600)+text(56,550,'满十八周岁',23)+text(470,550,'教育程度、财产状况等',23)+text(904,550,'依法被剥夺政治权利',23)+text(56,612,'再用同一组设例检查；附加规则仍须接受宪法第5条的约束。',25));
sketches.push({id:'A2',title:'把两条规定放在一起读',sub:'先辨清条文关系，再用设例检查',svg:base('A2','把两条规定放在一起读','先辨清条文关系，再用设例检查',s,'依据：宪法第5、33、34条｜两条文的关系解释，不是完整的平等权审查标准。')});
s=text(56,168,'2015年起草说明提出的问题：是否使用统一的誓词？',25);
s+=box(56,201,552,115)+box(648,201,576,115);
s+=text(86,248,'按岗位分别表述？',32,ink,600)+text(86,289,'可以突出哪些差异',23,rust);
s+=text(678,248,'采用统一誓词？',32,ink,600)+text(678,289,'需要找到什么共同要求',23,rust);
s+=text(56,351,'上面是供课堂思考的可能选择，不是已核实的两份对立草案。',20,'#53646b');
s+=hints(box(56,379,1168,210,pale,'none')+text(80,416,'2015年说明记录的理由',21,blue,600)+text(80,462,'级别、种类、工作任务不同；共同的宪法要求相同。',29,ink,600)+text(80,508,'据此支持统一誓词，并考虑统一、规范所具有的严肃性。',26)+text(80,555,'现行誓词仍要求“履行法定职责”“接受人民监督”。',26));
s+=text(56,632,'2015年7月决定　→　2018年2月修订　→　2018年3月入宪',22,blue);
sketches.push({id:'B1',title:'岗位不同，宪法宣誓誓词要不要不同？',sub:'从起草时的真实问题进入',svg:base('B1','岗位不同，宪法宣誓誓词要不要不同？','从起草时的真实问题进入',s,'来源：2015年起草说明，公报719页；2018年修订决定；宪法第5、27条。')});
s=box(56,158,1168,110,pale,'none')+text(79,194,'现行誓词节录｜2018年修订决定第二项',20,blue,600);
s+=text(79,241,'忠于中华人民共和国宪法　／　履行法定职责　／　接受人民监督',28,ink,600);
s+=box(56,310,552,203)+box(648,310,576,203);
s+=text(84,360,'共同的宪法要求',32,blue,600)+text(84,408,'守宪要求已经存在（第5条）',25)+text(84,457,'依法公开宣誓（第27条第3款）',25);
s+=text(678,360,'各岗位的法定职责',32,blue,600)+text(678,408,'具体职责和权限',27)+text(678,457,'仍须查相应法律规定',27);
s+=hints(text(56,566,'统一誓词表达共同承诺，并不使不同岗位的权限相同。',29,ink,600)+text(56,613,'回查形成理由：2015年说明如何从岗位差异作出统一选择？',24,rust));
sketches.push({id:'B2',title:'同一份承诺，具体职责各有依据',sub:'从现行文本进入，再回查形成理由',svg:base('B2','同一份承诺，具体职责各有依据','从现行文本进入，再回查形成理由',s,'范围：依法应当宣誓的国家工作人员｜2015年起草理由与2018年现行誓词分别标注。')});

async function main(){
 for (const a of sketches){ fs.writeFileSync(path.join(out,`${a.id}.svg`),a.svg,'utf8'); await sharp(Buffer.from(a.svg)).png().toFile(path.join(out,`${a.id}.png`)); }
 const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>两例方法试用 · 视觉草图对照</title><style>*{box-sizing:border-box}body{margin:0;background:#e9ecec;color:${ink};font-family:'Microsoft YaHei',sans-serif}header,main{max-width:1328px;margin:auto;padding:24px}header p{line-height:1.8;max-width:1000px}h1{font-size:28px;margin:6px 0}nav{display:flex;gap:12px;flex-wrap:wrap}a{color:${blue}}section{margin:0 0 38px}section h2{font-size:22px;margin:0 0 12px}section p{line-height:1.7;margin:8px 0}button{font:inherit;padding:9px 18px;color:${ink};background:white;border:1px solid #94a6ad;cursor:pointer;margin:0 0 12px}button:focus-visible{outline:3px solid ${blue};outline-offset:3px}.board{box-shadow:0 8px 25px #172c3814}.board svg{display:block;width:100%;height:auto}.hideHints .explain{visibility:hidden}.caption{font-size:15px;color:#52636a}@media print{body{background:white}header,button,.caption{display:none}main{padding:0;max-width:none}section{break-after:page;margin:0}section h2{font-size:16px}.board{box-shadow:none}.hideHints .explain{visibility:visible}@page{size:A4 landscape;margin:10mm}}</style><header><h1>两例方法试用 · 视觉草图对照</h1><p>每例比较两种讲述入口，保持核心材料。草图用于检查信息关系与关注顺序。静态草图展示完整提示状态，讲述顺序见对应短讲稿。尚未开展真人试讲或学生效果比较。</p><nav>${sketches.map(a=>`<a href="#${a.id}">${a.id} ${a.sub}</a>`).join('')}</nav></header><main>${sketches.map(a=>`<section id="${a.id}"><h2>${a.id} · ${a.sub}</h2><div class="board">${a.svg}</div><p class="caption">对应讲述与来源：<a href="../${a.id.startsWith('A')?'01_例A_平等与差别.md':'02_例B_统一誓词.md'}">查看本例记录</a> · <a href="${a.id}.png">静态草图</a></p></section>`).join('')}</main></html>`;
 fs.writeFileSync(path.join(out,'对照查看.html'),html,'utf8');
 const thumbW=640,thumbH=360; const tiles=await Promise.all(sketches.map(a=>sharp(path.join(out,`${a.id}.png`)).resize(thumbW,thumbH).toBuffer()));
 await sharp({create:{width:1280,height:720,channels:3,background:'#e9ecec'}}).composite(tiles.map((input,i)=>({input,left:i%2*thumbW,top:Math.floor(i/2)*thumbH}))).png().toFile(path.join(out,'四图总览.png'));
 const pdf=await PDFDocument.create(); pdf.setTitle('两例方法试用 · 视觉草图对照'); for(const a of sketches){const p=pdf.addPage([1280,720]); const im=await pdf.embedPng(fs.readFileSync(path.join(out,a.id+'.png'))); p.drawImage(im,{x:0,y:0,width:1280,height:720});} fs.writeFileSync(path.join(out,'视觉草图对照.pdf'),await pdf.save());
 console.log(JSON.stringify({sketches:sketches.map(x=>x.id),size:[1280,720],remoteAssets:0,pdfPages:4}));
}
main().catch(e=>{console.error(e);process.exit(1)});
