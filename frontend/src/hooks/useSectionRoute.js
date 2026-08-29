// ════════════════════════════════════════════════════════
//  useSectionRoute — đồng bộ mục đang mở của dashboard với URL
//
//  Thay `useState('products')` trong từng dashboard. Trả về đúng cặp
//  `[active, setActive]` như cũ nên sidebar và switch-case renderSection()
//  không phải sửa gì; khác biệt là state nằm trên URL:
//
//    • /seller/price-sheets bookmark / gửi link / F5 được, vẫn đúng mục.
//    • Nút Back của trình duyệt quay lại mục trước thay vì thoát dashboard.
//    • Remount (quay lại từ /price-sheets/:id) đọc lại mục từ URL, không rớt
//      về mục mặc định nữa.
//
//  URL thiếu mục (`/seller`) hoặc slug lạ (`/seller/xyz`) → viết lại bằng
//  `replace` sang mục mặc định: không đẻ thêm bước lịch sử để Back khỏi kẹt.
// ════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/**
 * @param {object}   opts
 * @param {string}   opts.basePath  gốc route của role, ví dụ '/seller'
 * @param {Array}    opts.sections  [{ id, slug, title? }] — xem constants/dashboardSections
 * @param {string=}  opts.fallback  id mục mặc định (mặc định: mục đầu danh sách)
 * @returns {[string|null, (id: string) => void]}
 */
export default function useSectionRoute({ basePath, sections, fallback }) {
  const { section: slugFromUrl } = useParams();
  const navigate = useNavigate();

  const matched = sections.find((s) => s.slug === slugFromUrl) || null;
  const fallbackSection = sections.find((s) => s.id === fallback) || sections[0] || null;
  const current = matched || fallbackSection;

  const active = current?.id ?? null;
  // So bằng chuỗi (không phải object) để deps của effect ổn định — sections có
  // thể là mảng dựng lại mỗi lần render (PD lọc project theo quyền).
  const targetSlug = current?.slug ?? null;
  const title = current?.title || null;

  useEffect(() => {
    if (!targetSlug || slugFromUrl === targetSlug) return;
    navigate(`${basePath}/${targetSlug}`, { replace: true });
  }, [slugFromUrl, targetSlug, basePath, navigate]);

  // Tên tab trình duyệt theo mục — bookmark và cửa sổ đang mở đọc được ngay là
  // mục nào, không phải 5 tab cùng tên "VendorHub".
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · HappyC VendorHub`;
    return () => { document.title = previous; };
  }, [title]);

  // `sections` có thể là mảng dựng lại mỗi render (PD lọc project theo quyền)
  // nên đọc qua ref: setActive giữ nguyên identity như setState của useState,
  // để các useCallback([]) trong dashboard không ôm bản cũ và không phải khai
  // thêm dependency.
  const sectionsRef = useRef(sections);
  useEffect(() => { sectionsRef.current = sections; }, [sections]);

  const setActive = useCallback((id) => {
    const next = sectionsRef.current.find((s) => s.id === id);
    navigate(next ? `${basePath}/${next.slug}` : basePath);
  }, [basePath, navigate]);

  return [active, setActive];
}
