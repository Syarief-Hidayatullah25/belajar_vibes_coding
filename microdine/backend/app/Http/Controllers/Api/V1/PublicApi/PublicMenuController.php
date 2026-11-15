<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\RestaurantSetting;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class PublicMenuController extends Controller
{
    /**
     * GET /api/v1/public/menus
     *
     * Hanya menu yang tersedia, dikelompokkan per kategori, plus konfigurasi pajak
     * agar frontend bisa menampilkan rincian biaya secara dinamis.
     */
    public function __invoke(): JsonResponse
    {
        $categories = Category::query()
            ->with(['menus' => fn ($q) => $q->where('is_available', true)->orderBy('name')])
            ->orderBy('sort_order')
            ->get();

        $settings = RestaurantSetting::current();

        return ApiResponse::ok([
            'restaurant' => [
                'name' => $settings->restaurant_name,
                'tax' => [
                    'name' => $settings->tax_name,
                    'percentage' => (float) $settings->tax_percentage,
                    'is_active' => $settings->is_tax_active,
                ],
            ],
            'categories' => $categories->map(fn (Category $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'menus' => $category->menus->map(fn ($menu) => [
                    'id' => $menu->id,
                    'name' => $menu->name,
                    'description' => $menu->description,
                    'image_url' => $menu->image_url,
                    'selling_price' => (float) $menu->selling_price,
                ])->values(),
            ])->values(),
        ]);
    }
}
