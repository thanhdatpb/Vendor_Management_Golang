// ════════════════════════════════════════════════════════
//  ADD CUSTOMIZE INFO MODAL — spec §3.6
//  Header trắng, label sentence-case, helper text dưới input,
//  primary disabled khi tên rỗng, Esc/focus-trap từ ModalShell.
// ════════════════════════════════════════════════════════
import { useState, useId } from 'react';
import { PS } from './tokens';
import { ModalShell, Btn } from './primitives';

export default function AddCustomizeInfoModal({ onClose, onConfirm }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const nameId = useId();
  const priceId = useId();
  const canCreate = !!name.trim();

  const submit = () => {
    if (!canCreate) return;
    onConfirm(name.trim(), price ? Number(price) : 0);
  };

  return (
    <ModalShell title="＋ Add Customize Info" onClose={onClose} width={360}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Huỷ</Btn>
        <Btn variant="primary" disabled={!canCreate} onClick={submit}>Tạo cột</Btn>
      </>}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label htmlFor={nameId} style={{ display: 'block', fontSize: 12.5, fontWeight: 650, color: PS.textSecondary, marginBottom: 5 }}>
            Tên cột
          </label>
          <input id={nameId} value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            className="ps-input" />
          <div style={{ fontSize: 11.5, color: PS.textMuted, marginTop: 4 }}>VD: COLOR, DTG…</div>
        </div>
        <div>
          <label htmlFor={priceId} style={{ display: 'block', fontSize: 12.5, fontWeight: 650, color: PS.textSecondary, marginBottom: 5 }}>
            Giá mặc định ($)
          </label>
          <input id={priceId} type="number" step="0.01" value={price} placeholder="0.00"
            onChange={(e) => setPrice(e.target.value)} onWheel={(e) => e.target.blur()}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            className="ps-input ps-input--num" />
          <div style={{ fontSize: 11.5, color: PS.textMuted, marginTop: 4 }}>
            Sẽ được điền sẵn cho mọi size — sửa lại từng dòng được.
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
