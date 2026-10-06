"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/** Moves the item at `from` to position `to`, shifting the ones in between. */
export function moveTo<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Reorder a vertical list by dragging a handle (mouse, pen or touch) or by
 * focusing the handle and pressing ↑/↓. Rows register themselves with
 * `rowRef(index)`; the handle spreads `handleProps(index)`.
 */
export function useDragReorder(count: number, onMove: (from: number, to: number) => void) {
  const rows = useRef<(HTMLElement | null)[]>([]);
  const current = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  function end() {
    current.current = null;
    setDragging(null);
  }

  /** The row whose box the pointer is over, or the nearest end of the list. */
  function rowAt(y: number): number {
    for (let i = 0; i < count; i++) {
      const box = rows.current[i]?.getBoundingClientRect();
      if (box && y >= box.top && y <= box.bottom) return i;
    }
    const first = rows.current[0]?.getBoundingClientRect();
    return first && y < first.top ? 0 : count - 1;
  }

  function handleProps(index: number) {
    return {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        current.current = index;
        setDragging(index);
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const from = current.current;
        if (from === null) return;
        const to = rowAt(event.clientY);
        if (to === from) return;
        onMove(from, to);
        current.current = to;
        setDragging(to);
      },
      onPointerUp: end,
      onPointerCancel: end,
      onKeyDown(event: KeyboardEvent<HTMLElement>) {
        const to = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : null;
        if (to === null || to < 0 || to >= count) return;
        event.preventDefault();
        onMove(index, to);
        // Keep focus on the handle as it follows its row.
        const handle = event.currentTarget;
        requestAnimationFrame(() => handle.isConnected && handle.focus());
      },
    };
  }

  return {
    dragging,
    handleProps,
    rowRef: (index: number) => (element: HTMLElement | null) => {
      rows.current[index] = element;
    },
  };
}
