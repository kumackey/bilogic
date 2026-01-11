# Bilogic - AI議論ツール

AIによるディベートシステム。2つのAIエージェントが特定のテーマについて議論し、第3のAI審判が勝者を判定します。

**LangGraph.js**を使用して、ディベートフローをグラフ構造で管理しています。

## 特徴

- **賛成派エージェント（Agent A）**: テーマに賛成の立場で論理的に主張
- **反対派エージェント（Agent B）**: テーマに反対の立場で論理的に反論
- **審判AI**: 中立的立場で議論を評価し、勝者を判定
- **LangGraphによる状態管理**: グラフベースのワークフローで複雑なフローも管理可能

## セットアップ

### 1. 依存パッケージのインストール

```bash
pnpm install
```

### 2. 環境変数の設定

`.env.example`をコピーして`.env`ファイルを作成し、Anthropic APIキーを設定してください。

```bash
cp .env.example .env
```

`.env`ファイルを編集:
```
ANTHROPIC_API_KEY=your_api_key_here
```

## 使い方

### ビルド

```bash
pnpm build
```

### 実行

```bash
pnpm start
```

または、開発モード（TypeScriptを直接実行）:

```bash
pnpm dev
```

## プロジェクト構成

```
bilogic/
├── src/
│   ├── types.ts      # 型定義（LangGraph Annotation）
│   ├── client.ts     # Anthropic APIクライアント
│   ├── graph.ts      # LangGraphワークフロー定義
│   └── index.ts      # エントリーポイント
├── dist/             # ビルド出力（自動生成）
├── package.json
├── tsconfig.json
└── README.md
```

## 技術スタック

- TypeScript
- **LangGraph.js** (@langchain/langgraph) - グラフベースのワークフロー管理
- Anthropic Claude API (@anthropic-ai/sdk)
- dotenv

## アーキテクチャ

LangGraphを使用したディベートフロー:

```
START → Agent A → Agent B → 条件分岐
                              ├─ ターン継続 → Agent A（ループ）
                              └─ ターン終了 → Judge → END
```

各ノードは独立した関数として実装され、状態（DebateState）はLangGraphが自動的に管理します。

## 今後の拡張予定

### Phase 2（機能拡張）
- [ ] CLI引数でテーマとターン数を指定可能に
- [ ] 議論履歴のファイル出力（JSON/Markdown）
- [ ] 複数モデルの比較機能

### Phase 3（LangGraphの強みを活かした拡張）
- [ ] チェックポイント機能（議論の途中保存・再開）
- [ ] 3人以上のエージェントによる自由討論
- [ ] 動的な発言順の決定
- [ ] ファクトチェッカーエージェントの追加
- [ ] 複数の審判による評価
- [ ] グラフの可視化機能

### Phase 4（UI）
- [ ] Webインターフェース
- [ ] リアルタイムストリーミング表示