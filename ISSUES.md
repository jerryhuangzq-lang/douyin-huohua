# Issue log

## #1 Scan misses most streak chats (2026-10-18)

**Symptom.** A run reported only 5-10 targets; many chats with a gray flame or `重燃中` never got the sticker. A later manual look at the top of the list showed 30+ gray chats. `--only "<name>"` answered `no target matching` for chats that were visibly gray.

**Root cause.** `jsStartScan` scrolled the virtualised list one page every 350 ms and read each row once per tick. The streak icon (`img.commonStreakicon`) is rendered asynchronously after a row mounts, so rows were collected before their icon existed and were classified as "no flame". The list also keeps loading older history while you scroll (461 rows in this account), so the fixed 25 s scan limit was often exceeded: `fatal: conversation list scan timed out`.

**Not the cause.** The skip logic (`isSent`) only reads today's `last-run.json` by chat name. It does not look at the `[续火花]` preview text, so an old sticker still visible in a row does not cause a skip.

**Secondary.** A scheduled run claims the Beijing day (`state.done`) before it starts, so chats that failed with `open chat: NOT_FOUND` were not retried until the next day.

**Fixed** by the scan changes below (#2) and CHANGELOG 2026-10-19. `猫坏` stopped failing once chats are opened through the search panel.

## #2 Chats not in the first page could not be opened (2026-10-19)

**Symptom.** After the scan fix, 8-11 chats per run still failed with `open chat: NOT_FOUND`, including chats that exist (`4422`, `myz`). The old fallback walked the whole conversation list and was slow and flaky.

**Root causes.**
- Searching a name shows a search panel (`.SearchPanelgroupbox` groups 联系人 / 群聊), not conversation rows. The chat only opens by clicking the row's 发消息 button (`.SearchPanelitemchat_btn`); the old code looked for conversation rows and never found them.
- The search panel does not appear while Chrome is in the background (`document.hasFocus()` is false). Setting the input value from a script then does nothing.
- Names with symbols or emoji do not search reliably.
- After opening a chat the drawer stays on the chat layer (`[data-stack-layer="chat"]`), so the next search started from the wrong screen.

**Fix.** See CHANGELOG 2026-10-19.
