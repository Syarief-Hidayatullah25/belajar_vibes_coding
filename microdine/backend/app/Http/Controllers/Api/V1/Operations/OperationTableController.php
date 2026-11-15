<?php

namespace App\Http\Controllers\Api\V1\Operations;

use App\Http\Controllers\Controller;
use App\Models\DiningTable;
use App\Models\Order;
use App\Models\TableSession;
use App\Services\TableSessionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OperationTableController extends Controller
{
    public function __construct(private readonly TableSessionService $sessions) {}

    /**
     * GET /api/v1/operations/tables
     *
     * Grid meja untuk Kasir: status, durasi sesi, dan ringkasan pesanan.
     */
    public function index(): JsonResponse
    {
        $tables = DiningTable::query()->orderBy('table_number')->get();

        $data = $tables->map(function (DiningTable $table) {
            $session = $table->activeSession();

            $orders = $session === null
                ? collect()
                : $session->orders()->withCount('items')->latest()->get();

            return [
                'id' => $table->id,
                'table_number' => $table->table_number,
                'area' => $table->area,
                'capacity' => $table->capacity,
                'status' => $table->status,
                'qr_token' => $table->qr_token,
                'barcode_code' => $table->barcode_code,
                'session' => $session === null ? null : [
                    'id' => $session->id,
                    'session_code' => $session->session_code,
                    'opened_at' => $session->opened_at?->toIso8601String(),
                    'duration_minutes' => $session->opened_at === null
                        ? 0
                        : (int) $session->opened_at->diffInMinutes(now()),
                    'orders_count' => $orders->count(),
                    'unpaid_total' => (float) $orders
                        ->where('payment_status', Order::PAYMENT_PENDING)
                        ->sum('grand_total'),
                    'orders' => $orders->map(fn (Order $order) => [
                        'id' => $order->id,
                        'order_number' => $order->order_number,
                        'payment_status' => $order->payment_status,
                        'kitchen_status' => $order->kitchen_status,
                        'grand_total' => (float) $order->grand_total,
                        'items_count' => $order->items_count,
                    ])->values(),
                ],
            ];
        });

        return ApiResponse::ok($data);
    }

    /**
     * POST /api/v1/operations/tables/{table}/close
     */
    public function close(Request $request, DiningTable $table): JsonResponse
    {
        $session = TableSession::query()
            ->where('table_id', $table->id)
            ->where('status', TableSession::STATUS_ACTIVE)
            ->latest('id')
            ->first();

        if ($session === null) {
            return ApiResponse::error('Meja ini tidak memiliki sesi aktif.', [], 422);
        }

        if ($session->hasUnfinishedOrders()) {
            return ApiResponse::error(
                'Masih ada pesanan yang belum selesai (belum dibayar atau belum disajikan).',
                ['session_code' => [$session->session_code]],
                422,
            );
        }

        $closed = $this->sessions->close($session, $request->user()->id);

        return ApiResponse::ok([
            'table_number' => $table->table_number,
            'session_code' => $closed->session_code,
            'status' => $closed->status,
            'closed_at' => $closed->closed_at?->toIso8601String(),
        ], 'Sesi meja ditutup.');
    }
}
