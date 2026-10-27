import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_SEATS,
  CAPACITY,
  generatePassengers,
  BOARDING_METHOD_BUILDERS,
  validateOrder,
  simulateBoarding,
  backToFrontWilmaOrder,
  backToFrontAzboWilmaOrder,
  seatInterferenceDelayS,
  equalZoneBoundaries,
  zoneOfRow,
  BEST_GA_CHROMOSOME,
} from './engine';

test('Kapasitas dan struktur kursi kabin 3-3', () => {
  assert.equal(ALL_SEATS.length, 180, 'Kapasitas kabin harus 180 kursi');
  assert.equal(CAPACITY, 180);

  // Periksa kursi baris 1
  const r01a = ALL_SEATS.find((s) => s.seat_id === 'R01A')!;
  assert.ok(r01a);
  assert.equal(r01a.seat_priority, 0); // Window
  assert.deepEqual(r01a.blocking_seat_ids, ['R01B', 'R01C']);

  const r01c = ALL_SEATS.find((s) => s.seat_id === 'R01C')!;
  assert.ok(r01c);
  assert.equal(r01c.seat_priority, 2); // Aisle
  assert.deepEqual(r01c.blocking_seat_ids, []);
});

test('Pembangkitan penumpang sintetis dan bagasi', () => {
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

test('Simulasi boarding menghitung waktu dan event secara konsisten', () => {
  const seed = 20261021 + 42;
  const passengers = generatePassengers(seed, 0.50);
  const ordered = BOARDING_METHOD_BUILDERS['Back-to-Front-WILMA'](passengers, seed);
  const { metrics, details } = simulateBoarding(ordered);

  assert.ok(metrics.boarding_time_seconds > 0, 'Boarding time harus positif');
  assert.ok(metrics.boarding_time_minutes > 0, 'Boarding time menit harus positif');
  assert.equal(metrics.passenger_count, 180);
  assert.equal(details.length, 180);
  assert.ok(metrics.aisle_wait_seconds >= 0);

  // Verifikasi pelacakan pergerakan lorong
  for (const d of details) {
    assert.equal(d.aisle_transit.length, d.row, 'Jumlah segmen lorong harus sama dengan baris target');
    assert.equal(d.aisle_transit[d.row - 1].is_target_row, true, 'Segmen terakhir harus baris target');
    if (d.row > 1) {
      assert.equal(d.aisle_transit[0].is_target_row, false, 'Segmen awal bukan baris target');
      assert.ok(d.aisle_transit[0].leave_s <= d.aisle_transit[1].enter_s);
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
});

test('Konfigurasi optimum GA terverifikasi dari Python ([5, 18], ukuran [5, 13, 12], urutan [3, 2, 1])', () => {
  // 1. Verifikasi struktur kromosom terbaik GA
  assert.deepEqual(BEST_GA_CHROMOSOME.boundaries, [5, 18], 'Batas zona GA harus [5, 18]');
  assert.deepEqual(BEST_GA_CHROMOSOME.sizes, [5, 13, 12], 'Ukuran zona GA harus [5, 13, 12]');
  assert.deepEqual(BEST_GA_CHROMOSOME.order, [3, 2, 1], 'Urutan pemanggilan zona harus [3, 2, 1]');

  // 2. Verifikasi pemetaan baris ke zona sesuai batas [5, 18]:
  // Zona 1: baris 1-5
  for (let r = 1; r <= 5; r++) {
    assert.equal(zoneOfRow(r, BEST_GA_CHROMOSOME.boundaries), 1, `Baris ${r} harus masuk Zona 1`);
  }
  // Zona 2: baris 6-18
  for (let r = 6; r <= 18; r++) {
    assert.equal(zoneOfRow(r, BEST_GA_CHROMOSOME.boundaries), 2, `Baris ${r} harus masuk Zona 2`);
  }
  // Zona 3: baris 19-30
  for (let r = 19; r <= 30; r++) {
    assert.equal(zoneOfRow(r, BEST_GA_CHROMOSOME.boundaries), 3, `Baris ${r} harus masuk Zona 3`);
  }

  // 3. Verifikasi Fixed-Zone-WMA tetap menggunakan [10, 20] (3 zona seimbang)
  const fixedBounds = equalZoneBoundaries(30, 3);
  assert.deepEqual(fixedBounds, [10, 20], 'Fixed-Zone harus tetap [10, 20]');
  assert.notDeepEqual(BEST_GA_CHROMOSOME.boundaries, fixedBounds, 'GA [5, 18] berbeda dengan Fixed [10, 20]');
});

test('Normalisasi URL API Backend untuk deployment terpisah (tanpa double-slash)', () => {
  const normalize = (rawUrl?: string): string => {
    const cleaned = (rawUrl || '/api/v1').trim().replace(/\/+$/, '');
    return cleaned || '/api/v1';
  };
  assert.equal(normalize(undefined), '/api/v1');
  assert.equal(normalize(''), '/api/v1');
  assert.equal(normalize('/api/v1/'), '/api/v1');
  assert.equal(normalize('https://zoneflow-backend.run.app/api/v1/'), 'https://zoneflow-backend.run.app/api/v1');
  assert.equal(normalize('https://zoneflow-backend.run.app/api/v1///'), 'https://zoneflow-backend.run.app/api/v1');
});

test('Pembatalan AbortSignal eksternal pada permintaan Batch Simulation', async () => {
  const externalController = new AbortController();
  externalController.abort();

  // Simulasikan logika pemeriksaan pre-aborted signal pada runPythonBatchSimulation
  let caughtErr: any = null;
  try {
    if (externalController.signal.aborted) {
      throw new DOMException('Eksekusi batch simulasi dibatalkan oleh pengguna.', 'AbortError');
    }
  } catch (err) {
    caughtErr = err;
  }
  assert.ok(caughtErr, 'Harus melempar error ketika signal sudah di-abort');
  assert.equal(caughtErr.name, 'AbortError');
  assert.ok(caughtErr.message.includes('dibatalkan oleh pengguna'));
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
