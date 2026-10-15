/** What the game loop pushes live data through each frame. Implemented concretely by task 020's HudAdapter. */
export interface IHud {
  updateMass(mass: number): void;
}
