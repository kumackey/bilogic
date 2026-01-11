# 開発ガイド

## プロジェクト構成

```
bilogic/
├── src/
│   ├── types.ts      # 型定義（LangGraph Annotation）
│   ├── client.ts     # Anthropic APIクライアント
│   ├── graph.ts      # LangGraphワークフロー定義
│   └── index.ts      # エントリーポイント
├── docs/             # ドキュメント
├── dist/             # ビルド出力（自動生成）
├── package.json
├── tsconfig.json
└── README.md
```

## 技術スタック

- **TypeScript** - 型安全な開発
- **LangGraph.js** (@langchain/langgraph) - グラフベースのワークフロー管理
- **Anthropic Claude API** (@anthropic-ai/sdk) - AI推論エンジン
  - Structured Outputs (beta) - zod スキーマによる構造化出力
- **Biome** - 高速なフォーマッター/リンター
- **dotenv** - 環境変数管理

## アーキテクチャ

### ディベートフロー

LangGraphを使用したステートマシン:

```
START → Agent A → Agent B → 条件分岐
                              ├─ ターン継続 → Agent A（ループ）
                              └─ ターン終了 → Judge → END
```

### 状態管理

各ノードは独立した関数として実装され、状態（DebateState）はLangGraphが自動的に管理します。

```typescript
export const DebateStateAnnotation = Annotation.Root({
  topic: Annotation<string>,
  debateHistory: Annotation<Message[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  currentTurn: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),
  maxTurns: Annotation<number>,
  winner: Annotation<'A' | 'B' | undefined>,
  judgeReasoning: Annotation<string | undefined>,
});
```

### エージェント設定

すべてのエージェント設定は `AGENT_CONFIG` 定数に集約:

```typescript
export const AGENT_CONFIG = {
  A: {
    emoji: '🙋‍♀️',
    label: '賛成派',
    role: 'agent_a' as const,
    position: '賛成' as const,
    actionVerb: '主張' as const,
    shouldIncrementTurn: true,
  },
  B: {
    emoji: '🙅‍♂️',
    label: '反対派',
    role: 'agent_b' as const,
    position: '反対' as const,
    actionVerb: '反論' as const,
    shouldIncrementTurn: false,
  },
} as const;
```

### 構造化出力

審判の判定には Anthropic の Structured Outputs (beta) を使用し、確実な勝者判定を実現:

```typescript
const JudgeOutputSchema = z.object({
  reasoning: z.string().describe('判定理由の詳細説明（300-500文字程度）'),
  winner: z.enum(['A', 'B']).describe('勝者（A: 賛成派, B: 反対派）'),
});
```

## 開発コマンド

```bash
# 開発モード（TypeScriptを直接実行、ビルド不要）
pnpm dev
pnpm dev -- --topic "テーマ" --turns 5

# ビルド
pnpm build

# 本番実行（ビルド後に実行）
pnpm start
pnpm start -- --topic "テーマ" --turns 5

# フォーマット
pnpm format

# リント
pnpm lint

# チェック（フォーマット＋リント）
pnpm check
```

**開発時のヒント:**
- コード変更を即座に試す場合は `pnpm dev` を使用
- 本番ビルドの動作確認をする場合は `pnpm build` → `pnpm start`

## コーディング規約

### リファクタリング原則

1. **設定の集約**: エージェント設定は `AGENT_CONFIG` に集約
2. **ヘルパー関数**: 重複ロジックは即座にヘルパー関数化
3. **シンプルさ優先**: 過度な抽象化を避け、明示的に書く
4. **型安全性**: TypeScript の型推論を最大限活用

### ファイル構成

- `types.ts`: 型定義のみ（ロジックを含めない）
- `client.ts`: API クライアントと通信ロジック
- `graph.ts`: ディベートフロー定義とエージェントノード
- `index.ts`: CLI エントリーポイント

## 今後の拡張予定

### Phase 2（機能拡張）
- [ ] 議論履歴のファイル出力（JSON/Markdown）
- [ ] 複数モデルの比較機能
- [ ] カスタムプロンプトのサポート

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
- [ ] 議論履歴のビジュアライゼーション
