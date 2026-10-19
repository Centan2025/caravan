import Phaser from 'phaser';
import { ChainDominoScene } from '../games/ChainDominoScene';
import { SwitchRushScene } from '../games/SwitchRushScene';
import { GameScene } from '../game/GameScene';
import { UIManager } from './UIManager';
import { TelemetryLogger } from '../shared/Telemetry';
import { FIXED_SCENARIOS } from '../core/switch/SwitchNetwork';
import { PROGRESSIVE_LEVELS } from '../core/switch/SwitchLevels';
import { sfx } from '../audio/SoundEffects';

export type ActiveGameTab = 'chain' | 'switch' | 'caravan';
export type SwitchSubmode = 'progressive' | 'original';

export class AppController {
  private game: Phaser.Game;
  private activeTab: ActiveGameTab = 'chain';
  private switchSubmode: SwitchSubmode = 'progressive';
  private telemetry = TelemetryLogger.getInstance();
  private caravanUIManager: UIManager;

  // DOM Elements
  private tabChain!: HTMLButtonElement;
  private tabSwitch!: HTMLButtonElement;
  private tabCaravan!: HTMLButtonElement;
  private brandTitle!: HTMLElement;
  private levelSelect!: HTMLSelectElement;
  private caravanControlsWrap!: HTMLElement[];
  private soundBtn!: HTMLButtonElement;
  private telemetryBtn!: HTMLButtonElement;

  // Switch Rush Submode controls
  private switchSubmodeContainer!: HTMLElement;
  private switchSubmodeProgBtn!: HTMLButtonElement;
  private switchSubmodeOrigBtn!: HTMLButtonElement;

  // Telemetry Modal
  private telemetryModal!: HTMLElement;
  private telemetryCloseBtn!: HTMLButtonElement;
  private telemetryDownloadBtn!: HTMLButtonElement;
  private telemetryCopyBtn!: HTMLButtonElement;
  private telemetryContent!: HTMLElement;

  constructor(game: Phaser.Game) {
    this.game = game;
    this.caravanUIManager = new UIManager();
  }

  public init(): void {
    this.bindDOM();
    this.attachEvents();

    // Start with Chain Domino scene active
    this.switchToTab('chain');
  }

  private bindDOM(): void {
    this.tabChain = document.getElementById('nav-btn-chain') as HTMLButtonElement;
    this.tabSwitch = document.getElementById('nav-btn-switch') as HTMLButtonElement;
    this.tabCaravan = document.getElementById('nav-btn-caravan') as HTMLButtonElement;
    this.brandTitle = document.getElementById('brand-title-text') as HTMLElement;
    this.levelSelect = document.getElementById('level-select') as HTMLSelectElement;
    this.soundBtn = document.getElementById('btn-sound') as HTMLButtonElement;
    this.telemetryBtn = document.getElementById('btn-telemetry') as HTMLButtonElement;

    // Switch Rush Submode
    this.switchSubmodeContainer = document.getElementById('switch-submode-container') as HTMLElement;
    this.switchSubmodeProgBtn = document.getElementById('switch-submode-progressive') as HTMLButtonElement;
    this.switchSubmodeOrigBtn = document.getElementById('switch-submode-original') as HTMLButtonElement;

    // Elements that belong exclusively to Caravan
    const caravanMode = document.getElementById('caravan-mode-container') as HTMLElement;
    const progressHud = document.querySelector('.progress-hud') as HTMLElement;
    const statusBanner = document.getElementById('status-banner') as HTMLElement;
    const actionPanel = document.querySelector('.action-panel') as HTMLElement;
    const statsGroup = document.querySelector('.stats-group') as HTMLElement;

    this.caravanControlsWrap = [caravanMode, progressHud, statusBanner, actionPanel, statsGroup].filter(
      Boolean
    );

    // Modal
    this.telemetryModal = document.getElementById('telemetry-modal') as HTMLElement;
    this.telemetryCloseBtn = document.getElementById('btn-telemetry-close') as HTMLButtonElement;
    this.telemetryDownloadBtn = document.getElementById('btn-telemetry-download') as HTMLButtonElement;
    this.telemetryCopyBtn = document.getElementById('btn-telemetry-copy') as HTMLButtonElement;
    this.telemetryContent = document.getElementById('telemetry-content') as HTMLElement;
  }

