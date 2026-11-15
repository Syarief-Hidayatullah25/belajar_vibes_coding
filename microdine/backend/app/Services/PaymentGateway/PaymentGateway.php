<?php

namespace App\Services\PaymentGateway;

use App\Models\Order;

/**
 * Kontrak gateway pembayaran.
 *
 * Implementasi saat ini: MockPaymentGateway. Untuk memakai provider sungguhan
 * (Midtrans/Xendit), buat kelas baru yang mengimplementasikan interface ini lalu
 * daftarkan di PaymentGatewayServiceProvider sesuai PAYMENT_GATEWAY_DRIVER.
 */
interface PaymentGateway
{
    /**
     * Buat transaksi QRIS untuk sebuah order.
     *
     * @return array{ref_id: string, payload: string, expires_at: string}
     */
    public function createQris(Order $order): array;

    /**
     * Verifikasi signature webhook. Payload mentah dipakai apa adanya agar
     * signature dihitung atas body asli, bukan hasil re-serialize.
     */
    public function verifySignature(string $rawPayload, ?string $signature): bool;
}
