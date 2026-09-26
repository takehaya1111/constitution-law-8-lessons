from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def main():
    root = Path(r'C:\Users\tsunami\AppData\Local\Temp\pdfread\constitution-slides-qa')
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 19)
    except OSError:
        font = ImageFont.load_default()
    for n in range(1, 8):
        folder = root / f'lesson{n}'
        files = sorted(folder.glob('slide-*.jpg'))
        if not files:
            raise RuntimeError(f'No rendered slides in {folder}')
        w, h, header, gap, cols = 500, 282, 28, 15, 4
        rows = (len(files) + cols - 1) // cols
        sheet = Image.new('RGB', (gap + cols * (w + gap), gap + rows * (h + header + gap)), '#e9e7e2')
        draw = ImageDraw.Draw(sheet)
        for i, file in enumerate(files):
            x = gap + (i % cols) * (w + gap)
            y = gap + (i // cols) * (h + header + gap)
            image = Image.open(file).convert('RGB')
            image.thumbnail((w, h))
            draw.rectangle((x - 1, y - 1, x + w + 1, y + h + 1), outline='#acaaa3', width=2)
            sheet.paste(image, (x + (w - image.width) // 2, y + (h - image.height) // 2))
            draw.text((x + 3, y + h + 5), f'Lesson {n} / Slide {i + 1}', fill='#263846', font=font)
        output = root / f'contact-lesson{n}.jpg'
        sheet.save(output, quality=88)
        print(output)


if __name__ == '__main__':
    main()
