import { END, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { sendMessage, sendStructuredMessage } from './client.js';
import { type DebateState, DebateStateAnnotation, type Message } from './types.js';

/**
 * 審判の構造化出力スキーマ
 */
const JudgeOutputSchema = z.object({
  reasoning: z.string().describe('判定理由の詳細説明（300-500文字程度）'),
  winner: z.enum(['A', 'B']).describe('勝者（A: 賛成派, B: 反対派）'),
});

/**
 * 賛成派エージェント（Agent A）のシステムプロンプト
 */
function getAgentASystemPrompt(topic: string): string {
  return `あなたは論理的なディベーターです。以下のテーマについて賛成の立場で議論してください。

テーマ: ${topic}

重要な指示:
- 1つの論点に絞って簡潔に主張する（2-4文程度）
- 相手の直前の発言に対して直接返答する
- 長文は避け、会話のキャッチボールを意識する
- 具体例は1つまで

賛成の立場から、短く鋭い主張をしてください。`;
}

/**
 * 反対派エージェント（Agent B）のシステムプロンプト
 */
function getAgentBSystemPrompt(topic: string): string {
  return `あなたは論理的なディベーターです。以下のテーマについて反対の立場で議論してください。

テーマ: ${topic}

重要な指示:
- 1つの論点に絞って簡潔に反論する（2-4文程度）
- 相手の直前の主張に対して直接返答する
- 長文は避け、会話のキャッチボールを意識する
- 具体例は1つまで

反対の立場から、短く鋭い反論をしてください。`;
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
 * これまでの議論履歴を文字列に変換
 */
function formatDebateHistory(history: Message[]): string {
  if (history.length === 0) {
    return 'これが最初の発言です。';
  }

  return history
    .map((msg) => {
      const speaker =
        msg.role === 'agent_a' ? '賛成派' : msg.role === 'agent_b' ? '反対派' : '審判';
      return `${speaker}: ${msg.content}`;
    })
    .join('\n\n');
}

/**
 * 直前の発言を取得
 */
function getLastMessage(history: Message[]): string | null {
  if (history.length === 0) return null;
  const lastMsg = history[history.length - 1];
  const speaker = lastMsg.role === 'agent_a' ? '賛成派' : '反対派';
  return `${speaker}「${lastMsg.content}」`;
}

/**
 * エージェントAのノード関数
 */
async function agentANode(state: DebateState): Promise<Partial<DebateState>> {
  const systemPrompt = getAgentASystemPrompt(state.topic);
  const lastMessage = getLastMessage(state.debateHistory);

  let userMessage: string;
  if (lastMessage) {
    userMessage = `相手の発言:\n${lastMessage}\n\nこの発言に対して簡潔に返答してください（2-4文程度）。`;
  } else {
    userMessage = `最初の発言として、賛成の立場から簡潔に主張してください（2-4文程度）。`;
  }

  const response = await sendMessage(systemPrompt, userMessage, 'claude-haiku-4-5-20251001', 300);

  const newTurn = state.currentTurn + 1;
  const message: Message = {
    role: 'agent_a',
    content: response,
    turn: newTurn,
  };

  console.log(`\n🔵 【賛成派 Agent A - ターン ${newTurn}】\n${response}`);

  return {
    debateHistory: [message],
    currentTurn: newTurn,
  };
}

/**
 * エージェントBのノード関数
 */
async function agentBNode(state: DebateState): Promise<Partial<DebateState>> {
  const systemPrompt = getAgentBSystemPrompt(state.topic);
  const lastMessage = getLastMessage(state.debateHistory);

  const userMessage = lastMessage
    ? `相手の発言:\n${lastMessage}\n\nこの発言に対して簡潔に反論してください（2-4文程度）。`
    : `最初の発言として、反対の立場から簡潔に主張してください（2-4文程度）。`;

  const response = await sendMessage(systemPrompt, userMessage, 'claude-haiku-4-5-20251001', 300);

  const message: Message = {
    role: 'agent_b',
    content: response,
    turn: state.currentTurn,
  };

  console.log(`\n🔴 【反対派 Agent B - ターン ${state.currentTurn}】\n${response}`);

  return {
    debateHistory: [message],
  };
}

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

  console.log('\n⚖️  【審判の判定】');
  console.log(judgeOutput.reasoning);

  const winnerEmoji = judgeOutput.winner === 'A' ? '🔵' : '🔴';
  const winnerName = judgeOutput.winner === 'A' ? '賛成派 Agent A' : '反対派 Agent B';
  console.log(`\n🏆 勝者: ${winnerEmoji} ${winnerName}`);

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
