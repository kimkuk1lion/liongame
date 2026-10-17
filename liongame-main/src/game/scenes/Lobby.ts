import { Scene } from "phaser";
import { GAME_WINDOW_HEIGHT, GAME_WINDOW_WIDTH } from "../../constants";
import { clearSavedProgress, hasSavedProgress } from "../../system";
import { GAME_MAPS } from "../maps";
import {
  loadMapSelection,
  loadSoundSettings,
  saveMapSelection,
  saveSoundSettings,
} from "../settings";

export class Lobby extends Scene {
  private viewObjects: Phaser.GameObjects.GameObject[] = [];
  private viewCleanups: Array<() => void> = [];
  private selectedMap = 0;
  private soundSettings = loadSoundSettings();

  constructor() {
    super("Lobby");
  }

  preload() {
    this.load.setPath("assets");
    this.load.image("lobby_bg", "bg.png");
    this.load.image("lobby_logo", "logo.png");
  }

  create() {
    this.selectedMap = loadMapSelection(GAME_MAPS.length);
    this.soundSettings = loadSoundSettings();
    this.add.image(GAME_WINDOW_WIDTH / 2, GAME_WINDOW_HEIGHT / 2, "lobby_bg")
      .setDisplaySize(GAME_WINDOW_WIDTH, GAME_WINDOW_HEIGHT).setAlpha(0.52);
    this.add.rectangle(0, 0, GAME_WINDOW_WIDTH, GAME_WINDOW_HEIGHT, 0x101a22, 0.48).setOrigin(0);
    this.add.image(GAME_WINDOW_WIDTH / 2, 270, "lobby_logo").setDisplaySize(290, 290);
    this.add.text(GAME_WINDOW_WIDTH / 2, 470, "사자 구슬 게임", {
      color: "#fff4d2", fontSize: 54, fontStyle: "bold", stroke: "#34261b", strokeThickness: 6,
    }).setOrigin(0.5);
    this.add.text(GAME_WINDOW_WIDTH / 2, 535, "원하는 항목을 선택해 주세요", {
      color: "#d9e5e7", fontSize: 22,
    }).setOrigin(0.5);
    this.showMenu();
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
      { x: 185, title: "게임 시작", sub: "이어하기 / 새 게임", action: () => this.showStart(), icon: "play" },
      { x: 500, title: "사운드 설정", sub: "배경음악 / 효과음", action: () => this.showSound(), icon: "sound" },
      { x: 815, title: "맵 설정", sub: `현재 맵 · ${GAME_MAPS[this.selectedMap].name}`, action: () => this.showMap(), icon: "map" },
    ];
    cards.forEach((card) => {
      const y = 890;
      const plate = this.keep(this.add.rectangle(card.x, y, 270, 300, 0x21384a, 0.94)
        .setStrokeStyle(3, 0xd8b66b).setInteractive({ useHandCursor: true }));
      this.keep(this.add.circle(card.x, y - 55, 73, 0x35596d).setStrokeStyle(2, 0x8bb2bd));
      this.drawIcon(card.icon, card.x, y - 55);
      this.keep(this.add.text(card.x, y + 45, card.title, {
        color: "#fff2ce", fontSize: 26, fontStyle: "bold", align: "center",
      }).setOrigin(0.5));
      this.keep(this.add.text(card.x, y + 92, card.sub, {
        color: "#c6d5d9", fontSize: 15, align: "center", wordWrap: { width: 235 },
      }).setOrigin(0.5));
      plate.on("pointerdown", card.action);
    });
    this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, 1190, "아이콘을 눌러 설정을 열어 주세요", {
      color: "#c6d5d9", fontSize: 19,
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
    this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, 650, title, {
      color: "#fff2ce", fontSize: 38, fontStyle: "bold",
    }).setOrigin(0.5));
  }

  private addBackButton() {
    const back = this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, 1450, "← 로비로 돌아가기", {
      color: "#fff", fontSize: 22, backgroundColor: "#344c5a",
    }).setOrigin(0.5).setPadding(20, 12).setInteractive({ useHandCursor: true }));
    back.on("pointerdown", () => this.showMenu());
  }

  private showStart() {
    this.clearView();
    this.addHeading("게임을 시작합니다");
    const saved = hasSavedProgress(4);
    if (saved) {
      this.addActionButton(850, "이어하기", "저장된 진행 상황을 불러옵니다", () => {
        this.scene.start("Game", { resumeSavedGame: true });
      });
      this.addActionButton(1030, "새 게임", `새 게임 · ${GAME_MAPS[this.selectedMap].name}`, () => {
        this.showNewGameConfirm();
      });
    } else {
      this.addActionButton(900, "게임 시작", `맵 · ${GAME_MAPS[this.selectedMap].name}`, () => {
        this.scene.start("Game", { initialMapIndex: this.selectedMap });
      });
    }
    this.addBackButton();
  }

  private showNewGameConfirm() {
    this.clearView();
    this.addHeading("새 게임을 시작할까요?");
    this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, 790, "저장된 진행 상황이 삭제됩니다.", {
      color: "#ffe2b4", fontSize: 22,
    }).setOrigin(0.5));
    this.addActionButton(930, "확인하고 새 게임", `${GAME_MAPS[this.selectedMap].name} 맵으로 시작`, () => {
      clearSavedProgress();
      this.scene.start("Game", { initialMapIndex: this.selectedMap });
    });
    this.addActionButton(1100, "취소", "이어하기 선택 화면으로 돌아갑니다", () => this.showStart());
  }

  private addActionButton(y: number, title: string, sub: string, action: () => void) {
    const button = this.keep(this.add.rectangle(GAME_WINDOW_WIDTH / 2, y, 570, 132, 0x294b5b, 0.96)
      .setStrokeStyle(2, 0xd8b66b).setInteractive({ useHandCursor: true }));
    this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, y - 18, title, {
      color: "#fff2ce", fontSize: 29, fontStyle: "bold",
    }).setOrigin(0.5));
    this.keep(this.add.text(GAME_WINDOW_WIDTH / 2, y + 27, sub, {
      color: "#d1e0e2", fontSize: 17,
    }).setOrigin(0.5));
    button.on("pointerdown", action);
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
    const row = this.keep(this.add.rectangle(centerX, y, 590, 230, 0x294b5b, 0.96)
      .setStrokeStyle(2, 0x8bb2bd));
    const toggle = this.keep(this.add.text(centerX, y - 62, "", {
      color: "#fff2ce", fontSize: 26, fontStyle: "bold", backgroundColor: "#35596d",
    }).setOrigin(0.5).setPadding(16, 9).setInteractive({ useHandCursor: true }));
    const volumeText = this.keep(this.add.text(centerX, y - 8, "", {
      color: "#d1e0e2", fontSize: 18,
    }).setOrigin(0.5));
    const sliderY = y + 58;
    const sliderWidth = 450;
    const left = centerX - sliderWidth / 2;
    const track = this.keep(this.add.rectangle(centerX, sliderY, sliderWidth, 14, 0x62747a));
    const fill = this.keep(this.add.rectangle(left, sliderY, 0, 14, 0xffd66f).setOrigin(0, 0.5));
    const knob = this.keep(this.add.circle(left, sliderY, 17, 0xfff2ce).setStrokeStyle(3, 0x725d35));
    const hitArea = this.keep(this.add.rectangle(centerX, sliderY, sliderWidth, 56, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true }));
    const update = () => {
      const enabled = this.soundSettings[enabledSetting];
      const volume = this.soundSettings[volumeSetting];
      toggle.setText(`${label}  ${enabled ? "켜짐 ●" : "꺼짐 ○"}`);
      toggle.setStyle({ backgroundColor: enabled ? "#276447" : "#4b515b" });
      volumeText.setText(`음량  ${volume}%`);
      fill.width = sliderWidth * volume / 100;
      knob.setX(left + sliderWidth * volume / 100);
      track.setFillStyle(enabled ? 0x62747a : 0x454d50);
      fill.setFillStyle(enabled ? 0xffd66f : 0x858585);
      knob.setAlpha(enabled ? 1 : 0.55);
    };
    toggle.on("pointerdown", () => {
      this.soundSettings[enabledSetting] = !this.soundSettings[enabledSetting];
      saveSoundSettings(this.soundSettings);
      update();
    });
    let dragging = false;
    const setFromPointer = (pointer: Phaser.Input.Pointer) => {
      this.soundSettings[volumeSetting] = Math.round(
        Math.max(0, Math.min(1, (pointer.x - left) / sliderWidth)) * 100,
      );
      saveSoundSettings(this.soundSettings);
      update();
    };
    const onMove = (pointer: Phaser.Input.Pointer) => {
      if (dragging) setFromPointer(pointer);
    };
    const onUp = () => { dragging = false; };
    hitArea.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      dragging = true;
      setFromPointer(pointer);
    });
    this.input.on("pointermove", onMove);
    this.input.on("pointerup", onUp);
    this.input.on("pointerupoutside", onUp);
    this.viewCleanups.push(() => {
      this.input.off("pointermove", onMove);
      this.input.off("pointerup", onUp);
      this.input.off("pointerupoutside", onUp);
    });
    row.setDepth(-1);
    update();
  }

  private showMap() {
    this.clearView();
    this.addHeading("맵 선택");
    GAME_MAPS.forEach((map, index) => {
      const x = GAME_WINDOW_WIDTH / 2;
      const y = 800 + index * 205;
      const selected = index === this.selectedMap;
      const card = this.keep(this.add.rectangle(x, y, 590, 165, map.backgroundColor, 1)
        .setStrokeStyle(selected ? 5 : 2, selected ? 0xffdc80 : 0xc3d4d3)
        .setInteractive({ useHandCursor: true }));
      this.keep(this.add.text(x - 215, y - 39, map.name, {
        color: "#26333a", fontSize: 29, fontStyle: "bold",
      }));
      this.keep(this.add.text(x - 215, y + 7, selected ? "선택됨 ✓" : "눌러서 선택", {
        color: "#344b51", fontSize: 18,
      }));
      const preview = this.keep(this.add.graphics());
      preview.fillStyle(map.obstacleColor, 1);
      preview.fillRoundedRect(x + 115, y - 49, 42, 20, 6);
      preview.fillRoundedRect(x + 181, y + 5, 42, 20, 6);
      preview.fillStyle(0x24282b, 1);
      preview.fillCircle(x + 140, y + 41, 11);
      preview.fillCircle(x + 204, y - 31, 11);
      card.on("pointerdown", () => {
        this.selectedMap = index;
        saveMapSelection(index);
        this.showMap();
      });
    });
    this.addBackButton();
  }
}
