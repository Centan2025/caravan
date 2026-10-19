# MINI RAIL CITY — FIFO FINAL INTEGRITY GATE REPORT

**Branch:** `fix/fifo-parking-slot-trajectory`  
**Base Commit:** `da92a34`  
**Date:** 2026-10-19  
**Status:** Verification Passed (92/92 Unit Tests, Zero Type Errors, Clean Production Build)

---

## 1. Kapasite Aşımı Denetimi (Capacity Overflow)

### Tespit Edilen Risk
`MiniRailParkingController.parkVehicle()` metodunda daha önce kapasite dolduğunda son slota sessizce geri düşme (`slotIndex = Math.max(0, bay.capacity - 1)`) mevcuttu. Bu durum, kapasite aşımında iki aracın aynı görsel slota atanmasına ve üst üste binmesine yol açabilirdi.

### Çözüm
- `slotIndex >= bay.capacity` durumunda sessiz geri düşme kaldırıldı; açıkça `Error` fırlatılması sağlandı:
  ```typescript
  if (slotIndex >= bay.capacity) {
    throw new Error(
      `[MiniRailParkingController] Siding bay '${bayId}' capacity exceeded (capacity: ${bay.capacity}). Cannot park vehicle ${vehicleId}.`
    );
  }
  ```
- İki araca asla aynı slot tahsis edilmez.
- Normal simülasyonda `GraphSwitchNetwork.isNodeOccupied(nodeId)` kontrolü ile `count >= capacity` kuralı işletildiğinden, 3. vagonun cebe girmesi engellenerek `SW_SIDING` giriş makasında `WAITING` durumunda tutulması [`tests/minirail_fifo_integrity_gate.test.ts`](tests/minirail_fifo_integrity_gate.test.ts) ile kanıtlandı.

---

## 2. Çıkış Geometrisi & Erken Çıkış Kısıtlamaları

İkinci FIFO treni için 400 ms'lik slot geçiş süreci adım adım denetlendi:

| Zaman | Tren 2 Durumu | `canReleaseVehicle(2)` | Serbest Bırakma Girişimi | Ray Merkezine Mesafe ($\Delta x$) | Rotasyon |
|---|---|---|---|---|---|
| **0 ms** | Slot 1'de ($y=405$ veya $335$) | `false` | ❌ Hata: `cannot depart while advancing` | **$0.000\text{ px}$** | $\pi/2$ ($90^\circ$ Güney) |
| **100 ms** | %25 İlerleme | `false` | ❌ Hata: `cannot depart while advancing` | **$0.000\text{ px}$** | $\pi/2$ ($90^\circ$ Güney) |
| **200 ms** | %50 İlerleme | `false` | ❌ Hata: `cannot depart while advancing` | **$0.000\text{ px}$** | $\pi/2$ ($90^\circ$ Güney) |
| **400 ms** | Slot 0'a ulaştı | `true` | ✅ Başarılı: $\Delta = 0.000\text{ px}$ çıkış | **$0.000\text{ px}$** | $\pi/2$ ($90^\circ$ Güney) |

### Ray ve Çıkış Geometrisi Sürekliliği
- Park cebi merkez çizgisi ($x = 130$) boyunca geçiş hareketi tamamen düz doğrultuda gerçekleşir. Raydan sapma sıfırdır ($0.0\text{ px}$).
- Slot 0'dan `MERGE` birleşme noktasına kadar 30 örneklemeli Bézier çıkış eğrisinde normal vektörlerin ve teğet sürekliliğinin tam olduğu doğrulandı.

---

## 3. Gerçek Tarayıcı Oynanış Doğrulaması (Level 103-B FIFO)

Puppeteer ve Microsoft Edge ile gerçek tarayıcı ortamında Level 103-B senaryosu baştan sona simüle edildi:

1. **İki Tren Park Halinde:** Her iki tren ayrı yuvalarda (üst ve alt peron) görsel olarak ayrılmış şekilde park etti; üst üste binme yok.
2. **Birinci Tren Çıkışı & İkinci Tren İlerlemesi:** Birinci tren yumuşak eğriyle `MERGE`'e hareket ederken, ikinci tren pürüzsüzce lider slota kaydı.
3. **İkinci Tren Çıkışı:** İkinci tren lider slottan ani sıçrama olmadan kesintisizce ayrıldı.
4. **FIFO Sırası:** İlk giren birinci tren istasyon makasına önce ulaştı; FIFO sırası bozulmadı.
5. **Yeniden Başlatma:** Yeniden başlat butonu tıklandığında park kontrolcüsü ve simülasyon temiz başlangıç durumuna döndü.

---

## 4. Test Özeti

```text
✓ tests/switch.test.ts (13 tests)
✓ tests/graph_switch_equivalence.test.ts (7 tests)
✓ tests/siding.test.ts (8 tests)
✓ tests/chain.test.ts (8 tests)
✓ tests/telemetry.test.ts (5 tests)
✓ tests/track_geometry.test.ts (4 tests)
✓ tests/playtest.test.ts (10 tests)
✓ tests/smoke.test.ts (4 tests)
✓ tests/siding_diversity_correction.test.ts (11 tests)
✓ tests/minirail_fifo_parking_jump.test.ts (5 tests)
✓ tests/minirail_fifo_integrity_gate.test.ts (5 tests)
✓ tests/minirail_parking.test.ts (3 tests)
✓ tests/siding_qa_metrics.test.ts (3 tests)
✓ tests/minirail_topology_validation.test.ts (6 tests)

Test Files:  14 passed (14)
Tests:       92 passed (92)
TypeScript:  0 errors
Vite Build:  dist/assets/index-DRJ-eFne.js (Başarılı)
```
