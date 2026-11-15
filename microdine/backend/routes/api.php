<?php

use App\Http\Controllers\Api\V1\Admin\Analytics\DashboardController;
use App\Http\Controllers\Api\V1\Admin\Analytics\ReportController;
use App\Http\Controllers\Api\V1\Admin\Analytics\TargetController;
use App\Http\Controllers\Api\V1\Admin\CategoryController;
use App\Http\Controllers\Api\V1\Admin\MenuController;
use App\Http\Controllers\Api\V1\Admin\StaffController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\Operations\OperationOrderController;
use App\Http\Controllers\Api\V1\Operations\OperationTableController;
use App\Http\Controllers\Api\V1\Payments\CashierPaymentController;
use App\Http\Controllers\Api\V1\Payments\PaymentWebhookController;
use App\Http\Controllers\Api\V1\PublicApi\PublicMenuController;
use App\Http\Controllers\Api\V1\PublicApi\PublicOrderController;
use App\Http\Controllers\Api\V1\PublicApi\TableScanController;
use App\Http\Controllers\Api\V1\SettingsController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    /*
    |----------------------------------------------------------------------
    | Publik — tanpa login
    |----------------------------------------------------------------------
    */
    Route::get('public/tables/scan/{qr_token}', TableScanController::class);
    Route::get('public/menus', PublicMenuController::class);
    Route::post('public/orders', [PublicOrderController::class, 'store']);
    Route::get('public/orders/{order_number}', [PublicOrderController::class, 'show']);

    // Webhook payment gateway (diverifikasi lewat signature, bukan token).
    Route::post('payments/webhook/qris', PaymentWebhookController::class);

    /*
    |----------------------------------------------------------------------
    | Auth staf
    |----------------------------------------------------------------------
    */
    Route::post('auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('auth/me', [AuthController::class, 'me']);

        // Pengaturan restoran: semua staf boleh membaca, hanya admin mengubah.
        Route::get('settings', [SettingsController::class, 'show']);
        Route::put('settings', [SettingsController::class, 'update'])->middleware('role:admin');

        /*
        |------------------------------------------------------------------
        | Admin — master data, analitik, target
        |------------------------------------------------------------------
        */
        Route::prefix('admin')->middleware('role:admin')->group(function () {
            Route::apiResource('categories', CategoryController::class);
            Route::apiResource('menus', MenuController::class);
            Route::apiResource('staff', StaffController::class);

            Route::get('analytics/dashboard', DashboardController::class);
            Route::get('analytics/reports', [ReportController::class, 'index']);
            Route::get('analytics/reports/export', [ReportController::class, 'export']);
            Route::get('analytics/targets', [TargetController::class, 'index']);
            Route::post('analytics/targets', [TargetController::class, 'store']);
        });

        /*
        |------------------------------------------------------------------
        | Operasional — kasir & kitchen
        |------------------------------------------------------------------
        */
        Route::prefix('operations')->group(function () {
            Route::get('tables', [OperationTableController::class, 'index']);
            Route::post('tables/{table}/close', [OperationTableController::class, 'close'])
                ->middleware('role:admin,kasir');

            Route::post('orders/manual', [OperationOrderController::class, 'manual'])
                ->middleware('role:admin,kasir');

            Route::get('orders/queue', [OperationOrderController::class, 'queue']);
            Route::patch('orders/{order}/kitchen-status', [OperationOrderController::class, 'updateKitchenStatus']);
            Route::get('orders/history', [OperationOrderController::class, 'history'])
                ->middleware('role:admin,kasir');
        });

        // Konfirmasi pembayaran tunai oleh kasir.
        Route::post('cashier/orders/{order}/confirm-cash', [CashierPaymentController::class, 'confirm'])
            ->middleware('role:admin,kasir');
    });
});
