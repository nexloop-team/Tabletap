import { getSudoku } from "sudoku-gen";

/**
 * Pure Sudoku game state. No DOM and no timers: the sheet component owns
 * rendering and the clock interval, and these functions are unit-tested.
 * Cells are indexed row-major, 0..80. Notes are a bitmask per cell (bit N = N).
 */

export const SUDOKU_LEVELS = ["easy", "medium", "hard"] as const;
export type SudokuLevel = (typeof SUDOKU_LEVELS)[number];

export interface SudokuState {
  level: SudokuLevel;
  given: string;
  solution: string;
  values: number[];
  notes: number[];
  history: { values: number[]; notes: number[] }[];
  hintsUsed: number;
  selected: number | null;
  notesMode: boolean;
  /** Banked play time plus a running start, so a hidden board stops ageing. */
  elapsedMs: number;
  runningSince: number | null;
  solvedAt: number | null;
}

const HISTORY_LIMIT = 200;

export function generatePuzzle(level: SudokuLevel): { puzzle: string; solution: string } | null {
  try {
    const game = getSudoku(level);
    const puzzle = game.puzzle.replace(/-/g, "0");
    if (!/^[0-9]{81}$/.test(puzzle) || !/^[1-9]{81}$/.test(game.solution)) return null;
    return { puzzle, solution: game.solution };
  } catch {
    return null;
  }
}

export function newGame(level: SudokuLevel, now = Date.now(), puzzle = generatePuzzle(level)): SudokuState | null {
  if (!puzzle) return null;
  return {
    level,
    given: puzzle.puzzle,
    solution: puzzle.solution,
    values: puzzle.puzzle.split("").map(Number),
    notes: new Array(81).fill(0),
    history: [],
    hintsUsed: 0,
    selected: null,
    notesMode: false,
    elapsedMs: 0,
    runningSince: now,
    solvedAt: null,
  };
}

/** The 20 cells sharing a row, column or box with `index`. */
export function peers(index: number): number[] {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const boxRow = row - (row % 3);
  const boxCol = col - (col % 3);
  const out = new Set<number>();
  for (let k = 0; k < 9; k++) {
    out.add(row * 9 + k);
    out.add(k * 9 + col);
    out.add((boxRow + Math.floor(k / 3)) * 9 + boxCol + (k % 3));
  }
  out.delete(index);
  return [...out];
}

export const isGiven = (s: SudokuState, index: number) => s.given.charAt(index) !== "0";
const solutionAt = (s: SudokuState, index: number) => s.solution.charCodeAt(index) - 48;

function clone(s: SudokuState): SudokuState {
  return { ...s, values: s.values.slice(), notes: s.notes.slice(), history: s.history.slice() };
}

function pushHistory(s: SudokuState) {
  s.history.push({ values: s.values.slice(), notes: s.notes.slice() });
  if (s.history.length > HISTORY_LIMIT) s.history.shift();
}

function place(s: SudokuState, index: number, digit: number) {
  s.values[index] = digit;
  s.notes[index] = 0;
  const bit = 1 << digit;
  for (const p of peers(index)) s.notes[p] &= ~bit;
}

export function isSolved(s: SudokuState): boolean {
  return s.values.every((v, i) => v === solutionAt(s, i));
}

export function pauseClock(s: SudokuState, now = Date.now()): SudokuState {
  if (s.runningSince === null) return s;
  return { ...s, elapsedMs: s.elapsedMs + Math.max(0, now - s.runningSince), runningSince: null };
}

export function resumeClock(s: SudokuState, now = Date.now()): SudokuState {
  if (s.solvedAt || s.runningSince !== null) return s;
  return { ...s, runningSince: now };
}

export function elapsedSeconds(s: SudokuState, now = Date.now()): number {
  const running = s.runningSince === null ? 0 : now - s.runningSince;
  return Math.max(0, Math.floor((s.elapsedMs + running) / 1000));
}

function finishIfSolved(s: SudokuState, now: number): SudokuState {
  if (s.solvedAt || !isSolved(s)) return s;
  return { ...pauseClock(s, now), solvedAt: now, selected: null };
}

export function select(s: SudokuState, index: number | null): SudokuState {
  return { ...s, selected: index === s.selected ? null : index };
}

/** Enter a digit in the selected cell: a value, or a pencil mark in notes mode. */
export function enterDigit(s: SudokuState, digit: number, now = Date.now()): SudokuState {
  const index = s.selected;
  if (index === null || s.solvedAt || isGiven(s, index) || digit < 1 || digit > 9) return s;
  const next = clone(s);
  pushHistory(next);
  if (s.notesMode) {
    next.values[index] = 0; // a value and pencil marks never coexist
    next.notes[index] ^= 1 << digit;
    return next;
  }
  if (next.values[index] === digit) next.values[index] = 0; // same digit again clears it
  else place(next, index, digit);
  return finishIfSolved(next, now);
}

export function erase(s: SudokuState): SudokuState {
  const index = s.selected;
  if (index === null || s.solvedAt || isGiven(s, index) || (!s.values[index] && !s.notes[index])) return s;
  const next = clone(s);
  pushHistory(next);
  next.values[index] = 0;
  next.notes[index] = 0;
  return next;
}

export function undo(s: SudokuState, now = Date.now()): SudokuState {
  if (!s.history.length) return s;
  const next = clone(s);
  const previous = next.history.pop()!;
  next.values = previous.values;
  next.notes = previous.notes;
  // Undoing the winning move puts the board back in play.
  next.solvedAt = null;
  return resumeClock(next, now);
}

export function toggleNotes(s: SudokuState): SudokuState {
  return { ...s, notesMode: !s.notesMode };
}

/** Cells whose value clashes with a peer. Never compared against the solution. */
export function conflicts(s: SudokuState): boolean[] {
  return s.values.map((value, i) => value !== 0 && peers(i).some((p) => s.values[p] === value));
}

export function digitCounts(s: SudokuState): number[] {
  const counts = new Array(10).fill(0);
  for (const v of s.values) counts[v]++;
  return counts;
}

function candidates(values: number[], index: number): number[] {
  const used = new Set(peers(index).map((p) => values[p]));
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (!used.has(d)) out.push(d);
  return out;
}

/**
 * Next cell worth filling. A wrong entry outranks everything — "you have a
 * mistake" is the honest answer to "I'm stuck". Otherwise prefer a cell with a
 * single candidate (one a human could deduce), then the first empty cell.
 */
export function findHint(s: SudokuState): { index: number; value: number; wasMistake: boolean } | null {
  if (s.solvedAt) return null;
  for (let i = 0; i < 81; i++) {
    if (!isGiven(s, i) && s.values[i] && s.values[i] !== solutionAt(s, i)) return { index: i, value: solutionAt(s, i), wasMistake: true };
  }
  let firstEmpty = -1;
  for (let i = 0; i < 81; i++) {
    if (s.values[i]) continue;
    if (firstEmpty === -1) firstEmpty = i;
    const options = candidates(s.values, i);
    if (options.length === 1) return { index: i, value: options[0], wasMistake: false };
  }
  return firstEmpty === -1 ? null : { index: firstEmpty, value: solutionAt(s, firstEmpty), wasMistake: false };
}

export function applyHint(s: SudokuState, now = Date.now()): { state: SudokuState; wasMistake: boolean } {
  const hint = findHint(s);
  if (!hint) return { state: s, wasMistake: false };
  const next = clone(s);
  pushHistory(next);
  place(next, hint.index, hint.value);
  next.hintsUsed += 1;
  next.selected = hint.index;
  return { state: finishIfSolved(next, now), wasMistake: hint.wasMistake };
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
