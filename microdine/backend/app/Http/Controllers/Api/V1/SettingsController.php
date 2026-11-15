<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\RestaurantSetting;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return ApiResponse::ok(RestaurantSetting::current());
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'restaurant_name' => ['sometimes', 'required', 'string', 'max:255'],
            'tax_name' => ['sometimes', 'required', 'string', 'max:50'],
            'tax_percentage' => ['sometimes', 'required', 'numeric', 'min:0', 'max:100'],
            'is_tax_active' => ['sometimes', 'boolean'],
        ]);

        $settings = RestaurantSetting::current();
        $settings->update($validated);

        return ApiResponse::ok($settings->refresh(), 'Pengaturan diperbarui.');
    }
}
