"""检查口述稿与指定来源（教材连续原文、宪法条文）的连续重合比例。

用途：口播稿是"讲"的稿子，不应把法条和教材说明整段搬进嘴里。本工具把稿件与
来源文本做逐字比对，报出连续重合的片段，供作者判断哪些地方是在"念文件"。

用法：
    python tools/check_verbatim_overlap.py <稿件.md> --source <来源.md> [--source ...]
        [--min-run 16] [--top 30]

判定口径：
    - 双方文本先去掉全部空白字符，再做比对；因此换行与缩进不影响结果。
    - 稿件中的 ** 加粗标记在比对前去除，避免仅靠加粗"打断"重合。
    - "连续重合 >= min-run"的片段计入重合字数；默认 min-run=16。
    - 该指标只作编辑参考，不是硬门槛。定义式条文、要背的口号、关键短语的
      原文引用属正常；说明性长句成段搬运才是问题。
"""
from pathlib import Path
import argparse
import re
import sys

HAN = re.compile(r"[\u4e00-\u9fff]")
WS = re.compile(r"\s+")


def read(path):
    return Path(path).read_text(encoding="utf-8")


def normalize(text):
    return WS.sub("", text.replace("**", ""))


def runs_in(script, source, n):
    """返回稿件中与来源连续重合 >= n 的片段 [(长度, 片段)]。"""
    grams = {source[i:i + n] for i in range(len(source) - n + 1)}
    out = []
    i = 0
    while i <= len(script) - n:
        if script[i:i + n] in grams:
            j = i + n
            while j < len(script) and script[j - n + 1:j + 1] in grams:
                j += 1
            out.append((j - i, script[i:j]))
            i = j
        else:
            i += 1
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("script", help="待查稿件（Markdown）")
    ap.add_argument("--source", action="append", required=True,
                    help="来源文本，可重复指定；来源本身会先合并")
    ap.add_argument("--min-run", type=int, default=16,
                    help="计入重合的最短连续字数，默认16")
    ap.add_argument("--top", type=int, default=30, help="列出最长的前若干条")
    args = ap.parse_args(argv)

    raw = read(args.script)
    source = normalize("\n".join(read(s) for s in args.source))
    script = normalize(raw)

    found = runs_in(script, source, args.min_run)
    han = len(HAN.findall(raw))
    hit = sum(length for length, _ in found)
    print(f"稿件：{args.script}")
    print(f"  正文汉字（含标题与提示）：{han}")
    print(f"  连续重合（>={args.min_run}字）：{hit} 字，占 {hit / han * 100:.1f}%")
    print(f"  片段数：{len(found)}，最长：{max((x[0] for x in found), default=0)} 字")
    print(f"  来源字数（去空白）：{len(source)}")
    if found:
        print(f"\n最长的 {args.top} 段（按长度降序）：")
        for length, frag in sorted(found, reverse=True)[:args.top]:
            print(f"  [{length:3d}] {frag}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
