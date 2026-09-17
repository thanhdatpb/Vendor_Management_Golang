import { HC } from '../../utils/constants';

export const money = (n) => `$${Number(n).toFixed(2)}`;

export const btn = (variant = 'line', extra = {}) => {
  const base = {
    borderRadius: 8,
    padding: '7px 12px',
    minHeight: 34,
    fontSize: 11.5,
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: "'Inter',sans-serif",
    border: '1.5px solid transparent',
  };
  const variants = {
    primary: { background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, borderColor: HC.orange, color: '#fff' },
    soft: { background: HC.orangeLight, borderColor: HC.orangeMid, color: HC.orangeDeep },
    line: { background: HC.surface, borderColor: HC.borderStrong, color: HC.brown },
    link: {
      background: 'none', border: 'none', padding: 0, minHeight: 0,
      color: HC.orangeDeep, textDecoration: 'underline', textUnderlineOffset: 2,
      fontWeight: 700, fontSize: 11,
    },
  };
  return { ...base, ...variants[variant], ...extra };
};
