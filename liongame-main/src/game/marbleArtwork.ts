import { ANIMAL_MARBLE_OPTIONS, type MarbleAppearance } from "./settings";

const ANIMAL_COLORS: Record<string, { light: string; base: string; shadow: string }> = {
  lion: { light: "#fff1b8", base: "#f3aa43", shadow: "#a85b32" },
  cat: { light: "#ffe0ad", base: "#e98d59", shadow: "#9f4b45" },
  dog: { light: "#f8ddb4", base: "#bf9467", shadow: "#725143" },
  rabbit: { light: "#fff0f4", base: "#f1b8c7", shadow: "#a95778" },
  fox: { light: "#ffe2a8", base: "#ea744b", shadow: "#9e3c35" },
  panda: { light: "#ffffff", base: "#c5e8e2", shadow: "#6d9794" },
  bear: { light: "#f4ddba", base: "#b77b54", shadow: "#704632" },
};

export function createMarbleArtwork(
  appearance: MarbleAppearance,
  isLion = false,
  customImage?: CanvasImageSource,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.clearRect(0, 0, 96, 96);

  const animal = appearance.kind === "animal"
    ? appearance.animal
    : "lion";
  const colors = ANIMAL_COLORS[animal] ?? ANIMAL_COLORS.lion;
  const gradient = context.createRadialGradient(31, 25, 3, 48, 50, 48);
  gradient.addColorStop(0, colors.light);
  gradient.addColorStop(0.28, colors.base);
  gradient.addColorStop(1, colors.shadow);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(48, 48, 45, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.beginPath();
  context.arc(48, 48, 39, 0, Math.PI * 2);
  context.clip();
  if (appearance.kind === "custom" && customImage) {
    const source = customImage as HTMLImageElement;
    const sourceWidth = source.naturalWidth || (customImage as HTMLCanvasElement).width || 1;
    const sourceHeight = source.naturalHeight || (customImage as HTMLCanvasElement).height || 1;
    const squareSize = Math.min(sourceWidth, sourceHeight);
    const sourceX = (sourceWidth - squareSize) / 2;
    const sourceY = (sourceHeight - squareSize) / 2;
    context.drawImage(customImage, sourceX, sourceY, squareSize, squareSize, 9, 9, 78, 78);
    context.fillStyle = "rgba(20,34,48,0.08)";
    context.fillRect(8, 8, 80, 80);
  } else {
    const selected = ANIMAL_MARBLE_OPTIONS.find(({ id }) => id === animal) ?? ANIMAL_MARBLE_OPTIONS[0];
    context.font = "62px 'Segoe UI Emoji','Apple Color Emoji',sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = "rgba(42,43,53,0.24)";
    context.shadowBlur = 3;
    context.shadowOffsetY = 2;
    context.fillText(selected.emoji, 48, 51, 74);
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
  }
  const shade = context.createLinearGradient(0, 50, 0, 91);
  shade.addColorStop(0, "rgba(20,37,49,0)");
  shade.addColorStop(1, "rgba(20,37,49,0.22)");
  context.fillStyle = shade;
  context.fillRect(8, 8, 80, 80);
  context.restore();

  context.fillStyle = "rgba(255,255,255,0.38)";
  context.beginPath();
  context.ellipse(32, 22, 14, 6, -0.55, 0, Math.PI * 2);
  context.fill();
  context.lineWidth = isLion ? 6 : 2;
  context.strokeStyle = isLion ? "#ef655f" : "rgba(255,255,255,0.76)";
  context.beginPath();
  context.arc(48, 48, isLion ? 43 : 44, 0, Math.PI * 2);
  context.stroke();

  if (isLion) {
    context.fillStyle = "#ffe09a";
    context.strokeStyle = "#b64b49";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(63, 12);
    context.lineTo(67, 3);
    context.lineTo(72, 9);
    context.lineTo(78, 2);
    context.lineTo(82, 13);
    context.closePath();
    context.fill();
    context.stroke();
  }
  return canvas;
}

export function marbleAppearanceTextureId(appearance: MarbleAppearance) {
  if (appearance.kind === "animal") return `animal-${appearance.animal}`;
  let hash = 2166136261;
  for (let index = 0; index < appearance.dataUrl.length; index += 1) {
    hash = Math.imul(hash ^ appearance.dataUrl.charCodeAt(index), 16777619);
  }
  return `custom-${(hash >>> 0).toString(36)}`;
}

export function marbleTextureKey(playerIndex: number, appearance: MarbleAppearance, isLion: boolean) {
  return `player-marble-${playerIndex}-${marbleAppearanceTextureId(appearance)}-${isLion ? "lion" : "normal"}`;
}
