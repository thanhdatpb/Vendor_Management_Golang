// ════════════════════════════════════════════════════════
//  BẢN NHÁP BẢNG TÍNH GIÁ — lưới an toàn khi autosave lên server thất bại.
//  Bẫy: nháp ghi hỏng (hết quota) KHÔNG được ném ra ngoài, nếu không mỗi lần
//  gõ một phím là cả workspace vỡ.
// ════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DRAFT_PREFIX, draftKey, saveDraft, readDraft, clearDraft,
  draftDiffers, isStaleDraft, contentSignature,
} from '../priceSheetDraft';

const content = {
  name: 'Pajamas',
  settings: { price: '6.99', quantity: 1 },
  productTypes: [{ id: 'pt_1', name: 'Satin', sizes: [{ id: 'sz_1', label: 'S' }] }],
};

// Node 22+ có global `localStorage` riêng (chưa bật) che mất bản của jsdom, nên
// trong test không có localStorage thật — dựng bản giả tối thiểu (cùng cách
// constants/__tests__/vendorFieldVisibility.test.js đang làm).
const fakeStorage = (initial = {}) => {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
  };
};

beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));

describe('khoá theo từng bảng', () => {
  it('mỗi sheet một khoá riêng, không id thì không có nháp', () => {
    expect(draftKey('sheet_a')).toBe(`${DRAFT_PREFIX}sheet_a`);
    expect(draftKey('sheet_b')).not.toBe(draftKey('sheet_a'));
    expect(draftKey('')).toBe('');
    expect(draftKey(null)).toBe('');
  });

  it('saveDraft không id → không ghi gì vào localStorage', () => {
    expect(saveDraft('', content)).toBe(false);
    expect(localStorage.length).toBe(0);
  });
});

describe('ghi / đọc / xoá', () => {
  it('đọc lại đúng nội dung đã ghi, kèm baseVersion và savedAt', () => {
    saveDraft('sheet_a', { ...content, baseVersion: 7, savedAt: '2026-09-21T03:00:00.000Z' });
    const draft = readDraft('sheet_a');
    expect(draft.name).toBe('Pajamas');
    expect(draft.productTypes).toHaveLength(1);
    expect(draft.baseVersion).toBe(7);
    expect(draft.savedAt).toBe('2026-09-21T03:00:00.000Z');
  });

  it('KHÔNG giữ history trong nháp (localStorage đã từng chạm trần 5MB)', () => {
    saveDraft('sheet_a', { ...content, history: [{ version: 1 }, { version: 2 }] });
    expect(readDraft('sheet_a').history).toBeUndefined();
    expect(localStorage.getItem(draftKey('sheet_a'))).not.toContain('history');
  });

  it('readDraft trả null khi chưa có, khi JSON hỏng, hoặc khi thiếu productTypes', () => {
    expect(readDraft('sheet_a')).toBeNull();
    localStorage.setItem(draftKey('sheet_a'), '{ hỏng');
    expect(readDraft('sheet_a')).toBeNull();
    localStorage.setItem(draftKey('sheet_a'), JSON.stringify({ name: 'x' }));
    expect(readDraft('sheet_a')).toBeNull();
  });

  it('clearDraft xoá đúng bảng đó, không đụng bảng khác', () => {
    saveDraft('sheet_a', content);
    saveDraft('sheet_b', content);
    clearDraft('sheet_a');
    expect(readDraft('sheet_a')).toBeNull();
    expect(readDraft('sheet_b')).not.toBeNull();
  });

  it('hết quota → trả false, KHÔNG ném (luồng gõ không được vỡ vì nháp)', () => {
    vi.stubGlobal('localStorage', {
      ...fakeStorage(),
      setItem: () => { throw new Error('QuotaExceededError'); },
    });
    expect(() => saveDraft('sheet_a', content)).not.toThrow();
    expect(saveDraft('sheet_a', content)).toBe(false);
  });

  it('môi trường không có localStorage → readDraft null, saveDraft false, không ném', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(saveDraft('sheet_a', content)).toBe(false);
    expect(readDraft('sheet_a')).toBeNull();
    expect(() => clearDraft('sheet_a')).not.toThrow();
  });
});

describe('so sánh nháp với bản đang mở / bản server', () => {
  it('draftDiffers: giống hệt → false, đổi một ô giá → true', () => {
    saveDraft('sheet_a', content);
    const draft = readDraft('sheet_a');
    expect(draftDiffers(draft, content)).toBe(false);
    expect(draftDiffers(draft, { ...content, settings: { price: '9.99', quantity: 1 } })).toBe(true);
    expect(draftDiffers(null, content)).toBe(false);
  });

  it('contentSignature bỏ qua các trường ngoài name/settings/productTypes', () => {
    expect(contentSignature({ ...content, version: 3, updatedAt: 'x' })).toBe(contentSignature(content));
  });

  it('isStaleDraft: nháp dựa trên version cũ hơn bản server → stale', () => {
    expect(isStaleDraft({ baseVersion: 5 }, { version: 8 })).toBe(true);
    expect(isStaleDraft({ baseVersion: 8 }, { version: 8 })).toBe(false);
    expect(isStaleDraft({ baseVersion: null }, { version: 8 })).toBe(false);
    expect(isStaleDraft({ baseVersion: 5 }, {})).toBe(false);
  });
});
