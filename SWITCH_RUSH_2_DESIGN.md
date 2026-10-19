# SWITCH RUSH 2.0 — Oyun Tasarım ve Mimari Belgesi (GDD 2.0)

**Tarih:** 2026-10-17  
**Sürüm:** 2.0.0-rc  
**Rol:** Mobile Game Director, Casual Game Designer, Level Designer & Technical Artist  
**Proje:** Switch Rush 2.0 (Parcel Express)  
**Referans Doküman:** `chain_domino_switch_rush_GDD.md` (Classic mod için yetkili)

---

## 1. Yönetici Özeti ve Vizyon

Switch Rush 1.0 (Classic), deterministik demiryolu yönlendirme mekaniğini doğrulamış olmakla birlikte erken oyuncu testlerinde şu iki temel engelle karşılaşmıştır:
1. **"Araçlara yetişemiyorum"**: 1. seviyeden itibaren 700 ms tick hızı, 3 aktif makas ve 1400 ms çıkış aralığı oyuncuya ilk saniyelerde <700 ms karar süresi bırakmakta, yeni oyuncuları ezmektedir.
2. **"Bölümler birbirine çok benziyor"**: Yalnızca manifesto renk sıralaması değiştiği için oyuncu her bölümde aynı zihinsel eylemi (statik 3 makaslı ağ) tekrarlamaktadır.

**Switch Rush 2.0 Vizyonu:**
* **Zorluk Felsefesi:** Öğretici ve kademeli, tek değişkenli artış (single-variable scaling), 1 saniyelik kalkış hazırlık sinyali, erken bölümlerde tekil araç akışı (`maxConcurrentVehicles = 1`).
* **Bölüm Çeşitliliği:** 6 farklı karar tipi (Öğrenme, Zamanlama, Öncelik, Rota Seçimi, Trafik Yönetimi, Özel Görev) ile tasarlanmış **30 Seviye** ve **5 Tematik Bölge** (Suburb, Downtown, Industrial, Harbor, Night Express).
* **Görsel Sanat Yönü:** **Premium Toy City Diorama** (minyatür maket şehir, yuvarlatılmış geometriler, yumuşak gölgeler, pastel renk paleti, rayları kapatmayan şık çevre dekorları).
* **Hikâye Dünyası:** **Parcel Express** — küçük bir mahalle kuryeliğinden başlayıp tüm metropolün gece ekspresine uzanan hafif, kesintisiz bir operasyon yöneticisi yolculuğu.

---

## 2. Mevcut Oyun Analizi (Classic vs 2.0)

