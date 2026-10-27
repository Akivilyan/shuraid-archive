import { game, Game } from 'cc';

export class PlatformLifecycle {
  public constructor(
    private readonly onHideCallback: () => void,
    private readonly onShowCallback: () => void,
  ) {}

  public start(): void {
    game.on(Game.EVENT_HIDE, this.onHideCallback);
    game.on(Game.EVENT_SHOW, this.onShowCallback);
  }

  public stop(): void {
    game.off(Game.EVENT_HIDE, this.onHideCallback);
    game.off(Game.EVENT_SHOW, this.onShowCallback);
  }
}

