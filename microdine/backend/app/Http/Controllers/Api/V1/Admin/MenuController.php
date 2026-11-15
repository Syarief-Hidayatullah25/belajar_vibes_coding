<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Menu;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $menus = Menu::query()
            ->with('category:id,name')
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', $request->integer('category_id')))
            ->when($request->filled('search'), fn ($q) => $q->where('name', 'ilike', '%'.$request->string('search').'%'))
            ->orderBy('name')
            ->get();

        return ApiResponse::ok($menus);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatedPayload($request);

        $menu = Menu::create($validated);

        return ApiResponse::ok($menu->load('category:id,name'), 'Menu dibuat.', 201);
    }

    public function update(Request $request, Menu $menu): JsonResponse
    {
        $validated = $this->validatedPayload($request, partial: true);

        $menu->update($validated);

        return ApiResponse::ok($menu->refresh()->load('category:id,name'), 'Menu diperbarui.');
    }

    public function destroy(Menu $menu): JsonResponse
    {
        $menu->delete();

        return ApiResponse::ok(null, 'Menu dihapus.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedPayload(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'category_id' => [$required, 'integer', 'exists:categories,id'],
            'name' => [$required, 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'image_url' => ['nullable', 'string', 'max:2048'],
            'hpp' => [$required, 'numeric', 'min:0'],
            'selling_price' => [$required, 'numeric', 'min:0', 'gte:hpp'],
            'is_available' => ['sometimes', 'boolean'],
        ]);
    }
}
