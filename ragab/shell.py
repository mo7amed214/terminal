"""Mohamed Ashraf Ragab, as a read-only terminal session.

    ragab            connect and explore (ls, cd, cat, tree, help)
    ragab --card     print a one-screen card and exit
"""
import json
import os
import pkgutil
import shlex
import sys
import time
import webbrowser

DATA = json.loads(pkgutil.get_data("ragab", "data.json").decode("utf-8"))
HOME = "/home/mohamed"


class Paint:
    def __init__(self, on):
        self.on = on

    def _w(self, code, text):
        return "\033[%sm%s\033[0m" % (code, text) if self.on else text

    def red(self, t):    return self._w("91", t)
    def redb(self, t):   return self._w("1;91", t)
    def amber(self, t):  return self._w("33", t)
    def dim(self, t):    return self._w("2", t)
    def bold(self, t):   return self._w("1", t)


class Session:
    def __init__(self, paint, fast=False):
        self.p = paint
        self.fast = fast
        self.cwd = []                 # path parts below HOME
        self.history = []

    # ---- filesystem -------------------------------------------------------
    def resolve(self, path):
        parts = [] if (path.startswith("~") or path.startswith("/")) else list(self.cwd)
        path = path[1:] if path.startswith("~") else path
        if path.startswith(HOME):
            path = path[len(HOME):]
        for seg in path.split("/"):
            if seg in ("", "."):
                continue
            if seg == "..":
                if parts:
                    parts.pop()
                continue
            parts.append(seg)
        node = DATA["fs"]
        for seg in parts:
            if node["type"] != "dir" or seg not in node["children"]:
                return parts, None
            node = node["children"][seg]
        return parts, node

    def where(self, parts=None):
        parts = self.cwd if parts is None else parts
        return "~" + ("/" + "/".join(parts) if parts else "")

    def prompt(self):
        return "%s:%s$ " % (self.p.red("%s@%s" % (DATA["user"], DATA["host"])), self.p.bold(self.where()))

    def label(self, name, node):
        if node["type"] == "dir":
            return self.p.redb(name + "/")
        if node.get("exec"):
            return self.p.amber(name + "*")
        return name

    # ---- output helpers ---------------------------------------------------
    def say(self, text=""):
        print(text)

    def pause(self, s):
        if not self.fast:
            sys.stdout.flush()
            time.sleep(s)

    def banner(self):
        for line in DATA["portrait"]["tty"].splitlines():
            print(self.p.red(line))
        print()
        print(self.p.bold(DATA["name"]))
        print(self.p.dim(DATA["tagline"]))

    # ---- commands -----------------------------------------------------------
    def cmd_help(self, args):
        rows = [
            ("ls [-a] [-l] [dir]", "list a directory"),
            ("cd <dir>", "change directory (cd .. to go up)"),
            ("cat <file>", "print a file"),
            ("tree", "show everything at once"),
            ("./attack-chain.sh", "replay the thesis attack (in ~/thesis)"),
            ("open <linkedin|github|site>", "open a link in your browser"),
            ("whoami, pwd, banner, history, clear", ""),
            ("exit", "close the connection"),
        ]
        for c, d in rows:
            pad = " " * max(2, 38 - len(c))
            print("  " + self.p.red(c) + (pad + self.p.dim(d) if d else ""))
        print(self.p.dim("\n  start with:  cat about.txt   or   cd projects && ls"))

    def cmd_ls(self, args):
        flags = "".join(a[1:] for a in args if a.startswith("-"))
        targets = [a for a in args if not a.startswith("-")] or ["."]
        for t in targets:
            parts, node = self.resolve(t)
            if node is None:
                print("ls: cannot access '%s': No such file or directory" % t)
                continue
            if node["type"] == "file":
                print(self.label(parts[-1], node))
                continue
            names = [n for n in node["children"] if "a" in flags or not n.startswith(".")]
            if "l" in flags:
                print("total %d" % len(names))
                for n in names:
                    c = node["children"][n]
                    if c["type"] == "dir":
                        mode, size = "drwxr-xr-x", 4096
                    else:
                        mode = "-rwxr-xr-x" if c.get("exec") else "-rw-r--r--"
                        size = len(c["content"].encode("utf-8"))
                    print("%s 1 mohamed mohamed %5d Nov 24 2026 %s" % (mode, size, self.label(n, c)))
            else:
                print("  ".join(self.label(n, node["children"][n]) for n in names))

    def cmd_cd(self, args):
        target = args[0] if args else "~"
        parts, node = self.resolve(target)
        if node is None:
            print("cd: %s: No such file or directory" % target)
        elif node["type"] != "dir":
            print("cd: %s: Not a directory" % target)
        else:
            self.cwd = parts

    def cmd_cat(self, args):
        if not args:
            print("usage: cat <file>")
            return
        for t in args:
            parts, node = self.resolve(t)
            if node is None:
                print("cat: %s: No such file or directory" % t)
            elif node["type"] == "dir":
                print("cat: %s: Is a directory" % t)
            else:
                print(node["content"].rstrip("\n"))

    def cmd_tree(self, args):
        def walk(node, prefix):
            names = [n for n in node["children"] if not n.startswith(".")]
            for i, n in enumerate(names):
                last = i == len(names) - 1
                child = node["children"][n]
                print(prefix + ("└── " if last else "├── ") + self.label(n, child))
                if child["type"] == "dir":
                    walk(child, prefix + ("    " if last else "│   "))
        print(self.p.bold(self.where()))
        walk(self.resolve(".")[1], "")

    def run_script(self, path):
        parts, node = self.resolve(path)
        if node is None:
            print("%s: No such file or directory" % path)
            return
        if not node.get("exec"):
            print("%s: Permission denied" % path)
            return
        for line in node["content"].splitlines():
            line = line.strip()
            if line.startswith("step ") or line.startswith("impact "):
                kind, _, rest = line.partition(" ")
                text = rest.strip().strip('"')
                ok = "[  OK  ]"
                if kind == "impact":
                    print(self.p.red(ok + " " + text))
                else:
                    print(self.p.bold(ok) + " " + text)
                self.pause(0.35)

    def cmd_open(self, args):
        key = (args[0].lower() if args else "")
        url = DATA["links"].get(key)
        if not url:
            print("usage: open <%s>" % "|".join(DATA["links"]))
            return
        print("opening " + url)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    def execute(self, line):
        line = line.replace("﻿", "").strip()
        if not line:
            return True
        self.history.append(line)
        for chunk in line.split("&&"):
            try:
                words = shlex.split(chunk)
            except ValueError:
                words = chunk.split()
            if not words:
                continue
            cmd, args = words[0], words[1:]
            if cmd in ("exit", "logout", "quit"):
                print("Connection to %s closed." % DATA["host"])
                return False
            if cmd.startswith("./") or cmd in ("sh", "bash"):
                self.run_script(cmd[2:] if cmd.startswith("./") else (args[0] if args else ""))
            elif cmd == "help":
                self.cmd_help(args)
            elif cmd in ("ls", "dir", "ll"):
                self.cmd_ls((["-l"] if cmd == "ll" else []) + args)
            elif cmd == "cd":
                self.cmd_cd(args)
            elif cmd in ("cat", "less", "more"):
                self.cmd_cat(args)
            elif cmd == "tree":
                self.cmd_tree(args)
            elif cmd == "pwd":
                print(HOME + ("/" + "/".join(self.cwd) if self.cwd else ""))
            elif cmd == "whoami":
                print("guest  " + self.p.dim("(you're browsing Mohamed's files. try: cat about.txt)"))
            elif cmd == "banner":
                self.banner()
            elif cmd == "open":
                self.cmd_open(args)
            elif cmd == "history":
                for i, h in enumerate(self.history, 1):
                    print("%4d  %s" % (i, h))
            elif cmd == "clear":
                print("\033[2J\033[H", end="")
            elif cmd == "echo":
                print(" ".join(args))
            elif cmd == "sudo":
                print("guest is not in the sudoers file. This incident will be reported.")
            elif cmd == "rm":
                print("rm: cannot remove: Read-only file system")
            else:
                print("%s: command not found. Type 'help'." % cmd)
        return True

    # ---- session --------------------------------------------------------------
    def connect(self):
        print(self.p.dim("$ ssh %s@%s" % (DATA["user"], DATA["host"])))
        self.pause(0.4)
        print(self.p.dim("Connecting to %s..." % DATA["host"]))
        self.pause(0.5)
        print(self.p.dim("Connected. Read-only session for %s.\n" % DATA["user"]))
        self.pause(0.3)
        self.banner()
        print("\nType %s for commands, or %s to look around.\n" % (self.p.red("help"), self.p.red("ls")))

    def loop(self):
        self.setup_completion()
        while True:
            try:
                line = input(self.prompt())
            except (EOFError, KeyboardInterrupt):
                print("\nConnection to %s closed." % DATA["host"])
                return
            if not self.execute(line):
                return

    def setup_completion(self):
        try:
            import readline
        except ImportError:
            return
        words = ["help", "ls", "cd", "cat", "tree", "pwd", "whoami", "banner", "open", "history", "clear", "exit"]

        def complete(text, state):
            buf = readline.get_line_buffer()
            if " " not in buf.lstrip():
                options = [w for w in words if w.startswith(text)]
            else:
                head, _, tail = text.rpartition("/")
                _, node = self.resolve(head or ".")
                options = []
                if node and node["type"] == "dir":
                    for n, c in node["children"].items():
                        if n.startswith(tail) and (tail.startswith(".") or not n.startswith(".")):
                            options.append((head + "/" if head else "") + n + ("/" if c["type"] == "dir" else ""))
            return options[state] if state < len(options) else None

        readline.set_completer(complete)
        readline.set_completer_delims(" ")
        readline.parse_and_bind("tab: complete")


