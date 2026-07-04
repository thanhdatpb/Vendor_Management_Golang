<?php

namespace App\Events;

use App\Models\Product;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ProductChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $action;
    public array $product;

    /**
     * @param string $action created|updated|approved|rejected|deleted|submitted
     */
    public function __construct(Product $product, string $action)
    {
        $this->action = $action;
        $this->product = [
            'id'            => $product->id,
            'status'        => $product->status,
            'project'       => $product->project ?? $product->creator?->project,
            'product_type'  => $product->product_type,
            'created_by'    => $product->created_by,
            'deadline_date' => $product->deadline_date,
        ];
    }

    public function broadcastOn(): array
    {
        return [new Channel('products')];
    }

    public function broadcastAs(): string
    {
        return 'ProductChanged';
    }
}
