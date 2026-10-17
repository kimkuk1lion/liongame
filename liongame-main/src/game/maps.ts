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
    backgroundColor: 0xffffdd,
    obstacleColor: 0x6b8051,
    obstacleHighlight: 0x9aaf75,
    holes: [
      { id: 0, x: 300, y: 950 },
      { id: 1, x: 300, y: 700 },
      { id: 2, x: 300, y: 400 },
      { id: 3, x: 500, y: 400 },
      { id: 4, x: 100, y: 400 },
      { id: 5, x: 300, y: 150 },
    ],
    obstacles: [
      { id: "grass-rock-1", x: 195, y: 830, width: 90, height: 38 },
      { id: "grass-rock-2", x: 405, y: 570, width: 90, height: 38 },
      { id: "grass-rock-3", x: 205, y: 300, width: 100, height: 34 },
    ],
  },
  {
    name: "돌기둥",
    backgroundColor: 0xe8dfc8,
    obstacleColor: 0x716b63,
    obstacleHighlight: 0xa9a092,
    holes: [
      { id: 0, x: 120, y: 1100 },
      { id: 1, x: 480, y: 900 },
      { id: 2, x: 120, y: 700 },
      { id: 3, x: 480, y: 500 },
      { id: 4, x: 120, y: 300 },
      { id: 5, x: 480, y: 120 },
    ],
    obstacles: [
      { id: "pillar-1", x: 270, y: 980, width: 60, height: 150 },
      { id: "pillar-2", x: 270, y: 630, width: 60, height: 150 },
      { id: "pillar-3", x: 270, y: 280, width: 60, height: 150 },
    ],
  },
  {
    name: "협곡",
    backgroundColor: 0xf0dfc4,
    obstacleColor: 0x9b6548,
    obstacleHighlight: 0xc58d65,
    holes: [
      { id: 0, x: 300, y: 1100 },
      { id: 1, x: 150, y: 870 },
      { id: 2, x: 450, y: 650 },
      { id: 3, x: 150, y: 430 },
      { id: 4, x: 450, y: 230 },
      { id: 5, x: 300, y: 100 },
    ],
    obstacles: [
      { id: "canyon-1", x: 210, y: 970, width: 180, height: 34 },
      { id: "canyon-2", x: 210, y: 750, width: 180, height: 34 },
      { id: "canyon-3", x: 210, y: 310, width: 180, height: 34 },
    ],
  },
];
