import type { Cell } from "./cell.entity";

export type BotBehavior = "wanderer" | "hunter" | "fleer";

/**
 * Epic 4, tasks 007/008: persistent target commitment for a hunter. `lockedUntil` is the
 * commitment-floor expiry (007) — the bot keeps this target even if a marginally-better
 * candidate appears, until this time passes or an override-margin-beating candidate shows up.
 * `acquiredAt`/`distanceAtStart` are give-up bookkeeping (008) — if the chase hasn't closed
 * distance meaningfully by the give-up deadline, the lock clears early, bypassing `lockedUntil`.
 */
export interface BotTargetLock {
  targetId: string;
  lockedUntil: number;
  acquiredAt: number;
  distanceAtStart: number;
}

/**
 * Hunter/fleer steering is computed fresh every tick from `nearbyEntities`, but as of Epic 4
 * tasks 007/008 a hunter also carries a small amount of persistent cross-tick state —
 * `targetLock` — so target selection can commit to a choice for a short window instead of
 * re-picking from scratch every tick (007) and can detect/abandon a chase that isn't working
 * (008). Fleer/wanderer never set this field.
 */
export interface Bot extends Cell {
  behavior: BotBehavior;
  targetLock?: BotTargetLock;
}
