// 从两份课堂正文生成可编辑讲义；PDF另由独立配置的文档渲染器导出。
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Footer, PageNumber,
  ExternalHyperlink, HeadingLevel, AlignmentType, BorderStyle } = require('docx');

const root = __dirname;

function runs(text) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let previous = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > previous) parts.push(new TextRun(text.slice(previous, match.index)));
    const token = match[0];
    if (token.startsWith('**')) parts.push(new TextRun({text: token.slice(2, -2), bold: true}));
    else {
      const m = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (/^https?:/.test(m[2])) parts.push(new ExternalHyperlink({link:m[2], children:[new TextRun({text:m[1],color:'000000',underline:{}})]}));
      else parts.push(new TextRun(m[1]));
    }
    previous = match.index + token.length;
  }
  if (previous < text.length) parts.push(new TextRun(text.slice(previous)));
  return parts.length ? parts : [new TextRun('')];
}

function paragraphs(markdown, kind) {
  const result = [];
  let pendingPageBreak = false;
  let questionStarted = false;
  let lectureMode = '';
  const teacher = kind === '教师讲评';
  const lecture = kind === '完整讲稿';
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line === '>') continue;
    if (line === '<!-- PAGEBREAK -->') { if(!teacher) pendingPageBreak = true; continue; }
    if(lecture && line === '### 讲述' && lectureMode === 'speech') continue;
    const options = { children:[], pageBreakBefore:pendingPageBreak };
    pendingPageBreak = false;
    if (/^#{1,3} /.test(line)) {
      const count=line.match(/^#+/)[0].length;
      if(teacher && count===2 && /^## (任务|扩展)/.test(line)) {
        options.pageBreakBefore=questionStarted;
        questionStarted=true;
      }
      if(lecture && count===2) lectureMode='';
      if(lecture && count===3) lectureMode=line==='### 讲述'?'speech':'note';
      options.heading = [null,HeadingLevel.TITLE,HeadingLevel.HEADING_1,HeadingLevel.HEADING_2][count];
      options.children=runs(line.slice(count+1));
    } else if (/^_{10,}$/.test(line)) {
      options.children=[new TextRun({text:'____________________________________________________________',font:'Arial',size:20,color:'A6A6A6'})];
      options.spacing={before:0,after:70,line:350};
    } else {
      const quote=line.startsWith('> ');
      options.children=runs(quote?line.slice(2):line);
      options.spacing={before:0,after:95,line:330};
      options.keepLines=true;
      if(quote) options.indent={left:240,right:120};
      if(lecture && (lectureMode==='note' || line.startsWith('依据：') || /分钟$/.test(line))) {
        options.children=runs(line.startsWith('- ')?line.slice(2):line).map(r=>r);
        options.style='TeacherNote';
        options.spacing={before:0,after:60,line:285};
      }
      if(lecture && line.includes('｜')) options.keepNext=true;
      // 当前整合稿此段若续在页末，会在LibreOffice中留下仅两字的跨页尾行。
      if(lecture && line.startsWith('我们可以把关系收成一句话：')) options.pageBreakBefore=true;
    }
    result.push(new Paragraph(options));
  }
  return result;
}

async function build(stem, kind) {
  const text=fs.readFileSync(path.join(root,stem+'.md'),'utf8');
  const doc = new Document({
    creator:'Codex',title:'宪法总论 '+kind,subject:'第一讲整合试讲主版本',
    styles:{
      default:{document:{run:{font:{ascii:'Calibri',hAnsi:'Calibri',eastAsia:'宋体'},size:24,color:'000000'},paragraph:{spacing:{after:95,line:330},widowControl:true}}},
      paragraphStyles:[
        {id:'Title',name:'Title',basedOn:'Normal',next:'Normal',run:{font:{eastAsia:'黑体',ascii:'Arial',hAnsi:'Arial'},size:38,bold:true,color:'000000'},paragraph:{spacing:{before:0,after:220},keepNext:true}},
        {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:{eastAsia:'黑体',ascii:'Arial',hAnsi:'Arial'},size:29,bold:true,color:'000000'},paragraph:{spacing:{before:170,after:120},keepNext:true,outlineLevel:0}},
        {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:{eastAsia:'黑体',ascii:'Arial',hAnsi:'Arial'},size:25,bold:true,color:'000000'},paragraph:{spacing:{before:110,after:80},keepNext:true,outlineLevel:1}}
        ,{id:'TeacherNote',name:'Teacher Note',basedOn:'Normal',next:'Normal',run:{font:{eastAsia:'宋体',ascii:'Calibri',hAnsi:'Calibri'},size:21,color:'505050'},paragraph:{spacing:{after:60,line:285}}}
      ]
    },
    sections:[{
      properties:{page:{size:{width:11906,height:16838},margin:{top:1020,bottom:1000,left:1134,right:1134,header:400,footer:400}}},
      footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'宪法总论　'+kind+'　',size:18}),new TextRun({children:[PageNumber.CURRENT],size:18})]})]})},
      children:paragraphs(text,kind)
    }]
  });
  await fs.promises.writeFile(path.join(root,stem+'.docx'),await Packer.toBuffer(doc));
  console.log(stem+'.docx');
}

(async()=>{
  if(process.argv.includes('--lecture')) await build('01_完整讲稿','完整讲稿');
  else {
    await build('02_学生材料','学生材料');
    await build('03_逐题讲评','教师讲评');
  }
})().catch(e=>{console.error(e);process.exit(1);});
