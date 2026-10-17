import { Scene } from "phaser";
import {
  GAME_BOTTOM_MARGIN,
  GAME_HEIGHT,
  GAME_TOP_MARGIN,
  GAME_WIDTH,
  GAME_WINDOW_WIDTH,
} from "../../constants";
import { System } from "../../system";
import { GAME_MAPS } from "../maps";

export class Game extends Scene {
  constructor() {
    super("Game");
  }

  preload() {
    this.load.setPath("assets");
    this.load.image("marble_red", "marble_red.png");
    this.load.image("marble_green", "marble_green.png");
    this.load.image("hole", "hole.png");
  }

  create() {
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
    const mapButtons: Phaser.GameObjects.Text[] = [];
    let renderedMapIndex = -1;

    board.add([background, terrain, guideLine, pullLine, launchLine, descriptionText]);

    const system = new System(4, (args) => {
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
      mapButtons.forEach((button, i) => {
        const selected = i === args.mapIndex;
        button.setStyle({
          backgroundColor: selected ? "#e2b84f" : "#343434",
          color: selected ? "#161616" : "#f4f4f4",
        });
      });

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
    });

    this.add.text(20, 38, "맵 선택", {
      color: "#fff",
      fontSize: 24,
      fontStyle: "bold",
    });
    this.add.text(20, 73, "게임 시작 전 선택", {
      color: "#bbb",
      fontSize: 14,
    });
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
    GAME_MAPS.forEach((map, i) => {
      const button = this.add
        .text(20, 112 + i * 54, map.name, {
          color: "#f4f4f4",
          backgroundColor: "#343434",
          fontSize: 18,
        })
        .setPadding(12, 9)
        .setInteractive({ useHandCursor: true });
      button.on("pointerdown", () => system.selectMap(i));
      mapButtons.push(button);
    });

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
