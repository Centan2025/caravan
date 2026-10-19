# LEVELS.md — Chain Domino Doğrulanmış Seviyeler

Bu belge GDD v1.0 gereksinimlerine göre oluşturulmuş ve `ChainSolver` otomatik çözücüsü tarafından tüm açılış kombinasyonları taranarak onaylanmış 10 sabit seviyeyi belgeler.

## Kabul Kriterleri Doğrulaması
1. Her seviyede en az 1 hedef (`G`) bulunur.
2. Her seviyede başlangıçta dokunulabilecek en az 2 uygun röle bulunur.
3. Her seviyenin orijinal tahtadan başlayan en az 1 kazanan çözümü vardır.
4. Seviye 1 hariç her seviyede ilk dokunuşta doğrudan kaybettiren en az 1 yanlış açılış dokunuşu mevcuttur.
5. Seviyeler artan karar yüküne (decision burden) göre kademeli tasarlanmıştır.

---

### Seviye 1: Seviye 1: İlk Kıvılcım
- **Hak (maxIgnitions):** 1
- **Hedef Sayısı:** 1
- **Izgara:**
```
....G
....U
....U
....U
....U
```
- **Çözücü Tarafından Onaylanmış Kazanan Dokunuş Sırası:** (4,1)
- **Kaybettiren Açılış Örneği:** Yok (Seviye 1 Giriş)
- **Toplam Çözüm Yolu:** 4

---
### Seviye 2: Seviye 2: Köşeyi Dönmek
- **Hak (maxIgnitions):** 1
- **Hedef Sayısı:** 1
- **Izgara:**
```
RRRD.
...D.
...D.
...G.
L....
```
- **Çözücü Tarafından Onaylanmış Kazanan Dokunuş Sırası:** (0,0)
- **Kaybettiren Açılış Örneği:** (0,4)
- **Toplam Çözüm Yolu:** 6

---
### Seviye 3: Seviye 3: İkili Dalga (H)
- **Hak (maxIgnitions):** 1
- **Hedef Sayısı:** 2
- **Izgara:**
```
D....
#....
GLHRG
.....
.....
```
- **Çözücü Tarafından Onaylanmış Kazanan Dokunuş Sırası:** (2,2)
- **Kaybettiren Açılış Örneği:** (0,0)
- **Toplam Çözüm Yolu:** 1

---
### Seviye 4: Seviye 4: Dikey Çatal (V)
- **Hak (maxIgnitions):** 1
- **Hedef Sayısı:** 2
- **Izgara:**
```
..G..
..U..
..V.R
..D..
..G..
```
- **Çözücü Tarafından Onaylanmış Kazanan Dokunuş Sırası:** (2,2)
- **Kaybettiren Açılış Örneği:** (2,1)
- **Toplam Çözüm Yolu:** 1

---
### Seviye 5: Seviye 5: Çift Kanat
- **Hak (maxIgnitions):** 1
- **Hedef Sayısı:** 2
- **Izgara:**
```
G...G
U...U
ULHRU
.....
...D.
```
- **Çözücü Tarafından Onaylanmış Kazanan Dokunuş Sırası:** (2,2)
- **Kaybettiren Açılış Örneği:** (0,1)
- **Toplam Çözüm Yolu:** 1

---
### Seviye 6: Seviye 6: İki Ayrı Hat
- **Hak (maxIgnitions):** 2
- **Hedef Sayısı:** 2
- **Izgara:**
```
RD#..
.D#..
.G#G.
..#U.
D.#UL
```
- **Çözücü Tarafından Onaylanmış Kazanan Dokunuş Sırası:** (0,0) ➔ (3,3)
- **Kaybettiren Açılış Örneği:** (0,4)
- **Toplam Çözüm Yolu:** 18

---
### Seviye 7: Seviye 7: Çifte Kemer
- **Hak (maxIgnitions):** 2
- **Hedef Sayısı:** 2
- **Izgara:**
```
DL#D.
GU#..
#####
..#DG
..#RU
```
- **Çözücü Tarafından Onaylanmış Kazanan Dokunuş Sırası:** (0,0) ➔ (3,3)
- **Kaybettiren Açılış Örneği:** (3,0)
- **Toplam Çözüm Yolu:** 18

---
### Seviye 8: Seviye 8: İkili Dalga ve Hat
- **Hak (maxIgnitions):** 2
- **Hedef Sayısı:** 3
- **Izgara:**
```
D....
#....
GLHRG
#####
RRRRG
```
- **Çözücü Tarafından Onaylanmış Kazanan Dokunuş Sırası:** (2,2) ➔ (0,4)
- **Kaybettiren Açılış Örneği:** (0,0)
- **Toplam Çözüm Yolu:** 8

---
### Seviye 9: Seviye 9: Üçlü Oda
- **Hak (maxIgnitions):** 3
- **Hedef Sayısı:** 3
- **Izgara:**
```
D.#.D
G.#.G
#####
..D.L
..G.#
```
- **Çözücü Tarafından Onaylanmış Kazanan Dokunuş Sırası:** (0,0) ➔ (4,0) ➔ (2,3)
- **Kaybettiren Açılış Örneği:** (4,3)
- **Toplam Çözüm Yolu:** 6

---
### Seviye 10: Seviye 10: Dörtlü Hasat
- **Hak (maxIgnitions):** 3
- **Hedef Sayısı:** 4
- **Izgara:**
```
....D
....G
GLHRG
##.##
RRRG.
```
- **Çözücü Tarafından Onaylanmış Kazanan Dokunuş Sırası:** (4,0) ➔ (2,2) ➔ (0,4)
- **Kaybettiren Açılış Örneği:** (1,2)
- **Toplam Çözüm Yolu:** 18

