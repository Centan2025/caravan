import { GameMode } from '../types';
import { GameScene } from '../game/GameScene';
import { TelemetryService } from '../core/Telemetry';

export class UIManager {
  private scene!: GameScene;
  private telemetry = TelemetryService.getInstance();
  private currentMode: GameMode = 'B';
  private currentLevelId: number = 1;

  // DOM Elements
  private modeBtnB!: HTMLButtonElement;
  private modeBtnC!: HTMLButtonElement;
  private movesDisplay!: HTMLElement;
  private timeDisplay!: HTMLElement;
  private innBadge!: HTMLElement;
  private statusBanner!: HTMLElement;
  private primaryActionBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private editBtn!: HTMLButtonElement;
  private hintBtn!: HTMLButtonElement;
  private seedInput!: HTMLInputElement;
  private seedBtn!: HTMLButtonElement;
  private voteBtnB!: HTMLButtonElement;
  private voteBtnC!: HTMLButtonElement;

  private isInitialized = false;

  public init(scene: GameScene) {
    this.scene = scene;
    this.setupSceneCallbacks();
    if (!this.isInitialized) {
      this.bindDOMElements();
      this.attachEventListeners();
      this.isInitialized = true;
    }
  }

  public onLevelSelected(lvl: number) {
    this.currentLevelId = lvl;
    if (this.scene) {
      this.scene.setLevel(lvl);
    }
  }

  private bindDOMElements() {
    this.modeBtnB = document.getElementById('mode-btn-b') as HTMLButtonElement;
    this.modeBtnC = document.getElementById('mode-btn-c') as HTMLButtonElement;
    this.movesDisplay = document.getElementById('stat-moves') as HTMLElement;
    this.timeDisplay = document.getElementById('stat-time') as HTMLElement;
    this.innBadge = document.getElementById('inn-badge') as HTMLElement;
    this.statusBanner = document.getElementById('status-banner') as HTMLElement;
    this.primaryActionBtn = document.getElementById('btn-primary-action') as HTMLButtonElement;
    this.resetBtn = document.getElementById('btn-reset') as HTMLButtonElement;
    this.editBtn = document.getElementById('btn-edit') as HTMLButtonElement;
    this.hintBtn = document.getElementById('btn-hint') as HTMLButtonElement;
    this.seedInput = document.getElementById('seed-input') as HTMLInputElement;
    this.seedBtn = document.getElementById('btn-load-seed') as HTMLButtonElement;
    this.voteBtnB = document.getElementById('btn-vote-b') as HTMLButtonElement;
    this.voteBtnC = document.getElementById('btn-vote-c') as HTMLButtonElement;
  }

  private attachEventListeners() {
    this.modeBtnB.addEventListener('click', () => {
      this.currentMode = 'B';
      this.updateModeUI();
      this.scene.setMode('B');
    });

    this.modeBtnC.addEventListener('click', () => {
      this.currentMode = 'C';
      this.updateModeUI();
      this.scene.setMode('C');
    });

    // Note: levelSelect change is handled centrally by AppController to prevent cross-game interference

    this.primaryActionBtn.addEventListener('click', () => {
      if (this.scene.isLevelFailed() || this.scene.isLevelCompleted()) {
        this.scene.resetLevel(false);
      } else if (this.currentMode === 'B') {
        this.scene.launchTradeChain();
      } else {
        if (this.scene.isCountdownActive()) {
          this.scene.startModeCRushNow();
        } else {
          this.scene.toggleModeCPause();
        }
      }
    });

    this.resetBtn.addEventListener('click', () => {
      this.scene.resetLevel(false);
    });

    this.editBtn.addEventListener('click', () => {
      this.scene.resetLevel(true);
    });

    this.hintBtn.addEventListener('click', () => {
      this.scene.applySolutionHint();
    });

    this.seedBtn.addEventListener('click', () => {
      const val = parseInt(this.seedInput.value, 10);
      if (!isNaN(val)) {
        this.scene.setLevel(99, val);
      } else {
        const rand = Math.floor(Math.random() * 90000) + 10000;
        this.seedInput.value = rand.toString();
        this.scene.setLevel(99, rand);
      }
    });

    if (this.voteBtnB) {
      this.voteBtnB.addEventListener('click', () => {
        this.telemetry.logEvent('PREFERENCE_VOTE', 'B', this.currentLevelId, {
          votedFor: 'B',
          label: 'Trade Chain (Planlama)',
        });
        this.voteBtnB.style.border = '2px solid #2ecc71';
        this.voteBtnB.textContent = '✅ Mod B Tercih Edildi!';
      });
    }

    if (this.voteBtnC) {
      this.voteBtnC.addEventListener('click', () => {
        this.telemetry.logEvent('PREFERENCE_VOTE', 'C', this.currentLevelId, {
          votedFor: 'C',
          label: 'Caravan Rush (Gerçek Zamanlı)',
        });
        this.voteBtnC.style.border = '2px solid #2ecc71';
        this.voteBtnC.textContent = '✅ Mod C Tercih Edildi!';
      });
    }
  }

