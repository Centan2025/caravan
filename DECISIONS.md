# DECISIONS.md — Teknik Mimari ve Tasarım Kararları

**Tarih:** 2026-10-17  
**Proje:** Chain Domino & Switch Rush Web Prototypes  
**Teknoloji:** TypeScript, Vite, Phaser 3, Vitest  
**Referans Belge:** `chain_domino_switch_rush_GDD.md` (Tek yetkili kaynak)

---

## 1. Mimari Tasarım ve Modüler Ayrım

Mevcut Caravan prototipini ve dosyalarını (`src/game/GameScene.ts`, `src/core/PathSolver.ts`, `src/core/LevelManager.ts`) korumak amacıyla yeni oyunlar tamamen bağımsız modüller halinde yapılandırılmıştır:

```
src/
├── core/
│   ├── chain/              # Game A: Saf deterministik durum motoru ve çözücü
│   │   ├── ChainTypes.ts
│   │   ├── ChainBoard.ts
│   │   └── ChainSolver.ts
│   └── switch/             # Game B: Saf deterministik demiryolu durum motoru
│       ├── SwitchTypes.ts
│       ├── SwitchNetwork.ts
│       └── SwitchSolver.ts
├── shared/                 # Ortak telemetri, oturum yönetimi ve ses
│   ├── Telemetry.ts
│   └── AudioSynth.ts
├── games/                  # Phaser 3 görsel sahne uygulamaları
│   ├── LandingScene.ts     # A / B / Caravan seçim ekranı
│   ├── ChainDominoScene.ts # Game A render ve etkileşim
│   └── SwitchRushScene.ts  # Game B render ve etkileşim
└── main.ts                 # Birleşik uygulama bootstrap
levels/
└── chain/                  # 10 adet doğrulanmış seviye JSON dosyası (level_01.json ... level_10.json)
tests/                      # Vitest birim ve entegrasyon testleri
├── chain.test.ts
├── switch.test.ts
└── telemetry.test.ts
```

---

## 2. GDD Analizi: Belirsiz Noktalar ve Alınan Kararlar

### 2.1. Game A — Chain Domino Kararları

| Konu | GDD Belirtimi | Karar / Uygulama |
| :--- | :--- | :--- |
| **Daha Önce Tetiklenmiş Karolar** | GDD Madde 43: *"Each relay and each goal activates at most once per attempt, so cycles cannot run forever."* | Bir darbe (pulse) zaten aktifleşmiş bir oka veya H/V bölücüye çarparsa, karo **tekrar tetiklenmez** ve yeni darbe üretmez (darbe emilir). |
| **Eşzamanlı Darbeler** | GDD Madde 42 & 4: *"If several pulses hit the same cell in the same tick, process it once. Process active cells in stable y-then-x order."* | Bir hücreye aynı simülasyon adımında birden fazla darbe gelirse yalnızca bir kez işlenir. Hücreler kesinlikle `y ardından x` artan sırada işlenir (deterministik). |
| **Animasyon Sırasında Dokunma** | GDD Madde 46 & Genel Kural 12: *"Run until the pulse queue is empty. Only then allow the next ignition."* | Darbeler tahtada yayılırken oyuncu dokunuşları kilitlenir; yalnızca darbe kuyruğu tamamen boşaldığında bir sonraki ateşlemeye izin verilir. |
| **Kazanma ve Kaybetme Çözümlemesi** | GDD Madde 45: *"If all goals are active, win immediately; if no ignitions remain, lose; otherwise await another player tap."* | Son ateşlemede tüm hedefler vurulursa, kalan ateşleme hakkı 0 olsa dahi anında **Kazanma (Win)** gerçekleşir. Darbe kuyruğu bittiğinde vurulmamış hedef kalmış ve hak 0 ise **Kaybetme (Loss)** verilir. |
| **Sıfırlama (Retry) Davranışı** | GDD Madde 51: *"Display goals collected / total and ignitions left, plus Retry after completion."* | Retry yapıldığında tahta orijinal seviye JSON başlangıç durumuna döner, harcanan haklar ve aktiflikler sıfırlanır. |

### 2.2. Game B — Switch Rush Kararları

