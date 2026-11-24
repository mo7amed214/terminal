"""Pack home/ and art/ into ragab/data.json, then render card.txt.

Run from the repository root after editing anything in home/ or art/:

    python tools/build.py
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOME = os.path.join(ROOT, "home")


def read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read().replace("\r\n", "\n")


def walk(path):
    node = {"type": "dir", "children": {}}
    for name in sorted(os.listdir(path), key=lambda n: (n.startswith("."), n.lower())):
        full = os.path.join(path, name)
        if os.path.isdir(full):
            node["children"][name] = walk(full)
        else:
            entry = {"type": "file", "content": read(full)}
            if name.endswith(".sh"):
                entry["exec"] = True
            node["children"][name] = entry
    return node


data = {
    "user": "guest",
    "host": "ragab",
    "name": "Mohamed Ashraf Ragab",
    "tagline": "penetration testing // web · network · OT/ICS",
    "links": {
        "linkedin": "https://www.linkedin.com/in/mohamed-ashraf-ragab/",
        "github": "https://github.com/mo7amed214",
        "site": "https://mo7amed214.github.io",
    },
    "portrait": {
        "web": read(os.path.join(ROOT, "art", "portrait-web.txt")).rstrip("\n"),
        "tty": read(os.path.join(ROOT, "art", "portrait-tty.txt")).rstrip("\n"),
    },
    "fs": walk(HOME),
}

out = os.path.join(ROOT, "ragab", "data.json")
with open(out, "w", encoding="utf-8", newline="\n") as fh:
    json.dump(data, fh, ensure_ascii=False, indent=1)
    fh.write("\n")
print("wrote", os.path.relpath(out, ROOT))

card = subprocess.run(
    [sys.executable, "-m", "ragab", "--card", "--color"],
    cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
).stdout
with open(os.path.join(ROOT, "card.txt"), "w", encoding="utf-8", newline="\n") as fh:
    fh.write(card)
print("wrote card.txt")
