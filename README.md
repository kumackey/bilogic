# Bilogic

AIディベートシステム。2つのAIエージェントが賛成・反対の立場でテーマについて議論し、第3のAI審判が勝者を判定します。

## デモ

https://github.com/user-attachments/assets/7080ce78-92ae-4a46-bf80-3562aef9a3a5

## 使い方

### 依存パッケージのインストール、ビルド

```bash
pnpm install
pnpm build
```

### 環境変数の設定

`.env`ファイルを作成し、Anthropic APIキーを設定してください。

```
ANTHROPIC_API_KEY=your_api_key_here
```

### 基本的な実行

```bash
pnpm start
```

### オプション一覧

| オプション | 短縮形 | 説明 | デフォルト |
|----------|--------|------|-----------|
| `--topic` | `-t` | ディベートのテーマ | 対話的に入力 |
| `--turns` | `-n` | ディベートのターン数 | 10 |
| `--help` | `-h` | ヘルプを表示 | - |

## 開発者向けドキュメント

技術スタック、アーキテクチャ、開発ガイドなどは [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) を参照してください。

## ライセンス

MIT
