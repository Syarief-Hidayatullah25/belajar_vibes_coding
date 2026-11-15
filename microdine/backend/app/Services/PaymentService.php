<?php

namespace App\Services;

use App\Events\OrderPaid;
use App\Models\Order;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PaymentService
{
    /**
     * Tandai order lunas secara idempoten.
     *
     * Dipakai webhook QRIS maupun konfirmasi tunai kasir. Hanya di sini
     * payment_status berubah menjadi paid, sehingga Pay-First Gate konsisten.
     */
    public function markPaid(Order $order, ?string $notes = null): Order
    {
        $paid = DB::transaction(function () use ($order, $notes) {
            /** @var Order $locked */
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);

            if ($locked->payment_status === Order::PAYMENT_PAID) {
                return $locked;
            }

            if ($locked->payment_status === Order::PAYMENT_EXPIRED) {
                throw new RuntimeException('Pesanan sudah kedaluwarsa dan tidak bisa dibayar.');
            }

            $locked->update([
                'payment_status' => Order::PAYMENT_PAID,
                'paid_at' => now(),
            ]);

            $locked->logStatus('payment', Order::PAYMENT_PAID, $notes ?? 'Pembayaran dikonfirmasi.');

            return $locked->refresh();
        });

        if ($paid->wasChanged('payment_status') || $paid->paid_at !== null) {
            event(new OrderPaid($paid));
        }

        return $paid;
    }

    public function markFailed(Order $order, ?string $notes = null): Order
    {
        return DB::transaction(function () use ($order, $notes) {
            /** @var Order $locked */
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);

            if ($locked->payment_status === Order::PAYMENT_PAID) {
                throw new RuntimeException('Pesanan sudah lunas, tidak bisa ditandai gagal.');
            }

            $locked->update(['payment_status' => Order::PAYMENT_FAILED]);
            $locked->logStatus('payment', Order::PAYMENT_FAILED, $notes ?? 'Pembayaran gagal.');

            return $locked->refresh();
        });
    }
}
