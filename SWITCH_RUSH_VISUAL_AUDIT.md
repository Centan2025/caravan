# SWITCH RUSH — VISUAL GAMEPLAY AUDIT & ERGONOMICS REPORT

**Tarih:** 19 Ekim 2026  
**Denetlenen Mod:** Switch Rush — Siding (Park Cebi) Prototipi  
**Hedef Platform:** Mobil Dokunmatik Ekranlar (iOS / Android) & Web Tarayıcı  
**Durum:** 69 Unit Test Başarılı — Görsel İnceleme ve Tasarım Raporu  

---

## 1. YÖNETİCİ ÖZETİ VE DOĞRULAMA BULGULARI

Mevcut 7 Siding seviyesi headless Microsoft Edge ortamında (540×960 @ 2x DPI) taranmış, ekran görüntüleri alınmış ve hem piksel bazında hem de grafik topolojisi açısından denetlenmiştir. 

Oyuncu geri bildirimleri ve kaynak kod analizi sonucunda **üçü kritik, beşi yüksek öncelikli** görsel/ergonomik kusur doğrulanmıştır:

| No | Tespit Edilen Problem | Şiddet | Etkilenen Seviyeler | Temel Neden |
|---|---|---|---|---|
| **1** | **İstasyon ve Buton Çakışması (Overlap)** | 🔴 Kritik | Seviye 104 (Dual Siding) | 10 düğümün dikeyde üst üste yığılması sonucu istasyonlar `y=860`'a inerek `y=885`'teki Duraklat/Çıkış butonlarının üzerine binmektedir. |
| **2** | **Görünmeyen Park Cebi (Colinear Ray Çakışması)** | 🔴 Kritik | Seviye 103 & 103-B (FIFO) | `SW_SIDING`, `SIDING_BAY` ve `MERGE` düğümlerinin üçü de `x=270`'tedir. Ana hat ile park cebi tam üst üste çizildiği için oyuncu tek bir dikey çubuk görmektedir; park ayrımı ve bypass görünmemektedir. |
| **3** | **Okunamayan Dokunmatik Makas Metinleri** | 🔴 Kritik | Tüm Seviyeler (101–105) | Makas düğmelerindeki durum yazıları 8px–9px fontla çizilmektedir. Mobilde efektif boyut ~4.5px'e düşerek tamamen okunaksızlaşmaktadır. |
| **4** | **Tekdüze Dikey Omurga (Uzun ve Dar Tahta)** | 🟡 Yüksek | Seviye 101, 102, 105 | 540px genişliğindeki tuvalin yalnızca orta 200px'i kullanılmakta, yanlardaki %60'lık alan siyah boşluk kalmaktadır. Seviyeler birbirinden farksız dikey sütunlar gibi algılanmaktadır. |
| **5** | **Cyan (Camgöbeği) Aktif Rota İllüzyonu** | 🟡 Yüksek | Tüm Seviyeler | Aktif rota, gelen tren Kırmızı (`#e63946`) olsa dahi her zaman Cyan (`#48cae4`) çizilmektedir. Bu durum oyuncuda rota renginin Mavi istasyonla eşleştiği yanılsamasını yaratmaktadır. |
| **6** | **Mobil Başlık / Menü İsrafı (230px Dikey Yük)** | 🟡 Yüksek | Mobil Ekran Düzeni | 4 satırlık HTML başlığı (Oyun Sekmeleri, Başlık, Alt Modlar, Seviye Dropdown) ekranın %28'ini kaplamakta, Phaser tuvalini küçülterek siyah bantlara sıkıştırmaktadır. |
| **7** | **Park Cebi İşlev Belirsizliği** | 🟡 Yüksek | Tüm Seviyeler | Park cebi sadece arkasında gri bir kutu olan boş bir raydır. Kapasite (1 vs 2), vagon bekleme yuvası veya tampon göstergesi yoktur. |
| **8** | **Seviye Sayısı Çelişkisi (5 vs 7)** | 🟢 Orta | Menü & HUD | Alt mod butonunda `🅿️ Siding Deneyi (5 Seviye)` yazarken, dropdown ve HUD'da `Seviye X/7` görünmektedir. |

---

## 2. SEVİYE BAZLI GÖRSEL GRAFİK VE EKRAN ANALİZİ

### Seviye 101 — Temel Sol Park Cebi
- **Graf Tanımı:** `SOURCE(270,110)` ➔ `SW_SIDING(270,230)` ➔ `SIDING(120,360)` / `MERGE(270,490)` ➔ `SW_STATION(270,610)` ➔ `RED(160,750)` / `BLUE(380,750)`.
- **Görsel Durum:** Ana hat x=270'te dikey bir cetvel gibidir. Sola doğru 120px'lik tek bir dirsek açılır. Sağ taraftaki 270px–540px arası tamamen boştur.
- **Problem:** Tahta çok dar ve uzundur. Makasın "PARK" yazısı 8px olduğundan mobil cihazda seçilememektedir.

