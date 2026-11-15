<?php

namespace App\Http\Controllers\Api\V1\Admin\Analytics;

use App\Http\Controllers\Controller;
use App\Models\SalesTarget;
use App\Services\AnalyticsService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class TargetController extends Controller
{
    public function __construct(private readonly AnalyticsService $analytics) {}

    /**
     * GET /api/v1/admin/analytics/targets?month=2026-11
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
        ]);

        $month = $validated['month'] ?? now()->format('Y-m');

        return ApiResponse::ok($this->report($month));
    }

    /**
     * POST /api/v1/admin/analytics/targets
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'month_year' => ['required', 'date_format:Y-m'],
            'monthly_target_amount' => ['required', 'numeric', 'min:0'],
        ]);

        $target = SalesTarget::query()->updateOrCreate(
            ['month_year' => $validated['month_year']],
            ['monthly_target_amount' => $validated['monthly_target_amount']],
        );

        return ApiResponse::ok($this->report($target->month_year), 'Target penjualan disimpan.');
    }

    /**
     * @return array<string, mixed>
     */
    private function report(string $month): array
    {
        $start = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
        $end = $start->copy()->endOfMonth();
        $today = now();

        $summary = $this->analytics->summary($start, $end->copy()->min($today));

        $target = SalesTarget::query()->where('month_year', $month)->first();
        $targetAmount = (float) ($target?->monthly_target_amount ?? 0.0);

        $realization = (float) $summary['omzet'];
        $remaining = max(0.0, round($targetAmount - $realization, 2));

        // Proyeksi berbasis rata-rata omzet harian yang sudah berjalan.
        $elapsedDays = max(1, (int) $start->diffInDays($today->copy()->min($end)) + 1);
        $dailyAverage = $realization / $elapsedDays;
        $projected = round($dailyAverage * (int) $start->daysInMonth, 2);

        $remainingDays = max(0, (int) $today->copy()->min($end)->diffInDays($end) + ($today->lte($end) ? 1 : 0));

        return [
            'month_year' => $month,
            'target_amount' => $targetAmount,
            'realization' => round($realization, 2),
            'remaining_amount' => $remaining,
            'achievement_percent' => $targetAmount > 0 ? round($realization / $targetAmount * 100, 2) : 0.0,
            'progress' => [
                'elapsed_days' => $elapsedDays,
                'days_in_month' => (int) $start->daysInMonth,
                'remaining_days' => $remainingDays,
                'daily_average' => round($dailyAverage, 2),
                'projected_month_end' => $projected,
                'on_track' => $targetAmount > 0 && $projected >= $targetAmount,
                'required_daily_omzet' => $remainingDays > 0 ? round($remaining / $remainingDays, 2) : $remaining,
            ],
            'summary' => $summary,
        ];
    }
}
