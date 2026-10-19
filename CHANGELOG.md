# Changelog

## 2026-10-19 - open chats through the search panel (issue #2)

- Search uses only the longest letters/digits run of the name; symbols and emoji are dropped.
- Chrome is activated when the page has no focus, then the search box is clicked after the text is set.
- Only the first page of results is checked; no list walking on a miss. The chat opens by clicking 发消息 on the 联系人 row whose name matches (exact, else letters/digits only). 群聊 rows are never used.
- After each target the script leaves the chat (back button), cancels the search and clears it, and does the same before every scan.
- The scan waits until the mounted rows are unchanged for two polls before scrolling, instead of a fixed interval.

Result: all 38 targets of the day were reached; failures went 11 -> 0 in follow-up runs.

## 2026-10-18 - final report lists names

- End of `--run` now prints the sent, already-sent-today (not re-sent) and failed chat names, not just counts.

## 2026-10-18 - fix missed streak chats (issue #1)

- Scan interval 350 ms -> 1500 ms so async streak icons are rendered before a row is read.
- A later read of the same row without an icon no longer overwrites an earlier read that had one.
- Scan timeout 25 s -> 150 s for long conversation lists.

Result: a run that used to find about 10 targets now finds 30+; 26 sent in one run, 4 more by `--only` retries.
