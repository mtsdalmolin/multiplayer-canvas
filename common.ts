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
export interface HandshakeEvent {
  kind: "Handshake";
  id: UUID;
}
export interface SessionCreatedEvent {
  kind: "SessionCreated";
  sessionId: UUID;
}
export interface PlayerJoinedEvent {
  kind: "PlayerJoined";
  id: UUID;
}
export interface PlayerLeftEvent {
  kind: "PlayerLeft";
  id: UUID;
}
export interface PlayerMovedEvent {
  kind: "PlayerMoved";
  id: UUID;
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
  sessionId: UUID;
}
export interface PlayerClientStartDrawingEvent {
  kind: "PlayerClientStartDrawing";
  x: number;
  y: number;
  color: string;
  playerId: UUID;
  sessionId: UUID;
}
export interface PlayerClientStopDrawingEvent {
  kind: "PlayerClientStopDrawing";
  x: number;
  y: number;
  sessionId: UUID;
}
export interface PlayerClientCreateSessionEvent {
  kind: "PlayerClientCreateSession";
}
export interface PlayerClientJoinSessionEvent {
  kind: "PlayerClientJoinSession";
  sessionId: UUID;
}

export function isUUID (id: string): id is UUID {
  return typeof id === 'string' && !!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
}
