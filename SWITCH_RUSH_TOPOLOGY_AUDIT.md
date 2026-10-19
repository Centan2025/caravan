# SWITCH RUSH — LEVEL VARIETY & TOPOLOGY ARCHITECTURE AUDIT

**Tarih:** 19 Ekim 2026  
**Kapsam:** `src/core/switch/` ve `src/games/SwitchRushScene.ts` Mimari İncelemesi  
**Hedef:** Seviye Çeşitliliği Analizi, Sabit Topoloji Kısıtları, Kilitlenme Sorunları ve Unity 6 URP 3D Diorama Öncesi Esnek Çizge Mimarisi Tasarımı  

---

## 1. Yönetici Özeti ve Oyuncu Geri Bildirimi Analizi

Oyuncu geri bildirimleri üç temel soruna işaret etmektedir:
1. *"Bölümler birbirine çok benziyor."*
2. *"Araçlara yetişmek zor oluyor (refleks baskısı çok yüksek)."*
3. *"Oyun kısmen eğlenceli, fakat uzun süre oynama isteği oluşmuyor."*

Bu denetim, kaynak kod ve seviye verileri üzerinde yapılan analizlerle bu geri bildirimlerin kök nedenini matematiksel ve mimari olarak doğrulamıştır:
- **Topoloji 100% Sabit Kodlanmıştır:** Mevcut kodda yalnızca tek bir ray ağı vardır (3 makaslı ikili ağaç: `SOURCE → J1 → J2/J3 → 4 İstasyon`).
- **30 Seviyenin 22'si (%73.3) Birebir Aynı Karar Ağacını Kullanmaktadır:** İlk 8 seviyelik eğitimden sonra (Seviye 9–30), oyuncu her bölümde aynı `J1 + J2 + J3` makas kombinasyonunu yönetir.
- **Zorluk "Bulmaca Derinliği" ile Değil, "Refleks Baskısı" ile Artırılmıştır:** Seviye 9 ile 30 arasındaki tek fark, tick süresinin 850 ms'den 700 ms'ye düşürülmesi, araç doğuş aralığının 2 tick'e indirilmesi ve raydaki eşzamanlı araç sayısının 3'e çıkarılmasıdır.
- **Makas Kilitlenmesi Oyuncuyu Cezalandırmaktadır:** Bir araç makasa girerken makas kilitlendiği için (`isJunctionLocked`), arkadan gelen araç için makas çevirmek isteyen oyuncu 700 ms'lik dar pencerede kilit hatası (`lock error`) almakta, strateji kurmak yerine telaşlı refleks oyununa zorlanmaktadır.

---

## 2. Ağ Topolojisinin Kod İncelemesi (Hardcoding Tespiti)

Ağ topolojisinin oyun motoru ve mantık katmanında nasıl sabit kodlandığına dair somut kod referansları:

### 2.1 Mantık Katmanı (`src/core/switch/SwitchNetwork.ts`)
- **Sabit Düğüm Alanları (Satır 39–42):**
  ```typescript
  // SwitchNetwork.ts (Satır 39-42)
  public j1: J1Branch = 'LEFT';
  public j2: J2Branch = 'RED';
  public j3: J3Branch = 'GREEN';
  ```
  Ağ dinamik bir çizge (graph) yerine, sınıf içinde tanımlı 3 somut alanla sınırlandırılmıştır.
- **Sabit Ayrılış Yönlendirmesi (Satır 262–270):**
  ```typescript
  // SwitchNetwork.ts (Satır 262-270)
  if (v.currentNode === 'SOURCE') {
    nextNode = 'J1';
  } else if (v.currentNode === 'J1') {
    nextNode = this.j1 === 'LEFT' ? 'J2' : 'J3';
  } else if (v.currentNode === 'J2') {
    nextNode = this.j2 === 'RED' ? 'RED' : 'BLUE';
  } else if (v.currentNode === 'J3') {
    nextNode = this.j3 === 'GREEN' ? 'GREEN' : 'YELLOW';
  }
  ```
  Araçların bir sonraki düğümü `if-else` merdiveniyle statik olarak belirlenmektedir. Ağaç yapısı dışında bir yol (örneğin döngü, ara bekleme cebi veya çapraz geçiş) tanımlanamaz.
