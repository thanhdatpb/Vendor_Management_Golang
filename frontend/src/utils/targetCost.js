// ─── Target Cost (product.total_cost) ───────────────────
// Trường này là chuỗi tự do vì Seller nhập Base + Shipping gộp lại, thường ra một
// KHOẢNG ("100-150") chứ không phải một con số. Number("100-150") = NaN, nên mọi
// chỗ so sánh giá vendor với target đều phải đi qua helper này thay vì Number().

// Chuẩn hoá dấu phân cách trước khi bắt số: "1,000" → "1000", "100,5" → "100.5".
const normalizeSeparators = (text) =>
  text
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1')      // dấu phẩy hàng nghìn
    .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2');  // dấu phẩy thập phân

/**
 * Tách mọi số có trong chuỗi target cost.
 * Chấp nhận "100", "100-150", "$100 - $150", "100 – 150" (en dash), "1,000-1,500".
 *
 * @returns {{min: number, max: number, isRange: boolean, raw: string}|null}
 *          null nếu không tìm được số nào (chuỗi rỗng, chữ thuần...).
 */
export function parseTargetCost(raw) {
  if (raw == null) return null;

  const text = String(raw).trim();
  if (!text) return null;

  const matches = normalizeSeparators(text).match(/\d+(?:\.\d+)?/g);
  if (!matches) return null;

  const values = matches.map(Number).filter(Number.isFinite);
  if (!values.length) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);

  return { min, max, isRange: max > min, raw: text };
}

/**
 * Trần dùng để đánh giá "trong target" — với khoảng giá là CẬN TRÊN.
 * Vendor báo giá <= cận trên nghĩa là vẫn nằm trong ngân sách Seller đưa ra.
 *
 * @returns {number|null} null nếu không parse được (khi đó UI phải ẩn phần so sánh
 *          thay vì hiện NaN).
 */
export function targetCostCeiling(raw) {
  const parsed = parseTargetCost(raw);

  return parsed ? parsed.max : null;
}
