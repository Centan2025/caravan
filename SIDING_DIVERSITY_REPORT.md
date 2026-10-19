# SWITCH RUSH — SIDING DIVERSITY CORRECTION & EMPIRICAL AUDIT REPORT

**Tarih:** 19 Ekim 2026  
**Kapsam:** Siding Modu Seviye 101–105, Dual-Siding (104), FIFO-Siding (103-B), Matematiksel Doğrulama ve Karşı-Olgusal (Counterfactual) Çözüm İzi Raporu  
**Proje Durumu:** `main` dalı, 8 test dosyası, 59 test %100 başarılı (`vitest`), sıfır derleme hatası (`tsc && vite build`).

---

## 1. FAZ 1 — Kanıt Doğrulama (Isomorphism, Traces & Slack Time)

### 1.1. Çizge İzomorfizmi Kanıtı (Baseline 101–105)
Baseline 101–105 ağlarının düğüm ($V$) ve yönlü kenar ($E$) kümeleri yapısal olarak incelenmiştir:

$$\forall i, j \in \{101, 102, 103, 104_{\text{legacy}}, 105\}: \quad G_i \cong G_j$$

- **Düğüm Sayısı:** $|V| = 7$ (`SOURCE`, `SW_SIDING`, `SIDING_BAY`, `MERGE`, `SW_STATION`, `RED`, `BLUE`).
- **Kenar Sayısı:** $|E| = 7$.
- **Makas Sayısı:** 2 adet 2-yollu makas (`SW_SIDING` [MAIN/SIDING], `SW_STATION` [RED/BLUE]).
- **Sonuç:** Koordinat ötelemeleri ve eğrisel render haricinde bu 5 seviyenin tamamı **yapısal olarak özdeş bir akış grafı** paylaşır.

### 1.2. Seviye 102 vs. 104 Karşılaştırması
- **Seviye 102 Manifestosu:** `['B', 'R']` (2 araç).
  - *Karar:* Mavi vagon Siding'e park edilir, Kırmızı vagon ana hattan geçer, Mavi salınır.
- **Seviye 104 (Eski) Manifestosu:** `['B', 'R', 'B', 'R']` (4 araç).
  - *Karar:* 
    - Çevrim 1: Mavi vagon Siding'e alınır, Kırmızı ana hattan geçer, Mavi salınır.
    - Çevrim 2: Mavi vagon Siding'e alınır, Kırmızı ana hattan geçer, Mavi salınır.
- **Sonuç:** Eski Seviye 104, Seviye 102'nin ardışık iki kez icra edilmesinden ibarettir. Ağ topolojisi, karar tipi ve hamle şablonu tamamen aynıdır ($0$ yeni karar türü).

### 1.3. Seviye 105: İki Bağımsız Çözüm İzi (Path A vs. Path B)
Deterministik simülatör üzerinden Seviye 105 için iki geçerli ve bağımsız çözüm izi çıkarılmıştır:

#### Çözüm A (Park Cebi Kullanımı — Siding Bypass):
```
Tick 0:  SW_SIDING = SIDING, SW_STATION = RED
Tick 4:  V1(R) MOVING -> SIDING_BAY
Tick 5:  V1(R) PARKED@SIDING_BAY (T_slack = ∞) | V2(B) SPAWNED@SOURCE
Tick 6:  ACTION: toggle SW_SIDING -> MAIN
Tick 8:  V2(B) MOVING -> MERGE
Tick 10: ACTION: toggle SW_STATION -> BLUE
Tick 12: V2(B) MOVING -> BLUE (Teslimat #1)
Tick 13: ACTION: toggle SW_STATION -> RED, release SIDING_BAY (V1)
Tick 18: V1(R) DELIVERED@RED (Teslimat #2)
Tick 22: V3(R) DELIVERED@RED (Teslimat #3) -> WON (24 ticks)
```

#### Çözüm B (Doğrudan Hat Zamanlaması — No Siding):
```
Tick 0:  SW_SIDING = MAIN (Siding hiç kullanılmaz!)
Tick 4:  V1(R) MOVING -> MERGE
Tick 8:  V1(R) DELIVERED@RED (Teslimat #1)
Tick 10: V2(B) MOVING -> SW_STATION
Tick 12: ACTION: toggle SW_STATION -> BLUE
Tick 13: V2(B) DELIVERED@BLUE (Teslimat #2)
Tick 14: ACTION: toggle SW_STATION -> RED
Tick 17: V3(R) DELIVERED@RED (Teslimat #3) -> WON (19 ticks)
```

