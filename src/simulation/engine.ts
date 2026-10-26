/**
 * ZoneFlow Simulation Engine
 * Replikasi TypeScript dari logika simulasi Python (SimulasiLogikaUI_6_export_untuk_Claude.py)
 * Memastikan independensi logika, determinisme dengan PRNG seed, dan dukungan animasi UI kabin.
 */

export interface SeatInfo {
  seat_id: string;
  row: number;
  seat: "A" | "B" | "C" | "D" | "E" | "F";
  seat_index: number; // 1 to 6
  seat_priority: number; // 0 for A/F (window), 1 for B/E (middle), 2 for C/D (aisle)
  side: "left" | "right";
  blocking_seat_ids: string[];
}

export interface Passenger extends SeatInfo {
  has_bag: boolean;
  bag_time_s: number;
  walk_per_row_s: number;
  sit_time_s: number;
}

export interface AisleTransitSegment {
  row: number;
  enter_s: number;
  leave_s: number;
  is_target_row: boolean;
}

export interface PassengerTimelineDetail {
  queue_position: number;
  seat_id: string;
  row: number;
  seat: string;
  has_bag: boolean;
  entry_time_s: number;
  arrival_target_s: number;
  aisle_wait_s: number;
  occupied_blockers: number;
  seat_interference_s: number;
  bag_stowage_s: number;
  finish_time_s: number;
  aisle_transit: AisleTransitSegment[];
}

export interface SimulationMetrics {
  boarding_time_seconds: number;
  boarding_time_minutes: number;
  aisle_interference_events: number;
  aggregate_aisle_wait_person_seconds: number;
  aisle_wait_seconds: number;
  seat_interference_events: number;
  occupied_blocker_count: number;
  baggage_count: number;
  passenger_count: number;
}

// Konfigurasi Model Baseline (sama dengan Python)
export const N_ROWS = 30;
export const SEATS: Array<"A" | "B" | "C" | "D" | "E" | "F"> = ["A", "B", "C", "D", "E", "F"];
export const LOAD_FACTOR = 1.0;
export const BAGGAGE_RATIOS = [0.50, 0.60, 0.70];

export const WALK_PER_ROW_S = 2.4;
export const WEIBULL_SHAPE = 1.7;
export const WEIBULL_SCALE_S = 16.0;

export const ENTRY_GAP_S = 1.0;
export const AISLE_HEADWAY_S = 1.0;
export const SIT_TIME_S = 2.0;
export const MOVEMENT_TICK_S = 2.4;
export const MOVES_ONE_BLOCKER = 5; // 12.0s
export const MOVES_TWO_BLOCKERS = 9; // 21.6s

export const K_ZONES = 3;
export const MIN_ROWS_PER_ZONE = 5;
export const MAX_ROWS_PER_ZONE = 15;
export const BASE_SEED = 20261021;

// Prioritas kursi: 0 (Window), 1 (Middle), 2 (Aisle)
export const SEAT_PRIORITY: Record<string, number> = {
  A: 0, F: 0,
  B: 1, E: 1,
  C: 2, D: 2,
};

// Pemblokir kursi saat penumpang hendak duduk di barisnya
export const BLOCKERS: Record<string, string[]> = {
  A: ["B", "C"],
  B: ["C"],
  C: [],
  D: [],
  E: ["D"],
  F: ["D", "E"],
};

export const LEFT_SIDE = new Set(["A", "B", "C"]);
export const RIGHT_SIDE = new Set(["D", "E", "F"]);

/**
 * Deterministic Pseudo-Random Number Generator (Mulberry32)
 */
export class DeterministicRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed ? (seed >>> 0) : 123456789;
  }

  // Returns [0, 1)
  random(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Fisher-Yates shuffle
  shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Sample k items without replacement
  sample<T>(array: T[], k: number): T[] {
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, k);
  }

  // Weibull distribution using inverse transform sampling: scale * (-ln(1 - U))^(1 / shape)
  weibull(scale: number, shape: number): number {
    const u = Math.max(1e-12, Math.min(1 - 1e-12, this.random()));
    return scale * Math.pow(-Math.log(1 - u), 1.0 / shape);
  }
}

/**
 * Membentuk daftar 180 kursi kabin generik 3-3 (30 baris)
 */
