<?php

namespace App\Http\Controllers\Api\V1\Admin\Analytics;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /**
     * GET /api/v1/admin/analytics/reports
     *
     * Audit transaksi lengkap dengan HPP dan laba per transaksi.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $this->filters($request);
        $orders = $this->query($filters);

        $rows = $orders->map(fn (Order $order) => $this->row($order));

        return ApiResponse::ok([
            'filters' => $filters,
            'totals' => [
                'transactions' => $orders->count(),
                'omzet' => round((float) $orders->sum('grand_total'), 2),
                'hpp' => round((float) $orders->sum('total_hpp'), 2),
                'net_profit' => round((float) $orders->sum('gross_sales') - (float) $orders->sum('total_hpp'), 2),
            ],
            'transactions' => $rows->values(),
        ]);
    }

    /**
     * GET /api/v1/admin/analytics/reports/export
     *
     * Ekspor CSV (bisa dibuka Excel).
     */
    public function export(Request $request): StreamedResponse
    {
        $filters = $this->filters($request);
        $orders = $this->query($filters);

        $filename = sprintf('microdine-report-%s-%s.csv', $filters['from'], $filters['to']);

        return response()->streamDownload(function () use ($orders) {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'order_number', 'created_at', 'paid_at', 'table', 'session_code', 'source',
                'customer_name', 'payment_method', 'payment_status', 'gross_sales',
                'tax_amount', 'grand_total', 'hpp', 'net_profit',
            ]);

            foreach ($orders as $order) {
                $row = $this->row($order);

                fputcsv($handle, [
                    $row['order_number'],
                    $row['created_at'],
                    $row['paid_at'],
                    $row['table_number'],
                    $row['session_code'],
                    $row['source'],
                    $row['customer_name'],
                    $row['payment_method'],
                    $row['payment_status'],
                    $row['gross_sales'],
                    $row['tax_amount'],
                    $row['grand_total'],
                    $row['hpp'],
                    $row['net_profit'],
                ]);
            }

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @return array{from: string, to: string, payment_method: ?string, payment_status: ?string}
     */
    private function filters(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'payment_method' => ['nullable', Rule::in([Order::PAYMENT_METHOD_QRIS, Order::PAYMENT_METHOD_CASH])],
            'payment_status' => ['nullable', Rule::in([
                Order::PAYMENT_PENDING, Order::PAYMENT_PAID, Order::PAYMENT_FAILED, Order::PAYMENT_EXPIRED,
            ])],
        ]);

        return [
            'from' => isset($validated['from']) ? Carbon::parse($validated['from'])->toDateString() : now()->startOfMonth()->toDateString(),
            'to' => isset($validated['to']) ? Carbon::parse($validated['to'])->toDateString() : now()->toDateString(),
            'payment_method' => $validated['payment_method'] ?? null,
            'payment_status' => $validated['payment_status'] ?? null,
        ];
    }

    /**
     * @param  array{from: string, to: string, payment_method: ?string, payment_status: ?string}  $filters
     * @return \Illuminate\Support\Collection<int, Order&object{total_hpp: float, gross_sales: float}>
     */
    private function query(array $filters)
    {
        $orders = Order::query()
            ->with(['items:id,order_id,subtotal_price,subtotal_hpp', 'tableSession.table:id,table_number'])
            ->whereDate('created_at', '>=', $filters['from'])
            ->whereDate('created_at', '<=', $filters['to'])
            ->when($filters['payment_method'], fn ($q, $m) => $q->where('payment_method', $m))
            ->when($filters['payment_status'], fn ($q, $s) => $q->where('payment_status', $s))
            ->orderBy('created_at')
            ->get();

        // HPP diambil dari snapshot order_items, bukan harga menu saat ini.
        return $orders->each(function (Order $order) {
            $order->total_hpp = (float) $order->items->sum('subtotal_hpp');
            $order->gross_sales = (float) $order->subtotal;
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function row(Order $order): array
    {
        $hpp = (float) ($order->total_hpp ?? $order->items->sum('subtotal_hpp'));
        $gross = (float) ($order->gross_sales ?? $order->subtotal);

        return [
            'order_number' => $order->order_number,
            'created_at' => $order->created_at?->toIso8601String(),
            'paid_at' => $order->paid_at?->toIso8601String(),
            'table_number' => $order->tableSession?->table?->table_number,
            'session_code' => $order->tableSession?->session_code,
            'source' => $order->source,
            'customer_name' => $order->customer_name,
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'gross_sales' => round($gross, 2),
            'tax_amount' => (float) $order->tax_amount,
            'grand_total' => (float) $order->grand_total,
            'hpp' => round($hpp, 2),
            'net_profit' => round($gross - $hpp, 2),
        ];
    }
}