  private attachEvents(): void {
    if (this.tabChain) {
      this.tabChain.addEventListener('click', () => this.switchToTab('chain'));
    }
    if (this.tabSwitch) {
      this.tabSwitch.addEventListener('click', () => this.switchToTab('switch'));
    }
    if (this.tabCaravan) {
      this.tabCaravan.addEventListener('click', () => this.switchToTab('caravan'));
    }

    if (this.levelSelect) {
      this.levelSelect.addEventListener('change', () => {
        const val = parseInt(this.levelSelect.value, 10);
        this.onLevelSelected(val);
      });
    }

    if (this.soundBtn) {
      this.soundBtn.addEventListener('click', () => {
        const isEnabled = sfx.isEnabled();
        sfx.setEnabled(!isEnabled);
        this.soundBtn.textContent = !isEnabled ? '🔊 Ses Açık' : '🔇 Sessiz';
      });
    }

    if (this.switchSubmodeProgBtn) {
      this.switchSubmodeProgBtn.addEventListener('click', () => {
        this.setSwitchSubmode('progressive');
      });
    }

    if (this.switchSubmodeOrigBtn) {
      this.switchSubmodeOrigBtn.addEventListener('click', () => {
        this.setSwitchSubmode('original');
      });
    }

    if (this.telemetryBtn) {
      this.telemetryBtn.addEventListener('click', () => {
        this.openTelemetryModal();
      });
    }

    if (this.telemetryCloseBtn) {
      this.telemetryCloseBtn.addEventListener('click', () => {
        this.telemetryModal.classList.add('hidden');
      });
    }

    if (this.telemetryDownloadBtn) {
      this.telemetryDownloadBtn.addEventListener('click', () => {
        this.telemetry.downloadJSON();
      });
    }

    if (this.telemetryCopyBtn) {
      this.telemetryCopyBtn.addEventListener('click', () => {
        const json = this.telemetry.exportJSON();
        navigator.clipboard.writeText(json).then(() => {
          const prev = this.telemetryCopyBtn.textContent;
          this.telemetryCopyBtn.textContent = '✅ Kopyalandı!';
          setTimeout(() => {
            this.telemetryCopyBtn.textContent = prev;
          }, 1500);
        });
      });
    }
  }

  public setSwitchSubmode(mode: SwitchSubmode): void {
    this.switchSubmode = mode;
    if (this.switchSubmodeProgBtn) {
      this.switchSubmodeProgBtn.classList.toggle('active', mode === 'progressive');
    }
    if (this.switchSubmodeOrigBtn) {
      this.switchSubmodeOrigBtn.classList.toggle('active', mode === 'original');
    }
    this.populateSwitchLevelsOrScenarios();
    if (this.activeTab === 'switch') {
      const scene = this.game.scene.getScene('SwitchRushScene') as SwitchRushScene;
      if (scene && this.game.scene.isActive('SwitchRushScene')) {
        scene.loadScenario(1, mode);
      }
    }
  }

