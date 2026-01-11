import { Annotation } from '@langchain/langgraph';

/**
 * ディベートにおけるメッセージの型
 */
export interface Message {
  role: 'agent_a' | 'agent_b' | 'judge';
  content: string;
  turn: number;
}

/**
 * LangGraph用の状態定義
 * Annotationを使って状態のスキーマを定義
 */
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
  winner: Annotation<'A' | 'B' | undefined>({
    reducer: (_, update) => update,
    default: () => undefined,
  }),
  judgeReasoning: Annotation<string | undefined>({
    reducer: (_, update) => update,
    default: () => undefined,
  }),
});

/**
 * DebateStateの型（型推論用）
 */
export type DebateState = typeof DebateStateAnnotation.State;

/**
 * エージェントの立場
 */
export type AgentPosition = 'for' | 'against';

/**
 * ディベート設定
 */
export interface DebateConfig {
  topic: string;
  maxTurns: number;
  model?: string;
}