### Seviye 102 — Sağ Park Cebi ve Sollama
- **Graf Tanımı:** Seviye 101'in sağa aynalanmış halidir (`SIDING(420,360)`).
- **Görsel Durum:** 101'deki sol üçgen dirsek yerine sağda bir dirsek vardır. Sol taraf tamamen boştur.
- **Problem:** 101 ile 102 görsel olarak aynı hissi vermektedir. Oyuncuya yeni bir mekan veya ağ hissi sunmamaktadır.

### Seviye 103 — Merkez Ada Kapasite Sınırı & Seviye 103-B FIFO (2-Kapasite)
- **Graf Tanımı:** `SW_SIDING(270,220)`, `SIDING_BAY(270,360)`, `MERGE(270,500)`.
- **Görsel Durum (HATA):** 
  - `SW_SIDING ➔ MERGE` (Ana Hat) ve `SW_SIDING ➔ SIDING_BAY ➔ MERGE` (Park Hattı) **aynı X koordinatında (x=270)** yer almaktadır!
  - İki ray çizgisi üst üste binerek tek bir düz dikey çizgi oluşturmaktadır.
  - Oyuncu bir makas ve park cebi tabelası görmekte, ancak makasın hangi kolunun nereye ayrıldığını fiziksel olarak görememektedir!
  - 103-B FIFO'da iki araç parka girdiğinde dikey eksende ötelenmekte, ancak ana hat rayının tam üzerinde durmaktadırlar.

### Seviye 104 (Legacy Ref) — Diyagonal S-Kavis
- **Graf Tanımı:** `SOURCE(180,110)` ➔ `SW(220,230)` ➔ `SIDING(110,380)` ➔ `MERGE(320,490)`.
- **Görsel Durum:** Hafif yatık bir omurga içerir, ancak raylar sert kırık açılarla birleştiği için demiryolu geometrisinden uzaktır.

### Seviye 104 (Dual Siding) — İki Bağımsız Park Cebi
- **Graf Tanımı:** 10 düğümlü dikey zincir.
  `SOURCE(100)` ➔ `SW_A(200)` ➔ `SIDING_A(115, 310)` ➔ `MERGE_A(410)` ➔ `SW_B(510)` ➔ `SIDING_B(425, 610)` ➔ `MERGE_B(700)` ➔ `SW_STATION(780)` ➔ `STATIONS(860)`.
- **Görsel Durum (KRİTİK HATA):**
  - İki park cebi mantıksal olarak çizilmektedir (biri solda, biri sağda).
  - Ancak dikey zincir 860 piksele uzadığı için **Kırmızı ve Mavi istasyon kutuları `y=860` seviyesine inmektedir**.
  - `y=885`'teki "Duraklat" ve "Çıkış" butonları ile istasyonlar fiziksel olarak üst üste binmektedir (Overlap).
  - `y=830`'daki seviye ipucu metni ("İki mavi aracı Sol ve Sağ park ceplerine park edin...") istasyon kutularının arkasında kalarak kısmen okunamaz hale gelmektedir.

### Seviye 105 — Geniş Dağıtım Ağı
- **Graf Tanımı:** "Geniş Elmas Dağıtım Ağı" olarak adlandırılmasına rağmen ray çizimi Seviye 101 ile neredeyse aynıdır.
- **Görsel Durum:** Elmas (Diamond) formunu oluşturacak sağ bypass kolu çizilmemiştir; yine x=270'te tek bir dikey omurga ve solda bir park cebi vardır.

---

## 3. ERGONOMİ VE DOKUNMATİK EKRAN ANALİZİ

### 3.1. Dokunma Hedefleri (Touch Targets) Karşılaştırması

| Arayüz Elemanı | Mevcut Boyut | iOS / Android Tavsiyesi | Durum |
|---|---|---|---|
| **Makas Düğmesi (Giriş/İstasyon)** | `fillCircle` r=32 (64×64 px) / Hitbox: 76×76 px | Min. 48×48 px | ✅ Fiziksel alan yeterli |
| **Makas Yazısı (İsim & Kol)** | 8px – 9px Metin | Min. 13px Metin | ❌ **Yetersiz / Okunaksız** |
| **Park Cebi Sal Butonu (Release)** | 120×34 px / Font: 10px | Min. 48px Yükseklik | ❌ **Yetersiz (34px yükseklik kuralı ihlal ediyor)** |
| **Alt Kontrol Butonları** | 110~140×40 px / Font: 12px | Min. 44px Yükseklik | ⚠️ Sınırda |
| **Durum / İpucu Metni** | 12px, 500px genişlik, 2 satır | Min. 14px Okunabilir Metin | ⚠️ Küçük ve kalabalık |