export function createSeatList(nRows: number = N_ROWS): SeatInfo[] {
  const seats: SeatInfo[] = [];
  for (let row = 1; row <= nRows; row++) {
    const rowStr = row.toString().padStart(2, "0");
    SEATS.forEach((seat, idx) => {
      seats.push({
        seat_id: `R${rowStr}${seat}`,
        row,
        seat,
        seat_index: idx + 1,
        seat_priority: SEAT_PRIORITY[seat],
        side: LEFT_SIDE.has(seat) ? "left" : "right",
        blocking_seat_ids: BLOCKERS[seat].map((b) => `R${rowStr}${b}`),
      });
    });
  }
  return seats;
}

export const ALL_SEATS = createSeatList(N_ROWS);
export const CAPACITY = ALL_SEATS.length; // 180

/**
 * Pembangkit penumpang sintetis dengan seed acak
 */
export function generatePassengers(
  seed: number,
  baggageRatio: number,
  loadFactor: number = LOAD_FACTOR
): Passenger[] {
  if (loadFactor <= 0 || loadFactor > 1) throw new Error("loadFactor harus (0, 1]");
  if (baggageRatio < 0 || baggageRatio > 1) throw new Error("baggageRatio harus [0, 1]");

  const rng = new DeterministicRNG(seed);
  const nPassengers = Math.round(CAPACITY * loadFactor);
  const selected = rng.sample(ALL_SEATS, nPassengers);

  const nBags = Math.round(nPassengers * baggageRatio);
  const baggedIds = new Set(rng.sample(selected, nBags).map((s) => s.seat_id));

  const passengers: Passenger[] = selected.map((seatInfo) => {
    const hasBag = baggedIds.has(seatInfo.seat_id);
    const bagTime = hasBag ? rng.weibull(WEIBULL_SCALE_S, WEIBULL_SHAPE) : 0.0;
    return {
      ...seatInfo,
      has_bag: hasBag,
      bag_time_s: bagTime,
      walk_per_row_s: WALK_PER_ROW_S,
      sit_time_s: SIT_TIME_S,
    };
  });

  return passengers;
}

// Helper Tie Breaker
function createTieBreaker(passengers: Passenger[], seed: number): Record<string, number> {
  const rng = new DeterministicRNG(seed);
  const ids = passengers.map((p) => p.seat_id);
  const shuffled = rng.shuffle(ids);
  const map: Record<string, number> = {};
  shuffled.forEach((id, idx) => {
    map[id] = idx;
  });
  return map;
}

// 1. Random Order
export function randomOrder(passengers: Passenger[], seed = 0): Passenger[] {
  const rng = new DeterministicRNG(seed);
  return rng.shuffle(passengers);
}

// 2. Front to Back
export function frontToBackOrder(passengers: Passenger[], seed = 0): Passenger[] {
  const tie = createTieBreaker(passengers, seed);
  return [...passengers].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return (tie[a.seat_id] || 0) - (tie[b.seat_id] || 0);
  });
}

// 3. Back to Front
export function backToFrontOrder(passengers: Passenger[], seed = 0): Passenger[] {
  const tie = createTieBreaker(passengers, seed);
  return [...passengers].sort((a, b) => {
    if (a.row !== b.row) return b.row - a.row;
    return (tie[a.seat_id] || 0) - (tie[b.seat_id] || 0);
  });
}

// 4. Outside-In / WMA
export function outsideInOrder(passengers: Passenger[]): Passenger[] {
  return [...passengers].sort((a, b) => {
    if (a.seat_priority !== b.seat_priority) return a.seat_priority - b.seat_priority;
    if (a.row !== b.row) return b.row - a.row;
    return a.seat_index - b.seat_index;
  });
}

// 5. Back-to-Front-WILMA
export function backToFrontWilmaOrder(passengers: Passenger[]): Passenger[] {
  return [...passengers].sort((a, b) => {
    if (a.row !== b.row) return b.row - a.row;
    if (a.seat_priority !== b.seat_priority) return a.seat_priority - b.seat_priority;
    return a.seat_index - b.seat_index;
  });
}

// 6. Steffen (staggered-row implementation)
export function steffenOrder(passengers: Passenger[]): Passenger[] {
  const seatGroups: Array<[string, string]> = [
    ["A", "F"], // Window
    ["B", "E"], // Middle
    ["C", "D"], // Aisle
  ];
  const rearParity = N_ROWS % 2;
  const parityOrder = [rearParity, 1 - rearParity];

  const bySeat: Record<string, Passenger[]> = {};
  for (const p of passengers) {
    if (!bySeat[p.seat]) bySeat[p.seat] = [];
    bySeat[p.seat].push(p);
  }

  const order: Passenger[] = [];
  for (const sidePair of seatGroups) {
    for (const parity of parityOrder) {
      for (const seat of sidePair) {
        const group = (bySeat[seat] || []).filter((p) => p.row % 2 === parity);
        group.sort((a, b) => b.row - a.row);
        order.push(...group);
      }
    }
  }
  return order;
}