- **Sabit Düğüm Öncelik Sıralaması (Satır 246–255):**
  ```typescript
  // SwitchNetwork.ts (Satır 246-255)
  const nodeOrder: Record<NetworkNode, number> = {
    RED: 0, BLUE: 0, GREEN: 0, YELLOW: 0,
    J2: 1, J3: 1,
    J1: 2,
    SOURCE: 3,
  };
  ```
  Raydan çıkış önceliği dinamik topolojik sıralama yerine sabit bir sözlükle çözülmüştür.
- **Sabit Makas Değiştirme (Satır 182–192):**
  `toggleJunction(junction: JunctionId)` metodu yalnızca `'J1'`, `'J2'`, `'J3'` string literallerini kabul etmekte ve yalnızca 2 yöne çatallanmaktadır.

### 2.2 Görsel Katman (`src/games/SwitchRushScene.ts`)
- **Sabit Koordinatlar (Satır 24–33):**
  ```typescript
  // SwitchRushScene.ts (Satır 24-33)
  private readonly NODE_COORDS: Record<NetworkNode, { x: number; y: number }> = {
    SOURCE: { x: 270, y: 130 },
    J1: { x: 270, y: 280 },
    J2: { x: 160, y: 470 },
    J3: { x: 380, y: 470 },
    RED: { x: 90, y: 700 },
    BLUE: { x: 230, y: 700 },
    GREEN: { x: 310, y: 700 },
    YELLOW: { x: 450, y: 700 },
  };
  ```
- **Sabit Ray Çizimi (Satır 940–961):**
  `drawRailBed` çağrıları `SOURCE->J1`, `J1->J2`, `J1->J3`, `J2->RED`, `J2->BLUE`, `J3->GREEN`, `J3->YELLOW` olmak üzere 7 sabit çizgi segmenti çizmektedir.

---

## 3. Progressive 30 Seviyenin Karşılaştırmalı Analizi

`src/core/switch/SwitchLevels.ts` dosyasındaki 30 seviyenin tamamı taranarak yapısal dağılımı çıkarılmıştır:

### 3.1 Aktif Makas Gruplaması
| Aktif Makas Konfigürasyonu | Seviye Sayısı | Seviye ID'leri | Karar Karmaşıklığı |
| :--- | :---: | :--- | :--- |
| `[J2]` | 3 | Seviye 1, 2, 3 | Tek Makas (2 Hedef: R, B) |
| `[J1]` | 2 | Seviye 4, 5 | Tek Makas (2 Hat: Sol/Sağ) |
| `[J1, J2]` | 1 | Seviye 6 | İki Makas (3 Hedef: R, B, G) |
| `[J1, J3]` | 1 | Seviye 7 | İki Makas (3 Hedef: R, G, Y) |
| `[J3]` | 1 | Seviye 8 | Tek Makas (2 Hedef: G, Y) |
| **`[J1, J2, J3]`** | **22** | **Seviye 9 – 30** | **Tüm Ağaç Aktif (4 Hedef: R, B, G, Y)** |

*Not: 10 Classic GDD seviyesinin tamamı da `[J1, J2, J3]` kullanmaktadır. Projedeki toplam 40 senaryonun **32'si (%80.0)** tamamen aynı makas kümesini kullanmaktadır.*

