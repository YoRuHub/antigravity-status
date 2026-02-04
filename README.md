# Antigravity Status

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-orange.svg)](https://github.com/yoruhub/antigravity-status)
[![Platform: Antigravity](https://img.shields.io/badge/Platform-Antigravity-blue.svg)](https://github.com/yoruhub/antigravity-status)

**Antigravity Status** は、Antigravity エディタの AI クォータ使用状況をステータスバーでリアルタイムに監視するための拡張機能です。

---

## 主な機能

- **リアルタイム監視**: ローカルの Antigravity プロセスに直接接続し、最新のクォータ情報を取得。
- **ステータスバー表示**: インジケーターで残量を一目で把握。
- **詳細モニタリング**: ステータスバーをクリックして、全モデルの残量とリセット時間を一覧表示。
- **スマート通知**: クォータが閾値を下回った際にデスクトップ通知でお知らせ。
- **モデル管理**: 表示不要なモデルを個別に非表示設定可能。 [x]

![ステータスバーの表示例](assets/screenshot-statusbar.png)

---

## インストール

### パッケージ版 (推奨)
1. Marketplace からインストール。
2. または、出力された `.vsix` ファイルを使用してインストール：
   ```bash
   antigravity --install-extension antigravity-status-1.0.0.vsix
   ```

### 開発版
```bash
git clone https://github.com/yoruhub/antigravity-status.git
cd antigravity-status
npm install
npm run compile
```

---

## 使用方法

1. **エディタを起動**: Antigravity エディタを通常通り起動してください。
2. **ステータスバーを確認**: エディタの右下に AI モデルのクォータ状況が表示されます。
3. **詳細を表示**: クリックすると詳細なメニューが開き、モデルごとのリセット時間等を確認できます。

![詳細メニューの表示例](assets/screenshot-details.png)


### モデルの表示管理
特定のモデルのみを表示したい場合は、詳細メニューからモデルの選択を切り替えることで、ステータスバーに表示する項目をカスタマイズできます。

![モデル表示管理画面](assets/screenshot-settings.png)

---

## 設定 (Configuration)

設定画面から以下の項目をカスタマイズ可能です：

| キー | 説明 | デフォルト |
|:---|:---|:---|
| `antigravityStatus.refreshInterval` | データ更新の間隔（秒） | `120` |
| `antigravityStatus.warningThreshold` | 警告を表示する残量閾値（%） | `30` |
| `antigravityStatus.criticalThreshold` | 危険（赤）を表示する残量閾値（%） | `10` |
| `antigravityStatus.showNotifications` | 閾値超過時の通知の有効/無効 | `true` |
| `antigravityStatus.statusBarPosition` | ステータスバーの表示位置 (`left` / `right`) | `right` |

---

## 開発と貢献

バグ報告や機能要望は Issues にてお寄せください。プルリクエストも歓迎しています。 [x]

## ライセンス

[MIT License](LICENSE) &copy; 2026 yoru (YoRuHub)
