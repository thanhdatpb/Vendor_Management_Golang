import React, { useState } from 'react';
import { sampleDecisionApi } from '../services/api';
import { pushNotif } from '../utils/notifUtils';

export default function SampleDecisionModal({ product, vendor, onClose }) {
    const [decision, setDecision] = useState(''); // 'dat' hoặc 'khong'
    const [sampleDetails, setSampleDetails] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!decision) {
            alert('Vui lòng chọn quyết định (Đặt hoặc Không đặt)');
            return;
        }
        if (decision === 'dat' && !sampleDetails.trim()) {
            alert('Vui lòng nhập chi tiết sample');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Lưu quyết định vào localStorage (hoặc API)
            const decisionData = {
                productId: product.id,
                productType: product.product_type,
                vendorId: vendor.id,
                vendorType: vendor.vendor_type,
                decision: decision === 'dat' ? 'dat' : 'khong',
                sampleDetails: decision === 'dat' ? sampleDetails : null,
                sellerFeedback: '',
                respondedAt: new Date().toISOString()
            };

            // Lưu quyết định qua API (fallback localStorage nếu backend chưa có endpoint)
            try {
                await sampleDecisionApi.save(product.id, {
                    vendor_id: vendor.id,
                    vendor_type: vendor.vendor_type,
                    decision: decisionData.decision,
                    sample_details: decisionData.sampleDetails,
                });
            } catch {
                const allDecisions = JSON.parse(localStorage.getItem('STAFF_SAMPLE_DECISIONS_V1') || '{}');
                if (!allDecisions[product.id]) allDecisions[product.id] = {};
                allDecisions[product.id][vendor.id] = decisionData;
                localStorage.setItem('STAFF_SAMPLE_DECISIONS_V1', JSON.stringify(allDecisions));
            }

            // Gửi thông báo cho Staff B
            await pushNotif('staff_b', {
                type: decision === 'dat' ? 'sample_approved' : 'sample_rejected',
                icon: decision === 'dat' ? '' : '',
                title: decision === 'dat' ? 'Seller đồng ý đặt Sample' : 'Seller từ chối đặt Sample',
                message: `Seller đã ${decision === 'dat' ? 'đồng ý' : 'từ chối'} đặt Sample cho vendor "${vendor.vendor_type}" (sản phẩm: ${product.product_type}).${decision === 'dat' ? ` Chi tiết: ${sampleDetails}` : ''}`,
                product_id: product.id,
                productType: product.product_type,
                vendorType: vendor.vendor_type,
                sampleDetails: decision === 'dat' ? sampleDetails : null,
                source: 'seller',
            });

            alert('Đã gửi quyết định thành công!');
            onClose();
        } catch (err) {
            console.error(err);
            alert('Lỗi khi gửi quyết định');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#fff',
                    borderRadius: 20,
                    padding: 24,
                    width: 500,
                    maxWidth: '90%',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                }}
            >
                <h3 style={{ marginTop: 0 }}>📦 Quyết định đặt Sample</h3>
                <div style={{ marginBottom: 20 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Sản phẩm: {product.product_type}</div>
                    <div style={{ fontWeight: 600, marginBottom: 16 }}>Vendor: {vendor.vendor_type}</div>

                    <label style={{ display: 'block', marginBottom: 8 }}>Chọn quyết định:</label>
                    <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                                type="radio"
                                name="sampleDecision"
                                value="dat"
                                checked={decision === 'dat'}
                                onChange={() => setDecision('dat')}
                            />
                            Đặt sample
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                                type="radio"
                                name="sampleDecision"
                                value="khong"
                                checked={decision === 'khong'}
                                onChange={() => setDecision('khong')}
                            />
                            Không đặt
                        </label>
                    </div>

                    {decision === 'dat' && (
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', marginBottom: 6 }}>📝 Chi tiết sample (bắt buộc):</label>
                            <textarea
                                rows={4}
                                value={sampleDetails}
                                onChange={e => setSampleDetails(e.target.value)}
                                placeholder="Nhập thông tin chi tiết: số lượng, màu sắc, kích thước, chất liệu, ..."
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: 8,
                                    border: '1px solid #ccc',
                                    resize: 'vertical',
                                }}
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 20px',
                            borderRadius: 8,
                            border: '1px solid #ccc',
                            background: '#f5f5f5',
                            cursor: 'pointer',
                        }}
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        style={{
                            padding: '8px 20px',
                            borderRadius: 8,
                            border: 'none',
                            background: submitting ? '#aaa' : '#F5A623',
                            color: '#fff',
                            fontWeight: 'bold',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {submitting ? 'Đang gửi...' : 'Gửi quyết định'}
                    </button>
                </div>
            </div>
        </div>
    );
}