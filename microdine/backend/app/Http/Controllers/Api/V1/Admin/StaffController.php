<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffController extends Controller
{
    public function index(): JsonResponse
    {
        $staff = User::query()
            ->whereIn('role', User::ROLES)
            ->orderBy('name')
            ->get(['id', 'name', 'username', 'role', 'is_active', 'created_at']);

        return ApiResponse::ok($staff);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:50', 'unique:users,username'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', Rule::in([User::ROLE_KASIR, User::ROLE_KITCHEN])],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $staff = User::create($validated);

        return ApiResponse::ok(
            $staff->only(['id', 'name', 'username', 'role', 'is_active']),
            'Akun staf dibuat.',
            201,
        );
    }

    public function update(Request $request, User $staff): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'username' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('users', 'username')->ignore($staff->id)],
            'password' => ['sometimes', 'required', 'string', 'min:6'],
            'role' => ['sometimes', Rule::in([User::ROLE_KASIR, User::ROLE_KITCHEN])],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $staff->update($validated);

        return ApiResponse::ok(
            $staff->refresh()->only(['id', 'name', 'username', 'role', 'is_active']),
            'Akun staf diperbarui.',
        );
    }

    public function destroy(Request $request, User $staff): JsonResponse
    {
        if ($request->user()->id === $staff->id) {
            return ApiResponse::error('Tidak bisa menghapus akun sendiri.', [], 422);
        }

        if ($staff->role === User::ROLE_ADMIN) {
            return ApiResponse::error('Akun admin tidak dihapus lewat endpoint ini.', [], 422);
        }

        $staff->tokens()->delete();
        $staff->delete();

        return ApiResponse::ok(null, 'Akun staf dihapus.');
    }
}