### 3.2 Seviye Parametreleri Matrisi
```
Bölge 1: Suburb (1-6)          ──► J2 ve J1 öğretilir. 1 araç, 850-1000ms tick, seyrek doğuş (4-5 tick).
Bölge 2: Downtown (7-12)        ──► Seviye 9'dan itibaren 3 makas açılır. 2 araç, 800-850ms tick.
Bölge 3: Industrial (13-18)     ──► 3 makas sabit. Araç sayısı 3'e çıkar, tick 750ms'ye iner.
Bölge 4: Harbor (19-24)         ──► 3 makas sabit. Araç sayısı 3, tick 700ms, doğuş 2 tick.
Bölge 5: Night Express (25-30)  ──► 3 makas sabit. Hata limiti 2'ye düşer, 700ms tick, 12 araca kadar uzayan seri.
```

### 3.3 Kaç Seviye Gerçekte Aynı Karar Yapısını Kullanıyor?
- **Gerçek Farklı Karar Yapısı Sayısı: Yalnızca 5 Tip**
  1. Tip A: Tek makas Sol (`J2`) — Seviye 1-3 (3 seviye)
  2. Tip B: Tek makas Ana (`J1`) — Seviye 4-5 (2 seviye)
  3. Tip C: Ana + Sol (`J1 + J2`) — Seviye 6 (1 seviye)
  4. Tip D: Ana + Sağ (`J1 + J3`) — Seviye 7 (1 seviye)
  5. Tip E: Tek makas Sağ (`J3`) — Seviye 8 (1 seviye)
- **Kalan 22 Seviye (Seviye 9'dan 30'a kadar): Tamamen Özdeş Karar Yapısı.**  
  Bu seviyelerde oyuncunun zihinsel modeli hiçbir şekilde değişmemektedir:
  - Gelen araç Kırmızı ise: `J1=LEFT`, `J2=RED`
  - Gelen araç Mavi ise: `J1=LEFT`, `J2=BLUE`
  - Gelen araç Yeşil ise: `J1=RIGHT`, `J3=GREEN`
  - Gelen araç Sarı ise: `J1=RIGHT`, `J3=YELLOW`

Bu tespit, oyuncunun *"Bölümler birbirinin kopyası"* hissini bütünüyle doğrulamaktadır.

---

## 4. Makas Kilitlenmesi ve "Yetişememe" Analizi (Refleks vs. Bulmaca)

### 4.1 Kilit Mantığı (`isJunctionLocked`)
`SwitchNetwork.ts` satır 163-167:
```typescript
public isJunctionLocked(junction: JunctionId): boolean {
  return this.vehicles.some(
    (v) => v.state === 'MOVING' && v.toNode === junction
  );
}
```
Bir araç `toNode = J` yönünde seyir halindeyken (`state === 'MOVING'`), o makasa dokunulamaz.

### 4.2 Kilitlenmenin Neden Olduğu Çıkmazlar (Frustration Loop)
1. **Seyir Halinde Giriş Engeli (Transit Lockout):**
   Araç $A$, `SOURCE` düğümünden `J1`'e doğru hareket ederken (1 tick boyunca), `J1` kilitlidir. Oyuncu $A$ aracının nereye gitmesi gerektiğini önceden görse bile `J1`'i değiştiremez!
2. **Kuyruk Tıkanması (Tailgating Collision of Intent):**
   - 700 ms tick ve 2-tick doğuş periyodunda, rayda ardışık iki araç varken:
   - Araç 1, `J1`'den `J2`'ye geçerken `J1` serbest kalır, ancak hemen o anda Araç 2 `SOURCE`'tan `J1`'e doğru hareket etmeye başlar.
   - Araç 2 `J1`'e doğru hareket ettiği için `J1` **tekrar kilitlenir!**
   - Oyuncunun `J1`'i değiştirebileceği zaman aralığı 0 ile 1 tick arasına (yaklaşık 200–400 ms) sıkışır.
3. **Sonuç:**
   Oyuncu ne yapacağını bilmektedir (bulmaca çözülmüştür), ancak kilit mekanizması ve hız baskısı nedeniyle fiziksel olarak butona basamamaktadır. Bu durum **"Düşünme Eğlencesi"** değil, **"Yetersiz Input Toleransı Hüsranı"** yaratır.

---

