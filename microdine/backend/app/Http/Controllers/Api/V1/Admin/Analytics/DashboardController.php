<?php

namespace App\Http\Controllers\Api\V1\Admin\Analytics;

use App\Http\Controllers\Controller;
use App\Services\AnalyticsService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    public function __construct(private readonly AnalyticsService $analytics) {}

    /**
     * GET /api/v1/admin/analytics/dashboard
     *
     * Default: bulan berjalan. Bisa dipersempit dengan ?from=&to=.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = isset($validated['from'])
            ? Carbon::parse($validated['from'])
            : now()->startOfMonth();

        $to = isset($validated['to']) ? Carbon::parse($validated['to']) : now();

        return ApiResponse::ok([
            'period' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
            'summary' => $this->analytics->summary($from, $to),
            'trend_14_days' => $this->analytics->dailyTrend(14),
            'payment_split' => $this->analytics->paymentSplit($from, $to),
            'top_menus' => $this->analytics->topMenus(5, $from, $to),
        ]);
    }
}
