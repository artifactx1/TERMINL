/** TERMINL arcade protocol v1. Renderers never own outcomes. */
export type GameId = 'rekt-rumble' | 'wen-lambo' | 'rug-or-bond' | 'exit-liquidity' | 'candle-clash';
export type CharacterId = 'max' | 'diamond' | 'brian' | 'mia' | 'bernie' | 'chloe';
export type VehicleId = 'comet' | 'spectre' | 'mirage' | 'glacier' | 'inferno' | 'bike-tyson';
export type TrackId = 'night-market' | 'liquidation-docks' | 'redwood-rally' | 'alpine-pass' | 'neon-boulevard' | 'vineyard-run';
export interface RaceCar {
  vehicle: VehicleId; x: number; y: number; angle: number; vx: number; vy: number;
  speed: number; steer: number; yawRate?: number; gear?: 1 | -1; wheelRotation?: number;
  boost: number; boosting: boolean; drifting: boolean; driftCharge: number;
  nextCheckpoint: number; passed: number; lap: number; finishedTick: number | null;
  points: number; cupTime: number; [key: string]: unknown;
}
export interface RaceState {
  version: 1 | 2 | 3 | 4 | 5; game: 'wen-lambo'; tick: number; phase: 'countdown' | 'racing' | 'raceOver' | 'finished';
  phaseTick: number; track: TrackId; tracks: TrackId[]; trackIndex: number; raceTicks: number;
  players: [RaceCar, RaceCar]; wins: [number, number]; winner: number | null;
  raceResults: Array<{track: TrackId; times: Array<number | null>; points: number[]; order: number[]}>;
  events: Array<{id: string; tick: number; type: string; player: number | null; text: string}>;
}
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
  | { type: 'create'; name: string; character: CharacterId; stage: StageId; game?: 'rekt-rumble'; rulesVersion?: 1 }
  | { type: 'create'; name: string; character: VehicleId; stage: TrackId; game: 'wen-lambo'; rulesVersion: 5 }
  | { type: 'join'; code: string; token: string; name: string; character: CharacterId | VehicleId; spectator?: boolean; game?: 'rekt-rumble' | 'wen-lambo'; rulesVersion?: 1 | 3 }
  | { type: 'resume'; code: string; session: string; game?: 'rekt-rumble' | 'wen-lambo' }
  | { type: 'ready'; ready: boolean }
  | { type: 'input'; seq: number; tick: number; input: InputMask }
  | { type: 'rematch' }
  | { type: 'leave' }
  | { type: 'ping'; time: number };
