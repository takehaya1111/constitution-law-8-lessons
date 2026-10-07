'use strict';
// 当前连续单元和实际活动，不复用旧逐页秒数或E/C课堂路线。
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=__dirname,data=JSON.parse(fs.readFileSync(path.join(root,'课程内容.json'),'utf8'));
const file=path.join(root,'01_完整讲稿.md');
if(!Array.isArray(data.units)||!data.units.length)throw new Error('缺少当前连续单元');
const blocks=data.units.map(u=>({id:u.id,section:u.half===1?'upper':'lower',kind:'main',source_heading:u.sourceHeading,speech_subheading:'讲述'}));
const activities=[];
for(const u of data.units)for(const id of u.pageIds){
  const p=data.pages.find(p=>p.id===id);
  for(const [index,s] of p.steps.entries()){
    if(s.kind!=='activity')continue;
    activities.push({id:`A_${u.id}_${index}`,block:u.id,seconds:{plan:Math.round((s.scenarios?.normal??s.minutes)*60),short:Math.round((s.scenarios?.fast??s.minutes)*60),slow:Math.round((s.scenarios?.slow??s.minutes)*60)},overlaps_speech:false,includes_teacher_feedback:false,description:s.text,scenario_reasons:{plan:'实际查读和组织解释80秒、一次回应最多40秒；教师回收在口述。',short:'保留80秒查读/组织，只将学生回应40秒缩至10秒。',slow:'查读或组织理由增加30秒，回应不预设热烈；教师讲评不另计。'}});
  }
}
for(const b of data.reserveDefs.filter(b=>b.kind==='extension'))blocks.push({id:b.id,section:b.half===1?'upper':'lower',kind:'extension',source_heading:b.sourceHeading,speech_subheading:'备查讲述',insert_after:b.insert_after});
for(const a of data.adjustments||[])blocks.push({id:a.id,section:a.half===1?'upper':'lower',kind:'replacement',source_heading:a.sourceHeading,speech_subheading:'备查讲述',replaces:a.replaces});
const selections=Object.fromEntries(['upper','lower'].map(h=>[h,Object.fromEntries([140,150,180,200,220].map(s=>[s,['main','main','main']]))]));
// 仅作后台比较：默认原始main总在报告先列；课堂不是这张30格试算表。
for(const h of ['upper','lower'])for(const speed of [140,150,200,220]){
  const choice=speed<180?(h==='upper'?'S1':'S2'):(h==='upper'?'B3':'B4');
  if(blocks.some(b=>b.id===choice))selections[h][speed]=[choice,choice,choice];
}
const out={schema_version:1,lesson:'第一讲 宪法总论',source:'01_完整讲稿.md',source_sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),supporting_sources:['04_双45分钟教学安排.md'],selection_extraction:'八个连续单元内全部三级讲述；独立翻页提示、活动、来源和未选备查不计口述。',speeds:[140,150,180,200,220],scenario_order:['plan','short','slow'],section_minutes:45,reference_speed:180,blocks,activities,selections,notes:['默认主线一条，先算main；不把调整后的结果冒称默认主线。','上下节各一处独立解释；原文随讲带读已入口述，不另机械计读文或翻页。','B3/B4为完整就近深化，B1门槛模型/B2权限任务主要备查，不纳入默认容量。','少量缩讲如使用，替换对应单元口述并保留独立活动；长短互斥。','语速和活动是敏感性假设，180非教师实测；空缺及超时照实保留。']};
fs.writeFileSync(path.join(root,'容量输入.json'),JSON.stringify(out,null,2)+'\n','utf8');
console.log('已从8个连续单元生成容量输入；默认main，不读取旧节内路径选择.json。');
