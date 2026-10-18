import { Scene } from "phaser";
import {
  GAME_BOTTOM_MARGIN,
  GAME_HEIGHT,
  GAME_TOP_MARGIN,
  GAME_WIDTH,
  GAME_WINDOW_HEIGHT,
  GAME_WINDOW_WIDTH,
} from "../../constants";
import { clearSavedProgress, System } from "../../system";
import { playSoundEffect, startBackgroundMusic, updateBackgroundMusic } from "../audio";
import { loadObstaclesEnabled, loadSoundSettings, saveSoundSettings } from "../settings";

type GameLaunchData = {
  initialMapIndex?: number;
  initialPlayerCount?: number;
  resumeSavedGame?: boolean;
  initialScores?: number[];
};

export class Game extends Scene {
  private initialMapIndex = 0;
  private initialPlayerCount = 4;
  private resumeSavedGame = false;
  private initialScores: number[] | undefined;
  private manuallyEnded = false;
  private devEndQKey?: Phaser.Input.Keyboard.Key;
  private devEndWKey?: Phaser.Input.Keyboard.Key;
  private devEndHoldStartedAt: number | null = null;
  private requestEndGame: (() => void) | null = null;

  constructor() {
    super("Game");
  }

  init(data: GameLaunchData = {}) {
    this.initialMapIndex = data.initialMapIndex ?? 0;
    this.initialPlayerCount = Math.max(2, Math.min(4, Math.floor(data.initialPlayerCount ?? 4)));
    this.resumeSavedGame = data.resumeSavedGame ?? false;
    this.initialScores = data.initialScores;
    this.manuallyEnded = false;
    this.devEndHoldStartedAt = null;
    this.requestEndGame = null;
  }

  update(time: number) {
    if (!this.devEndQKey || !this.devEndWKey || !this.requestEndGame || this.manuallyEnded) {
      return;
    }

    if (this.devEndQKey.isDown && this.devEndWKey.isDown) {
      if (this.devEndHoldStartedAt === null) {
        this.devEndHoldStartedAt = time;
      } else if (time - this.devEndHoldStartedAt >= 3000) {
        this.manuallyEnded = true;
        this.requestEndGame();
      }
    } else {
      this.devEndHoldStartedAt = null;
    }
  }

  preload() {
    this.load.setPath("assets");
    this.load.image("marble_red", "marble_red.png");
    this.load.image("marble_green", "marble_green.png");
  }