  public switchToTab(tab: ActiveGameTab): void {
    this.activeTab = tab;

    // Update active tab buttons
    if (this.tabChain) this.tabChain.classList.toggle('active', tab === 'chain');
    if (this.tabSwitch) this.tabSwitch.classList.toggle('active', tab === 'switch');
    if (this.tabCaravan) this.tabCaravan.classList.toggle('active', tab === 'caravan');

    // Show or hide Caravan specific HTML HUD elements
    const isCaravan = tab === 'caravan';
    for (const el of this.caravanControlsWrap) {
      el.style.display = isCaravan ? '' : 'none';
    }

    // Show or hide Switch Rush submode container
    const isSwitch = tab === 'switch';
    if (this.switchSubmodeContainer) {
      this.switchSubmodeContainer.style.display = isSwitch ? 'flex' : 'none';
    }

    // Stop all scenes and launch target scene
    const sceneManager = this.game.scene;

    if (tab === 'chain') {
      if (this.brandTitle) this.brandTitle.innerHTML = '<span>🎯</span> CHAIN DOMINO';
      this.populateChainLevels();
      sceneManager.stop('SwitchRushScene');
      sceneManager.stop('GameScene');
      sceneManager.start('ChainDominoScene', { level: 1 });
    } else if (tab === 'switch') {
      if (this.brandTitle) this.brandTitle.innerHTML = '<span>🔀</span> SWITCH RUSH';
      this.populateSwitchLevelsOrScenarios();
      sceneManager.stop('ChainDominoScene');
      sceneManager.stop('GameScene');
      sceneManager.start('SwitchRushScene', { scenario: 1, mode: this.switchSubmode });
    } else if (tab === 'caravan') {
      if (this.brandTitle) this.brandTitle.innerHTML = '<span>🐪</span> CARAVAN';
      this.populateCaravanLevels();
      sceneManager.stop('ChainDominoScene');
      sceneManager.stop('SwitchRushScene');
      sceneManager.start('GameScene', { levelId: 1, mode: 'B' });
      const caravanScene = sceneManager.getScene('GameScene') as GameScene;
      if (caravanScene) {
        this.caravanUIManager.init(caravanScene);
      }
    }
  }

