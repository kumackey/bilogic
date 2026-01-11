import { END, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { sendMessage, sendStructuredMessage } from './client.js';
import { type DebateState, DebateStateAnnotation, type Message } from './types.js';

/**
 * エージェント設定
 */
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

/**
 * 審判の構造化出力スキーマ
 */
const JudgeOutputSchema = z.object({
  reasoning: z.string().describe('判定理由の詳細説明（300-500文字程度）'),
  winner: z.enum(['A', 'B']).describe('勝者（A: 賛成派, B: 反対派）'),
});

/**
 * エージェントのシステムプロンプトを生成
 */
function getAgentSystemPrompt(
  topic: string,
  position: '賛成' | '反対',
  actionVerb: '主張' | '反論'
): string {
  return `あなたは論理的なディベーターです。以下のテーマについて${position}の立場で議論してください。

テーマ: ${topic}

重要な指示:
- 1つの論点に絞って簡潔に${actionVerb}する（2-4文程度）
- 相手の直前の発言に対して直接返答する
- 長文は避け、会話のキャッチボールを意識する
- 具体例は1つまで

${position}の立場から、短く鋭い${actionVerb}をしてください。`;
}

/**
 * 審判のシステムプロンプト
 */
function getJudgeSystemPrompt(topic: string): string {
  return `あなたは公平で客観的な審判です。以下のテーマについてのディベートを評価してください。

テーマ: ${topic}

あなたの役割:
- 両者の議論を公平に評価する
- 論理の一貫性を重視する
- 証拠や具体例の質を評価する
- 反論への対応力を見る
- 説得力を総合的に判断する

判定では以下を出力してください：
1. reasoning: 判定理由を簡潔に説明（300-500文字程度）
   - 両者の強みと弱みを公平に評価
   - どちらが優れていたかを明確に述べる
2. winner: 勝者を "A"（賛成派）または "B"（反対派）で指定

必ず "A" または "B" のどちらか一方を選んでください。`;
}

/**
 * ロールからスピーカー名を取得
 */
function getSpeakerLabel(role: Message['role']): string {
  return role === AGENT_CONFIG.A.role
    ? AGENT_CONFIG.A.label
    : role === AGENT_CONFIG.B.role
      ? AGENT_CONFIG.B.label
      : '審判';
}

/**
 * これまでの議論履歴を文字列に変換
 */
function formatDebateHistory(history: Message[]): string {
  if (history.length === 0) {
    return 'これが最初の発言です。';
  }

  return history.map((msg) => `${getSpeakerLabel(msg.role)}: ${msg.content}`).join('\n\n');
}

/**
 * 直前の発言を取得
 */
function getLastMessage(history: Message[]): string | null {
  if (history.length === 0) return null;
  const lastMsg = history[history.length - 1];
  return `${getSpeakerLabel(lastMsg.role)}「${lastMsg.content}」`;
}

/**
 * エージェントノードを生成するファクトリー関数
 */
function createAgentNode(agentId: 'A' | 'B') {
  return async (state: DebateState): Promise<Partial<DebateState>> => {
    const config = AGENT_CONFIG[agentId];
    const systemPrompt = getAgentSystemPrompt(state.topic, config.position, config.actionVerb);
    const lastMessage = getLastMessage(state.debateHistory);

    const userMessage = lastMessage
      ? `相手の発言:\n${lastMessage}\n\nこの発言に対して簡潔に返答してください（2-4文程度）。`
      : `最初の発言として、${config.label}の立場から簡潔に${config.actionVerb}してください（2-4文程度）。`;

    const response = await sendMessage(systemPrompt, userMessage, 'claude-haiku-4-5-20251001', 300);

    const turn = config.shouldIncrementTurn ? state.currentTurn + 1 : state.currentTurn;
    const message: Message = {
      role: config.role,
      content: response,
      turn,
    };

    console.log(`\n${config.emoji} 【${config.label} - ターン ${turn}】\n${response}`);

    return {
      debateHistory: [message],
      ...(config.shouldIncrementTurn ? { currentTurn: turn } : {}),
    };
  };
}

/**
 * エージェントAのノード関数
 */
const agentANode = createAgentNode('A');

/**
 * エージェントBのノード関数
 */
const agentBNode = createAgentNode('B');

/**
 * 審判のノード関数
 */
async function judgeNode(state: DebateState): Promise<Partial<DebateState>> {
  console.log('\n\n⚖️  [審判] 議論を評価中...');

  const systemPrompt = getJudgeSystemPrompt(state.topic);
  const historyText = formatDebateHistory(state.debateHistory);
  const userMessage = `以下のディベートを評価し、勝者を判定してください。\n\n${historyText}\n\n判定結果を述べてください。`;

  // 構造化出力を使用して判定を取得
  const judgeOutput = await sendStructuredMessage(systemPrompt, userMessage, JudgeOutputSchema);
  const winnerConfig = AGENT_CONFIG[judgeOutput.winner];

  console.log(`\n🏆 勝者: ${winnerConfig.emoji} ${winnerConfig.label}`);
  console.log('\n⚖️  【審判の判定】');
  console.log(judgeOutput.reasoning);

  return {
    winner: judgeOutput.winner,
    judgeReasoning: judgeOutput.reasoning,
  };
}

/**
 * ターン継続判定（条件分岐ノード）
 */
function shouldContinue(state: DebateState): 'agent_a' | 'judge' {
  if (state.currentTurn < state.maxTurns) {
    return 'agent_a';
  }
  return 'judge';
}

/**
 * ディベートグラフを構築
 */
export function createDebateGraph() {
  const workflow = new StateGraph(DebateStateAnnotation)
    .addNode('agent_a', agentANode)
    .addNode('agent_b', agentBNode)
    .addNode('judge', judgeNode)
    .addEdge('__start__', 'agent_a')
    .addEdge('agent_a', 'agent_b')
    .addConditionalEdges('agent_b', shouldContinue)
    .addEdge('judge', END);

  return workflow.compile();
}
