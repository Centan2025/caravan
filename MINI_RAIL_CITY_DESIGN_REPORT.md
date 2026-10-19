# MINI RAIL CITY — YENİ SANAT YÖNÜ VE SAHNE MİMARİSİ RAPORU

**Tarih:** 19 Ekim 2026  
**Durum:** Tasarım ve 3 Örnek Sahne Hazır (Onay Bekleniyor)  
**Sanat Yönü:** MINI RAIL CITY — Premium Casual Railway Diorama  
**İnceleme Sayfası:** [`mini_rail_city_review.html`](file:///f:/Caravan/mini_rail_city_review.html)

---

## 1. Yönetici Özeti ve Tasarım Reset Gerekçesi

Eski Switch Rush Siding arayüzü, siyah/koyu bir teknik devre şeması görünümündeydi; ekranın çoğunu boş bırakan dikey bir akış diyagramı hissi uyandırıyordu.

Bu doğrultuda **Mini Rail City** ile oyun dünyası tamamen yeniden inşa edildi:
- **Oyuncak Tren Estetiği:** Parlak gövdeli, metalik tavanlı, geometrik kargo sembollü vagonlar.
- **Kompakt Demiryolu Maketi (Diorama):** Sıcak ahşap çerçeveli, yükselti terasları içeren masaüstü maket tahtası.
- **Pastel & Sıcak Renkler:** Koyu teknik arka plan terk edildi; kır yeşili, liman parke taşı ve kanyon terracottası baz alındı.
- **Gerçek Fiziksel Ray Ayrımı & Döner Makas Feneri:** Ray üzerine yazılan teknik etiketler yerine, kavşağın hemen yanında 56px dokunmatik alana sahip, kilit durumunu `🔒` ile gösteren mekanik yön feneri konumlandırıldı.
- **Minyatür Binalar:** Ray sonunda kırmızı kiremitli ve mavi çatılı 2.5D istasyon depoları, kargo hangarı ve yükleme platformları.
- **Sade Modern Casual HUD:** Beyaz yuvarlatılmış hap kartlar, kalp can göstergeleri (`❤️❤️`) ve kargo rozetleri.

---

## 2. Üç Farklı Sahne Tasarımı (Faz 3)

| Örnek Sahne | Seviye & Topoloji | Mekânsal Düzen & Çevre | Görsel Karakter | Önizleme (PNG) |
|---|---|---|---|---|
| **A. Çayır & Vadi İstasyonu** | **Seviye 101** (`siding_topology_l1`) | Sol park cebi tatlı bir S-kavisle ana hattan ayrılır. Sağ tarafta minyatür gölet ve ahşap çit bulunur. | Pastoral Kır Yeşili (`#88c070`), ahşap traversler, minyatür çam ve yuvarlak ağaçlar. | [540x960_lvl_101.png](file:///f:/Caravan/screenshots/minirail/540x960_native_lvl_101_meadow.png) <br> [390x844_iphone.png](file:///f:/Caravan/screenshots/minirail/390x844_iphone_lvl_101_meadow.png) |
| **B. Lojistik Dağıtım Garı** | **Seviye 104 Dual** (`siding_topology_l104_dual`) | İki bağımsız park cebi: Sol-Kuzey (Peron A) ve Sağ-Güney (Peron B) kademeli yerleşir. 4 trenlik çift sollama koridoru. | Liman & Antrepo (`#d3c6b2`), kargo konteynerleri, sarı yükleme vinci, antrepo deposu. | [540x960_lvl_104.png](file:///f:/Caravan/screenshots/minirail/540x960_native_lvl_104_logistics_dual.png) <br> [390x844_iphone.png](file:///f:/Caravan/screenshots/minirail/390x844_iphone_lvl_104_logistics_dual.png) |
| **C. Maden & Kanyon Garı** | **Seviye 103-B FIFO** (`siding_topology_l103_fifo`) | Ana hat merkezdeki kanyon kayasının etrafından sağa kavis çizer. Solda 2 vagonluk uzun FIFO platformu uzanır. | Terracotta Kanyon (`#e0a96d`), kaya blokları, 2 duraklı (#1 & #2) uzun maden iskelesi. | [540x960_lvl_1032.png](file:///f:/Caravan/screenshots/minirail/540x960_native_lvl_103b_quarry_fifo.png) <br> [390x844_iphone.png](file:///f:/Caravan/screenshots/minirail/390x844_iphone_lvl_103b_quarry_fifo.png) |

---

## 3. Yeni Sahne Mimarisi (Faz 2)

Yeni diorama sistemi iki bağımsız modülden oluşur:

1. **[`MiniRailDioramaLayouts.ts`](file:///f:/Caravan/src/core/switch/graph/MiniRailDioramaLayouts.ts):**
   - Saf sunum katmanı: Her seviyenin diorama temasını (yerleşim, zemin tonu, travers rengi, çevre objeleri) ve kavisli bezier ray yolu noktalarını tanımlar.
   - `GraphTopologyDef` ile %100 uyumludur.

2. **[`MiniRailCityScene.ts`](file:///f:/Caravan/src/games/MiniRailCityScene.ts):**
   - Yeni Phaser sahnesi. Mevcut `SidingRushScene` ve `SwitchRushScene`'e dokunulmadan bağımsız olarak eklendi.
   - `GraphSwitchNetwork` motorunu çalıştırır, trenleri kavisli raylar üzerinde yumuşak tweening ile hareket ettirir.
   - Makaslara dokunulduğunda yaylanma ve mekanik tıkırtı sesi verir.

---

## 4. Çizge (Graph) — Görsel Yerleşim Eşleme Matrisi

| Mantıksal Çizge Düğümü | Seviye 101 Görsel Karşılığı | Seviye 104 Dual Görsel Karşılığı | Seviye 103-B FIFO Görsel Karşılığı |
|---|---|---|---|
| `SOURCE` | Kargo Depo Girişi (`x: 270, y: 110`) | Liman Kargo Girişi (`x: 270, y: 100`) | Maden Ocağı Tüneli (`x: 270, y: 100`) |
| `SW_SIDING` / `SW_SIDING_A` | Giriş Makası Feneri (`x: 270, y: 230`) | Makas A Feneri (`x: 270, y: 180`) | Maden Ayrımı Feneri (`x: 270, y: 210`) |
| `SIDING_BAY` / `SIDING_A` | Sol Park Peronu (`x: 130, y: 380`, Kapasite: 1) | Kuzey Peron A (`x: 125, y: 270`, Kapasite: 1) | 2x FIFO İskelesi (`x: 130, y: 370`, Kapasite: 2) |
| `MERGE` / `MERGE_A` | Birleşme Kavşağı (`x: 270, y: 530`) | Kavşak A (`x: 270, y: 355`) | Ana Hat Birleşimi (`x: 270, y: 530`) |
| `SW_SIDING_B` | — | Makas B Feneri (`x: 270, y: 440`) | — |
| `SIDING_B` | — | Güney Peron B (`x: 415, y: 530`, Kapasite: 1) | — |
| `MERGE_B` | — | Kavşak B (`x: 270, y: 615`) | — |
| `SW_STATION` | İstasyon Makası (`x: 270, y: 640`) | Terminal Makası (`x: 270, y: 685`) | Dağıtım Makası (`x: 270, y: 640`) |
| `RED` (İstasyon) | Kırmızı Kır Garı (`x: 160, y: 750`) | Kırmızı Antrepo (`x: 160, y: 755`) | Kızıl Maden Deposu (`x: 160, y: 750`) |
| `BLUE` (İstasyon) | Mavi Vadi Garı (`x: 380, y: 750`) | Mavi Antrepo (`x: 380, y: 755`) | Gök Cevher Terminali (`x: 380, y: 750`) |

---

## 5. Doğrulama ve Test Sonuçları

- **Ekran Önizlemeleri:** 3 farklı mobil ve yerel çözünürlükte (`540×960`, `390×844`, `360×800`) 9 adet PNG ekran görüntüsü alındı.
- **Karşılaştırma Sayfası:** [mini_rail_city_review.html](file:///f:/Caravan/mini_rail_city_review.html) oluşturuldu.
- **Birim & Entegrasyon Testleri:** `npm test` $\rightarrow$ **69 / 69 passed** (0 regresyon).
- **TypeScript & Build:** `npx tsc --noEmit` ve `npm run build` $\rightarrow$ **0 hata / temiz derleme**.
- **Mevcut Modlar:** Classic (10 senaryo), Switch Rush 2.0 (30 seviye), SidingRushScene ve Chain Domino modları tamamen korundu.
