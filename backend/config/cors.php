<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS)
    |--------------------------------------------------------------------------
    |
    | Frontend (Vite dev server) dan Backend (Laravel) berjalan di origin yang
    | berbeda, sehingga Backend harus mengizinkan origin Frontend secara
    | eksplisit. Origin diambil dari FRONTEND_URL agar tidak di-hardcode.
    |
    */

    'paths' => ['api/*', 'up'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter([
        env('FRONTEND_URL', 'http://localhost:5173'),
        // Varian loopback: sebagian browser membuka dev server lewat 127.0.0.1.
        'http://127.0.0.1:5173',
    ])),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
