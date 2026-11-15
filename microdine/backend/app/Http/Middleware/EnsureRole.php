<?php

namespace App\Http\Middleware;

use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * RBAC sederhana berdasarkan kolom users.role.
 *
 * Pemakaian: ->middleware('role:admin,kasir')
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if ($user === null) {
            return ApiResponse::error('Unauthenticated.', [], 401);
        }

        if (! $user->is_active) {
            return ApiResponse::error('Akun tidak aktif.', [], 403);
        }

        if ($roles !== [] && ! in_array($user->role, $roles, true)) {
            return ApiResponse::error(
                'Anda tidak memiliki akses ke resource ini.',
                ['role' => ['Dibutuhkan salah satu role: '.implode(', ', $roles)]],
                403,
            );
        }

        return $next($request);
    }
}
