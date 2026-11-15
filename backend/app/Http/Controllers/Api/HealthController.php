<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    /**
     * Endpoint penanda bahwa API hidup dan siap dihubungi Frontend.
     */
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'status' => 'ok',
                'service' => 'laravel-api',
                'time' => now()->toIso8601String(),
            ],
            'message' => 'API is healthy.',
        ]);
    }
}
