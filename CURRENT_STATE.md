# 当前状态：Gemini口播对照与写作项目研究完成，运行方式改进尚待验证

更新：2026-10-11。教师已评价r4.1示例仍然“假大空”，随后提供一份Gemini口播Markdown，要求深度比较为何相对自然，并广泛调研Claude/Codex写稿项目。**这不是教师认可r4.1，也不是同意用Gemini全稿直接替代本课。**本轮完成的是实际文本对照、外部核心工作说明研究及改进提案；没有再升级Skill或重排整讲。

## 准确任务与读取指针

```yaml
active_task_id: ORAL-LECTURE1-001
active_work_order: handoff/口播工作单_ORAL-LECTURE1-001.md
lesson_plan_revision: r4.1
workflow_version: 0.3.2
current_focus: GEMINI_TEXT_COMPARISON_AND_WRITING_PROJECT_RESEARCH
research_result: research/20261011_Gemini口播对照与Claude_Codex写作项目研究.md
status: TEXT_COMPARISON_RESEARCH_COMPLETE_CONTROLLED_WRITING_TEST_NOT_RUN
course_input: f0e1f8fa75ba04ddec3aaa26d4c6ba0c9bf71aca
gemini_upload_lines: 313
gemini_upload_sha256: 5096eb8aa9b7004504049c4087079e8c5c6928d97f20ffdebd1bb0db18e81e5c
teacher_r4_1_response: EXAMPLES_STILL_ABSTRACT_AND_UNNATURAL
gemini_reference_scope: RELATIVELY_NATURAL_REFERENCE_NOT_WHOLE_TEXT_APPROVAL
new_skill_version: NOT_CREATED
new_oral_draft: NOT_WRITTEN
external_project_install_or_execution: NOT_RUN
controlled_model_comparison: NOT_RUN
codex_independent_review: NOT_RUN
whole_dual45_validation: NOT_RUN
next_stage: TEST_STAGE_SPECIFIC_WRITER_INPUT_AND_VOICE_PRESERVING_EDIT_WITHIN_EXISTING_SYLLABUS
```

## 本轮实际结论

[**读完整研究报告：Gemini逐段对照、七个项目的实际机制与取舍、有限验证方案**](research/20261011_Gemini口播对照与Claude_Codex写作项目研究.md)。

Gemini若干段落的优点是直接解释、连续给出理由、稳定衔接，而不是拥有更多故事和热梗。本项目旧样段却把“我们给假设再补一个条件”等编写操作与来源辩护读给学生。现有Skill其实早有“编辑说明留后台、直接口述”等条款，不能再把规则未落实解释成少了一份规定。

“主笔加载的项目过程与审稿上下文过重”是有文本和外部工程建议支持的**工作假说**，尚未通过同模型控制比较；一个Gemini样本、未知的完整输入及设置，不能证明模型能力总体高低。样本中的提案主体、权利实现等表述还需独立法学审阅，第十二条具体任务实际被换成一般取信息问题；这不抵消教师对相对自然的判断。

拟改进：统筹者继续掌握双纲、全讲知识与容量；主笔得到整体位置、足够已核知识与材料、少量相关完整语气样本和必要约束；详细编辑检查分阶段使用，审后必须保护初稿中有效的自然表达。解释型参照用Gemini的具体优点，故事型参照保留已认可豆选，不统一套成一套戏剧情节。

## 项目调研范围

核读核心说明：KKKKhazix/human-writing、blader/humanizer、luquiluke/claude-book-skill（含Codex适配）、MiaIria/style-distiller、hanzhcn/laohan-skills、zenstory-ai/oh-story-claudecode、davila7/claude-code-templates中的content-research-writer。另外两项只作项目说明层次的线索，报告中区分阅读深度。没有将风格百分比、自动评分或项目自报效果当独立证据；不采用把他人经历改成教师亲历、篡改事实细节或按数量补笑点的规则。

本轮读完整313行上传稿，回读现行Skill和写作说明、历史3995字稿相关正文及已有源文，查官方工程建议与有限法律原文。未重读教材全书、全部旧稿、全部蒸馏语料，没有观看影片、执行外部脚本、安装项目或调用Gemini/Claude作新实验。

## 保留与下一步

课程总纲、本讲大纲、已认可豆选、原r4.1方案和全部口播正文不变；[Skill v0.3.2](skills/classroom-oral-workflow/SKILL.md)保持冻结。原Gemini附件未改、未自动整份公开到仓库，报告保留文件摘要、行定位、必要短引与哈希。

下一项候选不是再修改几十条Skill，而是在既有第一讲连续知识任务中，比较同一模型分别使用完整流程上下文与精简但足量的主笔输入时的实际正文；事实、整体任务与样本相同，审稿后还要检查是否磨掉原来的自然语气。**本轮只提出并限定此比较，没有执行，也不声称已清空当前对话。**未来是否由Codex或独立写作上下文执行，依教师实际授权；不要求新增其他模型。

旧状态与全部r4.1取舍在[本轮前快照](https://github.com/takehaya1111/constitution-law-8-lessons/blob/f0e1f8fa75ba04ddec3aaa26d4c6ba0c9bf71aca/CURRENT_STATE.md)保留。教师指出局部问题仍按整体诊断处理，不以“真人味”取消准确性、故事、时效或两个45分钟。