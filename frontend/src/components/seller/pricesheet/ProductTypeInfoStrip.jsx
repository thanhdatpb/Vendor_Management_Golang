// ════════════════════════════════════════════════════════
//  PRODUCT TYPE INFO STRIP — dải thông tin phôi trên đầu mỗi Product Type
//  Bê nguyên MỘT DÒNG của bảng Thư viện Vendor (Vendor Name · Product Type ·
//  Hình ảnh · Chất liệu · Chi tiết Size · AVG TG Vendor · AVG TG Thực tế) lên
//  bảng tính giá, để Seller tra được thông tin phôi ngay tại chỗ thay vì phải
//  mở màn Thư viện Vendor. Trước đây chỗ này chỉ là mấy chip nhỏ nhét trong
//  toolbar: ảnh 26px, chất liệu/chi tiết size cắt ở 140px, AVG TG giấu trong
//  tooltip của icon ⏱ (xem ProductTypeCard).
//
//  ⚠ Dải này KHÔNG chứa trường giá nào — chỉ "info phôi" của thư viện.
//  Thumbnail và text "Chi tiết Size" dùng CHUNG renderer với Thư viện Vendor
//  (MediaThumb xử lý ảnh cần auth / link YouTube / Drive; renderChiTietSizeText
//  đổi link Google Docs thành chip) — không viết lại ở đây.
// ════════════════════════════════════════════════════════
import { PS } from './tokens';
import { MediaThumb, renderChiTietSizeText } from '../../vendor/sections/VendorLibraryViewer';

const th = (extra = {}) => ({
  padding: '5px 8px', fontWeight: 800, fontSize: 9.5, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: '#fff', background: PS.brandHover,
  border: `1px solid ${PS.brand}`, textAlign: 'left', whiteSpace: 'nowrap',
  verticalAlign: 'middle', ...extra,
});
const td = (extra = {}) => ({
  padding: '6px 8px', fontSize: 11.5, color: PS.textSecondary,
  border: `1px solid ${PS.border}`, background: PS.bgSurface,
  verticalAlign: 'top', wordBreak: 'break-word', overflowWrap: 'break-word', ...extra,
});
const dash = <span style={{ color: PS.textMuted }}>—</span>;
const orDash = (v) => (v ? v : dash);

/**
 * @param {object}   props
 * @param {string}   props.vendorName   mã vendor của record (VD: "VN3")
 * @param {string}   props.productType  tên phôi
 * @param {object}   props.info         libEntry — info phôi từ vendorLibraryIndex
 */
export default function ProductTypeInfoStrip({ vendorName, productType, info }) {
  if (!info) return null;

  // `images` là đường mới (nhiều ảnh); `image` là ảnh đại diện của index bản cũ
  // — giữ fallback để frontend mới chạy được với backend chưa deploy.
  const images = (Array.isArray(info.images) && info.images.length
    ? info.images
    : [info.image]).filter(Boolean);

  return (
    <div style={{ overflowX: 'auto', borderBottom: `1px solid ${PS.border}` }}>
      <table style={{
        width: '100%', minWidth: 860, borderCollapse: 'collapse', tableLayout: 'fixed',
      }}>
        <thead>
          <tr>
            <th style={th({ width: '11%' })}>Vendor Name</th>
            <th style={th({ width: '17%' })}>Product Type</th>
            <th style={th({ width: '14%' })}>Hình ảnh</th>
            <th style={th({ width: '14%' })}>Chất liệu</th>
            <th style={th({ width: '14%' })}>Chi tiết Size</th>
            <th style={th({ width: '15%', whiteSpace: 'normal', lineHeight: 1.3 })}>AVG TG (Vendor)</th>
            <th style={th({ width: '15%', whiteSpace: 'normal', lineHeight: 1.3 })}>AVG TG (Thực tế)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={td({ textAlign: 'center', fontWeight: 700, color: PS.text, verticalAlign: 'middle' })}>
              {orDash(vendorName)}
            </td>
            <td style={td({ fontWeight: 700, color: PS.text })}>{orDash(productType)}</td>
            <td style={td()}>
              {images.length ? (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {images.map((img, i) => (
                    <MediaThumb key={i} url={img} siblingUrls={images} index={i} />
                  ))}
                </div>
              ) : (
                <span style={{ color: PS.textMuted, fontSize: 10, fontStyle: 'italic' }}>Không có ảnh</span>
              )}
            </td>
            <td style={td({ whiteSpace: 'pre-wrap', lineHeight: 1.4 })}>{orDash(info.chatLieu)}</td>
            <td style={td({ whiteSpace: 'pre-wrap', lineHeight: 1.4 })}>
              {info.chiTietSizeImage && (
                <a href={info.chiTietSizeImage} target="_blank" rel="noreferrer"
                  style={{ display: 'block', marginBottom: info.chiTietSize ? 6 : 0 }}>
                  <img src={info.chiTietSizeImage} alt="Size Guide" loading="lazy"
                    style={{ width: '100%', borderRadius: 4, border: `1px solid ${PS.border}`, objectFit: 'contain' }} />
                </a>
              )}
              {info.chiTietSize
                ? renderChiTietSizeText(info.chiTietSize)
                : (!info.chiTietSizeImage ? dash : null)}
            </td>
            <td style={td({ whiteSpace: 'pre-wrap', lineHeight: 1.4, color: PS.positive })}>
              {orDash(info.avgTimeVendor)}
            </td>
            <td style={td({ whiteSpace: 'pre-wrap', lineHeight: 1.4, color: PS.warning })}>
              {orDash(info.avgTimeActual)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
