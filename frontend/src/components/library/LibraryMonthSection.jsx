import { HC } from '../../constants/sellerTheme';

export default function LibraryMonthSection({ monthKey, label, count, children }) {
  return (
    <section aria-label={label} data-testid={`library-month-${monthKey}`}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 10, padding: '8px 12px',
        background: HC.orangePale,
        borderTop: `1px solid ${HC.border}`,
        borderBottom: `1px solid ${HC.border}`,
      }}>
        <h3 style={{
          margin: 0, color: HC.brown, fontSize: 11, fontWeight: 900,
          letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
          {label}
        </h3>
        <span aria-hidden="true" style={{ color: HC.muted2 }}>·</span>
        <span style={{ color: HC.brown, fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
          {count} file
        </span>
      </header>
      {children}
    </section>
  );
}
