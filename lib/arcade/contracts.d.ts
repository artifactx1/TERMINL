/** TERMINL arcade protocol v1. Renderers never own outcomes. */
export type GameId = 'rekt-rumble' | 'wen-lambo' | 'rug-or-bond' | 'exit-liquidity' | 'candle-clash';
export type CharacterId = 'max' | 'diamond';
export type StageId = 'dead-mall' | 'laundromat';
export type InputMask = number; // 11 known bits, 0..2047
export interface Fighter {
  character: CharacterId; x: number; y: number; vx: number; vy: number; face: number;
  hp: number; meter: number; action: null | { id: string; frame: number; hit: boolean };
  stun: number; blockstun: number; grounded: boolean; crouching: boolean;
  previousInput: InputMask; [key: string]: unknown;
}
export interface FightState {
  version: 1; tick: number; phase: 'intro' | 'fight' | 'roundOver' | 'finished';
  phaseTick: number; round: number; wins: [number, number]; winner: number | null;
  stage: StageId; players: [Fighter, Fighter]; roundTicks: number;
  events: Array<{ id: string; tick: number; type: string; player?: number; x?: number; y?: number; text?: string }>;
  [key: string]: unknown;
}
export interface GameModule<State, Input> {
  id: GameId; version: number; players: { min: number; max: number };
  levels: ReadonlyArray<{ id: string; name: string }>;
  initial(options: unknown): State; validateInput(input: unknown): Input | null;
  step(state: State, inputs: Input[]): State;
  result(state: State): unknown; serialize(state: State): string;
  dispose(): void;
}
export type ClientMessage =
  | { type: 'create'; name: string; character: CharacterId; stage: StageId }
  | { type: 'join'; code: string; token: string; name: string; character: CharacterId; spectator?: boolean }
  | { type: 'resume'; code: string; session: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'input'; seq: number; tick: number; input: InputMask }
  | { type: 'rematch' }
  | { type: 'leave' }
  | { type: 'ping'; time: number };
