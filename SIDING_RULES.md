# SIDING (PARK CEBİ) MEKANİĞİ TASARIM VE KURAL DOKÜMANI

**Tarih:** 19 Ekim 2026  
**Durum:** Kesinleşmiş Tasarım Şartnamesi (Phase 3 Specification)  
**Temel Hipotez:** Oyuncu, ardışık iki teslimat aracından birini geçici olarak park cebinde bekleterek, diğer aracın öncelikli olarak hedefine ulaşmasını sağlar. Zorluk refleks baskısından (zaman kısıtı) değil, lojistik sıralama ve karar kalitesinden kaynaklanır.

---

## 1. Araç Park Cebine Nasıl Girer?
- **Kural:** Park cebi (`SIDING` düğümü), hatta bulunan bir yönlendirme makasının (`SWITCH`) çıkış kollarından biridir (ör. `SW_SIDING`: Kol 0 = `MAIN_TRACK`, Kol 1 = `SIDING_BAY`).
- **Giriş Şartı:** Makas park koluna çevrilmişse ve park cebi dolu değilse (`currentVehicles < capacity`), araç normal tick hareketiyle makastan çıkarak cebin girişine yönelir (`state = 'MOVING'`).
- **Düğüm Varışı:** Araç park cebi düğümüne ulaştığı tick'in 1. Fazında (Varışlar) otomatik olarak `state = 'PARKED'` durumuna geçer ve raydan çekilir.
- **Tasarım Gerekçesi:** Giriş için ayrı bir özel fren/durma tuşuna gerek yoktur; ray makasını yönlendirmek fiziksel demiryolu mantığıyla tamamen örtüşür ve oyuncunun zihinsel modelini yalın tutar.

---

## 2. Park Cebinde En Fazla Kaç Araç Bulunabilir?
- **Kural:** Her park cebi tanımında açık bir `capacity` (kapasite) değeri bulunur.
  - Prototip ve standart seviyelerde varsayılan kapasite: **1 araç**.
  - İleri seviyelerde test amaçlı olarak **2 araçlık kuyruk (FIFO siding)** desteklenebilir.
- **Dolu Durumu (Full State):** Park cebindeki araç sayısı kapasiteye ulaştığında (`count >= capacity`), düğüm mantıksal olarak `isNodeOccupied() = true` döner.
- **Tasarım Gerekçesi:** Mobil dikey ekranda 1 araçlık park cebi net bir görsel ayrım sağlar. Çoklu araç karmaşası yerine tek araçlık bekleme, öncelik değiştirme (order reversal) bulmacaları için matematiksel olarak yeterlidir.

---

## 3. Araç Nasıl Bekletilir ve Nasıl Tekrar Çıkar?
- **Bekletme Mantığı:**
  Normal `WAITING` araçlar sonraki tick'in Faz 2'sinde (Ayrılışlar) hat boşsa hemen çıkış yaparken, `PARKED` araçlar serbest bırakma sinyali (`sidingReleaseRequested`) verilmedikçe **asla kendiliğinden hareket etmez**. Park cebinde süresiz bekler.
- **Çıkış Mantığı (Dispatch):**
  1. Oyuncu park cebine dokunarak (veya release butonuna basarak) çıkış izni verir (`releaseRequested = true`).
  2. Bir sonraki simülasyon tick'inin Faz 2'sinde (Ayrılışlar):
     - Park cebinin çıkış yaptığı birleşme düğümü (`MERGE` veya ana hat düğümü) boşsa (`!isNodeOccupied(mergeNode)`):
       - Araç park cebinden ana hatta geçer (`state = 'MOVING'`).
       - `sidingReleaseRequested` sıfırlanır.
     - Çıkış hattı o tick'te doluysa (örneğin ana hattan başka bir tren geçiyorsa):
       - Araç park cebinde kalmaya devam eder (`Pending Dispatch`). Hat boşaldığı ilk tick'te otomatik olarak ana hatta katılır.
- **Tasarım Gerekçesi:** Oyuncunun treni güvenle bekleterek ana hattı serbest bırakabilmesi ve treni ana hatta sürerken diğer trene çarpmayacağını bilmesi gerekir.

---

## 4. Park Alanı Doluyken Ne Olur?
- **Kural:** Park cebi kapasitesi doluyken (`capacity = 1` ve içeride 1 araç varken):
  1. Eğer makas hala park cebine bakıyorsa ve arkadan 2. bir araç o makasa ulaşırsa:
     - 2. araç makas düğümünde `state = 'WAITING'` durumunda durur (blokaj).
     - Park cebine giremez çünkü hedef düğüm doludur.
  2. Oyuncu bu esnada makası ana hatta çevirirse:
     - Bir sonraki tick'te 2. araç ana hatta doğru yoluna devam eder (sollama gerçekleşir).
  3. Oyuncu makası çevirmezse:
     - 2. araç makas üzerinde bekler; arkasından gelen 3. araç da onun arkasındaki hatta kuyruklanır.
- **Tasarım Gerekçesi:** Trenler asla birbirinin içine girmez veya yok olmaz. Katı blokaj (Rigid Block Signaling), lojistik oyunlarının en temel fiziksel kuralıdır.

---

## 5. Aynı Hatta İki Araç Karşılaşırsa Ne Olur?
- **Kural:**
  1. **Karşılaşma (Head-on Collision):** Sistemde tüm raylar yönlendirilmiş çizgedir (Directed Edges). Çift yönlü ray trafiği olmadığı için iki aracın kafa kafaya çarpışması topolojik olarak imkansızdır.
  2. **Arkadan Çarpma (Rear-end Collision):** Simülasyonun Faz 2 kuralı gereği, bir sonraki düğüm veya kenar doluysa (`isNodeOccupied(target) == true`), arkadaki araç hareket edemez (`state = 'WAITING'`). Mesafe deterministik olarak korunur.
