// ════════════════════════════════════════════════════════
//  useResizablePane — nửa trên (thông tin request) kéo cao/thấp được, kèm
//  nút thu gọn để dồn chỗ cho nửa dưới (bảng vendor). Toàn bộ phép tính nằm
//  ở utils/paneResize.js; hook chỉ lo state + sự kiện chuột/cảm ứng/bàn phím.
// ════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PANE_DEFAULT_RATIO, PANE_PAGE_STEP, PANE_STEP,
  clampPaneRatio, ratioFromPointer, readPaneState, writePaneState,
} from '../utils/paneResize';

export default function useResizablePane({
  storageKey,
  enabled = true,
  defaultRatio = PANE_DEFAULT_RATIO,
  minTopPx,
  minBottomPx,
} = {}) {
  const containerRef = useRef(null);
  const [state, setState] = useState(() => (
    storageKey ? readPaneState(storageKey, { ratio: defaultRatio }) : { ratio: defaultRatio, collapsed: false }
  ));
  const [dragging, setDragging] = useState(false);

  const bounds = useMemo(() => ({ minTopPx, minBottomPx }), [minTopPx, minBottomPx]);

  useEffect(() => {
    if (storageKey) writePaneState(storageKey, state);
  }, [storageKey, state]);

  const setRatio = useCallback((next) => {
    setState(prev => {
      const container = containerRef.current?.getBoundingClientRect().height ?? 0;
      const raw = typeof next === 'function' ? next(prev.ratio) : next;
      return { collapsed: false, ratio: clampPaneRatio(raw, container, bounds) };
    });
  }, [bounds]);

  const applyPointer = useCallback((clientY) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ratioFromPointer(clientY, rect.top, rect.height, bounds);
    if (next == null) return;
    setState(prev => (prev.ratio === next && !prev.collapsed ? prev : { ratio: next, collapsed: false }));
  }, [bounds]);

  // Kéo: nghe trên window để con trỏ chạy ra ngoài thanh chia vẫn bám theo.
  const startDrag = useCallback((e) => {
    if (!enabled) return;
    const isTouch = e.type === 'touchstart';
    if (!isTouch && e.button !== 0) return;
    e.preventDefault();
    setDragging(true);

    const move = (ev) => {
      const y = ev.touches?.[0]?.clientY ?? ev.clientY;
      if (typeof y === 'number') applyPointer(y);
      if (ev.cancelable) ev.preventDefault();
    };
    const stop = () => {
      setDragging(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', stop);
      window.removeEventListener('touchcancel', stop);
      try {
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      } catch { /* không có DOM */ }
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', stop);
    window.addEventListener('touchcancel', stop);
    try {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'row-resize';
    } catch { /* không có DOM */ }
  }, [enabled, applyPointer]);

  const toggleCollapse = useCallback(() => {
    setState(prev => ({ ...prev, collapsed: !prev.collapsed }));
  }, []);

  const reset = useCallback(() => {
    setState({ ratio: defaultRatio, collapsed: false });
  }, [defaultRatio]);

  const onKeyDown = useCallback((e) => {
    if (!enabled) return;
    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); setRatio(r => r - PANE_STEP); break;
      case 'ArrowDown':  e.preventDefault(); setRatio(r => r + PANE_STEP); break;
      case 'PageUp':     e.preventDefault(); setRatio(r => r - PANE_PAGE_STEP); break;
      case 'PageDown':   e.preventDefault(); setRatio(r => r + PANE_PAGE_STEP); break;
      case 'Home':       e.preventDefault(); setRatio(0); break;
      case 'End':        e.preventDefault(); setRatio(1); break;
      case 'Enter':
      case ' ':          e.preventDefault(); toggleCollapse(); break;
      default: break;
    }
  }, [enabled, setRatio, toggleCollapse]);

  return {
    containerRef,
    ratio: state.ratio,
    collapsed: state.collapsed,
    dragging,
    startDrag,
    onKeyDown,
    toggleCollapse,
    reset,
  };
}
