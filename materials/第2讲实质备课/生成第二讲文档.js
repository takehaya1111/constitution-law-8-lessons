// 只读 Markdown 正文，生成三份可编辑 A4 Word。PDF 由独立配置渲染器导出。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {Document,Packer,Paragraph,TextRun,Footer,PageNumber,ExternalHyperlink,
  HeadingLevel,AlignmentType,Table,TableRow,TableCell,WidthType,BorderStyle,
  VerticalAlign,ShadingType} = require('C:/Users/tsunami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/docx');
const root=__dirname;
const W=9638;
const ink='000000';
const font={ascii:'Calibri',hAnsi:'Calibri',eastAsia:'宋体'};
function runs(s,extra={}){
  const out=[]; let last=0;
  for(const m of s.matchAll(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)){
    if(m.index>last)out.push(new TextRun({text:s.slice(last,m.index),...extra}));
    if(m[0].startsWith('**'))out.push(new TextRun({text:m[0].slice(2,-2),bold:true,...extra}));
    else{
      const a=m[0].match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if(/^https?:/.test(a[2]))out.push(new ExternalHyperlink({link:a[2],children:[new TextRun({text:a[1],color:ink,underline:{},...extra})]}));
      else out.push(new TextRun({text:a[1],...extra}));
    }
    last=m.index+m[0].length;
  }
  if(last<s.length)out.push(new TextRun({text:s.slice(last),...extra}));
  return out.length?out:[new TextRun('')];
}
function table(lines,kind){
  const data=lines.filter(s=>!/^\|[-: |]+\|$/.test(s)).map(s=>s.split('|').slice(1,-1).map(x=>x.trim()));
  const n=data[0].length;
  const widths=n===3?[1000,6260,2378]:[2380,7258];
  const border={style:BorderStyle.SINGLE,size:4,color:'D9D9D9'};
  return new Table({width:{size:W,type:WidthType.DXA},columnWidths:widths,
    rows:data.map((r,i)=>new TableRow({tableHeader:i===0,cantSplit:true,
      children:r.map((v,j)=>new TableCell({width:{size:widths[j],type:WidthType.DXA},
        margins:{top:kind==='逐题讲评'?55:95,bottom:kind==='逐题讲评'?55:95,left:120,right:120},verticalAlign:VerticalAlign.CENTER,
        shading:{fill:i===0?'EEEEEE':'FFFFFF',type:ShadingType.CLEAR},
        borders:{top:border,bottom:border,left:border,right:border},
        children:[new Paragraph({spacing:{before:0,after:0,line:285},widowControl:true,
          children:runs(v,{size:21,bold:i===0})})]}))}))});
}
function content(md,kind){
  const lines=md.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),out=[];
  let page=false,mode='';
  for(let i=0;i<lines.length;i++){
    const l=lines[i];
    if(l==='<!-- PAGEBREAK -->'){page=true;continue;}
    if(l==='>')continue;
    if(l.startsWith('|')){let arr=[];while(i<lines.length&&lines[i].startsWith('|'))arr.push(lines[i++]);i--;out.push(table(arr,kind));out.push(new Paragraph({spacing:{after:30,line:70},children:[]}));continue;}
    const o={pageBreakBefore:page,children:[],widowControl:true};page=false;
    const h=l.match(/^(#{1,3}) (.*)/);
    if(h){
      const level=h[1].length;
      if(level===2)mode='';
      if(level===3)mode=h[2]==='讲述'?'speech':'note';
      o.heading=[null,HeadingLevel.TITLE,HeadingLevel.HEADING_1,HeadingLevel.HEADING_2][level];
      o.children=runs(h[2]);
    }else if(/^_{10,}$/.test(l)){
      o.children=[new TextRun({text:' ',size:23})];
      o.border={bottom:{style:BorderStyle.SINGLE,color:'BBBBBB',size:3,space:1}};
      o.spacing={before:0,after:70,line:355};
      o.indent={right:180};
    }else{
      const quote=l.startsWith('> '),source=/^(出处：|依据：|资料位置说明：|\*\*资料位置说明：)/.test(l);
      const note=(kind==='完整讲述'&&mode==='note')||source;
      o.children=runs(quote?l.slice(2):l,note?{size:20,color:'444444'}:{});
      o.spacing={before:0,after:kind==='完整讲述'?90:65,line:kind==='完整讲述'?315:285};
      if(note){o.style='TeacherNote';o.spacing={before:0,after:70,line:270};}
      if(quote){o.indent={left:200,right:100};o.keepLines=true;}
      if(/^\*\*[^*]+\*\*[：:]?$/.test(l)){o.keepNext=true;o.spacing={before:60,after:40,line:280};}
      if(l.startsWith('- '))o.children=runs(l.slice(2));
      if(lines[i+1]?.startsWith('出处：')||lines[i+1]?.startsWith('依据：'))o.keepNext=true;
    }
    out.push(new Paragraph(o));
  }
  return out;
}
async function build(stem,kind){
  const raw=fs.readFileSync(path.join(root,stem+'.md'),'utf8');
  const doc=new Document({creator:'Codex',title:'第二讲 宪法的发展 '+kind,subject:'宪法学 第二讲',
    styles:{default:{document:{run:{font,size:kind==='学生史料与问题'?23:24,color:ink},paragraph:{spacing:{after:90,line:315},widowControl:true}}},
      paragraphStyles:[
        {id:'Title',name:'Title',basedOn:'Normal',next:'Normal',run:{font:{eastAsia:'黑体',ascii:'Arial',hAnsi:'Arial'},size:36,bold:true,color:ink},paragraph:{spacing:{before:0,after:180},keepNext:true}},
        {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:{eastAsia:'黑体',ascii:'Arial',hAnsi:'Arial'},size:28,bold:true,color:ink},paragraph:{spacing:{before:140,after:110},keepNext:true,outlineLevel:0}},
        {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:{eastAsia:'黑体',ascii:'Arial',hAnsi:'Arial'},size:24,bold:true,color:ink},paragraph:{spacing:{before:110,after:65},keepNext:true,outlineLevel:1}},
        {id:'TeacherNote',name:'Teacher Note',basedOn:'Normal',next:'Normal',run:{font,size:20,color:'444444'},paragraph:{spacing:{after:70,line:270}}}
      ]},
    sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1000,bottom:1000,left:1134,right:1134,header:350,footer:420}}},
      footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'宪法的发展　'+kind+'　',size:18}),new TextRun({children:[PageNumber.CURRENT],size:18})]})]})},
      children:content(raw,kind)}]});
  const target=path.join(root,stem+'.docx');
  fs.writeFileSync(target,await Packer.toBuffer(doc));
  return {markdown:stem+'.md',sha256:crypto.createHash('sha256').update(raw).digest('hex'),docx:stem+'.docx',characters:raw.length,hanCharacters:(raw.match(/\p{Script=Han}/gu)||[]).length};
}
(async()=>{
  const items=[['01_完整讲述','完整讲述'],['02_学生史料与问题','学生史料与问题'],['03_逐题讲评','逐题讲评']];
  const selected=process.argv.slice(2);
  const manifest=[];
  for(const item of items)if(!selected.length||selected.includes(item[0]))manifest.push(await build(...item));
  fs.writeFileSync(path.join(root,'文档生成版本.json'),JSON.stringify({createdAt:new Date().toISOString(),files:manifest},null,2));
  console.log(JSON.stringify(manifest,null,2));
})().catch(e=>{console.error(e);process.exit(1);});
