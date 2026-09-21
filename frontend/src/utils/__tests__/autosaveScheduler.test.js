// ════════════════════════════════════════════════════════
//  AUTOSAVE SCHEDULER — nhịp ghi tự động của bảng tính giá.
//  Ba bẫy được canh ở đây:
//    1. hai lượt ghi cùng bay → về ngược thứ tự → bản CŨ đè bản MỚI;
//    2. gõ liên tục mà không có trần chờ → cả phiên nhập không ghi lần nào;
//    3. 409 mà vẫn ghi tiếp → âm thầm đè mất công của người khác (mục 16).
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAutosave, isVersionConflict } from '../autosaveScheduler';

const conflict = () => Object.assign(new Error('409'), { response: { status: 409 } });
const offline = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

/**
 * Cho microtask của promise chạy hết giữa các mốc timer.
 * Nhiều nhịp vì một lượt ghi đi qua vài tầng then/catch — ít nhịp quá thì
 * assertion chạy TRƯỚC nhánh lỗi và test đỏ oan.
 */
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('debounce + trần chờ', () => {
  it('gõ nhiều lần chỉ ghi MỘT lần, với payload mới nhất', async () => {
    const save = vi.fn().mockResolvedValue({ version: 2 });
    const auto = createAutosave({ save, delay: 1500 });

    auto.schedule({ v: 1 });
    vi.advanceTimersByTime(900);
    auto.schedule({ v: 2 });
    vi.advanceTimersByTime(900);
    expect(save).not.toHaveBeenCalled(); // mỗi lần gõ đẩy lùi mốc ghi

    vi.advanceTimersByTime(600);
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ v: 2 });
  });

  it('gõ liên tục vẫn bị trần maxWait kéo đi ghi', async () => {
    const save = vi.fn().mockResolvedValue({});
    const auto = createAutosave({ save, delay: 1500, maxWait: 5000 });

    for (let i = 0; i < 10; i++) { auto.schedule({ i }); vi.advanceTimersByTime(1000); }
    await settle();
    expect(save).toHaveBeenCalled();
    expect(save.mock.calls[0][0].i).toBeGreaterThanOrEqual(3); // ghi quanh mốc 5s
  });

  it('không có thay đổi thì không gọi save', async () => {
    const save = vi.fn().mockResolvedValue({});
    const auto = createAutosave({ save });
    vi.advanceTimersByTime(60000);
    await auto.flush();
    expect(save).not.toHaveBeenCalled();
  });
});

describe('một request tại một thời điểm', () => {
  it('sửa tiếp trong lúc đang ghi → lượt sau chỉ chạy SAU khi lượt trước xong', async () => {
    let resolveFirst;
    const save = vi.fn()
      .mockImplementationOnce(() => new Promise((res) => { resolveFirst = res; }))
      .mockResolvedValue({});
    const auto = createAutosave({ save, delay: 1000 });

    auto.schedule({ v: 1 });
    vi.advanceTimersByTime(1000);
    await settle();
    expect(save).toHaveBeenCalledTimes(1);

    auto.schedule({ v: 2 });
    vi.advanceTimersByTime(5000);
    await settle();
    expect(save).toHaveBeenCalledTimes(1); // vẫn chờ lượt 1

    resolveFirst({});
    await settle();
    vi.advanceTimersByTime(1000);
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ v: 2 });
  });
});

describe('flush — rời tab / đóng bảng / bấm Lưu', () => {
  it('ghi ngay, không chờ hết debounce', async () => {
    const save = vi.fn().mockResolvedValue({});
    const auto = createAutosave({ save, delay: 5000 });
    auto.schedule({ v: 1 });
    await auto.flush();
    expect(save).toHaveBeenCalledWith({ v: 1 });
  });

  it('flush khi không còn gì chờ thì không gọi save', async () => {
    const save = vi.fn().mockResolvedValue({});
    const auto = createAutosave({ save });
    await auto.flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('cancel bỏ phần đang chờ', async () => {
    const save = vi.fn().mockResolvedValue({});
    const auto = createAutosave({ save, delay: 1000 });
    auto.schedule({ v: 1 });
    auto.cancel();
    vi.advanceTimersByTime(10000);
    await settle();
    expect(save).not.toHaveBeenCalled();
  });
});

describe('lỗi', () => {
  it('409 → DỪNG hẳn, không ghi thêm dù gõ tiếp', async () => {
    const save = vi.fn().mockRejectedValue(conflict());
    const onStatus = vi.fn();
    const auto = createAutosave({ save, delay: 1000, onStatus });

    auto.schedule({ v: 1 });
    vi.advanceTimersByTime(1000);
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(auto.isStopped()).toBe(true);
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ state: 'conflict' }));

    auto.schedule({ v: 2 });
    vi.advanceTimersByTime(60000);
    await auto.flush();
    expect(save).toHaveBeenCalledTimes(1); // không có lượt ghi nào nữa
  });

  it('lỗi mạng → thử lại với backoff, giữ nguyên nội dung chưa ghi', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(offline())
      .mockResolvedValue({});
    const onStatus = vi.fn();
    const auto = createAutosave({ save, delay: 1000, retryDelay: 2000, onStatus });

    auto.schedule({ v: 1 });
    vi.advanceTimersByTime(1000);
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(auto.isStopped()).toBe(false);
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ state: 'error' }));

    vi.advanceTimersByTime(2000);
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ v: 1 }); // nội dung không bị rơi
  });

  it('backoff tăng gấp đôi và có trần', async () => {
    const save = vi.fn().mockRejectedValue(offline());
    const auto = createAutosave({ save, delay: 100, retryDelay: 1000, maxRetryDelay: 3000 });

    auto.schedule({ v: 1 });
    vi.advanceTimersByTime(100); await settle();   // lần 1
    vi.advanceTimersByTime(1000); await settle();  // +1s  → lần 2
    expect(save).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000); await settle();  // chưa tới 2s
    expect(save).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000); await settle();  // đủ 2s → lần 3
    expect(save).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(3000); await settle();  // trần 3s → lần 4
    expect(save).toHaveBeenCalledTimes(4);
  });

  it('reset cho chạy lại sau khi người dùng xử lý xong xung đột', async () => {
    const save = vi.fn().mockRejectedValueOnce(conflict()).mockResolvedValue({});
    const auto = createAutosave({ save, delay: 500 });
    auto.schedule({ v: 1 });
    vi.advanceTimersByTime(500); await settle();
    expect(auto.isStopped()).toBe(true);

    auto.reset();
    expect(auto.isStopped()).toBe(false);
    auto.schedule({ v: 9 });
    vi.advanceTimersByTime(500); await settle();
    expect(save).toHaveBeenLastCalledWith({ v: 9 });
  });
});

describe('trạng thái báo cho UI', () => {
  it('saving → saved kèm mốc thời gian', async () => {
    const onStatus = vi.fn();
    const auto = createAutosave({ save: vi.fn().mockResolvedValue({}), delay: 100, onStatus });
    auto.schedule({ v: 1 });
    vi.advanceTimersByTime(100);
    await settle();
    const states = onStatus.mock.calls.map(([s]) => s.state);
    expect(states).toEqual(['saving', 'saved']);
    expect(onStatus.mock.calls.at(-1)[0].savedAt).toBeInstanceOf(Date);
  });

  it('isVersionConflict chỉ nhận đúng 409', () => {
    expect(isVersionConflict(conflict())).toBe(true);
    expect(isVersionConflict(offline())).toBe(false);
    expect(isVersionConflict({ response: { status: 500 } })).toBe(false);
  });
});
