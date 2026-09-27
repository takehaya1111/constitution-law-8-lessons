# GitHub课件技能对照：方法说明、实现与证据各到哪一步

核查日期：2026年9月27日。按教师要求扩大方法调查。通过公开技能目录及GitHub发现候选，阅读五个不同仓库的实际文件，核对当次提交。它们是有差异的方法样本，不构成穷尽调查或排名。

本轮没有安装技能、执行远程代码或制作课件。外部技能文件作为研究材料阅读，其中的命令和流程不自动成为本项目指令。下面的“程序检查”均指源码所见能力，没有声称已经运行。星数、安装量与项目自评不作为质量证明。

## 1. 原生PPT：anthropics/skills

提交：`33375500bcea98d610eb30ce10ac4e59b89c390d`

实际读取：[pptx技能全文](https://github.com/anthropics/skills/blob/33375500bcea98d610eb30ce10ac4e59b89c390d/skills/pptx/SKILL.md)，[PPTX校验器前130行](https://github.com/anthropics/skills/blob/33375500bcea98d610eb30ce10ac4e59b89c390d/skills/pptx/scripts/office/validators/pptx.py)。

其主要入口是读取、新建、编辑，重点在可编辑文件与生产可靠性。设计说明涉及配色、字号、版式变化；程序核对包内引用、标识、备注关联、图表及结构，并要求另外渲染检查。

**启发与限度：**可以参考文件与画面分别检查的办法；没有提供充分的主题调研或叙事选择机制。“每页都要有视觉元素”等要求是作者规则，尚不是适用于本课的证据。

## 2. 网页演示：zarazhangrui/frontend-slides

提交：`9906a34d640d2111f724544cbc50f7f130569ae1`

实际读取：[技能全文](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/SKILL.md)，[PDF导出脚本前380行](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/scripts/export-pdf.sh)。

先了解用途、长度、已有材料、现场讲授或独立阅读；提供三种实际单页小样帮助选择风格。导出时将逐步出现的元素设为可见，再按页截图合并。

**启发与限度：**以小样比较比抽象询问“喜欢哪种风格”更具体。但标题页不能代表复杂解释页，静态导出不能验证动态讲述。其字体与风格禁令具有网页媒介偏好，不能直接移入教室PPT。

## 3. 教育模式：vedraut/slidesage

提交：`2bbeebd9d31be79aad818938306f0bd4d615b515`

实际读取：[技能全文](https://github.com/vedraut/slidesage/blob/2bbeebd9d31be79aad818938306f0bd4d615b515/SKILL.md)、[教学设计参考全文](https://github.com/vedraut/slidesage/blob/2bbeebd9d31be79aad818938306f0bd4d615b515/references/instructional-design.md)、[递归教学示例全文](https://github.com/vedraut/slidesage/blob/2bbeebd9d31be79aad818938306f0bd4d615b515/examples/education-lesson/storyboard.json)、[质量检查脚本全文](https://github.com/vedraut/slidesage/blob/2bbeebd9d31be79aad818938306f0bd4d615b515/scripts/qa-report.mjs)。主任务另回读最后一个脚本全文。

技能区分教育与商业模式。教学示例把先修知识、目标、解释与练习写入结构稿。

**实现边界：**检查器以英文句末标点判断已有标题，以空格分词判断条目长度；查图表是否挂来源、目标编号是否关联、是否有指定练习页，对成品只查文件存在。中文内容可能被词数检查漏过。该脚本不测画面对比度、不渲染，也不判断概念与推理正确性。结构字段齐全只能说明登记了相应事项。

## 4. 视觉构思与分镜：alchaincyf/huashu-design

提交：`0830494ecb1c117e25b313a8114fe55a6bf2b125`

实际读取：

- [技能文件](https://github.com/alchaincyf/huashu-design/blob/0830494ecb1c117e25b313a8114fe55a6bf2b125/SKILL.md)：前230行及受众、三方向、形式推导、评审相关段落。
- [工作流程](https://github.com/alchaincyf/huashu-design/blob/0830494ecb1c117e25b313a8114fe55a6bf2b125/references/workflow.md)：前180行。
- [评审说明](https://github.com/alchaincyf/huashu-design/blob/0830494ecb1c117e25b313a8114fe55a6bf2b125/references/critique-guide.md)：概念、层级、细节、功能性评分段。
- [分镜基础](https://github.com/alchaincyf/huashu-design/blob/0830494ecb1c117e25b313a8114fe55a6bf2b125/references/storyboard-basics.md)：分镜卡、虚构产品的12秒动画示例、粗构图验证及转场关系段。
- [验证脚本](https://github.com/alchaincyf/huashu-design/blob/0830494ecb1c117e25b313a8114fe55a6bf2b125/scripts/verify.py)：全文。

强调内容推导形式、受众与媒介、多方向比较及粗构图。验证程序负责网页打开、翻页截图和浏览器错误捕捉。审美评分仍由模型按清单判断。品牌宣传和短动画规则较多，对90分钟法律教学的适用性未获证明。

## 5. 演讲叙事：mblode/agent-skills

提交：`1c003441aef304650c035b7f89b6705d92ef7808`

实际读取：[技能全文](https://github.com/mblode/agent-skills/blob/1c003441aef304650c035b7f89b6705d92ef7808/skills/presentation-creator/SKILL.md)、[故事结构及示例全文](https://github.com/mblode/agent-skills/blob/1c003441aef304650c035b7f89b6705d92ef7808/skills/presentation-creator/references/story-structure.md)、[讲者备注及示例全文](https://github.com/mblode/agent-skills/blob/1c003441aef304650c035b7f89b6705d92ef7808/skills/presentation-creator/references/speaker-notes.md)、[五项评测任务定义](https://github.com/mblode/agent-skills/blob/1c003441aef304650c035b7f89b6705d92ef7808/skills/presentation-creator/evals/evals.json)。

它了解受众、场景、核心信息与交付形式后，按故事线、结尾、页序、文字、画面和备注推进，要求计时通讲。

**启发与限度：**有明确的表达与试讲意识，但偏重立场说服和固定故事节拍，备注明确以提示为主、不做完整逐字稿。不能让这一规则覆盖教师的逐字稿需求。评测文件是任务与预期条件，不是已完成效果实验。

## 横向判断

| 要解决的问题 | 本轮可参考的材料 | 当前缺口 |
|---|---|---|
| 文件可编辑、结构正确 | 原生PPT技能与校验器 | 文件正确不说明能讲清 |
| 比较视觉方向 | 网页演示、花叔设计 | 标题小样不足以代表整课；仍需内容页比较 |
| 解释、练习与目标对应 | SlideSage教育模式 | 编号关联不能判断学习发生 |
| 页面出现顺序与现场表达 | 分镜示例、演讲叙事技能 | 缺本课真实试讲；静态预览不能说明节奏 |
| 完整高水平逐字稿 | 可借鉴演讲组织问题 | 五项均未证明能满足当前教师的具体要求 |

不同技能的规则存在冲突，例如原生PPT偏重常用字体的跨软件稳定性，网页技能则追求与常见字体拉开视觉差别；有的从结论和立场出发，有的从目标与先修知识出发。应调查规则所服务的场景，不能把所有要求叠加成统一流程。

**本轮结论：**这些技能提供了方法、实现和反例。它们尚不能代替表达对象研究、叙事选择或课堂验证，也没有任何一个在本轮被选定为课程制作方案。
