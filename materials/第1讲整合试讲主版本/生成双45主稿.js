'use strict';
const fs=require('fs');
const path=require('path');
module.exports=function generate(pages,root) {
  require('./双45论证修订.js')(pages);
  const han=t=>(t.match(/[\u4e00-\u9fff〇]/g)||[]).length;
  const stats=p=>({han:p.steps.filter(s=>s.kind==='speech').reduce((n,s)=>n+han(s.text),0),activity:p.steps.filter(s=>s.kind==='activity').reduce((n,s)=>n+s.minutes,0)});
  for(const p of pages)if(!p.optional)p.minutes=Number((stats(p).han/180+stats(p).activity).toFixed(4));
  const halves=[1,2].map(half=>({half,coreMinutes:45,referenceMinutes:pages.filter(p=>p.half===half).reduce((a,p)=>a+p.minutes,0)}));
  const data={title:'第一讲 宪法总论',subtitle:'国家的制度与个人的权利',baseline:'5a7f68311dc1ee7775474d22c3c8edd7ee986b94',version:'整合试讲主版本｜20261006双45实质升级',timePlan:{coreMinutes:90,halves,note:'每节45分钟；逐页时间为180汉字/分钟、不计重叠切换的初步定位，精确口读校正与活动情景以容量报告为准。无真人计时。'},pages};
  fs.writeFileSync(path.join(root,'课程内容.json'),JSON.stringify(data,null,2)+'\n','utf8');
  let md='# 第一讲 宪法总论\n\n## 双45分钟整合主稿\n\n面向公安专业一年级。一次课一份主稿和一份PPT，内部上、下两节各45分钟，课间另计。正文按真实口述和独立活动排列，教师备查不朗读。第1—16页用于上节，第17—31页用于下节；32—37页默认隐藏，仅按本节进度调用，38页为来源。不存在额外增加课时的选项。\n\n以下定位每节从0起，按180汉字/分钟及计划活动粗列，数字口头读法校正、多语速与活动情景、短讲/深化选用，见[当前容量报告](07_双45分钟容量报告.md)。定位不是实测时长，机动空白不计为教学内容。主线先保证完整解释，教师在检查点选择已经写实的局部调整，不临场补写论证。\n\n';
  let elapsed=0,half=0;
  const round=n=>Number(n.toFixed(1));
  for(const p of pages){
    if(p.optional)continue;
    if(p.half&&p.half!==half){half=p.half;elapsed=0;md+=`## ${half===1?'上节 国家根本规则与权力运行':'下节 宪法要求怎样进入赔偿制度'}\n\n本节0—45分钟，课间不计入；主线在第${half===1?'16':'31'}页收束。\n\n`;}
    const range=p.optional?'节内备查，不自动进入主线':`本节约${round(elapsed)}—${round(elapsed+p.minutes)}分钟`;
    md+=`## 第${Number(p.id)}页 ${p.title}\n\n${p.section}｜${range}\n\n`;
    if(!p.optional)elapsed+=p.minutes;
    for(const s of p.steps)md+=s.kind==='speech'?`### 讲述\n\n${s.text}\n\n`:`### 活动与停留 不朗读\n\n${s.text}（计划约${Math.round(s.minutes*60)}秒，独立于口述。）\n\n`;
    if(p.teacherNotes?.length)md+='### 教师备查 不朗读\n\n'+p.teacherNotes.map(t=>'- '+t).join('\n')+'\n\n';
    md+='### 来源 不朗读\n\n依据：'+p.source+'。\n\n';
  }
  for(const [id,ids,title] of [['E1',[32,33],'宪法是否只有抽象原则'],['E2',[34,35],'有规范为什么还要看办理'],['E3',[36],'最高国家权力机关也受约束吗'],['E4',[37],'履行赔偿以后仍有什么问题']]){
    md+=`## 深化${id} ${title}\n\n节内备用，对应PPT第${ids.join('、')}页。按本节容量报告调用，不追加课时；设问、活动、讲评照下面顺序进行。\n\n`;
    for(const idp of ids){const p=pages.find(p=>Number(p.id)===idp);for(const s of p.steps)md+=s.kind==='speech'?`### 讲述\n\n${s.text}\n\n`:`### 活动与停留 不朗读\n\n${s.text}（计划约${Math.round(s.minutes*60)}秒，独立于口述。）\n\n`;}
  }
  md+='## 教师节内调整的使用办法\n\n主线、短讲和深化不得全部相加。短讲替换指定页的全部口述，原页独立阅读/回应仍保留；需要先读材料的页，先按原任务阅读，再连续讲短版。不能先念主版又念短版。第32—33页合称E1，在上节第14页后、任务2之前调用；第36页为E3，也在上节第14页后、任务2之前调用；同选E1与E3时先E1后E3。第34—35页合称E2、第37页为E4，均在下节第30页后、第31页收束前调用；同选时先E2后E4，再回第31页。E1/E2的两页与E3/E4的单页已有完整设问、独立作答和反馈，不能只记一个“讨论几分钟”。\n\n在上节第6页后和第13页后、下节第20页后和第26页后，核对已用时间与余下必要任务。按容量报告先选择相应速度/活动情景，再据真实困难调整。不能用本课总时间替上节透支，也不能为了照表而要求加速读完。极快或极慢情景若仍不能覆盖，报告保留风险；没有真人速度，不保证任何路径实讲恰好45分钟。\n\n';
  for(const p of pages.filter(p=>p.shortVersion)){
    const v=p.shortVersion;
    md+=`## 短讲${v.id} ${v.title}\n\n${v.instruction} 所属${p.half===1?'上':'下'}节，第${Number(p.id)}页；保留条文和必要理由，详列节内选择见容量报告。\n\n### 讲述\n\n${v.text}\n\n`;
  }
  fs.writeFileSync(path.join(root,'01_完整讲稿.md'),md.trimEnd()+'\n','utf8');
  const counts=pages.map(p=>({id:p.id,half:p.half,minutes:p.minutes,optional:!!p.optional,...stats(p)}));
  fs.writeFileSync(path.join(root,'用时核算.json'),JSON.stringify(counts,null,2)+'\n');
  console.log(JSON.stringify({pages:pages.length,halves,coreHan:counts.filter(p=>!p.optional).reduce((s,p)=>s+p.han,0)},null,2));
};
