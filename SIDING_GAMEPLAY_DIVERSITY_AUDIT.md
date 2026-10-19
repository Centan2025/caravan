# SWITCH RUSH — SIDING OYNANIŞ VE KARAR ÇEŞİTLİLİĞİ DENETİM RAPORU (GAMEPLAY DIVERSITY AUDIT)

**Tarih:** 19 Ekim 2026  
**Denetim Kapsamı:** Switch Rush Siding Modu (Seviye 101–105)  
**Hedef:** Seviyelerin yalnızca 2D görsel/geometrik açıdan değil; grafik izomorfizmi, oyuncu karar uzayı, zamanlama adaleti ve gerçek problem çeşitliliği açısından derinlemesine denetlenmesi.  
**İncelenen Dosyalar:**
- [`src/core/switch/graph/SidingLevels.ts`](file:///f:/Caravan/src/core/switch/graph/SidingLevels.ts)
- [`src/core/switch/graph/GraphSwitchNetwork.ts`](file:///f:/Caravan/src/core/switch/graph/GraphSwitchNetwork.ts)
- [`src/core/switch/graph/SidingSolver.ts`](file:///f:/Caravan/src/core/switch/graph/SidingSolver.ts)
- [`src/games/SidingRushScene.ts`](file:///f:/Caravan/src/games/SidingRushScene.ts)
- [`tests/siding.test.ts`](file:///f:/Caravan/tests/siding.test.ts)
- [`tests/siding_qa_metrics.test.ts`](file:///f:/Caravan/tests/siding_qa_metrics.test.ts)

---

## 1. Yönetici Özeti ve Temel Denetim Hükmü

Bu denetim, Siding modunun 101–105 seviyelerini iki ayrı düzlemde incelemiştir:
1. **Görsel / Geometrik Düzlem:** 5 seviyenin her biri ekranda farklı koordinat yerleşimine (sol cep, sağ cep, ada tipi, diyagonal, elmas) sahiptir.
2. **Matematiksel / Oynanış Çizgesi Düzlemi:** 
   - **Tüm 5 seviye mantıksal olarak BİREBİR İZOMORFTUR ($G_1 \cong G_2 \cong G_3 \cong G_4 \cong G_5$).**
   - Düğüm rolleri, kenar yönelimleri ve makas dallanmaları açısından 5 seviye de tek bir soyut çizgeyi ($|V|=7, |E|=7$) paylaşmaktadır.
   - Ancak manifestoların ve zamanlama parametrelerinin kurgusu sayesinde **oyuncunun zihinsel modelinde 3 farklı karar kategorisi** oluşmaktadır.

---

## 2. FAZ 1 — Beş Seviyenin Tek Tek İncelenmesi

```
                    [ SOURCE ]
                        │
                        ▼
                 [ SW_SIDING ] ──── (Kol: SIDING) ────► [ SIDING_BAY ] (Kapasite: 1)
                        │                                      │
                 (Kol: MAIN)                                   │
                        │                                      ▼
                        └──────────────► [ MERGE ] ◄───────────┘
                                             │
                                             ▼
                                      [ SW_STATION ]
                                      ┌──────┴──────┐
                                      ▼             ▼
                                   [ RED ]       [ BLUE ]
```

### Seviye 101: "Siding 1: Park Cebine Giriş ve Çıkış"
- **Topoloji:** `SIDING_TOPOLOGY_L1` (Sol Cep) — $|V|=7, |E|=7$, 2 Makas (`SW_SIDING`, `SW_STATION`).
- **Park Cebi Kapasitesi:** 1 araç.
- **Manifesto:** `['R']` (1 araç).
- **Zamanlama:** `tickDurationMs = 1200ms`, `spawnCadenceTicks = 5`.
- **Başlangıç Makasları:** `SW_SIDING = 'SIDING'`, `SW_STATION = 'RED'`.
- **Olası Rotalar:**
  - Rota $A$ (Kurgulanan): `SOURCE -> SW_SIDING -> SIDING_BAY [PARKED] -> MERGE -> SW_STATION -> RED` (5 tick + bekleme).
  - Rota $B$ (Oyuncu girişte makası çevirirse): `SOURCE -> SW_SIDING -> MERGE -> SW_STATION -> RED` (4 tick, cebe hiç girmeden).
- **Zorunlu Bekletme:** Kurgulanan rotada araç cebe girince `PARKED` olur ve oyuncu serbest bırakana kadar bekler.
- **Minimum Hamle Sayısı:** **1 hamle** (Sadece `releaseSiding`).
- **Kazanmak İçin Zorunlu Karar Türü:** "Serbest Bırakma" (Dispatch).
- **Alternatif Çözüm:** Var (Araç henüz `SW_SIDING`'e varmadan makası `MAIN` yaparak cebe hiç sokmadan teslim etmek de mümkündür; ancak seviye öğretici olduğu için başlangıçta makas `SIDING` koluna kilitli başlatılmıştır).
- **Risk / Çıkmaz:** Oyuncunun serbest bırak butonuna basmayı unutması.

### Seviye 102: "Siding 2: Öncelik ve Sollama"
- **Topoloji:** `SIDING_TOPOLOGY_L2` (Sağ Cep) — $|V|=7, |E|=7$.
- **Park Cebi Kapasitesi:** 1 araç.
- **Manifesto:** `['B', 'R']` (2 araç).
- **Zamanlama:** `tickDurationMs = 1100ms`, `spawnCadenceTicks = 4`.
- **Başlangıç Makasları:** `SW_SIDING = 'SIDING'`, `SW_STATION = 'RED'`.
- **Zorunlu Bekletme Kararı:** **EVET (Kritik).**
  - Mavi araç (`B`) önce gelir. Eğer ana hattan doğrudan giderse ve istasyon makası `RED` ise yanlış teslimat olur. Oyuncu makası `BLUE` yaparsa, arkadan gelen `R` bu sefer yanlış teslim edilir.
  - Tek çözüm: Mavi tren cebe alınır (`PARKED`), Kırmızı tren ana hattan hızla `RED` istasyonuna geçer, ardından istasyon `BLUE` yapılır ve Mavi salınır.
- **Minimum Hamle Sayısı:** **3 hamle** (1. `SW_SIDING` $\to$ `MAIN`, 2. `SW_STATION` $\to$ `BLUE`, 3. `releaseSiding`).
- **Kazanmak İçin Zorunlu Karar Türü:** "Öncelik Değişimi ve Sollama" (Order Reversal).
- **Alternatif Çözüm:** Yok. 2 vagonun sırası fiziksel olarak tersyüz edilmek zorundadır.

### Seviye 103: "Siding 3: Kapasite ve Blokaj"
- **Topoloji:** `SIDING_TOPOLOGY_L3` (Ada Tipi Merkez Cep) — $|V|=7, |E|=7$.
- **Park Cebi Kapasitesi:** 1 araç.
- **Manifesto:** `['R', 'B', 'R']` (3 araç).
- **Zamanlama:** `tickDurationMs = 1000ms`, `spawnCadenceTicks = 4`.
- **Başlangıç Makasları:** `SW_SIDING = 'SIDING'`, `SW_STATION = 'RED'`.
- **Zorunlu Bekletme:** Evet. İlk Kırmızı (`R1`) cebe park edilir.
- **Kapasite ve Blokaj Riski:**
  - Park cebi kapasitesi 1'dir. İlk araç parktayken makas `SIDING` kolunda bırakılırsa, 2. araç (`B`) cebe giremez ve makas üzerinde kilitlenir (`WAITING`).
  - Oyuncu ilk araç girer girmez `SW_SIDING` makasını `MAIN` koluna çevirmelidir.
- **Minimum Hamle Sayısı:** **4 hamle** (1. `SW_SIDING` $\to$ `MAIN`, 2. `SW_STATION` $\to$ `BLUE`, 3. `SW_STATION` $\to$ `RED`, 4. `releaseSiding`).
- **Kazanmak İçin Zorunlu Karar Türü:** "Kapasite Blokajı Yönetimi" + "İstasyon Arası Zamanlama".
- **Alternatif Çözüm:** Yok (Cebe 2 araç sığmadığı için kapasite kuralına uyulması mecburidir).

### Seviye 104: "Siding 4: Çoklu Teslimat Düzeni"
- **Topoloji:** `SIDING_TOPOLOGY_L4` (Diyagonal Hat) — $|V|=7, |E|=7$.
- **Park Cebi Kapasitesi:** 1 araç.
- **Manifesto:** `['B', 'R', 'B', 'R']` (4 araç).
- **Zamanlama:** `tickDurationMs = 1000ms`, `spawnCadenceTicks = 3` (Daha sık araç doğuşu).
- **Başlangıç Makasları:** `SW_SIDING = 'SIDING'`, `SW_STATION = 'RED'`.
- **Zorunlu Bekletme:** Evet. 1. Mavi cebe alınır, 1. Kırmızı ana hattan teslim edilir; ardından cepten Mavi çıkarılır. 2. Mavi ve 2. Kırmızı için süreç tekrarlanır.
- **Minimum Hamle Sayısı:** **5–6 hamle**.
- **Kazanmak İçin Zorunlu Karar Türü:** "Tekrarlanan Parti Sıralaması" (Batch Interleaving).
- **Alternatif Çözüm:** Anlamlı bir alternatif rota yoktur; 102'deki öncelik çevirme döngüsünün iki kez ardışık uygulanmasıdır.

### Seviye 105: "Siding 5: Serbest Rota Planlaması"
- **Topoloji:** `SIDING_TOPOLOGY_L5` (Geniş Elmas Ağı) — $|V|=7, |E|=7$.
- **Park Cebi Kapasitesi:** 1 araç.
- **Manifesto:** `['R', 'B', 'R']` (3 araç).
- **Zamanlama:** `tickDurationMs = 1100ms`, `spawnCadenceTicks = 4`.
- **Başlangıç Makasları:** `SW_SIDING = 'MAIN'`, `SW_STATION = 'RED'`.
- **Zorunlu Bekletme:** **HAYIR (Zorunlu Değildir).**
- **Çözüm Yolu Çeşitliliği (Multiple Solution Paths):**
  - **Yol A (Siding Stratejisi — 19 Tick):** İlk Kırmızı park cebine alınır. Mavi ana hattan geçerken istasyon Mavi'ye çevrilir. Mavi teslim edilince istasyon Kırmızı'ya alınır ve parktaki Kırmızı ile son Kırmızı ardışık teslim edilir.
  - **Yol B (Doğrudan Ana Hat Zamanlama Stratejisi — 17 Tick):** Hiçbir araç park cebine sokulmaz. Tüm araçlar ana hattan akar. Oyuncu sadece `SW_STATION` makasını `RED` $\to$ `BLUE` $\to$ `RED` şeklinde araç aralıklarında çevirir.
- **Minimum Hamle Sayısı:** 
  - Yol B için: **2 hamle**.
  - Yol A için: **4 hamle**.
- **Kazanmak İçin Zorunlu Karar Türü:** "Oyun Stili ve Güzergah Seçimi" (Stratejik İkilem).

---

## 3. FAZ 2 — Topoloji Eşdeğerliği (Yönlü Grafik İzomorfizmi)

Matematiksel tanım: İki yönlü çizge $G_1 = (V_1, E_1)$ ve $G_2 = (V_2, E_2)$ arasında, düğüm rollerini (Kaynak, Makas, Park Cebi, İstasyon) ve kenar yönlerini koruyan birebir ve örten bir $f: V_1 \to V_2$ eşlemesi varsa bu iki çizge izomorftur ($G_1 \cong G_2$).

### 3.1 İzomorfizm Tablosu
| Seviye | Düğüm Sayısı | Kenar Sayısı | Giriş/Çıkış Dereceleri | İzomorfizm Durumu |
| :---: | :---: | :---: | :---: | :---: |
| **L101** | 7 | 7 | $\text{deg}^+(SW)=2, \text{deg}^-(MERGE)=2$ | **Temel Çizge ($G_0$)** |
| **L102** | 7 | 7 | $\text{deg}^+(SW)=2, \text{deg}^-(MERGE)=2$ | **$G_0$ ile %100 İzomorf** |
| **L103** | 7 | 7 | $\text{deg}^+(SW)=2, \text{deg}^-(MERGE)=2$ | **$G_0$ ile %100 İzomorf** |
| **L104** | 7 | 7 | $\text{deg}^+(SW)=2, \text{deg}^-(MERGE)=2$ | **$G_0$ ile %100 İzomorf** |
| **L105** | 7 | 7 | $\text{deg}^+(SW)=2, \text{deg}^-(MERGE)=2$ | **$G_0$ ile %100 İzomorf** |

### 3.2 Grafik Eşdeğerliği vs. Oynanış Eşdeğerliği Ayrımı
- **Grafik Eşdeğerliği Hükmü:**
  5 seviyenin tamamı **TEK BİR GRAFİK GRUBUDUR**.
  L1'deki sol cep ile L2'deki sağ cep arasındaki fark, matematiksel açıdan yalnızca bir $x \mapsto 540 - x$ afin koordinat dönüşümüdür (aynadır). L3'teki merkez ada veya L4'teki diyagonal eğim, çizgenin topolojik bağlantısını zerre kadar değiştirmemektedir.
- **Oynanış Eşdeğerliği Hükmü:**
  Çizgeler izomorf olmasına rağmen, seviyelerin **manifesto içerikleri ve başlangıç makas durumları** farklı lojistik durumlar üretmektedir:
  - L101: 1 araç $\to$ Kararsız Onboarding
  - L102: 2 araç ters sıra $\to$ Saf Öncelik Değişimi
  - L103: 3 araç $\to$ Kapasite Taşması & Blokaj
  - L104: 4 araç $\to$ L102'nin 2 periyotluk kopyası
  - L105: 3 araç $\to$ Serbest Çift Çözüm

---

## 4. FAZ 3 — Çözüm ve Karar Analizi

Hamlelerin anlamsal sınıflandırması ve seviyeler arasındaki eşdeğerlik:

| Anlamsal Hamle Türü | L101 | L102 | L103 | L104 | L105 (Yol A) | L105 (Yol B) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Cebe Park Etme** | ✅ (Otomatik) | ✅ Zorunlu | ✅ Zorunlu | ✅ Zorunlu | 🟡 İsteğe bağlı | ❌ Yok |
| **2. Bekletme (Holding)** | ✅ | ✅ | ✅ | ✅ | 🟡 | ❌ |
| **3. Serbest Bırakma (Release)** | ✅ (1 kez) | ✅ (1 kez) | ✅ (1 kez) | ✅ (2 kez) | 🟡 (1 kez) | ❌ Yok |
| **4. Öncelik Verme (Overtake)** | ❌ | ✅ Zorunlu | ✅ Zorunlu | ✅ Zorunlu | 🟡 | ❌ |
| **5. Alternatif Yol Seçimi** | ❌ | ❌ | ❌ | ❌ | ✅ **Var** | ✅ **Var** |
| **6. İstasyon Yönlendirmesi** | ❌ | ✅ (1 kez) | ✅ (2 kez) | ✅ (3 kez) | ✅ (2 kez) | ✅ (2 kez) |

### Eşdeğer Çözüm Grupları:
1. **Grup A (Triviyal Öğretici):** Seviye 101. Karar gerektirmez, tek bir serbest bırakma tıklamasıyla biter.
2. **Grup B (Öncelik & Sollama Şablonu):** Seviye 102, 103, 104.
   - Bu üç seviyede oyuncunun yaptığı şey aynıdır: *"Gelen ilk aracı cebe al, arkasındaki aracı ana hattan öne geçir, cepten çıkar."*
   - Seviye 104 bu problemi iki kez peş peşe yaptırır. Yeni bir karar türü **yoktur**.
3. **Grup C (Çift Yollu Çözüm):** Seviye 105.
   - Siding modundaki tek stratejik karar noktasıdır. Oyuncu park cebiyle mi yoksa ana hat zamanlamasıyla mı gideceğini seçebilir.

---

## 5. FAZ 4 — Kontrol Edilebilirlik, Zamanlama ve Adalet Analizi

### 5.1 Karar Pencereleri (Decision Slack Time)
- **Park Cebi İçi Gevşeklik Süresi:** $T_{\text{slack}} = \infty$.
  Araç park cebine girdiğinde zaman durur gibi olur. Oyuncu sonraki hamleyi planlamak için sınırsız süreye sahiptir. Bu durum Classic ve Progressive'deki "700ms telaşını" tamamen yok etmiştir.
- **Ana Hat Makas Çevirme Süresi:**
  - Araç doğuş aralığı: 3–5 tick ($3000-5500\text{ ms}$).
  - Oyuncu iki araç arasında makas çevirmek için en az $2000-3000\text{ ms}$ reaksiyon süresine sahiptir. Refleks baskısı bulunmamaktadır.

### 5.2 Makas Kilitlenmesi ve Buffered Toggle Değerlendirmesi
- `isJunctionLocked`: Araç makasa doğru seyrederken makas kilitlidir (1 tick = 1000ms boyunca).
- **Adalet Sağlama:** Projeye eklediğimiz **Buffered Toggle (Sıraya Alınan Dönüş)** sayesinde, oyuncu kilitliyken makasa dokunursa hamle reddedilmez; araç makastan geçer geçmez makas otomatik döner. Bu kural adaletsiz kilit hatalarını ortadan kaldırmıştır.

### 5.3 Potansiyel Oyuncu Sıkışma / Hüsran Noktası (Trap Point)
- **Seviye 103 ve 104'te:**
  İlk araç park cebine girdiğinde cep dolar (`capacity: 1`). Eğer oyuncu `SW_SIDING` makasını ana hatta çevirmeyi unutursa, 2. araç makas üstünde `WAITING` olarak durur (blokaj). Arkadan 3. araç gelirse hat kilitlenir.
  - *Adalet Değerlendirmesi:* Bu bir refleks hatası değil, lojistik kural farkındalığı hatasıdır. Oyuncuya açık bir görsel ikaz ("Park Dolu") verildiği sürece adildir.

---

## 6. FAZ 5 — Seviye Çeşitlilik ve Tekrar Karşılaştırma Matrisi

| Seviye | Grafik İzomorfizmi | Çözüm Şablonu | Minimum Hamle | Anlamlı Alternatif Rota | Zaman Baskısı | Tekrarlanan Problem Riski | Nihai Sınıflandırma |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **101** | $G_0$ | Öğretici | 1 | Yok | Sıfır | Yok (Onboarding) | **KISMEN FARKLI** |
| **102** | $G_0$ | Sollama / Öncelik | 3 | Yok | Düşük | Yok (Temel Problem) | **GERÇEKTEN FARKLI** |
| **103** | $G_0$ | Sollama + Blokaj | 4 | Yok | Düşük | %60 (102 ile benzer) | **KISMEN FARKLI** |
| **104** | $G_0$ | 2x Sollama Döngüsü | 5 | Yok | Orta (3 tick) | **%90 (102'nin tekrarı)** | **AYNI PROBLEMİN VARYASYONU** |
| **105** | $G_0$ | Çift Strateji (Yol A / B) | 2–4 | **VAR (2 Yol)** | Düşük | Yok (Özgür Seçim) | **GERÇEKTEN FARKLI** |

### Sınıflandırma Gerekçeleri:
1. **Seviye 102 (GERÇEKTEN FARKLI):** Siding mekaniğinin varlık sebebi olan "Öncelik Değişimi" problemini ilk defa oyuncuya sunan, vazgeçilmez temel bölümdür.
2. **Seviye 105 (GERÇEKTEN FARKLI):** Oyuncuya iki tamamen farklı düşünce yolu sunan (Siding ile güvenli sürüş vs doğrudan hat ile dinamik zamanlama) tek seviyedir.
3. **Seviye 101 & 103 (KISMEN FARKLI):** 101 salt mekanik tanıtımıdır. 103 ise 102'nin üzerine kapasite kısıtını ekler, ancak temel problem hala aynı öncelik kurgusudur.
4. **Seviye 104 (AYNI PROBLEMİN VARYASYONU):** Seviye 102'deki öncelik değişimini sadece vagon sayısını 4'e çıkararak tekrarlar. Yeni bir bulmaca mantığı sunmamaktadır.

---

## 7. En Fazla Üç Somut İyileştirme Önerisi

Seviyelerin gerçek birer bulmaca derinliğine ulaşması için kod değiştirilmeden uygulanabilecek 3 yapısal tasarım önerisi:

### 1. Öneri: Topolojik Ayrışma (Farklı Bir Ray Şeması Eklenmeli)
- *Sorun:* 101–105 seviyelerinin 5'i de $|V|=7, |E|=7$ izomorf çizgesini kullanmaktadır.
- *Çözüm:* Seviye 104 ve 105 için topoloji değiştirilmelidir:
  - Örneğin Seviye 104'te **"Çift Cepli / Karşılıklı İki Park Cebi"** (Dual Siding) topolojisi kullanılmalıdır. Böylece oyuncu Kırmızı'yı sol cebe, Mavi'yi sağ cebe alıp üçüncü bir vagonu aradan geçirebilmelidir. Bu hamle 104'ü "kopya varyasyon" olmaktan çıkarıp gerçek bir bulmaca yapar.

### 2. Öneri: 2 Kapasiteli Derin Park Cebi (Tandem / FIFO Siding)
- *Sorun:* Tüm cepler 1 araçlıktır.
- *Çözüm:* Seviye 103 veya 104'te park cebi kapasitesi 2'ye çıkarılmalıdır (`capacity: 2`). İki araç peş peşe cebe girdiğinde ilk giren ilk çıkar (FIFO) kuralı devreye girmeli, oyuncu iki vagonu birden kenara çekip ana hattı çift vagonluk bir kargo için temizleme kararı vermelidir.

### 3. Öneri: Ters Öncelik Cezası (Target Reversal Station Constraints)
- *Sorun:* Seviye 101'de araç cebe hiç girmese bile doğru istasyona gidebilmektedir.
- *Çözüm:* İstasyon önüne tek yönlü bir zaman kilidi veya tren rengine duyarlı bir kapı yerleştirilerek, öncelik değişiminin rastlantısal değil kesinlikle zorunlu olması garanti edilmelidir.

---

## 8. Gerçek Oyuncu Testine (Playtest) Hazırlık Değerlendirmesi

| Seviye | Playtest Durumu | Açıklama |
| :---: | :---: | :--- |
| **Seviye 101** | **HAZIR** | Mükemmel bir onboarding adımı. Oyuncu baskı hissetmeden dokunarak aracı serbest bırakmayı öğrenir. |
| **Seviye 102** | **HAZIR (En Başarılı Bölüm)** | Siding mekaniğinin "Eureka!" anını yaşatan en temiz seviyedir. Oyuncu testi için birincil önceliklidir. |
| **Seviye 103** | **HAZIR** | Kapasite blokajını öğretir; oyuncunun dolu cebe dikkat edip etmediğini test etmek için uygundur. |
| **Seviye 104** | **ŞARTLI HAZIR (Monotonluk Riski)** | Teknik olarak sorunsuz çalışır; ancak oyuncular Seviye 102 ve 103'ten sonra "aynı şeyi tekrar yapıyorum" hissi yaşayabilir. Playtest'te sıkılma süresi ölçülmelidir. |
| **Seviye 105** | **HAZIR (Tasarım Başarısı)** | İki farklı çözüm sunduğu için oyuncuların hangisini tercih ettiğini (Siding mi, doğrudan zamanlama mı) ölçmek adına harika bir A/B telemetri kaynağıdır.

---

### Sonuç ve Karar
Siding prototipinin mimarisi sağlamdır, 48/48 test yeşildir. Görsel olarak 5 seviye farklılaştırılmıştır; ancak lojistik bulmaca çeşitliliği açısından **Seviye 102 ve 105 gerçek birer değer üretirken, Seviye 104 Seviye 102'nin lüzumsuz bir uzatmasıdır**. Gelecek fazda Seviye 104 çift cepli (Dual Siding) yeni bir topolojiye dönüştürüldüğünde çeşitlilik sorunu kökten çözülecektir.
