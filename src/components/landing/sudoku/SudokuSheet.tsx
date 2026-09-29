"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  SUDOKU_LEVELS,
  applyHint,
  conflicts,
  digitCounts,
  elapsedSeconds,
  enterDigit,
  erase,
  formatTime,
  isGiven,
  newGame,
  pauseClock,
  peers,
  resumeClock,
  select,
  toggleNotes,
  undo,
  type SudokuLevel,
  type SudokuState,
} from "@/lib/sudoku";
import { useSheet } from "../FeatureCard";
import { useLanding } from "../LandingContext";

type Games = Record<SudokuLevel, SudokuState | null>;
const NO_GAMES: Games = { easy: null, medium: null, hard: null };

/** Ticks once a second while the board's clock runs; nothing else re-renders for time. */
function Timer({ state }: { state: SudokuState | null }) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const running = !!state && state.runningSince !== null && !state.solvedAt;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running]);
  return <span className="sudoku-timer">{formatTime(state ? elapsedSeconds(state) : 0)}</span>;
}

function Board({ state, onSelect }: { state: SudokuState; onSelect: (index: number) => void }) {
  const clashes = conflicts(state);
  const selected = state.selected;
  const selectedValue = selected === null ? 0 : state.values[selected];
  const peerSet = new Set(selected === null ? [] : peers(selected));
  return (
    <div className="sudoku-board" role="grid">
      {state.values.map((value, i) => {
        const row = Math.floor(i / 9);
        const col = i % 9;
        let cls = "sudoku-cell";
        if (col % 3 === 2) cls += " br";
        if (row % 3 === 2) cls += " bb";
        if (i === selected) cls += " sel";
        else if (selectedValue && value === selectedValue) cls += " same";
        else if (peerSet.has(i)) cls += " peer";
        if (isGiven(state, i)) cls += " given";
        if (clashes[i]) cls += " bad";
        const notes = state.notes[i];
        return (
          <button key={i} type="button" className={cls} aria-label={`${row + 1}, ${col + 1}${value ? `: ${value}` : ""}`} onClick={() => onSelect(i)}>
            {value
              ? value
              : notes
                ? (
                    <span className="sudoku-notes">
                      {Array.from({ length: 9 }, (_, d) => (
                        <span key={d}>{notes & (1 << (d + 1)) ? d + 1 : ""}</span>
                      ))}
                    </span>
                  )
                : null}
          </button>
        );
      })}
    </div>
  );
}