| Konu | GDD Belirtimi | Karar / Uygulama |
| :--- | :--- | :--- |
| **Düğüm Kapasitesi ve Kuyruk (Queueing)** | GDD Madde 104 & 109: *"vehicles queue if the next node is occupied. Queueing has no penalty in this test."* | Düğümler (`SOURCE`, `J1`, `J2`, `J3`) aynı anda en fazla 1 araç barındırabilir. Bir sonraki düğüm doluysa araç mevcut düğümünde bekler (kuyruk). İstasyonlar araçları anında teslim alır ve boşaltır. |
| **Makas Değiştirme Kilidi (Switch Lock)** | GDD Madde 107: *"A tap on a junction toggles its branch instantly unless a car is currently entering that junction during the same simulation tick."* | Bir araç mevcut tick sırasında bir kavşağa doğru hareket halindeyse (giriş anı), o kavşağa dokunulamaz; araç düğüme ulaştıktan sonra veya öncesinde dokunulabilir. |
| **Rota Sabitlenmesi (Latching)** | GDD Madde 107: *"The selected route is latched once a vehicle departs that junction; toggling later cannot teleport a vehicle or change its already-chosen edge."* | Araç kavşaktan ayrıldığı tick anındaki makas yönü araca kilitlenir. Araç yoldayken makasın tekrar değiştirilmesi aracın yolunu geriye dönük etkilemez. |
| **Araç Çıkış Sıklığı (Cadence)** | GDD Madde 104 & 105: *"One simulation tick every 700ms. next vehicle appears every 1400ms if SOURCE is free."* | Her 2 tick'te bir (1400ms) manifestodaki sıradaki araç `SOURCE` boş ise doğar. `SOURCE` dolu ise boşalana kadar manifestoda bekletilir (asla silinmez veya çakışmaz). |
| **Renk Körü Erişilebilirliği** | GDD Madde 100: *"color is also indicated by a letter/icon (R/B/G/Y) for color-blind accessibility."* | Hem vagonlarda hem istasyonlarda renklerin yanı sıra `R` (Kırmızı), `B` (Mavi), `G` (Yeşil), `Y` (Sarı) harfleri net şekilde gösterilir. |
| **Oyun Bitişi ve Otomatik İlerleme Yasağı** | GDD Madde 111 & Genel Kural 13: *"Explicit Play again and Leave buttons at end. Never automatically start the next run."* | 3 hata anında derhal oyun biter. Tüm araçlar teslim edildiğinde kazanma/kaybetme ekranı gösterilir ve oyuncu açıkça `Play again` veya `Leave` butonuna basana kadar beklenir. |

### 2.3. Switch Rush Kontrollü Zorluk İyileştirmesi ve Progressive Mod
 
Orijinal Switch Rush seviyeleri GDD gereği 1. senaryodan itibaren 3 makas, 4 renk, 700 ms tick süresi ve 1400 ms çıkış sıklığı içeriyordu. Bu durum ilk 10 saniyede oyuncuya 700 ms'den az karar penceresi bırakarak yüksek bilişsel yük oluşturuyordu. Bu zorluğu gidermek için aşağıdaki mimari kararlar alındı:

1. **Ayrık Sürüm Desteği (`Original` vs `Progressive`):**
   - Orijinal 10 senaryo hiçbir parametresi değiştirilmeden `Original` modu olarak korundu.
   - 20 aşamalı kademeli zorluk sürümü `Progressive` olarak bağımsız bir alt mod olarak eklendi.
2. **Kademeli Değişken Artışı (Single-Variable Scaling):**
   - Aynı anda tüm zorluk değişkenleri (hız, çıkış sıklığı, makas sayısı, araç adedi) asla artırılmaz.
   - *Aşama 1 (Seviye 1-3):* Tek makas (`J2`), 1-3 araç, 950-850 ms tick, 5-4 tick aralık (~4.5s karar tamponu).
   - *Aşama 2 (Seviye 4-7):* Ana makas (`J1`) ve ikili makas kombinasyonları (`J1`+`J2`), 2-4 araç, 850-800 ms tick.
   - *Aşama 3 (Seviye 8-11):* 3 makas devreye girer ancak araç sayısı düşük (4-5 araç) tutulur, 800-750 ms tick.
   - *Aşama 4 (Seviye 12-15):* Standart hız (700 ms), 6 araç, 3'ten 2 tick'e inen çıkış aralığı.
   - *Aşama 5 (Seviye 16-20):* Usta seviyeleri (8-10 araç), yüksek yoğunluk.
3. **Görsel Netlik İyileştirmeleri:**
   - **Hedef İstasyon Vurgusu:** Yoldaki en öndeki aktif aracın hedef istasyonu altın sarısı titreşen çerçeve ve `🎯 HEDEF` rozeti ile anında gösterilir.
   - **Sabit Makas Kilidi:** İlgili seviyede kullanılmayan makaslar `🔒 SABİT` rozetiyle karartılır ve dokunulduğunda oyuncuya bilgi verilir.
   - **Aktif Hat Aydınlatması:** Makasların baktığı aktif demiryolu rotası parlak camgöbeği (`#48cae4`) çizgiyle vurgulanır.
4. **Yapılandırılabilir Simülasyon Motoru:**
   - `ScenarioDefinition` arayüzü; `tickDurationMs`, `spawnCadenceTicks`, `activeJunctions`, `initialJ1/J2/J3`, `maxMistakes`, `title` ve `hint` alanlarıyla parametrik hâle getirildi.
5. **Genişletilmiş Telemetri:**
   - Olaylara `submode` ('progressive' / 'original'), `level`, `maxMistakes`, yanlış yönlendirilen istasyon ve gönüllü tekrar deneme detayları eklendi.

---

## 3. Test ve Doğrulama Kriterleri

- **Chain Domino:** 10 seviyenin tamamı `ChainSolver` tarafından otomatik taranmış; en az 1 çözümün varlığı ve ilk hamlede en az 1 yanlış hamlenin bulunduğu birim testlerle kanıtlanmıştır.
- **Switch Rush (Original):** 10 araç dizisinin tamamı `SwitchSolver` tarafından %100 doğrulukla ve 0 hata ile çözülebilmektedir.
- **Switch Rush (Progressive):** 20 öğretici seviyenin tamamı `SwitchSolver.verifyProgressiveLevels()` tarafından 0 hata ile çözülmüş ve birim testlerle doğrulanmıştır.
- **Determinizm:** Her iki motor da rendering katmanından (Phaser) tamamen izole, saf TypeScript fonksiyonları ve veri yapıları ile çalışır.
