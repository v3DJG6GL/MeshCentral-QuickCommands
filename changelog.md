# Changelog

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
