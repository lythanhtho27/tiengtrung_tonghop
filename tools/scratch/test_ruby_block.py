import json
import re
import pypinyin

# Helper to convert text to Ruby HTML
def text_to_ruby_block(text):
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    html_blocks = []
    for para in paragraphs:
        out = []
        py_list = pypinyin.pinyin(para, style=pypinyin.Style.TONE)
        for i, char in enumerate(para):
            if '\u4e00' <= char <= '\u9fff':
                py = py_list[i][0]
                out.append(f"<ruby>{char}<rt>{py}</rt></ruby>")
            else:
                out.append(char)
        html_blocks.append(f'<span class="block">{"".join(out)}</span>')
    return "\n                ".join(html_blocks)

# Test with a paragraph
sample_text = "衰老很重要的标志，就是求稳怕变。所以，你想保持年轻吗？你希望自己有活力吗？你期待着清晨能在新生活的憧憬中醒来吗？有一个好办法——每天都冒一点险。"
ruby_html = text_to_ruby_block(sample_text)
print("Generated Ruby HTML preview:")
print(ruby_html[:300])
