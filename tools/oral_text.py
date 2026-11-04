"""输出稿件的纯口述文字。单元稿和含「## 上节／下节」的整讲稿均可读取。"""
import argparse
from pathlib import Path
import re


QUOTE = re.compile(r"^ {0,3}>[ \t]?", re.M)
# 兼容旧试样中明确标为教师备查的粗体题签；普通加粗引文继续朗读。
NOTE = re.compile(r"^ {0,3}>[ \t]*(?:【背景资料补充(?:[｜|][^】\r\n]+)?】|\*\*教师备查｜[^*\r\n]+\*\*)")
UPPER = re.compile(r"^##[ \t]+上节", re.M)
LOWER = re.compile(r"^##[ \t]+下节", re.M)
CUE = re.compile(r"【[^】]*】", re.S)
# 只认独占一行、动词与正时长都明确的讲台动作，普通口述括注继续计入。
DURATION = r"(?:[1-9][0-9]*|[二三四五六七八九]?十[一二三四五六七八九]?|[一二两三四五六七八九半])[ \t]*(?:分钟|秒)"
ACTIVITY = re.compile(
    rf"^[ \t]*（(?:留出约?{DURATION}独立阅读与思考时间|"
    rf"(?:静读|默读|独立阅读|独立思考)约?{DURATION})）[ \t]*\r?$",
    re.M,
)


def without_background(text):
    """只移除显式备查块；保留行数，供提示核查定位到原文件。"""
    lines = []
    in_note = False
    for line in text.splitlines(keepends=True):
        if NOTE.match(line):
            in_note = True
        elif not QUOTE.match(line):
            in_note = False
        lines.append(line[len(line.rstrip("\r\n")):] if in_note else line)
    return "".join(lines)


def speech_only(text, legacy_quoted_notes=False):
    """整讲卷首不朗读。节内普通引用保留，历史稿可声明引用全作编者注。"""
    text = without_background(text)
    upper = UPPER.search(text)
    if upper and LOWER.search(text, upper.end()):
        text = text[upper.start():]
    text = re.sub(r"^\#{1,6}[ \t]+.*$", "", text, flags=re.M)
    text = ACTIVITY.sub("", text)
    if legacy_quoted_notes:
        text = re.sub(r"^ {0,3}>.*$", "", text, flags=re.M)
    else:
        text = QUOTE.sub("", text)
    return CUE.sub("", text)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manuscript", type=Path)
    parser.add_argument("--legacy-quoted-notes", action="store_true",
                        help="仅用于已确认节内全部引用均为不朗读编者注的历史稿")
    args = parser.parse_args()
    print(speech_only(args.manuscript.read_text(encoding="utf-8-sig"),
                      args.legacy_quoted_notes).strip())