| Parametre / Kural | Switch Rush 1.0 (Classic) | Switch Rush 2.0 | Tasarım Gerekçesi |
| :--- | :--- | :--- | :--- |
| **Başlangıç Hızı (Tick Süresi)** | 700 ms (tüm seviyelerde sabit) | 1000 ms → 700 ms (Kademeli) | İlk 10 seviyede hızı %70–80'e çekerek oyuncuya refleks yerine stratejik düşünme payı tanır. |
| **Araç Çıkış Sıklığı (Cadence)** | 2 tick (1400 ms sabit) | 5 tick → 2 tick (Kademeli) | Erken bölümlerde araçlar arası 4.5–5.5 saniye karar payı. |
| **Eşzamanlı Araç Sınırı** | Sınırsız (kaynak boşsa doğar) | `maxConcurrentVehicles` (1 → 2 → 3 → ∞) | İlk 5 bölümde tahtada asla 2. araç bulunmaz; kafa karışıklığı sıfıra indirilir. |
| **Kalkış Hazırlık Göstergesi** | Yok (anında SOURCE'ta belirir) | 1 saniyelik görsel hazırlık uyarısı | Oyuncunun aracın rengini ve hedefini kalkmadan önce okumasını sağlar. |
| **Aktif Makas Sayısı** | 3 makas (J1, J2, J3 daima aktif) | Seviyeye göre 1, 2 veya 3 makas | İlgisiz makaslar kilitlenir (`🔒 SABİT`), bilişsel yük elenir. |
| **Rota Önizleme Aydınlatması** | Statik hatlar | Aktif rotayı parlak elektrik hattıyla aydınlatma | Makasın o an hangi istasyona bağlı olduğu şüphe bırakmaz. |
| **Hata Toleransı** | Sabit 3 hata | Seviyeye göre 3 → 2 | Eğitici bölümlerde hata korkusu olmadan deneme imkânı. |
| **Bölüm Sayısı ve Yapısı** | 10 sabit manifesto | 30 seviye / 5 bölge / 6 karar türü | Tekrar oynama isteği ve zengin ilerleme hissi. |
| **Görsel Kimlik** | Düz koyu zemin ve basit kutular | Premium Toy City Diorama (5 Bölge) | Casual pazar kalitesinde estetik ve okunabilirlik. |

---

## 3. Karar Türleri Matrisi (Level Families)

Her seviye bir `levelFamily` ve `primaryChallenge` taşır:

1. **A. Öğrenme (Learning):** Oyuncu tek bir makasın (`J1`, `J2` veya `J3`) iki yönü arasındaki temel ilişkiyi kavrar.
2. **B. Zamanlama (Timing):** Hedef istasyon bellidir; kritik olan aracın makasa varmadan önce ve makastan ayrıldıktan hemen sonra doğru anda makasın değiştirilmesidir.
3. **C. Öncelik (Priority):** Peş peşe gelen zıt renkli araçların rotalarının kilitlenme anlarına dikkat edilerek önce hangi makasın tetikleneceği belirlenir.
4. **D. Rota Seçimi (Route Selection):** `J1` ana makası ile alt makasların (`J2` / `J3`) çapraz kombinasyonları kurulur.
5. **E. Trafik Yönetimi (Traffic Management):** Tahtada aynı anda 2 veya 3 araç varken adil tepki süresi korunarak istasyonlara yönlendirme yapılır.
6. **F. Özel Görev (Special Mission):** Hatasız seri (`maxMistakes = 1` veya sıfır toleranslı ritmik hedefler) ve bölge sonu ustalık teslimatları.

---

## 4. 30 Seviyelik Bölge İlerleme Planı (5 Districts)

### Bölge 1: SUBURB — Sakin Mahalle Ulaşımı (Seviye 1–6)
*Görsel Tema:* Pastel yeşil bahçeler, sevimli çatılı mini evler, sakin sokaklar.  
*Mekanik:* Yalnızca `J2` ve ardından `J1` tanıtımı. `maxConcurrentVehicles = 1`. 1000–900 ms hız.

* **Seviye 1 (Suburb / A. Öğrenme):** 1 Araç ('B'), sadece `J2` aktif. 1000 ms tick. Tek dokunuşla Mavi istasyon.
* **Seviye 2 (Suburb / A. Öğrenme):** 2 Araç ('R', 'B'), sadece `J2` aktif. 950 ms tick. Kırmızı sonrası Mavi dönüşü.
* **Seviye 3 (Suburb / B. Zamanlama):** 3 Araç ('B', 'R', 'B'), sadece `J2` aktif. 900 ms tick. Basit yön değiştirme ritmi.
* **Seviye 4 (Suburb / A. Öğrenme):** 2 Araç ('R', 'G'), sadece `J1` ana makası aktif. 900 ms tick. Sol/Sağ ayrımı.
* **Seviye 5 (Suburb / D. Rota Seçimi):** 3 Araç ('G', 'R', 'G'), `J1` ana makası ritmi. 900 ms tick.
* **Seviye 6 (Suburb / F. Ustalık):** 4 Araç ('R', 'B', 'R', 'G'), `J1` ve `J2` aktif. Suburb ustalık mezuniyeti.

### Bölge 2: DOWNTOWN — Şehir İçi Dağıtım (Seviye 7–12)
*Görsel Tema:* Mini ofis binaları, yaya geçitleri, küçük şehir parkları, metro girişleri.  
*Mekanik:* `J3` (Yeşil/Sarı) makası katılır, 2 eşzamanlı araç izin verilir. 850–800 ms hız.

* **Seviye 7 (Downtown / A. Öğrenme):** 3 Araç ('G', 'Y', 'R'), `J1` ve `J3` aktif. Sarı istasyona geçiş.
* **Seviye 8 (Downtown / B. Zamanlama):** 4 Araç ('Y', 'G', 'Y', 'G'), `J3` ritim testi. 850 ms tick.
* **Seviye 9 (Downtown / D. Rota Seçimi):** 4 Araç ('R', 'G', 'B', 'Y'), 3 makasın ilk sakin buluşması. 850 ms tick.
* **Seviye 10 (Downtown / C. Öncelik):** 4 Araç ('B', 'Y', 'R', 'G'), sıralı renk ayrımı. 800 ms tick.
* **Seviye 11 (Downtown / E. Trafik Yönetimi):** 5 Araç ('R', 'B', 'G', 'Y', 'R'), `maxConcurrentVehicles = 2`. 800 ms tick.
* **Seviye 12 (Downtown / F. Ustalık):** 6 Araç ('R', 'Y', 'B', 'G', 'R', 'Y'), Downtown Express ustalık teslimatı.

### Bölge 3: INDUSTRIAL — Depo ve Üretim Hattı (Seviye 13–18)
*Görsel Tema:* Tuğla fabrikalar, metalik konteynerler, küçük vinçler, duman bacaları.  
*Mekanik:* 3 makas koordinasyonu, sıkı zamanlama pencereleri, 750 ms hız.

* **Seviye 13 (Industrial / B. Zamanlama):** 5 Araç ('R', 'R', 'B', 'G', 'G'), blokaj önleme. 750 ms tick.
* **Seviye 14 (Industrial / C. Öncelik):** 5 Araç ('Y', 'B', 'Y', 'B', 'R'), zıt istasyonlar. 750 ms tick.
* **Seviye 15 (Industrial / D. Rota Seçimi):** 6 Araç ('G', 'R', 'Y', 'B', 'G', 'R'), çapraz hatlar. 750 ms tick.
* **Seviye 16 (Industrial / E. Trafik Yönetimi):** 6 Araç ('R', 'G', 'B', 'Y', 'B', 'G'), 2 araç akışı. 750 ms tick.
* **Seviye 17 (Industrial / B. Zamanlama):** 6 Araç ('Y', 'Y', 'G', 'R', 'B', 'B'), ardışık çiftler. 750 ms tick.
* **Seviye 18 (Industrial / F. Ustalık):** 7 Araç ('R', 'B', 'G', 'Y', 'R', 'B', 'G'), Ağır Sanayi Lojistiği ustalık testi.

### Bölge 4: HARBOR — Liman Teslimatları (Seviye 19–24)
*Görsel Tema:* İskele tahtaları, kargo gemileri, dalgalar, deniz feneri, rıhtım kasaları.  
*Mekanik:* Standart 700 ms hız, ritmik ikili ve üçlü araç akışları.

* **Seviye 19 (Harbor / D. Rota Seçimi):** 6 Araç ('B', 'Y', 'B', 'Y', 'R', 'G'), deniz aşırı sevkiyat. 700 ms tick.
* **Seviye 20 (Harbor / B. Zamanlama):** 7 Araç ('R', 'B', 'R', 'G', 'Y', 'G', 'B'), liman temposu. 700 ms tick.
* **Seviye 21 (Harbor / C. Öncelik):** 7 Araç ('G', 'R', 'Y', 'B', 'G', 'B', 'Y'), iskele önceliği. 700 ms tick.
* **Seviye 22 (Harbor / E. Trafik Yönetimi):** 8 Araç ('R', 'B', 'Y', 'G', 'Y', 'B', 'R', 'G'), yüksek akış. 700 ms tick.
* **Seviye 23 (Harbor / B. Zamanlama):** 8 Araç ('B', 'G', 'R', 'Y', 'B', 'G', 'R', 'Y'), dört renk dalgası. 700 ms tick.
* **Seviye 24 (Harbor / F. Ustalık):** 8 Araç ('Y', 'B', 'R', 'G', 'R', 'B', 'G', 'Y'), Büyük Liman Dok Mücadelesi.

### Bölge 5: NIGHT EXPRESS — Gece Ekspresi (Seviye 25–30)
*Görsel Tema:* Gece gökyüzü, istasyon sokak fenerleri, parlayan neon tabelalar, ışıklı raylar.  
*Mekanik:* 700 ms hız, 2 tick çıkış sıklığı, usta kurye refleksleri ve hatasız seri.

* **Seviye 25 (Night Express / C. Öncelik):** 8 Araç ('R', 'G', 'R', 'G', 'B', 'Y', 'B', 'Y'), gece vardiyası. 700 ms tick.
* **Seviye 26 (Night Express / B. Zamanlama):** 9 Araç ('G', 'B', 'Y', 'R', 'G', 'Y', 'B', 'R', 'G'), gece ritmi. 700 ms tick.
* **Seviye 27 (Night Express / E. Trafik Yönetimi):** 9 Araç ('B', 'Y', 'R', 'G', 'B', 'G', 'R', 'Y', 'B'), yoğun ekspres. 700 ms tick.
* **Seviye 28 (Night Express / D. Rota Seçimi):** 10 Araç ('R', 'B', 'G', 'Y', 'Y', 'B', 'G', 'R', 'B', 'Y'), tam kapasite kurye. 700 ms tick.
* **Seviye 29 (Night Express / F. Özel Görev):** 10 Araç ('Y', 'G', 'B', 'R', 'Y', 'G', 'B', 'R', 'G', 'Y'), hatasız teslimat serisi. 700 ms tick.
* **Seviye 30 (Night Express / F. Büyük Final):** 12 Araç ('R', 'G', 'B', 'Y', 'R', 'G', 'B', 'Y', 'Y', 'B', 'G', 'R'), Metropol Lojistik Direktörlüğü Büyük Finali!

---

## 5. Görsel Tasarım Sistemi: Premium Toy City Diorama

1. **Katmanlı Sahne Mimarisi:**
   - **Arka Plan Diorama Katmanı (Depth 0):** Bölgeye özel zemin tonu, minyatür dekoratif elemanlar (ağaçlar, mini evler, konteynerler, rıhtım, sokak fenerleri). Kesin kural: Ray ve istasyon alanlarına taşmaz.
   - **Demiryolu ve Güç Hattı (Depth 1–2):** Koyu taban yatağı ve aktif makas yönünü gösteren camgöbeği ışıma.
   - **İstasyon Depoları (Depth 3–4):** Oyuncak vagon yuvası formunda yuvarlatılmış, yüksek kontrastlı istasyon binaları (`R, B, G, Y` etiketli ve sembollü).
   - **Vagonlar (Depth 10–12):** Yumuşak gölgeli, tekerlek detaylı, renk körü erişilebilir harf ve yön oku taşıyan minyatür oyuncak vagonlar.
   - **Makas Kontrolleri (Depth 20–25):** 3D düğme hissi veren, dokunulduğunda 0.18 saniyede yön değiştiren, aktif/sabit/kilit durumlarını açıkça belirten mekanik göstergeler.
   - **UI & HUD (Depth 30+):** Sade, minimalist, üst bilgi çubuğu ve alt kontrol paneli.

2. **Renk Paleti & Erişilebilirlik:**
   - Kırmızı İstasyon / Vagon: `#E63946` + `R` (Kare sembolü)
   - Mavi İstasyon / Vagon: `#0077B6` + `B` (Daire sembolü)
   - Yeşil İstasyon / Vagon: `#2D6A4F` + `G` (Üçgen sembolü)
   - Sarı İstasyon / Vagon: `#E09F3E` + `Y` (Elmas sembolü)

---

## 6. Hikâye ve Bölge Geçişleri: Parcel Express

- Oyuncuya her yeni bölgeye ulaştığında (Seviye 7, 13, 19, 25) 1.5 saniyelik şık ve tek dokunuşla geçilebilir bir **Bölge Yetki Rozeti (District Unlock)** kartı sunulur:
  - *"Tebrikler Operasyon Yöneticisi! Downtown bölgesine atandınız."*
- Oyun içinde gereksiz diyalog veya zorunlu bekleme bulunmaz.

---

## 7. Telemetri ve Karşılaştırma Ölçümleri

Classic ve 2.0 sürümlerinin oynanış verileri `TelemetryLogger` üzerinde şu alanlarla ayrışır:
- `game_id`: `'switch_rush'`
- `submode`: `'2.0'` veya `'classic'`
- `district`: `'suburb' | 'downtown' | 'industrial' | 'harbor' | 'night_express'`
- `levelFamily`: `'learning' | 'timing' | 'priority' | 'route_selection' | 'traffic' | 'mastery'`
- `first_tap_ms`, `run_won`, `run_lost`, `voluntary_replay`, `exit_clicked`, `misdeliveries`

Bu sayede gerçek kullanıcı testlerinde 2.0 sürümünün ilk etkileşim rahatlığı ve tamamlanma oranları nesnel verilerle ölçülecektir.
