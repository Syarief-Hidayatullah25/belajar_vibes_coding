<?php

namespace App\Services\PaymentGateway;

use App\Models\Order;
use Illuminate\Support\Str;

/**
 * Gateway tiruan untuk development: tidak menghubungi pihak ketiga.
 *
 * qris_payload berisi string yang bisa dirender menjadi QR oleh frontend.
 * Webhook harus dipicu manual dengan signature HMAC-SHA256 dari raw body.
 */
class MockPaymentGateway implements PaymentGateway
{
    public function createQris(Order $order): array
    {
        $refId = 'MOCK-'.$order->order_number.'-'.Str::upper(Str::random(6));

        $payload = json_encode([
            'type' => 'mock_qris',
            'ref_id' => $refId,
            'order_number' => $order->order_number,
            'amount' => (int) round((float) $order->grand_total),
            'merchant' => 'MICRODINE (MOCK)',
        ], JSON_UNESCAPED_SLASHES);

        return [
            'ref_id' => $refId,
            'payload' => $payload,
            'expires_at' => $order->expires_at?->toIso8601String() ?? now()->addMinutes(15)->toIso8601String(),
        ];
    }

    public function verifySignature(string $rawPayload, ?string $signature): bool
    {
        if ($signature === null || $signature === '') {
            return false;
        }

        $secret = (string) config('services.payment_gateway.secret');

        return hash_equals(hash_hmac('sha256', $rawPayload, $secret), $signature);
    }
}
