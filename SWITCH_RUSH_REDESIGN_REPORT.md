# SWITCH RUSH — HİBRİT GÖRSEL YENİDEN TASARIM RAPORU

**Tarih:** 19 Ekim 2026  
**Durum:** Tamamlandı / Doğrulandı (69/69 Test Başarılı, Build Hatasız)  
**Tasarım Kararı:** Alternatif A (Yüksek Okunabilirlik & Dokunmatik Ergonomi) + Alternatif B (2.5D Minyatür Demiryolu Estetiği)

---

## 1. Yürütme Özeti ve Tasarım İlkesi

Önceki görsel denetimde (`SWITCH_RUSH_VISUAL_AUDIT.md`) tespit edilen P0 seviyesindeki görsel çakışmalar, hat üst üste binmeleri ve mobil ekran taşmaları giderildi. 

- **Alternatif A Temeli:** 48px dokunmatik hedef standardı, dikey hiyerarşi, net kargo rozetleri ve HUD/ipucu ayrımı korundu.
- **Alternatif B Estetiği:** Balast çakıl yatağı, ahşap traversler, çift paralel çelik raylar, 2.5D kabartmalı vagonlar ve peron çizgileri eklendi.
- **Mimari İzolasyon:** Görsel koordinat üretimi oyun mantığından tamamen ayrılarak [`GraphLayoutEngine.ts`](file:///f:/Caravan/src/core/switch/graph/GraphLayoutEngine.ts) sınıfına taşındı. `GraphSwitchNetwork` deterministik simülasyonu, tick döngüsü ve hız parametreleri hiçbir şekilde değiştirilmedi.

---

## 2. Düzeltilen Kritik Hatalar (Faz 1 & 2)

| Hata / Madde | Önceki Durum | Düzeltilmiş Hibrit Durum | Doğrulama Ekranı |
|---|---|---|---|
| **Level 104 İstasyon / Buton Çakışması** | İstasyonlar `y=860`'ta çiziliyor; Duraklat/Yeniden Başlat butonlarıyla fiziksel olarak çakışıyordu. | `GraphLayoutEngine` ile dikey alan `[90..740]` aralığına sıkıştırıldı. İstasyonlar `y=740`'a çekildi; ipucu metnine 65px, butonlara 140px güvenlik payı bırakıldı. | [540x960_native_lvl_104.png](file:///f:/Caravan/screenshots/redesign/540x960_native_lvl_104.png) |
| **Level 103 & 103-B Eşdoğrusal Ray Hatası** | Park cebi ve ana hat aynı `x=270` dikey hattı üzerindeydi; park cebi ana hattı örtüyordu. | Park cebi sol tarafa (`x=125`) bir by-pass döngüsü olarak ayrıldı; ana hat düz `x=270`'te kaldı. FIFO için `#1` ve `#2` park durakları çizildi. | [540x960_native_lvl_1032.png](file:///f:/Caravan/screenshots/redesign/540x960_native_lvl_1032.png) |
| **Dokunmatik Hedef Boyutları** | Makas butonları 24–32px boyutundaydı; yanlış dokunma riski yüksekti. | Makas kapsülleri **88×52 px**, Park Bırak (SAL) butonu **124×48 px** yapıldı (Apple HIG >= 44px, Material >= 48px standardı sağlandı). | Tüm seviyeler |
| **Mobil Başlık Taşması** | `index.html` menüsü mobilde ~230px yer kaplıyor, Phaser canvas'ını ekran altına itiyordu. | Mobil `@media` sorgusu eklendi; başlık dikeyde 52px'e indirildi, mod butonları kompakt yatay çubuğa dönüştürüldü. | [390x844_iphone_lvl_104.png](file:///f:/Caravan/screenshots/redesign/390x844_iphone_lvl_104.png) |
| **HUD & İpucu Karışıklığı** | Bölüm açıklamaları oyun sahasının ortasında rayların üstüne biniyordu. | Üst HUD 48px yüksekliğinde tek satırda toplandı (Teslimat, Hata, Sıradaki Kargo). İpuçları ray sahasının altına (`y=805`) taşındı. | Tüm seviyeler |

---

## 3. Hibrit Görsel Dil ve 2.5D Ray Detayları (Faz 3 & 4)

1. **Ray Geometrisi:**
   - **Balast Yatağı:** Rayların altında 24px genişliğinde koyu granit yatak (`0x161c28`).
   - **Ahşap Traversler:** Her 18 pikselde bir yerleştirilen 22×4 px ahşap traversler (`0x422d1b`).
   - **Çift Çelik Ray:** 14px ray aralığıyla çizilen çift paralel gümüş çelik hat (`0x64748b` ve `0x94a3b8`).
2. **2.5D Vagonlar ve Kargo:**
   - Yumuşak gölge efekti (offset: +3px, alfa: 0.45).
   - Metalik tavan çerçevesi ve parıltı çizgisi.
   - Vagon üzerinde yüksek kontrastlı geometrik hedef sembolleri:
     - Kırmızı: Kare (`■ R`)
     - Mavi: Daire (`● B`)
     - Yeşil: Üçgen (`▲ G`)
     - Sarı: Baklava (`◆ Y`)
3. **Park Cepleri (Siding):**
   - Beton/ahşap peron zemin kaplaması ve sarı ikaz çizgisi.
   - Çoklu kapasite durumunda (FIFO) ayrılmış durak alanları (`#1`, `#2`).
   - Cep sonunda tampon takozu (buffer stop).
4. **Aktif Rota ve Makas Kontrolleri:**
   - Makasın o an yöneldiği rota, ray üzerinde yaklaşan vagonun hedef rengine uygun neon bir tel (wire preview) olarak aydınlatılır.
   - Kilitli makaslar `🔒` kırmızı kapsül ile, tamponlanan makaslar `🟢` zümrüt çerçeve ile anında görsel geribildirim verir.

---

## 4. Çoklu Çözünürlük ve Ekran Doğrulaması (Faz 5)

Aşağıdaki ekran görüntüleri Chromium/Edge tabanlı otomatik test aracıyla (`scripts/verify_visual_redesign.ts`) alınmış ve doğrulanmıştır:

| Görünüm / Cihaz | Çözünürlük | Seviye 101 | Seviye 103-B FIFO | Seviye 104 Dual |
|---|---|---|---|---|
| **Phaser Yerel** | `540×960` | [lvl_101.png](file:///f:/Caravan/screenshots/redesign/540x960_native_lvl_101.png) | [lvl_1032.png](file:///f:/Caravan/screenshots/redesign/540x960_native_lvl_1032.png) | [lvl_104.png](file:///f:/Caravan/screenshots/redesign/540x960_native_lvl_104.png) |
| **iPhone 14** | `390×844` | [iphone_101.png](file:///f:/Caravan/screenshots/redesign/390x844_iphone_lvl_101.png) | [iphone_1032.png](file:///f:/Caravan/screenshots/redesign/390x844_iphone_lvl_1032.png) | [iphone_104.png](file:///f:/Caravan/screenshots/redesign/390x844_iphone_lvl_104.png) |
| **Android Standardı** | `360×800` | [android_101.png](file:///f:/Caravan/screenshots/redesign/360x800_android_lvl_101.png) | [android_1032.png](file:///f:/Caravan/screenshots/redesign/360x800_android_lvl_1032.png) | [android_104.png](file:///f:/Caravan/screenshots/redesign/360x800_android_lvl_104.png) |

---

## 5. Regresyon ve Otomasyon Test Sonuçları

```
 RUN  v5.0.5 F:/Caravan

 ✓ tests/telemetry.test.ts (5 tests)
 ✓ tests/smoke.test.ts (4 tests)
 ✓ tests/switch.test.ts (13 tests)
 ✓ tests/chain.test.ts (8 tests)
 ✓ tests/siding.test.ts (8 tests)
 ✓ tests/playtest.test.ts (10 tests)
 ✓ tests/graph_switch_equivalence.test.ts (7 tests)
 ✓ tests/siding_diversity_correction.test.ts (11 tests)
 ✓ tests/siding_qa_metrics.test.ts (3 tests)

 Test Files  9 passed (9)
      Tests  69 passed (69)
```

- **Classic Modu:** Bozulmadı, 10 klasik senaryo korunuyor.
- **Progressive Modu (Switch Rush 2.0):** 30 seviyenin tamamı çalışıyor.
- **Chain Domino:** Tamamen korundu.
- **Production Build:** `tsc && vite build` 0 uyarı/hata ile tamamlandı.
