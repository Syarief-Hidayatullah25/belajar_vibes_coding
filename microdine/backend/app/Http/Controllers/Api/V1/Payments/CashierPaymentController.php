<?php

namespace App\Http\Controllers\Api\V1\Payments;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\PaymentService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class CashierPaymentController extends Controller
{
    public function __construct(private readonly PaymentService $payments) {}

    /**
     * POST /api/v1/cashier/orders/{order}/confirm-cash
     *
     * Kasir mengonfirmasi uang tunai diterima. Mengembalikan kembalian agar
     * modal kalkulator di frontend bisa memverifikasi hasilnya.
     */
    public function confirm(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'cash_received' => ['required', 'numeric', 'min:0'],
        ]);

        if ($order->payment_method !== Order::PAYMENT_METHOD_CASH) {
            return ApiResponse::error('Pesanan ini bukan pembayaran tunai.', [], 422);
        }

        if ($order->payment_status === Order::PAYMENT_PAID) {
            return ApiResponse::error('Pesanan sudah lunas.', [], 409);
        }

        $cashReceived = (float) $validated['cash_received'];
        $grandTotal = (float) $order->grand_total;

        if ($cashReceived < $grandTotal) {
            return ApiResponse::error('Uang diterima kurang dari total tagihan.', [
                'cash_received' => ['Kurang '.number_format($grandTotal - $cashReceived, 0, ',', '.').'.'],
            ], 422);
        }

        try {
            $paid = $this->payments->markPaid(
                $order,
                'Tunai diterima kasir. Uang: '.number_format($cashReceived, 0, ',', '.').'.',
            );
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), [], 409);
        }

        return ApiResponse::ok([
            'order_number' => $paid->order_number,
            'payment_status' => $paid->payment_status,
            'paid_at' => $paid->paid_at?->toIso8601String(),
            'grand_total' => (float) $paid->grand_total,
            'cash_received' => $cashReceived,
            'change_due' => round($cashReceived - $grandTotal, 2),
        ], 'Pembayaran tunai dikonfirmasi.');
    }
}
