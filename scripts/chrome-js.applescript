on run argv
  set needle to item 1 of argv
  set js to item 2 of argv
  tell application "Google Chrome"
    try
      if (count of windows) = 0 then return "__NO_WINDOW__"
    on error
      return "__NO_WINDOW__"
    end try
    repeat with w in windows
      repeat with t in tabs of w
        try
          if (URL of t as text) contains needle then
            return execute t javascript js
          end if
        end try
      end repeat
    end repeat
  end tell
  return "__NO_TAB__"
end run
