# MeshCentral Quick Commands

One-click keys for the commands you type again and again — `ipconfig /all`, `gpupdate /force`, `shutdown /r /f /t 0`, `df -h` — right on the device pages of MeshCentral.

![Keypad strip on the Terminal tab](https://raw.githubusercontent.com/v3DJG6GL/MeshCentral-QuickCommands/main/docs/terminal-strip.png)

## What you get

| Where | What |
| --- | --- |
| **Terminal tab** | A strip of keys under the toolbar, or a *Quick commands* menu button inside it. Each person can switch between the two; the administrator picks the default. From 10 keys on, a filter box appears (**/** focuses it, **Esc** clears, **Enter** runs the last key standing; in the menu, **↑/↓ + Enter** pick one). |
| **General tab** | A *Quick commands* panel for the keys you flag "Show on General", with the same filter box from 10 keys on. |
| **Plugins › Quick Commands tab** | Every key for the device plus a run log with the output of everything you ran on this device - including group runs from My Devices. The log is kept per browser tab and survives a page reload. |
| **My Server › Plugins › Quick Commands** | The editor: groups, drag-to-reorder, device scoping, import/export as JSON. The edit panel is drag-resizable (remembered per browser) and expands to a centered dialog with **⤢**; multi-line commands get line numbers. |
| **My Devices — selection** | Check devices, press **⚡ Quick Commands** next to *Group Action* (or pick *⚡ Run quick command* inside Group Action). A picker shows which commands fit how many of the selected devices; the run opens a results window with a live row per device. Closing a device's output window leads back to the overview; while a run is around, a results button with live counts sits next to ⚡ Quick Commands (and a matching pill in the bottom right corner on every other page) to re-open it. |
| **My Devices — right-click** | A **⚡ Quick Commands** flyout in the device context menu runs a command on that device directly. Shown only on connected agents you may run commands on. |

Every key shows its **name and the literal command**, a badge for the shell (`CMD`, `PS`, `SH`, `AGENT`), and only appears on devices it applies to (CMD/PowerShell on Windows, SH elsewhere, agent-console commands everywhere).

Keys and whole groups can additionally be **scoped to devices** — *All devices*, *Only these…* or *All except…*, with device groups, tags and single devices as targets. The editor previews the effective reach live (*"Appears on 37 of 112 devices"*), and scoped keys carry a funnel badge. A device must pass the group's rule **and** the key's rule; an empty *Only these…* matches no one. Scoping only hides keys — running still checks MeshCentral's permissions.

Two ways a key can run:

- **Run, show output** — runs in the background through the agent (like MeshCentral's *Run Commands*), as the agent or as the signed-in user. The output streams live into a window while the command runs, can be cancelled there, and is kept in the run log.
- **Type into terminal** — opens the Terminal tab, connects if needed, and types the command followed by Enter. Use this for anything interactive (`netsh`, `diskpart`, prompts that ask *Y/N*). Keys of this kind carry an amber `>_` badge and show their command as a miniature terminal line with a blinking cursor.

Keys can be flagged **Ask before running**: they get a red hazard stripe and a confirmation that shows the exact command.

Keys and whole groups can be given a **color** from a fixed palette — shown as a colored edge on the key and a colored group label, in both the light and dark theme. A command's own color wins over its group's color.

## Install

1. Enable plugins in `meshcentral-data/config.json`:
   ```json
   "settings": { "plugins": { "enabled": true } }
   ```
2. Restart MeshCentral, open **My Server › Plugins**, click **Download Plugin** and paste:
   ```
   https://raw.githubusercontent.com/v3DJG6GL/MeshCentral-QuickCommands/main/config.json
   ```
3. Enable the plugin and restart MeshCentral once.
4. Open **My Server › Plugins › Quick Commands** and add your commands (or click *Load example commands*).

Manual install: copy or clone this repository to `meshcentral-data/plugins/quickcommands` and list it under `settings.plugins.list` or enable it from the Plugins page.

## Supported web UIs

Works with both MeshCentral interfaces: the classic one and the modern (Bootstrap)
one, selected per user or with `"sitestyle": 3` in the domain configuration.

## Permissions

- Keys are shown to everyone who can see the device. Running them goes through MeshCentral's normal `runcommands` permission checks, so a user without *Remote Commands* rights gets *Access denied* instead of output.
- Only full site administrators can open the editor and change commands.

## Notes

- Commands in *Run, show output* mode also echo into the device's **Console** tab — that is how the agent reports them and cannot be changed by a plugin.
- *Agent console* commands (`netinfo`, `ps`, `services`, …) have no reply channel; the plugin collects what the agent prints for a few seconds and shows that.
- Agents run **one background command at a time**. A second key pressed while one is still running fails immediately with "the agent is still busy"; the error offers **Free the agent**, which kills the blocking command on the device. *Cancel* in the output window does the same for your own run. Both go through the agent console (`eval`), so they need agent console rights on the device.
- A background command that **asks a question** (`gpupdate /force` asking to restart, `choice`, `pause`) waits for an answer. Three ways to handle it: run the key in *Type into terminal* mode (first choice for interactive commands - a real console, live output, answer J/N yourself), pipe the answer in (`echo n | gpupdate /force`), or type the answer into the **input line** of the running output window - it goes to the command's stdin, followed by a fresh `exit` for the shell (the program swallowed the original one when it read the answer), so the run finishes on its own. The question itself is often invisible in run mode (see buffering above), so the answer may also be typed ahead of time; it is consumed when the question comes.
- Some programs **buffer their output** when it goes to a pipe instead of a console — `gpupdate` shows everything only when it finishes, so the live window may sit on the `cmd` banner for a while. That is the program's doing, not the agent's; run it in *Type into terminal* mode to watch it live.
- On non-English Windows, command output comes back in the OEM codepage and umlauts turn into garbage. Prefix the command with `chcp 65001 >nul & ` to get clean UTF-8 (see the example gpupdate key).
- MeshCentral's own `preconfiguredscripts` (config.json) still work; this plugin is the live-editable alternative.

## License

Apache-2.0
