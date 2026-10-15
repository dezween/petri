import type { Cell } from "./cell.entity";

export type BotBehavior = "wanderer" | "hunter" | "fleer";

/**
 * Hunter/fleer steering is computed fresh every tick from scratch (pure functions over
 * nearby entities) — there's no per-bot cached target or escape direction to store, so Bot
 * carries no behavior-specific state beyond the shared Cell shape + its behavior tag.
 */
export interface Bot extends Cell {
  behavior: BotBehavior;
}
