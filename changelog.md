# Changelog

## 0.2.3

- Fixed: a **multi-line PowerShell command** could run forever with no output.
  The agent feeds background runs line by line into `powershell -command -`,
  whose reader collects a multi-line block (if/else, loop, function) until a
  *blank* line submits it - a script ending with a block swallowed the closing
  `exit` and waited forever, blocking the agent's run slot, and a blank line
  inside a block submitted it half-finished. Multi-line PowerShell commands
  are now shipped as a single self-decoding (base64) line, which avoids the
  line reader entirely - blank lines, here-strings and umlauts all survive
  unchanged. A run that is already stuck the old way can be freed by pressing
  **Send** with an empty answer box (the sent blank line submits the pending
  block), or with *Free the agent*.

## 0.2.2

- The results of a group run moved into the My Devices toolbar: a **results
  button** appears next to *⚡ Quick Commands* while a run is around - spinner
  or ⚡, the command's name, live `2✓ 1✗` counts and a dismiss ×. Clicking it
  re-opens the results overview; unlike *Quick Commands* it works without a
  selection. On every other page the floating bottom-right pill stays, redrawn
  in the same style with the same counts; the two hand over automatically as
  you navigate.
- macOS devices get their own count in the multi-select picker instead of
  being lumped into "Linux / other" (now "Linux / BSD").
- The *⚡ Quick Commands* toolbar button uses the modern UI's own Bootstrap
  sizing, matching the height of *Select All* / *Group Action* and the gap
  before the filter box; on the classic UI it keeps the keycap look with the
  missing right margin added.

## 0.2.1

- The results window of a group run can be found again: closing the output
  window of one device leads back to the results overview (OK button), and a
  small **⚡ pill** in the bottom right corner of the page brings the overview
  back after it was closed - it shows the command and the live done/failed
  count, stays until the next group run and can be dismissed with its ×.
- The **run log** on the device's Plugins tab now also lists group runs that
  touched this device (marked "group run"), and it survives a page reload:
  the log is kept per browser tab (large outputs are capped at 100 kB in the
  saved copy). A run that was still going when the page reloaded is closed
  with a note - its stream cannot be picked up again.
- Log entries are filtered per device instead of being wiped when switching
  devices, so coming back to a device shows its earlier runs again; *Clear*
  only clears the shown device's entries.

## 0.2.0

- Quick commands come to the My Devices page, in two ways:
  - **Selection:** a keycap-styled **⚡ Quick Commands** button next to *Group
    Action* (and a *⚡ Run quick command* operation inside the Group Action
    dialog itself). Both open a picker that shows every command as a key,
    annotated with how many of the selected devices it applies to ("runs on
    3 of 4"); devices that are offline, without an agent or without the
    run-commands right are counted and skipped. Running opens a results
    window with one live row per device - status, duration, *View output*
    (with live streaming, the answer box and *Free the agent*, as on the
    device page) and *Cancel*.
  - **Right-click:** a **⚡ Quick Commands** entry in the device context
    menu with a flyout listing the commands that fit that device's OS,
    grouped and colored as everywhere else. One click runs the command;
    *Ask before running* keys still confirm first, and terminal-mode keys
    open the device's Terminal tab and type there. *All commands…* (and
    any list longer than 20) falls back to the picker dialog. The entry
    only appears on connected agents you may run commands on.
- The run pipeline is now routed per device (output, cancel, input and the
  busy detection follow the node a command ran on, not the page you are
  looking at) - this also fixes live output from two devices bleeding into
  each other when runs overlap.
- Works on both web UIs and in dark mode; fixed a modern-UI crash when a
  plugin dialog opens right after a core dialog built with
  `setModalContent()` (Group Action) - the core wipes `#id_dialogOptions`,
  which is now restored.

## 0.1.6

- Terminal-mode keys are finally recognisable in dark mode: instead of the
  faint `›_` glyph, they carry an amber `>_` badge next to the shell tag, and
  the command preview renders as a miniature terminal line - dark inset, green
  prompt, blinking cursor (still under `prefers-reduced-motion`). Applies to
  the strip, the menu, the admin editor and the Plugins-tab legend.
- Commands and groups can be colored from a fixed nine-color palette (picked
  in the admin editor - a swatch row on the command drawer and on each group
  heading). The color shows as a 4px edge on the key, an inset stripe on menu
  items and a colored label/dot on group headings, tuned for both themes. A
  command's own color overrides its group's color; group colors survive
  renames and are dropped with the group. Existing configurations look
  unchanged until a color is picked; the example set colors Network blue and
  Power red.

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
