# Changelog

## 0.1.5

- Answering a question through the input line now finishes the run: the shell
  gets a fresh `exit` after each answer, because the program that asked had
  swallowed the original one - before this, the shell sat at a new prompt
  forever after the command completed, still counting as running.
- The answer can be typed ahead of time, while the command is still working:
  questions are usually invisible in run mode (the program buffers its output
  on a pipe and everything appears only when it exits), and a pre-typed answer
  is consumed the moment the question comes.
- Internal feedback lines ("quickcommands: input sent") no longer appear in
  the output window.

## 0.1.4

- Interactive background commands: the output window of a running command has
  an **input line** now - what you type is written to the command's stdin on
  the device, so a question like gpupdate's "restart? (J/N)" can be answered.
  The question itself is often invisible while running (programs buffer their
  output on a pipe), so for properly interactive commands *Type into terminal*
  remains the first choice.
- The example "Group policy" key runs in the terminal now, where gpupdate
  shows its output live and the restart question can be answered; a new
  example "Group policy (silent)" keeps the hands-off background variant.

## 0.1.3

- Cancel now really cancels: it kills the running command on the device through
  the agent console (`taskkill /F /T` on Windows takes the command's own process
  down with the shell), which frees the agent for new run commands and brings
  back the output collected so far. Needs agent console rights; without them the
  browser side is released after 10 seconds as before.
- New **Free the agent** button on "agent is still busy" and timeout errors:
  kills whatever run command is blocking the agent, also one started by someone
  else or before a page reload - no more agent restart to recover.
- The example "Group policy" key is now
  `chcp 65001 >nul & echo n | gpupdate /force`: gpupdate buffers its output when
  it goes to a pipe, so everything appears at the end - chcp 65001 keeps umlauts
  readable in what comes back.

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