def card(paint):
    s = Session(paint, fast=True)
    s.banner()
    print()
    status = DATA["fs"]["children"]["status.txt"]["content"].rstrip("\n")
    for line in status.splitlines():
        mark, _, rest = line.partition(" ")
        print((paint.amber(mark) if "~" in mark else paint.red(mark)) + " " + rest)
    print()
    for k, v in DATA["links"].items():
        print("%s %s" % (paint.dim("%-9s" % k), v))
    print()
    print(paint.dim("explore the full session:"))
    print("  " + paint.red("pipx run --spec git+https://github.com/mo7amed214/terminal ragab"))
    print("  " + paint.red("https://mo7amed214.github.io/terminal"))


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    if os.name == "nt":
        os.system("")                      # turn on ANSI colours in the Windows console
    color = ("--color" in argv) or (sys.stdout.isatty() and "--no-color" not in argv and not os.environ.get("NO_COLOR"))
    paint = Paint(color)
    if "--card" in argv:
        card(paint)
        return 0
    s = Session(paint, fast="--fast" in argv or not sys.stdout.isatty())
    s.connect()
    if not sys.stdin.isatty():             # piped commands: run them and exit
        import io
        stream = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8-sig", errors="replace")
        for line in stream:
            print(s.prompt() + line.rstrip("\n"))
            if not s.execute(line):
                break
        return 0
    s.loop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
