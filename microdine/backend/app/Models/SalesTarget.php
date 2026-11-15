<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalesTarget extends Model
{
    protected $fillable = [
        'month_year',
        'monthly_target_amount',
    ];

    protected function casts(): array
    {
        return [
            'monthly_target_amount' => 'decimal:2',
        ];
    }
}
