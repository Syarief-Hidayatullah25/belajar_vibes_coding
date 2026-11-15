<?php

namespace App\Console\Commands;

use App\Models\Order;
use Illuminate\Console\Command;

class ExpirePendingOrders extends Command
{
    protected $signature = 'orders:expire {--minutes= : Override batas kedaluwarsa (default dari config)}';

    protected $description = 'Batalkan otomatis pesanan pending yang sudah melewati batas waktu bayar';

    public function handle(): int
    {
        $expired = Order::query()
            ->where('payment_status', Order::PAYMENT_PENDING)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->get();

        foreach ($expired as $order) {
            $order->update(['payment_status' => Order::PAYMENT_EXPIRED]);
            $order->logStatus('payment', Order::PAYMENT_EXPIRED, 'Dibatalkan otomatis: batas waktu pembayaran terlewat.');
        }

        $this->info("Pesanan kedaluwarsa ditandai: {$expired->count()}");

        return self::SUCCESS;
    }
}
