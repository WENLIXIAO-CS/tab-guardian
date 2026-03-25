# Tab Guardian

A Chrome extension that monitors your tab usage, detects stale tabs, and helps you free up memory with one click.

## Features

- **Stale tab detection** — automatically identifies tabs idle beyond a configurable threshold (15m to 4h)
- **System memory monitor** — real-time memory usage bar and percentage in the popup
- **Per-tab memory stats** — see JS heap and storage usage for each open tab
- **Bulk cleanup** — close all stale tabs with a single click
- **Clear site data** — wipe cache, localStorage, IndexedDB, and service workers per tab
- **Smart notifications** — alerts when you have too many tabs or stale tabs accumulate
- **Badge counter** — shows tab count or stale tab count on the extension icon
- **Dark/light theme** — follows your system preference automatically

## Installation

### Chrome Web Store

Install directly from the [Chrome Web Store](https://chrome.google.com/webstore).

### From source

1. Clone this repository:
   ```bash
   git clone https://github.com/user/tab-guardian.git
   cd tab-guardian
   ```
2. Install dependencies and build CSS:
   ```bash
   npm install
   npx tailwindcss -i input.css -o popup.css --minify
   ```
3. Open `chrome://extensions` in Chrome
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** and select the `tab-guardian` folder

## Usage

1. Click the Tab Guardian icon in your toolbar to open the popup
2. View stats at the top: total tabs, stale count, and memory usage
3. Adjust the idle threshold with the dropdown (15m / 30m / 1h / 2h / 4h)
4. **Close stale tabs** — click the red "Close N stale" button to bulk-close all idle tabs
5. **Clear site data** — click the refresh icon on any tab row to clear its cache and storage
6. **Close a single tab** — click the X icon on any tab row
7. Click any tab row to switch to that tab

## Build

Requires Node.js.

```bash
npm install
npx tailwindcss -i input.css -o popup.css --minify
```

The built `popup.css` is already included in the repo, so you can load the extension without building if you prefer.

## Screenshots

<!-- Add screenshots here -->
<!-- ![Popup light](screenshots/popup-light.png) -->
<!-- ![Popup dark](screenshots/popup-dark.png) -->

## Privacy

Tab Guardian does not collect, transmit, or share any user data. All tab activity data is stored locally using `chrome.storage.local`. See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## License

[MIT](LICENSE)
