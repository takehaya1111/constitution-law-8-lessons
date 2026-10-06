"""从同一主稿的实际讲述复算两节容量；不生成讲述，也不自动选择分支。"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SPEEDS = [140, 150, 180, 200, 220]
SCENARIOS = {"plan": "计划", "short": "回应较短", "slow": "推进较慢"}
SECTIONS = {"upper": "上节", "lower": "下节"}
HAN = re.compile(r"[\u4e00-\u9fff]")
DIGITS = "零一二三四五六七八九"
LETTERS = dict(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ", [
    "诶", "比", "西", "迪", "伊", "艾弗", "吉", "艾尺", "艾", "杰", "开", "艾勒", "艾姆",
    "恩", "欧", "皮", "丘", "阿尔", "艾斯", "提", "优", "维", "达不溜", "艾克斯", "歪", "贼德"]))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def han(text):
    return len(HAN.findall(text))


def integer_reading(written):
    n = int(written)
    if n < 10:
        return DIGITS[n]
    require(n < 10000, "超过四位的数量请在口读映射中明确：" + written)
    result, zero = "", False
    for value, unit in [(1000, "千"), (100, "百"), (10, "十"), (1, "")]:
        digit, n = divmod(n, value)
        if digit:
            if zero:
                result += "零"
            if not (digit == 1 and value == 10 and not result):
                result += DIGITS[digit]
            result += unit
            zero = False
        elif result and n:
            zero = True
    return result


def number_reading(written, year=False):
    if "." in written:
        a, b = written.split(".")
        return integer_reading(a) + "点" + "".join(DIGITS[int(c)] for c in b)
    if year:
        return "".join(DIGITS[int(c)] for c in written)
    return integer_reading(written)


def spoken_count(text, overrides=None):
    overrides = overrides or {}
    # 链接只读显示文字；排版标记不读。课文中的来源/提示应在非“讲述”节。
    text = re.sub(r"\[([^\]]+)\]\([^\n)]+\)", r"\1", text)
    tokens = sorted(overrides, key=len, reverse=True)
    pattern = "|".join(re.escape(k) for k in tokens)
    standard = r"\d+(?:\.\d+)?(?:[%％]|/\d+)?|[A-Za-z]+"
    regex = re.compile((pattern + "|" if pattern else "") + standard)
    corrections = []

    def convert(match):
        written = match.group()
        if written in overrides:
            spoken, rule = overrides[written], "输入指定读法"
        elif written.endswith(("%", "％")):
            spoken, rule = "百分之" + number_reading(written[:-1]), "百分比"
        elif "/" in written:
            a, b = written.split("/")
            spoken, rule = number_reading(b) + "分之" + number_reading(a), "分数"
        elif written[0].isdigit():
            following = text[match.end():match.end() + 1]
            # 年份列表常省略“年”；本课历史语境中的1500—2099四位数逐位读。
            year = (len(written) == 4 and written.isdigit()
                    and (following == "年" or 1500 <= int(written) <= 2099))
            spoken, rule = number_reading(written, year), "年份逐位" if year else "整数/小数（条号保留原条字）"
        else:
            require(written.isupper() and len(written) <= 5,
                    "未确定外文读法，请添加 speech_readings：" + written)
            spoken, rule = "".join(LETTERS[c] for c in written), "字母名称的中文近似音节；可用映射覆盖"
        require(isinstance(spoken, str) and spoken, "口读映射必须为非空文字：" + written)
        corrections.append({"written": written, "spoken": spoken, "rule": rule,
                            "offset": match.start(), "context": text[max(0, match.start()-12):match.end()+12],
                            "added_han": han(spoken) + spoken.count("〇") - han(written) - written.count("〇")})
        return spoken

    read_text = regex.sub(convert, text)
    return {"han": han(text), "zero_circle_count": text.count("〇"),
            "spoken_han": han(read_text) + read_text.count("〇"),
            "speech_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
            "readings": corrections}


def extract_blocks(source, definitions, overrides):
    headings = list(re.finditer(r"^## ([^\n]+)\n", source, re.M))
    sections = {}
    for i, match in enumerate(headings):
        heading = match.group(1).strip()
        require(heading not in sections, "二级标题重复：" + heading)
        end = headings[i+1].start() if i+1 < len(headings) else len(source)
        sections[heading] = (source[match.end():end], source[:match.start()].count("\n")+1)
    counts, used, ids = [], set(), set()
    for block in definitions:
        bid = block["id"]
        require(bid not in ids, "段落编号重复：" + bid)
        ids.add(bid)
        require(block["section"] in SECTIONS, "分节不明：" + bid)
        require(block["kind"] in {"main", "extension", "replacement"}, "段落类型不明：" + bid)
        heading = block["source_heading"]
        require(heading not in used, "同一来源被重复计入或跨节：" + heading)
        used.add(heading)
        require(heading in sections, "找不到主稿二级标题：" + heading)
        body, line = sections[heading]
        subs = list(re.finditer(r"^### ([^\n]+)\n", body, re.M))
        speeches = []
        for i, match in enumerate(subs):
            if match.group(1).strip() == block.get("speech_subheading", "讲述"):
                end = subs[i+1].start() if i+1 < len(subs) else len(body)
                speeches.append(body[match.end():end].strip())
        speech = "\n\n".join(speeches)
        require(speech.strip(), "实际讲述为空：" + bid)
        counts.append({**block, "source_line": line, "speech_parts": len(speeches),
                       **spoken_count(speech, overrides)})
    # 有“讲述”的标题不得从映射中悄然消失；明确备查段可不映射。
    for heading, (body, _) in sections.items():
        if re.search(r"^### 讲述\s*$", body, re.M):
            require(heading in used, "主稿讲述未映射：" + heading)
    require({x["section"] for x in counts if x["kind"] == "main"} == set(SECTIONS), "必须有两节主线")
    return counts


def selected_path(section, selection, blocks):
    main = [x["id"] for x in blocks.values() if x["section"] == section and x["kind"] == "main"]
    selected = main.copy()
    branches = [] if selection == "main" else selection.split("+")
    require(len(branches) == len(set(branches)), "选择中分支重复：" + selection)
    replaced = set()
    for bid in branches:
        require(bid in blocks, "分支不存在：" + bid)
        b = blocks[bid]
        require(b["section"] == section and b["kind"] != "main", "分支跨节或重复主线：" + bid)
        if b["kind"] == "replacement":
            targets = b["replaces"] if isinstance(b["replaces"], list) else [b["replaces"]]
            require(targets and all(t in main for t in targets), "替换必须指向本节主线：" + bid)
            require(not set(targets) & replaced, "互斥短讲重复替换：" + bid)
            pos = selected.index(targets[0])
            require([main.index(t) for t in targets] == list(range(main.index(targets[0]), main.index(targets[0])+len(targets))),
                    "多段替换必须按主线顺序连续：" + bid)
            selected = [t for t in selected if t not in targets]
            selected.insert(pos, bid)
            replaced.update(targets)
    insert_tails = {}
    for bid in branches:
        b = blocks[bid]
        if b["kind"] == "extension":
            anchor = b["insert_after"]
            require(anchor in main, "深化位置必须指向本节主线：" + bid)
            if anchor in replaced:
                anchor = next(x for x in selected if blocks[x]["kind"] == "replacement"
                              and b["insert_after"] in ([blocks[x]["replaces"]] if isinstance(blocks[x]["replaces"], str) else blocks[x]["replaces"]))
            tail = insert_tails.get(anchor, anchor)
            selected.insert(selected.index(tail)+1, bid)
            insert_tails[anchor] = bid
    require(len(selected) == len(set(selected)), "路径重复计段")
    return selected, set(main) | {x for x in branches if blocks[x]["kind"] == "extension"}


def calculate(section, selection, speed, scenario, blocks, activities):
    path, activity_blocks = selected_path(section, selection, blocks)
    selected_activities = [a for a in activities if a["block"] in activity_blocks]
    seconds = sum(a["seconds"][scenario] for a in selected_activities if not a["overlaps_speech"])
    speech = sum(blocks[b]["spoken_han"] for b in path)
    duration = speech / speed + seconds / 60
    # 被短讲替换的主线仍保留该任务；这里仅计算实际选定口述。
    timeline, elapsed = [], 0
    for bid in path:
        b = blocks[bid]
        acts = ([b["replaces"]] if isinstance(b.get("replaces"), str) else b.get("replaces", [bid]))
        sec = sum(a["seconds"][scenario] for a in selected_activities if a["block"] in acts and not a["overlaps_speech"])
        end = elapsed + b["spoken_han"] / speed + sec / 60
        timeline.append({"block": bid, "start_minutes": round(elapsed, 4), "end_minutes": round(end, 4)})
        elapsed = end
    require(abs(elapsed-duration) < 1e-8, "逐段累计与总计不一致")
    return {"selection": selection, "selected_blocks": path, "han": sum(blocks[b]["han"] for b in path),
            "spoken_han": speech, "activity_seconds": seconds, "activities": [a["id"] for a in selected_activities],
            "estimated_minutes": round(duration, 4), "difference_from_45_minutes": round(duration-45, 4),
            "remaining_minutes": round(45-duration, 4), "timeline": timeline,
            "status": "超45分钟，当前选择未覆盖" if duration > 45 else
                      "低于42分钟参考，余量较大需明示" if duration < 42 else "42—45分钟条件估算范围"}


def make_report(input_path):
    input_checksum = sha(input_path)
    config = json.loads(input_path.read_text(encoding="utf-8-sig"))
    source_path = input_path.parent / config["source"]
    require(sha(source_path) == config["source_sha256"], "主稿校验值已变化，须由内容负责人确认映射后更新输入")
    require(config["speeds"] == SPEEDS and config["scenario_order"] == list(SCENARIOS), "须保留五速度和三活动情景")
    require(config["section_minutes"] == 45, "本检查器按两节各45分钟核算")
    source = source_path.read_text(encoding="utf-8-sig")
    counts = extract_blocks(source, config["blocks"], config.get("speech_readings", {}))
    blocks = {b["id"]: b for b in counts}
    for block in counts:
        if block["kind"] != "main":
            selected_path(block["section"], block["id"], blocks)
    activities = config["activities"]
    require(len({a["id"] for a in activities}) == len(activities), "活动编号重复")
    for a in activities:
        require(a["block"] in blocks, "活动段落不存在：" + a["id"])
        require(blocks[a["block"]]["kind"] != "replacement", "短讲保留原任务，不另复制活动：" + a["id"])
        require(a.get("includes_teacher_feedback") is False, "活动含教师讲评或未说明：" + a["id"])
        require(isinstance(a.get("overlaps_speech"), bool), "须明确口述重叠：" + a["id"])
        require(set(a["seconds"]) == set(SCENARIOS), "活动缺少三情景：" + a["id"])
        require(all(isinstance(v, (int, float)) and v >= 0 for v in a["seconds"].values()), "活动秒数非法")
    rows = []
    for section in SECTIONS:
        for speed in SPEEDS:
            choices = config["selections"][section][str(speed)]
            require(len(choices) == 3, "每速度须有三个明确选择")
            for scenario, choice in zip(SCENARIOS, choices):
                rows.append({"section": section, "speed": speed, "scenario": scenario,
                             "original": calculate(section, "main", speed, scenario, blocks, activities),
                             "adjusted": calculate(section, choice, speed, scenario, blocks, activities)})
    paths = [input_path, source_path, Path(__file__).resolve()]
    for name in config.get("supporting_sources", []):
        paths.append(input_path.parent / name)
    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        commit = "未取得"
    command = 'python tools/check_dual45.py --input "' + input_path.relative_to(ROOT).as_posix() + '"'
    require(sha(input_path) == input_checksum and sha(source_path) == config["source_sha256"],
            "复算过程中输入改变，请在内容稳定后重跑")
    return {"lesson": config["lesson"], "generated_at": datetime.now(timezone.utc).isoformat(),
            "git_head_at_run": commit, "execution": {"command": command, "status": "实际执行完成"},
            "inputs": {p.relative_to(ROOT).as_posix(): sha(p) for p in paths},
            "source": config["source"], "source_sha256": sha(source_path), "input_sha256": sha(input_path),
            "reference_speed": config["reference_speed"], "counts": counts, "activities": activities, "rows": rows,
            "checks": {"two_sections": True, "all_spoken_blocks_mapped_and_nonempty": True,
                       "source_hash_matches": True, "no_duplicate_source_or_cross_section_block": True,
                       "exclusive_replacements": True, "activities_exclude_teacher_feedback": True,
                       "overlapping_activities_not_added": True, "timeline_equals_total": True},
            "notes": config.get("notes", []),
            "limits": ["所有速度为分析假设，180仅为编排参照；没有真人计时或学习效果资料。",
                       "纯汉字保留旧版口径；口读量另计〇及数字、百分比、条号和缩写读法，明细可回查。",
                       "年份逐位读，条号按整数读；字母名称用中文近似音节估计，可通过 speech_readings 指定实际读法。",
                       "仅统计所选讲述与不重叠活动；短讲替换原口述并保留原任务，深化仅在选用时加入。",
                       "42—45分钟仅作本轮编排参考；空余未冒称已备内容，报告不保证实讲严格45分钟。",
                       "活动是否合理、短讲是否保住依据与论证质量仍须人工审阅；程序仅核数据声明及算术。",
                       "中途选择仅适用于尚未开始的整段；已讲长稿不可从头再读短稿。超出设定情景的困难未保证覆盖。"]}


def markdown_report(report):
    out = ["# " + report["lesson"] + "双45分钟容量报告", "", "本报告由工具从当前主稿实际读取并生成。两节各自从0开始；余量为45减预测时长，负数表示超时。", "",
           "五档速度均为分析假设，180仅为本次编排参照。先列相同主线的原始值，再列内容负责人明确选定的短讲/深化路径。空余不计作已备内容。", ""]
    for section, label in SECTIONS.items():
        main = next(r["original"] for r in report["rows"] if r["section"] == section and r["speed"] == 180 and r["scenario"] == "plan")
        out += ["## " + label + "：本节0—45分钟", "", f"主线纯汉字{main['han']}，口读校正后{main['spoken_han']}；计划独立活动{main['activity_seconds']/60:.2f}分钟。180参照下{main['estimated_minutes']:.2f}分钟，余量{main['remaining_minutes']:.2f}分钟。", "",
                "| 速度 | 活动情景 | 原始主线分钟 | 原始余量 | 选择 | 调整后分钟 | 调整后余量 |", "|---:|---|---:|---:|---|---:|---:|"]
        for r in report["rows"]:
            if r["section"] == section:
                a, b = r["original"], r["adjusted"]
                out.append(f"| {r['speed']} | {SCENARIOS[r['scenario']]} | {a['estimated_minutes']:.2f} | {a['remaining_minutes']:.2f} | {b['selection']} | {b['estimated_minutes']:.2f} | {b['remaining_minutes']:.2f} |")
        out += ["", "### 180计划主线路径的累计位置", "", "| 段落 | 本节起点 | 本节终点 |", "|---|---:|---:|"]
        for t in main["timeline"]:
            out.append(f"| {t['block']} | {t['start_minutes']:.2f} | {t['end_minutes']:.2f} |")
        out.append("")
    risks = [r for r in report["rows"] if r["adjusted"]["estimated_minutes"] < 42 or r["adjusted"]["estimated_minutes"] > 45]
    out += ["## 选择后仍须明示的边界", ""]
    if risks:
        for r in risks:
            a = r["adjusted"]
            out.append(f"- {SECTIONS[r['section']]}，{r['speed']}，{SCENARIOS[r['scenario']]}：{a['selection']}为{a['estimated_minutes']:.2f}分钟，余量{a['remaining_minutes']:.2f}分钟。{a['status']}。")
    else:
        out.append("30个选定组合均处于42—45分钟的编排参考范围；这只说明当前假设和选择的计算结果。")
    out += ["", "## 实际段落与活动", "", "完整正文、调用位置、用途及中段/收束前检查点留在同一主稿和教学安排。JSON保留每个分支真实标题、行号、口述校验值、逐项读法与每种路径累计时间，便于核对和在尚未开始的段落前调整。", "",
            "| 活动 | 所在段 | 计划秒 | 回应短秒 | 推进慢秒 | 是否独立计时 | 任务/依据 |", "|---|---|---:|---:|---:|---|---|"]
    for a in report["activities"]:
        desc = a.get("description", "见主稿同段活动及教学安排")
        reason = a.get("scenario_reasons", {})
        if reason:
            desc += "；" + ("；".join(f"{SCENARIOS.get(k,k)}：{v}" for k, v in reason.items()) if isinstance(reason, dict) else str(reason))
        out.append(f"| {a['id']} | {a['block']} | {a['seconds']['plan']} | {a['seconds']['short']} | {a['seconds']['slow']} | {'不再加时，重叠口述' if a['overlaps_speech'] else '独立'} | {desc.replace('|','／')} |")
    out += ["", "## 输入与实际运行", "", "```powershell", report["execution"]["command"], "```", "",
            "运行状态：实际执行完成。执行时提交：`" + report["git_head_at_run"] + "`；未提交的最终正文由下列校验值锁定。", ""]
    for path, checksum in report["inputs"].items():
        out.append(f"- `{path}`：`{checksum}`")
    out += ["", "结构与算术检查已执行：源校验一致、两节齐备、全部讲述映射非空、来源没有重复跨节、替换互斥、活动声明排除教师讲评、重叠活动不再加时、累计与总计一致。", "",
            "## 计数和验证限制", ""] + ["- " + x for x in report["limits"]]
    return "\n".join(out) + "\n"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", type=Path, help="输出文件前缀；默认输入同目录07_双45分钟容量报告")
    args = parser.parse_args()
    input_path = args.input.resolve()
    report = make_report(input_path)
    output = args.output or input_path.parent / "07_双45分钟容量报告"
    if args.output:
        report["execution"]["command"] += ' --output "' + str(args.output) + '"'
    output.with_suffix(".json").write_bytes((json.dumps(report, ensure_ascii=False, indent=2)+"\n").encode("utf-8"))
    output.with_suffix(".md").write_bytes(markdown_report(report).encode("utf-8"))
    print(json.dumps({"lesson": report["lesson"], "blocks": len(report["counts"]), "scenarios": len(report["rows"]),
                      "checks": report["checks"], "output": str(output),
                      "reference": [{"section": r["section"], "main_minutes": r["original"]["estimated_minutes"]}
                                    for r in report["rows"] if r["speed"] == 180 and r["scenario"] == "plan"]}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, FileNotFoundError, json.JSONDecodeError) as error:
        print("容量复算失败：" + str(error), file=sys.stderr)
        sys.exit(1)