### 1.4. Refleks Baskısı & En Dar Hamle Penceresi Analizi
- **Klasik / Progressive Modu:** Düğümler arası geçiş 1 tick (~700–1000 ms). Makas kilidi (`isJunctionLocked`) aracın varışından önceki 1 tick boyunca aktiftir. Karar penceresi dar bir zaman aralığına sıkışır; kaçırılırsa vagon kaza yapar.
- **Siding Modu:** Araç park cebine girdiğinde `PARKED` durumuna geçer. Bekleme süresi **$T_{\text{slack}} = \infty$**'dur. Oyuncu 10 saniye veya 10 dakika beklese dahi simülasyon kilitlenmez veya hata yazmaz.
- **En Dar Hamle Penceresi:** Siding modundaki en dar hamle penceresi, arkadan gelen vagonun park cebine yanlışlıkla girmesini engellemek için `SW_SIDING` makasını `MAIN` konumuna çevirme anıdır. İki vagonun geliş aralığı `spawnCadenceTicks = 3-4` (~3300–4400 ms) olduğundan, oyuncunun hamle penceresi Klasik modun **4 katından fazladır**.
- **Tamponlu Makas (Buffered Toggle):** Makas kilitliyken basılsa dahi dokunuş çöpe atılmaz, kuyruğa alınır ve vagon kavşağı terk ettiği anda otomatik uygulanır. Dolayısıyla "frame-perfect" refleks baskısı sıfırlanmıştır.

### 1.5. Önceki Rapordaki Hatalı/Eksik İfadelerin Düzeltilmesi
- *Eski İfade:* "101–105 seviyelerinin her biri oyuncuya farklı mekanik çözümler sunar."
  - *Düzeltme:* 101, 102, 103 ve 104 topolojik olarak izomorftur. 104, 102'nin 2 çevrimli tekrarıdır. Seviye 105 hariç tutulursa, 101-104 arasında yalnızca tek bir temel karar şablonu (1 aracı kenara çekip diğerine yol verme) kullanılmıştır.
- *Eski İfade:* "Görsel ray kavislerinin değişmesi bölüm çeşitliliğini sağlar."
  - *Düzeltme:* Çizge kuramı açısından geometrik dönüşümler (affine transformation) oyuncunun karar alanını (decision space) genişletmez. Gerçek çeşitlilik düğüm derecesi (degree), cebin kapasitesi ve bağımsız rota sayısı arttığında ortaya çıkar.

---

## 2. FAZ 2 — Seviye 104 (Dual-Siding & Karşı-Olgusal Kanıt)

### 2.1. Dual-Siding Topolojisi (`SIDING_TOPOLOGY_L104_DUAL`)
İzomorfizmi kırmak ve çoklu sıralama kararı üretmek için iki bağımsız park cebi tasarlanmıştır:
- **Düğüm Sayısı:** $|V| = 10$ (`SOURCE`, `SW_SIDING_A`, `SIDING_A`, `MERGE_A`, `SW_SIDING_B`, `SIDING_B`, `MERGE_B`, `SW_STATION`, `RED`, `BLUE`).
- **Kenar Sayısı:** $|E| = 11$.
- **Makas Sayısı:** 3 adet (`SW_SIDING_A`, `SW_SIDING_B`, `SW_STATION`).
- **Giriş Dizisi (Manifesto):** `['B', 'B', 'R', 'R']`, Hızlanmış Çıkış: `spawnCadenceTicks: 3`.

```
                    [SOURCE]
                       │
                 [SW_SIDING_A]
                ╱             ╲
        [SIDING_A (Sol)]     (MAIN)
                ╲             ╱
                   [MERGE_A]
                       │
                 [SW_SIDING_B]
                ╱             ╲
             (MAIN)     [SIDING_B (Sağ)]
                ╲             ╱
                   [MERGE_B]
                       │
                 [SW_STATION]
                ╱            ╲
             [RED]          [BLUE]
```

