<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Scheduled Jobs
|--------------------------------------------------------------------------
|
| Pesanan pending dibatalkan otomatis setelah 15 menit (Aturan Bisnis #5).
| Jalankan `php artisan schedule:work` saat development.
|
*/

Schedule::command('orders:expire')->everyMinute()->withoutOverlapping();
