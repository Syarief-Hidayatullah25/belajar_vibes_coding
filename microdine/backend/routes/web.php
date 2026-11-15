<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Backend ini API-only: tidak ada halaman yang dirender. Root hanya memberi
| petunjuk singkat ke endpoint API dan aplikasi Frontend.
|
*/

Route::get('/', function () {
    return response()->json([
        'success' => true,
        'data' => [
            'service' => 'MICRODINE API',
            'health' => url('/api/v1/public/menus'),
            'frontend' => env('FRONTEND_URL', 'http://localhost:5173'),
        ],
        'message' => 'Backend berjalan dalam mode API-only. Gunakan endpoint /api/v1/*.',
    ]);
});