### 2.2. Karşı-Olgusal (Counterfactual) Doğrulama Testi
Dual-Siding topolojisinin gerekliliği `tests/siding_diversity_correction.test.ts` içinde karşı-olgusal yöntemle kanıtlanmıştır:
1. **Çift Park Cebi ile Çözüm (`solveLevel104Dual`):**
   - Vagon 1 (`B`) $\rightarrow$ `SIDING_A`'ya alınır.
   - Vagon 2 (`B`) $\rightarrow$ `SIDING_B`'ye alınır.
   - Vagon 3 (`R`) ve Vagon 4 (`R`) $\rightarrow$ Ana hattan kesintisiz `RED` istasyonuna ulaşır (2 doğru teslimat).
   - `SW_STATION` $\rightarrow$ `BLUE` yapılır. `SIDING_A` ve `SIDING_B` sırayla boşaltılır.
   - **Sonuç:** $4/4$ doğru teslimat, $0$ hata, Durum: **WON**.
2. **Tek Park Cebi ile Çözüm Denemesi (`solveLevel104SingleCounterfactual`):**
   - `SIDING_B` kaldırılarak hat tek cebe indirgenmiştir.
   - Vagon 1 (`B`) `SIDING_A`'yı doldurur (Kapasite = 1).
   - Vagon 2 (`B`) geldiğinde park cebi doludur; ana hatta girmek zorunda kalır.
   - Vagon 2, arkasından gelen Vagon 3 (`R`) ve 4 (`R`)'ten önce istasyon makasına varır.
   - `SW_STATION` kırmızıdayken girerse **Hatalı Teslimat (MISDELIVERED)** oluşur; maviye çevrilirse arkasından gelen kırmızı vagonlar yanlış istasyona girer.
   - **Sonuç:** 16. tickte **LOST** (Hata limiti aşıldı).
3. **Bilimsel Kanıt:** İkinci park cebi kozmetik bir ray uzantısı değil; `['B', 'B', 'R', 'R']` problemini çözmek için **zorunlu topolojik bileşendir**.

---

## 3. FAZ 3 — Seviye 103-B (2-Araçlık FIFO Park Cebi Deneyi)

### 3.1. FIFO Park Mekaniği
Mevcut Seviye 103 (1-araç kapasite sınırı) korunmuş, 2 araç alabilen FIFO park cebi `SIDING_LEVEL_103_FIFO` olarak ayrı bir deneye dönüştürülmüştür:
- **Düğüm Kapasitesi:** `SIDING_BAY.capacity = 2`.
- **Manifesto:** `['B', 'B', 'R']`.
- **Kuyruk Mantığı:**
  - Vagon 1 (`B`, id: 1) park cebine girer.
  - Vagon 2 (`B`, id: 2) arkasından aynı cebe girer (`count = 2 <= capacity`).
  - Vagon 3 (`R`) ana hattan doğrudan `RED` istasyonuna teslim edilir.
  - Oyuncu "SERBEST BIRAK" butonuna bastığında ilk giren (id: 1) vagon ayrılır.
  - İkinci vagon, birinci vagon kavşağı (`MERGE`) temizledikten sonra ikinci dokunuşla çıkar.
- **Determinizm:** `GraphSwitchNetwork` içindeki `readyVehicles` sıralaması `a.id - b.id` kullandığından, parktan çıkış sırası %100 deterministiktir (FIFO).

---

## 4. FAZ 4 — Test ve Doğrulama Sonuçları

Tüm testler Vitest ortamında çalıştırılmıştır:

```
 RUN  v5.0.5 F:/Caravan

 ✓ tests/switch.test.ts (13 tests)
 ✓ tests/telemetry.test.ts (5 tests)
 ✓ tests/smoke.test.ts (4 tests)
 ✓ tests/chain.test.ts (8 tests)
 ✓ tests/graph_switch_equivalence.test.ts (7 tests)
 ✓ tests/siding_qa_metrics.test.ts (3 tests)
 ✓ tests/siding.test.ts (8 tests)
 ✓ tests/siding_diversity_correction.test.ts (11 tests)

 Test Files  8 passed (8)
      Tests  59 passed (59)
   Duration  279ms
```