// 7. Reverse Pyramid (approximation)
export function reversePyramidOrder(passengers: Passenger[]): Passenger[] {
  return [...passengers].sort((a, b) => {
    const keyA1 = N_ROWS - a.row + a.seat_priority;
    const keyB1 = N_ROWS - b.row + b.seat_priority;
    if (keyA1 !== keyB1) return keyA1 - keyB1;

    if (a.seat_priority !== b.seat_priority) return a.seat_priority - b.seat_priority;

    const rowKeyA = N_ROWS - a.row;
    const rowKeyB = N_ROWS - b.row;
    if (rowKeyA !== rowKeyB) return rowKeyA - rowKeyB;

    return a.seat_index - b.seat_index;
  });
}

// Helper Zona
export function equalZoneBoundaries(nRows: number, kZones: number): number[] {
  const sizes: number[] = [];
  for (let i = 0; i < kZones; i++) {
    sizes.push(Math.floor(nRows / kZones) + (i < nRows % kZones ? 1 : 0));
  }
  const bounds: number[] = [];
  let total = 0;
  for (let i = 0; i < sizes.length - 1; i++) {
    total += sizes[i];
    bounds.push(total);
  }
  return bounds;
}

export function zoneOfRow(row: number, boundaries: number[]): number {
  for (let zoneId = 1; zoneId <= boundaries.length; zoneId++) {
    if (row <= boundaries[zoneId - 1]) return zoneId;
  }
  return boundaries.length + 1;
}

// 8. Rotating Zones
export function rotatingZonesOrder(passengers: Passenger[], kZones = 6): Passenger[] {
  const boundaries = equalZoneBoundaries(N_ROWS, kZones);
  const sequence: number[] = [];
  let left = 1;
  let right = kZones;
  let takeRear = true;

  while (left <= right) {
    if (takeRear) {
      sequence.push(right);
      right -= 1;
    } else {
      sequence.push(left);
      left += 1;
    }
    takeRear = !takeRear;
  }

  const rank: Record<number, number> = {};
  sequence.forEach((z, i) => {
    rank[z] = i;
  });

  return [...passengers].sort((a, b) => {
    const zA = zoneOfRow(a.row, boundaries);
    const zB = zoneOfRow(b.row, boundaries);
    const rankDiff = rank[zA] - rank[zB];
    if (rankDiff !== 0) return rankDiff;

    const rowKeyA = zA >= Math.floor(kZones / 2) + 1 ? -a.row : a.row;
    const rowKeyB = zB >= Math.floor(kZones / 2) + 1 ? -b.row : b.row;
    if (rowKeyA !== rowKeyB) return rowKeyA - rowKeyB;

    if (a.seat_priority !== b.seat_priority) return a.seat_priority - b.seat_priority;
    return a.seat_index - b.seat_index;
  });
}

// 9. Modified Optimal
export function modifiedOptimalOrder(passengers: Passenger[]): Passenger[] {
  const getGroup = (p: Passenger) => {
    const even = p.row % 2 === 0;
    if (even && p.side === "left") return 0;
    if (even && p.side === "right") return 1;
    if (!even && p.side === "left") return 2;
    return 3;
  };

  return [...passengers].sort((a, b) => {
    const gA = getGroup(a);
    const gB = getGroup(b);
    if (gA !== gB) return gA - gB;
    if (a.row !== b.row) return b.row - a.row;
    if (a.seat_priority !== b.seat_priority) return a.seat_priority - b.seat_priority;
    return a.seat_index - b.seat_index;
  });
}

// 10. GA-Zone-WMA & Fixed-Zone-WMA
export function gaZoneWmaOrder(
  passengers: Passenger[],
  boundaries: number[],
  zoneOrder: number[]
): Passenger[] {
  const zoneRank: Record<number, number> = {};
  zoneOrder.forEach((zoneId, idx) => {
    zoneRank[zoneId] = idx;
  });

  return [...passengers].sort((a, b) => {
    const zA = zoneOfRow(a.row, boundaries);
    const zB = zoneOfRow(b.row, boundaries);
    const diff = (zoneRank[zA] ?? 999) - (zoneRank[zB] ?? 999);
    if (diff !== 0) return diff;

    if (a.seat_priority !== b.seat_priority) return a.seat_priority - b.seat_priority;
    if (a.row !== b.row) return b.row - a.row;
    return a.seat_index - b.seat_index;
  });
}

