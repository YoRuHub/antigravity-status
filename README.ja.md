<div align="center">

<img src="assets/icon-128.png" alt="Antigravity Status Logo" width="128" height="128">

# Antigravity Status

 Antigravity エディタの AI クォータ使用状況をステータスバーでリアルタイムに監視

[![License: MIT](https://img.shields.io/badge/License-MIT-gray.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg?style=flat-square)](https://github.com/YoRuHub/antigravity-status)
[![Platform: Antigravity](https://img.shields.io/badge/Platform-Antigravity-0052cc.svg?style=flat-square)](https://github.com/yoruhub/antigravity-status)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg?style=flat-square)](https://nodejs.org/)
[![VS Code](https://img.shields.io/badge/VS%20Code-%3E%3D1.90.0-007acc.svg?style=flat-square)](https://code.visualstudio.com/)
[![i18n](https://img.shields.io/badge/i18n-en%2Fja-orange.svg?style=flat-square)](src/i18n/translations.ts)

[English](README.md) | 日本語

</div>

---

## 概要

**Antigravity Status** は、Antigravity エディタの AI クォータ（Gemini 3 Pro や Claude 等）の使用状況をステータスバーでリアルタイムに監視するためのプロフェッショナルな拡張機能です。
外部のダッシュボードを確認することなく、コーディング中に現在の残りクォータとリセット時間を確認できます。

---

## 主な機能

*   **リアルタイム監視**: ローカルの Antigravity プロセスに直接接続し、最新のクオリティ情報を取得。
*   **ステータスバー表示**: パーセンテージとカラーインジケーターで残量を一目で把握。
*   **詳細モニタリング**: クリックで全モデルの残量とリセット時間を一覧表示。
*   **スマート通知**: クォータが閾値を下回った際にデスクトップ通知でお知らせ。
*   **モデル管理**: 表示不要なモデルを個別に非表示設定可能。 [x]

<div align="center">
  <img src="assets/screenshot-statusbar.png" alt="Status Bar Display" width="600">
</div>

---

## 使用方法

### 1. 接続の確認
Antigravity エディタを起動すると、自動的にバックグラウンドプロセスを検出して接続を開始します。

### 2. クォータの確認
エディタ右下のステータスバーを確認してください。各モデルの残量がパーセンテージで表示されます。

### 3. 詳細情報の表示
ステータスバーの項目をクリックすると、QuickPick メメニューが開き、モデルごとのリセット時間やユーザーのアカウント情報を確認できます。

<div align="center">
  <img src="assets/screenshot-details.png" alt="Quota Details Menu" width="500">
</div>

### 4. 表示モデルのカスタマイズ
詳細メニューから「表示モデルの設定」を選択することで、ステータスバーに表示するモデルを自由に切り替えることができます。

<div align="center">
  <img src="assets/screenshot-settings.png" alt="Model Visibility Settings" width="500">
</div>

---

## インストール

### パッケージ版
.vsix ファイルを使用してインストールする場合：
```bash
antigravity --install-extension antigravity-status-0.0.1.vsix
```

### 開発版
ソースコードからビルドする場合：
```bash
git clone https://github.com/yoruhub/antigravity-status.git
cd antigravity-status
npm install
npm run compile
```

---

## 設定 (Configuration)

エディタの設定画面（`antigravityStatus`）から以下の項目をカスタマイズ可能です：

| 設定項目 | 説明 | デフォルト値 |
|:---|:---|:---|
| `refreshInterval` | データ更新の間隔（秒） | `120` |
| `notificationThreshold` | 通知を送信する残量の閾値（%） | `30` |
| `showNotifications` | 閾値超過時の通知の有効/無効 | `true` |
| `statusBarPosition` | ステータスバーの表示位置 (`left` / `right`) | `right` |
| `hiddenModels` | 非表示にするモデル ID のリスト | `[]` |

---

## 開発と貢献
バグ報告や機能要望は GitHub Issues にてお寄せください。プルリクエストも歓迎しています。 [x]

## ライセンス
[MIT License](LICENSE) &copy; 2026 yoru (YoRuHub)
