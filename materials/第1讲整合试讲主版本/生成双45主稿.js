'use strict';
const fs=require('fs');
const path=require('path');
module.exports=function generate(pages,root) {
  require('./双45论证修订.js')(pages);
  const han=t=>(t.match(/[\u4e00-\u9fff〇]/g)||[]).length;
  const stats=p=>({han:p.steps.filter(s=>s.kind==='speech').reduce((n,s)=>n+han(s.text),0),activity:p.steps.filter(s=>s.kind==='activity').reduce((n,s)=>n+s.minutes,0)});
  const units=[];
  let unit;
  for(const p of pages.filter(p=>!p.optional)) {
    if(p.unitStart) {
      unit={id:'U'+(units.length+1),half:p.half,sourceHeading:p.unitStart,pageIds:[],legacyIds:[]};
      units.push(unit);
    }
    if(!unit||unit.half!==p.half)throw new Error('主线分节/单元缺失');
    unit.pageIds.push(p.id);unit.legacyIds.push(p.legacyId);p.unitId=unit.id;
    p.minutes=Number((stats(p).han/180+stats(p).activity).toFixed(4));
  }
  const halves=[1,2].map(half=>({half,coreMinutes:45,referenceMinutes:pages.filter(p=>p.half===half&&!p.optional).reduce((a,p)=>a+p.minutes,0)}));
  const reserveDefs=[{id:'B1',legacyId:15,kind:'reference',half:1,title:'特别门槛与全体一致模型'},
    {id:'B2',legacyId:28,kind:'reference',half:2,title:'目标与具体权限的资料缺口'},
    {id:'B3',legacyId:36,kind:'extension',half:1,title:'机关地位与规范效力',insert_after:'U2'},
    {id:'B4',legacyId:37,kind:'extension',half:2,title:'赔偿履行与此前侵害',insert_after:'U7'}];
  for(const b of reserveDefs) {
    const p=pages.find(p=>p.legacyId===b.legacyId);
    b.pageIds=[p.id];b.sourceHeading='备查'+b.id+' '+b.title;
  }
  const adjustments=[
    {id:'S1',half:1,replaces:'U3',sourceHeading:'缩讲S1 权力组织与原则的等义短讲',parts:[
      {pageId:'07',text:'请把第二条与第三条接起来读。第二条先说国家的一切权力属于人民，又规定人民行使国家权力的机关是全国人大和地方各级人大。第三条继续说明民主选举、负责和监督。这几层分别回答权力属于谁、通过什么机关行使、机关怎样形成及保持责任联系，不能用其中一句代替全部解释。\n\n图中向下箭头只表示产生或组织关系：人大由民主选举产生，相应行政、监察、审判、检察机关由人大产生。负责和监督看右侧文字：人大对人民负责、受人民监督，这些机关对产生它的人大负责、受该人大监督。箭头没有展开直接和间接选举，不能读成所有人大都由全体人民直接选举。\n\n这些机关有与人大的共同关系，不表示职权相同。具体哪个机关能作什么、谁领导谁、何种监督怎样进行，第七讲再展开。今天保住归属、组织和持续责任的联系，不把全部权力活动简化成逐层转交。\n\n民主集中制因此不只是记住集中两个字，还包括民主产生、负责监督和依法形成并执行国家决定的组织安排。第二条也保留人民依法通过各种途径和形式管理公共事务，不把人民参与缩成参加一次选举。'},
      {pageId:'08',text:'机关依法产生，为什么仍要依法履职？产生确认制度地位，每次行为则要说明职权、条件和依据。只回答机关是依法产生的，尚未证明某项决定正确。第三条在产生之后仍规定负责和监督，正使责任成为持续的制度关系。\n\n另一项关切必须认真对待：机关需要专业判断和及时行动。让没有相应职责的人重做所有决定，可能妨碍履职。但行动空间不等于免除责任，监督也不等于任何人都能取代机关。监督者同样须依法辨认自己的职权和方式，不能因监督目的正当便免去自身的权限要求。判断、责任与监督各有制度位置，才不至于在信任和任意替代之间二选一。应分别追问：谁依法判断，依据什么，向谁负责，由谁按什么权限监督。专业性说明为何由相应机关办事，不能单独证明每次行为都符合规范。\n\n负责也不是等某个人被怀疑品质不好才临时加上。机关持续承担任务，就持续处在宪法法律规定的责任关系中；换了任职者，法定责任不会随私人关系消失。具体说明和纠正程序仍由相关制度展开，不能从第三条推出一套适用所有机关的办法。\n\n教材用民主制度化、法律化解释宪法本质的一个重要方面：把人民当家作主组织为机关、产生方式和责任关系，再用法律确认这些安排。这样，权力属于人民不仅回答来源，还能继续追问通过什么制度、对谁负责。这是本质的必要入口，教材还有其他论述。'},
      {pageId:'09',text:'接着把党的领导与社会主义法治放在一起。第一条确认中国共产党领导的宪法地位，第五条又规定各政党、国家机关等必须遵守宪法和法律。两条在同一宪法中共同成立，理解其中一项不能删去另一项。\n\n教材把党的领导同领导立法、保证执法、支持司法、带头守法以及在宪法法律范围内活动联系起来，是为了说明领导怎样进入制度运行。社会主义法治也不是事后为已做的事找一句解释，而是使规则进入职权行使和责任承担。这一层建立共同要求，具体措施是否合法仍须具体依据。'},
      {pageId:'10',text:'第三十三条第三款规定，国家尊重和保障人权。尊重提示国家不能任意侵害，保障又要求国家通过制度和依法履职保护权利。它适用于组织权力、制定规则和具体办事，不因句子短就只是一种态度。\n\n这里分清权力与权利：权力涉及公共事务的组织和职权行使，权利涉及依法应当保障的利益和请求资格。机关有职权，不等于手段无限；人有权利，也不意味着每项主张无须条件。保障可能需要国家积极做事，但具体职权仍应有根据。下节赔偿只是其中一种救济，第五讲再系统展开权利原理。\n\n人的实际处境因此不是条文以外的闲话。能否依法提出请求、机关怎样取得必要事实、侵害发生后怎样回应，都是理解保障的入口。国家积极工作与受权利要求约束，并不是只能保留一个。'},
      {pageId:'11',text:'现在可以归纳教材的五项原则：党的领导、人民主权、社会主义法治、尊重和保障人权、权力监督与制约。它们针对同一国家活动的不同方面：在怎样的根本制度下进行，权力怎样形成，遵循什么规范，对人的权利承担什么义务，由谁依法监督。\n\n例如，一个机关由人大产生，提供了制度位置；负责和监督使它不能把位置变成不受过问的理由；人权要求又使我们不只看它办成多少事，还看怎样影响人的权利。这些要求不是依次自动发生的流水线，各有根据，也彼此相连。只讲产生会漏责任，只讲目标会漏权限；原则帮助我们补齐解释，不能替没有依据的结论增添气势。'},
      {pageId:'12',before:'现在用第二、三、三十三条中至少两处，写一两句说明：机关依法产生，为什么仍须负责、受监督并尊重保障权利？关键是说联系，不只列原则名称。',after:'一种有根据的解释是：权力属于人民，通过宪法规定的机关行使；机关由相应制度产生，同时持续承担负责、监督和人权要求。产生说明地位，不能独自证明每项行为正确。也可以从第三条与第三十三条讲起，只要根据和关系完整，不要求同一句式。'}
    ]},
    {id:'S2',half:2,replaces:'U6',sourceHeading:'缩讲S2 信息要求与办理方式的等义短讲',parts:[
      {pageId:'21',text:'刚才一直在读普通法律，宪法还在哪里？第四十一条已确认相应赔偿权，第五条要求普通法律不得抵触宪法。国家赔偿法进一步增加情形、义务机关和提出途径。需要这些安排，不表示宪法此前无效；已有最高效力，也不表示个案细节都已写完。\n\n依照法律规定，给具体制度留下工作，不能让立法者任意排除宪法要求。安排是否抵触，仍须看完整内容和适用条件，不能只凭课堂感受宣布法律失效。\n\n现在看办理所需的信息。甲的行政职权、违法拘留和自由侵害是原题给定的；实际办理必须依法核实，不能从设例取得事实。第十二条规定，要求赔偿应当递交申请书，申请书应当载明有关事项，其中包括具体的要求、事实根据和理由。它使机关知道请求什么、根据什么，不靠猜测作判断。\n\n信息要求有助于区分应当保障的请求，却不能仅凭这一用途就证明每种取得信息的办法都不可改变。需要信息与需要唯一形式，是下一步要分开的判断。'},
      {pageId:'22',text:'同一条第二款继续规定：赔偿请求人书写申请书确有困难的，可以委托他人代书；也可以口头申请，由赔偿义务机关记入笔录。书写确有困难是条件，口头申请之后还有记入笔录，不是取消全部信息要求。\n\n书面形式便于固定请求和事实理由，但这种用途不能直接证明必须由本人亲笔完成。一个人写不出申请书，不等于没有事实，更不等于没有法定请求。把书写能力代替内容判断，便混淆了表达障碍与请求是否成立。\n\n现在明确增加一个教学条件：甲书写申请书确有困难，原题其他条件不变。有人认为必须本人写，才能保证信息可靠。需要可靠信息的理由成立，但本人动笔也不独自证明事实真实；代书或口头申请形成记录之后，也仍须依法核实。这项关切需要比较取得信息的办法，不能直接推出唯一形式。\n\n代书改变文字由谁写，口头申请加笔录改变信息取得和记录的方式，仍保留依法判断所需内容。比较制度时可以问：要求与核实任务有什么关联；是否有仍完成任务的可行替代；对提出请求的机会有什么影响。这里的信息有必要，亲笔唯一却不能从该必要性直接推出；法律给出的替代减少形式障碍，未替代实体判断。\n\n这是对实际材料的课堂分析，不是正式合宪性审查模型。也不能把本条扩大为所有领域都可无条件口头办理，更不能编造当年存在两派争论。'},
      {pageId:'23',before:'甲书写确有困难，机关需要可靠的信息。有人因此认为必须甲本人写，才能保证信息可靠。请用第十二条解释：这个理由是否足以证明本人书写是唯一方式？代书或口头申请加笔录保留什么、改变什么，又未证明哪一种后续结果？',after:'可以这样解释：仍须有具体的要求、事实根据和理由；书写确有困难时可以代书，也可口头申请，由机关记入笔录。可靠信息的需要不能直接证明必须本人写，本人动笔也不独自证明事实真实。法定替代仍保留记录和核实所需内容，使请求有机会依法办理。\n\n原题给定的违法行政拘留和自由侵害，继续支持甲有赔偿权、相应机关负义务的有限结论；书写困难支持本次方式比较，不能替代具体金额、其他主张和实际履行结果的根据。只说兼顾双方，尚未指向实际办法；只说口头就行，漏了困难条件和记录；只说仍需事实，又没回答障碍怎样处理。\n\n一项方式回应了具体困难，不能独自证明全法合宪或所有请求已获救济。普通法律在宪法要求下形成制度，机关仍须依法核实并履行义务。这使我们继续追问：法律已经规定，实际实施仍需要哪些工作？'}
    ]}
  ];
  for(const a of adjustments){
    a.text=a.parts.map(p=>p.text||p.before+'\n\n'+p.after).join('\n\n');
    pages.find(p=>p.id===a.parts[0].pageId).unitAdjustment={id:a.id,title:a.sourceHeading,instruction:'仅在本单元开始前采用，替换该单元完整口述，保留原2分钟解释机会；其余单元不变，长短不重复。',text:a.text};
  }
  const data={title:'第一讲 宪法总论',subtitle:'国家的制度与个人的权利',baseline:'15a6e71e4da32cf0035f59f46b527765a3aa7275',version:'整合试讲主版本｜20261007第一讲单讲局部打磨',
    timePlan:{coreMinutes:90,halves,note:'每节45分钟，课间另计。默认主线为一条顺讲，纯汉字/180及活动为定位参照；最终口读校正及三活动情景见重新运行的容量报告，无真人计时。'},units,reserveDefs,adjustments,pages};
  fs.writeFileSync(path.join(root,'课程内容.json'),JSON.stringify(data,null,2)+'\n','utf8');
  let md='# 第一讲 宪法总论\n\n## 双45分钟整合主稿\n\n面向公安专业一年级。一次课一份主稿、一份主PPT，上下两节各45分钟，课间另计。以下为一条默认顺讲主线；需要翻页时才出现实际PPT页号与短标题。翻页提示、活动说明、来源与教师备查不朗读。文档物理页不同于PPT页号。\n\n默认P1—P14用于上节，P15—P26用于下节；P27—P30为隐藏备查，P31为来源页。末尾备查没有自动进入课堂；不运行旧E/C整组路线。每节用最终口述与独立活动分别复算，见[当前容量报告](07_双45分钟容量报告.md)。语速及活动时间为假设，非真人试讲或学习效果证明。\n\n';
  let half=0;
  for(const u of units) {
    if(u.half!==half){half=u.half;md+=`## ${half===1?'上节 国家根本安排与权力运行':'下节 宪法要求怎样进入一项赔偿请求'}\n\n本节0—45分钟；本节收束后再进入课间或下课，不以全讲合计抵消单节透支。\n\n`;}
    md+=`## ${u.sourceHeading}\n\n`;
    for(const id of u.pageIds) {
      const p=pages.find(p=>p.id===id);
      md+=`### 翻页提示 不朗读\n\n【翻至P${String(p.actualPage).padStart(2,'0')}｜${p.title}】\n\n`;
      let speech=[];
      const flush=()=>{if(speech.length){md+='### 讲述\n\n'+speech.join('\n\n')+'\n\n';speech=[];}};
      for(const s of p.steps) {
        if(s.kind==='speech')speech.push(s.text);
        else{flush();md+='### 活动与停留 不朗读\n\n'+s.text+`（计划约${Math.round(s.minutes*60)}秒，独立于教师口述。）\n\n`;}
      }
      flush();
    }
  }
  md+='## 教师就近调节与备查用法 不朗读\n\n默认主稿已经写完整，教师顺讲即可。慢讲需要压缩时，可在第三单元开始前采用S1，或者在第六单元开始前采用S2，替换对应单元的全部口述；实际页面和原2分钟解释机会保留，其余单元不变。不要跳过第12条原文或把根据改成一句态度。快讲确有余量且出现对应疑问，可在共同约束段之后深化机关地位与规范效力（B3），或在1994实施段之后、整讲回收前深化赔偿履行与此前侵害（B4）。这些完整文字如下，不与默认主稿自动相加，也不在课后追加。门槛长模型B1、目的权限整题B2主要供备查，未计为默认容量。更多语速下是否有空缺或超时，以报告原始结果为准；不保证一套调节覆盖一切速度。\n\n';
  for(const b of reserveDefs) {
    const p=pages.find(p=>p.legacyId===b.legacyId);
    md+=`## ${b.sourceHeading}\n\n${b.kind==='extension'?'可就近深化，所属'+(b.half===1?'上':'下')+'节；使用前核本节余量。':'主要供备查，默认不讲，不借其恢复独立任务链。'}\n\n### 翻页提示 不朗读\n\n【翻至P${String(p.actualPage).padStart(2,'0')}｜${p.title}】\n\n### 备查讲述\n\n`+p.steps.filter(s=>s.kind==='speech').map(s=>s.text).join('\n\n')+'\n\n';
  }
  for(const a of adjustments){
    md+=`## ${a.sourceHeading}\n\n主要在本单元开始前按实际进度选用；替换${a.replaces}的全部口述，原解释机会2分钟保留，不再朗读被替换长稿。\n\n`;
    for(const part of a.parts){
      const p=pages.find(p=>p.id===part.pageId);
      md+=`### 翻页提示 不朗读\n\n【翻至P${p.id}｜${p.title}】\n\n### 备查讲述\n\n${part.text||part.before}\n\n`;
      if(part.after)md+=`### 活动与停留 不朗读\n\n保留本单元原解释机会2分钟；教师回收不另计。\n\n### 备查讲述\n\n${part.after}\n\n`;
    }
  }
  md+='## 来源与教师备注 不朗读\n\n下列按实际PPT页号列出旧版本定位、依据和必要条件，教师查读，不进入默认口述。\n\n';
  for(const p of pages) {
    md+=`### P${String(p.actualPage).padStart(2,'0')} ${p.title}\n\n旧38页版位置：${p.legacyId}。依据：${p.source}。\n\n`;
    if(p.teacherNotes?.length)md+=p.teacherNotes.map(t=>'- '+t).join('\n')+'\n\n';
  }
  fs.writeFileSync(path.join(root,'01_完整讲稿.md'),md.trimEnd()+'\n','utf8');
  const counts=pages.map(p=>({id:p.id,actualPage:p.actualPage,legacyId:p.legacyId,unitId:p.unitId,half:p.half,minutes:p.minutes,optional:!!p.optional,...stats(p)}));
  fs.writeFileSync(path.join(root,'用时核算.json'),JSON.stringify(counts,null,2)+'\n');
  console.log(JSON.stringify({pages:pages.length,corePages:pages.filter(p=>!p.optional).length,units,halves,coreHan:counts.filter(p=>!p.optional).reduce((s,p)=>s+p.han,0)},null,2));
};
