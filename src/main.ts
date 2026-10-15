import "./ui/styles/main.scss";
import { bootstrap } from "@/session/bootstrap";

/** Throws with the element's id in the message if it's missing — fail loudly at startup, not with a silent null deref three layers deep. */
function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`main.ts: expected element #${id} in index.html, found none.`);
  return element as T;
}

const canvasContainer = required<HTMLElement>("canvas-container");

const { renderer } = bootstrap({
  canvasContainer,
  menu: {
    root: required("menu-screen"),
    playButton: required("menu-play-button"),
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
});

window.addEventListener("resize", () => {
  renderer.resize(canvasContainer.clientWidth, canvasContainer.clientHeight);
});