export function fixedZoneWmaOrder(passengers: Passenger[]): Passenger[] {
  const boundaries = equalZoneBoundaries(N_ROWS, K_ZONES); // [10, 20]
  return gaZoneWmaOrder(passengers, boundaries, [3, 2, 1]);
}

// Solusi GA dan Enumerasi Eksak terbaik yang ditemukan pada notebook Python
// (Rank 1 dari 546 kandidat partisi 3-zona valid, fitness latih: 291.069s / 4.851m)
export const BEST_GA_CHROMOSOME = {
  boundaries: [5, 18],
  sizes: [5, 13, 12],
  order: [3, 2, 1], // Belakang Zona 3 (R19-30) -> Tengah Zona 2 (R06-18) -> Depan Zona 1 (R01-05)
};

export function gaOptimizedZoneWmaOrder(passengers: Passenger[]): Passenger[] {
  return gaZoneWmaOrder(passengers, BEST_GA_CHROMOSOME.boundaries, BEST_GA_CHROMOSOME.order);
}

// 11. Back-to-Front-AZBO-WILMA (audit method)
export function backToFrontAzboWilmaOrder(passengers: Passenger[]): Passenger[] {
  const boundaries = equalZoneBoundaries(N_ROWS, K_ZONES);
  const zoneOrder = [3, 2, 1];
  const zoneRank: Record<number, number> = {};
  zoneOrder.forEach((id, idx) => {
    zoneRank[id] = idx;
  });

  return [...passengers].sort((a, b) => {
    const zA = zoneOfRow(a.row, boundaries);
    const zB = zoneOfRow(b.row, boundaries);
    const diff = zoneRank[zA] - zoneRank[zB];
    if (diff !== 0) return diff;

    if (a.row !== b.row) return b.row - a.row;
    if (a.seat_priority !== b.seat_priority) return a.seat_priority - b.seat_priority;
    return a.seat_index - b.seat_index;
  });
}

/**
 * Validasi apakah semua penumpang muncul tepat satu kali
 */
export function validateOrder(ordered: Passenger[], original: Passenger[]): boolean {
  if (ordered.length !== original.length) return false;
  const originalIds = new Set(original.map((p) => p.seat_id));
  const orderedIds = new Set(ordered.map((p) => p.seat_id));
  if (originalIds.size !== orderedIds.size) return false;
  for (const id of originalIds) {
    if (!orderedIds.has(id)) return false;
  }
  return true;
}

export function seatInterferenceDelayS(nOccupiedBlockers: number): number {
  if (nOccupiedBlockers <= 0) return 0.0;
  if (nOccupiedBlockers === 1) return MOVES_ONE_BLOCKER * MOVEMENT_TICK_S; // 12.0s
  return MOVES_TWO_BLOCKERS * MOVEMENT_TICK_S; // 21.6s
}

/**
 * Simulator Boarding (Sama persis dengan simulate_boarding di Python)
 */
