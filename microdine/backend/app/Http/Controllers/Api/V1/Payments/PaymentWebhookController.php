<?php

namespace App\Http\Controllers\Api\V1\Payments;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\PaymentGateway\PaymentGateway;
use App\Services\PaymentService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class PaymentWebhookController extends Controller
{
    public function __construct(
        private readonly PaymentGateway $gateway,
        private readonly PaymentService $payments,
    ) {}

    /**
     * POST /api/v1/payments/webhook/qris
     *
     * Endpoint publik: verifikasi signature atas raw body (HMAC-SHA256),
     * lalu ubah status pembayaran dan picu event OrderPaid.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $rawPayload = $request->getContent();
        $signature = $request->header('X-Callback-Signature');

        if (! $this->gateway->verifySignature($rawPayload, $signature)) {
            return ApiResponse::error('Signature webhook tidak valid.', [], 401);
        }

        /** @var array<string, mixed> $payload */
        $payload = json_decode($rawPayload, true) ?? [];

        $refId = $payload['ref_id'] ?? null;
        $status = $payload['status'] ?? null;

        if (! is_string($refId) || ! in_array($status, ['paid', 'failed'], true)) {
            return ApiResponse::error('Payload webhook tidak lengkap.', [
                'payload' => ['Butuh field ref_id dan status (paid|failed).'],
            ], 422);
        }

        $order = Order::query()->where('gateway_ref_id', $refId)->first();

        if ($order === null) {
            return ApiResponse::error('Transaksi gateway tidak dikenal.', [], 404);
        }

        try {
            $order = $status === 'paid'
                ? $this->payments->markPaid($order, 'Pembayaran QRIS terkonfirmasi via webhook.')
                : $this->payments->markFailed($order, 'Pembayaran QRIS gagal via webhook.');
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), [], 409);
        }

        return ApiResponse::ok([
            'order_number' => $order->order_number,
            'payment_status' => $order->payment_status,
            'paid_at' => $order->paid_at?->toIso8601String(),
        ], 'Webhook diproses.');
    }
}
