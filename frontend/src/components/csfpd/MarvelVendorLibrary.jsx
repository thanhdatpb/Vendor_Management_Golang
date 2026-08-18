// ════════════════════════════════════════════════════════
//  THƯ VIỆN VENDOR — BỘ PHẬN MARVEL
//
//  File riêng của Marvel. Marvel từng dùng chung y hệt CSF; nay đã khác ở 2 cột
//  "AVG TG" và sẽ còn khác thêm — nên tách sẵn đường code riêng để lần sau đổi
//  không phải đụng tới CSF.
// ════════════════════════════════════════════════════════
import VendorLibraryView from './VendorLibraryView';
import { DEPARTMENTS } from './departments';

export default function MarvelVendorLibrary({ projectKey }) {
  return <VendorLibraryView projectKey={projectKey} department={DEPARTMENTS.marvel} />;
}