export function SudokuSheet() {
  const { t, tf, track } = useLanding();
  const { isOpen } = useSheet();
  const [level, setLevel] = useState<SudokuLevel>("easy");
  const [games, setGames] = useState<Games>(NO_GAMES);
  const [failed, setFailed] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [hintFixed, setHintFixed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const state = games[level];

  /** Show `to`, dealing a board only if that level has never been played. */
  const showLevel = useCallback((to: SudokuLevel) => {
    setGames((current) => {
      const next = { ...current };
      for (const other of SUDOKU_LEVELS) if (other !== to && next[other]) next[other] = pauseClock(next[other]!);
      const existing = next[to];
      if (existing) next[to] = resumeClock(existing);
      else {
        const created = newGame(to);
        setFailed(!created);
        next[to] = created;
      }
      return next;
    });
    setLevel(to);
    setConfirmNew(false);
  }, []);

  // Opening deals or resumes the board; closing banks the time so far.
  // Adjusted during render (not in an effect) so the board never paints stale.
  const [seenOpen, setSeenOpen] = useState<boolean | null>(null);
  if (isOpen !== seenOpen) {
    setSeenOpen(isOpen);
    if (isOpen) showLevel(level);
    else setGames((current) => (current[level] ? { ...current, [level]: pauseClock(current[level]!) } : current));
  }

  useEffect(() => {
    if (isOpen) track("sudoku_opened", { difficulty: level });
    // Reported per opening, not per difficulty switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const update = useCallback(
    (fn: (s: SudokuState) => SudokuState) => {
      setGames((current) => {
        const before = current[level];
        if (!before) return current;
        const after = fn(before);
        if (!before.solvedAt && after.solvedAt) {
          track("sudoku_puzzle_solved", { difficulty: level, seconds: elapsedSeconds(after), hints_used: after.hintsUsed });
        }
        return { ...current, [level]: after };
      });
      setHintFixed(false);
    },
    [level, track],
  );

  function newBoard() {
    track("sudoku_new_game_tapped", { difficulty: level });
    const created = newGame(level);
    setFailed(!created);
    setGames((current) => ({ ...current, [level]: created }));
    setConfirmNew(false);
  }

  function hint() {
    track("sudoku_hint_used", { difficulty: level });
    let fixed = false;
    update((s) => {
      const result = applyHint(s);
      fixed = result.wasMistake;
      return result.state;
    });
    // update() clears the flag; set it after so this repaint shows the notice.
    queueMicrotask(() => setHintFixed(fixed));
  }

  // Desktop keyboard play while the sheet is open. Typing in other forms is left alone.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.key === "Escape" && confirmNew) {
        event.preventDefault();
        setConfirmNew(false);
        track("sudoku_new_game_confirm_dismissed", { difficulty: level });
        return;
      }
      if (!state || state.solvedAt || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key >= "1" && event.key <= "9") {
        event.preventDefault();
        update((s) => enterDigit(s, Number(event.key)));
      } else if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
        event.preventDefault();
        update(erase);
      } else if (event.key.startsWith("Arrow") && state.selected !== null) {
        event.preventDefault();
        let row = Math.floor(state.selected / 9);
        let col = state.selected % 9;
        if (event.key === "ArrowLeft") col = Math.max(0, col - 1);
        if (event.key === "ArrowRight") col = Math.min(8, col + 1);
        if (event.key === "ArrowUp") row = Math.max(0, row - 1);
        if (event.key === "ArrowDown") row = Math.min(8, row + 1);
        update((s) => ({ ...s, selected: row * 9 + col }));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, state, confirmNew, level, update, track]);

  const levelLabels: Record<SudokuLevel, string> = { easy: t("sudoku_easy"), medium: t("sudoku_medium"), hard: t("sudoku_hard") };
  const counts = state ? digitCounts(state) : [];
  const hasSelection = state?.selected !== null && state?.selected !== undefined;

  return (
    <div className="sudoku-inner" ref={bodyRef}>
      <div className="sudoku-headrow">
        <h3 className="sudoku-heading">{t("sudoku_title")}</h3>
        {state && (
          <button
            type="button"
            className="sudoku-refresh"
            aria-label={t("sudoku_new_game")}
            aria-expanded={confirmNew}
            onClick={() => {
              if (confirmNew) return;
              setConfirmNew(true);
              track("sudoku_new_game_confirm_shown", { difficulty: level });
            }}
          >
            <RefreshCw strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      <div className="sudoku-top">
        <div className="sudoku-levels" role="tablist" aria-label={t("sudoku_difficulty")}>
          {SUDOKU_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              className="sudoku-level"
              aria-selected={l === level}
              onClick={() => {
                if (l === level) return;
                const resumed = !!games[l];
                showLevel(l);
                track("sudoku_difficulty_changed", { difficulty: l, resumed });
              }}
            >
              {levelLabels[l]}
            </button>
          ))}
        </div>
        <Timer state={state} />
      </div>

      {failed || !state ? (
        <div className="sudoku-status" role="status">
          <p>{t("sudoku_start_failed")}</p>
          <button type="button" className="sudoku-primary" onClick={newBoard}>
            {t("try_again")}
          </button>
        </div>
      ) : (
        <>
          {confirmNew && (
            <div className="sudoku-confirm">
              <p>{t("sudoku_new_game_confirm")}</p>
              <button type="button" className="sudoku-primary" onClick={newBoard}>
                {t("sudoku_yes")}
              </button>
              <button
                type="button"
                className="sheet-btn"
                autoFocus
                onClick={() => {
                  setConfirmNew(false);
                  track("sudoku_new_game_confirm_dismissed", { difficulty: level });
                }}
              >
                {t("sudoku_no")}
              </button>
            </div>
          )}
          <Board state={state} onSelect={(i) => update((s) => select(s, i))} />
          {state.solvedAt ? (
            <div className="sudoku-status" role="status">
              <p>{tf("sudoku_solved_in", { time: formatTime(elapsedSeconds(state)) })}</p>
              <button type="button" className="sudoku-primary" onClick={newBoard}>
                {t("sudoku_new_game")}
              </button>
            </div>
          ) : (
            <>
              {hintFixed && (
                <div className="sudoku-status" role="status">
                  <p>{t("sudoku_hint_fixed")}</p>
                </div>
              )}
              <div className="sudoku-actions">
                <button
                  type="button"
                  className="sheet-btn"
                  aria-pressed={state.notesMode}
                  onClick={() => {
                    update(toggleNotes);
                    track("sudoku_notes_toggled", { value: state.notesMode ? "off" : "on" });
                  }}
                >
                  {t("sudoku_notes")}
                </button>
                <button type="button" className="sheet-btn" disabled={!state.history.length} onClick={() => update((s) => undo(s))}>
                  {t("sudoku_undo")}
                </button>
                <button type="button" className="sheet-btn" disabled={!hasSelection} onClick={() => update(erase)}>
                  {t("sudoku_erase")}
                </button>
                <button type="button" className="sheet-btn" onClick={hint}>
                  {t("sudoku_hint")}
                </button>
              </div>
              <div className={`sudoku-pad${state.notesMode ? " notes" : ""}`}>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((digit) => (
                  <button key={digit} type="button" disabled={!hasSelection || counts[digit] >= 9} onClick={() => update((s) => enterDigit(s, digit))}>
                    {digit}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
