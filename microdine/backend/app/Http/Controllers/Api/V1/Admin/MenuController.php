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
     * POST /api/v1/admin/menus/{menu}/image
     *
     * Upload gambar menu. Disimpan di public/uploads/menus agar tidak perlu
     * symlink storage (mudah untuk dev di Windows).
     */
    public function uploadImage(Request $request, Menu $menu): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $file = $request->file('image');
        $filename = sprintf('menu-%d-%s.%s', $menu->id, bin2hex(random_bytes(4)), $file->getClientOriginalExtension());

        $directory = public_path('uploads/menus');
        if (! is_dir($directory)) {
            mkdir($directory, 0775, true);
        }

        file_put_contents($directory.DIRECTORY_SEPARATOR.$filename, $file->getContent());

        $menu->update(['image_url' => '/uploads/menus/'.$filename]);

        return ApiResponse::ok([
            'id' => $menu->id,
            'image_url' => $menu->image_url,
            'public_url' => url($menu->image_url),
        ], 'Gambar menu diunggah.');
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
