import { Scene } from "phaser";
import { GAME_WINDOW_HEIGHT, GAME_WINDOW_WIDTH } from "../../constants";
import { clearSavedProgress, hasSavedProgress } from "../../system";
import { GAME_MAPS } from "../maps";
import { playSoundEffect, startBackgroundMusic, updateBackgroundMusic } from "../audio";
import {
  loadMapSelection,
  loadObstaclesEnabled,
  loadSoundSettings,
  saveObstaclesEnabled,
  saveMapSelection,
  saveSoundSettings,
} from "../settings";

export class Lobby extends Scene {
  private viewObjects: Phaser.GameObjects.GameObject[] = [];
  private viewCleanups: Array<() => void> = [];
  private selectedMap = 0;
  private playerCount = 4;
  private obstaclesEnabled = true;
  private soundSettings = loadSoundSettings();

  constructor() {
    super("Lobby");
  }

  preload() {
    // The lobby art is drawn with Phaser primitives, so no external image is needed.
  }

  create() {
    this.selectedMap = loadMapSelection(GAME_MAPS.length);
    this.obstaclesEnabled = loadObstaclesEnabled();
    this.soundSettings = loadSoundSettings();
    startBackgroundMusic();
    this.drawLobbyBackdrop();
    this.drawMascot(GAME_WINDOW_WIDTH / 2, 285);
    this.add.text(GAME_WINDOW_WIDTH / 2, 475, "사자 구슬 게임", {
      color: "#244657", fontSize: 58, fontStyle: "bold", stroke: "#f6ffff", strokeThickness: 6,
    }).setOrigin(0.5);
    this.add.text(GAME_WINDOW_WIDTH / 2, 550, "한 번의 멋진 샷으로 판을 뒤집어 보세요!", {
      color: "#4c7180", fontSize: 22, fontStyle: "bold",
    }).setOrigin(0.5);
    this.add.text(GAME_WINDOW_WIDTH / 2, 690, "어디부터 시작할까요?", {
      color: "#357f76", fontSize: 19, fontStyle: "bold",
    }).setOrigin(0.5);
    this.showMenu();
  }

  private drawLobbyBackdrop() {
    this.add.rectangle(0, 0, GAME_WINDOW_WIDTH, GAME_WINDOW_HEIGHT, 0xe8f5fa).setOrigin(0);
    this.add.rectangle(0, 0, GAME_WINDOW_WIDTH, 710, 0xd5eff5).setOrigin(0);
    const decor = this.add.graphics();
    const bubbles = [
      [78, 148, 34, 0x70d7c2], [900, 210, 52, 0xffcb68], [116, 590, 14, 0xf7f2dd],
      [872, 570, 22, 0x89cbd1], [58, 1080, 18, 0xff8d75], [936, 1220, 38, 0x72d4b0],
      [162, 1450, 32, 0xffcf78], [830, 1510, 17, 0xff9584],
    ] as const;
    bubbles.forEach(([x, y, radius, color]) => {
      decor.fillStyle(color, 0.18).fillCircle(x, y, radius + 7);
      decor.fillStyle(color, 0.74).fillCircle(x, y, radius);
      decor.fillStyle(0xffffff, 0.42).fillCircle(x - radius * 0.3, y - radius * 0.35, Math.max(3, radius * 0.2));
    });
    decor.fillStyle(0xffffff, 0.45).fillRoundedRect(44, 748, 912, 445, 42);
    decor.lineStyle(2, 0xffffff, 0.8).strokeRoundedRect(44, 748, 912, 445, 42);
  }

