# Bulk Move Notes – Thymer Plugin

Select a collection, choose notes from it, and move them into another collection. Built with the [Thymer Plugin SDK](https://github.com/thymerapp/thymer-plugin-sdk).

## Features

- **Command palette**: Run **"Bulk move notes to another collection"** (Ctrl+P / Cmd+P → Plugins, or command palette).
- **From collection**: Pick the source collection; its notes are listed with checkboxes.
- **Notes to move**: Select one or more notes.
- **To collection**: Pick the target collection (cannot be the same as source).
- **Move selected**: Copies each selected note into the target collection (title + body/line items). Original notes stay in the source collection; you can delete them manually if you want a true “move.”

## Installation

### Option A: Paste into Thymer (no build)

1. In Thymer, open **Command Palette** (Ctrl+P / Cmd+P) → **Plugins**.
2. **Create Plugin** → choose a **Global (App) Plugin**.
3. In the plugin’s **Edit Code**:
   - **Configuration**: paste the contents of `plugin.json`.
   - **Custom Code**: paste the contents of `plugin.js` **and remove the `export` keyword** (use `class Plugin extends AppPlugin` without `export`). Remove any `import` lines if present.
4. Save. The command **"Bulk move notes to another collection"** will appear in the command palette.

### Option B: Develop with Hot Reload (SDK repo)

1. Clone the [Thymer Plugin SDK](https://github.com/thymerapp/thymer-plugin-sdk) and run `npm install`.
2. Copy this repo’s `plugin.js` and `plugin.json` over the SDK’s `plugin.js` and `plugin.json`.
3. Follow the SDK README to start Chrome with remote debugging and enable **Plugin Hot Reload** in Thymer.
4. Run `npm run dev` in the SDK repo; edit `plugin.js` / `plugin.json` and save to hot-reload.
5. When done, copy the built `dist/plugin.js` into Thymer’s Custom Code (and remove `export` if you paste there).

## Requirements

- At least two **non-journal** collections. Journal collections are excluded from the dropdowns.
- Notes are **copied** (title + content) into the target collection; the SDK may not expose a single “move” API, so originals are left in place.

## Files

- `plugin.json` – Plugin name, icon, description, command palette visibility.
- `plugin.js` – App plugin: command, modal UI (source/target collections, note list, move action), and `copyRecordContent` for copying line items between records.

## License

Use and modify as you like. Thymer Plugin SDK is subject to its own license.
