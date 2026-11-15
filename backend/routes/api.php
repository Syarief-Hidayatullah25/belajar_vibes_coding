<?php

use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\ItemController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Semua route di sini otomatis mendapat prefix "/api".
| Kontrak response mengikuti bentuk:
|   { "success": bool, "data": ..., "message": string }
|
*/

Route::get('/health', HealthController::class)->name('api.health');

Route::apiResource('items', ItemController::class);
