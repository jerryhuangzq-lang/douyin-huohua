# Changelog

## 2026-10-18 - final report lists names

- End of `--run` now prints the sent, already-sent-today (not re-sent) and failed chat names, not just counts.

## 2026-10-18 - fix missed streak chats (issue #1)

- Scan interval 350 ms -> 1500 ms so async streak icons are rendered before a row is read.
- A later read of the same row without an icon no longer overwrites an earlier read that had one.
- Scan timeout 25 s -> 150 s for long conversation lists.

Result: a run that used to find about 10 targets now finds 30+; 26 sent in one run, 4 more by `--only` retries.
