<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Services\TableSessionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class TableScanController extends Controller
{
    public function __construct(private readonly TableSessionService $sessions) {}

    /**
     * GET /api/v1/public/tables/scan/{qr_token}
     *
     * Membuat sesi baru bila meja kosong, atau mengembalikan sesi aktif bila
     * meja sudah terisi (shared table session).
     */
    public function __invoke(string $qrToken): JsonResponse
    {
        $result = $this->sessions->scan($qrToken);
        $session = $result['session'];
        $table = $result['table'];

        return ApiResponse::ok([
            'table' => [
                'id' => $table->id,
                'table_number' => $table->table_number,
                'area' => $table->area,
                'capacity' => $table->capacity,
                'status' => $table->status,
            ],
            'session' => [
                'id' => $session->id,
                'session_code' => $session->session_code,
                'status' => $session->status,
                'opened_at' => $session->opened_at?->toIso8601String(),
            ],
            'session_created' => $result['created'],
            'messages' => $result['created']
                ? 'Sesi meja baru dibuka.'
                : 'Meja sedang terisi, Anda bergabung ke sesi yang sedang berjalan.',
        ]);
    }
}
