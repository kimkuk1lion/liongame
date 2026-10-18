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
import { loadSoundSettings, saveSoundSettings } from "../settings";

type GameLaunchData = {
  initialMapIndex?: number;
  resumeSavedGame?: boolean;
  initialScores?: number[];
};

export class Game extends Scene {
  private initialMapIndex = 0;
  private resumeSavedGame = false;
  private initialScores: number[] | undefined;

  constructor() {
    super("Game");
  }

  init(data: GameLaunchData = {}) {
    this.initialMapIndex = data.initialMapIndex ?? 0;
    this.resumeSavedGame = data.resumeSavedGame ?? false;
    this.initialScores = data.initialScores;
  }

  preload() {
    this.load.setPath("assets");
    this.load.image("marble_red", "marble_red.png");
    this.load.image("marble_green", "marble_green.png");
    this.load.image("hole", "hole.png");
  }

  create() {
    const soundSettings = loadSoundSettings();
    const boardX = (GAME_WINDOW_WIDTH - GAME_WIDTH) / 2;
    const boardY = GAME_TOP_MARGIN;
    const board = this.add.container(boardX, boardY);
    const background = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffdd)
      .setOrigin(0)
      .setDepth(-100);
    const terrain = this.add.graphics().setDepth(-50);
    const descriptionText = this.add.text(16, 14, "", {
      color: "#000",
      fontSize: 24,
      fontStyle: "bold",
    }).setDepth(100);
    const scoreboardText = this.add.text(GAME_WINDOW_WIDTH - 180, 180, "", {
      color: "#fff",
      fontSize: 17,
      lineSpacing: 10,
    });
    const guideLine = this.add.line(0, 0, 0, 0, 0, 0, 0xff0000, 0.3);
    guideLine.setLineWidth(10, 1).setDepth(1);
    const turnMarker = this.add.graphics().setDepth(3);
    const targetHoleMarker = this.add.graphics().setDepth(2);
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
    const timingTrack = this.add.rectangle(0, 0, 280, 14, 0x374151);
    const timingSweetSpot = this.add.rectangle(0, 0, 32, 24, 0x36b879, 0.9);
    const timingNeedle = this.add.circle(-140, 0, 11, 0xffffff).setStrokeStyle(3, 0x16202a);
    const timingCaption = this.add.text(0, -30, "중앙에 가까울수록 원하는 방향으로 발사", {
      color: "#fff",
      fontSize: 15,
      fontStyle: "bold",
      backgroundColor: "#172534",
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5);
    timingMeter.add([timingTrack, timingSweetSpot, timingNeedle, timingCaption]);
    timingMeter.setVisible(false);
    const gameOverOverlay = this.add.container(0, 0).setDepth(200).setVisible(false);
    gameOverOverlay.add([
      this.add.rectangle(GAME_WINDOW_WIDTH / 2, GAME_WINDOW_HEIGHT / 2, GAME_WINDOW_WIDTH, GAME_WINDOW_HEIGHT, 0x071019, 0.78),
      this.add.rectangle(GAME_WINDOW_WIDTH / 2, GAME_WINDOW_HEIGHT / 2, 650, 510, 0x1e3441, 1)
        .setStrokeStyle(4, 0xe4bd68),
      this.add.text(GAME_WINDOW_WIDTH / 2, GAME_WINDOW_HEIGHT / 2 - 190, "게임 종료", {
        color: "#fff2ce", fontSize: 46, fontStyle: "bold",
      }).setOrigin(0.5),
    ]);
    const gameOverSummary = this.add.text(GAME_WINDOW_WIDTH / 2, GAME_WINDOW_HEIGHT / 2 - 105, "마지막 구슬만 남았습니다.", {
      color: "#d9e5e7", fontSize: 21, align: "center", lineSpacing: 8,
    }).setOrigin(0.5);
    gameOverOverlay.add(gameOverSummary);
    const marbleImages: Phaser.GameObjects.Image[] = [];
    const holeImages: Phaser.GameObjects.Image[] = [];
    const marbleLabelTexts: Phaser.GameObjects.Text[] = [];
    let renderedMapIndex = -1;

    board.add([background, terrain, guideLine, pullLine, launchLine, aimFan, descriptionText, targetHoleMarker, turnMarker]);

    const system = new System(
      4,
      (args) => {
        if (marbleImages.length === 0) {
          args.marbles.forEach((marble) => {
            marbleImages.push(
              this.add.image(0, 0, marble.lion ? "marble_red" : "marble_green").setDepth(1),
            );
            marbleLabelTexts.push(
              this.add
                .text(0, 0, "", {
                  color: "#000",
                  fontSize: 40,
                  fontStyle: "bold",
                })
                .setDepth(2),
            );
          });
          args.holes.forEach((hole) => {
            holeImages.push(this.add.image(hole.x, hole.y, "hole"));
          });
          board.add([...holeImages, ...marbleImages, ...marbleLabelTexts]);
        }

        if (renderedMapIndex !== args.mapIndex) {
          background.setFillStyle(args.map.backgroundColor);
          terrain.clear();
          terrain.fillStyle(args.map.obstacleColor, 1);
          terrain.lineStyle(4, args.map.obstacleHighlight, 1);
          args.map.obstacles.forEach((obstacle) => {
            const x = obstacle.x - obstacle.width / 2;
            const y = obstacle.y - obstacle.height / 2;
            terrain.fillRoundedRect(x, y, obstacle.width, obstacle.height, 12);
            terrain.strokeRoundedRect(x, y, obstacle.width, obstacle.height, 12);
          });
          terrain.lineStyle(10, 0x514c3d, 0.9);
          terrain.strokeRect(12, 12, GAME_WIDTH - 24, GAME_HEIGHT - 24);
          args.holes.forEach((hole, i) => {
            holeImages[i].setPosition(hole.x, hole.y);
          });
          renderedMapIndex = args.mapIndex;
        }

        descriptionText.setText(`맵: ${args.map.name}\n상태: ${args.state}`);
        gameOverSummary.setText(
          `마지막 구슬만 남았습니다.\n\n${args.marbles.map((marble) => `구슬 ${marble.id + 1}  ${marble.score}점`).join("     ")}`,
        );
        gameOverOverlay.setVisible(args.state === "game_over");
        scoreboardText.setText(
          [
            "점수판",
            "자동 저장 · 이어하기",
            "",
            ...args.marbles.map((marble) => {
              const status = !marble.alive ? "잡힘" : marble.lion ? "사자" : "진행 중";
              return `구슬 ${marble.id + 1}: ${marble.score}점 · ${status}`;
            }),
          ].join("\n"),
        );
        holeImages.forEach((hole) => hole.setAlpha(0.24));
        targetHoleMarker.clear();
        turnMarker.clear();
        guideLine.setVisible(false);
        args.marbles.forEach((marble, i) => {
          const myTurn = i === args.turn;
          if (myTurn) {
            const targetHole = !marble.lion ? holeImages[marble.hole] : undefined;
            if (targetHole) {
              targetHole.setAlpha(1);
              guideLine.setTo(marble.x, marble.y, targetHole.x, targetHole.y).setVisible(true);
              targetHoleMarker.lineStyle(10, 0xffd447, 0.95);
              targetHoleMarker.strokeCircle(targetHole.x, targetHole.y, 31);
              targetHoleMarker.lineStyle(3, 0xffffff, 0.9);
              targetHoleMarker.strokeCircle(targetHole.x, targetHole.y, 40);
              // Four short ticks make the next destination stand out even on bright maps.
              targetHoleMarker.lineStyle(5, 0xffd447, 1);
              for (let tick = 0; tick < 4; tick += 1) {
                const angle = tick * Math.PI / 2;
                const inner = 46;
                const outer = 54;
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
          image.setTexture(marble.lion ? "marble_red" : "marble_green");
          image.setAlpha(marble.alive ? 1 : 0);

          const label = marbleLabelTexts[i];
          label.setPosition(marble.x - 13, marble.y - 17);
          label.setText(`${marble.id}`);
          label.setAlpha(marble.alive ? (myTurn ? 1 : 0.3) : 0);
        });
      },
      {
        initialMapIndex: this.initialMapIndex,
        resumeSavedGame: this.resumeSavedGame,
        initialScores: this.initialScores,
      },
    );
    const restartWithScoreChoice = (keepScores: boolean) => {
      const scores = keepScores ? system.getScores() : undefined;
      system.stop();
      clearSavedProgress();
      this.scene.restart({
        initialMapIndex: this.initialMapIndex,
        initialScores: scores,
      });
    };
    const addGameOverButton = (y: number, title: string, subtitle: string, action: () => void) => {
      const button = this.add.rectangle(GAME_WINDOW_WIDTH / 2, y, 530, 104, 0x31596a, 1)
        .setStrokeStyle(2, 0xd8b66b).setInteractive({ useHandCursor: true });
      const titleText = this.add.text(GAME_WINDOW_WIDTH / 2, y - 15, title, {
        color: "#fff2ce", fontSize: 25, fontStyle: "bold",
      }).setOrigin(0.5);
      const subtitleText = this.add.text(GAME_WINDOW_WIDTH / 2, y + 23, subtitle, {
        color: "#d1e0e2", fontSize: 16,
      }).setOrigin(0.5);
      gameOverOverlay.add([button, titleText, subtitleText]);
      button.on("pointerdown", action);
    };
    addGameOverButton(
      GAME_WINDOW_HEIGHT / 2 + 35,
      "점수 유지하고 다음 게임",
      "현재 구슬별 점수를 이어갑니다",
      () => restartWithScoreChoice(true),
    );
    addGameOverButton(
      GAME_WINDOW_HEIGHT / 2 + 160,
      "점수 초기화하고 새 게임",
      "모든 점수를 0점으로 시작합니다",
      () => restartWithScoreChoice(false),
    );
    this.add.text(
      GAME_WINDOW_WIDTH - 180,
      38,
      "구슬을 끌어당긴 뒤 놓으세요\n\n파란 선: 당기는 방향\n초록 선: 발사 방향",
      {
        color: "#eee",
        fontSize: 15,
        wordWrap: { width: 160 },
      },
    );
    this.add.text(GAME_WINDOW_WIDTH - 180, 390, "사운드 설정", {
      color: "#fff",
      fontSize: 20,
      fontStyle: "bold",
    });

    const createSoundToggle = (
      y: number,
      label: string,
      setting: "bgmEnabled" | "sfxEnabled",
    ) => {
      const button = this.add
        .text(GAME_WINDOW_WIDTH - 180, y, "", {
          color: "#fff",
          backgroundColor: "#263c54",
          fontSize: 15,
        })
        .setPadding(8, 7)
        .setInteractive({ useHandCursor: true });
      const update = () => {
        button.setText(`${label}: ${soundSettings[setting] ? "켜짐" : "꺼짐"}`);
        button.setStyle({ backgroundColor: soundSettings[setting] ? "#276447" : "#4b515b" });
      };
      button.on("pointerdown", () => {
        soundSettings[setting] = !soundSettings[setting];
        saveSoundSettings(soundSettings);
        update();
      });
      update();
    };

    createSoundToggle(430, "배경음악", "bgmEnabled");
    createSoundToggle(478, "효과음", "sfxEnabled");

    const createVolumeSlider = (y: number, label: string, setting: "bgmVolume" | "sfxVolume") => {
      const centerX = GAME_WINDOW_WIDTH - 95;
      const width = 145;
      const left = centerX - width / 2;
      const valueLabel = this.add.text(centerX, y - 18, "", {
        color: "#ddd",
        fontSize: 13,
      }).setOrigin(0.5);
      const track = this.add.rectangle(centerX, y + 12, width, 8, 0x64747d);
      const fill = this.add.rectangle(left, y + 12, 0, 8, 0xffd66f).setOrigin(0, 0.5);
      const knob = this.add.circle(left, y + 12, 10, 0xfff2ce).setStrokeStyle(2, 0x725d35);
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
      };
      const onMove = (pointer: Phaser.Input.Pointer) => {
        if (dragging) setVolume(pointer);
      };
      const onUp = () => { dragging = false; };
      hitArea.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        dragging = true;
        setVolume(pointer);
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

    createVolumeSlider(535, "배경음악 음량", "bgmVolume");
    createVolumeSlider(595, "효과음 음량", "sfxVolume");

    this.add
      .text(GAME_WINDOW_WIDTH - 180, 670, "로비로 나가기", {
        color: "#fff",
        backgroundColor: "#7a3c38",
        fontSize: 17,
      })
      .setPadding(10, 9)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        system.stop();
        this.scene.start("Lobby");
      });

    this.add
      .text(
        GAME_WINDOW_WIDTH / 2,
        boardY + GAME_HEIGHT + GAME_BOTTOM_MARGIN / 2,
        "하단 여백에 놓아도 발사됩니다",
        {
          color: "#ddd",
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
        .setColor(accurate ? "#aaffcc" : "#fff");
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
}
