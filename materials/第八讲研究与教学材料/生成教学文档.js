const fs = require('fs');
const path = require('path');
const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,BorderStyle,ShadingType,HeadingLevel,AlignmentType,LevelFormat,Footer,PageNumber,PageBreak} = require('C:/Users/tsunami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/docx');

const root = __dirname;
const FONT = 'Microsoft YaHei';
const WIDTH = 9426;
let BODY_SIZE=22, BODY_LINE=305, BODY_AFTER=90;

function clean(s){return s.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*/g,'').replace(/`/g,'').trim();}
function runs(s,size=22,bold=false){return [new TextRun({text:clean(s),font:FONT,size,bold,color:'233541'})];}
function paragraph(s,extra={}){return new Paragraph({children:runs(s,extra.size||BODY_SIZE,!!extra.bold),spacing:{after:BODY_AFTER,line:BODY_LINE},widowControl:true,...extra});}

function makeTable(rows,isStudent){
  const count=rows[0].length;
  let widths=count===2?[2450,WIDTH-2450]:count===3?[2100,3650,WIDTH-5750]:count===4?[1800,2700,2700,WIDTH-7200]:Array.from({length:count},()=>Math.floor(WIDTH/count));
  if(isStudent&&count===2)widths=[2850,WIDTH-2850];
  if(isStudent&&count===3)widths=rows[0][0]==='材料'?[850,4250,WIDTH-5100]:[3500,2900,WIDTH-6400];
  if(!isStudent&&count===3&&rows[0][0]==='环节')widths=[1650,4250,WIDTH-5900];
  const b={style:BorderStyle.SINGLE,size:4,color:'CBD3D6'};
  return new Table({width:{size:WIDTH,type:WidthType.DXA},columnWidths:widths,rows:rows.map((cells,i)=>new TableRow({cantSplit:true,tableHeader:i===0,children:cells.map((v,j)=>{
    const children=[new Paragraph({children:runs(v,20,i===0),spacing:{after:25,line:280},widowControl:true,keepNext:i<rows.length-1})];
    if(isStudent&&i>0&&j===1&&cells[0].includes('审查理由'))children.push(new Paragraph({children:runs('____________________________________________',20),spacing:{before:170,after:25,line:280}}));
    return new TableCell({width:{size:widths[j],type:WidthType.DXA},borders:{top:b,bottom:b,left:b,right:b},margins:{top:isStudent?110:90,bottom:isStudent?110:90,left:110,right:110},shading:i===0?{type:ShadingType.CLEAR,fill:'E9EEEC'}:undefined,children});
  })}))});
}

async function build(name,rawText=null,subdir=''){
  const isStudent=name.startsWith('04_');
  BODY_SIZE=(isStudent||name.startsWith('05_'))?21:22;BODY_LINE=290;BODY_AFTER=80;
  const lines=(rawText===null?fs.readFileSync(path.join(root,name+'.md'),'utf8'):rawText).split(/\r?\n/);
  const children=[];
  const numberings=[{reference:'bullet',levels:[{level:0,format:LevelFormat.BULLET,text:'•',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:400,hanging:200}}}}]}];
  let group=0,inList=false,pendingBreak=false;
  for(let i=0;i<lines.length;i++){
    const s=lines[i].trim();
    if(!s){continue;}
    if(s==='<!-- PAGEBREAK -->'){pendingBreak=true;inList=false;continue;}
    if(s.startsWith('|')){
      const rows=[];
      while(i<lines.length&&lines[i].trim().startsWith('|')){
        const row=lines[i].trim().split('|').slice(1,-1).map(t=>t.trim());
        if(!row.every(t=>/^:?-{2,}:?$/.test(t)))rows.push(row);
        i++;
      }
      i--;
      children.push(makeTable(rows,isStudent));children.push(paragraph('',{spacing:{after:70,line:120}}));inList=false;continue;
    }
    if(s.startsWith('# ')){children.push(paragraph(s.slice(2),{heading:HeadingLevel.TITLE,size:34,bold:true,keepNext:true,pageBreakBefore:pendingBreak,spacing:{after:190,line:380}}));pendingBreak=false;inList=false;continue;}
    if(s.startsWith('## ')){
      const force=name.startsWith('05_')&&s.startsWith('## 五、');
      children.push(paragraph(s.slice(3),{heading:HeadingLevel.HEADING_1,size:28,bold:true,keepNext:true,pageBreakBefore:pendingBreak||force,spacing:{before:130,after:105,line:330}}));pendingBreak=false;inList=false;continue;
    }
    if(s.startsWith('### ')){children.push(paragraph(s.slice(4),{heading:HeadingLevel.HEADING_2,size:24,bold:true,keepNext:true,spacing:{before:110,after:90,line:320}}));inList=false;continue;}
    if(s.startsWith('>')){
      if(s.length>1)children.push(paragraph(s.slice(1).trim(),{indent:{left:180,right:150},shading:{type:ShadingType.CLEAR,fill:'F2F5F3'},spacing:{after:100,line:320}}));
      inList=false;continue;
    }
    if(/^\d+\.\s/.test(s)){
      if(!inList){group++;numberings.push({reference:'numbers'+group,levels:[{level:0,format:LevelFormat.DECIMAL,text:'%1.',start:Number(s.match(/^(\d+)\./)[1]),alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:440,hanging:240}}}}]});}
      children.push(paragraph(s.replace(/^\d+\.\s/,''),{numbering:{reference:'numbers'+group,level:0}}));inList=true;continue;
    }
    if(s.startsWith('- ')){children.push(paragraph(s.slice(2),{numbering:{reference:'bullet',level:0}}));inList=false;continue;}
    children.push(paragraph(s));inList=false;
  }
  const doc=new Document({creator:'宪法学课程教学组',title:clean(lines[0].replace(/^# /,'')),numbering:{config:numberings},styles:{default:{document:{run:{font:FONT,size:BODY_SIZE,color:'233541'},paragraph:{spacing:{line:BODY_LINE}}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:900,bottom:900,left:1240,right:1240}}},children,footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'宪法学 · 第八讲　',font:FONT,size:17,color:'5B6871'}),new TextRun({children:[PageNumber.CURRENT],font:FONT,size:17,color:'5B6871'}),new TextRun({text:' / ',font:FONT,size:17,color:'5B6871'}),new TextRun({children:[PageNumber.TOTAL_PAGES],font:FONT,size:17,color:'5B6871'})]})]})}}]});
  const output=path.join(root,subdir,name+'.docx');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,await Packer.toBuffer(doc));console.log(output);
}
(async()=>{
  for(const f of ['03_第8讲教学设计','04_学生课堂材料','05_教师讲评与参考答案'])await build(f);
  const student=fs.readFileSync(path.join(root,'04_学生课堂材料.md'),'utf8');
  const cards=[['甲','问题'],['乙','审查理由'],['丙','处理结果']];
  for(const [mark,label] of cards){
    const begin=student.indexOf('## 材料三'+mark);
    if(begin<0)throw new Error('找不到案例'+mark);
    let end=student.indexOf('<!-- PAGEBREAK -->',begin);
    if(end<0)end=student.length;
    if(mark==='丙'){const flow=student.indexOf('## 制度卡',begin);if(flow>=0)end=flow;}
    const body=student.slice(begin,end).replace(/^## /,'# ');
    await build('04_案例'+mark+'_'+label,body,'分发卡');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
