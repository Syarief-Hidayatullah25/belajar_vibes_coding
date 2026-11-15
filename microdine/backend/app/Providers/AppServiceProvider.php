<?php

namespace App\Providers;

use App\Services\PaymentGateway\MockPaymentGateway;
use App\Services\PaymentGateway\PaymentGateway;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(PaymentGateway::class, function () {
            return match (config('services.payment_gateway.driver', 'mock')) {
                // Tambahkan implementasi nyata di sini saat integrasi Midtrans/Xendit.
                default => new MockPaymentGateway,
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
