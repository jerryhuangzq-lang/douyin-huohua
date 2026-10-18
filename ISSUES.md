# Issue log

## #1 Scan misses most streak chats (2026-10-18)

**Symptom.** A run reported only 5-10 targets; many chats with a gray flame or `重燃中` never got the sticker. A later manual look at the top of the list showed 30+ gray chats. `--only "<name>"` answered `no target matching` for chats that were visibly gray.

**Root cause.** `jsStartScan` scrolled the virtualised list one page every 350 ms and read each row once per tick. The streak icon (`img.commonStreakicon`) is rendered asynchronously after a row mounts, so rows were collected before their icon existed and were classified as "no flame". The list also keeps loading older history while you scroll (461 rows in this account), so the fixed 25 s scan limit was often exceeded: `fatal: conversation list scan timed out`.

**Not the cause.** The skip logic (`isSent`) only reads today's `last-run.json` by chat name. It does not look at the `[续火花]` preview text, so an old sticker still visible in a row does not cause a skip.

**Secondary.** A scheduled run claims the Beijing day (`state.done`) before it starts, so chats that failed with `open chat: NOT_FOUND` were not retried until the next day.

**Open.** `猫坏` still fails with `open chat: NOT_FOUND` even through `--only`; name or avatar URL matching in `jsClickTarget` is the suspect.
