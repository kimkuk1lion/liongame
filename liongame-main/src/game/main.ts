import { GAME_WINDOW_HEIGHT, GAME_WINDOW_WIDTH } from "../constants";
import { Game as MainGame } from "./scenes/Game";
import { Lobby } from "./scenes/Lobby";
import { AUTO, Game, Scale, Types } from "phaser";

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
  type: AUTO,
  width: GAME_WINDOW_WIDTH,
  height: GAME_WINDOW_HEIGHT,
  parent: "game-container",
  backgroundColor: "#e8f5fa",
  scale: {
    mode: Scale.FIT,
    autoCenter: Scale.CENTER_BOTH,
  },
  scene: [Lobby, MainGame],
};

const StartGame = (parent: string) => {
  return new Game({ ...config, parent });
};

export default StartGame;