  private drawMascot(x: number, y: number) {
    const mascot = this.add.graphics();
    mascot.fillStyle(0x0d1c28, 0.32).fillEllipse(x, y + 84, 185, 30);
    mascot.fillStyle(0xffa83d, 1).fillCircle(x, y, 105);
    mascot.fillStyle(0xffcb63, 1).fillCircle(x, y + 4, 79);
    mascot.fillStyle(0xffe6a2, 1).fillEllipse(x, y + 15, 110, 89);
    mascot.fillStyle(0xffcb63, 1).fillCircle(x - 56, y - 52, 34);
    mascot.fillStyle(0xffcb63, 1).fillCircle(x + 56, y - 52, 34);
    mascot.fillStyle(0xf28c53, 1).fillCircle(x - 56, y - 52, 17);
    mascot.fillStyle(0xf28c53, 1).fillCircle(x + 56, y - 52, 17);
    mascot.fillStyle(0x273847, 1).fillEllipse(x - 29, y - 5, 12, 19);
    mascot.fillStyle(0x273847, 1).fillEllipse(x + 29, y - 5, 12, 19);
    mascot.fillStyle(0xffffff, 0.9).fillCircle(x - 32, y - 11, 4);
    mascot.fillStyle(0xffffff, 0.9).fillCircle(x + 26, y - 11, 4);
    mascot.fillStyle(0xf28c53, 1).fillEllipse(x, y + 31, 49, 31);
    mascot.fillStyle(0x533e3a, 1).fillTriangle(x - 11, y + 25, x + 11, y + 25, x, y + 36);
    mascot.lineStyle(4, 0x533e3a, 0.9).beginPath()
      .moveTo(x, y + 37).lineTo(x, y + 47).arc(x - 11, y + 47, 11, 0, Math.PI / 2, false)
      .moveTo(x, y + 47).arc(x + 11, y + 47, 11, Math.PI / 2, Math.PI, false).strokePath();
    mascot.fillStyle(0xff7c70, 0.76).fillCircle(x - 61, y + 29, 12);
    mascot.fillStyle(0xff7c70, 0.76).fillCircle(x + 61, y + 29, 12);
    mascot.lineStyle(5, 0xffffff, 0.75).strokeCircle(x, y, 102);
  }

  private clearView() {
    this.viewCleanups.forEach((cleanup) => cleanup());
    this.viewCleanups = [];
    this.viewObjects.forEach((object) => object.destroy());
    this.viewObjects = [];
  }

