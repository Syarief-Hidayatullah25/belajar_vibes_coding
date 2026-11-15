<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Semua agregasi keuangan di sini WAJIB hanya membaca order berstatus paid.
 * PENDING, EXPIRED, dan FAILED tidak boleh masuk hitungan apa pun.
 */
class AnalyticsService
{
    /**
     * @return Builder<Order>
     */
    public function paidOrders(?Carbon $from = null, ?Carbon $to = null): Builder
    {
        return Order::query()
            ->where('payment_status', Order::PAYMENT_PAID)
            ->when($from !== null, fn ($q) => $q->where('paid_at', '>=', $from->copy()->startOfDay()))
            ->when($to !== null, fn ($q) => $q->where('paid_at', '<=', $to->copy()->endOfDay()));
    }

    /**
     * @return array<string, float|int>
     */
    public function summary(?Carbon $from = null, ?Carbon $to = null): array
    {
        $orders = $this->paidOrders($from, $to)->get(['id', 'subtotal', 'tax_amount', 'grand_total']);

        $orderIds = $orders->pluck('id');

        $grossSales = (float) $orders->sum('subtotal');
        $taxTotal = (float) $orders->sum('tax_amount');
        $omzet = (float) $orders->sum('grand_total');

        $hppTotal = (float) OrderItem::query()->whereIn('order_id', $orderIds)->sum('subtotal_hpp');
        $netProfit = round($grossSales - $hppTotal, 2);

        return [
            'orders_count' => $orders->count(),
            'gross_sales' => round($grossSales, 2),
            'tax_total' => round($taxTotal, 2),
            'omzet' => round($omzet, 2),
            'hpp_total' => round($hppTotal, 2),
            'net_profit' => $netProfit,
            'margin_percent' => $grossSales > 0 ? round($netProfit / $grossSales * 100, 2) : 0.0,
        ];
    }

    /**
     * Tren harian N hari terakhir (termasuk hari ini).
     *
     * @return array<int, array<string, mixed>>
     */
    public function dailyTrend(int $days = 14): array
    {
        $start = now()->subDays($days - 1)->startOfDay();

        $orders = $this->paidOrders($start, now())
            ->get(['id', 'subtotal', 'grand_total', 'paid_at']);

        $hppByOrder = OrderItem::query()
            ->whereIn('order_id', $orders->pluck('id'))
            ->selectRaw('order_id, sum(subtotal_hpp) as hpp')
            ->groupBy('order_id')
            ->pluck('hpp', 'order_id');

        $byDate = $orders->groupBy(fn (Order $order) => $order->paid_at?->toDateString());

        $trend = [];
        for ($i = 0; $i < $days; $i++) {
            $date = $start->copy()->addDays($i)->toDateString();
            $dayOrders = $byDate->get($date, collect());

            $gross = (float) $dayOrders->sum('subtotal');
            $hpp = (float) $dayOrders->sum(fn (Order $order) => (float) ($hppByOrder[$order->id] ?? 0));

            $trend[] = [
                'date' => $date,
                'orders_count' => $dayOrders->count(),
                'omzet' => round((float) $dayOrders->sum('grand_total'), 2),
                'hpp' => round($hpp, 2),
                'net_profit' => round($gross - $hpp, 2),
            ];
        }

        return $trend;
    }

    /**
     * @return array<string, array<string, float|int>>
     */
    public function paymentSplit(?Carbon $from = null, ?Carbon $to = null): array
    {
        $rows = $this->paidOrders($from, $to)
            ->selectRaw('payment_method, count(*) as orders_count, sum(grand_total) as total')
            ->groupBy('payment_method')
            ->get();

        $grand = (float) $rows->sum('total');

        return $rows->mapWithKeys(fn ($row) => [
            $row->payment_method => [
                'orders_count' => (int) $row->orders_count,
                'total' => round((float) $row->total, 2),
                'percentage' => $grand > 0 ? round((float) $row->total / $grand * 100, 2) : 0.0,
            ],
        ])->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function topMenus(int $limit = 5, ?Carbon $from = null, ?Carbon $to = null): array
    {
        $orderIds = $this->paidOrders($from, $to)->select('id');

        return OrderItem::query()
            ->whereIn('order_id', $orderIds)
            ->select('menu_name_snapshot', DB::raw('sum(quantity) as qty'), DB::raw('sum(subtotal_price) as revenue'))
            ->groupBy('menu_name_snapshot')
            ->orderByDesc('qty')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => [
                'menu_name' => $row->menu_name_snapshot,
                'quantity_sold' => (int) $row->qty,
                'revenue' => round((float) $row->revenue, 2),
            ])->all();
    }
}
