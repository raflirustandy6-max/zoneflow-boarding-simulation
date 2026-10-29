import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_SEATS,
  CAPACITY,
  AIRCRAFT_LAYOUTS,
  createSeatListForLayout,
  generatePassengers,
  generatePassengersForScenario,
  BOARDING_METHOD_BUILDERS,
  validateOrder,
  simulateBoarding,
  backToFrontWilmaOrder,
  backToFrontAzboWilmaOrder,
  seatInterferenceDelayS,
  equalZoneBoundaries,
  zoneOfRow,
  BEST_GA_CHROMOSOME,
  computeDeterministicBaggageCount,
  runAzboOptimizationForScenario,
} from './engine';

test('Kapasitas dan struktur kursi kabin 3-3', () => {
  assert.equal(ALL_SEATS.length, 180, 'Kapasitas kabin harus 180 kursi');
  assert.equal(CAPACITY, 180);

  const r01a = ALL_SEATS.find((s) => s.seat_id === 'R01A')!;
  assert.ok(r01a);
  assert.equal(r01a.seat_priority, 0); // Window
  assert.deepEqual(r01a.blocking_seat_ids, ['R01B', 'R01C']);

  const r01c = ALL_SEATS.find((s) => s.seat_id === 'R01C')!;
  assert.ok(r01c);
  assert.equal(r01c.seat_priority, 2); // Aisle
  assert.deepEqual(r01c.blocking_seat_ids, []);
});

test('Pembangkitan penumpang sintetis dan jumlah bagasi deterministik', () => {
  const seed = 20261021;
  const passengers50 = generatePassengers(seed, 0.50);
  assert.equal(passengers50.length, 180);
  const bagCount50 = passengers50.filter((p) => p.has_bag).length;
  assert.equal(bagCount50, 90, '50% dari 180 harus tepat 90 penumpang bawa bagasi');

  const passengers60 = generatePassengers(seed, 0.60);
  const bagCount60 = passengers60.filter((p) => p.has_bag).length;
  assert.equal(bagCount60, 108, '60% dari 180 harus 108');

  const passengers70 = generatePassengers(seed, 0.70);
  const bagCount70 = passengers70.filter((p) => p.has_bag).length;
  assert.equal(bagCount70, 126, '70% dari 180 harus 126');

  assert.equal(computeDeterministicBaggageCount(180, 70), 126);
  assert.equal(computeDeterministicBaggageCount(72, 70), 50);
  assert.equal(computeDeterministicBaggageCount(125, 70), 88);
});

test('Semua metode boarding menghasilkan 180 kursi unik valid', () => {
  const seed = 20261021 + 7;
  const passengers = generatePassengers(seed, 0.60);

  for (const [name, builder] of Object.entries(BOARDING_METHOD_BUILDERS)) {
    const ordered = builder(passengers, 1234);
    assert.equal(ordered.length, 180, `${name} harus memiliki 180 kursi`);
    assert.ok(validateOrder(ordered, passengers), `${name} harus memuat semua kursi asli tepat sekali`);
  }
});

test('Audit ekuivalensi BTF-AZBO-WILMA dan Back-to-Front-WILMA', () => {
  const seed = 20261021 + 333;
  const passengers = generatePassengers(seed, 0.60);
  const bfa = backToFrontAzboWilmaOrder(passengers);
  const bfw = backToFrontWilmaOrder(passengers);

  const idsA = bfa.map((p) => p.seat_id);
  const idsB = bfw.map((p) => p.seat_id);
  assert.deepEqual(idsA, idsB, 'BTF-AZBO-WILMA harus identik dengan Back-to-Front-WILMA pada zona kontigu rear-to-front');
});

test('Penghitungan delay seat interference', () => {
  assert.equal(seatInterferenceDelayS(0), 0);
  assert.ok(Math.abs(seatInterferenceDelayS(1) - 12.0) < 1e-6); // 5 * 2.4s
  assert.ok(Math.abs(seatInterferenceDelayS(2) - 21.6) < 1e-6); // 9 * 2.4s
});

