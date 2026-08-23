# MeshCentral Quick Commands

One-click keys for the commands you type again and again — `ipconfig /all`, `gpupdate /force`, `shutdown /r /f /t 0`, `df -h` — right on the device pages of MeshCentral.

![Keypad strip on the Terminal tab](https://raw.githubusercontent.com/v3DJG6GL/MeshCentral-QuickCommands/main/docs/terminal-strip.png)

## What you get

| Where | What |
| --- | --- |
| **Terminal tab** | A strip of keys under the toolbar, or a *Quick commands* menu button inside it. Each person can switch between the two; the administrator picks the default. |
| **General tab** | A *Quick commands* panel for the keys you flag "Show on General". |
| **Plugins › Quick Commands tab** | Every key for the device plus a run log with the output of everything you ran this session. |
| **My Server › Plugins › Quick Commands** | The editor: groups, drag-to-reorder, import/export as JSON. |

Every key shows its **name and the literal command**, a badge for the shell (`CMD`, `PS`, `SH`, `AGENT`), and only appears on devices it applies to (CMD/PowerShell on Windows, SH elsewhere, agent-console commands everywhere).

Two ways a key can run:

- **Run, show output** — runs in the background through the agent (like MeshCentral's *Run Commands*), as the agent or as the signed-in user. The output streams live into a window while the command runs, can be cancelled there, and is kept in the run log.
- **Type into terminal** — opens the Terminal tab, connects if needed, and types the command followed by Enter. Use this for anything interactive (`netsh`, `diskpart`, prompts that ask *Y/N*). Keys of this kind are marked `›_`.

Keys can be flagged **Ask before running**: they get a red hazard stripe and a confirmation that shows the exact command.

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
- Agents run **one background command at a time**. A second key pressed while one is still running fails immediately with "the agent is still busy". *Cancel* in the output window only stops waiting — the agent offers no way to kill the process, so it stays busy until the command ends on its own (or the agent restarts).
- A background command that **asks a question** (`gpupdate /force` asking to log off, `choice`, `pause`) waits for an answer forever and blocks the agent. Pipe the answer in (`echo n | gpupdate /force`) or use *Type into terminal* mode for it.
- MeshCentral's own `preconfiguredscripts` (config.json) still work; this plugin is the live-editable alternative.

## License

Apache-2.0