  private populateChainLevels(): void {
    if (!this.levelSelect) return;
    this.levelSelect.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
      const opt = document.createElement('option');
      opt.value = i.toString();
      opt.textContent = `Seviye ${i} (Chain Domino)`;
      this.levelSelect.appendChild(opt);
    }
    this.levelSelect.value = '1';
  }

  private populateSwitchLevelsOrScenarios(): void {
    if (!this.levelSelect) return;
    this.levelSelect.innerHTML = '';

    if (this.switchSubmode === 'progressive') {
      const districtIcons: Record<string, string> = {
        suburb: '🏡 Suburb',
        downtown: '🏙️ Downtown',
        industrial: '🏭 Industrial',
        harbor: '⚓ Harbor',
        night_express: '🌃 Night Express',
      };

      for (const l of PROGRESSIVE_LEVELS) {
        const opt = document.createElement('option');
        opt.value = l.id.toString();
        const distLabel = l.district ? districtIcons[l.district] || l.district : '2.0';
        opt.textContent = `[${distLabel}] ${l.title} (${l.manifest.length} tren)`;
        this.levelSelect.appendChild(opt);
      }
    } else {
      for (const sc of FIXED_SCENARIOS) {
        const opt = document.createElement('option');
        opt.value = sc.id.toString();
        const preview = sc.manifest.slice(0, 4).join('');
        opt.textContent = `⚡ [Classic] Senaryo ${sc.id} [${preview}.. (${sc.manifest.length} tren)]`;
        this.levelSelect.appendChild(opt);
      }
    }
    this.levelSelect.value = '1';
  }

  private populateCaravanLevels(): void {
    if (!this.levelSelect) return;
    this.levelSelect.innerHTML = `
      <option value="1">Seviye 1: Vaha Yolu (Düz)</option>
      <option value="2">Seviye 2: Altın Kıvrım (Dirsek)</option>
      <option value="3">Seviye 3: Vaha Çatalı (T-Kavşak)</option>
      <option value="4">Seviye 4: Dörtyol Hanı (4-Yönlü)</option>
      <option value="5">Seviye 5: Köşe Kervansarayı</option>
      <option value="6">Seviye 6: Çıkmaz Labirenti</option>
      <option value="7">Seviye 7: Saat Yönü Önceliği</option>
      <option value="8">Seviye 8: İpek Koridoru</option>
      <option value="9">Seviye 9: Çifte Kavşak Tuzağı</option>
      <option value="10">Seviye 10: Büyük İpek Yolu</option>
    `;
    this.levelSelect.value = '1';
  }

  private onLevelSelected(val: number): void {
    if (isNaN(val)) return;

    if (this.activeTab === 'chain') {
      const scene = this.game.scene.getScene('ChainDominoScene') as ChainDominoScene;
      if (scene && this.game.scene.isActive('ChainDominoScene')) {
        scene.loadLevel(val);
      } else {
        this.game.scene.stop('SwitchRushScene');
        this.game.scene.stop('GameScene');
        this.game.scene.start('ChainDominoScene', { level: val });
      }
    } else if (this.activeTab === 'switch') {
      const scene = this.game.scene.getScene('SwitchRushScene') as SwitchRushScene;
      if (scene && this.game.scene.isActive('SwitchRushScene')) {
        scene.loadScenario(val, this.switchSubmode);
      } else {
        this.game.scene.stop('ChainDominoScene');
        this.game.scene.stop('GameScene');
        this.game.scene.start('SwitchRushScene', { scenario: val, mode: this.switchSubmode });
      }
    } else if (this.activeTab === 'caravan') {
      const scene = this.game.scene.getScene('GameScene') as GameScene;
      if (scene && this.game.scene.isActive('GameScene')) {
        this.caravanUIManager.onLevelSelected(val);
      } else {
        this.game.scene.stop('ChainDominoScene');
        this.game.scene.stop('SwitchRushScene');
        this.game.scene.start('GameScene', { levelId: val, mode: 'B' });
      }
    }
  }

  private openTelemetryModal(): void {
    const events = this.telemetry.getEvents();
    const firstTapEv = events.find((e) => e.event_type === 'first_tap');
    const validMoves = events.filter((e) => e.event_type === 'valid_move').length;
    const invalidTaps = events.filter((e) => e.event_type === 'invalid_tap').length;
    const voluntaryReplays = events.filter((e) => e.event_type === 'replay_clicked').length;
    const wins = events.filter((e) => e.event_type === 'run_won').length;
    const losses = events.filter((e) => e.event_type === 'run_lost').length;
    const activePlaySec = (this.telemetry.getActivePlayMs() / 1000).toFixed(1);

    const firstTapStr = firstTapEv
      ? `${(firstTapEv.elapsed_run_ms / 1000).toFixed(2)} sn`
      : 'Bekleniyor';

    const recentEvents = events.slice(-8).reverse();

    const recentHtml = recentEvents
      .map(
        (ev) =>
          `<div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #332215; font-size:11px;">
            <span style="color:#f39c12;">${ev.event_type}</span>
            <span style="color:#778da9;">${ev.game_id} #${ev.scenario_id}</span>
            <span style="color:#bfa895;">${(ev.elapsed_run_ms / 1000).toFixed(1)}s</span>
          </div>`
      )
      .join('');

    const html = `
      <div class="telemetry-grid">
        <div class="telemetry-card">
          <span class="card-label">Oturum Kimliği (Anonim)</span>
          <span class="card-val" style="font-size: 11px; word-break: break-all;">${this.telemetry.sessionId}</span>
        </div>
        <div class="telemetry-card">
          <span class="card-label">Aktif Oyun Süresi (Odaklı)</span>
          <span class="card-val">${activePlaySec} sn</span>
        </div>
        <div class="telemetry-card">
          <span class="card-label">İlk Dokunuş Süresi</span>
          <span class="card-val" style="color:#48cae4;">${firstTapStr}</span>
        </div>
        <div class="telemetry-card">
          <span class="card-label">İsteğe Bağlı Tekrar Oynama</span>
          <span class="card-val" style="color:#52b788;">${voluntaryReplays} kez</span>
        </div>
        <div class="telemetry-card">
          <span class="card-label">Geçerli / Geçersiz Dokunuş</span>
          <span class="card-val">${validMoves} / ${invalidTaps}</span>
        </div>
        <div class="telemetry-card">
          <span class="card-label">Kazanma / Kaybetme</span>
          <span class="card-val" style="color:#f39c12;">${wins} / ${losses}</span>
        </div>
      </div>

      <h4 style="margin: 12px 0 6px 0; color: #f39c12; font-size: 13px;">Son Olay Akışı (${events.length} toplam):</h4>
      <div class="reasons-list" style="max-height: 140px; overflow-y: auto;">
        ${recentHtml || '<div style="color:#888;">Henüz kayıtlı olay yok.</div>'}
      </div>
    `;

    const caravanHtml = this.caravanUIManager.getCaravanSummaryHtml();

    this.telemetryContent.innerHTML = html + caravanHtml;
    this.telemetryModal.classList.remove('hidden');
  }
}
