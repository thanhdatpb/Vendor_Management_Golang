// ════════════════════════════════════════════════════════
//  THƯ VIỆN VENDOR — BỘ PHẬN CSF
//
//  File riêng của CSF. Cần đổi gì CHỈ cho CSF thì sửa ở đây (hoặc ở khai báo
//  DEPARTMENTS.csf trong ./departments.js) — không đụng vào view dùng chung,
//  để không kéo theo PD và Marvel.
//
//  Hiện tại CSF khác PD/Marvel đúng một điểm: VẪN xem được 2 cột "AVG TG".
// ════════════════════════════════════════════════════════
import VendorLibraryView from './VendorLibraryView';
import { DEPARTMENTS } from './departments';

export default function CsfVendorLibrary({ projectKey }) {
  return <VendorLibraryView projectKey={projectKey} department={DEPARTMENTS.csf} />;
}
