#!/usr/bin/env node
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const S = CFG.selectors;
// State lives outside the package so it survives npm/brew upgrades and read-only installs.
const STATE_DIR = path.resolve(process.env.HUOHUA_HOME || path.join(require("os").homedir(), ".douyin-huohua"));
const LEGACY_STATE_DIR = path.join(ROOT, "state");
const STATE_FILE = path.join(STATE_DIR, "last-run.json");
const LOG_FILE = path.join(STATE_DIR, "huohua.log");
const AS_SCRIPT = path.join(__dirname, "chrome-js.applescript");

// Module-level so the fatal handler can record the failure after a throw.
let activeState = null;
let activeRun = false;

// One-time copy of the pre-0.2 in-package state; afterwards only STATE_DIR is used.
function migrateLegacyState() {
  try {
    if (path.resolve(LEGACY_STATE_DIR) === STATE_DIR) return;
    if (fs.existsSync(STATE_FILE) || !fs.existsSync(path.join(LEGACY_STATE_DIR, "last-run.json"))) return;
    fs.mkdirSync(STATE_DIR, { recursive: true });
    for (const name of ["last-run.json", "huohua.log"]) {
      const src = path.join(LEGACY_STATE_DIR, name);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STATE_DIR, name));
    }
    log(`migrated state from ${LEGACY_STATE_DIR}`);
  } catch (_) {
    // Best-effort: a failed copy just means a fresh day, never a crash.
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(line) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`);
  } catch (_) {
    // Logging is best-effort; the sandboxed session cannot write here.
  }
}

function notify(message) {
  const safe = String(message).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  try {
    execFileSync("osascript", ["-e", `display notification "${safe}" with title "Douyin 续火花"`], {
      stdio: "ignore",
    });
  } catch (_) {
    // Notifications are best-effort.
  }
}

function runJs(js) {
  return execFileSync("osascript", [AS_SCRIPT, CFG.urlNeedle, js], { encoding: "utf8" }).trim();
}

const clickHelper =
  "const click=(el)=>{for(const ev of ['pointerdown','mousedown','pointerup','mouseup','click'])el.dispatchEvent(new MouseEvent(ev,{bubbles:true,cancelable:true,view:window}))};";

function classify(item) {
  const gray = String(item.iconSrc || "").includes(CFG.grayToken);
  const reignite = String(item.text || "").includes(CFG.reigniteToken);
  return { gray, reignite, need: gray || reignite };
}

function keyOf(item) {
  return `${item.name}|${item.avatarSrc}`;
}

function isSent(state, name) {
  const n = String(name).trim();
  return Object.keys(state.sent).some((k) => {
    const key = k.split("|")[0];
    // Older entries stored the whole collapsed row ("name streak time preview").
    return key === n || key.startsWith(n + " ");
  });
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadState() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (state.date === today() && state.sent && typeof state.sent === "object") return state;
  } catch (_) {
    // Missing or corrupt state starts a fresh day.
  }
  return { date: today(), sent: {} };
}

function saveState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

async function waitFor(js, ok, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value = runJs(js);
      if (ok(value)) return value;
    } catch (_) {
      // AppleScript can fail while Chrome or the page is still loading.
    }
    await sleep(intervalMs);
  }
  return null;
}

function jsSetSearch(text) {
  return `(function(){
    const inp=[...document.querySelectorAll('input')].find(i=>i.placeholder==='搜索');
    if(!inp)return 'NO_SEARCH';
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(inp,${JSON.stringify(text)});
    inp.dispatchEvent(new Event('input',{bubbles:true}));
    return 'OK';
  })()`;
}

function jsStartScan() {
  return `(function(){${clickHelper}
    const S=${JSON.stringify(S)};
    const first=document.querySelector(S.conversationItem);
    if(!first)return 'NO_ITEMS';
    let sc=first;
    while(sc&&sc!==document.body){
      if(sc.scrollHeight>sc.clientHeight+20)break;
      sc=sc.parentElement;
    }
    if(!sc)return 'NO_SCROLLER';
    window.__huohuaScan={items:{},done:false};
    const collect=()=>{
      [...document.querySelectorAll(S.conversationItem)].forEach(it=>{
        const icon=it.querySelector(S.streakIcon);
        const av=it.querySelector('img:not(.commonStreakicon)');
        const nm=it.querySelector(S.nameText);
        const lines=(it.innerText||'').split('\\n').map(s=>s.trim()).filter(Boolean);
        // innerText's first line can collapse name+streak+time into one string
        // while the drawer is mid-animation; the title node is stable.
        const name=((nm?nm.textContent:lines[0])||'').trim();
        const key=name+'|'+(av?av.src:'');
        window.__huohuaScan.items[key]={name,text:it.innerText||'',preview:lines[lines.length-1]||'',iconSrc:icon?icon.src:'',avatarSrc:av?av.src:''};
      });
    };
    sc.scrollTop=0;
    collect();
    let top=0;
    const id=setInterval(()=>{
      collect();
      top+=sc.clientHeight||600;
      sc.scrollTop=top;
      if(sc.scrollTop+sc.clientHeight>=sc.scrollHeight-2){
        collect();
        window.__huohuaScan.done=true;
        clearInterval(id);
      }
    },350);
    return 'STARTED';
  })()`;
}

async function scanAll() {
  runJs(jsSetSearch(""));
  await sleep(500);
  runJs(jsStartScan());
  const done = await waitFor(
    `(function(){return window.__huohuaScan&&window.__huohuaScan.done?'YES':'NO'})()`,
    (v) => v === "YES",
    25000,
    500
  );
  if (!done) throw new Error("conversation list scan timed out");
  const raw = runJs(`(function(){return JSON.stringify(Object.values(window.__huohuaScan.items))})()`);
  const items = JSON.parse(raw);
  runJs(`(function(){const S=${JSON.stringify(S)};const it=document.querySelector(S.conversationItem);let a=it;while(a&&a!==document.body){if(a.scrollHeight>a.clientHeight+20)break;a=a.parentElement}if(a)a.scrollTop=0;return 'OK'})()`);
  return items;
}

async function ensureReady() {
  let probe = "";
  try {
    probe = runJs("(function(){return location.href})()");
  } catch (_) {
    probe = "";
  }
  if (!probe || probe.includes("__NO_TAB__") || probe.includes("__NO_WINDOW__")) {
    execFileSync("open", ["-a", "Google Chrome", CFG.url]);
    await sleep(5000);
  }

  const imEntry = `(function(){return document.querySelector(${JSON.stringify(S.imEntry)})?'YES':'NO'})()`;
  let entry = await waitFor(imEntry, (v) => v === "YES", 20000, 1000);
  if (!entry) {
    // A cold Chrome start or a discarded tab can take far longer than 20 s; one
    // reload wakes it instead of failing the whole day.
    try {
      runJs("(function(){location.reload();return 'OK'})()");
    } catch (_) {
      // No douyin tab (yet); the second wait below covers the cold-start path.
    }
    entry = await waitFor(imEntry, (v) => v === "YES", 60000, 1500);
  }
  if (!entry) throw new Error("douyin page not loaded or not logged in (no im-entry)");

  runJs(`(function(){${clickHelper}
    const S=${JSON.stringify(S)};
    if(document.querySelector(S.imDialog))return 'ALREADY_OPEN';
    const e=document.querySelector(S.imEntry);
    if(!e)return 'NO_ENTRY';
    click(e);
    return 'CLICKED';
  })()`);

  const ready = await waitFor(
    `(function(){return document.querySelectorAll(${JSON.stringify(S.conversationItem)}).length>0?'YES':'NO'})()`,
    (v) => v === "YES",
    30000,
    700
  );
  if (!ready) throw new Error("private message list is empty (not logged in or failed to load)");

  return scanAll();
}

async function sendTo(target) {
  runJs(jsSetSearch(target.name));
  await sleep(800);

  let clicked = "NOT_FOUND";
  for (let attempt = 0; attempt < 3; attempt++) {
    clicked = runJs(`(function(){${clickHelper}
      const S=${JSON.stringify(S)};
      const NAME=${JSON.stringify(target.name)};
      const AV=${JSON.stringify(target.avatarSrc)};
      const items=[...document.querySelectorAll(S.conversationItem)];
      const it=items.find(x=>{
        const av=x.querySelector('img:not(.commonStreakicon)');
        const nm=x.querySelector(S.nameText);
        const lines=(x.innerText||'').split('\\n').map(s=>s.trim()).filter(Boolean);
        const name=((nm?nm.textContent:lines[0])||'').trim();
        return name===NAME && (av?av.src:'').includes(AV);
      });
      if(!it)return 'NOT_FOUND';
      it.scrollIntoView({block:'center'});
      click(it);
      return 'CLICKED';
    })()`);
    if (clicked === "CLICKED") break;
    await sleep(600);
  }
  if (clicked !== "CLICKED") return { ok: false, reason: `open chat: ${clicked}` };

  const editorReady = await waitFor(
    `(function(){return document.querySelector(${JSON.stringify(S.editor)})?'YES':'NO'})()`,
    (v) => v === "YES",
    6000,
    400
  );
  if (!editorReady) return { ok: false, reason: "chat editor did not appear" };

  runJs(`(function(){${clickHelper}
    const S=${JSON.stringify(S)};
    const ce=document.querySelector(S.editor);
    if(ce)ce.focus();
    if(!document.querySelector(S.emojiPanel)){
      const b=document.querySelector(S.emojiButton);
      if(!b)return 'NO_BUTTON';
      click(b);
    }
    return 'OK';
  })()`);

  const panel = await waitFor(
    `(function(){return document.querySelector(${JSON.stringify(S.emojiPanel)})?'YES':'NO'})()`,
    (v) => v === "YES",
    4000,
    400
  );
  if (!panel) return { ok: false, reason: "emoji panel did not open" };

  const emojiClick = runJs(`(function(){
    const S=${JSON.stringify(S)};
    const NAME=${JSON.stringify(CFG.emojiName)};
    const ce=document.querySelector(S.editor);
    if(ce)ce.focus();
    const d=[...document.querySelectorAll(S.emojiItemDesc)].find(e=>(e.textContent||'').trim()===NAME);
    if(!d)return 'NO_ITEM';
    const el=d.closest(S.emojiItem)||d.parentElement;
    el.scrollIntoView({block:'nearest'});
    const imgBox=el.querySelector('.emojiEmojiItemimgBox')||el.querySelector('img');
    if(!imgBox)return 'NO_IMAGE';
    imgBox.click();
    return 'CLICKED';
  })()`);
  if (emojiClick !== "CLICKED") return { ok: false, reason: `emoji item: ${emojiClick}` };

  // Clicking the sticker image is the send action itself. Do not verify by
  // counting message nodes: the chat list is virtualised and lags behind.
  await sleep(800);
  return { ok: true };
}

function selfTest() {
  const cases = [
    [{ iconSrc: "x/gray_normal.png", text: "A\n[续火花]" }, { need: true, gray: true }],
    [{ iconSrc: "x/normal_normal.png", text: "A" }, { need: false, gray: false }],
    [{ iconSrc: "x/normal_normal.png", text: "A\n重燃中 1/3" }, { need: true, reignite: true }],
    [{ iconSrc: "", text: "A\nhello" }, { need: false }],
    [{ iconSrc: "x/gray_normal.png", text: "A\n重燃中 2/3" }, { need: true, gray: true, reignite: true }],
  ];
  for (const [item, want] of cases) {
    const got = classify(item);
    for (const [k, v] of Object.entries(want)) {
      if (got[k] !== v) throw new Error(`self-test failed: ${JSON.stringify(item)} expected ${k}=${v}, got ${got[k]}`);
    }
  }
  const st = { sent: { "catbb|u": 1, "adee_7 🎀 何蓝天 5 天后消失|u": 2, "Yuy_1res 重燃中 1/3|u": 3 } };
  if (!isSent(st, "catbb")) throw new Error("self-test failed: exact name not matched");
  if (!isSent(st, "adee_7 🎀 何蓝天")) throw new Error("self-test failed: legacy collapsed key not matched");
  if (!isSent(st, "Yuy_1res")) throw new Error("self-test failed: legacy key with same prefix not matched");
  if (isSent(st, "Yuy")) throw new Error("self-test failed: prefix collision");
  console.log(`self-test passed (${cases.length} classification + 4 state cases)`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--version")) {
    console.log(JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version);
    return;
  }
  if (args.includes("--self-test")) {
    selfTest();
    return;
  }
  // Only commands that touch state migrate it; --version/--self-test/usage do no state I/O.
  if (["--mark-failed", "--mark-sent", "--dry-run", "--run"].some((f) => args.includes(f))) {
    migrateLegacyState();
  }

  if (args.includes("--mark-failed")) {
    const state = loadState();
    let lines = [];
    try {
      lines = fs.readFileSync(LOG_FILE, "utf8").split("\n");
    } catch (_) {
      console.log("no log file");
      return;
    }
    const start = lines.map((l) => l.includes("run start")).lastIndexOf(true);
    const names = new Set();
    for (const line of lines.slice(start >= 0 ? start : 0)) {
      const m = line.match(/\] fail (.*): /);
      if (m) names.add(m[1]);
    }
    for (const name of names) state.sent[`${name}|`] = new Date().toISOString();
    saveState(state);
    console.log(`marked ${names.size} failed-verification chats as sent today`);
    return;
  }

  if (args.includes("--mark-sent")) {
    const names = args
      .slice(args.indexOf("--mark-sent") + 1)
      .filter((a) => !a.startsWith("--"));
    const state = loadState();
    for (const name of names) state.sent[`${name}|`] = new Date().toISOString();
    saveState(state);
    console.log(`marked ${names.length} as sent today`);
    return;
  }

  const dryRun = args.includes("--dry-run");
  const hasRun = args.includes("--run");
  if (!dryRun && !hasRun) {
    console.log("usage: huohua.js --dry-run | --run | --self-test | --version | --mark-sent NAME... | --mark-failed [--only NAME]");
    process.exitCode = 64;
    return;
  }

  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : (args.find((a) => a.startsWith("--only=")) || "").split("=")[1] || null;

  const state = loadState();
  activeState = state;

  // launchd fires this every 10 min (and on wake); do real work at most once a day.
  // Routine skips stay out of the log: 144 silent ticks a day would drown the results.
  if (hasRun && !dryRun && args.includes("--scheduled")) {
    if (state.done) return;
    if (state.failedAt && Date.now() - Date.parse(state.failedAt) < 60 * 60 * 1000) return;
  }
  activeRun = !dryRun;

  const items = await ensureReady();
  let targets = items
    .map((item) => ({ ...item, ...classify(item) }))
    .filter((item) => item.need);

  if (only) {
    const norm = (s) => String(s || "").trim().toLowerCase();
    const exact = targets.filter((t) => norm(t.name) === norm(only));
    targets = exact.length > 0 ? exact : targets.filter((t) => norm(t.name).includes(norm(only)));
    if (targets.length === 0) {
      console.log(`no target matching "${only}" (need gray flame or 重燃中)`);
      return;
    }
  }

  if (dryRun) {
    if (targets.length === 0) {
      console.log("no targets (gray flame or 重燃中)");
      return;
    }
    for (const t of targets) {
      const tag = [t.gray ? "gray" : "", t.reignite ? "reignite" : ""].filter(Boolean).join("+");
      console.log(`[${tag}] ${t.name} — ${t.preview}`);
    }
    return;
  }

  const results = [];
  log("run start");
  for (const target of targets) {
    const key = keyOf(target);
    if (isSent(state, target.name)) {
      log(`skip ${target.name}: already sent today`);
      results.push({ name: target.name, ok: true, skipped: true });
      continue;
    }
    try {
      const result = await sendTo(target);
      if (result.ok) {
        state.sent[key] = new Date().toISOString();
        saveState(state);
        log(`ok ${target.name}`);
        results.push({ name: target.name, ok: true });
      } else {
        log(`fail ${target.name}: ${result.reason}`);
        results.push({ name: target.name, ok: false, reason: result.reason });
      }
    } catch (err) {
      log(`fail ${target.name}: ${err.message}`);
      results.push({ name: target.name, ok: false, reason: err.message });
    }
  }

  runJs(jsSetSearch(""));

  const sent = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.ok);

  if (failed.length === 0) {
    state.done = true;
    delete state.failedAt;
  } else {
    state.failedAt = new Date().toISOString();
  }
  saveState(state);
  const summary = `续火花: sent ${sent}, skipped ${skipped}, failed ${failed.length}`;
  console.log(summary);
  for (const f of failed) console.log(`  FAIL ${f.name}: ${f.reason}`);
  notify(summary);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  if (activeRun && activeState) {
    activeState.failedAt = new Date().toISOString();
    saveState(activeState);
  }
  log(`fatal: ${err.message}`);
  notify(`续火花失败: ${err.message}`);
  console.error(`fatal: ${err.message}`);
  process.exitCode = 2;
});
