<div align="center">

<img src="assets/icon-128.png" alt="Antigravity Status Logo" width="128" height="128">

# Antigravity Status

 Real-time AI quota monitoring in the status bar for Antigravity Editor

[![License: MIT](https://img.shields.io/badge/License-MIT-gray.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=flat-square)](https://github.com/yoruhub/antigravity-status)
[![Platform: Antigravity](https://img.shields.io/badge/Platform-Antigravity-0052cc.svg?style=flat-square)](https://github.com/yoruhub/antigravity-status)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg?style=flat-square)](https://nodejs.org/)
[![VS Code](https://img.shields.io/badge/VS%20Code-%3E%3D1.90.0-007acc.svg?style=flat-square)](https://code.visualstudio.com/)
[![i18n](https://img.shields.io/badge/i18n-en%2Fja-orange.svg?style=flat-square)](src/i18n/translations.ts)

English | [日本語](README.ja.md)

</div>

---

## Overview

**Antigravity Status** is a professional extension designed to monitor AI quota usage (such as Gemini 3 Pro and Claude) in real-time within the Antigravity Editor status bar.
Stay focused on your code and check your remaining quota and reset times without opening an external dashboard.

---

## Key Features

*   **Real-time Monitoring**: Connects directly to the local Antigravity process for the most up-to-date information.
*   **Status Bar Integration**: Visual indicators and percentages allow you to grasp usage at a glance.
*   **Detailed Monitoring**: Click to view a comprehensive list of all models, remaining percentages, and reset times.
*   **Smart Notifications**: Receive desktop alerts when your quota drops below customized thresholds.
*   **Model Management**: Easily hide or show specific models based on your needs. [x]

<div align="center">
  <img src="assets/screenshot-statusbar.png" alt="Status Bar Display" width="600">
</div>

---

## Usage

### 1. Connection
The extension automatically detects and connects to the background Antigravity process upon editor startup.

### 2. Monitoring Quota
Check the status bar in the bottom right of the editor to see the current remaining percentage for your active models.

### 3. Detailed View
Click on any status bar item to open the QuickPick menu, displaying reset times for each model and user account details.

<div align="center">
  <img src="assets/screenshot-details.png" alt="Quota Details Menu" width="500">
</div>

### 4. Customizing Model Visibility
Select "Manage Model Visibility" from the details menu to toggle which models are displayed in the status bar.

<div align="center">
  <img src="assets/screenshot-settings.png" alt="Model Visibility Settings" width="500">
</div>

---

## Installation

### Package Mode
To install via a `.vsix` file:
```bash
antigravity --install-extension antigravity-status-1.0.0.vsix
```

### Development Mode
To build from source:
```bash
git clone https://github.com/yoruhub/antigravity-status.git
cd antigravity-status
npm install
npm run compile
```

---

## Configuration

Customize the extension via the editor settings (`antigravityStatus`):

| Setting | Description | Default |
|:---|:---|:---|
| `refreshInterval` | Data refresh interval in seconds | `120` |
| `notificationThreshold` | Quota percentage threshold to trigger notifications | `30` |
| `showNotifications` | Enable or disable threshold notifications | `true` |
| `statusBarPosition` | Status bar alignment (`left` or `right`) | `right` |
| `hiddenModels` | List of Model IDs to hide from the status bar | `[]` |

---

## Development & Contribution
Please report bugs or request features via GitHub Issues. Pull requests are always welcome. [x]

## License
[MIT License](LICENSE) &copy; 2026 yoru (YoRuHub)
