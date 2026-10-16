import type { IAudioPlayer } from "@/audio/port/audio.port";
import type { IInputSource } from "@/input/port/input.port";
import type { IRenderer } from "@/render/port/renderer.port";
import { createPlayer } from "@/world/domain/cell.entity";
import { BotPopulationService } from "@/world/service/bot-population.service";
import { FoodSpawnerService } from "@/world/service/food-spawner.service";
import { DEFAULT_ARENA_WIDTH, WorldService } from "@/world/service/world.service";
import { GameLoopService } from "@/session/game-loop.service";
import type { IHud } from "./port/hud.port";

export type SessionStateName = "MainMenu" | "Playing" | "GameOver" | "Victory";

/** Port for the MainMenu screen (task 019). No dedicated port file — contract is small enough to live alongside the state machine that's its only consumer. The handler receives the arena width the player picked (Epic 2, task 001/002) — one of 1000/1500/2000. */
export interface MenuScreen {
  show(): void;
  hide(): void;
  onPlay(handler: (arenaWidth: number) => void): void;
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
  audioPlayer: IAudioPlayer;
  screens: SessionStateScreens;
  arenaWidth?: number;
}

/**
 * The MainMenu/Playing/GameOver/Victory state machine from docs/epic-1/SPEC.md. Owns the only
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
  /** The arena width used for the game currently in progress (or about to start). Updated
   * whenever Play is invoked with an explicit choice (i.e. from the menu); Restart reuses
   * whatever this already is rather than resetting to the default, since Restart doesn't go
   * through the menu and has no new choice to offer. */
  private selectedArenaWidth: number;

  constructor(private readonly deps: SessionStateDeps) {
    this.selectedArenaWidth = deps.arenaWidth ?? DEFAULT_ARENA_WIDTH;

    const { menu, gameOver, victory } = deps.screens;
    menu.onPlay((arenaWidth) => this.play(arenaWidth));
    gameOver.onRestart(() => this.play());
    gameOver.onMainMenu(() => this.returnToMainMenu());
    victory.onRestart(() => this.play());
    victory.onMainMenu(() => this.returnToMainMenu());

    this.showOnly("MainMenu");
  }

  get state(): SessionStateName {
    return this.current;
  }

  /** `arenaWidth` is the menu's choice on a real Play click; omitted on Restart, which reuses
   * `selectedArenaWidth` as last set. */
  private play(arenaWidth?: number): void {
    // Defensive state guard: the only thing normally preventing e.g. a second Play click
    // while already Playing is the menu screen's `hidden` DOM attribute — and this exact
    // codebase has already shipped one real bug where `[hidden]` was overridden by CSS,
    // letting a "hidden" element still intercept events. Don't rely on DOM enforcement alone.
    if (this.current === "Playing") return;
    if (arenaWidth !== undefined) this.selectedArenaWidth = arenaWidth;
    this.stopLoop();
    // Keeps the renderer's drawn arena in sync with the world's collision bounds — see
    // IRenderer.setArenaWidth's doc comment for why this can't just be "pass it to the
    // constructor" the way WorldService's arenaWidth can.
    this.deps.renderer.setArenaWidth(this.selectedArenaWidth);
    this.gameLoop = this.createFreshGameLoop();
    this.current = "Playing";
    this.showOnly("Playing");
    this.gameLoop.start();
    // playMusic() replaces whatever was already playing internally (see IAudioPlayer's doc
    // comment), so Restart calling play() again is already stop-then-restart with no risk of
    // two loops layering — no explicit stopMusic() needed here first.
    this.deps.audioPlayer.playMusic("ambient-music");
  }

  private returnToMainMenu(): void {
    if (this.current === "MainMenu") return;
    this.stopLoop();
    this.deps.audioPlayer.stopMusic();
    this.current = "MainMenu";
    this.showOnly("MainMenu");
  }

  private enterGameOver(finalMass: number): void {
    if (this.current === "GameOver") return;
    this.stopLoop();
    this.deps.audioPlayer.stopMusic();
    this.deps.audioPlayer.playSfx("death");
    this.current = "GameOver";
    this.showOnly("GameOver", finalMass);
  }

  private enterVictory(finalMass: number): void {
    if (this.current === "Victory") return;
    this.stopLoop();
    this.deps.audioPlayer.stopMusic();
    this.deps.audioPlayer.playSfx("victory");
    this.current = "Victory";
    this.showOnly("Victory", finalMass);
  }

  /** Stops (idempotent — GameLoopService.stop() is a documented no-op when not running) and
   * nulls out the current loop, so `this.gameLoop`'s nullness alone always tells a reader
   * whether a game is in progress — not left pointing at a stale, already-stopped instance. */
  private stopLoop(): void {
    this.gameLoop?.stop();
    this.gameLoop = null;
  }

  /** Builds a brand-new world end to end — new player, fresh bot/food population — so Restart never continues stale state. */
  private createFreshGameLoop(): GameLoopService {
    const arenaWidth = this.selectedArenaWidth;
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
      // Only the player's own eats get a sound — bot-eats-bot/food happen constantly and
      // silently all over the arena, exactly as in Epic 1; this event stream carries all of
      // them (see EatenEvent's doc comment) so a future particle trigger (task 009) can reuse
      // it for bot eats too without this filter getting in its way.
      onEntityEaten: (event) => {
        if (event.eaterType !== "player") return;
        this.deps.audioPlayer.playSfx(event.eatenType === "food" ? "eat-food" : "eat-bot");
      },
    });
  }

  private showOnly(which: SessionStateName, finalMass = 0): void {
    const { menu, hud, gameOver, victory } = this.deps.screens;
    if (which === "MainMenu") menu.show();
    else menu.hide();
    if (which === "Playing") hud.show();
    else hud.hide();
    if (which === "GameOver") gameOver.show(finalMass);
    else gameOver.hide();
    if (which === "Victory") victory.show(finalMass);
    else victory.hide();
  }
}