  create() {
    this.devEndQKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.devEndWKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    const soundSettings = loadSoundSettings();
    startBackgroundMusic();
    const boardX = (GAME_WINDOW_WIDTH - GAME_WIDTH) / 2;
    const boardY = GAME_TOP_MARGIN;
    this.add.rectangle(0, 0, GAME_WINDOW_WIDTH, GAME_WINDOW_HEIGHT, 0xe8f5fa).setOrigin(0);
    this.add.rectangle(0, 0, GAME_WINDOW_WIDTH, GAME_TOP_MARGIN - 8, 0xd5eff5).setOrigin(0);
    const ambient = this.add.graphics();
    ambient.fillStyle(0x70d7c2, 0.22).fillCircle(80, 120, 110);
    ambient.fillStyle(0xffcb68, 0.23).fillCircle(920, 1650, 155);
    ambient.fillStyle(0x91c7e3, 0.15).fillCircle(930, 700, 190);
    this.add.rectangle(boardX - 18, boardY - 18, GAME_WIDTH + 36, GAME_HEIGHT + 36, 0xc5dbe4, 0.9)
      .setOrigin(0).setStrokeStyle(4, 0xffd47a, 1);
    this.add.rectangle(boardX - 9, boardY - 9, GAME_WIDTH + 18, GAME_HEIGHT + 18, 0xa9d5bd)
      .setOrigin(0).setStrokeStyle(3, 0xf8fff0, 0.95);
    this.createMarbleTextures();
    this.createHoleTexture();
    const board = this.add.container(boardX, boardY);
    const background = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffdd)
      .setOrigin(0)
      .setDepth(-100);
    const terrain = this.add.graphics().setDepth(-50);
    const descriptionText = this.add.text(16, 14, "", {
      color: "#203448",
      fontSize: 20,
      fontStyle: "bold",
      backgroundColor: "#f5f0df",
      padding: { x: 12, y: 8 },
    }).setDepth(100);
    const addPanel = (x: number, y: number, width: number, height: number, color: number) => {
      const panel = this.add.graphics();
      panel.fillStyle(color, 0.97).fillRoundedRect(x - width / 2, y - height / 2, width, height, 24);
      panel.lineStyle(3, 0xffffff, 0.95).strokeRoundedRect(x - width / 2, y - height / 2, width, height, 24);
      return panel;
    };
    const sideX = GAME_WINDOW_WIDTH - 90;
    addPanel(sideX, 105, 174, 145, 0xf9fff8);
    this.add.text(sideX - 80, 49, "당겨서 놓으세요", {
      color: "#315a69", fontSize: 15, fontStyle: "bold", wordWrap: { width: 158 },
    });
    this.add.text(sideX - 80, 88, "파랑 · 당기는 방향\n초록 · 발사 방향", {
      color: "#66828a", fontSize: 13, lineSpacing: 7, wordWrap: { width: 158 },
    });
    addPanel(sideX, 390, 174, 280, 0xf9fff8);
    const scoreboardTitle = this.add.text(sideX, 270, "이번 판 점수", {
      color: "#315a69", fontSize: 17, fontStyle: "bold",
    }).setOrigin(0.5);
    const scoreboardText = this.add.text(sideX - 80, 305, "", {
      color: "#42636e", fontSize: 15, lineSpacing: 12, fontStyle: "bold", wordWrap: { width: 155 },
    });
    const turnMarker = this.add.graphics().setDepth(3);
    const targetHoleMarker = this.add.graphics().setDepth(2);
    const targetHolePulse = this.add.circle(0, 0, 48)
      .setStrokeStyle(8, 0xffd447, 1)
      .setDepth(2.5)
      .setVisible(false);
    this.tweens.add({
      targets: targetHolePulse,
      scale: { from: 0.8, to: 1.22 },
      alpha: { from: 1, to: 0.12 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    const pullLine = this.add
      .line(0, 0, 0, 0, 0, 0, 0x2774d8, 0.85)
      .setVisible(false)
      .setDepth(4);
    pullLine.setLineWidth(8, 2);
    const launchLine = this.add
      .line(0, 0, 0, 0, 0, 0, 0x18a558, 0.9)
      .setVisible(false)
      .setDepth(4);
    launchLine.setLineWidth(8, 2);
    const aimFan = this.add.graphics().setVisible(false).setDepth(2.5);
    const timingMeter = this.add.container(GAME_WINDOW_WIDTH / 2, GAME_TOP_MARGIN - 42);
    const timingBack = this.add.rectangle(0, 0, 314, 54, 0xf9fff8).setStrokeStyle(2, 0xffffff);
    const timingTrack = this.add.rectangle(0, 0, 280, 14, 0xc8d9d8);
    const timingSweetSpot = this.add.rectangle(0, 0, 32, 24, 0x48c99a, 1);
    const timingNeedle = this.add.circle(-140, 0, 11, 0xffcb59).setStrokeStyle(3, 0xffffff);
    const timingCaption = this.add.text(0, -30, "중앙에 가까울수록 원하는 방향으로 발사", {
      color: "#42636e",
      fontSize: 15,
      fontStyle: "bold",
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5);
    timingMeter.add([timingBack, timingTrack, timingSweetSpot, timingNeedle, timingCaption]);
    timingMeter.setVisible(false);
    const gameOverOverlay = this.add.container(0, 0).setDepth(200).setVisible(false);
    gameOverOverlay.add([
      this.add.rectangle(GAME_WINDOW_WIDTH / 2, GAME_WINDOW_HEIGHT / 2, GAME_WINDOW_WIDTH, GAME_WINDOW_HEIGHT, 0x315369, 0.42),
      this.add.graphics().fillStyle(0x507e79, 0.32).fillRoundedRect(
        GAME_WINDOW_WIDTH / 2 - 330, GAME_WINDOW_HEIGHT / 2 - 248, 660, 520, 32,
      ),
      this.add.graphics().fillStyle(0xfff8e8, 1)
        .fillRoundedRect(GAME_WINDOW_WIDTH / 2 - 325, GAME_WINDOW_HEIGHT / 2 - 258, 650, 510, 32)
        .lineStyle(4, 0xffd274, 1)
        .strokeRoundedRect(GAME_WINDOW_WIDTH / 2 - 325, GAME_WINDOW_HEIGHT / 2 - 258, 650, 510, 32),
      this.add.text(GAME_WINDOW_WIDTH / 2, GAME_WINDOW_HEIGHT / 2 - 190, "게임 종료", {
        color: "#244657", fontSize: 46, fontStyle: "bold",
      }).setOrigin(0.5),
    ]);
    const gameOverSummary = this.add.text(GAME_WINDOW_WIDTH / 2, GAME_WINDOW_HEIGHT / 2 - 120, "마지막 구슬만 남았습니다.", {
      color: "#56727b", fontSize: 21, align: "center", lineSpacing: 8, wordWrap: { width: 560 },
    }).setOrigin(0.5);
    gameOverOverlay.add(gameOverSummary);
    const gameOverMarbleImages: Phaser.GameObjects.Image[] = [];
    const gameOverMarbleNumbers: Phaser.GameObjects.Text[] = [];
    const gameOverScoreTexts: Phaser.GameObjects.Text[] = [];
    const gameOverCenterY = GAME_WINDOW_HEIGHT / 2;
    for (let i = 0; i < this.initialPlayerCount; i += 1) {
      const x = GAME_WINDOW_WIDTH / 2 + (i - (this.initialPlayerCount - 1) / 2) * 145;
      const y = gameOverCenterY - 48;
      const image = this.add.image(x, y, "marble_green_polished").setDisplaySize(44, 44);
      const number = this.add.text(x, y - 1, `${i + 1}`, {
        color: "#ffffff", fontSize: 17, fontStyle: "bold", stroke: "#17313b", strokeThickness: 4,
      }).setOrigin(0.5);
      const score = this.add.text(x, gameOverCenterY - 8, "0점", {
        color: "#315a69", fontSize: 20, fontStyle: "bold",
      }).setOrigin(0.5);
      gameOverMarbleImages.push(image);
      gameOverMarbleNumbers.push(number);
      gameOverScoreTexts.push(score);
    }
    gameOverOverlay.add([...gameOverMarbleImages, ...gameOverMarbleNumbers, ...gameOverScoreTexts]);
    const marbleImages: Phaser.GameObjects.Image[] = [];
    const holeImages: Phaser.GameObjects.Image[] = [];
    const marbleLabelTexts: Phaser.GameObjects.Text[] = [];
    let renderedMapIndex = -1;

    board.add([background, terrain, pullLine, launchLine, aimFan, descriptionText, targetHoleMarker, targetHolePulse, turnMarker]);

    const system = new System(
      this.initialPlayerCount,
      (args) => {
        if (marbleImages.length === 0) {
          args.marbles.forEach((marble) => {
            marbleImages.push(this.add.image(0, 0, marble.lion ? "marble_red_polished" : "marble_green_polished")
              .setDisplaySize(32, 32).setDepth(1));
            marbleLabelTexts.push(
              this.add
                .text(0, 0, "", {
                  color: "#ffffff",
                  fontSize: 16,
                  fontStyle: "bold",
                  stroke: "#17313b",
                  strokeThickness: 4,
                })
                .setDepth(2),
            );
          });
          args.holes.forEach((hole) => {
            holeImages.push(this.add.image(hole.x, hole.y, "hole_polished").setDisplaySize(68, 68));
          });
          board.add([...holeImages, ...marbleImages, ...marbleLabelTexts]);
        }

        if (renderedMapIndex !== args.mapIndex) {
          background.setFillStyle(args.map.backgroundColor);
          terrain.clear();
          terrain.fillStyle(0xffffff, 0.12);
          for (let row = 0; row < 14; row += 1) {
            for (let column = 0; column < 6; column += 1) {
              if ((row + column) % 2 === 0) terrain.fillCircle(50 + column * 100, 55 + row * 90, 2.5);
            }
          }
          terrain.fillStyle(args.map.obstacleColor, 1);
          terrain.lineStyle(4, args.map.obstacleHighlight, 1);
          if (args.obstaclesEnabled) {
            args.map.obstacles.forEach((obstacle) => {
              const x = obstacle.x - obstacle.width / 2;
              const y = obstacle.y - obstacle.height / 2;
              terrain.fillStyle(0x18332b, 0.2);
              terrain.fillRoundedRect(x + 3, y + 10, obstacle.width, obstacle.height, 14);
              terrain.fillStyle(args.map.obstacleColor, 1);
              terrain.fillRoundedRect(x, y, obstacle.width, obstacle.height, 12);
              terrain.lineStyle(2, 0xffffff, 0.14);
              terrain.lineBetween(x + 12, y + 5, x + obstacle.width - 12, y + 5);
              terrain.lineStyle(4, args.map.obstacleHighlight, 1);
              terrain.strokeRoundedRect(x, y, obstacle.width, obstacle.height, 12);
            });
          }
          terrain.lineStyle(8, 0x577a66, 0.95);
          terrain.strokeRect(7, 7, GAME_WIDTH - 14, GAME_HEIGHT - 14);
          terrain.lineStyle(2, 0xf8f0d3, 0.58);
          terrain.strokeRect(17, 17, GAME_WIDTH - 34, GAME_HEIGHT - 34);
          args.holes.forEach((hole, i) => {
            holeImages[i].setPosition(hole.x, hole.y);
          });
          renderedMapIndex = args.mapIndex;
        }

        const stateLabel = args.state === "wait_move" ? "구슬을 끌어당겨 보세요"
          : args.state === "moving" ? "구슬 이동 중" : "게임 종료";
        descriptionText.setText(`${args.map.name}  ·  ${stateLabel}${args.obstaclesEnabled ? "" : "  ·  방해물 없음"}`);
        scoreboardTitle.setText(`구슬 ${args.turn + 1}의 차례`);
        gameOverSummary.setText(this.manuallyEnded ? "게임을 종료했습니다." : "마지막 구슬만 남았습니다.");
        args.marbles.forEach((marble, i) => {
          gameOverMarbleImages[i]
            .setTexture(marble.lion ? "marble_red_polished" : "marble_green_polished")
            .setAlpha(marble.alive ? 1 : 0.48);
          gameOverMarbleNumbers[i].setAlpha(marble.alive ? 1 : 0.7);
          gameOverScoreTexts[i].setText(`${marble.score}점`);
        });
        gameOverOverlay.setVisible(args.state === "game_over");
        scoreboardText.setText(
          [
            ...args.marbles.map((marble) => {
            const status = !marble.alive ? "탈락" : marble.lion ? "사자 구슬" : "플레이 중";
            return `구슬 ${marble.id + 1}  ${marble.score}점\n${status}`;
            }),
          ].join("\n"),
        );
        holeImages.forEach((hole) => hole.setAlpha(0.42));
        targetHoleMarker.clear();
        targetHolePulse.setVisible(false);
        turnMarker.clear();
        args.marbles.forEach((marble, i) => {
          const myTurn = i === args.turn;
          if (myTurn) {
            const targetHole = !marble.lion ? holeImages[marble.hole] : undefined;
            if (targetHole) {
              targetHole.setAlpha(1);
              targetHolePulse.setPosition(targetHole.x, targetHole.y).setVisible(true);
              targetHoleMarker.lineStyle(12, 0xffd447, 1);
              targetHoleMarker.strokeCircle(targetHole.x, targetHole.y, 36);
              targetHoleMarker.lineStyle(4, 0xffffff, 1);
              targetHoleMarker.strokeCircle(targetHole.x, targetHole.y, 45);
              // Four short ticks make the next destination stand out even on bright maps.
              targetHoleMarker.lineStyle(7, 0xffd447, 1);
              for (let tick = 0; tick < 4; tick += 1) {
                const angle = tick * Math.PI / 2;
                const inner = 50;
                const outer = 58;
                targetHoleMarker.lineBetween(
                  targetHole.x + Math.cos(angle) * inner,
                  targetHole.y + Math.sin(angle) * inner,
                  targetHole.x + Math.cos(angle) * outer,
                  targetHole.y + Math.sin(angle) * outer,
                );
              }
            }
            // A bright double ring marks the marble that can be dragged now.
            turnMarker.fillStyle(0xffd447, 0.2);
            turnMarker.fillCircle(marble.x, marble.y, 28);
            turnMarker.lineStyle(5, 0xffd447, 1);
            turnMarker.strokeCircle(marble.x, marble.y, 29);
            turnMarker.lineStyle(2, 0xffffff, 0.95);
            turnMarker.strokeCircle(marble.x, marble.y, 35);
          }

          const image = marbleImages[i];
          image.setPosition(marble.x, marble.y);
          image.setTexture(marble.lion ? "marble_red_polished" : "marble_green_polished");
          image.setAlpha(marble.alive ? 1 : 0);

          const label = marbleLabelTexts[i];
          label.setPosition(marble.x - 6, marble.y - 8);
          label.setText(`${marble.id + 1}`);
          label.setAlpha(marble.alive ? (myTurn ? 1 : 0.3) : 0);
        });
      },
      {
        initialMapIndex: this.initialMapIndex,
        resumeSavedGame: this.resumeSavedGame,
        initialScores: this.initialScores,
        obstaclesEnabled: loadObstaclesEnabled(),
        onSoundEffect: playSoundEffect,
      },
    );
    this.requestEndGame = () => system.endGame();
    const restartWithScoreChoice = (keepScores: boolean) => {
      playSoundEffect("ui");
      const scores = keepScores ? system.getScores() : undefined;
      system.stop();
      clearSavedProgress();
      this.scene.restart({
        initialMapIndex: this.initialMapIndex,
        initialPlayerCount: this.initialPlayerCount,
        initialScores: scores,
      });
    };
    const addGameOverButton = (y: number, title: string, subtitle: string, action: () => void) => {
      const buttonArt = this.add.graphics();
      const buttonColor = title.includes("초기화") ? 0x4e88c7 : 0x32a783;
      buttonArt.fillStyle(buttonColor, 1).fillRoundedRect(GAME_WINDOW_WIDTH / 2 - 265, y - 52, 530, 104, 25);
      buttonArt.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(GAME_WINDOW_WIDTH / 2 - 265, y - 52, 530, 104, 25);
      const button = this.add.rectangle(GAME_WINDOW_WIDTH / 2, y, 530, 104, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      const titleText = this.add.text(GAME_WINDOW_WIDTH / 2, y - 15, title, {
        color: "#fffaf0", fontSize: 25, fontStyle: "bold",
      }).setOrigin(0.5);
      const subtitleText = this.add.text(GAME_WINDOW_WIDTH / 2, y + 23, subtitle, {
        color: "#d9f0e8", fontSize: 16,
      }).setOrigin(0.5);
      gameOverOverlay.add([buttonArt, button, titleText, subtitleText]);
      button.on("pointerdown", action);
    };
    addGameOverButton(
      GAME_WINDOW_HEIGHT / 2 + 75,
      "점수 유지하고 다음 게임",
      "현재 구슬별 점수를 이어갑니다",
      () => restartWithScoreChoice(true),
    );
    addGameOverButton(
      GAME_WINDOW_HEIGHT / 2 + 175,
      "점수 초기화하고 새 게임",
      "모든 점수를 0점으로 시작합니다",
      () => restartWithScoreChoice(false),
    );
    addPanel(sideX, 800, 174, 395, 0xf9fff8);
    this.add.text(sideX - 80, 610, "사운드 설정", {
      color: "#315a69", fontSize: 17, fontStyle: "bold",
    });

    const createSoundToggle = (
      y: number,
      label: string,
      setting: "bgmEnabled" | "sfxEnabled",
    ) => {
      const buttonBackground = this.add.graphics();
      const button = this.add
        .text(sideX, y, "", {
          color: "#fffaf0",
          fontSize: 14,
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setPadding(12, 7)
        .setInteractive({ useHandCursor: true });
      const update = () => {
        const enabled = soundSettings[setting];
        button.setText(`${label}  ${enabled ? "켜짐 ●" : "꺼짐 ○"}`);
        buttonBackground.clear();
        buttonBackground.fillStyle(enabled ? 0x318d78 : 0x8ca1a5, 1)
          .fillRoundedRect(sideX - 79, y - 17, 158, 34, 17);
      };
      button.on("pointerdown", () => {
        soundSettings[setting] = !soundSettings[setting];
        saveSoundSettings(soundSettings);
        update();
        if (setting === "bgmEnabled") updateBackgroundMusic();
        playSoundEffect("ui");
      });
      update();
    };

    createSoundToggle(655, "배경음악", "bgmEnabled");
    createSoundToggle(705, "효과음", "sfxEnabled");

    const createVolumeSlider = (y: number, label: string, setting: "bgmVolume" | "sfxVolume") => {
      const centerX = sideX;
      const width = 145;
      const left = centerX - width / 2;
      const valueLabel = this.add.text(centerX, y - 18, "", {
        color: "#59757d",
        fontSize: 13,
      }).setOrigin(0.5);
      const track = this.add.rectangle(centerX, y + 12, width, 8, 0xc5d8d5);
      const fill = this.add.rectangle(left, y + 12, 0, 8, 0x39a987).setOrigin(0, 0.5);
      const knob = this.add.circle(left, y + 12, 10, 0xffcf66).setStrokeStyle(2, 0xffffff);
      const hitArea = this.add.rectangle(centerX, y + 12, width, 36, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      const update = () => {
        const volume = soundSettings[setting];
        valueLabel.setText(`${label}: ${volume}%`);
        fill.width = width * volume / 100;
        knob.setX(left + width * volume / 100);
      };
      let dragging = false;
      const setVolume = (pointer: Phaser.Input.Pointer) => {
        soundSettings[setting] = Math.round(Math.max(0, Math.min(1, (pointer.x - left) / width)) * 100);
        saveSoundSettings(soundSettings);
        update();
        if (setting === "bgmVolume") updateBackgroundMusic();
      };
      const onMove = (pointer: Phaser.Input.Pointer) => {
        if (dragging) setVolume(pointer);
      };
      const onUp = () => { dragging = false; };
      hitArea.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        dragging = true;
        setVolume(pointer);
        playSoundEffect("ui");
      });
      this.input.on("pointermove", onMove);
      this.input.on("pointerup", onUp);
      this.input.on("pointerupoutside", onUp);
      this.events.once("shutdown", () => {
        this.input.off("pointermove", onMove);
        this.input.off("pointerup", onUp);
        this.input.off("pointerupoutside", onUp);
      });
      track.setAlpha(0.9);
      update();
    };

    createVolumeSlider(770, "배경음악", "bgmVolume");
    createVolumeSlider(840, "효과음", "sfxVolume");

    const lobbyButtonBackground = this.add.graphics();
    lobbyButtonBackground.fillStyle(0xec786b, 1).fillRoundedRect(sideX - 76, 905, 152, 42, 20);
    this.add
      .text(sideX, 926, "로비로 나가기", {
        color: "#fffaf0", fontSize: 15, fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        playSoundEffect("ui");
        system.stop();
        this.scene.start("Lobby");
      });

    this.add
      .text(
        GAME_WINDOW_WIDTH / 2,
        boardY + GAME_HEIGHT + GAME_BOTTOM_MARGIN / 2,
        "하단 여백에 놓아도 발사됩니다",
        {
          color: "#456c78",
          fontSize: 18,
        },
      )
      .setOrigin(0.5);
    let dragOrigin: { x: number; y: number } | null = null;
    let lastPointer: Phaser.Input.Pointer | null = null;
    let dragStartedAt = 0;
    const maxSpreadRadians = (55 * Math.PI) / 180;
    const timingCycleMs = 1800;
    const toBoardPoint = (pointer: Phaser.Input.Pointer) => ({
      x: pointer.x - boardX,
      y: pointer.y - boardY,
    });

    const getTiming = (now: number) => {
      const phase = ((now - dragStartedAt) / timingCycleMs) * Math.PI * 2 - Math.PI / 2;
      const position = Math.sin(phase);
      const error = Math.abs(position);
      timingNeedle.setX(position * 132);
      const accurate = error < 0.14;
      timingNeedle.setFillStyle(accurate ? 0x72f0ad : error < 0.55 ? 0xffd166 : 0xff6b6b);
      timingCaption
        .setText(accurate ? "정확한 타이밍" : "타이밍 오차 · 방향 편차 증가")
        .setColor(accurate ? "#168a63" : "#c64d47");
      return {
        error,
        spread: (2 * Math.PI) / 180 + error * maxSpreadRadians,
      };
    };

    const showDrag = (pointer: Phaser.Input.Pointer) => {
      if (!dragOrigin) {
        return;
      }
      const point = toBoardPoint(pointer);
      const pullX = point.x - dragOrigin.x;
      const pullY = point.y - dragOrigin.y;
      pullLine.setTo(dragOrigin.x, dragOrigin.y, point.x, point.y);
      launchLine.setTo(dragOrigin.x, dragOrigin.y, dragOrigin.x - pullX, dragOrigin.y - pullY);
      const intendedAngle = Math.atan2(-pullY, -pullX);
      const { error, spread } = getTiming(performance.now());
      const fanPoints = [{ x: dragOrigin.x, y: dragOrigin.y }];
      const fanRadius = 110;
      const fanSteps = 16;
      for (let step = 0; step <= fanSteps; step += 1) {
        const angle = intendedAngle - spread + (spread * 2 * step) / fanSteps;
        fanPoints.push({
          x: dragOrigin.x + Math.cos(angle) * fanRadius,
          y: dragOrigin.y + Math.sin(angle) * fanRadius,
        });
      }
      aimFan.clear();
      aimFan.fillStyle(error < 0.14 ? 0x42d985 : error < 0.55 ? 0xffc247 : 0xff5757, 0.28);
      aimFan.fillPoints(fanPoints, true);
    };

    const updateTimingPreview = () => {
      if (dragOrigin && lastPointer) showDrag(lastPointer);
    };
    this.events.on("update", updateTimingPreview);
    this.events.once("shutdown", () => this.events.off("update", updateTimingPreview));

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const point = toBoardPoint(pointer);
      dragOrigin = system.getDraggableMarblePosition(point.x, point.y);
      if (!dragOrigin) {
        return;
      }
      dragStartedAt = performance.now();
      lastPointer = pointer;
      timingMeter.setVisible(true);
      aimFan.setVisible(true);
      pullLine.setVisible(true);
      launchLine.setVisible(true);
      showDrag(pointer);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        lastPointer = pointer;
        showDrag(pointer);
      }
    });

    const finishDrag = (pointer: Phaser.Input.Pointer) => {
      if (!dragOrigin) {
        return;
      }
      const point = toBoardPoint(pointer);
      const launchX = dragOrigin.x - point.x;
      const launchY = dragOrigin.y - point.y;
      const { spread } = getTiming(performance.now());
      dragOrigin = null;
      lastPointer = null;
      pullLine.setVisible(false);
      launchLine.setVisible(false);
      aimFan.clear().setVisible(false);
      timingMeter.setVisible(false);
      system.launchMarble(launchX, launchY, spread);
    };

    this.input.on("pointerup", finishDrag);
    this.input.on("pointerupoutside", finishDrag);

    system.render();
  }

  private createMarbleTextures() {
    const create = (key: string, base: string, shadow: string, shine: string) => {
      if (this.textures.exists(key)) return;
      const texture = this.textures.createCanvas(key, 96, 96);
      if (!texture) return;
      const context = texture.getContext();
      const gradient = context.createRadialGradient(30, 25, 4, 48, 50, 48);
      gradient.addColorStop(0, shine);
      gradient.addColorStop(0.22, base);
      gradient.addColorStop(0.78, base);
      gradient.addColorStop(1, shadow);
      context.clearRect(0, 0, 96, 96);
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(48, 48, 45, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "rgba(255,255,255,0.52)";
      context.beginPath();
      context.ellipse(34, 28, 13, 7, -0.55, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(255,255,255,0.48)";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(48, 48, 43, 0, Math.PI * 2);
      context.stroke();
      texture.refresh();
    };
    create("marble_red_polished", "#ff796c", "#a93442", "#fff1dc");
    create("marble_green_polished", "#54d0aa", "#16765f", "#f0fff1");
  }

  private createHoleTexture() {
    const key = "hole_polished";
    if (this.textures.exists(key)) return;
    const texture = this.textures.createCanvas(key, 128, 128);
    if (!texture) return;
    const context = texture.getContext();
    context.clearRect(0, 0, 128, 128);
    context.fillStyle = "rgba(55,112,96,0.20)";
    context.beginPath();
    context.ellipse(64, 73, 49, 42, 0, 0, Math.PI * 2);
    context.fill();
    const rim = context.createRadialGradient(64, 54, 18, 64, 64, 60);
    rim.addColorStop(0, "#263d60");
    rim.addColorStop(0.47, "#344b6a");
    rim.addColorStop(0.57, "#8e74ba");
    rim.addColorStop(0.67, "#ffe39b");
    rim.addColorStop(0.76, "#fff8df");
    rim.addColorStop(0.84, "#80d8c1");
    rim.addColorStop(0.92, "rgba(128,216,193,0.12)");
    rim.addColorStop(1, "rgba(128,216,193,0)");
    context.fillStyle = rim;
    context.beginPath();
    context.arc(64, 62, 62, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.8)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(64, 62, 48, Math.PI * 1.08, Math.PI * 1.88);
    context.stroke();
    context.fillStyle = "rgba(255,255,255,0.18)";
    context.beginPath();
    context.ellipse(51, 39, 15, 5, -0.4, 0, Math.PI * 2);
    context.fill();
    texture.refresh();
  }
}