  private keep<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.viewObjects.push(object);
    return object;
  }

  private showMenu() {
    this.clearView();
    const cards = [
      { x: 205, title: "게임 시작", sub: "이어하기 · 새 게임", action: () => this.showStart(), icon: "play", color: 0x38a888 },
      { x: 500, title: "사운드 설정", sub: "배경음악 · 효과음", action: () => this.showSound(), icon: "sound", color: 0xe2a844 },
      { x: 795, title: "맵 선택", sub: `현재 맵 · ${GAME_MAPS[this.selectedMap].name}`, action: () => this.showMap(), icon: "map", color: 0x598dcc },
    ];
    cards.forEach((card) => {
      const y = 940;
      this.keep(this.add.graphics()).fillStyle(0x0b1723, 0.46).fillRoundedRect(card.x - 129, y - 145, 258, 310, 30);
      const cardArt = this.keep(this.add.graphics());
      cardArt.fillStyle(0xf5f0df, 1).fillRoundedRect(card.x - 129, y - 155, 258, 310, 30);
      cardArt.lineStyle(3, 0xffffff, 0.95).strokeRoundedRect(card.x - 129, y - 155, 258, 310, 30);
      const plate = this.keep(this.add.rectangle(card.x, y, 258, 310, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true }));
      const iconPlate = this.keep(this.add.circle(card.x, y - 58, 71, card.color).setStrokeStyle(5, 0xffffff, 0.68));
      this.drawIcon(card.icon, card.x, y - 58);
      this.keep(this.add.text(card.x, y + 48, card.title, {
        color: "#203448", fontSize: 24, fontStyle: "bold", align: "center",
      }).setOrigin(0.5));
      this.keep(this.add.text(card.x, y + 94, card.sub, {
        color: "#607887", fontSize: 15, align: "center", wordWrap: { width: 230 },
      }).setOrigin(0.5));
      plate.on("pointerover", () => { iconPlate.setScale(1.06); });
      plate.on("pointerout", () => { iconPlate.setScale(1); });
      plate.on("pointerdown", () => {
        playSoundEffect("ui");
        card.action();
      });
    });
    this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, 1190, "가볍게 즐기고, 멋지게 한 판!", {
      color: "#b8d2d9", fontSize: 18, fontStyle: "bold",
    }).setOrigin(0.5));
  }

  private drawIcon(kind: string, x: number, y: number) {
    const g = this.keep(this.add.graphics());
    g.fillStyle(0xffe6a6, 1);
    if (kind === "play") {
      g.fillTriangle(x - 23, y - 34, x - 23, y + 34, x + 34, y);
    } else if (kind === "sound") {
      g.fillPoints([
        new Phaser.Geom.Point(x - 38, y - 16), new Phaser.Geom.Point(x - 18, y - 16),
        new Phaser.Geom.Point(x + 8, y - 37), new Phaser.Geom.Point(x + 8, y + 37),
        new Phaser.Geom.Point(x - 18, y + 16), new Phaser.Geom.Point(x - 38, y + 16),
      ], true);
      g.lineStyle(7, 0xffe6a6, 1).beginPath().arc(x + 7, y, 31, -0.85, 0.85, false).strokePath();
      g.lineStyle(6, 0xffe6a6, 0.8).beginPath().arc(x + 7, y, 48, -0.75, 0.75, false).strokePath();
    } else {
      g.lineStyle(7, 0xffe6a6, 1).beginPath().moveTo(x - 43, y - 28).lineTo(x - 8, y - 38)
        .lineTo(x + 12, y - 24).lineTo(x + 43, y - 34).lineTo(x + 43, y + 29)
        .lineTo(x + 12, y + 39).lineTo(x - 8, y + 25).lineTo(x - 43, y + 35).closePath().strokePath();
      g.lineStyle(5, 0xffe6a6, 0.85).beginPath().moveTo(x - 8, y - 38).lineTo(x - 8, y + 25)
        .moveTo(x + 12, y - 24).lineTo(x + 12, y + 39).strokePath();
    }
  }

  private addHeading(title: string) {
    const panel = this.keep(this.add.graphics());
    panel.fillStyle(0xf5f0df, 1).fillRoundedRect(GAME_WINDOW_WIDTH / 2 - 325, 604, 650, 92, 26);
    panel.lineStyle(2, 0xffffff, 0.8).strokeRoundedRect(GAME_WINDOW_WIDTH / 2 - 325, 604, 650, 92, 26);
    this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, 650, title, {
      color: "#203448", fontSize: 34, fontStyle: "bold",
    }).setOrigin(0.5));
  }

  private addBackButton(y = 1450) {
    this.keep(this.add.graphics()).fillStyle(0x254f64, 1)
      .fillRoundedRect(GAME_WINDOW_WIDTH / 2 - 150, y - 30, 300, 60, 26);
    const back = this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, y, "← 로비로 돌아가기", {
      color: "#f8fbfa", fontSize: 19, fontStyle: "bold",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
    back.on("pointerdown", () => {
      playSoundEffect("ui");
      this.showMenu();
    });
  }

  private showStart() {
    this.clearView();
    this.addHeading("게임을 시작합니다");
    this.drawPlayerCountPicker();
    const saved = hasSavedProgress(this.playerCount);
    if (saved) {
      this.addActionButton(970, "이어하기", `${this.playerCount}인 · 저장된 진행 상황`, () => {
        this.scene.start("Game", { resumeSavedGame: true, initialPlayerCount: this.playerCount });
      });
      this.addActionButton(1130, "새 게임", `${this.playerCount}인 · ${GAME_MAPS[this.selectedMap].name}`, () => {
        this.showNewGameConfirm();
      });
    } else {
      this.addActionButton(1030, "게임 시작", `${this.playerCount}인 · ${GAME_MAPS[this.selectedMap].name}`, () => {
        this.scene.start("Game", { initialMapIndex: this.selectedMap, initialPlayerCount: this.playerCount });
      });
    }
    this.addBackButton();
  }

  private drawPlayerCountPicker() {
    this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, 745, "플레이 인원", {
      color: "#315a69", fontSize: 20, fontStyle: "bold",
    }).setOrigin(0.5));
    for (let count = 2; count <= 4; count += 1) {
      const x = GAME_WINDOW_WIDTH / 2 + (count - 3) * 145;
      const y = 810;
      const selected = count === this.playerCount;
      const art = this.keep(this.add.graphics());
      const draw = (active: boolean) => {
        art.clear();
        art.fillStyle(active ? 0x38a888 : 0xf5f0df, 1).fillRoundedRect(x - 58, y - 30, 116, 60, 20);
        art.lineStyle(3, 0xffffff, 0.95).strokeRoundedRect(x - 58, y - 30, 116, 60, 20);
      };
      draw(selected);
      const button = this.keep(this.add.rectangle(x, y, 116, 60, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true }));
      const label = this.keep(this.add.text(x, y, `${count}인`, {
        color: selected ? "#ffffff" : "#315a69", fontSize: 21, fontStyle: "bold",
      }).setOrigin(0.5));
      button.on("pointerdown", () => {
        playSoundEffect("ui");
        this.playerCount = count;
        this.showStart();
      });
      button.on("pointerover", () => { if (!selected) draw(true); label.setColor("#ffffff"); });
      button.on("pointerout", () => {
        if (!selected) draw(false);
        label.setColor(selected ? "#ffffff" : "#315a69");
      });
    }
  }

  private showNewGameConfirm() {
    this.clearView();
    this.addHeading("새 게임을 시작할까요?");
    this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, 790, "저장된 진행 상황이 삭제됩니다.", {
      color: "#a9543d", fontSize: 22, fontStyle: "bold",
    }).setOrigin(0.5));
    this.addActionButton(930, "확인하고 새 게임", `${this.playerCount}인 · ${GAME_MAPS[this.selectedMap].name} 맵으로 시작`, () => {
      clearSavedProgress();
      this.scene.start("Game", { initialMapIndex: this.selectedMap, initialPlayerCount: this.playerCount });
    });
    this.addActionButton(1100, "취소", "이어하기 선택 화면으로 돌아갑니다", () => this.showStart());
  }

  private addActionButton(y: number, title: string, sub: string, action: () => void) {
    this.keep(this.add.graphics()).fillStyle(0x142737, 0.28)
      .fillRoundedRect(GAME_WINDOW_WIDTH / 2 - 285, y - 61, 570, 138, 25);
    const face = this.keep(this.add.graphics());
    const drawFace = (color: number) => {
      face.clear();
      face.fillStyle(color, 1).fillRoundedRect(GAME_WINDOW_WIDTH / 2 - 285, y - 69, 570, 138, 25);
      face.lineStyle(3, 0xffffff, 0.95).strokeRoundedRect(GAME_WINDOW_WIDTH / 2 - 285, y - 69, 570, 138, 25);
    };
    drawFace(0xf5f0df);
    this.keep(this.add.rectangle(GAME_WINDOW_WIDTH / 2, y, 570, 138, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })).on("pointerdown", () => {
        playSoundEffect("ui");
        action();
      }).on("pointerover", () => drawFace(0xfff8e8)).on("pointerout", () => drawFace(0xf5f0df));
    this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, y - 18, title, {
      color: "#203448", fontSize: 27, fontStyle: "bold",
    }).setOrigin(0.5));
    this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, y + 27, sub, {
      color: "#607887", fontSize: 16,
    }).setOrigin(0.5));
  }

  private showSound() {
    this.clearView();
    this.soundSettings = loadSoundSettings();
    this.addHeading("사운드 설정");
    this.addSoundControl(790, "배경음악", "bgmEnabled", "bgmVolume");
    this.addSoundControl(1060, "효과음", "sfxEnabled", "sfxVolume");
    this.addBackButton();
    this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, 1210, "게임 중에도 오른쪽 설정에서 변경할 수 있습니다", {
      color: "#c6d5d9", fontSize: 17,
    }).setOrigin(0.5));
  }

  private addSoundControl(
    y: number,
    label: string,
    enabledSetting: "bgmEnabled" | "sfxEnabled",
    volumeSetting: "bgmVolume" | "sfxVolume",
  ) {
    const centerX = GAME_WINDOW_WIDTH / 2;
    const row = this.keep(this.add.graphics());
    row.fillStyle(0xf5f0df, 1).fillRoundedRect(centerX - 325, y - 119, 650, 238, 30);
    row.lineStyle(3, 0xffffff, 0.95).strokeRoundedRect(centerX - 325, y - 119, 650, 238, 30);
    const toggle = this.keep(this.add.text(centerX, y - 62, "", {
      color: "#fffaf0", fontSize: 22, fontStyle: "bold", backgroundColor: "#34566a",
    }).setOrigin(0.5).setPadding(16, 9).setInteractive({ useHandCursor: true }));
    const volumeText = this.keep(this.add.text(centerX, y - 8, "", {
      color: "#526c78", fontSize: 17, fontStyle: "bold",
    }).setOrigin(0.5));
    const sliderY = y + 58;
    const sliderWidth = 450;
    const left = centerX - sliderWidth / 2;
    const track = this.keep(this.add.rectangle(centerX, sliderY, sliderWidth, 14, 0xc4d0cb));
    const fill = this.keep(this.add.rectangle(left, sliderY, 0, 14, 0x39a987).setOrigin(0, 0.5));
    const knob = this.keep(this.add.circle(left, sliderY, 17, 0xffcf66).setStrokeStyle(3, 0xffffff));
    const hitArea = this.keep(this.add.rectangle(centerX, sliderY, sliderWidth, 56, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true }));
    const update = () => {
      const enabled = this.soundSettings[enabledSetting];
      const volume = this.soundSettings[volumeSetting];
      toggle.setText(`${label}  ${enabled ? "켜짐 ●" : "꺼짐 ○"}`);
      toggle.setStyle({ backgroundColor: enabled ? "#319878" : "#87959a" });
      volumeText.setText(`음량  ${volume}%`);
      fill.width = sliderWidth * volume / 100;
      knob.setX(left + sliderWidth * volume / 100);
      track.setFillStyle(enabled ? 0x62747a : 0x454d50);
      fill.setFillStyle(enabled ? 0x39a987 : 0x858585);
      knob.setAlpha(enabled ? 1 : 0.55);
    };
    toggle.on("pointerdown", () => {
      this.soundSettings[enabledSetting] = !this.soundSettings[enabledSetting];
      saveSoundSettings(this.soundSettings);
      update();
      if (enabledSetting === "bgmEnabled") updateBackgroundMusic();
      playSoundEffect("ui");
    });
    let dragging = false;
    const setFromPointer = (pointer: Phaser.Input.Pointer) => {
      this.soundSettings[volumeSetting] = Math.round(
        Math.max(0, Math.min(1, (pointer.x - left) / sliderWidth)) * 100,
      );
      saveSoundSettings(this.soundSettings);
      update();
      if (volumeSetting === "bgmVolume") updateBackgroundMusic();
    };
    const onMove = (pointer: Phaser.Input.Pointer) => {
      if (dragging) setFromPointer(pointer);
    };
    const onUp = () => { dragging = false; };
    hitArea.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      dragging = true;
      setFromPointer(pointer);
      playSoundEffect("ui");
    });
    this.input.on("pointermove", onMove);
    this.input.on("pointerup", onUp);
    this.input.on("pointerupoutside", onUp);
    this.viewCleanups.push(() => {
      this.input.off("pointermove", onMove);
      this.input.off("pointerup", onUp);
      this.input.off("pointerupoutside", onUp);
    });
    update();
  }

  private showMap() {
    this.clearView();
    this.addHeading("맵 선택");
    GAME_MAPS.forEach((map, index) => {
      const x = GAME_WINDOW_WIDTH / 2;
      const y = 800 + index * 205;
      const selected = index === this.selectedMap;
      this.keep(this.add.graphics()).fillStyle(0x284b55, 0.16)
        .fillRoundedRect(x - 295, y - 74, 590, 165, 24);
      const cardArt = this.keep(this.add.graphics());
      cardArt.fillStyle(map.backgroundColor, 1).fillRoundedRect(x - 295, y - 82, 590, 165, 24);
      cardArt.lineStyle(selected ? 5 : 3, selected ? 0xffb94f : 0xffffff, 1)
        .strokeRoundedRect(x - 295, y - 82, 590, 165, 24);
      const card = this.keep(this.add.rectangle(x, y, 590, 165, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true }));
      this.keep(this.add.text(x - 215, y - 39, map.name, {
        color: "#26333a", fontSize: 29, fontStyle: "bold",
      }));
      const obstacleDescription = this.obstaclesEnabled ? `방해물 ${map.obstacles.length}개` : "방해물 없이 플레이";
      this.keep(this.add.text(x - 215, y + 7, selected ? `선택됨 ✓ · ${obstacleDescription}` : obstacleDescription, {
        color: "#344b51", fontSize: 18,
      }));
      const preview = this.keep(this.add.graphics());
      preview.fillStyle(map.obstacleColor, 1);
      preview.fillRoundedRect(x + 115, y - 49, 42, 20, 6);
      preview.fillRoundedRect(x + 181, y + 5, 42, 20, 6);
      preview.fillRoundedRect(x + 161, y - 54, 14, 54, 6);
      preview.fillStyle(0x344b67, 1);
      preview.fillCircle(x + 140, y + 41, 12);
      preview.fillCircle(x + 204, y - 31, 12);
      preview.lineStyle(3, 0xfff0c4, 1);
      preview.strokeCircle(x + 140, y + 41, 14);
      preview.strokeCircle(x + 204, y - 31, 14);
      preview.fillStyle(0xffffff, 0.72);
      preview.fillCircle(x + 136, y + 37, 3);
      preview.fillCircle(x + 200, y - 35, 3);
      card.on("pointerdown", () => {
        playSoundEffect("ui");
        this.selectedMap = index;
        saveMapSelection(index);
        this.showMap();
      });
    });
    const optionY = 1390;
    this.keep(this.add.graphics()).fillStyle(0x284b55, 0.16)
      .fillRoundedRect(205, optionY - 42, 590, 90, 24);
    this.keep(this.add.graphics()).fillStyle(0xf5f0df, 1)
      .fillRoundedRect(205, optionY - 50, 590, 90, 24)
      .lineStyle(3, 0xffffff, 1).strokeRoundedRect(205, optionY - 50, 590, 90, 24);
    const obstacleToggle = this.keep(this.add.rectangle(GAME_WINDOW_WIDTH / 2, optionY - 5, 590, 90, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true }));
    this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, optionY - 21, `방해물 ${this.obstaclesEnabled ? "켜짐 ●" : "꺼짐 ○"}`, {
      color: this.obstaclesEnabled ? "#27856f" : "#8d6c62", fontSize: 22, fontStyle: "bold",
    }).setOrigin(0.5));
    this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, optionY + 12, "눌러서 모든 방해물을 켜거나 끕니다", {
      color: "#607887", fontSize: 15,
    }).setOrigin(0.5));
    obstacleToggle.on("pointerdown", () => {
      playSoundEffect("ui");
      this.obstaclesEnabled = !this.obstaclesEnabled;
      saveObstaclesEnabled(this.obstaclesEnabled);
      this.showMap();
    });
    this.addBackButton(1555);
  }
}