## 5. Simülasyonun Genelleştirilebilir ve Yeniden Tasarlanacak Parçaları

| Simülasyon Bileşeni | Durum | Açıklama |
| :--- | :---: | :--- |
| **4 Fazlı Tick Döngüsü** | **Genelleştirilebilir** | Varış $\to$ Ayrılış $\to$ Doğuş $\to$ Kazanma/Kaybetme sıralaması her türlü yönlendirilmiş çizgede (DAG) geçerlidir. |
| **Kenar Mandallama (Latched Edge)** | **Genelleştirilebilir** | Araç ayrıldığı anda rotasını sabitleyen `{fromNode, toNode}` mantığı mükemmel çalışmaktadır ve korunmalıdır. |
| **Araç Durum Makinesi** | **Genelleştirilebilir** | `SPAWNED` $\to$ `MOVING` $\to$ `WAITING` $\to$ `DELIVERED` döngüsü sağlamdır. |
| **İstasyon Yutucu (Sink) Davranışı** | **Genelleştirilebilir** | İstasyonların kapasite sınırı olmaksızın araçları emmesi ve puanlaması korunabilir. |
| **Sabit `j1, j2, j3` Değişkenleri** | **Yeniden Tasarlanmalı** | `Map<string, JunctionState>` veya `JunctionComponent[]` yapısına geçirilmelidir. |
| **Statik `nodeOrder` Tablosu** | **Yeniden Tasarlanmalı** | Çizge üzerindeki düğümler için dinamik **Topolojik Sıralama (Topological Sort / Kahn's Algorithm)** ile düğüm önceliği otomatik hesaplanmalıdır. |
| **İkili Ayrılış Mantığı (`LEFT`/`RIGHT`)** | **Yeniden Tasarlanmalı** | Çoklu çıkış indeksleri (`outputIndex: 0, 1, 2`) veya hedef etiketleri desteklenmelidir. |
| **Kilit Kuralı (`isJunctionLocked`)** | **Yeniden Tasarlanmalı** | Makasın tamamen kilitlenmesi yerine, **"Sıradaki Rota Ön-Ayarı (Buffered / Queued Toggle)"** eklenmelidir. Araç geçerken dokunulursa, makas araç geçer geçmez otomatik dönmelidir. |

---

## 6. JSON ile Tanımlanan Çizge (Graph) Mimarisi Değerlendirmesi

Sabit ikili ağaç yerine, düğüm ve kenarların JSON dosyasında tanımlandığı topoloji-agnostik bir mimari tamamen uygulanabilirdir.

### 6.1 Örnek Genel Topoloji JSON Şeması (`topology.json`)
```json
{
  "topologyId": "bypass_loop_v1",
  "name": "Sollama ve Bekleme Cebi",
  "nodes": [
    { "id": "SRC", "type": "SOURCE", "position": { "x": 270, "y": 100 } },
    { "id": "SW1", "type": "SWITCH", "position": { "x": 270, "y": 250 }, "switchType": "TOGGLE_2_WAY", "initialState": 0 },
    { "id": "BAY_1", "type": "SIDING", "position": { "x": 140, "y": 380 }, "capacity": 1 },
    { "id": "SW2", "type": "SWITCH", "position": { "x": 270, "y": 500 }, "switchType": "MERGE" },
    { "id": "SW3", "type": "SWITCH", "position": { "x": 270, "y": 620 }, "switchType": "TOGGLE_2_WAY", "initialState": 0 },
    { "id": "ST_RED", "type": "STATION", "color": "RED", "position": { "x": 160, "y": 750 } },
    { "id": "ST_BLUE", "type": "STATION", "color": "BLUE", "position": { "x": 380, "y": 750 } }
  ],
  "edges": [
    { "id": "e1", "from": "SRC", "to": "SW1", "lengthTicks": 1 },
    { "id": "e_siding_in", "from": "SW1", "to": "BAY_1", "branchIndex": 0, "lengthTicks": 1 },
    { "id": "e_main_down", "from": "SW1", "to": "SW2", "branchIndex": 1, "lengthTicks": 2 },
    { "id": "e_siding_out", "from": "BAY_1", "to": "SW2", "lengthTicks": 1 },
    { "id": "e_to_sw3", "from": "SW2", "to": "SW3", "lengthTicks": 1 },
    { "id": "e_red", "from": "SW3", "to": "ST_RED", "branchIndex": 0, "lengthTicks": 1 },
    { "id": "e_blue", "from": "SW3", "to": "ST_BLUE", "branchIndex": 1, "lengthTicks": 1 }
  ]
}
```

### 6.2 Dinamik Simülasyon Çekirdeği Nasıl Çalışır?
- **Ayrılış Rotaları:** Araç `SW1` düğümünde iken, `SW1`'in mevcut `branchIndex` değerine eşleşen çıkış kenarı (`edge.from === 'SW1' && edge.branchIndex === activeIndex`) bulunur.
- **Topolojik Ayrılış Sıralaması:** Çizgenin çıkış düğümlerinden (İstasyonlar) giriş düğümlerine (Kaynaklar) doğru BFS/DFS ile `rank` atanır; yüksek dereceli (downstream) düğümler önce boşaltılır.

---

## 7. Refleks Baskısı Yaratmayan Üç Yeni Ray Topolojisi Önerisi

Aşağıdaki topolojiler hızı artırmadan **karar derinliğini** ve **bulmaca kalitesini** yükseltir:

### 7.1 Topoloji 1: "Sollama ve Park Cebi" (The Siding & Bypass Loop)
```
         [ SOURCE ]
             │
             ▼
          [ SW1 ] ──────── (Park Cebi / Siding)
             │                      │
             │ (Ana Hat: 2 tick)    ▼
             │                  [ SW_RELEASE ] ──► (Oyuncu dokununca çıkar)
             ▼                      │
          [ SW2: MERGE ] ◄──────────┘
             │
             ▼
      [ Hedef İstasyonlar ]
```
- **Mekanik:** Hatta bir park cebi (`Siding`) bulunur. Gelen araç buraya yönlendirilirse, oyuncu serbest bırakma sinyaline (`SW_RELEASE`) basana kadar orada bekler.
- **Zihinsel Karar (Refleks Değil Strateji):**
  Manifesto `[Kırmızı, Mavi]` sırasıyla gelir, ancak istasyon önünde Mavi'nin önce geçmesi gerekmektedir. Oyuncu Kırmızı'yı cebe çeker, Mavi'nin ana hattan geçişini izler, ardından Kırmızı'yı serbest bırakır.
- **Refleks Baskısı:** Sıfır. Araç cepte sakince bekler; oyuncu zaman kısıtı olmadan planlama yapar.

---

### 7.2 Topoloji 2: "Çift Kaynak ve Zamanlama Çakışması" (Dual-Source Convergence)
```
   [ HUB KUZEY ]                 [ HUB GÜNEY ]
         │                             │
         ▼                             ▼
    [ KUZEY MAKAS ]              [ GÜNEY MAKAS ]
         │                             │
         └──────────► [ MERGE ] ◄──────┘
                         │
                   (Ortak Koridor)
                         │
                         ▼
                [ DAĞITIM MAKASI ]
                  ┌──────┴──────┐
                  ▼             ▼
              [ MAVİ ]      [ SARI ]
```
- **Mekanik:** Trenler tek bir merkezden değil, iki farklı çıkış deposundan gelir. İki hat tek bir boğazda (`Merge`) birleşir.
- **Zihinsel Karar:**
  Aynı anda iki depodan araç çıkarsa ortak koridorda kimin önce geçeceğini planlamak gerekir. Hangi aracın önce çıkacağını tetikleyen "Kalkış İzin Butonları" (Departure Gate) oyuncunun kontrolündedir.
- **Refleks Baskısı:** Oyuncu trenlerin kalkış anını kendisi seçtiği için refleks yarışı yoktur; lojistik planlama vardır.

---

### 7.3 Topoloji 3: "Dönel Kavşak / Dairesel Hat" (The Ring Roundabout)
```
                [ SOURCE ]
                    │
                    ▼
           ┌───► [ KAVŞAK ] ───┐
           │        ▲          │
           │        │          ▼
        [ BATI ]    │       [ DOĞU ]
           ▲        │          │
           │        ▼          │
           └─── [ GÜNEY ] ◄────┘
                  │   │
                  ▼   ▼
               [ İSTASYONLAR ]
```
- **Mekanik:** Hatalı makas ayarı durumunda araç doğrudan yanlış istasyona çarpmaz. Dairesel kavşakta bir tur daha atar (Loop penalty).
- **Zihinsel Karar:**
  Oyuncu kaçırdığı bir treni kurtarmak için onu dönel kavşakta tur attırırken, yeni gelen treni araya sıkıştırmadan geçirmeye çalışır (Orbit Insertion).
- **Refleks Baskısı:** Hata anında doğrudan oyun bitmez (`Fail-Safe`). Oyuncuya hatasını telafi etmesi için ikinci bir şans döngüsü verilir.

---

## 8. Classic Sürümünü Bozmadan Geçiş Mimarisi (Geriye Dönük Uyumluluk)

Mevcut çalışan Classic ve Switch Rush 2.0 seviyeleri sıfır regresyon riskiyle korunmalıdır.

### 8.1 Adapter & Strategy Deseni
```
                 ┌─────────────────────────────┐
                 │     ISwitchNetworkCore      │
                 └──────────────▲──────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        │                                               │
┌───────────────────────────┐             ┌───────────────────────────┐
│   ClassicSwitchNetwork    │             │    GraphSwitchNetwork     │
│ (Mevcut Sabit 3-Makas)    │             │  (Yeni JSON Topolojisi)   │
│ - 100% Geriye Dönük Uyumlu│             │ - Keyfi Çizgeler (DAG)    │
│ - Tüm testler aynen geçer │             │ - Bypass, Siding, Merge   │
└───────────────────────────┘             └───────────────────────────┘
```

1. **Aşama 1 (Korumalı Çekirdek):** Mevcut [`SwitchNetwork.ts`](file:///f:/Caravan/src/core/switch/SwitchNetwork.ts) ve [`SwitchLevels.ts`](file:///f:/Caravan/src/core/switch/SwitchLevels.ts) dosyalarına dokunulmaz. Mevcut 30 vitest testi yeşil kalır.
2. **Aşama 2 (Yeni Modül):** `src/core/switch/graph/` altında `GraphSwitchNetwork.ts` ve `GraphTypes.ts` geliştirilir.
3. **Aşama 3 (Topoloji Kütüphanesi):**
   - `levels/switch_rush/topologies/classic_tree.json` (Mevcut yapının JSON çizge tanımı).
   - `levels/switch_rush/topologies/siding_loop.json`
   - `levels/switch_rush/topologies/roundabout.json`
4. **Doğrulama:** `classic_tree.json` topolojisi `GraphSwitchNetwork` ile çalıştırıldığında, mevcut `FIXED_SCENARIOS` ile %100 birebir aynı sonuçları verdiği otomatik entegrasyon testleriyle kanıtlanır.

---

## 9. Yeni Seviyelerin Gerçekten Farklı Kararlar Gerektirdiğini Otomatik Ölçme Yöntemleri

Gelecekte eklenecek seviyelerin yine birbirinin kopyası olmasını engellemek için CI/CD hattına eklenebilecek 4 matematiksel metrik:

### 9.1 Karar Alanı Entropisi (Decision Entropy - $H_d$)
Bir seviyedeki makas kararlarının çeşitliliği Shannon Entropisi ile ölçülür:
$$H_d = -\sum_{i=1}^{M} p_i \log_2(p_i)$$
- Eğer oyuncu tüm seviye boyunca sadece $J_1$ ve $J_2$'yi eşit periyotla değiştiriyorsa entropi düşüktür.
- **Kabul Kriteri:** $H_d \ge 1.8$ bit olmalıdır.

### 9.2 Karar Gevşekliği / Düşünme Penceresi (Decision Slack Time)
Her makas değişimi için oyuncunun sahip olduğu minimum ve ortalama zaman penceresi:
$$T_{\text{slack}} = T_{\text{arrival}} - T_{\text{earliest\_visible}}$$
- $T_{\text{slack}} < 500\text{ ms}$ ise seviye **"Refleks/Twitch Tuzağı"** olarak işaretlenir ve reddedilir.
- $T_{\text{slack}} \ge 1500\text{ ms}$ ise seviye **"Stratejik Bulmaca"** sınıfına girer.

### 9.3 Rota Çeşitliliği Oranı (Path Uniqueness Factor - $U_p$)
Topolojideki farklı kaynak-hedef yollarının sayısı:
$$U_p = \frac{\text{Toplam Geçerli Alternatif Rota Sayısı}}{\text{Hedef İstasyon Sayısı}}$$
- Mevcut ikili ağaçta her istasyona giden rota sayısı kesinlikle $1$'dir ($U_p = 1.0$, alternatif rota sıfırdır).
- Siding ve Roundabout topolojilerinde $U_p \ge 2.0$ olmalıdır.

### 9.4 Çözücü İz Ayrışması (Solver Action Distance - Levenshtein Metric)
`SwitchSolver` tarafından üretilen en uygun hamle dizileri (Action Trace) seviyeler arasında karşılaştırılır:
$$\text{Distance}(L_A, L_B) = \text{Normalized Levenshtein}(\text{Trace}_A, \text{Trace}_B)$$
- İki farklı seviyenin hamle dizileri benzerlik oranı $\%70$'in üzerindeyse, seviye **"Kopya Seviye"** olarak işaretlenir.

---

## 10. Teknik Riskler ve Önerilen Uygulama Sırası

### 10.1 Teknik Riskler
1. **Döngüsel Raylarda Sonsuz Döngü / Kilitlenme Riski:**
   Dönel kavşaklarda araçların sonsuza kadar dönmesi veya iki aracın birbirini bloke etmesi riski.
   *Önlem:* Her araç için maksimum tur sayacı (`maxLaps = 3`) ve deadlock algılayıcı kural eklenmelidir.
2. **Ray Enterpolasyonu ve Görsel Eğriler (Spline Complexity):**
   3D Diorama'da karmaşık kavşakların görsel olarak çakışması.
   *Önlem:* Ray yükseklikleri (köprü ve alt geçit mantığı / Y-offset) topoloji JSON'una `elevationLayer` olarak eklenmelidir.

### 10.2 Önerilen Uygulama Sırası
1. **Adım 1:** `GraphTypes.ts` ve genel çizge veri şemasının tanımlanması.
2. **Adım 2:** `classic_tree.json` topolojisinin çıkarılması ve `GraphSwitchNetwork` prototipinin yazılması.
3. **Adım 3:** Mevcut 10 Classic seviyenin yeni çizge çekirdeğinde çalıştırılarak vitest ile regresyon doğrulaması yapılması.
4. **Adım 4:** "Siding / Bekleme Cebi" prototip topolojisinin ve 3 adet bulmaca odaklı deneysel seviyenin kodlanması.
5. **Adım 5:** Otomatik Karar Çeşitliliği Metriklerinin (Bölüm 9) test komutuna (`npm run audit:diversity`) bağlanması.
6. **Adım 6:** Unity 6 URP 3D Diorama mimarisine geçişin bu genel çizge yapısı üzerinden başlatılması.

---

### Denetim Sonuç Bildirimi
Mevcut kod tabanı korunmuş, hiçbir dosya değiştirilmemiş veya bozulmamıştır. Denetim bulguları ve mimari yol haritası bu raporda kayıt altına alınmıştır.
