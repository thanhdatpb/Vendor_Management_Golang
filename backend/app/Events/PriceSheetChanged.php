<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Báo cho các máy khác trong cùng project biết một bảng tính giá vừa đổi.
 *
 * Dùng ShouldBroadcastNow (phát đồng bộ) chứ KHÔNG phải ShouldBroadcast:
 * ProductChanged đang dùng ShouldBroadcast tức đi qua hàng đợi, nên nếu server
 * không chạy `queue:work` thì event nằm lại trong hàng đợi vô thời hạn và
 * realtime chết âm thầm. NotificationCreated đã dùng Now vì lý do tương tự.
 *
 * Payload chỉ mang TÍN HIỆU, không mang nội dung bảng giá — kênh Pusher là
 * public, client phải tự gọi API có Bearer token để lấy dữ liệu thật.
 */
class PriceSheetChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $sheetId;
    public string $action;
    public int $version;
    public string $updatedBy;
    private string $project;

    /**
     * @param string $action saved|deleted
     */
    public function __construct(string $sheetId, string $action, int $version, string $updatedBy, ?string $project)
    {
        $this->sheetId   = $sheetId;
        $this->action    = $action;
        $this->version   = $version;
        $this->updatedBy = $updatedBy;
        // Bảng không thuộc project nào phát trên kênh chung để không ai bị sót.
        $this->project   = $project !== null && $project !== '' ? $project : 'all';
    }

    public function broadcastOn(): array
    {
        return [new Channel('price-sheets.' . $this->project)];
    }

    public function broadcastAs(): string
    {
        return 'PriceSheetChanged';
    }

    /** Chỉ những trường này rời server — cố ý không có `data`/`productTypes`. */
    public function broadcastWith(): array
    {
        return [
            'id'        => $this->sheetId,
            'action'    => $this->action,
            'version'   => $this->version,
            'updatedBy' => $this->updatedBy,
        ];
    }
}
