/**
 * ZoneFlow Simulation Engine
 * Replikasi TypeScript dari logika simulasi Python (SimulasiLogikaUI_6_export_untuk_Claude.py)
 * Memastikan independensi logika, determinisme dengan PRNG seed, dan dukungan animasi UI kabin.
 */

import {
  buildAzboV2EndpointUrl,
  checkAzboV2Health,
  isJsonContentType,
} from "../services/apiClient";
import { runAzboV2InBrowserPyodide } from "./pyodideClient";

export interface SeatInfo {
  seat_id: string;
  row: number;
  seat: "A" | "B" | "C" | "D" | "E" | "F";
  seat_index: number; // 1 to N seats per row
  seat_priority: number; // 0 for window, 1 for middle, 2 for aisle
  side: "left" | "right";
  blocking_seat_ids: string[];
}

export interface AircraftLayoutConfig {
  id: string;
  name: string;
  variant: string;
  manufacturer: string;
  category: string;
  seatConfiguration: "2-2" | "2-3" | "3-3";
  seatsPerRow: number;
  leftSeats: Array<"A" | "B" | "C" | "D" | "E" | "F">;
  rightSeats: Array<"A" | "B" | "C" | "D" | "E" | "F">;
  nRows: number;
  aisleCount: number;
  capacity: number;
  seatPriorityMap: Record<string, number>;
  blockersMap: Record<string, string[]>;
  verificationStatus: string;
  sourceCitation: string;
  schematicLabel: string;
  notes: string;
  isBaseline180: boolean;
}

export const AIRCRAFT_LAYOUTS: AircraftLayoutConfig[] = [
  {
    id: "b737-800-180",
    name: "Boeing 737-800 / Airbus A320-200",
    variant: "Single-Class High-Density 3-3 (180 Kursi)",
    manufacturer: "Boeing / Airbus",
    category: "Narrow-Body Jet Lorong Tunggal",
    seatConfiguration: "3-3",
    seatsPerRow: 6,
    leftSeats: ["A", "B", "C"],
    rightSeats: ["D", "E", "F"],
    nRows: 30,
    aisleCount: 1,
    capacity: 180,
    seatPriorityMap: { A: 0, B: 1, C: 2, D: 2, E: 1, F: 0 },
    blockersMap: {
      A: ["B", "C"],
      B: ["C"],
      C: [],
      D: [],
      E: ["D"],
      F: ["D", "E"],
    },
    verificationStatus: "Terverifikasi — Konfigurasi Utama Simulator ZoneFlow (Parameter P014 & SRC01)",
    sourceCitation: "Parameter P014; SRC01 (Possamai Viertel et al., 2025);SRC03 (Moreira et al., 2023)",
    schematicLabel: "Ilustrasi skematis",
    notes:
      "Kabin lorong tunggal 30 baris × 6 kursi (A, B, C di kiri; D, E, F di kanan). Digunakan sebagai baseline eksperimen 180 kursi dan optimasi pembagian 3 zona.",
    isBaseline180: true,
  },
  {
    id: "atr72-600-72",
    name: "ATR 72-600",
    variant: "Regional Turboprop Single-Class 2-2 (72 Kursi)",
    manufacturer: "ATR (Avions de Transport Régional)",
    category: "Regional Turboprop Lorong Tunggal",
    seatConfiguration: "2-2",
    seatsPerRow: 4,
    leftSeats: ["A", "B"],
    rightSeats: ["C", "D"],
    nRows: 18,
    aisleCount: 1,
    capacity: 72,
    seatPriorityMap: { A: 0, B: 2, C: 2, D: 0 },
    blockersMap: {
      A: ["B"],
      B: [],
      C: [],
      D: ["C"],
    },
    verificationStatus: "Terverifikasi — Konfigurasi 2-2 Regional (Parameter P001 & P002 / SRC01)",
    sourceCitation: "Parameter P001 & P002; SRC01 (Possamai Viertel et al., 2025)",
    schematicLabel: "Ilustrasi skematis",
    notes:
      "Susunan 2-2 (4 kursi per baris: A/D kursi jendela, B/C kursi lorong) tanpa kursi tengah sesuai Parameter P002 pada studi penerbangan regional (18 baris × 4 kursi = 72 kursi).",
    isBaseline180: false,
  },
  {
    id: "a220-100-125",
    name: "Airbus A220-100",
    variant: "Regional Jet Single-Class Asimetris 2-3 (125 Kursi)",
    manufacturer: "Airbus",
    category: "Regional / Narrow-Body Jet Asimetris",
    seatConfiguration: "2-3",
    seatsPerRow: 5,
    leftSeats: ["A", "B"],
    rightSeats: ["C", "D", "E"],
    nRows: 25,
    aisleCount: 1,
    capacity: 125,
    seatPriorityMap: { A: 0, B: 2, C: 2, D: 1, E: 0 },
    blockersMap: {
      A: ["B"],
      B: [],
      C: [],
      D: ["C"],
      E: ["C", "D"],
    },
    verificationStatus: "Terverifikasi — Tata Letak Asimetris 2-3 (Parameter P001 & P003 / SRC01)",
    sourceCitation: "Parameter P001 & P003; SRC01 (Possamai Viertel et al., 2025)",
    schematicLabel: "Ilustrasi skematis",
    notes:
      "Susunan asimetris 2-3 (5 kursi per baris: sisi kiri A jendela, B lorong; sisi kanan C lorong, D tengah, E jendela) sesuai Parameter P003 (25 baris × 5 kursi = 125 kursi).",
    isBaseline180: false,
  },
  {
    id: "b737-700-144",
    name: "Boeing 737-700",
    variant: "Single-Class 3-3 (144 Kursi)",
    manufacturer: "Boeing",
    category: "Narrow-Body Jet Lorong Tunggal",
    seatConfiguration: "3-3",
    seatsPerRow: 6,
    leftSeats: ["A", "B", "C"],
    rightSeats: ["D", "E", "F"],
    nRows: 24,
    aisleCount: 1,
    capacity: 144,
    seatPriorityMap: { A: 0, B: 1, C: 2, D: 2, E: 1, F: 0 },
    blockersMap: {
      A: ["B", "C"],
      B: ["C"],
      C: [],
      D: [],
      E: ["D"],
      F: ["D", "E"],
    },
    verificationStatus: "Konfigurasi Skematis Keluarga B737 3-3 (24 Baris × 6 Kursi)",
    sourceCitation: "Adaptasi Parameter P014 untuk varian kabin 24 baris (144 kursi)",
    schematicLabel: "Ilustrasi skematis",
    notes:
      "Varian kabin lebih pendek dengan susunan 3-3 identik (24 baris × 6 kursi = 144 kursi) untuk mengevaluasi sensitivitas jumlah baris terhadap strategi pembagian zona.",
    isBaseline180: false,
  },
];

export const UNSUPPORTED_AIRCRAFT_REFERENCES = [
  {
    id: "bwb-multi-aisle",
    name: "Blended Wing Body (BWB)",
    variant: "Konsep Kabin Multi-Lorong (SRC02 — Dong et al., 2025)",
    reason:
      "Belum didukung oleh simulator saat ini karena model pergerakan ZoneFlow v3 dirancang khusus untuk pesawat lorong tunggal (single-aisle). Hasil studi BWB tidak dapat digeneralisasi ke pesawat lorong tunggal.",
  },
];

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

export interface AisleCellInterval {
  cell: number;
  row: number;
  enter_s: number;
  leave_s: number;
}