### 3.2. Ekran Oranları ve Alan Kullanımı

- **Phaser Oyun Alanı:** 540 × 960 px (9:16 oran).
- **Aktif Ray Genişliği:** 300 px (Tuvalin yalnızca %55'i).
- **Boş Kenar Boşlukları:** Sol 120 px, Sağ 120 px (Tuvalin %45'i atıl siyah zemin).
- **HTML Menü Yüksekliği:** 230 px (Ekranın dikeyde %25–30'unu oyun başlamadan tüketmektedir).
- **Sonuç:** Mobilde Phaser tuvali dikeyde sıkışmakta, `Scale.FIT` nedeniyle tuval küçültülmekte, bu da 8px yazıların 4px gibi görünmesine yol açmaktadır.

---

## 4. KOORDİNAT DÖNÜŞÜMÜ (COMPACT GRAPH TRANSFORMATION)

Simülasyon motorunun mantıksal bağlantılarını (`edges`, `switches`, `manifest`, tick sıralaması) **asla değiştirmeden**, yalnızca Phaser sahnesindeki render koordinatlarını dönüştürerek oyun alanını ferahlatabiliriz:

```
[Mantıksal Graph (Değişmez)]
  SW_SIDING ──(MAIN)──> MERGE
  SW_SIDING ──(SIDING)─> SIDING_BAY ──> MERGE
           │
           ▼
[Görsel Projeksiyon Katmanı (Dinamik Render)]
  - X Genişletme Faktörü: X_norm = 270 + (X_orig - 270) * 1.35
  - Eşmerkezli Ray Düzeltmesi (103/103-B): SIDING_BAY için yay (Bypass Arch) oluşturma:
    X_siding = X_main ± 130px (Fiziksel ayrım)
  - Dikey Dinamik Sıkıştırma: Toplam düğüm sayısına göre Y aralığını 140px - 720px arasına oturtma.
```

Bu sayede:
1. Seviye 104 Dual'deki istasyonlar asla `y=720`'nin altına inmez, alt butonlarla çakışma %100 önlenir.
2. Seviye 103 ve 103-B'de park cebi ana hattan fiziksel bir yay ile ayrılır, iki vagon yan yana veya arkaya net biçimde park eder.
3. Raylar 540px genişliğin 460px'ini kullanarak tahtayı "uzun ve dar bir tüp" olmaktan çıkarıp dengeli bir oyun alanına dönüştürür.

---

## 5. İKİ FARKLI GÖRSEL TASARIM ALTERNATİFİ

### ALTERNATİF A: Minimalist & Yüksek Okunabilirlikli 2D Puzzle
*(İlham: Mini Metro, Railbound, Dorfromantik UI)*

```
┌─────────────────────────────────────────────────────────────┐
│ 🔀 SIDING 4/5 ── [ ●B  ●B  ◼R  ◼R ] ─────── Skor: 120  ⏸️  │ ◄── Kompakt Entegre HUD (36px)
├─────────────────────────────────────────────────────────────┤
│                         [📦 HUB]                            │
│                            │                                │
│                   ╭────────┴────────╮                       │
│                   │ 🔀 MAKAS A      │                       │
│                   │ 🟢 SOL PARK [◀] │ (Hitbox: 84x52px)     │
│                   ╰────────┬────────╯                       │
│              ┌─────────────┴─────────────┐                  │
│              │                           │                  │
│       ┌──────────────┐                   │                  │
│       │ 🅿️ PARK A    │                   │                  │
│       │ [●B] [Boş]   │                   │ (Geniş 2D        │
│       │ [🟢 SAL]     │                   │  Platform)       │
│       └──────┬───────┘                   │                  │
│              └─────────────┬─────────────┘                  │
│                            │                                │
│                   ╭────────┴────────╮                       │
│                   │ 🔀 İSTASYON     │                       │
│                   │ ◀ ◼ R    ● B ▶  │                       │
│                   ╰────────┬────────╯                       │
│              ┌─────────────┴─────────────┐                  │
│              ▼                           ▼                  │
│        [ ◼ KIRMIZI ]               [ ● MAVİ ]               │
│        (80x56px Buton)             (80x56px Buton)          │
├─────────────────────────────────────────────────────────────┤
│ 💡 İpucu: Mavi araçları park cebine alarak kırmızıları geçirin. │ ◄── 14px Ferah Banner
│ [ 🔄 Yeniden Başlat ]                 [ ⏹️ Testten Çık ]    │ ◄── 48px Standart Butonlar
└─────────────────────────────────────────────────────────────┘
```

**Temel Özellikleri:**
- **Raylar:** 14px kalınlığında yüksek kontrastlı mat pastel çizgiler. Aktif rota cyan yerine **hedef istasyon renginde (Kırmızı rotada ise parlak Kırmızı, Mavi rotada ise parlak Mavi nabız atan çizgi)** çizilir.
- **Makaslar:** Yuvarlak yerine yönü açıkça gösteren 84×52px oval paneller; içindeki yön yazıları 14px Bold.
- **Park Cebi:** Ray üzerinde açıkça ayrılmış dikdörtgen park peronu, kapasite slotları (`[ 1 ] [ 2 ]`) ve vagon gölgesi.
- **Araçlar:** Basit, temiz, kontrastlı geometrik semboller (◼, ●, ▲, ◆).

---

### ALTERNATİF B: Premium Minyatür Demiryolu / 2.5D Diorama
*(İlham: Lionel Trains, Conduct THIS!, Kairosoft Diorama, Unity 6 Geçiş Hazırlığı)*

```
                       ╔═════════════════════════╗
                       ║  PARCEL HUB DİORAMASI   ║
                       ╚══════════════╦══════════╝
                                     ║ (Çift Çelik Ray + Travers)
                             ▲       ║
                       ┌─────╨───────╨─────┐
                       │   MEKANİK MAKAS   │
                       │ [Işıklı Sinyal 🔴]│
                       └─────╥───────╥─────┘
                             ║       ╚═════════════════════╗
                             ║                             ║
                 ╔═══════════╩════════════╗        ╔═══════╩═════════╗
                 ║     ANA DEMİRYOLU      ║        ║  PARK CEBİ PERONU║
                 ║  (Balast Taş Döşeme)   ║        ║ (Ahşap İskele & ║
                 ║                        ║        ║  Tampon Takozu) ║
                 ║                        ║        ║ [🟢 DİSPANÇER]  ║
                 ╚═══════════╦════════════╝        ╚═══════╦═════════╝
                             ║                             ║
                             ╚═════════════╦═══════════════╝
                                           ║
                                   ┌───────╨───────┐
                                   │ İSTASYON MAKASI│
                                   └───────╥───────┘
                                   ╔═══════╩═══════╗
                                   ║               ║
                         ┌─────────╨──────┐ ┌──────╨─────────┐
                         │ KIRMIZI TERMİNAL│ │  MAVİ TERMİNAL │
                         │ (Tuğla Diorama)│ │ (Liman Ambarı) │
                         └────────────────┘ └────────────────┘
```

**Temel Özellikleri:**
- **Raylar:** Çift hatlı çelik raylar, altlarında ahşap traversler (balast dokusu), makas noktalarında gerçek demiryolu dilleri ve kurbağalar (frogs).
- **Makas Göstergesi:** Demiryolu sinyal lambası (Yeşil / Kırmızı mekanik kol).
- **Park Cebi:** Endüstriyel yükleme rampası, sarı-siyah ikaz çizgileri, vagonların arkasına oturduğu fiziksel hidrolik tampon takozu.
- **Araçlar:** 2.5D izometrik küçük lokomotif / kargo vagonu spriteları (hafif gölgeli ve parıltılı).
- **Rota Takibi:** Raylar arasında yanan minik LED sinyal dizisi (trenin rengine göre dinamik).

---

## 6. MOBİL MENÜ VE ALAN OPTİMİZASYON PLANI

Mevcut 230px'lik HTML başlık alanını **48px'lik tek bir kompakt bara** indirme önerisi:

1. **Üst Barın Sadeleştirilmesi:**
   - 4 satırlık sekmeler yerine, sol üstte tek bir açılır menü ikonu (`☰ Modlar`), ortada seviye başlığı (`Siding 104 [3/5]`), sağda ses ve telemetri butonları.
   - Bu tek hamle oyuna **dikeyde +180px net oyun alanı kazandırmaktadır**.
2. **Kazanılan Alanın Kullanımı:**
   - `Scale.FIT` artık oyunu sıkıştırmaz; tuval ekrana %100 oturur.
   - İstasyonlar butonlardan en az 90px yukarıda kalır (Sıfır çakışma riski).
   - Makas ve buton yazı fontları 8px'ten 14px'e çıkarılabilir.

---

## 7. DOĞRULAMA KONTROL LİSTESİ

- [x] 7 Siding seviyesinin tamamı render edilip ekran görüntüleri kaydedildi (`screenshots/`).
- [x] Seviye 104 Dual'deki istasyon-buton çakışması kanıtlandı.
- [x] Seviye 103 ve 103-B'deki düz çizgi (colinear) ray çizim hatası kanıtlandı.
- [x] 8px makas yazılarının mobildeki okunaksızlığı belgelendi.
- [x] Menüdeki 5 seviye ile oyundaki 7 seviye etiketi uyuşmazlığı tespit edildi.
- [x] Classic ve Progressive modlarının kodları korunarak hiçbir geriye dönük hata üretilmedi.
- [x] Vitest test paketindeki 69 testin tamamı hatasız çalıştırıldı.
