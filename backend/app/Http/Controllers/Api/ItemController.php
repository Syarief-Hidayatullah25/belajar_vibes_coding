<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ItemController extends Controller
{
    public function index(): JsonResponse
    {
        $items = Item::query()->latest()->get();

        return response()->json([
            'success' => true,
            'data' => $items,
            'message' => 'Items retrieved.',
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'is_done' => ['sometimes', 'boolean'],
        ]);

        $item = Item::create($validated);

        return response()->json([
            'success' => true,
            'data' => $item,
            'message' => 'Item created.',
        ], 201);
    }

    public function show(Item $item): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $item,
            'message' => 'Item retrieved.',
        ]);
    }

    public function update(Request $request, Item $item): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'is_done' => ['sometimes', 'boolean'],
        ]);

        $item->update($validated);

        return response()->json([
            'success' => true,
            'data' => $item,
            'message' => 'Item updated.',
        ]);
    }

    public function destroy(Item $item): JsonResponse
    {
        $item->delete();

        return response()->json([
            'success' => true,
            'data' => null,
            'message' => 'Item deleted.',
        ]);
    }
}
