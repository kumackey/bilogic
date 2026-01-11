import 'dotenv/config';
import * as readline from 'node:readline';
import { parseArgs } from 'node:util';
import { createDebateGraph } from './graph.js';

/**
 * ヘルプメッセージを表示
 */
function showHelp(): void {
  console.log(`
Bilogic - AIディベートシステム

使い方:
  pnpm dev                              対話的にテーマとターン数を入力
  pnpm dev --topic "テーマ"             テーマを指定して実行
  pnpm dev --topic "テーマ" --turns 5   テーマとターン数を指定

オプション:
  -t, --topic <テーマ>   ディベートのテーマ
  -n, --turns <数>       ディベートのターン数（デフォルト: 10）
  -h, --help             このヘルプを表示

例:
  pnpm dev --topic "リモートワークは生産性を向上させる"
  pnpm dev --topic "環境保護と経済成長は両立できる" --turns 5
`);
}

/**
 * 対話的に入力を取得
 */
async function promptInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * メイン関数
 */
async function main() {
  console.log('=== Bilogic - AI ディベートシステム (LangGraph版) ===\n');

  // コマンドライン引数をパース
  const { values } = parseArgs({
    options: {
      topic: {
        type: 'string',
        short: 't',
      },
      turns: {
        type: 'string',
        short: 'n',
      },
      help: {
        type: 'boolean',
        short: 'h',
        default: false,
      },
    },
  });

  // ヘルプ表示
  if (values.help) {
    showHelp();
    return;
  }

  // テーマの取得
  let topic = values.topic;
  if (!topic) {
    topic = await promptInput('ディベートのテーマを入力してください: ');
    if (!topic) {
      console.error('エラー: テーマが入力されていません');
      process.exit(1);
    }
  }

  // ターン数の取得
  let maxTurns: number;
  if (values.turns) {
    const turns = Number.parseInt(values.turns, 10);
    if (Number.isNaN(turns) || turns <= 0) {
      console.error('エラー: ターン数は正の整数である必要があります');
      process.exit(1);
    }
    maxTurns = turns;
  } else {
    const turnsInput = await promptInput('ターン数を入力してください（デフォルト: 10）: ');
    if (turnsInput) {
      const turns = Number.parseInt(turnsInput, 10);
      if (!Number.isNaN(turns) && turns > 0) {
        maxTurns = turns;
      } else {
        maxTurns = 10;
      }
    } else {
      maxTurns = 10;
    }
  }

  console.log(`\nテーマ: ${topic}`);
  console.log(`最大ターン数: ${maxTurns}\n`);

  // グラフをコンパイル
  const graph = createDebateGraph();

  // 初期状態を設定
  const initialState = {
    topic,
    maxTurns,
  };

  // グラフを実行
  const result = await graph.invoke(initialState);

  console.log('\n=== ディベート終了 ===');

  if (result.winner) {
    const winnerEmoji = result.winner === 'A' ? '🔵' : '🔴';
    const winnerName = result.winner === 'A' ? '賛成派 Agent A' : '反対派 Agent B';
    console.log(`\n🏆 最終結果: ${winnerEmoji} ${winnerName} の勝利！`);
  } else {
    console.log('\n最終結果: 判定不可');
  }
}

main().catch((error) => {
  console.error('エラーが発生しました:', error);
  process.exit(1);
});
