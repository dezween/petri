import "./ui/styles/main.scss";
import { bootstrap } from "@/session/bootstrap";
import { ARENA_SIZES } from "@/ui/adapter/dom/menu.adapter";

/** Throws with the element's id in the message if it's missing — fail loudly at startup, not with a silent null deref three layers deep. */
function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`main.ts: expected element #${id} in index.html, found none.`);
  return element as T;
}

const canvasContainer = required<HTMLElement>("canvas-container");

const { renderer } = bootstrap(
  {
    canvasContainer,
    menu: {
      root: required("menu-screen"),
      playButton: required("menu-play-button"),
      settingsButton: required("menu-settings-button"),
      // One button per ARENA_SIZES entry, same order — index.html has one `#menu-size-N` per
      // entry, so deriving the count from ARENA_SIZES.length (not a hardcoded 10) means this
      // stays correct if the list is ever resized again without anyone having to remember to
      // update a second, unrelated-looking number here.
      sizeButtons: {
        buttons: ARENA_SIZES.map((_, i) => required<HTMLButtonElement>(`menu-size-${i}`)),
      },
    },
    hud: {
      root: required("hud-overlay"),
      massValue: required("hud-mass-value"),
    },
    gameOver: {
      root: required("game-over-screen"),
      scoreValue: required("game-over-score-value"),
      restartButton: required("game-over-restart-button"),
      menuButton: required("game-over-menu-button"),
    },
    victory: {
      root: required("victory-screen"),
      scoreValue: required("victory-score-value"),
      restartButton: required("victory-restart-button"),
      menuButton: required("victory-menu-button"),
    },
    settings: {
      root: required("settings-screen"),
      backButton: required("settings-back-button"),
      sfxVolume: required("settings-sfx-volume"),
      sfxMute: required("settings-sfx-mute"),
      musicVolume: required("settings-music-volume"),
      musicMute: required("settings-music-mute"),
    },
  },
  undefined,
  window.localStorage,
);

window.addEventListener("resize", () => {
  renderer.resize(canvasContainer.clientWidth, canvasContainer.clientHeight);
});