test('Simulasi boarding dan pelacakan segmen lorong per baris', () => {
  const seed = 20261021 + 42;
  const passengers = generatePassengers(seed, 0.50);
  const ordered = BOARDING_METHOD_BUILDERS['Back-to-Front-WILMA'](passengers, seed);
  const { metrics, details } = simulateBoarding(ordered);

  assert.ok(metrics.boarding_time_seconds > 0, 'Boarding time harus positif');
  assert.ok(metrics.boarding_time_minutes > 0, 'Boarding time menit harus positif');
  assert.equal(metrics.passenger_count, 180);
  assert.equal(details.length, 180);
  assert.ok(metrics.aisle_wait_seconds >= 0);

  for (const d of details) {
    assert.equal(d.aisle_transit.length, d.row, 'Jumlah segmen lorong harus sama dengan baris target');
    assert.equal(d.aisle_transit[d.row - 1].is_target_row, true, 'Segmen terakhir harus baris target');
    if (d.row > 1) {
      assert.equal(d.aisle_transit[0].is_target_row, false, 'Segmen awal bukan baris target');
      assert.ok(d.aisle_transit[0].leave_s <= d.aisle_transit[1].enter_s + 1e-6);
    }
  }
});

test('Pembagian zona dan pencarian zona', () => {
  const bounds = equalZoneBoundaries(30, 3);
  assert.deepEqual(bounds, [10, 20]);
  assert.equal(zoneOfRow(1, bounds), 1);
  assert.equal(zoneOfRow(10, bounds), 1);
  assert.equal(zoneOfRow(11, bounds), 2);
  assert.equal(zoneOfRow(20, bounds), 2);
  assert.equal(zoneOfRow(21, bounds), 3);
  assert.equal(zoneOfRow(30, bounds), 3);
  assert.deepEqual(BEST_GA_CHROMOSOME.boundaries, [5, 18]);
});

test('Deteksi Content-Type JSON pada apiClient menolak fallback HTML statis', async () => {
  const { isJsonContentType } = await import('../services/apiClient');
  assert.equal(isJsonContentType('application/json'), true);
  assert.equal(isJsonContentType('application/json; charset=utf-8'), true);
  assert.equal(isJsonContentType('text/html; charset=utf-8'), false);
  assert.equal(isJsonContentType('text/plain'), false);
  assert.equal(isJsonContentType(null), false);
  assert.equal(isJsonContentType(undefined), false);
});

test('Verifikasi multi-layout kabin pesawat (ATR 72 2-2, A220 2-3, dan B737 3-3)', () => {
  const atr72 = AIRCRAFT_LAYOUTS.find((l) => l.id === 'atr72-600-72')!;
  assert.ok(atr72);
  assert.equal(atr72.capacity, 72);
  const atrSeats = createSeatListForLayout(atr72);
  assert.equal(atrSeats.length, 72);
  const atrR01A = atrSeats.find((s) => s.seat_id === 'R01A')!;
  assert.equal(atrR01A.seat_priority, 0);
  assert.deepEqual(atrR01A.blocking_seat_ids, ['R01B']);

  const a220 = AIRCRAFT_LAYOUTS.find((l) => l.id === 'a220-100-125')!;
  assert.ok(a220);
  assert.equal(a220.capacity, 125);
  const a220Seats = createSeatListForLayout(a220);
  assert.equal(a220Seats.length, 125);
});

test('Sensitivitas waktu boarding terhadap jumlah penumpang membawa bagasi kabin', () => {
  const atr72 = AIRCRAFT_LAYOUTS.find((l) => l.id === 'atr72-600-72')!;
  const paxList = generatePassengersForScenario({
    seed: 20261021,
    passengerCount: 72,
    baggagePassengerCount: 50,
    layout: atr72,
  });
  assert.equal(paxList.length, 72);
  assert.equal(paxList.filter((p) => p.has_bag).length, 50);

  const summaryNoBags = runAzboOptimizationForScenario({
    layout: atr72,
    passengerCount: 72,
    baggagePassengerCount: 0,
    seed: 20261021,
  });
  const summaryWithBags = runAzboOptimizationForScenario({
    layout: atr72,
    passengerCount: 72,
    baggagePassengerCount: 50,
    seed: 20261021,
  });

  assert.equal(summaryNoBags.scenario.passengerCount, 72);
  assert.equal(summaryNoBags.scenario.baggagePassengerCount, 0);
  assert.equal(summaryWithBags.scenario.baggagePassengerCount, 50);
  assert.equal(summaryWithBags.evaluatedMethods.length, 12);
  assert.equal(summaryWithBags.recommendedMethod.rank, 1);
  assert.ok(
    summaryWithBags.recommendedMethod.metrics.boarding_time_seconds >
      summaryNoBags.recommendedMethod.metrics.boarding_time_seconds,
    'Waktu boarding dengan 50 penumpang berbagasi harus lebih tinggi dibandingkan 0 penumpang berbagasi'
  );
});
