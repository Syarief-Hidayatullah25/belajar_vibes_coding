<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = Category::query()
            ->withCount('menus')
            ->orderBy('sort_order')
            ->get();

        return ApiResponse::ok($categories);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:categories,name'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $category = Category::create($validated);

        return ApiResponse::ok($category, 'Kategori dibuat.', 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:100', 'unique:categories,name,'.$category->id],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $category->update($validated);

        return ApiResponse::ok($category->refresh(), 'Kategori diperbarui.');
    }

    public function destroy(Category $category): JsonResponse
    {
        if ($category->menus()->exists()) {
            return ApiResponse::error('Kategori masih memiliki menu, pindahkan atau hapus menunya dulu.', [], 422);
        }

        $category->delete();

        return ApiResponse::ok(null, 'Kategori dihapus.');
    }
}
