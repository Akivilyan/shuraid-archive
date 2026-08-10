export interface PlayerSnapshot {
  readonly x: number;
  readonly y: number;
  readonly previousX: number;
  readonly previousY: number;
  readonly facingX: number;
  readonly facingY: number;
  readonly moving: boolean;
  readonly walkTime: number;
  readonly health: number;
}

export interface EnemySnapshot {
  readonly slot: number;
  readonly active: boolean;
  readonly x: number;
  readonly y: number;
  readonly previousX: number;
  readonly previousY: number;
  readonly facingX: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly age: number;
  readonly hitFlash: number;
}

export interface AttackSnapshot {
  readonly serial: number;
  readonly x: number;
  readonly y: number;
  readonly facingX: number;
  readonly facingY: number;
  readonly range: number;
  readonly halfAngle: number;
}

export interface BattleSnapshot {
  readonly player: PlayerSnapshot;
  readonly enemies: readonly EnemySnapshot[];
  readonly attack: AttackSnapshot;
  readonly activeEnemyCount: number;
  readonly elapsedSeconds: number;
}

