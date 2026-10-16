import { Scene } from "phaser";
import { System } from "../../system";

export class Game extends Scene {
  constructor() {
    super("Game");
  }

  preload() {
    this.load.setPath("assets");
    this.load.image("marble_red", "marble_red.png");
    this.load.image("marble_green", "marble_green.png");
    this.load.image("hole", "hole.png");
    this.load.image("cursor", "cursor.png");
  }

  create() {
    const marbleImages: Phaser.GameObjects.Image[] = [];
    const holeImages: Phaser.GameObjects.Image[] = [];
    const marbleLabelTexts: Phaser.GameObjects.Text[] = [];
    const descriptionText = this.add.text(0, 0, "", {
      color: "#000",
      fontSize: 34,
    });
    const guideLine = this.add.line(0, 0, 0, 0, 0, 0, 0xff0000, 0.3);
    guideLine.setDepth(99).setLineWidth(20, 1);

    let init = false;
    const system = new System(4, (args) => {
      if (!init) {
        init = true;
        args.marbles.forEach((marble, i) => {
          marbleImages.push(
            this.add.image(0, 0, marble.lion ? "marble_red" : "marble_green").setDepth(1)
          );
          marbleLabelTexts.push(
            this.add
              .text(0, 0, "asdjflkasdjfl", {
                color: "#000",
                fontSize: 40,
                fontStyle: "bold",
              })
              .setDepth(2)
          );
        });

        args.holes.forEach((hole, i) => {
          holeImages.push(this.add.image(hole.x, hole.y, "hole"));
        });
      }

      descriptionText.setText(`turn: ${args.turn}\nstate: ${args.state}`);

      args.marbles.forEach((marble, i) => {
        const myTurn = i == args.turn;
        if (myTurn) {
          holeImages.forEach((hole, hole_i) => {
            const targetHole = hole_i == marble.hole;
            hole.setAlpha(targetHole ? 0.9 : 0.3);
            if (targetHole) {
              guideLine.setTo(marble.x, marble.y, hole.x, hole.y);
            }
          });
        }
        const img = marbleImages[i];
        img.setX(marble.x);
        img.setY(marble.y);
        img.setTexture(marble.lion ? "marble_red" : "marble_green");
        const txt = marbleLabelTexts[i];
        txt.setX(marble.x - 13);
        txt.setY(marble.y - 17);
        txt.setText(`${marble.id}`);
        txt.setAlpha(myTurn ? 1 : 0.3);

        if (!marble.lion) {
        }

        if (!marble.alive) {
          img.setAlpha(0);
          txt.setAlpha(0);
          return;
        }
      });
    });

    const pullLine = this.add.line(0, 0, 0, 0, 0, 0, 0x2774d8, 0.8);
    pullLine.setDepth(100).setLineWidth(8, 2).setVisible(false);
    const launchLine = this.add.line(0, 0, 0, 0, 0, 0, 0x18a558, 0.8);
    launchLine.setDepth(100).setLineWidth(8, 2).setVisible(false);
    let dragOrigin: { x: number; y: number } | null = null;

    const showDrag = (pointer: Phaser.Input.Pointer) => {
      if (!dragOrigin) {
        return;
      }
      const pullX = pointer.x - dragOrigin.x;
      const pullY = pointer.y - dragOrigin.y;
      pullLine.setTo(dragOrigin.x, dragOrigin.y, pointer.x, pointer.y);
      launchLine.setTo(
        dragOrigin.x,
        dragOrigin.y,
        dragOrigin.x - pullX,
        dragOrigin.y - pullY,
      );
    };

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      dragOrigin = system.getDraggableMarblePosition(pointer.x, pointer.y);
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
      const launchX = dragOrigin.x - pointer.x;
      const launchY = dragOrigin.y - pointer.y;
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
