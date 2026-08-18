<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Báo thư viện Vendor vừa bị ghi (import file mới, đổi Sample, đổi Best Seller,
 * upload ảnh, khôi phục backup).
 *
 * Vì sao cần: trước đây `fetchLibrary` chỉ chạy lúc mount. Sau khi Vendor import
 * file mới, người đang mở tab vẫn thấy bản cũ — và nếu họ mở bảng tính giá thì
 * `loadVendorLibraryIndex` cũng lấy giá vốn cũ mà không hay biết. Điều đó mâu
 * thuẫn với yêu cầu coi Hub là nguồn thông tin chính thức (feedback CS).
 *
 * Payload chỉ mang mốc thời gian để client so và quyết định có tải lại không.
 */
class VendorLibraryChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $reason;
    public string $updatedAt;

    /**
     * @param string $reason import|sample-status|best-seller|images|restore
     */
    public function __construct(string $reason)
    {
        $this->reason    = $reason;
        $this->updatedAt = now()->toIso8601String();
    }

    public function broadcastOn(): array
    {
        return [new Channel('vendor-library')];
    }

    public function broadcastAs(): string
    {
        return 'VendorLibraryChanged';
    }

    public function broadcastWith(): array
    {
        return [
            'reason'    => $this->reason,
            'updatedAt' => $this->updatedAt,
        ];
    }
}
