"""按全课统一口径，统计一份上下节口播稿的字数与容量。

口径（与 `课节字数记录.md/.json` 一致）：
    取 `## 上节` / `## 下节` 两节正文；去掉标题行（`#`开头）、引用行（`>`开头）
    和【…】课堂提示整块；再用 `tools/check_dual45.py::spoken_count` 统计
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
    if "## 上节" not in normalized or "## 下节" not in normalized:
        raise ValueError("找不到 `## 上节` 或 `## 下节` 标记")
    upper = "## 上节" + normalized.split("## 上节", 1)[1].split("## 下节", 1)[0]
    lower = "## 下节" + normalized.split("## 下节", 1)[1]
    return upper, lower


def clean(speech):
    speech = re.sub(r"^#{1,6} .*$", "", speech, flags=re.M)   # 标题行
    speech = re.sub(r"^>.*$", "", speech, flags=re.M)          # 引用行
    speech = re.sub(r"【[^】]*】", "", speech, flags=re.S)      # 课堂提示
    return speech


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
    ap.add_argument("--activity-min", nargs=2, type=float, default=[1.0, 2.0],
                    metavar=("MIN", "MAX"), help="每节不重叠活动分钟区间，默认 1 2")
    args = ap.parse_args(argv)

    counter = load_counter()
    raw = io.open(args.script, encoding="utf-8").read()
    upper, lower = sections(raw)
    print(f"稿件：{args.script}")
    hu, su = report("上节", clean(upper), counter, args.activity_min)
    hl, sl = report("下节", clean(lower), counter, args.activity_min)
    print(f"  合计：正文汉字 {hu + hl}，口读量 {su + sl}")
    print(f"  文件 SHA-256：{counter.sha(Path(args.script))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
