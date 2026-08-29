# Changelog

## 0.3.2

- **Group chips** next to the keyword filter on the Terminal strip, in the
  Terminal menu and on the General panel, shown as soon as a device has keys
  from **2 or more groups** (they were in the design but had not made it into
  0.3.0). A chip narrows the keys to that group; several chips combine; the
  text filter narrows further. Chips carry the group's color dot; *Clear*
  resets chips and text together. Clicking a chip inside the menu keeps the
  menu open.

## 0.3.1

- The keyword filter appears from **5 keys** on (was 10 - too high for a
  typical device, which left most setups without a filter at all).

## 0.3.0

- **Scoping — "Appears on"**: every command, and every group, can now be
  limited to specific devices: *All devices* (default), *Only these…* or
  *All except…*, with device groups, tags and single devices as targets.
  Targets combine as a union; a device must pass the group's rule **and**
  the key's rule, so a key can narrow its group's reach but never widen it.
  An empty *Only these…* matches **no** devices (never everyone). While
  editing, a live preview shows *"Appears on 37 of 112 devices"*; scoped
  keys and groups carry a small funnel badge with that count. A deleted
  target shows as a warning chip and matches nothing. Scoping only hides
  keys — running still goes through MeshCentral's normal permissions.
  Group rules live under the new **Scope…** tool on the group heading.
- **Keyword filter** on the Terminal strip, the Terminal menu and the
  General panel, shown once a device has 5 or more keys. Case-insensitive
  match over name, command and group with the hit highlighted in place;
  group chips stay; empty groups disappear. **/** jumps into the filter
  (never while a terminal is connected or while typing elsewhere), **Esc**
  clears then leaves, **Enter** runs the single remaining key. In the menu
  the filter sits pinned at the top, is focused when the menu opens, and
  **↑/↓ + Enter** pick a command without touching the mouse. The filter is
  never persisted — keys can't go missing mysteriously tomorrow.
- **Roomier editor**: the add/edit panel has a drag rail (320 px – 70 % of
  the window, double-click resets, arrow keys nudge) and remembers its
  width per browser. **⤢** opens the same form as a large centered dialog,
  **⤡** puts it back — the last-used mode is remembered too. The command
  box is monospace with soft-wrap off, grows with the script up to ~40 %
  of the window, and shows line numbers from the fourth line on.
- Fixed: 0.2.4 made the group heading reserve space for its tools, which
  wrapped the first group's header onto two lines. The tools take no space
  again; the fade in/out and the grace period before they disappear stay
  (via a CSS display transition; older browsers get the pre-0.2.4 instant
  toggle).

## 0.2.4

- The group tools in the editor (color swatches, Rename, Up, Down, Delete
  group) no longer pop in and out abruptly: they fade in on hover, stay for a
  short grace period after the cursor leaves before fading out, and remain
  visible while one of their buttons has focus. The group header also no
  longer changes width on hover.

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
