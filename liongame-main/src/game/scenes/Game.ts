import { Scene } from "phaser";
import {
  GAME_BOTTOM_MARGIN,
  GAME_HEIGHT,
  GAME_TOP_MARGIN,
  GAME_WIDTH,
  GAME_WINDOW_WIDTH,
} from "../../constants";
import { System } from "../../system";
import { loadSoundSettings, saveSoundSettings } from "../settings";

type GameLaunchData = {
  initialMapIndex?: number;
  resumeSavedGame?: boolean;
};

export class Game extends Scene {
  private initialMapIndex = 0;
  private resumeSavedGame = false;

  constructor() {
    super("Game");
  }

  init(data: GameLaunchData = {}) {
    this.initialMapIndex = data.initialMapIndex ?? 0;
    this.resumeSavedGame = data.resumeSavedGame ?? false;
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
    guideLine.setLineWidth(20, 1).setDepth(1);
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
    const marbleImages: Phaser.GameObjects.Image[] = [];
    const holeImages: Phaser.GameObjects.Image[] = [];
    const marbleLabelTexts: Phaser.GameObjects.Text[] = [];
    let renderedMapIndex = -1;

    board.add([background, terrain, guideLine, pullLine, launchLine, descriptionText]);

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

        descriptionText.setText(`맵: ${args.map.name}\n차례: ${args.turn + 1}   상태: ${args.state}`);
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
        args.marbles.forEach((marble, i) => {
          const myTurn = i === args.turn;
          if (myTurn) {
            holeImages.forEach((hole, holeIndex) => {
              const targetHole = holeIndex === marble.hole;
              hole.setAlpha(targetHole ? 0.95 : 0.35);
              if (targetHole) {
                guideLine.setTo(marble.x, marble.y, hole.x, hole.y);
              }
            });
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
      },
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
    const toBoardPoint = (pointer: Phaser.Input.Pointer) => ({
      x: pointer.x - boardX,
      y: pointer.y - boardY,
    });

    const showDrag = (pointer: Phaser.Input.Pointer) => {
      if (!dragOrigin) {
        return;
      }
      const point = toBoardPoint(pointer);
      const pullX = point.x - dragOrigin.x;
      const pullY = point.y - dragOrigin.y;
      pullLine.setTo(dragOrigin.x, dragOrigin.y, point.x, point.y);
      launchLine.setTo(dragOrigin.x, dragOrigin.y, dragOrigin.x - pullX, dragOrigin.y - pullY);
    };

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const point = toBoardPoint(pointer);
      dragOrigin = system.getDraggableMarblePosition(point.x, point.y);
      if (!dragOrigin) {
        return;
      }
      pullLine.setVisible(true);
      launchLine.setVisible(true);
      showDrag(pointer);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
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
      dragOrigin = null;
      pullLine.setVisible(false);
      launchLine.setVisible(false);
      system.launchMarble(launchX, launchY);
    };

    this.input.on("pointerup", finishDrag);
    this.input.on("pointerupoutside", finishDrag);

    system.render();
  }
}
