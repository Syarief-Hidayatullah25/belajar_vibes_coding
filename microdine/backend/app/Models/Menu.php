<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Menu extends Model
{
    protected $fillable = [
        'category_id',
        'name',
        'description',
        'image_url',
        'hpp',
        'selling_price',
        'is_available',
    ];

    protected function casts(): array
    {
        return [
            'hpp' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'is_available' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}
