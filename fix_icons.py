import os
import glob

def fix_icons_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # yellow-400 -> amber-300
    content = content.replace('text-yellow-400', 'text-amber-300')
    # cyan-400 -> cyan-300
    content = content.replace('text-cyan-400', 'text-cyan-300')
    # green-400 -> emerald-400
    content = content.replace('text-green-400', 'text-emerald-400')
    # white/30 -> white/50 (for disabled states)
    content = content.replace('text-white/30', 'text-white/50')
    count = 0
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        print(f"Fixed icons in {filepath}")

for fp in glob.glob("frontend/src/pages/*.jsx"):
    fix_icons_in_file(fp)

