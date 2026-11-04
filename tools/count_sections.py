"""按全课统一口径，统计一份上下节口播稿的字数与容量。

口径（与 `课节字数记录.md/.json` 一致）：
    取 `## 上节` / `## 下节` 两节正文，去掉标题、明确标记的背景资料补充块和
    课堂操作提示，保留普通口述引文。用 `tools/check_dual45.py::spoken_count` 统计
    "正文汉字"与"口读量"（数字、年份、条号折算为拟读汉字）。

容量按 180—200 口读字/分钟估算，并计入每节不重叠活动（默认一次独立思考
1—2 分钟）。

用法：
    python tools/count_sections.py <稿件.md> [--activity-min 1 2]
"""
from pathlib import Path
import argparse
import importlib.util
import io
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


def load_counter():
    spec = importlib.util.spec_from_file_location("cd45", ROOT / "tools" / "check_dual45.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def sections(text):
    normalized = text.rstrip("\n") + "\n"
    upper = re.search(r"^##[ \t]+上节", normalized, flags=re.M)
    lower = re.search(r"^##[ \t]+下节", normalized, flags=re.M)
    if not upper or not lower or upper.start() >= lower.start():
        raise ValueError("找不到 `## 上节` 或 `## 下节` 标记")
    return normalized[upper.start():lower.start()], normalized[lower.start():]


def clean(speech, legacy_quoted_notes=False):
    return load_counter().speech_only(speech, legacy_quoted_notes)


def report(name, speech, counter, activity):
    counts = counter.spoken_count(speech)
    spoken = counts["spoken_han"]
    fast = spoken / 200 + activity[0]
    slow = spoken / 180 + activity[1]
    print(f"  {name}：正文汉字 {counts['han']}，口读量 {spoken}，"
          f"不重叠活动 {activity[0]}—{activity[1]} 分钟，容量 {fast:.1f}—{slow:.1f} 分钟")
    return counts["han"], spoken


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("script")
    ap.add_argument("--legacy-quoted-notes", action="store_true",
                    help="节内普通引用全部是编者注时，沿用旧稿引用口径")
    ap.add_argument("--activity-min", nargs=2, type=float, default=[1.0, 2.0],
                    metavar=("MIN", "MAX"), help="每节不重叠活动分钟区间，默认 1 2")
    args = ap.parse_args(argv)

    counter = load_counter()
    raw = io.open(args.script, encoding="utf-8").read()
    upper, lower = sections(raw)
    print(f"稿件：{args.script}")
    hu, su = report("上节", counter.speech_only(upper, args.legacy_quoted_notes), counter, args.activity_min)
    hl, sl = report("下节", counter.speech_only(lower, args.legacy_quoted_notes), counter, args.activity_min)
    print(f"  合计：正文汉字 {hu + hl}，口读量 {su + sl}")
    print(f"  文件 SHA-256：{counter.sha(Path(args.script))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
