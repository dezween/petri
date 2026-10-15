import type { IInputSource } from "@/input/port/input.port";
import type { IRenderer } from "@/render/port/renderer.port";
import { createPlayer } from "@/world/domain/cell.entity";
import { BotPopulationService } from "@/world/service/bot-population.service";
import { FoodSpawnerService } from "@/world/service/food-spawner.service";
import { DEFAULT_ARENA_WIDTH, WorldService } from "@/world/service/world.service";
import { GameLoopService } from "@/session/game-loop.service";
import type { IHud } from "./port/hud.port";

export type SessionStateName = "MainMenu" | "Playing" | "GameOver" | "Victory";

/** Port for the MainMenu screen (task 019). No dedicated port file — contract is small enough to live alongside the state machine that's its only consumer. */
export interface MenuScreen {
  show(): void;
  hide(): void;
  onPlay(handler: () => void): void;
}

/** Port for the live HUD overlay (task 020) — adds show/hide to the IHud data contract. */
export interface HudScreen extends IHud {
  show(): void;
  hide(): void;
}

/** Shared port for GameOver (021) and Victory (022) — identical shape per task 022's own doc ("behave identically to task 021's"). */
export interface ResultScreen {
  show(finalMass: number): void;
  hide(): void;
  onRestart(handler: () => void): void;
  onMainMenu(handler: () => void): void;
}

export interface SessionStateScreens {
  menu: MenuScreen;
  hud: HudScreen;
  gameOver: ResultScreen;
  victory: ResultScreen;
}

export interface SessionStateDeps {
  inputSource: IInputSource;
  renderer: IRenderer;
  screens: SessionStateScreens;
  arenaWidth?: number;
}

/**
 * The MainMenu/Playing/GameOver/Victory state machine from docs/SPEC.md. Owns the only
 * transition logic in this codebase — screens are dumb (DOM + registration hooks), this
 * class is the one place that decides what happens next and drives the game loop.
 *
 * Exactly the 7 transitions SPEC.md lists are reachable: Play, death, victory-cap, and the
 * two Restart/MainMenu pairs out of GameOver/Victory. There's no path from MainMenu straight
 * to GameOver/Victory — those only fire from inside an active game loop's callbacks.
 */
export class SessionState {
  private current: SessionStateName = "MainMenu";
  private gameLoop: GameLoopService | null = null;

  constructor(private readonly deps: SessionStateDeps) {
    const { menu, gameOver, victory } = deps.screens;
    menu.onPlay(() => this.play());
    gameOver.onRestart(() => this.play());
    gameOver.onMainMenu(() => this.returnToMainMenu());
    victory.onRestart(() => this.play());
    victory.onMainMenu(() => this.returnToMainMenu());

    this.showOnly("MainMenu");
  }

  get state(): SessionStateName {
    return this.current;
  }

  private play(): void {
    // Idempotent even though every path here should already have a stopped loop —
    // GameLoopService.stop() is a documented no-op when not running.
    this.gameLoop?.stop();
    this.gameLoop = this.createFreshGameLoop();
    this.current = "Playing";
    this.showOnly("Playing");
    this.gameLoop.start();
  }

  private returnToMainMenu(): void {
    this.gameLoop?.stop();
    this.gameLoop = null;
    this.current = "MainMenu";
    this.showOnly("MainMenu");
  }

  private enterGameOver(finalMass: number): void {
    this.gameLoop?.stop();
    this.current = "GameOver";
    this.showOnly("GameOver", finalMass);
  }

  private enterVictory(finalMass: number): void {
    this.gameLoop?.stop();
    this.current = "Victory";
    this.showOnly("Victory", finalMass);
  }

  /** Builds a brand-new world end to end — new player, fresh bot/food population — so Restart never continues stale state. */
  private createFreshGameLoop(): GameLoopService {
    const arenaWidth = this.deps.arenaWidth ?? DEFAULT_ARENA_WIDTH;
    const player = createPlayer("player", { x: 0, z: 0 });

    const populationService = new BotPopulationService();
    const bots = populationService.spawnInitialBots(arenaWidth, player);

    const foodSpawnerService = new FoodSpawnerService();
    const food = foodSpawnerService.spawnInitialFood(arenaWidth, player, bots);

    const worldService = new WorldService(player, bots, food, arenaWidth, populationService, foodSpawnerService);
    const hud = this.deps.screens.hud;

    return new GameLoopService(this.deps.inputSource, worldService, this.deps.renderer, {
      onPlayerEaten: () => this.enterGameOver(worldService.getSnapshot().player.mass),
      onVictoryReached: () => this.enterVictory(worldService.getSnapshot().player.mass),
      onTick: (snapshot) => hud.updateMass(snapshot.player.mass),
    });
  }

  private showOnly(which: SessionStateName, finalMass = 0): void {
    const { menu, hud, gameOver, victory } = this.deps.screens;
    which === "MainMenu" ? menu.show() : menu.hide();
    which === "Playing" ? hud.show() : hud.hide();
    which === "GameOver" ? gameOver.show(finalMass) : gameOver.hide();
    which === "Victory" ? victory.show(finalMass) : victory.hide();
  }
}