export interface PassengerTimelineDetail {
  queue_position: number;
  seat_id: string;
  row: number;
  seat: string;
  has_bag: boolean;
  speed_m_s?: number;
  entry_time_s: number;
  arrival_target_s: number;
  aisle_wait_s: number;
  occupied_blockers: number;
  seat_interference_s: number;
  bag_stowage_s: number;
  finish_time_s: number;
  aisle_transit: AisleTransitSegment[];
  cell_intervals?: AisleCellInterval[];
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
 * Membentuk daftar kursi berdasarkan konfigurasi layout pesawat yang dipilih
 */
export function createSeatListForLayout(layout: AircraftLayoutConfig): SeatInfo[] {
  const seats: SeatInfo[] = [];
  const allCols = [...layout.leftSeats, ...layout.rightSeats];
  const leftSet = new Set(layout.leftSeats);

  for (let row = 1; row <= layout.nRows; row++) {
    const rowStr = row.toString().padStart(2, "0");
    allCols.forEach((seat, idx) => {
      seats.push({
        seat_id: `R${rowStr}${seat}`,
        row,
        seat,
        seat_index: idx + 1,
        seat_priority: layout.seatPriorityMap[seat] ?? 2,
        side: leftSet.has(seat) ? "left" : "right",
        blocking_seat_ids: (layout.blockersMap[seat] || []).map((b) => `R${rowStr}${b}`),
      });
    });
  }
  return seats;
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
 * Pembangkit penumpang sintetis dengan seed acak (Kompatibel penuh dengan baseline 180 kursi)
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

/**
 * Pembangkit penumpang berdasarkan layout pesawat, jumlah penumpang manual, dan jumlah penumpang membawa bagasi kabin manual (Orang)
 */
export function generatePassengersForScenario(options: {
  seed: number;
  passengerCount: number;
  baggagePassengerCount: number;
  layout?: AircraftLayoutConfig;
}): Passenger[] {
  const layout = options.layout ?? AIRCRAFT_LAYOUTS[0];
  const { seed, passengerCount, baggagePassengerCount } = options;

  if (!Number.isInteger(passengerCount) || passengerCount < 0 || passengerCount > layout.capacity) {
    throw new Error(
      `Jumlah penumpang harus bilangan bulat antara 0 hingga ${layout.capacity} kursi.`
    );
  }
  if (
    !Number.isInteger(baggagePassengerCount) ||
    baggagePassengerCount < 0 ||
    baggagePassengerCount > passengerCount
  ) {
    throw new Error(
      `Jumlah penumpang membawa bagasi kabin harus bilangan bulat antara 0 hingga ${passengerCount} orang.`
    );
  }
  if (passengerCount === 0) {
    return [];
  }

  const seatPool = layout.isBaseline180 ? ALL_SEATS : createSeatListForLayout(layout);
  const rng = new DeterministicRNG(seed);
  const selected = rng.sample(seatPool, passengerCount);

  const nBags = baggagePassengerCount;
  const baggedIds = new Set(rng.sample(selected, nBags).map((s) => s.seat_id));

  return selected.map((seatInfo) => {
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
export function steffenOrder(passengers: Passenger[], nRows: number = N_ROWS): Passenger[] {
  if (passengers.length === 0) return [];
  // Gunakan pengelompokan standar untuk 3-3 agar 100% identik dengan Python pada kabin 3-3,
  // dan adaptif berdasarkan prioritas kursi (Window -> Middle -> Aisle) untuk layout 2-2 atau 2-3
  const presentSeats = new Set(passengers.map((p) => p.seat));
  const isStandard33 =
    nRows === N_ROWS &&
    presentSeats.size <= 6 &&
    passengers.every((p) =>
      p.seat === "A" || p.seat === "F"
        ? p.seat_priority === 0
        : p.seat === "B" || p.seat === "E"
        ? p.seat_priority === 1
        : p.seat_priority === 2
    );

  const rearParity = nRows % 2;
  const parityOrder = [rearParity, 1 - rearParity];

  if (isStandard33) {
    const seatGroups: Array<[string, string]> = [
      ["A", "F"], // Window
      ["B", "E"], // Middle
      ["C", "D"], // Aisle
    ];
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

  // Untuk layout 2-2 (ATR 72) atau 2-3 (A220): kelompokkan berdasarkan kelas kursi (0=Window, 1=Middle, 2=Aisle),
  // paritas baris berselang-seling, dan sisi kiri/kanan bergantian.
  const order: Passenger[] = [];
  for (const priority of [0, 1, 2]) {
    for (const parity of parityOrder) {
      for (const side of ["left", "right"] as const) {
        const group = passengers.filter(
          (p) => p.seat_priority === priority && p.row % 2 === parity && p.side === side
        );
        group.sort((a, b) => (b.row !== a.row ? b.row - a.row : a.seat_index - b.seat_index));
        order.push(...group);
      }
    }
  }
  return order;
}

// 7. Reverse Pyramid (approximation)
export function reversePyramidOrder(passengers: Passenger[], nRows: number = N_ROWS): Passenger[] {
  return [...passengers].sort((a, b) => {
    const keyA1 = nRows - a.row + a.seat_priority;
    const keyB1 = nRows - b.row + b.seat_priority;
    if (keyA1 !== keyB1) return keyA1 - keyB1;

    if (a.seat_priority !== b.seat_priority) return a.seat_priority - b.seat_priority;

    const rowKeyA = nRows - a.row;
    const rowKeyB = nRows - b.row;
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
export function rotatingZonesOrder(
  passengers: Passenger[],
  kZones = 6,
  nRows: number = N_ROWS
): Passenger[] {
  const effectiveZones = Math.min(kZones, Math.max(2, nRows));
  const boundaries = equalZoneBoundaries(nRows, effectiveZones);
  const sequence: number[] = [];
  let left = 1;
  let right = effectiveZones;
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

    const rowKeyA = zA >= Math.floor(effectiveZones / 2) + 1 ? -a.row : a.row;
    const rowKeyB = zB >= Math.floor(effectiveZones / 2) + 1 ? -b.row : b.row;
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

export function fixedZoneWmaOrder(passengers: Passenger[], nRows: number = N_ROWS): Passenger[] {
  const boundaries = equalZoneBoundaries(nRows, K_ZONES);
  return gaZoneWmaOrder(passengers, boundaries, [3, 2, 1]);
}

// Solusi GA dan Enumerasi Eksak terbaik yang ditemukan pada notebook Python untuk kabin 30 baris
// (Rank 1 dari 546 kandidat partisi 3-zona valid, waktu boarding latih: 291.069s / 4.851m)
export const BEST_GA_CHROMOSOME = {
  boundaries: [5, 18],
  sizes: [5, 13, 12],
  order: [3, 2, 1], // Belakang Zona 3 (R19-30) -> Tengah Zona 2 (R06-18) -> Depan Zona 1 (R01-05)
};

export function scaledGaZoneBoundaries(nRows: number): number[] {
  if (nRows === N_ROWS) return [...BEST_GA_CHROMOSOME.boundaries];
  const b1 = Math.max(2, Math.round((nRows * 5) / 30));
  const b2 = Math.min(nRows - 2, Math.max(b1 + 2, Math.round((nRows * 18) / 30)));
  return [b1, b2];
}

export function gaOptimizedZoneWmaOrder(
  passengers: Passenger[],
  nRows: number = N_ROWS
): Passenger[] {
  const bounds = scaledGaZoneBoundaries(nRows);
  return gaZoneWmaOrder(passengers, bounds, BEST_GA_CHROMOSOME.order);
}

// 11. Back-to-Front-AZBO-WILMA (audit method)
export function backToFrontAzboWilmaOrder(
  passengers: Passenger[],
  nRows: number = N_ROWS
): Passenger[] {
  const boundaries = equalZoneBoundaries(nRows, K_ZONES);
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
 */
export const BOARDING_METHOD_BUILDERS: Record<
  string,
  (passengers: Passenger[], seed?: number) => Passenger[]
> = {
  "Back-to-Front-WILMA": (p) => backToFrontWilmaOrder(p),
  "Reverse Pyramid (approximation)": (p) => reversePyramidOrder(p),
  "GA-Zone-WMA": (p) => gaOptimizedZoneWmaOrder(p),
  "Exhaustive-Zone-WMA": (p) => gaOptimizedZoneWmaOrder(p),
  "Fixed-Zone-WMA": (p) => fixedZoneWmaOrder(p),
  "Back-to-Front": (p, seed = 0) => backToFrontOrder(p, seed),
  "Outside-In/WMA": (p) => outsideInOrder(p),
  "Modified Optimal (implementation variant)": (p) => modifiedOptimalOrder(p),
  "Steffen (staggered-row implementation)": (p) => steffenOrder(p),
  Random: (p, seed = 0) => randomOrder(p, seed),
  "Rotating Zones": (p) => rotatingZonesOrder(p),
  "Front-to-Back": (p, seed = 0) => frontToBackOrder(p, seed),
};

export interface BoardingMethodSpec {
  id: string;
  name: string;
  shortLabel: string;
  category: string;
  sourceCitation: string;
  sequenceRule: string;
  requiredParameters: string;
  limitations: string;
  supportedInSimulator: boolean;
  unsupportedReason?: string;
}

export const BOARDING_METHOD_CATALOG: BoardingMethodSpec[] = [
  {
    id: "GA-Zone-WMA",
    name: "GA-Zone-WMA",
    shortLabel: "Boarding Berbasis Zona (Hasil Optimasi AZBO)",
    category: "Berbasis Zona (Optimasi GA)",
    sourceCitation: "SRC12 (Soolaki et al., 2012); Blueprint AZBO V2",
    sequenceRule:
      "Kabin dibagi menjadi K zona dengan batas baris dan urutan pemanggilan hasil optimasi Genetic Algorithm; di dalam tiap zona diterapkan aturan WMA atau BTF.",
    requiredParameters: "Batas baris zona, urutan pemanggilan zona, dan aturan internal zona.",
    limitations:
      "Menggunakan pencarian heuristik Genetic Algorithm variabel-K pada replikasi pelatihan.",
    supportedInSimulator: true,
  },
  {
    id: "Outside-In/WMA",
    name: "Outside-In/WMA",
    shortLabel: "Outside-In (Window-Middle-Aisle)",
    category: "Prioritas Posisi Kursi",
    sourceCitation: "SRC01; SRC03; SRC09; SRC10",
    sequenceRule:
      "Kelompok 1: seluruh kursi Jendela; Kelompok 2: seluruh kursi Tengah (jika ada); Kelompok 3: seluruh kursi Lorong. Di dalam kelompok diurutkan dari belakang ke depan.",
    requiredParameters: "Pemetaan posisi kursi (Window, Middle, Aisle) sesuai susunan kabin (2-2, 2-3, atau 3-3).",
    limitations:
      "Pada pesawat konfigurasi 2-2 (ATR 72) tidak terdapat kursi tengah, sehingga hanya terdiri atas kelompok Jendela dan Lorong.",
    supportedInSimulator: true,
  },
  {
    id: "Reverse Pyramid (approximation)",
    name: "Reverse Pyramid (approximation)",
    shortLabel: "Reverse Pyramid (Aproksimasi)",
    category: "Kombinasi Diagonal Baris & Kursi",
    sourceCitation: "SRC01; SRC10",
    sequenceRule:
      "Menggabungkan jarak baris dari belakang dan prioritas kursi luar ke dalam secara diagonal.",
    requiredParameters: "Jumlah baris kabin dan indeks prioritas posisi kursi.",
    limitations:
      "Merupakan aproksimasi rumus prioritas v3; bukan reproduksi algoritma komersial tertutup milik maskapai tertentu.",
    supportedInSimulator: true,
  },
  {
    id: "Steffen (staggered-row implementation)",
    name: "Steffen (staggered-row implementation)",
    shortLabel: "Steffen (Baris Berselang-seling)",
    category: "Urutan Kursi Berselang-seling",
    sourceCitation: "SRC07; SRC08; SRC03",
    sequenceRule:
      "Urutan Jendela → Tengah → Lorong dengan nomor baris berselang-seling (genap/ganjil) dari belakang ke depan dan sisi kabin bergantian.",
    requiredParameters: "Paritas baris (genap/ganjil), sisi kabin (kiri/kanan), dan kelas kursi.",
    limitations:
      "Sangat bergantung pada kepatuhan antrean penuh dan sensitif terhadap asumsi penutupan lorong saat menyimpan bagasi.",
    supportedInSimulator: true,
  },
  {
    id: "Modified Optimal (implementation variant)",
    name: "Modified Optimal (implementation variant)",
    shortLabel: "Modified Optimal (4 Kelompok)",
    category: "Kelompok Paritas Baris & Sisi Kabin",
    sourceCitation: "SRC01; SRC10",
    sequenceRule:
      "Kelompok 1: baris genap kiri; Kelompok 2: baris genap kanan; Kelompok 3: baris ganjil kiri; Kelompok 4: baris ganjil kanan.",
    requiredParameters: "Paritas nomor baris dan pemisahan sisi kiri/kanan lorong.",
    limitations:
      "Aturan pengurutan di dalam masing-masing kelompok menggunakan konvensi belakang ke depan dan luar ke dalam.",
    supportedInSimulator: true,
  },
  {
    id: "Back-to-Front",
    name: "Back-to-Front",
    shortLabel: "Back-to-Front (Belakang ke Depan)",
    category: "Urutan Baris Konvensional",
    sourceCitation: "SRC01; SRC02; SRC09; SRC10",
    sequenceRule:
      "Penumpang masuk dari baris paling belakang menuju baris paling depan; urutan kursi di dalam baris yang sama diacak.",
    requiredParameters: "Nomor baris kursi dan angka awal pengacakan (seed) untuk pemecah seri.",
    limitations:
      "Rentan menimbulkan antrean di lorong dan halangan kursi di dalam baris yang sama.",
    supportedInSimulator: true,
  },
  {
    id: "Rotating Zones",
    name: "Rotating Zones",
    shortLabel: "Rotating Zones (Zona Berputar)",
    category: "Blok Zona Bergantian",
    sourceCitation: "SRC01; SRC10; SRC11; SRC15",
    sequenceRule:
      "Kabin dibagi menjadi 6 blok zona; pemanggilan bergantian dari zona paling belakang lalu paling depan menuju bagian tengah kabin.",
    requiredParameters: "Jumlah blok zona (K = 6) dan jumlah baris kabin.",
    limitations:
      "Penumpang zona depan yang masuk lebih awal dapat menghalangi perjalanan penumpang zona tengah.",
    supportedInSimulator: true,
  },
  {
    id: "Random",
    name: "Random",
    shortLabel: "Random (Acak / Tanpa Zona)",
    category: "Urutan Kedatangan Acak",
    sourceCitation: "SRC01; SRC09; SRC10",
    sequenceRule:
      "Penumpang masuk sesuai urutan kedatangan acak tanpa pengelompokan baris maupun posisi kursi.",
    requiredParameters: "Angka awal pengacakan (seed) untuk reproduksibilitas urutan.",
    limitations: "Digunakan sebagai pembanding dasar tanpa pengaturan urutan operasional.",
    supportedInSimulator: true,
  },
  {
    id: "Front-to-Back",
    name: "Front-to-Back",
    shortLabel: "Depan ke Belakang (Front-to-Back)",
    category: "Berdasarkan Baris (Depan ke Belakang)",
    sourceCitation:
      "Płanda, B., & Skorupski, J. (2025). Model for Evaluation of Aircraft Boarding Under Disturbances. Aerospace, 12(5), 403. https://doi.org/10.3390/aerospace12050403 — Bagian 2.2.3",
    sequenceRule:
      "Penumpang baris paling depan (Baris 1) masuk lebih dahulu secara berurutan menuju baris paling belakang (Baris N).",
    requiredParameters: "Nomor baris kursi dan angka awal pengacakan (seed).",
    limitations:
      "Menimbulkan penumpukan antrean lorong paling tinggi karena penumpang baris depan menghalangi akses ke seluruh baris belakang.",
    supportedInSimulator: true,
  },
  {
    id: "BLOCKS_4_ROWS",
    name: "Four-Row Blocks (Blok 4 Baris)",
    shortLabel: "Blok 4 Baris (Four-Row Blocks)",
    category: "Blok Baris Tetap Bergantian",
    sourceCitation: "Steffen & Hotchkiss (2012), J. Air Transp. Manag. 18(1), 64–67",
    sequenceRule:
      "Kabin dibagi menjadi blok-blok tetap berukuran maksimal 4 baris dari depan ke belakang; pemanggilan dimulai dari blok paling belakang, lalu paling depan, kemudian bergantian menuju tengah dengan urutan acak di dalam blok.",
    requiredParameters: "Ukuran blok 4 baris, jumlah baris kabin (nRows), dan angka awal pengacakan (seed).",
    limitations:
      "Merupakan adaptasi eksperimen blok 4 baris Steffen & Hotchkiss (2012) pada kabin 12 baris untuk jumlah baris kabin umum N.",
    supportedInSimulator: true,
  },
  {
    id: "DOUBLE_OUTSIDE_IN",
    name: "Double Outside-In (Adaptasi Kabin Satu Lorong)",
    shortLabel: "Double Outside-In (Adaptasi Kabin Satu Lorong)",
    category: "Hibrida Dua Bagian Kabin & Posisi Kursi",
    sourceCitation: "Adaptasi Dong, Jia, Yanagisawa, & Nishinari (2025), Physica A 658, 130298 — Bagian 3.2, Gambar 5",
    sequenceRule:
      "Kabin dibagi menjadi bagian depan dan bagian belakang; setiap kelas kursi (Jendela → Tengah → Lorong) dipanggil untuk bagian belakang terlebih dahulu kemudian bagian depan.",
    requiredParameters: "Pembagian tengah baris kabin (floor(N/2)), prioritas kelas kursi, dan angka awal pengacakan (seed).",
    limitations:
      "Adaptasi Double Outside-In dari studi Dong et al. (2025) untuk model pesawat komersial lorong tunggal; pada pesawat 2-2 tanpa kursi tengah otomatis menghasilkan 4 kelompok.",
    supportedInSimulator: true,
  },
  {
    id: "BTF_WMA_FIXED",
    name: "Back-to-Front + WMA (3 Zona Tetap)",
    shortLabel: "Back-to-Front + WMA (3 Zona Tetap)",
    category: "Hibrida Zona Tetap & Posisi Kursi",
    sourceCitation:
      "Possamai Viertel, S., Pessini, L., Secomandi, L., Cavion, R., & Hedler Staudt, F. (2025). Boarding Efficiency in Regional Aviation: A Comparative Analysis of Methods; Baseline Hibrida 3 Zona Tetap ZoneFlow",
    sequenceRule:
      "Kabin dibagi menjadi 3 zona tetap seimbang yang dipanggil dari Zona Belakang → Zona Tengah → Zona Depan; di dalam setiap zona penumpang dipanggil Jendela → Tengah → Lorong.",
    requiredParameters: "Pembagian 3 zona baris seimbang dan prioritas kelas kursi (Window/Middle/Aisle).",
    limitations:
      "Menggunakan 3 zona tetap tanpa optimasi GA sebagai pembanding langsung terhadap metode Boarding Berbasis Zona (AZBO variabel-K).",
    supportedInSimulator: true,
  },
  {
    id: "N-Steffen-BWB",
    name: "N-Aisles Steffen (N-Steffen BWB Multi-Aisle)",
    shortLabel: "N-Aisles Steffen / N-Steffen (BWB Multi-Lorong)",
    category: "Khusus Pesawat Multi-Lorong (BWB)",
    sourceCitation: "Dong, Jia, Yanagisawa, & Nishinari (2025), Physica A 658, 130298 — Bagian 4, Gambar 7–9",
    sequenceRule:
      "Membagi penumpang ke beberapa sub-kabin (4 bay / 4 lorong paralel pada pesawat Blended Wing Body) dengan pemisahan lorong ganjil/genap serta koridor depan.",
    requiredParameters: "Geometri kabin multi-bay dan multi-lorong Blended Wing Body (N_aisles >= 2).",
    limitations:
      "Pada pesawat lorong tunggal (N_aisles = 1), penulis jurnal menyatakan secara eksplisit (Bagian 4.2 hal. 7 & Bagian 6 hal. 10) bahwa N-Steffen tereduksi menjadi metode Steffen klasik yang sudah tersedia pada simulator ini.",
    supportedInSimulator: false,
    unsupportedReason:
      "Tidak diaktifkan sebagai metode terpisah karena dirancang khusus untuk kabin multi-lorong Blended Wing Body (Dong et al., 2025), sedangkan pada pesawat lorong tunggal aturannya tereduksi menjadi Metode Steffen klasik.",
  },
  {
    id: "Decreasing-Baggage-Priority",
    name: "Decreasing Baggage Priority (3→2→1 Tas)",
    shortLabel: "Prioritas Jumlah Tas 3→2→1",
    category: "Prioritas Kuantitas Bagasi",
    sourceCitation: "SRC05 (Nugroho & Asrol, 2022)",
    sequenceRule: "Mengurutkan penumpang berdasarkan jumlah barang bagasi kabin (3 tas → 2 tas → 1 tas → 0 tas).",
    requiredParameters: "Distribusi jumlah tas per penumpang (0, 1, 2, atau 3 item).",
    limitations: "Model saat ini menggunakan variabel biner (membawa / tidak membawa bagasi kabin).",
    supportedInSimulator: false,
    unsupportedReason:
      "Belum didukung: Memerlukan input jumlah tas bertingkat per penumpang (0–3 item), sedangkan model AZBO V2 memodelkan proporsi penumpang pembawa bagasi kabin (0 atau 1 bagasi).",
  },
];

/**
 * Membangun urutan penumpang sesuai metode dan konfigurasi layout pesawat aktif
 */
export function buildBoardingOrderForScenario(
  methodName: string,
  passengers: Passenger[],
  seed: number = BASE_SEED,
  nRows: number = N_ROWS,
  customZoneBoundaries?: number[],
  customZoneOrder?: number[]
): Passenger[] {
  if (passengers.length === 0) return [];
  switch (methodName) {
    case "Back-to-Front-WILMA":
      return backToFrontWilmaOrder(passengers);
    case "Reverse Pyramid (approximation)":
      return reversePyramidOrder(passengers, nRows);
    case "GA-Zone-WMA":
      if (customZoneBoundaries && customZoneOrder) {
        return gaZoneWmaOrder(passengers, customZoneBoundaries, customZoneOrder);
      }
      return gaOptimizedZoneWmaOrder(passengers, nRows);
    case "Exhaustive-Zone-WMA":
      if (customZoneBoundaries && customZoneOrder) {
        return gaZoneWmaOrder(passengers, customZoneBoundaries, customZoneOrder);
      }
      return gaOptimizedZoneWmaOrder(passengers, nRows);
    case "Fixed-Zone-WMA":
      return fixedZoneWmaOrder(passengers, nRows);
    case "Back-to-Front":
      return backToFrontOrder(passengers, seed);
    case "Outside-In/WMA":
      return outsideInOrder(passengers);
    case "Modified Optimal (implementation variant)":
      return modifiedOptimalOrder(passengers);
    case "Steffen (staggered-row implementation)":
      return steffenOrder(passengers, nRows);
    case "Random":
      return randomOrder(passengers, seed);
    case "Rotating Zones":
      return rotatingZonesOrder(passengers, 6, nRows);
    case "Front-to-Back":
      return frontToBackOrder(passengers, seed);
    case "BLOCKS_4_ROWS": {
      const tie = createTieBreaker(passengers, seed);
      const numBlocks = Math.max(1, Math.ceil(nRows / 4));
      const seq: number[] = [];
      let left = 1;
      let right = numBlocks;
      let takeRear = true;
      while (left <= right) {
        if (takeRear) {
          seq.push(right);
          right -= 1;
        } else {
          seq.push(left);
          left += 1;
        }
        takeRear = !takeRear;
      }
      const rankMap: Record<number, number> = {};
      seq.forEach((bId, i) => {
        rankMap[bId] = i;
      });
      return [...passengers].sort((a, b) => {
        const bA = Math.min(numBlocks, Math.floor((a.row - 1) / 4) + 1);
        const bB = Math.min(numBlocks, Math.floor((b.row - 1) / 4) + 1);
        if (rankMap[bA] !== rankMap[bB]) return rankMap[bA] - rankMap[bB];
        return (tie[a.seat_id] || 0) - (tie[b.seat_id] || 0);
      });
    }
    case "DOUBLE_OUTSIDE_IN": {
      const tie = createTieBreaker(passengers, seed);
      const frontEnd = Math.floor(nRows / 2);
      return [...passengers].sort((a, b) => {
        if (a.seat_priority !== b.seat_priority) return a.seat_priority - b.seat_priority;
        const secA = a.row <= frontEnd ? 1 : 0;
        const secB = b.row <= frontEnd ? 1 : 0;
        if (secA !== secB) return secA - secB;
        return (tie[a.seat_id] || 0) - (tie[b.seat_id] || 0);
      });
    }
    case "BTF_WMA_FIXED":
      return fixedZoneWmaOrder(passengers, nRows);
    case "Back-to-Front-AZBO-WILMA":
      return backToFrontAzboWilmaOrder(passengers, nRows);
    default:
      throw new Error(`Metode boarding '${methodName}' belum didukung oleh simulator.`);
  }
}

export interface EvaluatedMethodResult {
  rank: number;
  methodName: string;
  shortLabel: string;
  category: string;
  metrics: SimulationMetrics;
  zoneConfigUsed?: {
    kZones?: number;
    boundaries: number[];
    sizes: number[];
    order: number[];
    zoneRanges?: Array<[number, number]>;
    inZoneRule?: string;
  };
  callingSteps?: string[];
  sdSeconds?: number;
  sdMinutes?: number;
  ci95Seconds?: [number, number];
  minSeconds?: number;
  maxSeconds?: number;
  pairedDiffSdSeconds?: number;
  pairedDiffCi95Seconds?: [number, number];
  differenceFromBestSeconds: number;
  differenceFromBestPercent: number;
}

export type AzboExecutionEngine = "pythonanywhere" | "pyodide";

export const AZBO_EXECUTION_ENGINE_LABELS: Record<AzboExecutionEngine, string> = {
  pythonanywhere: "Mesin Simulasi: PythonAnywhere — Python AZBO V2",
  pyodide: "Mesin Simulasi: Pyodide — Python AZBO V2 di Browser",
};

export function getAzboExecutionEngineLabel(engine: AzboExecutionEngine): string {
  return AZBO_EXECUTION_ENGINE_LABELS[engine] || AZBO_EXECUTION_ENGINE_LABELS.pythonanywhere;
}

export type AzboServerFailureReason =
  | "unavailable"
  | "busy"
  | "job_failed"
  | "job_lost"
  | "timeout"
  | "cancelled";

export class AzboServerEvaluationError extends Error {
  public readonly reason: AzboServerFailureReason;
  public readonly canFallbackToPyodide: boolean;

  constructor(
    message: string,
    reason: AzboServerFailureReason = "unavailable",
    canFallbackToPyodide: boolean = true
  ) {
    super(message);
    this.name = "AzboServerEvaluationError";
    this.reason = reason;
    this.canFallbackToPyodide = canFallbackToPyodide;
  }
}

export interface AzboOptimizationSummary {
  executionEngine?: AzboExecutionEngine;
  executionEngineLabel?: string;
  scenario: {
    layout: AircraftLayoutConfig;
    passengerCount: number;
    baggagePassengerCount: number;
    baggagePercent?: number;
    seed: number;
    trainReplications?: number;
    testReplications?: number;
    dtSeconds?: number;
    rowPitchM?: number;
    cellLengthM?: number;
  };
  recommendedMethod: EvaluatedMethodResult;
  evaluatedMethods: EvaluatedMethodResult[];
  zoneOptimizationAudit: {
    kZones: number;
    exploredKValues?: number[];
    initialKCoverage?: number[];
    initialCoverageCandidatesEvaluated?: number;
    initialCoverageFitnessByKS?: Record<string, number>;
    gaPopulationRequested?: number;
    trainSeeds?: number[];
    testSeeds?: number[];
    inZoneRule?: string;
    totalZoneCandidatesEvaluated: number;
    bestZoneConfig: {
      boundaries: number[];
      sizes: number[];
      order: number[];
      zoneRanges?: Array<[number, number]>;
      inZoneRule?: string;
      boardingTimeSeconds: number;
      boardingTimeMinutes: number;
    };
    fixedZoneBaseline?: {
      boundaries: number[];
      sizes: number[];
      order: number[];
      boardingTimeSeconds: number;
      boardingTimeMinutes: number;
    };
    azboWilmaEquivalenceVerified: boolean;
  };
  selectionRationale: string;
  closeCompetitionNote?: string;
  disclaimer?: string;
  equivalentMethods?: Array<[string, string]>;
  animationDetails?: PassengerTimelineDetail[];
  animationMetrics?: SimulationMetrics;
  animationTrace?: Array<Record<string, unknown>>;
  animationReplication?: {
    replicationSeed: number;
    replicationIndex?: number;
    selectionMethod?: string;
    sampleMeanS?: number;
    isSingleReplication?: boolean;
    boardingTimeS: number;
  };
  scientificCaveats: string[];
  azboImplementationNotes: {
    implementedInCode: string[];
    missingFormalSpecInSource: string[];
  };
}

/**
 * Menghitung jumlah penumpang pembawa bagasi secara deterministik sesuai Blueprint AZBO Bagian 3.1:
 * n_b = floor(n * (baggagePercent / 100) + 0.5)
 */
export function computeDeterministicBaggageCount(
  capacity: number,
  baggagePercent: number
): number {
  if (!Number.isFinite(capacity) || capacity <= 0) return 0;
  if (!Number.isFinite(baggagePercent) || baggagePercent < 0 || baggagePercent > 100) {
    return 0;
  }
  const rho = baggagePercent / 100.0;
  return Math.floor(capacity * rho + 0.5);
}

/**
 * Memetakan respons JSON dari backend Python AZBO V2 (/api/v2/azbo/optimize atau /api/v2/azbo/jobs)
 * maupun dari Pyodide Web Worker ke struktur AzboOptimizationSummary yang digunakan oleh tampilan Hasil.
 */
export function mapAzboV2ResponseToSummary(
  apiData: any,
  layout: AircraftLayoutConfig,
  executionEngine?: AzboExecutionEngine
): AzboOptimizationSummary {
  if (!apiData || !apiData.recommendation || !apiData.scenario || !apiData.optimization) {
    throw new Error("Format respons dari server simulasi tidak lengkap.");
  }

  const scen = apiData.scenario;
  const opt = apiData.optimization;
  const rec = apiData.recommendation;
  const anim = apiData.animation;

  const paxCount: number = Number(scen.passenger_count ?? layout.capacity);
  const bagCount: number = Number(scen.baggage_passenger_count ?? 0);
  const bagPct: number = Number(
    scen.baggage_percent ?? Math.round((bagCount / Math.max(1, paxCount)) * 100)
  );
  const seedVal: number = Number(scen.seed ?? BASE_SEED);

  const evaluatedStrategies: any[] = Array.isArray(rec.evaluated_strategies)
    ? rec.evaluated_strategies
    : [];

  if (evaluatedStrategies.length === 0) {
    throw new Error("Server simulasi tidak mengembalikan daftar metode yang dievaluasi.");
  }

  const evaluatedMethods: EvaluatedMethodResult[] = evaluatedStrategies.map(
    (item: any, idx: number) => {
      const meanS = Number(item.mean_s ?? 0);
      const meanMin = Number(item.mean_min ?? meanS / 60);
      const sdS = Number(item.sd_s ?? 0);
      const sdMin = Number(item.sd_min ?? sdS / 60);
      const ciLow = Number(item.ci95_low_s ?? meanS);
      const ciHigh = Number(item.ci95_high_s ?? meanS);
      const aisleEvents = Number(item.mean_aisle_interference_events ?? 0);
      const seatEvents = Number(item.mean_seat_interference_events ?? 0);

      let zoneConfigUsed: EvaluatedMethodResult["zoneConfigUsed"] | undefined;
      if (item.zone_config) {
        zoneConfigUsed = {
          kZones: Number(item.zone_config.k_zones ?? opt.k_zones ?? 1),
          boundaries: Array.isArray(item.zone_config.boundaries)
            ? item.zone_config.boundaries.map(Number)
            : [],
          sizes: Array.isArray(item.zone_config.sizes)
            ? item.zone_config.sizes.map(Number)
            : [],
          order: Array.isArray(item.zone_config.order)
            ? item.zone_config.order.map(Number)
            : [],
          zoneRanges: Array.isArray(item.zone_config.zone_ranges)
            ? item.zone_config.zone_ranges.map((r: any) => [Number(r[0]), Number(r[1])] as [number, number])
            : undefined,
          inZoneRule: item.zone_config.in_zone_rule,
        };
      }

      return {
        rank: Number(item.rank ?? idx + 1),
        methodName: String(item.strategy_id),
        shortLabel: String(item.short_label || item.strategy_id),
        category: String(item.category || "Metode Boarding"),
        metrics: {
          boarding_time_seconds: meanS,
          boarding_time_minutes: meanMin,
          aisle_interference_events: aisleEvents,
          aggregate_aisle_wait_person_seconds: 0,
          aisle_wait_seconds: 0,
          seat_interference_events: seatEvents,
          occupied_blocker_count: seatEvents,
          baggage_count: bagCount,
          passenger_count: paxCount,
        },
        zoneConfigUsed,
        callingSteps: Array.isArray(item.calling_steps)
          ? item.calling_steps.map(String)
          : [],
        sdSeconds: sdS,
        sdMinutes: sdMin,
        ci95Seconds: [ciLow, ciHigh],
        minSeconds: Number(item.min_s ?? meanS),
        maxSeconds: Number(item.max_s ?? meanS),
        pairedDiffSdSeconds: Number(item.paired_diff_sd_s ?? 0),
        pairedDiffCi95Seconds: Array.isArray(item.paired_diff_ci95_s)
          ? [Number(item.paired_diff_ci95_s[0]), Number(item.paired_diff_ci95_s[1])]
          : [0, 0],
        differenceFromBestSeconds: Number(item.diff_from_best_s ?? 0),
        differenceFromBestPercent: Number(item.diff_from_best_pct ?? 0),
      };
    }
  );

  const recommended = evaluatedMethods[0];
  const kZonesOpt = Number(opt.k_zones ?? 1);
  const optBoundaries: number[] = Array.isArray(opt.cut_rows)
    ? opt.cut_rows.map(Number)
    : [];
  const optSizes: number[] = Array.isArray(opt.zone_sizes)
    ? opt.zone_sizes.map(Number)
    : [layout.nRows];
  const optOrder: number[] = Array.isArray(opt.zone_order)
    ? opt.zone_order.map(Number)
    : [1];
  const optRanges: Array<[number, number]> = Array.isArray(opt.zone_ranges)
    ? opt.zone_ranges.map((r: any) => [Number(r[0]), Number(r[1])] as [number, number])
    : [[1, layout.nRows]];
  const optRule = String(opt.in_zone_rule ?? "WMA_IN_ZONE");

  const zoneMethodEntry =
    evaluatedMethods.find((m) => m.methodName === "ZONE") ?? recommended;

  const equivalentPairs: Array<[string, string]> = Array.isArray(rec.equivalent_methods)
    ? rec.equivalent_methods.map((p: any) => [String(p[0]), String(p[1])] as [string, string])
    : [];

  const testReps = Number(scen.test_reps ?? 20);
  const trainReps = Number(scen.train_reps ?? 3);

  const selectionRationale =
    `Berdasarkan evaluasi ${testReps} simulasi berulang pada ${layout.name} (${paxCount} penumpang — 100% kursi terisi, ` +
    `${bagCount} orang atau ${bagPct}% membawa bagasi kabin), metode "${recommended.shortLabel}" menghasilkan ` +
    `rata-rata perkiraan waktu boarding tercepat yaitu ${recommended.metrics.boarding_time_seconds.toFixed(1)} detik ` +
    `(${recommended.metrics.boarding_time_minutes.toFixed(2)} menit, simpangan baku ±${(recommended.sdSeconds ?? 0).toFixed(1)} detik) ` +
    `dari ${evaluatedMethods.length} metode boarding yang diuji.`;

  const closeCompetitionNote: string | undefined =
    typeof rec.close_competition_note === "string" && rec.close_competition_note.trim().length > 0
      ? rec.close_competition_note.trim()
      : undefined;

  const animationDetails: PassengerTimelineDetail[] = Array.isArray(anim?.timeline_details)
    ? anim.timeline_details
    : [];

  const animationMetrics: SimulationMetrics | undefined = anim?.metrics
    ? {
        boarding_time_seconds: Number(anim.metrics.boarding_time_seconds ?? recommended.metrics.boarding_time_seconds),
        boarding_time_minutes: Number(anim.metrics.boarding_time_minutes ?? recommended.metrics.boarding_time_minutes),
        aisle_interference_events: Number(anim.metrics.aisle_interference_events ?? recommended.metrics.aisle_interference_events),
        aggregate_aisle_wait_person_seconds: Number(anim.metrics.aggregate_aisle_wait_person_seconds ?? 0),
        aisle_wait_seconds: Number(anim.metrics.aisle_wait_seconds ?? 0),
        seat_interference_events: Number(anim.metrics.seat_interference_events ?? recommended.metrics.seat_interference_events),
        occupied_blocker_count: Number(anim.metrics.occupied_blocker_count ?? 0),
        baggage_count: Number(anim.metrics.baggage_count ?? bagCount),
        passenger_count: Number(anim.metrics.passenger_count ?? paxCount),
      }
    : undefined;

  const animationReplication = anim
    ? {
        replicationSeed: Number(anim.replication_seed ?? seedVal),
        replicationIndex:
          typeof anim.replication_index === "number" ? Number(anim.replication_index) : undefined,
        selectionMethod:
          typeof anim.selection_method === "string" ? anim.selection_method : undefined,
        sampleMeanS:
          typeof anim.sample_mean_s === "number"
            ? Number(anim.sample_mean_s)
            : recommended.metrics.boarding_time_seconds,
        isSingleReplication: Boolean(anim.is_single_replication ?? true),
        boardingTimeS: Number(
          anim.boarding_time_s ??
            anim.metrics?.boarding_time_seconds ??
            recommended.metrics.boarding_time_seconds
        ),
      }
    : undefined;

  const summary: AzboOptimizationSummary = {
    ...(executionEngine
      ? {
          executionEngine,
          executionEngineLabel: getAzboExecutionEngineLabel(executionEngine),
        }
      : {}),
    scenario: {
      layout,
      passengerCount: paxCount,
      baggagePassengerCount: bagCount,
      baggagePercent: bagPct,
      seed: seedVal,
      trainReplications: trainReps,
      testReplications: testReps,
      dtSeconds: Number(scen.dt_s ?? 0.25),
      rowPitchM: Number(scen.row_pitch_m ?? 0.8),
      cellLengthM: Number(scen.cell_m ?? 0.4),
    },
    recommendedMethod: recommended,
    evaluatedMethods,
    zoneOptimizationAudit: {
      kZones: kZonesOpt,
      exploredKValues: Array.isArray(opt.explored_k_values)
        ? opt.explored_k_values.map(Number)
        : [kZonesOpt],
      initialKCoverage: Array.isArray(opt.initial_k_coverage)
        ? opt.initial_k_coverage.map(Number)
        : undefined,
      initialCoverageCandidatesEvaluated:
        typeof opt.initial_coverage_candidates_evaluated === "number"
          ? Number(opt.initial_coverage_candidates_evaluated)
          : undefined,
      initialCoverageFitnessByKS:
        opt.initial_coverage_fitness_by_k_s &&
        typeof opt.initial_coverage_fitness_by_k_s === "object"
          ? (opt.initial_coverage_fitness_by_k_s as Record<string, number>)
          : undefined,
      gaPopulationRequested:
        typeof opt.ga_population_requested === "number"
          ? Number(opt.ga_population_requested)
          : undefined,
      trainSeeds: Array.isArray(opt.train_seeds) ? opt.train_seeds.map(Number) : undefined,
      testSeeds: Array.isArray(opt.test_seeds) ? opt.test_seeds.map(Number) : undefined,
      inZoneRule: optRule,
      totalZoneCandidatesEvaluated: Number(opt.unique_candidates_evaluated ?? 0),
      bestZoneConfig: {
        boundaries: optBoundaries,
        sizes: optSizes,
        order: optOrder,
        zoneRanges: optRanges,
        inZoneRule: optRule,
        boardingTimeSeconds: zoneMethodEntry.metrics.boarding_time_seconds,
        boardingTimeMinutes: zoneMethodEntry.metrics.boarding_time_minutes,
      },
      fixedZoneBaseline: undefined,
      azboWilmaEquivalenceVerified: equivalentPairs.some(
        ([a, b]) => (a === "ZONE" && b === "WMA") || (a === "WMA" && b === "ZONE")
      ),
    },
    selectionRationale,
    closeCompetitionNote,
    disclaimer:
      rec.disclaimer ||
      "Hasil merupakan perkiraan berdasarkan model simulasi dan belum menggantikan pengujian operasional di lapangan.",
    equivalentMethods: equivalentPairs,
    animationDetails,
    animationMetrics,
    animationTrace: Array.isArray(anim?.trace) ? anim.trace : [],
    animationReplication,
    scientificCaveats: [
      "Hasil merupakan perkiraan berdasarkan model simulasi dan belum menggantikan pengujian operasional di lapangan.",
      `Evaluasi memisahkan ${trainReps} replikasi pencarian zona dan ${testReps} replikasi pengujian akhir dengan angka acak bersama (Common Random Numbers) agar perbandingan ${evaluatedMethods.length} metode berlangsung adil.`,
      "Pencarian konfigurasi zona menggunakan algoritma heuristik (Genetic Algorithm) yang mencari konfigurasi terbaik yang ditemukan pada simulasi, bukan jaminan matematis optimum global.",
      ...(testReps < 100 ? ["Jumlah replikasi evaluasi akhir kurang dari acuan audit 100 pada Blueprint; hasil saat ini bersifat eksploratif dan bukan bukti unggul secara statistik."] : []),
      "Animasi menampilkan satu replikasi TEST nyata dengan durasi paling mendekati rata-rata metode terpilih, bukan animasi dari nilai rata-rata maupun hasil validasi lapangan.",
      "Memilih pemenang berdasarkan rerata sampel TEST dapat menimbulkan bias seleksi; lihat selisih berpasangan dan ketidakpastian sebelum menarik kesimpulan kuat.",
    ],
    azboImplementationNotes: {
      implementedInCode: [
        `Model antrean lorong kapasitas ketat 1 penumpang per sel (${Number(scen.cell_m ?? 0.4)} m/sel, langkah waktu Δt = ${Number(scen.dt_s ?? 0.25)} dtk) tanpa mendahului penumpang di depannya.`,
        `Jumlah zona boarding K sebagai variabel keputusan (K dieksplorasi dari 1 hingga ${layout.nRows} zona) beserta urutan pemanggilan zona dan aturan di dalam zona.`,
        `Evaluasi berulang terpisah (${trainReps} replikasi pencarian zona + ${testReps} replikasi evaluasi akhir) pada ${evaluatedMethods.length} kelompok metode: Boarding Berbasis Zona (AZBO), Jendela–Tengah–Lorong (WMA / Outside-In), Belakang ke Depan (BTF), Acak (Random), Piramida Terbalik (Reverse Pyramid), Metode Steffen, Zona Berputar (Rotating Zones), Optimal Termodifikasi (Modified Optimal), Depan ke Belakang (Front-to-Back), Blok 4 Baris (Four-Row Blocks), Double Outside-In (Adaptasi Kabin Satu Lorong), dan Back-to-Front + WMA (3 Zona Tetap).`,
      ],
      missingFormalSpecInSource: [
        "Metode N-Aisles Steffen (N-Steffen) dari Dong et al. (2025) dirancang khusus untuk pesawat multi-lorong Blended Wing Body dan tereduksi menjadi Metode Steffen klasik pada kabin satu lorong, sedangkan Double Outside-In diadaptasi ke kabin satu lorong dengan membagi setiap kelas kursi menjadi paruh belakang dan paruh depan.",
      ],
    },
  };

  return summary;
}

export interface AzboEvaluationOptions {
  layout: AircraftLayoutConfig;
  baggagePercent: number;
  seed?: number;
  gaPopulation?: number;
  gaGenerations?: number;
  trainReps?: number;
  testReps?: number;
  engine?: AzboExecutionEngine;
  apiBaseUrl?: string;
  signal?: AbortSignal;
  pollIntervalMs?: number;
  maxPollCount?: number;
  onProgress?: (message: string, percent: number) => void;
}

function buildAzboEvaluationPayload(options: AzboEvaluationOptions) {
  const {
    layout,
    baggagePercent,
    seed = BASE_SEED,
    gaPopulation = 14,
    gaGenerations = 8,
    trainReps = 3,
    testReps,
  } = options;

  if (!Number.isFinite(baggagePercent) || baggagePercent < 0 || baggagePercent > 100) {
    throw new Error("Persentase penumpang membawa bagasi harus berada antara 0% hingga 100%.");
  }

  const resolvedTestReps = (() => {
    if (typeof testReps === "number") {
      if (!Number.isInteger(testReps) || testReps < 2 || testReps > 200) {
        throw new Error(
          "Jumlah replikasi pengujian (test_reps) harus bilangan bulat antara 2 dan 200."
        );
      }
      return testReps;
    }
    const configured = Number(import.meta.env?.VITE_AZBO_TEST_REPS ?? "20");
    if (!Number.isInteger(configured) || configured < 2 || configured > 200) {
      throw new Error("VITE_AZBO_TEST_REPS harus bilangan bulat antara 2 dan 200.");
    }
    return configured;
  })();

  return {
    layout_id: layout.id,
    layout_name: layout.name,
    rows: layout.nRows,
    left_seats: layout.leftSeats.length,
    right_seats: layout.rightSeats.length,
    left_letters: [...layout.leftSeats],
    right_letters: [...layout.rightSeats],
    row_pitch_m: 0.8,
    cell_m: 0.4,
    bag_ratio: baggagePercent / 100.0,
    ga_population: gaPopulation,
    ga_generations: gaGenerations,
    train_reps: trainReps,
    test_reps: resolvedTestReps,
    seed,
    dt: 0.25,
    zone_call_overhead_s: 0.0,
  };
}

/**
 * Menjalankan evaluasi dan optimasi Python AZBO V2 (`backend/app/azbo_core.py`)
 * secara langsung di browser menggunakan Pyodide 0.27.8 + Web Worker (Mesin Alternatif).
 */
export async function runAzboV2EvaluationViaPyodideBrowser(
  options: AzboEvaluationOptions
): Promise<AzboOptimizationSummary> {
  const payload = buildAzboEvaluationPayload(options);
  options.onProgress?.("Menyiapkan mesin simulasi Python (Pyodide) di browser...", 5);
  const rawResult = await runAzboV2InBrowserPyodide(payload, options.onProgress);
  options.onProgress?.("Selesai menyusun rekomendasi boarding.", 100);
  return mapAzboV2ResponseToSummary(rawResult, options.layout, "pyodide");
}

/**
 * Menjalankan evaluasi dan optimasi AZBO V2 melalui backend Python FastAPI lokal
 * (`/api/v2/azbo/*`) untuk pengujian penelitian.
 *
 * Langkah eksekusi:
 * 1. Memeriksa ketersediaan backend melalui `GET /api/v2/azbo/health`.
 * 2. Mengirimkan konfigurasi simulasi melalui `POST /api/v2/azbo/jobs`.
 * 3. Mengambil `job_id` dari respons server.
 * 4. Melakukan polling `GET /api/v2/azbo/jobs/{job_id}` dan menampilkan `progress_percent`
 *    serta `progress_message` asli dari server.
 * 5. Menggunakan `result` asli saat status `completed`, atau melempar `AzboServerEvaluationError`
 *    yang jelas jika server tidak tersedia, sibuk, gagal, atau kehilangan pekerjaan.
 * 6. Tidak pernah diam-diam berpindah ke Pyodide dan tidak pernah membuat angka simulasi palsu.
 */
export async function runAzboV2EvaluationViaFastApiServer(
  options: AzboEvaluationOptions
): Promise<AzboOptimizationSummary> {
  const {
    layout,
    apiBaseUrl,
    signal,
    pollIntervalMs = 1000,
    maxPollCount = 900,
    onProgress,
  } = options;
  const payload = buildAzboEvaluationPayload(options);

  if (signal?.aborted) {
    throw new AzboServerEvaluationError(
      "Pekerjaan simulasi dibatalkan.",
      "cancelled",
      false
    );
  }

  onProgress?.("Memeriksa ketersediaan server simulasi PythonAnywhere...", 3);

  const health = await checkAzboV2Health(apiBaseUrl, 8000, signal);
  if (!health.online) {
    throw new AzboServerEvaluationError(
      "Server simulasi sedang tidak tersedia. Anda dapat mencoba menjalankan simulasi langsung di perangkat ini.",
      "unavailable",
      true
    );
  }

  onProgress?.("Mengirim konfigurasi simulasi ke server PythonAnywhere...", 5);

  const jobsEndpointUrl = buildAzboV2EndpointUrl("/jobs", apiBaseUrl);
  let startRes: Response;
  try {
    startRes = await fetch(jobsEndpointUrl, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    if (err?.name === "AbortError" || signal?.aborted) {
      throw new AzboServerEvaluationError(
        "Permintaan simulasi dibatalkan.",
        "cancelled",
        false
      );
    }
    throw new AzboServerEvaluationError(
      "Server simulasi sedang tidak tersedia. Anda dapat mencoba menjalankan simulasi langsung di perangkat ini.",
      "unavailable",
      true
    );
  }

  if (!startRes.ok) {
    let detail = "";
    try {
      if (isJsonContentType(startRes.headers.get("content-type"))) {
        const errJson = await startRes.json();
        detail = errJson?.detail ? String(errJson.detail) : "";
      }
    } catch {
      // ignore
    }
    if (startRes.status === 429 || startRes.status === 503) {
      throw new AzboServerEvaluationError(
        detail ||
          "Server simulasi PythonAnywhere sedang sibuk menangani pekerjaan lain. Silakan tunggu beberapa saat atau jalankan simulasi langsung di perangkat ini menggunakan Pyodide.",
        "busy",
        true
      );
    }
    if (!detail && (startRes.status === 404 || startRes.status === 405 || startRes.status >= 500)) {
      throw new AzboServerEvaluationError(
        "Server simulasi sedang tidak tersedia. Anda dapat mencoba menjalankan simulasi langsung di perangkat ini.",
        "unavailable",
        true
      );
    }
    throw new AzboServerEvaluationError(
      detail ||
        `Server simulasi gagal memproses permintaan (kode status ${startRes.status}).`,
      "job_failed",
      true
    );
  }

  if (!isJsonContentType(startRes.headers.get("content-type"))) {
    throw new AzboServerEvaluationError(
      "Server simulasi sedang tidak tersedia. Anda dapat mencoba menjalankan simulasi langsung di perangkat ini.",
      "unavailable",
      true
    );
  }

  const startData = await startRes.json();
  const jobId = startData?.job_id;
  if (!jobId) {
    throw new AzboServerEvaluationError(
      "Server simulasi tidak mengembalikan ID pekerjaan yang valid.",
      "job_failed",
      true
    );
  }

  onProgress?.(
    startData.progress_message || "Menjalankan pencarian zona & simulasi boarding...",
    Number(startData.progress_percent ?? 10)
  );

  // Poll status pekerjaan hingga selesai
  for (let i = 0; i < maxPollCount; i++) {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, pollIntervalMs);
      if (signal) {
        const onAbort = () => {
          clearTimeout(t);
          reject(
            new AzboServerEvaluationError(
              "Polling simulasi dibatalkan.",
              "cancelled",
              false
            )
          );
        };
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });

    let pollRes: Response;
    try {
      pollRes = await fetch(
        buildAzboV2EndpointUrl(`/jobs/${encodeURIComponent(jobId)}`, apiBaseUrl),
        {
          signal,
          headers: { Accept: "application/json" },
        }
      );
    } catch (err: any) {
      if (err?.name === "AbortError" || signal?.aborted) {
        throw new AzboServerEvaluationError(
          "Polling simulasi dibatalkan.",
          "cancelled",
          false
        );
      }
      throw new AzboServerEvaluationError(
        "Koneksi ke server simulasi PythonAnywhere terputus saat perhitungan sedang berjalan. Anda dapat mencoba kembali atau menjalankan simulasi menggunakan Pyodide di perangkat ini.",
        "unavailable",
        true
      );
    }

    if (pollRes.status === 404) {
      throw new AzboServerEvaluationError(
        "Pekerjaan simulasi tidak lagi ditemukan di server (proses server kemungkinan dimulai ulang karena batas sumber daya PythonAnywhere). Anda dapat mencoba kembali atau menjalankan simulasi menggunakan Pyodide di perangkat ini.",
        "job_lost",
        true
      );
    }

    if (pollRes.status === 429 || pollRes.status === 503) {
      throw new AzboServerEvaluationError(
        "Server simulasi PythonAnywhere sedang sibuk atau melewati batas waktu respons. Anda dapat mencoba kembali atau menjalankan simulasi menggunakan Pyodide di perangkat ini.",
        "busy",
        true
      );
    }

    if (!pollRes.ok) {
      throw new AzboServerEvaluationError(
        `Gagal memeriksa status simulasi dari server (kode ${pollRes.status}).`,
        "job_failed",
        true
      );
    }

    if (!isJsonContentType(pollRes.headers.get("content-type"))) {
      throw new AzboServerEvaluationError(
        "Respons status simulasi bukan format JSON dari server backend Python.",
        "unavailable",
        true
      );
    }

    const pollData = await pollRes.json();
    if (pollData.progress_message || typeof pollData.progress_percent === "number") {
      onProgress?.(
        String(pollData.progress_message || "Menjalankan simulasi boarding..."),
        Number(pollData.progress_percent ?? 50)
      );
    }

    if (pollData.status === "completed" && pollData.result) {
      onProgress?.("Selesai menyusun rekomendasi boarding.", 100);
      return mapAzboV2ResponseToSummary(pollData.result, layout, "pythonanywhere");
    }

    if (pollData.status === "failed" || pollData.status === "cancelled") {
      throw new AzboServerEvaluationError(
        pollData.error_message ||
          pollData.error ||
          "Perhitungan simulasi di server gagal atau dibatalkan.",
        "job_failed",
        true
      );
    }
  }

  throw new AzboServerEvaluationError(
    "Waktu tunggu perhitungan simulasi di server habis. Anda dapat mencoba kembali atau menjalankan simulasi menggunakan Pyodide di perangkat ini.",
    "timeout",
    true
  );
}

/**
 * Fungsi utama evaluasi AZBO V2 pada frontend ZoneFlow:
 * Menjalankan kode inti Python (`backend/app/azbo_core.py`) secara langsung
 * di dalam browser menggunakan Pyodide 0.27.8 + Web Worker sebagai mesin tunggal,
 * tanpa menghubungi server eksternal atau PythonAnywhere.
 */
export async function runAzboV2EvaluationViaBackend(
  options: AzboEvaluationOptions
): Promise<AzboOptimizationSummary> {
  return runAzboV2EvaluationViaPyodideBrowser(options);
}

/**
 * Menghasilkan kandidat partisi 3 zona dan 6 urutan pemanggilan zona yang valid untuk jumlah baris kabin nRows
 */
export function generateValidZoneCandidatesForRows(
  nRows: number
): Array<{ boundaries: number[]; sizes: number[]; order: number[] }> {
  const minRows = Math.max(2, Math.floor(nRows / 6));
  const maxRows = Math.max(minRows + 1, Math.ceil(nRows / 2));
  const orders: number[][] = [
    [3, 2, 1],
    [3, 1, 2],
    [2, 3, 1],
    [2, 1, 3],
    [1, 3, 2],
    [1, 2, 3],
  ];

  const candidates: Array<{ boundaries: number[]; sizes: number[]; order: number[] }> = [];
  for (let s1 = minRows; s1 <= maxRows; s1++) {
    for (let s2 = minRows; s2 <= maxRows; s2++) {
      const s3 = nRows - s1 - s2;
      if (s3 < minRows || s3 > maxRows) continue;
      const boundaries = [s1, s1 + s2];
      const sizes = [s1, s2, s3];
      for (const order of orders) {
        candidates.push({ boundaries, sizes, order });
      }
    }
  }
  return candidates;
}

/**
 * Kerangka Evaluasi & Optimasi AZBO untuk skenario yang ditentukan pengguna.
 * Mengevaluasi metode kandidat yang dipilih pengguna serta mengoptimalkan konfigurasi 3 zona (Zone-WMA)
 * pada kumpulan penumpang dan bagasi yang identik.
 */
export function runAzboOptimizationForScenario(options: {
  layout: AircraftLayoutConfig;
  passengerCount: number;
  baggagePassengerCount: number;
  seed: number;
  selectedMethods?: string[];
}): AzboOptimizationSummary {
  const { layout, passengerCount, baggagePassengerCount, seed } = options;
  if (passengerCount <= 0) {
    throw new Error(
      "Jumlah penumpang harus minimal 1 orang untuk menjalankan simulasi dan evaluasi optimasi AZBO."
    );
  }
  if (
    !Number.isInteger(baggagePassengerCount) ||
    baggagePassengerCount < 0 ||
    baggagePassengerCount > passengerCount
  ) {
    throw new Error(
      `Jumlah penumpang membawa bagasi kabin harus bilangan bulat antara 0 hingga ${passengerCount} orang.`
    );
  }

  const passengers = generatePassengersForScenario({
    seed,
    passengerCount,
    baggagePassengerCount,
    layout,
  });

  // 1. Optimasi Konfigurasi 3 Zona (Zone-WMA) pada skenario aktif
  const zoneCandidates = generateValidZoneCandidatesForRows(layout.nRows);
  let bestZoneCandidate = {
    boundaries: equalZoneBoundaries(layout.nRows, K_ZONES),
    sizes: [
      Math.floor(layout.nRows / 3),
      Math.floor(layout.nRows / 3),
      layout.nRows - 2 * Math.floor(layout.nRows / 3),
    ],
    order: [3, 2, 1],
    boardingTimeSeconds: Number.POSITIVE_INFINITY,
    boardingTimeMinutes: Number.POSITIVE_INFINITY,
  };

  for (const cand of zoneCandidates) {
    const ordered = gaZoneWmaOrder(passengers, cand.boundaries, cand.order);
    const { metrics } = simulateBoarding(ordered);
    if (metrics.boarding_time_seconds < bestZoneCandidate.boardingTimeSeconds) {
      bestZoneCandidate = {
        boundaries: cand.boundaries,
        sizes: cand.sizes,
        order: cand.order,
        boardingTimeSeconds: metrics.boarding_time_seconds,
        boardingTimeMinutes: metrics.boarding_time_minutes,
      };
    }
  }

  // Hitung baseline Fixed-Zone-WMA (3 zona seimbang)
  const fixedBounds = equalZoneBoundaries(layout.nRows, K_ZONES);
  const fixedSizes = [
    fixedBounds[0],
    fixedBounds[1] - fixedBounds[0],
    layout.nRows - fixedBounds[1],
  ];
  const fixedOrdered = gaZoneWmaOrder(passengers, fixedBounds, [3, 2, 1]);
  const fixedMetrics = simulateBoarding(fixedOrdered).metrics;

  // Verifikasi ekuivalensi Back-to-Front-AZBO-WILMA dengan Back-to-Front-WILMA pada skenario ini
  const btfWilmaSeq = backToFrontWilmaOrder(passengers).map((p) => p.seat_id);
  const azboWilmaSeq = backToFrontAzboWilmaOrder(passengers, layout.nRows).map((p) => p.seat_id);
  const azboWilmaEquivalenceVerified =
    btfWilmaSeq.length === azboWilmaSeq.length &&
    btfWilmaSeq.every((id, idx) => id === azboWilmaSeq[idx]);

  // 2. Evaluasi metode kandidat yang didukung
  const supportedCatalog = BOARDING_METHOD_CATALOG.filter((m) => m.supportedInSimulator);
  const methodsToEvaluate =
    options.selectedMethods && options.selectedMethods.length > 0
      ? supportedCatalog.filter((m) => options.selectedMethods!.includes(m.id))
      : supportedCatalog;

  if (methodsToEvaluate.length === 0) {
    throw new Error("Pilih minimal satu metode boarding yang didukung untuk dievaluasi.");
  }

  const rawEvaluated: Array<Omit<EvaluatedMethodResult, "rank" | "differenceFromBestSeconds" | "differenceFromBestPercent">> = [];

  for (const methodSpec of methodsToEvaluate) {
    let ordered: Passenger[];
    let zoneConfigUsed: EvaluatedMethodResult["zoneConfigUsed"] | undefined;

    if (methodSpec.id === "Exhaustive-Zone-WMA") {
      ordered = gaZoneWmaOrder(
        passengers,
        bestZoneCandidate.boundaries,
        bestZoneCandidate.order
      );
      zoneConfigUsed = {
        boundaries: bestZoneCandidate.boundaries,
        sizes: bestZoneCandidate.sizes,
        order: bestZoneCandidate.order,
      };
    } else if (methodSpec.id === "GA-Zone-WMA") {
      const gaBounds = layout.isBaseline180
        ? BEST_GA_CHROMOSOME.boundaries
        : bestZoneCandidate.boundaries;
      const gaOrder = layout.isBaseline180
        ? BEST_GA_CHROMOSOME.order
        : bestZoneCandidate.order;
      const gaSizes = [
        gaBounds[0],
        gaBounds[1] - gaBounds[0],
        layout.nRows - gaBounds[1],
      ];
      ordered = gaZoneWmaOrder(passengers, gaBounds, gaOrder);
      zoneConfigUsed = {
        boundaries: gaBounds,
        sizes: gaSizes,
        order: gaOrder,
      };
    } else if (methodSpec.id === "Fixed-Zone-WMA") {
      ordered = fixedOrdered;
      zoneConfigUsed = {
        boundaries: fixedBounds,
        sizes: fixedSizes,
        order: [3, 2, 1],
      };
    } else {
      ordered = buildBoardingOrderForScenario(
        methodSpec.id,
        passengers,
        seed,
        layout.nRows
      );
    }

    const { metrics } = simulateBoarding(ordered);
    rawEvaluated.push({
      methodName: methodSpec.id,
      shortLabel: methodSpec.shortLabel,
      category: methodSpec.category,
      metrics,
      zoneConfigUsed,
    });
  }

  rawEvaluated.sort(
    (a, b) => a.metrics.boarding_time_seconds - b.metrics.boarding_time_seconds
  );

  const bestTimeS = rawEvaluated[0].metrics.boarding_time_seconds;

  const evaluatedMethods: EvaluatedMethodResult[] = rawEvaluated.map((item, idx) => {
    const diffS = item.metrics.boarding_time_seconds - bestTimeS;
    const diffPct = bestTimeS > 0 ? (diffS / bestTimeS) * 100 : 0;
    return {
      ...item,
      rank: idx + 1,
      differenceFromBestSeconds: diffS,
      differenceFromBestPercent: diffPct,
    };
  });

  const recommended = evaluatedMethods[0];
  const baggagePaxCount = passengers.filter((p) => p.has_bag).length;

  const selectionRationale =
    `Berdasarkan evaluasi simulasi pada ${layout.name} (${passengerCount} penumpang, ${baggagePaxCount} orang membawa bagasi kabin), ` +
    `metode "${recommended.shortLabel}" menghasilkan estimasi waktu boarding terendah yaitu ${recommended.metrics.boarding_time_seconds.toFixed(1)} detik ` +
    `(${recommended.metrics.boarding_time_minutes.toFixed(2)} menit) dengan ${recommended.metrics.aisle_interference_events} kejadian antre lorong dan ` +
    `${recommended.metrics.seat_interference_events} kejadian halangan kursi di antara ${evaluatedMethods.length} metode kandidat yang diuji.`;

  return {
    scenario: {
      layout,
      passengerCount,
      baggagePassengerCount: baggagePaxCount,
      seed,
    },
    recommendedMethod: recommended,
    evaluatedMethods,
    zoneOptimizationAudit: {
      kZones: K_ZONES,
      totalZoneCandidatesEvaluated: zoneCandidates.length,
      bestZoneConfig: bestZoneCandidate,
      fixedZoneBaseline: {
        boundaries: fixedBounds,
        sizes: fixedSizes,
        order: [3, 2, 1],
        boardingTimeSeconds: fixedMetrics.boarding_time_seconds,
        boardingTimeMinutes: fixedMetrics.boarding_time_minutes,
      },
      azboWilmaEquivalenceVerified,
    },
    selectionRationale,
    scientificCaveats: [
      `Hasil ini merupakan keluaran simulasi untuk skenario yang Anda jalankan (${layout.name}, ${passengerCount} penumpang, ${baggagePaxCount} orang membawa bagasi kabin), bukan klaim keunggulan universal di seluruh penerbangan.`,
      `Rekomendasi dipilih dari ${evaluatedMethods.length} metode kandidat yang dievaluasi pada skenario ini menggunakan fungsi objektif minimisasi total waktu boarding.`,
      "Model simulator v3 mengasumsikan lorong pada baris tujuan tertutup sementara selama penumpang menyimpan bagasi kabin dan masuk ke kursi.",
    ],
    azboImplementationNotes: {
      implementedInCode: [
        `Evaluasi komparatif seluruh metode kandidat yang didukung pada daftar penumpang dan bagasi yang identik.`,
        `Pencarian konfigurasi pembagian 3 zona terbaik (${zoneCandidates.length} kombinasi batas baris dan urutan pemanggilan zona) dengan aturan Window-Middle-Aisle (Zone-WMA).`,
        `Audit ekuivalensi urutan Back-to-Front-AZBO-WILMA terhadap Back-to-Front-WILMA pada zona berurutan dari belakang ke depan.`,
      ],
      missingFormalSpecInSource: [
        "Dokumen sumber yang tersedia di repositori hanya mencantumkan identifier fungsi back_to_front_azbo_wilma_order serta optimasi zona GA/Exhaustive (Zone-WMA), tanpa naskah definisi formal terpisah mengenai kepanjangan akronim AZBO atau pembobotan multi-objektif di luar waktu boarding.",
      ],
    },
  };
}

