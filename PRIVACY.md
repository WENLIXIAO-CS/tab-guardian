# Privacy Policy — Tab Guardian

**Last updated:** 2024-12-01

## Data Collection

Tab Guardian does **not** collect, transmit, or share any user data. No personal information, browsing history, or tab contents are ever sent to external servers.

## Local Storage

Tab activity timestamps (when each tab was last active) are stored locally on your device using `chrome.storage.local`. This data never leaves your browser and is used solely to determine which tabs are idle.

## Analytics and Tracking

Tab Guardian contains **no** analytics, telemetry, or tracking of any kind.

## Third-Party Services

Tab Guardian does **not** communicate with any third-party services, APIs, or servers.

## Permissions

Tab Guardian requests the following permissions, used exclusively for local functionality:

| Permission | Purpose |
|---|---|
| `tabs` | Read tab titles and URLs to display in the popup |
| `alarms` | Schedule periodic checks for stale tabs |
| `notifications` | Alert you when stale tabs accumulate |
| `storage` | Store tab activity timestamps locally |
| `system.memory` | Display system memory usage |
| `favicon` | Show tab favicons in the popup |
| `scripting` | Measure per-tab JS heap and storage usage |
| `browsingData` | Clear cache and site data when requested by the user |
| `host_permissions` (`<all_urls>`) | Required for per-tab memory measurement via `scripting` |

## Contact

For questions about this privacy policy, please open an issue on the project's GitHub repository.
