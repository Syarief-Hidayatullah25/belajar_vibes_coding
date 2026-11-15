<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RestaurantSetting extends Model
{
    protected $table = 'restaurant_settings';

    protected $fillable = [
        'restaurant_name',
        'tax_name',
        'tax_percentage',
        'is_tax_active',
    ];

    protected function casts(): array
    {
        return [
            'tax_percentage' => 'decimal:2',
            'is_tax_active' => 'boolean',
        ];
    }

    /**
     * Aplikasi hanya memakai satu baris konfigurasi restoran.
     */
    public static function current(): self
    {
        return static::query()->firstOrCreate([], [
            'restaurant_name' => 'MICRODINE',
            'tax_name' => 'PB1',
            'tax_percentage' => 10.00,
            'is_tax_active' => true,
        ]);
    }
}