### Doğrulanan Kriterler:
1. **Classic, Progressive ve Chain Domino:** Sıfır regresyon; 48 eski testin tamamı yeşildir.
2. **Dual-Siding (104):** İki bağımsız ceple $4/4$ teslimat kanıtlandı.
3. **Single-Siding Çöküşü (Counterfactual):** Tek cebe indirgendiğinde oyunun kilitlendiği/kaybedildiği kanıtlandı.
4. **FIFO Siding (103-B):** 2 vagonun sırayla girip FIFO kuralıyla çıktığı doğrulandı.
5. **Mobil Dokunmatik Kontroller:** Phaser sahnesinde birden fazla park cebi olduğunda her cep için bağımsız buton (`🟢 SOL SAL`, `🟢 SAĞ SAL`) dinamik olarak oluşturulmakta ve kuyruktaki araçlar `#1`, `#2` rozetleriyle dikey eksende ötelenmektedir.

---

## 5. FAZ 5 — Oyuncu Testi Hazırlığı & Telemetri Metrikleri

Oyun motoruna ve telemetri katmanına (`TelemetryLogger`) aşağıdaki test metrikleri entegre edilmiştir:

| Metrik | Telemetri Anahtarı / Alanı | Amaç |
| :--- | :--- | :--- |
| **İlk Anlamlı Hamle** | `first_tap` $\rightarrow$ `time_to_first_tap_ms` | Oyuncunun topolojiyi okuma ve plan yapma süresi |
| **Başarılı Teslimat** | `vehicle_delivered` | Vagonun doğru istasyona teslim sayısı ve seri uzunluğu |
| **Geçersiz Dokunuş** | `invalid_tap` (`empty_siding_dispatch`) | Boş cebe basma veya hatalı zamanlama oranı |
| **Park & Bırakma** | `valid_move` (`release_siding`, `vehicle_parked`) | Siding mekaniğinin kaç kez kullanıldığı |
| **Gönüllü Tekrar** | `replay_clicked` (`intentional: true`) | Oyuncunun bölümü isteyerek baştan başlatma sıklığı |
| **Bölüm Terk Etme** | `exit_clicked` (`reason: switched_without_completion`) | Oyuncunun sıkılıp başka moda geçtiği an |
| **Seviye 105 Strateji Tercihi** | `run_won` $\rightarrow$ `chosenPath: 'path_a_siding' \| 'path_b_timing'` | Oyuncuların bulmaca (siding) mı yoksa refleks (timing) yolunu mu tercih ettiği |
| **Takılma Noktası** | `run_lost` $\rightarrow$ `stuck_level_id` | Hangi seviyede oyuncuların tıkandığının tespiti |

> [!IMPORTANT]
> **Kullanıcı Testi İlkesi:** Kullanıcı oturumlarından elde edilen gerçek retention ve tamamlama verileri toplanmadan, yalnızca tasarım teorisine dayanılarak "oyun eğlencelidir" iddiasında bulunulamaz. Yukarıdaki telemetri altyapısı bu oturumları ampirik olarak ölçmek için hazır hale getirilmiştir.

---

## 6. Sürüm Özeti & Oynanabilir Seviye Listesi

UI Seviye Seçim Menüsünde (`🅿️ Siding Deneyi`) artık 7 seviye mevcuttur:

1. `🅿️ Siding 1: Park Cebine Giriş ve Çıkış (1 tren)` — Temel onboarding
2. `🅿️ Siding 2: Öncelik ve Sollama (2 tren)` — Temel sollama şablonu
3. `🅿️ Siding 3: Kapasite ve Blokaj (3 tren)` — 1-araç kapasite taşması
4. `🅿️ Siding 4 (Ref): Tek Cepte 4 Vagon (4 tren)` — 2-çevrimli eski referans
5. `🅿️ Siding 5: Serbest Rota Planlaması (3 tren)` — Çift çözüm yolu (Path A vs B)
6. `🅿️ Siding 4: Çift Park Cebi (Dual Siding) (4 tren)` — 10 düğümlü, 2 bağımsız cepli yeni topoloji
7. `🅿️ Siding 3-B: 2-Araçlık FIFO Park Cebi (Deney) (3 tren)` — 2-vagon kapasiteli deterministik FIFO kuyruğu
