'use strict';

// 沿用现有内容处理入口，只校准顺序、实际页号和稳定内容定位。
// 阶段B实质文字均在编写内容.js维护，不再由此追加第二份讲稿或E/C路由。
module.exports=function prepare(pages) {
  for(let i=0;i<pages.length;i++) {
    const p=pages[i];
    p.legacyId=p.legacyId||Number(p.id);
    p.actualPage=i+1;
    p.id=String(i+1).padStart(2,'0');
    p.steps.forEach((s,j)=>{s.id=`legacy${p.legacyId}-${s.kind==='speech'?'s':'a'}${j+1}`;});
    if(p.legacyId===31)p.unitStart='八 整讲回收与第二讲接口';
  }
  return pages;
};
