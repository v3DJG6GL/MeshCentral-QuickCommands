# Changelog

## 0.1.2

- Live output: the output window now opens while a command is still running and
  fills up as the agent streams what the command prints (before, output only
  appeared once the command finished - a command that never finished showed
  nothing at all).
- Cancel: a running command can be cancelled from its output window; a running
  key can be clicked to open that window. Cancelling releases the browser side -
  the process itself keeps running on the device until it ends, because the
  MeshCentral agent has no way to kill it remotely.
- A second command started while the agent is still busy now fails immediately
  with a clear message instead of waiting silently for the 5-minute timeout
  (the agent executes one run command at a time and rejects the rest without a
  reply).
- The example "Group policy" key is now `echo n | gpupdate /force`: `gpupdate`
  can ask a logoff/restart question and then waits forever for an answer when
  run in the background; the piped "n" answers it with No.

## 0.1.1

- Fixed: on the modern (Bootstrap) web UI the output window never appeared and the
  interface stopped reacting to clicks until the page was reloaded. That UI needs
  `showModal()` in addition to `setDialogMode()`; without it the dialog stayed
  hidden while MeshCentral's `xxdialogMode` flag remained set, which blocks every
  click handler. All dialogs now work on both the classic and the modern UI.
- Fixed: "Run again" in the output window now closes the window before re-running.
- The editor follows the operating system's dark mode when opened in its own tab.

## 0.1.0

- First release: keys on the Terminal tab (strip or menu), General tab and the device's Plugins tab.
- Visual editor under My Server › Plugins with groups, drag-to-reorder, import/export.
- Run in the background with an output window and run log, or type into the terminal.
- Confirmation for dangerous commands, OS-aware visibility, night mode.
