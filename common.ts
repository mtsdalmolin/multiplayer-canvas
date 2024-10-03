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
