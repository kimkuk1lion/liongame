export type Hole = {
  id: number;
  x: number;
  y: number;
};

export type MapObstacle = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GameMap = {
  name: string;
  backgroundColor: number;
  obstacleColor: number;
  obstacleHighlight: number;
  holes: Hole[];
  obstacles: MapObstacle[];
};

export const GAME_MAPS: GameMap[] = [
  {
    name: "초원",
    backgroundColor: 0xc8edb5,
    obstacleColor: 0x50885c,
    obstacleHighlight: 0xa5d48a,
    holes: [
      { id: 0, x: 300, y: 950 },
      { id: 1, x: 300, y: 700 },
      { id: 2, x: 300, y: 400 },
      { id: 3, x: 500, y: 400 },
      { id: 4, x: 100, y: 400 },
      { id: 5, x: 300, y: 150 },
    ],
    obstacles: [
      { id: "grass-rock-1", x: 180, y: 820, width: 64, height: 18 },
      { id: "grass-rock-3", x: 205, y: 330, width: 64, height: 18 },
      { id: "grass-rock-4", x: 430, y: 1050, width: 64, height: 18 },
      { id: "grass-rock-5", x: 420, y: 610, width: 64, height: 18 },
      { id: "grass-rock-8", x: 520, y: 170, width: 18, height: 64 },
    ],
  },
  {
    name: "돌기둥",
    backgroundColor: 0xc9e6e7,
    obstacleColor: 0x587c89,
    obstacleHighlight: 0xa5cbd0,
    holes: [
      { id: 0, x: 120, y: 1100 },
      { id: 1, x: 480, y: 900 },
      { id: 2, x: 120, y: 700 },
      { id: 3, x: 480, y: 500 },
      { id: 4, x: 120, y: 300 },
      { id: 5, x: 480, y: 120 },
    ],
    obstacles: [
      { id: "pillar-1", x: 270, y: 980, width: 24, height: 68 },
      { id: "pillar-2", x: 320, y: 630, width: 24, height: 68 },
      { id: "pillar-5", x: 430, y: 760, width: 72, height: 18 },
      { id: "pillar-6", x: 145, y: 440, width: 72, height: 18 },
      { id: "pillar-7", x: 400, y: 180, width: 18, height: 68 },
    ],
  },
  {
    name: "협곡",
    backgroundColor: 0xffdfa8,
    obstacleColor: 0xc16f4c,
    obstacleHighlight: 0xf4b276,
    holes: [
      { id: 0, x: 300, y: 1100 },
      { id: 1, x: 150, y: 870 },
      { id: 2, x: 450, y: 650 },
      { id: 3, x: 150, y: 430 },
      { id: 4, x: 450, y: 230 },
      { id: 5, x: 300, y: 100 },
    ],
    obstacles: [
      { id: "canyon-1", x: 200, y: 1000, width: 70, height: 18 },
      { id: "canyon-3", x: 200, y: 500, width: 70, height: 18 },
      { id: "canyon-5", x: 430, y: 760, width: 70, height: 18 },
      { id: "canyon-8", x: 300, y: 150, width: 18, height: 64 },
      { id: "canyon-9", x: 430, y: 300, width: 18, height: 64 },
    ],
  },
];
