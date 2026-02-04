# Antigravity Status

> 🚀 Antigravity/Windsurf/CursorのAIクォータ使用状況をVS Codeステータスバーで監視

## 機能

- **リアルタイム監視**: ローカルのAntigravityプロセスに直接接続してクォータ情報を取得
- **ステータスバー表示**: 🟢🟡🔴 でクォータ残量を一目で確認
- **詳細表示**: クリックで全モデルのクォータ状況をQuickPickで表示
- **通知**: クォータが危険レベルになると警告通知

## インストール

### 開発版

```bash
# リポジトリをクローン
git clone https://github.com/your-username/antigravity-status.git
cd antigravity-status

# 依存関係をインストール
npm install

# コンパイル
npm run compile

# VS Codeでデバッグ実行 (F5)
```

### パッケージ版

```bash
# VSIXファイルを作成
npm run package

# VS Codeにインストール
code --install-extension antigravity-status-0.1.0.vsix
```

## 使用方法

1. **Windsurf/Cursorを起動**: 拡張機能はローカルのAntigravityプロセスに接続します
2. **ステータスバーを確認**: 右下にクォータ表示が現れます
3. **詳細を見る**: ステータスバーをクリックして全モデルの状況を確認

## 設定

| 設定 | 説明 | デフォルト |
|------|------|----------|
| `antigravityStatus.refreshInterval` | 更新間隔（秒） | 120 |
| `antigravityStatus.warningThreshold` | 警告閾値（%） | 30 |
| `antigravityStatus.criticalThreshold` | 危険閾値（%） | 10 |
| `antigravityStatus.showNotifications` | 通知を表示 | true |
| `antigravityStatus.statusBarPosition` | 表示位置 | right |

## コマンド

- `Antigravity Status: Refresh Quota` - 手動でクォータを更新
- `Antigravity Status: Show Quota Details` - 詳細を表示

## 動作環境

- VS Code 1.90.0 以上
- Windsurf、Cursor、またはAntigravity対応エディタが実行中であること

## ライセンス

MIT
