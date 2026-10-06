'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=__dirname, data=JSON.parse(fs.readFileSync(path.join(root,'课程内容.json'),'utf8'));
const file=path.join(root,'01_完整讲稿.md');
const blocks=[],activities=[];
const times={
  '02':[45,45,60],'03':[75,75,105],'07':[75,75,105],'12':[105,90,105],'13':[30,10,45],'15':[75,75,105],
  '17':[45,45,60],'18':[45,45,60],'19':[90,90,120],'20':[75,75,105],'22':[90,90,120],'23':[20,5,30],
  '24':[60,60,75],'25':[180,165,210],'26':[60,20,90],'27':[40,40,50],'28':[120,105,150],'29':[45,15,60]
};
for(const p of data.pages.filter(p=>!p.optional)){
  const id='M'+Number(p.id), section=p.half===1?'upper':'lower';
  blocks.push({id,section,kind:'main',source_heading:`第${Number(p.id)}页 ${p.title}`,speech_subheading:'讲述'});
  const aa=p.steps.filter(s=>s.kind==='activity');
  const sec=Math.round(aa.reduce((n,s)=>n+s.minutes*60,0));
  if(sec){const t=times[p.id]||[sec,sec,sec];activities.push({id:'A_'+id,block:id,seconds:{plan:t[0],short:t[1],slow:t[2]},overlaps_speech:false,includes_teacher_feedback:false,description:aa.map(s=>s.text).join('；'),scenario_reasons:{plan:'按实际主稿独立阅读/作答/回应时间',short:t[1]===t[0]?'保留必要读写，不因回答简短删除':p.id==='26'?'两名回应由60秒缩至20秒；第12条已在第24页独立阅读，不双计':p.id==='12'||p.id==='25'||p.id==='28'?'同桌交换比计划简短15秒，独立书写不减':'只缩短学生回应，不删独立判断和教师讲评',slow:t[2]===t[0]?'本项按计划不变':'本项条文查读、理由书写或学生表述多用时间，具体增量见秒数；教师讲评仍计入口述'}});}
}
for(const [id,ids,half,title,after] of [['E1',[32,33],'upper','宪法是否只有抽象原则','M14'],['E2',[34,35],'lower','有规范为什么还要看办理','M30'],['E3',[36],'upper','最高国家权力机关也受约束吗','M14'],['E4',[37],'lower','履行赔偿以后仍有什么问题','M30']]){
  blocks.push({id,section:half,kind:'extension',source_heading:`深化${id} ${title}`,speech_subheading:'讲述',insert_after:after});
  const pp=data.pages.filter(p=>ids.includes(Number(p.id))), sec=Math.round(pp.reduce((n,p)=>n+p.steps.filter(s=>s.kind==='activity').reduce((n,s)=>n+s.minutes*60,0),0));
  activities.push({id:'A_'+id,block:id,seconds:{plan:sec,short:sec-(ids.length===2?20:0),slow:sec+15},overlaps_speech:false,includes_teacher_feedback:false,description:pp.flatMap(p=>p.steps.filter(s=>s.kind==='activity').map(s=>s.text)).join('；'),scenario_reasons:{plan:'按已写备用任务执行',short:ids.length===2?'独立作答1分钟保留；学生回应30秒改10秒':'必要独立作答不缩减',slow:'独立条文查读或书写多15秒，教师讲评不另加'}});
}
for(const p of data.pages.filter(p=>p.shortVersion)){const v=p.shortVersion;blocks.push({id:v.id,section:p.half===1?'upper':'lower',kind:'replacement',source_heading:`短讲${v.id} ${v.title}`,speech_subheading:'讲述',replaces:'M'+Number(p.id)});}
const selectionFile=path.join(root,'节内路径选择.json');
const selections=fs.existsSync(selectionFile)?((j)=>j.selections||j.candidate_selections||j)(JSON.parse(fs.readFileSync(selectionFile,'utf8'))):Object.fromEntries(['upper','lower'].map(h=>[h,Object.fromEntries([140,150,180,200,220].map(s=>[s,['main','main','main']]))]));
const out={schema_version:1,supporting_sources:['04_双45分钟教学安排.md'],lesson:'第一讲 宪法总论',source:'01_完整讲稿.md',source_sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),selection_extraction:'指定二级标题内全部三级讲述正文；不计活动、教师备查、章节标题或来源。',speeds:[140,150,180,200,220],scenario_order:['plan','short','slow'],section_minutes:45,reference_speed:180,blocks,activities,selections,notes:['主线M1—M16为上节、M17—M31为下节；每个M只在所属节计一次。','C替换对应页全部口述，原独立活动保留；先完成阅读再讲短版。E1在第14页讲完之后、任务2之前调用，不在下课后追加。','默认翻页与口述重叠，不额外机械增加每页几秒；机动不计为教学内容。','同页完整讲评已计入口述，不再以反馈时间另加。全部速度与活动时间是备课假设，非教师或学生实测。']};
fs.writeFileSync(path.join(root,'容量输入.json'),JSON.stringify(out,null,2)+'\n');
