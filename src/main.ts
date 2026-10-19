import Phaser from 'phaser';
import { ChainDominoScene } from './games/ChainDominoScene';
import { SwitchRushScene } from './games/SwitchRushScene';
import { GameScene } from './game/GameScene';
import { AppController } from './ui/AppController';

window.addEventListener('DOMContentLoaded', () => {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 540,
    height: 960,
    parent: 'game-container',
    backgroundColor: '#1c1510',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [ChainDominoScene, SwitchRushScene, GameScene],
  };

  const game = new Phaser.Game(config);

  game.events.once('ready', () => {
    const controller = new AppController(game);
    controller.init();
  });
});
