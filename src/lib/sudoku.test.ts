import { describe, expect, it } from "vitest";
import { applyHint, conflicts, elapsedSeconds, enterDigit, erase, formatTime, newGame, pauseClock, peers, select, toggleNotes, undo, type SudokuState } from "./sudoku";

// A known puzzle with its solution; cell 2 (row 0, col 2) is empty and should be 4.
const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const PUZZLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

function game(): SudokuState {
  return newGame("easy", 0, { puzzle: PUZZLE, solution: SOLUTION })!;
}

describe("sudoku", () => {
  it("generates a valid puzzle", () => {
    const state = newGame("medium");
    expect(state).not.toBeNull();
    expect(state!.given).toMatch(/^[0-9]{81}$/);
  });

  it("has 20 peers per cell", () => {
    expect(peers(40)).toHaveLength(20);
    expect(peers(0)).not.toContain(0);
  });

  it("never changes a given cell", () => {
    const state = select(game(), 0);
    expect(enterDigit(state, 9)).toBe(state);
  });

  it("enters, clears on a repeat tap, and undoes", () => {
    let state = select(game(), 2);
    state = enterDigit(state, 4);
    expect(state.values[2]).toBe(4);
    expect(enterDigit(state, 4).values[2]).toBe(0);
    expect(undo(state).values[2]).toBe(0);
  });

  it("flags clashes with peers", () => {
    const state = enterDigit(select(game(), 2), 5); // 5 is already in row 0
    expect(conflicts(state)[2]).toBe(true);
  });

  it("toggles pencil marks and clears them when a peer gets that digit", () => {
    let state = toggleNotes(select(game(), 2));
    state = enterDigit(state, 4);
    expect(state.notes[2] & (1 << 4)).toBeTruthy();
    state = toggleNotes(select(state, 3));
    state = enterDigit(state, 4); // wrong for cell 3 but it's a peer of cell 2
    expect(state.notes[2] & (1 << 4)).toBe(0);
    expect(erase(state).values[3]).toBe(0);
  });

  it("fixes a mistake before filling a new cell", () => {
    const wrong = enterDigit(select(game(), 2), 9);
    const { state, wasMistake } = applyHint(wrong);
    expect(wasMistake).toBe(true);
    expect(state.values[2]).toBe(4);
    expect(state.hintsUsed).toBe(1);
  });

  it("stops the clock when solved", () => {
    let state = game();
    for (let i = 0; i < 81; i++) state = applyHint(state, 5000).state;
    expect(state.solvedAt).toBe(5000);
    expect(state.runningSince).toBeNull();
    expect(elapsedSeconds(state, 999_999)).toBe(5);
  });

  it("banks time while paused", () => {
    const paused = pauseClock(game(), 10_000);
    expect(elapsedSeconds(paused, 60_000)).toBe(10);
    expect(formatTime(125)).toBe("02:05");
  });
});