  private setupSceneCallbacks() {
    this.scene.callbacks = {
      onMoveChange: (moves) => {
        this.movesDisplay.textContent = moves.toString();
      },
      onTimeChange: (timeMs) => {
        const secs = (timeMs / 1000).toFixed(1);
        this.timeDisplay.textContent = `${secs}s`;
      },
      onInnStatusChange: (visited) => {
        if (visited) {
          this.innBadge.classList.add('badge-completed');
          this.innBadge.innerHTML = '🏨 Han: Ziyaret Edildi ✓';
        } else {
          this.innBadge.classList.remove('badge-completed');
          this.innBadge.innerHTML = '🏨 Han: Bekliyor...';
        }
      },
      onGameStatusChange: (status, message) => {
        this.statusBanner.className = `status-banner status-${status.toLowerCase()}`;
        this.statusBanner.textContent = message || '';

        if (status === 'RUNNING') {
          if (this.currentMode === 'B') {
            this.primaryActionBtn.disabled = true;
            this.primaryActionBtn.textContent = '⏳ Kervan İlerliyor...';
          } else {
            this.primaryActionBtn.textContent = '⏸ Duraklat';
          }
        } else if (status === 'PLANNING') {
          this.primaryActionBtn.disabled = false;
          if (this.currentMode === 'B') {
            this.primaryActionBtn.textContent = '🚀 Kervanı Başlat';
          } else {
            if (this.scene.isCountdownActive()) {
              this.primaryActionBtn.textContent = '🚀 Hemen Başlat';
            } else if (this.scene.isModePaused()) {
              this.primaryActionBtn.textContent = '▶ Devam Et';
            } else {
              this.primaryActionBtn.textContent = '🚀 Kervanı Başlat';
            }
          }
        } else if (status === 'SUCCESS') {
          this.primaryActionBtn.disabled = false;
          this.primaryActionBtn.textContent = '🎉 Zafer! Tekrarla';
        } else if (status === 'FAILED') {
          this.primaryActionBtn.disabled = false;
          this.primaryActionBtn.textContent = '🔄 Yeniden Başlat';
        }
      },
      onModeChange: (mode) => {
        this.currentMode = mode;
        this.updateModeUI();
      },
    };
  }

  private updateModeUI() {
    this.editBtn.style.display = 'inline-block';
    if (this.currentMode === 'B') {
      this.modeBtnB.classList.add('active');
      this.modeBtnC.classList.remove('active');
      this.primaryActionBtn.textContent = '🚀 Kervanı Başlat';
      this.primaryActionBtn.disabled = false;
    } else {
      this.modeBtnB.classList.remove('active');
      this.modeBtnC.classList.add('active');
      if (this.scene.isLevelFailed()) {
        this.primaryActionBtn.textContent = '🔄 Yeniden Başlat';
      } else if (this.scene.isCountdownActive()) {
        this.primaryActionBtn.textContent = '🚀 Hemen Başlat';
      } else if (this.scene.isModePaused()) {
        this.primaryActionBtn.textContent = '▶ Devam Et';
      } else {
        this.primaryActionBtn.textContent = '⏸ Duraklat';
      }
      this.primaryActionBtn.disabled = false;
    }
  }

  public getCaravanSummaryHtml(): string {
    const summary = this.telemetry.generateSummary();
    return `
      <div class="telemetry-grid">
        <div class="telemetry-card">
          <span class="card-label">Caravan Oturum Kimliği</span>
          <span class="card-val" style="font-size: 13px;">${summary.sessionId}</span>
        </div>
        <div class="telemetry-card">
          <span class="card-label">İlk Etkileşim Süresi</span>
          <span class="card-val">${summary.timeToFirstInteractionMs ? (summary.timeToFirstInteractionMs / 1000).toFixed(2) + ' sn' : 'Henüz yok'}</span>
        </div>
        <div class="telemetry-card">
          <span class="card-label">Mod B (Trade Chain) Başarı</span>
          <span class="card-val">${summary.modeB.completes} / ${summary.modeB.starts} (${summary.modeB.completionRate.toFixed(1)}%)</span>
        </div>
        <div class="telemetry-card">
          <span class="card-label">Mod C (Rush) Başarı</span>
          <span class="card-val">${summary.modeC.completes} / ${summary.modeC.starts} (${summary.modeC.completionRate.toFixed(1)}%)</span>
        </div>
      </div>

      <h4 style="margin: 12px 0 6px 0; color: #d68910;">Caravan Hata Nedenleri:</h4>
      <div class="reasons-list">
        <div><strong>Çıkmaz Sokak:</strong> ${summary.failureReasons.DEAD_END}</div>
        <div><strong>Bağlantısız Yol:</strong> ${summary.failureReasons.DISCONNECTED}</div>
        <div><strong>Yanlış Durak Sırası:</strong> ${summary.failureReasons.WRONG_STOP_ORDER}</div>
        <div><strong>Kapalı Döngü:</strong> ${summary.failureReasons.CLOSED_LOOP}</div>
        <div><strong>Sınır Dışı:</strong> ${summary.failureReasons.OUT_OF_BOUNDS}</div>
      </div>

      <div style="margin-top: 10px; font-size: 13px; color: #888;">
        Caravan Olayları: <strong>${summary.totalEvents}</strong> | Tekrar: <strong>${summary.totalRetries}</strong>
      </div>
    `;
  }
}
