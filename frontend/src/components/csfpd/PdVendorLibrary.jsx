// ════════════════════════════════════════════════════════
//  THƯ VIỆN VENDOR — BỘ PHẬN PD
//
//  File riêng của PD. Cần đổi gì CHỈ cho PD thì sửa ở đây (hoặc ở khai báo
//  DEPARTMENTS.pd trong ./departments.js).
//
//  PD hiện: không thấy giá, KHÔNG thấy 2 cột "AVG TG", và tra cứu được thư
//  viện của mọi project (đã tách khỏi project).
// ════════════════════════════════════════════════════════
import VendorLibraryView from './VendorLibraryView';
import { DEPARTMENTS } from './departments';

export default function PdVendorLibrary({ projectKey, mode, onModeCountsChange }) {
  return (
    <VendorLibraryView
      projectKey={projectKey}
      department={DEPARTMENTS.pd}
      mode={mode}
      onModeCountsChange={onModeCountsChange}
    />
  );
}
