/**
 * Pure state machine behind `useLongPress`. Kept separate so the timing rules
 * can be unit tested without a DOM renderer.
 */

export interface LongPressOptions {
  /** Hold duration before the callback fires. */
  ms?: number;
  /** Pointer travel that cancels the press. */
  moveTolerance?: number;
}

export const LONG_PRESS_MS = 450;
export const LONG_PRESS_MOVE_TOLERANCE = 8;

export interface LongPressState {
  /** `idle` before a press, `pressing` while held, `fired` once the timer won. */
  phase: 'idle' | 'pressing' | 'fired';
  startX: number;
  startY: number;
  startedAt: number;
}

export type LongPressEvent =
  | { type: 'down'; x: number; y: number; at: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'timer' }
  | { type: 'up' }
  | { type: 'cancel' };

export const initialLongPress: LongPressState = {
  phase: 'idle',
  startX: 0,
  startY: 0,
  startedAt: 0,
};

/**
 * `fire` means the caller should run the callback (and buzz); `suppressClick`
 * means the synthetic click that follows this pointer sequence must be eaten.
 */
export interface LongPressResult {
  state: LongPressState;
  fire: boolean;
  suppressClick: boolean;
}

export function longPressReducer(
  state: LongPressState,
  event: LongPressEvent,
  options: LongPressOptions = {},
): LongPressResult {
  const tolerance = options.moveTolerance ?? LONG_PRESS_MOVE_TOLERANCE;

  switch (event.type) {
    case 'down':
      return {
        state: { phase: 'pressing', startX: event.x, startY: event.y, startedAt: event.at },
        fire: false,
        suppressClick: false,
      };

    case 'move': {
      if (state.phase !== 'pressing') return { state, fire: false, suppressClick: false };
      const dx = event.x - state.startX;
      const dy = event.y - state.startY;
      if (Math.hypot(dx, dy) <= tolerance) return { state, fire: false, suppressClick: false };
      return { state: initialLongPress, fire: false, suppressClick: false };
    }

    case 'timer':
      if (state.phase !== 'pressing') return { state, fire: false, suppressClick: false };
      return { state: { ...state, phase: 'fired' }, fire: true, suppressClick: false };

    case 'up':
      // A press that already fired must swallow the click it would otherwise
      // produce, so a long-press does not also count as a tap.
      return {
        state: initialLongPress,
        fire: false,
        suppressClick: state.phase === 'fired',
      };

    case 'cancel':
      return { state: initialLongPress, fire: false, suppressClick: false };
  }
}
