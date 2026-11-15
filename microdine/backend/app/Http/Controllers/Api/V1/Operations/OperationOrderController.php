<?php

namespace App\Http\Controllers\Api\V1\Operations;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderService;
use App\Services\TableSessionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OperationOrderController extends Controller
{
    public function __construct(
        private readonly OrderService $orders,
        private readonly TableSessionService $sessions,
    ) {}

    /**
     * POST /api/v1/operations/orders/manual
     *
     * Kasir memindai barcode meja (atau memilih meja), sistem me-resolve sesi
     * aktif (membuat bila perlu) lalu membuat pesanan POS.
     */
    public function manual(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'barcode_code' => ['required_without:table_id', 'string', 'exists:tables,barcode_code'],
            'table_id' => ['required_without:barcode_code', 'integer', 'exists:tables,id'],
            'customer_name' => ['nullable', 'string', 'max:100'],
            'payment_method' => ['required', Rule::in([Order::PAYMENT_METHOD_QRIS, Order::PAYMENT_METHOD_CASH])],
            'items' => ['required', 'array', 'min:1'],
            'items.*.menu_id' => ['required', 'integer', 'exists:menus,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ]);

        $table = isset($validated['barcode_code'])
            ? \App\Models\DiningTable::query()->where('barcode_code', $validated['barcode_code'])->firstOrFail()
            : \App\Models\DiningTable::query()->findOrFail($validated['table_id']);

        $session = $this->sessions->scanByBarcode($table->barcode_code)['session'];

        $order = $this->orders->create(
            session: $session,
            items: $validated['items'],
            paymentMethod: $validated['payment_method'],
            customerName: $validated['customer_name'] ?? null,
            source: Order::SOURCE_POS,
        );

        return ApiResponse::ok([
            'order_number' => $order->order_number,
            'session_code' => $session->session_code,
            'table_number' => $table->table_number,
            'subtotal' => (float) $order->subtotal,
            'tax_amount' => (float) $order->tax_amount,
            'grand_total' => (float) $order->grand_total,
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'qris_payload' => $order->qris_payload,
        ], 'Pesanan manual dibuat.', 201);
    }

    /**
     * GET /api/v1/operations/orders/queue?screen=kasir|kitchen
     *
     * Pay-First Gate: layar Dapur hanya menerima pesanan yang sudah paid.
     */
    public function queue(Request $request): JsonResponse
    {
        $screen = $request->string('screen', 'kasir')->toString();

        $todayOrders = Order::query()
            ->with(['items', 'tableSession.table'])
            ->whereDate('created_at', now()->toDateString())
            ->whereIn('payment_status', [Order::PAYMENT_PENDING, Order::PAYMENT_PAID])
            ->orderBy('created_at')
            ->get();

        if ($screen === 'kitchen') {
            $paid = $todayOrders->where('payment_status', Order::PAYMENT_PAID);

            return ApiResponse::ok([
                'screen' => 'kitchen',
                'columns' => [
                    'cooking' => $paid->where('kitchen_status', Order::KITCHEN_COOKING)->values()->map($this->present(...)),
                    'ready' => $paid->where('kitchen_status', Order::KITCHEN_READY)->values()->map($this->present(...)),
                ],
            ]);
        }

        $paid = $todayOrders->where('payment_status', Order::PAYMENT_PAID);

        return ApiResponse::ok([
            'screen' => 'kasir',
            'columns' => [
                'waiting_payment' => $todayOrders->where('payment_status', Order::PAYMENT_PENDING)->values()->map($this->present(...)),
                'processing' => $paid->whereIn('kitchen_status', [Order::KITCHEN_WAITING, Order::KITCHEN_COOKING])->values()->map($this->present(...)),
                'ready' => $paid->where('kitchen_status', Order::KITCHEN_READY)->values()->map($this->present(...)),
            ],
        ]);
    }

    /**
     * PATCH /api/v1/operations/orders/{order}/kitchen-status
     */
    public function updateKitchenStatus(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'kitchen_status' => ['required', Rule::in(array_keys(Order::KITCHEN_TRANSITIONS))],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        if (! $order->isPaid()) {
            return ApiResponse::error('Pesanan belum dibayar, status dapur tidak bisa diubah.', [], 409);
        }

        $target = $validated['kitchen_status'];
        $allowed = Order::KITCHEN_TRANSITIONS[$order->kitchen_status] ?? [];

        if (! in_array($target, $allowed, true)) {
            throw ValidationException::withMessages([
                'kitchen_status' => ["Transisi dari {$order->kitchen_status} ke {$target} tidak diizinkan."],
            ]);
        }

        $previous = $order->kitchen_status;
        $order->update(['kitchen_status' => $target]);
        $order->logStatus('kitchen', $target, $validated['notes'] ?? null);

        event(new OrderStatusUpdated($order->refresh(), $previous));

        return ApiResponse::ok([
            'order_number' => $order->order_number,
            'previous_kitchen_status' => $previous,
            'kitchen_status' => $order->kitchen_status,
        ], 'Status dapur diperbarui.');
    }

    /**
     * GET /api/v1/operations/orders/history
     */
    public function history(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['nullable', 'date'],
            'payment_method' => ['nullable', Rule::in([Order::PAYMENT_METHOD_QRIS, Order::PAYMENT_METHOD_CASH])],
            'payment_status' => ['nullable', Rule::in([
                Order::PAYMENT_PENDING, Order::PAYMENT_PAID, Order::PAYMENT_FAILED, Order::PAYMENT_EXPIRED,
            ])],
        ]);

        $date = isset($validated['date']) ? Carbon::parse($validated['date']) : now();

        $orders = Order::query()
            ->with(['items', 'tableSession.table'])
            ->whereDate('created_at', $date->toDateString())
            ->when($validated['payment_method'] ?? null, fn ($q, $m) => $q->where('payment_method', $m))
            ->when($validated['payment_status'] ?? null, fn ($q, $s) => $q->where('payment_status', $s))
            ->orderByDesc('created_at')
            ->get();

        return ApiResponse::ok([
            'date' => $date->toDateString(),
            'summary' => [
                'orders_count' => $orders->count(),
                'paid_total' => (float) $orders->where('payment_status', Order::PAYMENT_PAID)->sum('grand_total'),
            ],
            'orders' => $orders->map($this->present(...))->values(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Order $order): array
    {
        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'source' => $order->source,
            'customer_name' => $order->customer_name,
            'table_number' => $order->tableSession?->table?->table_number,
            'session_code' => $order->tableSession?->session_code,
            'subtotal' => (float) $order->subtotal,
            'tax_amount' => (float) $order->tax_amount,
            'grand_total' => (float) $order->grand_total,
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'kitchen_status' => $order->kitchen_status,
            'paid_at' => $order->paid_at?->toIso8601String(),
            'created_at' => $order->created_at?->toIso8601String(),
            'items' => $order->items->map(fn ($item) => [
                'menu_name' => $item->menu_name_snapshot,
                'quantity' => $item->quantity,
                'unit_price' => (float) $item->unit_price_snapshot,
                'subtotal_price' => (float) $item->subtotal_price,
                'notes' => $item->notes,
            ])->values(),
        ];
    }
}