- **Tasarım Gerekçesi:** Fizik motoru veya karmaşık çarpışma hesabı yerine hücre/blok tabanlı rezervasyon mantığı kullanılarak determinizm %100 garanti edilir.

---

## 6. Makas Değişiminin Hangi Anlarda Geçerli Olduğu Nasıl Belirlenir?
- **Kural:**
  1. **Geçiş Kilit Kuralı:** Bir araç makasa doğru seyir halindeyken (`state === 'MOVING' && toNode === switchId`), makas kilitlidir (`isJunctionLocked = true`).
  2. **Sıraya Alınan Makas Değişimi (Buffered Toggle):**
     - Oyuncunun yetişememe ve telaş stresini bitirmek için: Araç makasa girerken oyuncu makasa dokunursa, dokunuş reddedilmez; **kuyruğa alınır (buffered)**.
     - Araç makası geçtiği anda (aynı tick'in tamamlanmasıyla birlikte), makas otomatik olarak bir sonraki kola döner.
     - Oyuncuya yeşil bir "Sırada" (Buffered) görsel halkası gösterilir.
- **Tasarım Gerekçesi:** Oyuncu doğru kararı vermişse, 100 milisaniyelik gecikme yüzünden ceza almamalıdır. Bu kural refleks baskısını tamamen ortadan kaldırır.

---

## 7. Oyuncu Bekleyen Aracı Hangi Dokunmatik Kontrolle Serbest Bırakır?
- **Kural:**
  - Park cebi düğümünün hemen üzerinde veya yanında belirgin bir **"SALIVER / ÇIKIŞ VER" (🟢 DISPATCH / RELEASE)** butonu yer alır.
  - Araç park cebine girdiğinde buton parlar ve üzerine tıklanabilir hale gelir (`Interactive`).
  - Dokunulduğunda buton sarı "Çıkış İzni Verildi" durumuna geçer; araç ray boşaldığı anda çıkar.
- **Tasarım Gerekçesi:** Sezgisel mobil arayüz. Parktaki aracın üstüne doğrudan dokunmak veya yanındaki release bayrağına dokunmak en doğal tek-parmak etkileşimidir.

---

## 8. Kaybetme ve Kazanma Koşulları Nelerdir?
- **Kazanma Koşulu:**
  - Manifestodaki tüm araçlar raylara çıkmış olmalıdır.
  - Park cebinde hiçbir araç kalmamış olmalıdır (`vehicles.every(v => v.state === 'DELIVERED' || v.state === 'MISDELIVERED')`).
  - Hatalı teslimat sayısı izin verilen limitin altındadır (`mistakeCount < maxMistakes`).
- **Kaybetme Koşulu:**
  - Hatalı teslimat limitine ulaşılması (`mistakeCount >= maxMistakes`).
  - **Deadlock (Çıkmaz Tıkanma):** Rayda hiç hareket kalmamış, manifesto tükenmiş ve parktaki araç çıkış yolunu kapatan bir başka araçla kilitlenmişse oyun yenilgi (`LOST`) veya manuel yeniden başlatma ister.
- **Tasarım Gerekçesi:** Oyuncunun park cebindeki aracı unutup seviyeyi bitirmesi engellenir. Bütün vagonlar nihai hedeflerine ulaşmalıdır.

---

## 9. Oyuncu Sonsuza Kadar Bekleyerek Oyunu Kilitleyebilir mi?
- **Kural:**
  - Park cebindeki araç serbest bırakılmadığında, manifesto bekleyebilir veya durabilir.
  - **Tasarım Kararı:** Siding prototip seviyelerinde sabit bir zaman sayacı (time limit) **konulmamıştır**. Oyuncu istediği kadar düşünebilir, hattı inceleyebilir.
  - **Hareketsizlik Koruması:** Eğer rayda sadece park edilmiş araçlar kalmış ve son 10 tick boyunca hiçbir kullanıcı girdisi olmamışsa, ekranda nazik bir ipucu animasyonu belirir: *"💡 Parktaki aracı serbest bırakmak için dokunun."*
  - Oyuncu dilediği zaman "Yeniden Başlat" (`Restart`) butonuna basabilir.
- **Tasarım Gerekçesi:** Bulmaca oyunlarında zaman baskısı olmadan düşünme fırsatı vermek, oyuncu tutundurmasını (retention) artıran en kritik unsurdur.

---

## 10. Farklı Kare Hızlarında Aynı Hamle Dizisi Aynı Sonucu Verir mi?
- **Kural:**
  - **Kesinlikle EVET.** Simülasyon, ekran yenileme hızından (60Hz, 120Hz, 30Hz) tamamen soyutlanmış bir `tickCount` ayrık zaman saatiyle çalışır.
  - Oyuncunun dokunuşları tick döngüsü içinde işlenir. $T$ tick anında yapılan bir makas değişimi veya serbest bırakma emri, oyun 15 FPS'te de çalışsa 240 FPS'te de çalışsa matematiksel olarak **birebir aynı durum geçişini** üretir.
- **Tasarım Gerekçesi:** Unity 6 mobil hedefinde farklı işlemci ve ekran tazeleme hızlarına sahip Android ve iOS cihazlarda deterministik test edilebilirliğin garantisi budur.
