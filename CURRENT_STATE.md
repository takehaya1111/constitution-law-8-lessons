# 当前状态：第一讲完整口播组稿流水线试运行，待教师审阅

更新：2026-10-09。教师在此前交接准备后明确提出“开始组稿第一讲测试一下”。本轮据此从既有认可大纲运行`classroom-oral-workflow v0.1.1`，**不是继续只改小样段，也不包含PPT/Word/PDF制作**。

## 当前实际任务

```yaml
active_task_id: ORAL-LECTURE1-001
active_work_order: handoff/口播工作单_ORAL-LECTURE1-001.md
output: materials/第1讲整合试讲主版本/第一讲_流水线完整组稿试运行_待教师审阅.md
mode: full_lesson_pipeline_test
status: AWAITING_TEACHER_REVIEW
last_completed_stage: S5_AUTHOR_SELF_CHECK
next_stage: S6_TEACHER_REVIEW
independent_codex_review: NOT_RUN
teacher_review: PENDING
```

先读[本次真实工作单](handoff/口播工作单_ORAL-LECTURE1-001.md)，其中已有S0—S5实际输入、选材、编排、来源核查范围和返修原则，不要重新开一个空工作单。

**[第一讲上下节完整口播候选稿](materials/第1讲整合试讲主版本/第一讲_流水线完整组稿试运行_待教师审阅.md)** 已写入GitHub。按照原七项大纲与两个45分钟分节编为12个讲述小节。本轮保留已认可的豆选原段，引用原完整稿的有效知识，增写1954年草案公开讨论过程，将赔偿申请口播去赘述，并把孙志刚案安排在普通法律/行政法规及规范权限关系的教学位置。**旧主稿仍保留，不受这一轮覆盖。**

S5主笔自检：脚注定义配对，豆选认可段保持原文，历史与现行法区分、新闻与法院认定区别和法条主体初审；文本粗计上节约7550汉字、下节约7403汉字，计划独立阅读150/180秒，按180字/分钟分别约44.44/44.13分钟（非实测速率；其他语速风险见工作单）。**尚未获教师对整讲口吻、内容、时间的认可，也未进行独立Codex核稿**。

## 为什么这次没有从旧任务S4继续

此前[ORAL-HANDOFF-001](handoff/口播工作单_ORAL-HANDOFF-001.md)是为跨对话恢复而刻意停在S3的孙志刚局部修订任务。用户本次明确转向“组稿第一讲测试”，范围较大、目标不同，因此建立`ORAL-LECTURE1-001`作为**当前任务**，保留原交接工作单与历史提交。旧任务的冷启动测试没有在新会话真正完成，**不得声称它已通过**；原件中的旧段、D1—D4与来源判断已经按需复用于本轮新组稿，未据此虚构旧任务独立验收。

## 下一步与权限

下一步只需教师查看本次完整候选稿并反馈：哪里仍太书面、故事选材是否合适、知识是否讲透、上下节怎样调整。得到具体意见后，从对应S1—S5失效岗定点处理，不重新组建Skill、不连带制作其他讲次或配套。

大纲与整课分配已获认可，不重排；旧完整稿、Word/PDF、旧PPT、师生材料、已有容量报告、蒸馏技能仓和111份旧稿均未修改。原[组稿Skill](skills/classroom-oral-workflow/SKILL.md)与[备课模式](备课模式.md)继续有效。若今后授权Codex核证或排版，须以教师选定的正文版本为唯一依据，不得自行全篇改稿。

[此前交接机制状态（固定提交）](https://github.com/takehaya1111/constitution-law-8-lessons/blob/6823a8547108c61ab13fe2e02ea3368f5ea7c8b8/CURRENT_STATE.md)保留，防止把过去的阶段当成当前待办。
