export class MousePosition {
  #x: number;
  #y: number;

  constructor(x: number, y: number) {
    this.#x = x;
    this.#y = y;
  }

  set x(value: number) {
    this.#x = value;
  }

  set y(value: number) {
    this.#y = value;
  }

  get x() {
    return this.#x;
  }

  get y() {
    return this.#y;
  }
}

export interface Player {
  id: UUID;
  position?: MousePosition;
}

export type UUID = ReturnType<typeof crypto.randomUUID>;

export type DrawingPath = { x: number; y: number };

// Events
export interface PlayerJoinedEvent {
  kind: "PlayerJoined";
  id: ReturnType<typeof crypto.randomUUID>;
}
export interface PlayerLeftEvent {
  kind: "PlayerLeft";
  id: ReturnType<typeof crypto.randomUUID>;
}
export interface PlayerMovedEvent {
  kind: "PlayerMoved";
  id: ReturnType<typeof crypto.randomUUID>;
  x: number;
  y: number;
}
export interface PlayerDrawingEvent {
  kind: "PlayerDrawing";
  drawingId: UUID;
  paths: DrawingPath[];
  playerId: UUID;
  color: string;
}
export interface PlayerClientSideMovingEvent {
  kind: "PlayerClientSideMoving";
  x: number;
  y: number;
  isDrawing: boolean;
}
export interface PlayerClientStartDrawingEvent {
  kind: "PlayerClientStartDrawing";
  x: number;
  y: number;
  color: string;
  playerId: UUID;
}
export interface PlayerClientStopDrawingEvent {
  kind: "PlayerClientStopDrawing";
  x: number;
  y: number;
}
