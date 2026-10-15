import type { Cell } from "./cell.entity";
import type { Vector2 } from "./geometry";

export type BotBehavior = "wanderer" | "hunter" | "fleer";

export interface Bot extends Cell {
  behavior: BotBehavior;
  /** Hunter (006): id of the cell currently being chased. Unset when nothing is in range. */
  targetId?: string;
  /** Fleer (008): cached escape direction, recomputed each tick. */
  fleeDirection?: Vector2;
}
