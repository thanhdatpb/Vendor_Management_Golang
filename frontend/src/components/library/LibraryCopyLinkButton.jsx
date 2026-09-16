import { useEffect, useRef, useState } from 'react';
import { HC } from '../../constants/sellerTheme';
import { copyLibraryFileLink } from '../../utils/libraryFileLink';

export const COPY_FEEDBACK_MS = 3000;

/**
 * Nút copy dùng chung trong header cửa sổ file thư viện.
 * Phản hồi thành công nằm ngay trên nút để không che nội dung bảng bằng toast.
 */
export default function LibraryCopyLinkButton({ file, onError }) {
  const [copied, setCopied] = useState(false);
  const mountedRef = useRef(true);
  const resetTimerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await copyLibraryFileLink(file.id, file.filename);
      if (!mountedRef.current) return;
      setCopied(true);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, COPY_FEEDBACK_MS);
    } catch (err) {
      if (!mountedRef.current) return;
      setCopied(false);
      onError?.(err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy link'}
      aria-live="polite"
      title={copied ? 'Đã copy link' : 'Copy link file'}
      style={{
        minWidth: 94, padding: '6px 12px', borderRadius: 9, cursor: 'pointer',
        border: `1.5px solid ${copied ? HC.success : HC.borderStrong}`,
        background: copied ? '#ecfdf5' : HC.surface,
        color: copied ? '#047857' : HC.brown,
        fontSize: 11.5, fontWeight: 800,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease',
      }}
    >
      <span aria-hidden="true">{copied ? '✓' : '🔗'}</span>
      <span>{copied ? 'Copied' : 'Copy link'}</span>
    </button>
  );
}