export function simulateBoarding(
  orderedPassengers: Passenger[],
  entryGapS = ENTRY_GAP_S
): { metrics: SimulationMetrics; details: PassengerTimelineDetail[] } {
  if (!orderedPassengers || orderedPassengers.length === 0) {
    throw new Error("Daftar penumpang kosong");
  }

  const nRows = Math.max(...orderedPassengers.map((p) => p.row));
  const aisleFreeAt: Record<number, number> = {};
  for (let r = 1; r <= nRows; r++) {
    aisleFreeAt[r] = 0.0;
  }

  const seatFinishTime: Record<string, number> = {};
  const finishTimes: Record<string, number> = {};

  let aisleEvents = 0;
  let aisleWaitTotal = 0.0;
  let seatEvents = 0;
  let occupiedBlockerTotal = 0;

  const details: PassengerTimelineDetail[] = [];

  orderedPassengers.forEach((passenger, queueIndex) => {
    let currentTime = queueIndex * entryGapS;
    const targetRow = passenger.row;
    const walkS = passenger.walk_per_row_s;
    let thisAisleWait = 0.0;
    let arrivalTarget = 0.0;
    let blockerCount = 0;
    let conflictDelay = 0.0;

    const aisleTransit: AisleTransitSegment[] = [];

    for (let row = 1; row <= targetRow; row++) {
      const start = Math.max(currentTime, aisleFreeAt[row]);
      const waiting = Math.max(0.0, start - currentTime);
      if (waiting > 1e-9) {
        aisleEvents += 1;
        aisleWaitTotal += waiting;
        thisAisleWait += waiting;
      }
      const arrival = start + walkS;

      if (row < targetRow) {
        // Melintas di segmen lorong
        aisleFreeAt[row] = start + AISLE_HEADWAY_S;
        currentTime = arrival;
        aisleTransit.push({
          row,
          enter_s: start,
          leave_s: arrival,
          is_target_row: false,
        });
      } else {
        // Tiba di baris target
        arrivalTarget = arrival;
        blockerCount = 0;
        for (const blocker of passenger.blocking_seat_ids) {
          if (
            seatFinishTime[blocker] !== undefined &&
            seatFinishTime[blocker] <= arrival + 1e-9
          ) {
            blockerCount += 1;
          }
        }

        if (blockerCount > 0) {
          seatEvents += 1;
          occupiedBlockerTotal += blockerCount;
        }

        conflictDelay = seatInterferenceDelayS(blockerCount);
        const finish =
          arrival + passenger.bag_time_s + conflictDelay + passenger.sit_time_s;

        aisleFreeAt[targetRow] = finish;
        seatFinishTime[passenger.seat_id] = finish;
        finishTimes[passenger.seat_id] = finish;

        aisleTransit.push({
          row: targetRow,
          enter_s: start,
          leave_s: finish,
          is_target_row: true,
        });
      }
    }

    details.push({
      queue_position: queueIndex + 1,
      seat_id: passenger.seat_id,
      row: targetRow,
      seat: passenger.seat,
      has_bag: passenger.has_bag,
      entry_time_s: queueIndex * entryGapS,
      arrival_target_s: arrivalTarget,
      aisle_wait_s: thisAisleWait,
      occupied_blockers: blockerCount,
      seat_interference_s: conflictDelay,
      bag_stowage_s: passenger.bag_time_s,
      finish_time_s: finishTimes[passenger.seat_id],
      aisle_transit: aisleTransit,
    });
  });

  const totalTime = Math.max(...Object.values(finishTimes));

  const metrics: SimulationMetrics = {
    boarding_time_seconds: totalTime,
    boarding_time_minutes: totalTime / 60,
    aisle_interference_events: aisleEvents,
    aggregate_aisle_wait_person_seconds: aisleWaitTotal,
    aisle_wait_seconds: aisleWaitTotal,
    seat_interference_events: seatEvents,
    occupied_blocker_count: occupiedBlockerTotal,
    baggage_count: orderedPassengers.filter((p) => p.has_bag).length,
    passenger_count: orderedPassengers.length,
  };

  return { metrics, details };
}

/**
 * Dictionary of all available method builders for easy UI dispatch.
 * Catatan transparansi ilmiah: "Exhaustive-Zone-WMA" pada demo browser saat ini
 * mengadopsi konfigurasi hasil audit eksak dari notebook Python (batas [5, 18], ukuran [5, 13, 12], urutan [3, 2, 1])
 * dan belum mengeksekusi enumerasi 546 kandidat secara live per klik.
 */
export const BOARDING_METHOD_BUILDERS: Record<
  string,
  (passengers: Passenger[], seed?: number) => Passenger[]
> = {
  "Back-to-Front-WILMA": (p) => backToFrontWilmaOrder(p),
  "Reverse Pyramid (approximation)": (p) => reversePyramidOrder(p),
  "GA-Zone-WMA": (p) => gaOptimizedZoneWmaOrder(p),
  "Exhaustive-Zone-WMA": (p) => gaOptimizedZoneWmaOrder(p), // Menggunakan konfigurasi optimum hasil audit eksak Python
  "Fixed-Zone-WMA": (p) => fixedZoneWmaOrder(p),
  "Back-to-Front": (p, seed = 0) => backToFrontOrder(p, seed),
  "Outside-In/WMA": (p) => outsideInOrder(p),
  "Modified Optimal (implementation variant)": (p) => modifiedOptimalOrder(p),
  "Steffen (staggered-row implementation)": (p) => steffenOrder(p),
  Random: (p, seed = 0) => randomOrder(p, seed),
  "Rotating Zones": (p) => rotatingZonesOrder(p),
  "Front-to-Back": (p, seed = 0) => frontToBackOrder(p, seed),
};
