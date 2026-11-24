// ssh guest@ragab: a read-only shell over Mohamed Ashraf Ragab's profile.
// Content comes from ragab/data.json, which tools/build.py generates from home/.
(function () {
  "use strict";

  var HOME = "/home/mohamed";
  var COMMANDS = ["help", "ls", "cd", "cat", "tree", "pwd", "whoami", "banner", "open", "history", "clear", "exit"];

  var out = document.getElementById("out");
  var line = document.getElementById("line");
  var promptEl = document.getElementById("prompt");
  var typed = document.getElementById("typed");
  var kbd = document.getElementById("kbd");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var D = null;
  var cwd = [];
  var hist = [];
  var hpos = 0;
  var busy = true;
  var closed = false;

  // ---- output ----------------------------------------------------------------
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function linkify(s) {
    return esc(s).replace(/https?:\/\/[^\s)]+/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener">' + u + "</a>";
    });
  }
  function print(html, cls) {
    var d = document.createElement("div");
    d.className = "ln" + (cls ? " " + cls : "");
    d.innerHTML = html;
    out.appendChild(d);
    window.scrollTo(0, document.body.scrollHeight);
    return d;
  }
  function say(s, cls) { return print(linkify(s), cls); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); }

  function where(parts) {
    parts = parts || cwd;
    return "~" + (parts.length ? "/" + parts.join("/") : "");
  }
  function promptHTML() {
    return '<span class="u">guest@ragab</span>:<span class="w">' + esc(where()) + "</span>$ ";
  }

  // ---- filesystem ------------------------------------------------------------
  function resolve(path) {
    path = path || ".";
    var parts = path.charAt(0) === "~" || path.charAt(0) === "/" ? [] : cwd.slice();
    if (path.charAt(0) === "~") path = path.slice(1);
    if (path.indexOf(HOME) === 0) path = path.slice(HOME.length);
    path.split("/").forEach(function (seg) {
      if (!seg || seg === ".") return;
      if (seg === "..") { parts.pop(); return; }
      parts.push(seg);
    });
    var node = D.fs;
    for (var i = 0; i < parts.length; i++) {
      if (node.type !== "dir" || !node.children[parts[i]]) return { parts: parts, node: null };
      node = node.children[parts[i]];
    }
    return { parts: parts, node: node };
  }

  function rel(parts) {
    // path of parts relative to cwd, for clickable commands
    var common = 0;
    while (common < cwd.length && common < parts.length && cwd[common] === parts[common]) common++;
    var up = cwd.slice(common).map(function () { return ".."; });
    return up.concat(parts.slice(common)).join("/") || ".";
  }

  function entry(name, node, parentParts) {
    var p = rel(parentParts.concat([name]));
    if (node.type === "dir") return '<span class="dir" data-cmd="cd ' + esc(p) + ' &amp;&amp; ls">' + esc(name) + "/</span>";
    if (node.exec) return '<span class="exec" data-cmd="./' + esc(p) + '">' + esc(name) + "*</span>";
    return '<span class="file" data-cmd="cat ' + esc(p) + '">' + esc(name) + "</span>";
  }

  // ---- commands --------------------------------------------------------------
  var cmds = {
    help: function () {
      var rows = [
        ["ls [-a] [-l] [dir]", "list a directory"],
        ["cd <dir>", "change directory (cd .. to go up)"],
        ["cat <file>", "print a file"],
        ["tree", "show everything at once"],
        ["./attack-chain.sh", "replay the thesis attack (in ~/thesis)"],
        ["open <linkedin|github|site>", "open a link"],
        ["whoami, pwd, banner, history, clear", ""],
        ["exit", "close the connection"]
      ];
      rows.forEach(function (r) {
        var pad = new Array(Math.max(2, 38 - r[0].length)).join(" ");
        print("  <span class=\"u\">" + esc(r[0]) + "</span>" + (r[1] ? pad + '<span class="dim">' + esc(r[1]) + "</span>" : ""));
      });
      print("");
      print('<span class="dim">  you can also click any file or folder that ls prints.</span>');
    },

    ls: function (args) {
      var flags = args.filter(function (a) { return a.charAt(0) === "-"; }).join("");
      var targets = args.filter(function (a) { return a.charAt(0) !== "-"; });
      if (!targets.length) targets = ["."];
      targets.forEach(function (t) {
        var r = resolve(t);
        if (!r.node) { say("ls: cannot access '" + t + "': No such file or directory", "err"); return; }
        if (r.node.type === "file") { print(entry(r.parts[r.parts.length - 1], r.node, r.parts.slice(0, -1))); return; }
        var names = Object.keys(r.node.children).filter(function (n) { return flags.indexOf("a") >= 0 || n.charAt(0) !== "."; });
        if (flags.indexOf("l") >= 0) {
          say("total " + names.length);
          names.forEach(function (n) {
            var c = r.node.children[n];
            var mode = c.type === "dir" ? "drwxr-xr-x" : c.exec ? "-rwxr-xr-x" : "-rw-r--r--";
            var size = c.type === "dir" ? 4096 : new Blob([c.content]).size;
            var sz = ("     " + size).slice(-5);
            print(esc(mode + " 1 mohamed mohamed " + sz + " Nov 24 2026 ") + entry(n, c, r.parts));
          });
        } else {
          print('<span class="cols">' + names.map(function (n) { return entry(n, r.node.children[n], r.parts); }).join("") + "</span>");
        }
      });
    },

    cd: function (args) {
      var t = args[0] || "~";
      var r = resolve(t);
      if (!r.node) say("cd: " + t + ": No such file or directory", "err");
      else if (r.node.type !== "dir") say("cd: " + t + ": Not a directory", "err");
      else cwd = r.parts;
    },

    cat: function (args) {
      if (!args.length) { say("usage: cat <file>", "err"); return; }
      args.forEach(function (t) {
        var r = resolve(t);
        if (!r.node) say("cat: " + t + ": No such file or directory", "err");
        else if (r.node.type === "dir") say("cat: " + t + ": Is a directory", "err");
        else say(r.node.content.replace(/\n$/, ""));
      });
    },

    tree: function () {
      print('<span class="bold">' + esc(where()) + "</span>");
      (function walk(node, parts, prefix) {
        var names = Object.keys(node.children).filter(function (n) { return n.charAt(0) !== "."; });
        names.forEach(function (n, i) {
          var last = i === names.length - 1;
          var c = node.children[n];
          print(esc(prefix + (last ? "└── " : "├── ")) + entry(n, c, parts));
          if (c.type === "dir") walk(c, parts.concat([n]), prefix + (last ? "    " : "│   "));
        });
      })(resolve(".").node, cwd.slice(), "");
    },

    pwd: function () { say(HOME + (cwd.length ? "/" + cwd.join("/") : "")); },
    whoami: function () { print('guest  <span class="dim">(you\'re browsing Mohamed\'s files. try: cat about.txt)</span>'); },
    banner: function () { banner(); },
    history: function () { hist.forEach(function (h, i) { say(("    " + (i + 1)).slice(-4) + "  " + h); }); },
    clear: function () { out.innerHTML = ""; },
    echo: function (args) { say(args.join(" ")); },
    sudo: function () { say("guest is not in the sudoers file. This incident will be reported."); },
    rm: function () { say("rm: cannot remove: Read-only file system", "err"); },

    open: function (args) {
      var key = (args[0] || "").toLowerCase();
      var url = D.links[key];
      if (!url) { say("usage: open <" + Object.keys(D.links).join("|") + ">", "err"); return; }
      say("opening " + url);
      window.open(url, "_blank", "noopener");
    }
  };
  cmds.dir = cmds.ls;
  cmds.ll = function (args) { cmds.ls(["-l"].concat(args)); };
  cmds.less = cmds.more = cmds.cat;

  async function runScript(path) {
    var r = resolve(path);
    if (!r.node) { say(path + ": No such file or directory", "err"); return; }
    if (!r.node.exec) { say(path + ": Permission denied", "err"); return; }
    var lines = r.node.content.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].trim().match(/^(step|impact)\s+"(.*)"$/);
      if (!m) continue;
      print('<span class="ok">[  OK  ]</span> ' + esc(m[2]), m[1] === "impact" ? "impact" : "");
      await sleep(380);
    }
  }

  function words(s) {
    var m = s.match(/"[^"]*"|'[^']*'|\S+/g) || [];
    return m.map(function (w) { return w.replace(/^["']|["']$/g, ""); });
  }

  async function run(input) {
    if (closed) return;
    input = input.trim();
    print(promptHTML() + esc(input));
    if (!input) return;
    hist.push(input);
    hpos = hist.length;
    var chunks = input.split("&&");
    for (var i = 0; i < chunks.length; i++) {
      var w = words(chunks[i]);
      if (!w.length) continue;
      var c = w[0], args = w.slice(1);
      if (c === "exit" || c === "logout" || c === "quit") {
        say("Connection to ragab closed.", "dim");
        closed = true;
        line.hidden = true;
        print('<span class="chip" data-reconnect="1">reconnect</span>', "chips");
        return;
      }
      if (c.indexOf("./") === 0) await runScript(c.slice(2));
      else if (c === "sh" || c === "bash") await runScript(args[0] || "");
      else if (cmds[c]) cmds[c](args);
      else say(c + ": command not found. Type 'help'.", "err");
    }
  }

  // ---- completion ------------------------------------------------------------
  function complete(value) {
    var lead = value.replace(/\S*$/, "");
    var word = value.slice(lead.length);
    var options;
    if (!lead.trim()) {
      options = COMMANDS.filter(function (c) { return c.indexOf(word) === 0; });
    } else {
      var slash = word.lastIndexOf("/");
      var head = slash >= 0 ? word.slice(0, slash) : "";
      var tail = slash >= 0 ? word.slice(slash + 1) : word;
      var r = resolve(head || ".");
      options = [];
      if (r.node && r.node.type === "dir") {
        Object.keys(r.node.children).forEach(function (n) {
          if (n.indexOf(tail) === 0 && (tail.charAt(0) === "." || n.charAt(0) !== ".")) {
            options.push((head ? head + "/" : "") + n + (r.node.children[n].type === "dir" ? "/" : ""));
          }
        });
      }
    }
    if (options.length === 1) return lead + options[0] + (options[0].slice(-1) === "/" ? "" : " ");
    if (options.length > 1) {
      print(promptHTML() + esc(value));
      say(options.join("  "), "dim");
      var prefix = options.reduce(function (a, b) { var i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });
      return lead + prefix;
    }
    return value;
  }

  // ---- input -----------------------------------------------------------------
  function render() {
    promptEl.innerHTML = promptHTML();
    typed.textContent = kbd.value;
  }

  async function submit(value) {
    busy = true;
    line.hidden = true;
    kbd.value = "";
    await run(value);
    busy = false;
    if (!closed) {
      line.hidden = false;
      render();
      window.scrollTo(0, document.body.scrollHeight);
      focus();
    }
  }

  function focus() {
    if (!line.hidden) kbd.focus({ preventScroll: true });
  }

  kbd.addEventListener("input", render);
  kbd.addEventListener("keydown", function (e) {
    if (busy) { e.preventDefault(); return; }
    if (e.key === "Enter") { e.preventDefault(); submit(kbd.value); }
    else if (e.key === "Tab") { e.preventDefault(); kbd.value = complete(kbd.value); render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (hpos > 0) { hpos--; kbd.value = hist[hpos]; render(); } }
    else if (e.key === "ArrowDown") { e.preventDefault(); hpos = Math.min(hist.length, hpos + 1); kbd.value = hist[hpos] || ""; render(); }
    else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); cmds.clear(); }
    else if (e.key === "c" && e.ctrlKey && !window.getSelection().toString()) {
      e.preventDefault(); print(promptHTML() + esc(kbd.value) + "^C"); kbd.value = ""; render();
    }
  });

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-cmd],[data-reconnect]") : null;
    if (t && t.getAttribute("data-reconnect")) { location.reload(); return; }
    if (t && !busy && !closed) { e.preventDefault(); submit(t.getAttribute("data-cmd")); return; }
    if (!window.getSelection().toString() && !(e.target.closest && e.target.closest("a"))) focus();
  });

  // ---- connect ---------------------------------------------------------------
  function banner() {
    var pre = document.createElement("pre");
    pre.className = "portrait";
    pre.setAttribute("role", "img");
    pre.setAttribute("aria-label", "ASCII portrait of Mohamed Ashraf Ragab");
    pre.textContent = D.portrait.web;
    out.appendChild(pre);
    print('<span class="name">' + esc(D.name) + "</span>");
    say(D.tagline, "dim");
  }

  async function connect() {
    say("$ ssh guest@ragab", "dim");
    await sleep(450);
    say("Connecting to ragab (mo7amed214.github.io)...", "dim");
    await sleep(550);
    say("Connected. Read-only session for guest.", "dim");
    await sleep(250);
    banner();
    print("");
    print('Type <span class="u">help</span> for commands, or click one to start:');
    print([
      ["ls", "ls"], ["cat about.txt", "cat about.txt"], ["cd projects", "cd projects && ls"],
      ["./attack-chain.sh", "cd ~/thesis && ./attack-chain.sh"], ["contact", "cat ~/contact.txt"]
    ].map(function (c) { return '<span class="chip" data-cmd="' + esc(c[1]) + '">' + esc(c[0]) + "</span>"; }).join(""), "chips");
    print("");
    busy = false;
    line.hidden = false;
    render();
    focus();
  }

  fetch("ragab/data.json")
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) { D = data; connect(); })
    .catch(function () {
      say("ssh: connect to host ragab: connection refused", "err");
      print('The same profile is at <a href="https://mo7amed214.github.io/">mo7amed214.github.io</a>.');
    });
})();
