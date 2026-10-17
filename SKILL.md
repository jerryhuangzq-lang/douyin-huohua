---
name: douyin-huohua
description: 抖音网页版自动续火花。检测私信列表里灰色火花（gray_normal）或「重燃中」的会话，逐个点开，从表情面板发送「续火花」贴纸。Use when the user says 续火花、续火、douyin streak, or asks to keep Douyin chat streaks alive.
---

# Douyin 自动续火花

Drive the user's logged-in Chrome (web Douyin) to send the built-in `续火花` sticker to every chat that needs it today.

## What counts as "needs it"

- Flame icon is gray: `img.commonStreakicon[src*="gray_normal"]`
- Conversation text contains `重燃中` (e.g. `重燃中 1/3`)
- Colored flame (`normal_normal.png`) and chats without a flame are skipped.

## Commands

```bash
# Self-check pure classification logic (safe, no Chrome)
node ~/.claude/skills/douyin-huohua/scripts/huohua.js --self-test

# List targets, send nothing
node ~/.claude/skills/douyin-huohua/scripts/huohua.js --dry-run

# Send now (asks no confirmation; only run when user wants messages sent)
node ~/.claude/skills/douyin-huohua/scripts/huohua.js --run

# Send to one chat only (exact name first, substring fallback)
node ~/.claude/skills/douyin-huohua/scripts/huohua.js --run --only "是啊R^ose"

# Recover from a false-negative verification: mark this run's failures as sent
node ~/.claude/skills/douyin-huohua/scripts/huohua.js --mark-failed

# Install / remove the daily 12:37 launchd job
bash ~/.claude/skills/douyin-huohua/scripts/install.sh
bash ~/.claude/skills/douyin-huohua/scripts/install.sh --uninstall
```

## Important: sandbox

The in-session Bash sandbox blocks `osascript`, so `--dry-run` / `--run` fail there with `Operation not permitted` or AppleScript errors. Run them in the user's own shell instead: tell the user to type

```
! node ~/.claude/skills/douyin-huohua/scripts/huohua.js --dry-run
```

The launchd job runs outside the sandbox and does not need Claude running.

## Behaviour

1. Reuse an existing `douyin.com` Chrome tab; open `https://www.douyin.com/jingxuan` if none exists.
2. Open the message drawer (`[data-e2e=im-entry]`).
3. Scroll the whole conversation list (it is virtualised; only ~12 rows are mounted at a time) and classify every chat by flame icon and `重燃中` text.
4. Focus the editor, open the emoji panel (`.messageMsgInputiconAction`), and click the sticker image (`.emojiEmojiItemimgBox`) whose description is `续火花`. Clicking the outer item does nothing; never use Enter to send.
5. Success = the sticker image click returned without error. Do not verify by flame color or message count: the flame stays gray until the other side replies, and the virtualised message list lags behind. A click counts as sent.
6. Done chats are recorded in `state/last-run.json` keyed by date, so re-running the same day sends nothing twice.
7. Results go to `state/huohua.log` and a macOS notification; exit 1 if any chat failed, 2 on Chrome/login failure.

## Troubleshooting

- `0 targets` while the list clearly shows gray flames → Douyin changed its DOM; update `config.json` selectors.
- `not authorized to send Apple events` / `-1743` → grant Automation access to `osascript` or the launcher in System Settings → Privacy & Security → Automation.
- Not logged in → open Douyin in Chrome and log in; the skill never handles credentials.
- Mac asleep at 12:37 → launchd runs the missed job on wake.
