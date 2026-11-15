<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Dipicu saat pembayaran dikonfirmasi (QRIS webhook atau tunai di kasir).
 *
 * Ini yang membuat pesanan muncul di layar Dapur: Dapur hanya mendengarkan
 * event ini, sehingga aturan Pay-First Gate terjaga.
 */
class OrderPaid implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Order $order) {}

    /**
     * Channel publik agar bisa didengarkan Kasir, Dapur, dan pelanggan.
     * Untuk produksi, ganti ke PrivateChannel + otorisasi channel.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('orders'),
            new Channel('order.'.$this->order->id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'OrderPaid';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'order_id' => $this->order->id,
            'order_number' => $this->order->order_number,
            'payment_method' => $this->order->payment_method,
            'payment_status' => $this->order->payment_status,
            'kitchen_status' => $this->order->kitchen_status,
            'grand_total' => (float) $this->order->grand_total,
            'paid_at' => $this->order->paid_at?->toIso8601String(),
        ];
    }
}
