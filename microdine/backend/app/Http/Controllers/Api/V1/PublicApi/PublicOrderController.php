<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Models\DiningTable;
use App\Models\Order;
use App\Models\TableSession;
use App\Services\OrderService;
use App\Services\TableSessionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PublicOrderController extends Controller
{
    public function __construct(
        private readonly TableSessionService $sessions,
        private readonly OrderService $orders,
    ) {}

    /**
     * POST /api/v1/public/orders
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'qr_token' => ['required_without:table_session_id', 'string', 'exists:tables,qr_token'],
            'table_session_id' => ['required_without:qr_token', 'integer', 'exists:table_sessions,id'],
            'customer_name' => ['nullable', 'string', 'max:100'],
            'payment_method' => ['required', Rule::in([Order::PAYMENT_METHOD_QRIS, Order::PAYMENT_METHOD_CASH])],
            'items' => ['required', 'array', 'min:1'],
            'items.*.menu_id' => ['required', 'integer', 'exists:menus,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ]);

        $session = $this->resolveSession($validated);

        $order = $this->orders->create(
            session: $session,
            items: $validated['items'],
            paymentMethod: $validated['payment_method'],
            customerName: $validated['customer_name'] ?? null,
            source: Order::SOURCE_QR,
        );

        return ApiResponse::ok($this->present($order), 'Pesanan dibuat, menunggu pembayaran.', 201);
    }

    /**
     * GET /api/v1/public/orders/{order_number}
     *
     * Dipakai halaman status pelanggan (progress tracker + countdown).
     */
    public function show(string $orderNumber): JsonResponse
    {
        $order = Order::query()
            ->with(['items', 'tableSession.table', 'statusLogs'])
            ->where('order_number', $orderNumber)
            ->firstOrFail();

        return ApiResponse::ok($this->present($order, withTimeline: true));
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function resolveSession(array $validated): TableSession
    {
        if (isset($validated['qr_token'])) {
            return $this->sessions->scan($validated['qr_token'])['session'];
        }

        $session = TableSession::query()->find($validated['table_session_id']);

        if ($session === null || $session->status !== TableSession::STATUS_ACTIVE) {
            throw ValidationException::withMessages([
                'table_session_id' => ['Sesi meja tidak aktif.'],
            ]);
        }

        return $session;
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Order $order, bool $withTimeline = false): array
    {
        $data = [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'customer_name' => $order->customer_name,
            'table' => $order->tableSession?->table === null ? null : [
                'table_number' => $order->tableSession->table->table_number,
                'area' => $order->tableSession->table->area,
            ],
            'session_code' => $order->tableSession?->session_code,
            'subtotal' => (float) $order->subtotal,
            'tax_amount' => (float) $order->tax_amount,
            'grand_total' => (float) $order->grand_total,
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'kitchen_status' => $order->kitchen_status,
            'paid_at' => $order->paid_at?->toIso8601String(),
            'expires_at' => $order->expires_at?->toIso8601String(),
            'seconds_until_expiry' => $order->expires_at === null
                ? null
                : max(0, (int) now()->diffInSeconds($order->expires_at, false)),
            'qris_payload' => $order->qris_payload,
            'items' => $order->items->map(fn ($item) => [
                'menu_id' => $item->menu_id,
                'menu_name' => $item->menu_name_snapshot,
                'quantity' => $item->quantity,
                'unit_price' => (float) $item->unit_price_snapshot,
                'subtotal_price' => (float) $item->subtotal_price,
                'notes' => $item->notes,
            ])->values(),
        ];

        if ($withTimeline) {
            $data['timeline'] = $order->statusLogs
                ->sortBy('created_at')
                ->map(fn ($log) => [
                    'type' => $log->status_type,
                    'value' => $log->status_value,
                    'notes' => $log->notes,
                    'at' => $log->created_at?->toIso8601String(),
                ])->values();
        }

        return $data;
    }
}
