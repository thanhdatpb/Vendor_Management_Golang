// ════════════════════════════════════════════════════════
//  AUTOSAVE SCHEDULER — thuần, không dính React, test được bằng fake timers.
//
//  Luật chơi rút ra từ cách Seller thao tác trên bảng tính giá:
//    • debounce  — gõ xong 1.5s mới ghi, không bắn request theo từng phím.
//    • maxWait   — gõ liên tục vẫn phải ghi ít nhất mỗi 12s, nếu không một
//                  phiên nhập 8 dòng size có thể chẳng ghi lần nào.
//    • 1 request — không bao giờ để 2 lượt ghi cùng bay: chúng có thể về
//                  ngược thứ tự và bản CŨ đè lên bản MỚI.
//    • 409 = DỪNG — xung đột phiên bản phải để người dùng quyết (mục 16).
//                  Autosave tự `force` là đúng kiểu âm thầm xoá công người khác.
//    • lỗi mạng  — thử lại có backoff, nội dung vẫn nằm trong bản nháp ở máy.
// ════════════════════════════════════════════════════════

/** Mặc định: chỉ 409 (xung đột phiên bản) mới làm autosave dừng hẳn. */
export const isVersionConflict = (err) => err?.response?.status === 409;

/**
 * @param {object}   o
 * @param {Function} o.save        (payload) => Promise — hàm ghi thật.
 * @param {number}   [o.delay]     debounce sau thao tác cuối (ms).
 * @param {number}   [o.maxWait]   trần chờ khi gõ liên tục (ms).
 * @param {Function} [o.onStatus]  ({state, savedAt, error}) — 'idle'|'saving'|'saved'|'error'|'conflict'.
 * @param {Function} [o.shouldStop] (err) => bool — true thì dừng hẳn.
 * @param {number}   [o.retryDelay] lần thử lại đầu tiên sau lỗi mạng (ms).
 * @param {number}   [o.maxRetryDelay] trần backoff (ms).
 */
export function createAutosave({
  save,
  delay = 1500,
  maxWait = 12000,
  onStatus = () => {},
  shouldStop = isVersionConflict,
  retryDelay = 4000,
  maxRetryDelay = 30000,
} = {}) {
  let pending = null;        // payload chờ ghi
  let hasPending = false;    // tách khỏi `pending` vì payload có thể là null hợp lệ
  let timer = null;          // debounce
  let maxTimer = null;       // trần chờ
  let inflight = null;       // promise của lượt ghi đang bay
  let stopped = false;
  let backoff = retryDelay;

  const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const clearMaxTimer = () => { if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; } };
  const clearTimers = () => { clearTimer(); clearMaxTimer(); };

  const arm = (ms) => {
    clearTimer();
    timer = setTimeout(() => { timer = null; run(); }, ms);
  };

  function run() {
    if (stopped) return inflight || Promise.resolve();
    // Đang có lượt ghi bay: KHÔNG chồng request. Lượt hiện tại xong sẽ tự
    // kéo phần còn chờ đi tiếp (xem nhánh `hasPending` ở dưới).
    if (inflight) return inflight;
    if (!hasPending) return Promise.resolve();

    clearTimers();
    const payload = pending;
    pending = null;
    hasPending = false;

    onStatus({ state: 'saving' });
    inflight = Promise.resolve()
      .then(() => save(payload))
      .then((result) => {
        inflight = null;
        backoff = retryDelay;
        onStatus({ state: 'saved', savedAt: new Date() });
        if (hasPending && !stopped) arm(delay); // sửa tiếp trong lúc đang ghi
        return result;
      })
      .catch((err) => {
        inflight = null;
        // Nội dung chưa ghi được phải quay lại hàng chờ — trừ khi người dùng
        // đã sửa thêm (payload mới hơn thì giữ payload mới).
        if (!hasPending) { pending = payload; hasPending = true; }

        if (shouldStop(err)) {
          stopped = true;
          clearTimers();
          onStatus({ state: 'conflict', error: err });
          return undefined;
        }

        onStatus({ state: 'error', error: err });
        arm(backoff);
        backoff = Math.min(backoff * 2, maxRetryDelay);
        return undefined;
      });

    return inflight;
  }

  return {
    /** Có thay đổi mới cần ghi. Gọi thoải mái theo từng lần gõ. */
    schedule(payload) {
      if (stopped) return;
      pending = payload;
      hasPending = true;
      arm(delay);
      if (!maxTimer) {
        maxTimer = setTimeout(() => { maxTimer = null; run(); }, maxWait);
      }
    },

    /**
     * Ghi ngay, không chờ debounce — dùng khi rời tab / đóng bảng / bấm Lưu.
     * Chờ cả lượt đang bay lẫn phần còn chờ sau nó.
     */
    async flush() {
      if (stopped) return;
      clearTimers();
      await run();
      if (hasPending && !stopped) {
        clearTimers();
        await run();
      }
    },

    /** Bỏ phần đang chờ (không ghi). Lượt đang bay vẫn chạy nốt. */
    cancel() {
      clearTimers();
      pending = null;
      hasPending = false;
    },

    /** Dừng hẳn — sau 409 hoặc khi đóng workspace. */
    stop() {
      stopped = true;
      clearTimers();
    },

    /** Chạy lại sau khi người dùng xử lý xong xung đột. */
    reset() {
      stopped = false;
      backoff = retryDelay;
      clearTimers();
      pending = null;
      hasPending = false;
      onStatus({ state: 'idle' });
    },

    isStopped: () => stopped,
    hasPending: () => hasPending,
  };
}
