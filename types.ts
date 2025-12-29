
export interface Point {
  x: number;
  y: number;
}

export interface Laser {
  id: string;
  start: Point;
  target: Point;
  currentX: number;
  currentY: number;
  angle: number;
  speed: number;
  active: boolean;
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  radius: number;
  speed: number;
  health: number;
  type: 'dog' | 'yarn';
}

export interface Boss {
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  active: boolean;
  velocity: number;
  lastFireTime: number;
}

export interface BossProjectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
  isPlayer?: boolean;
}

export interface GameState {
  score: number;
  health: number;
  gameOver: boolean;
  gameStarted: boolean;
  missionText: string;
  isBossPhase: boolean;
}
