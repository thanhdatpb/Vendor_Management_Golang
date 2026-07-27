// ════════════════════════════════════════════════════════
//  USER AVATAR — hiển thị ảnh đại diện Google (avatar_url) nếu có,
//  fallback về chữ cái đầu / icon khi chưa liên kết Google hoặc ảnh lỗi.
//  Dùng chung cho sidebar của mọi vai trò.
// ════════════════════════════════════════════════════════
import { useState } from 'react';
import { UserOutlined } from '@ant-design/icons';
import { HC } from '../../constants/sellerTheme';

export default function UserAvatar({ user, size = 36, radius = 10, fontSize }) {
  const [broken, setBroken] = useState(false);
  const url = user?.avatar_url || user?.avatarUrl || '';
  const letter = (user?.full_name || user?.name || user?.email || '').trim().charAt(0).toUpperCase();

  const base = {
    width: size, height: size, borderRadius: radius,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
  };

  // Ảnh Google — referrerPolicy cần thiết để googleusercontent trả ảnh đúng.
  if (url && !broken) {
    return (
      <img
        src={url}
        alt={user?.full_name || 'Avatar'}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        style={{ ...base, objectFit: 'cover', background: '#fff' }}
      />
    );
  }

  return (
    <div style={{
      ...base,
      background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
      color: '#fff', fontWeight: 800,
      fontSize: fontSize || Math.round(size * 0.44),
      fontFamily: "'Nunito',sans-serif",
    }}>
      {letter || <UserOutlined />}
    </div>
  );
}
