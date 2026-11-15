<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DiningTable extends Model
{
    protected $table = 'tables';

    public const STATUS_AVAILABLE = 'available';

    public const STATUS_OCCUPIED = 'occupied';

    protected $fillable = [
        'table_number',
        'area',
        'capacity',
        'qr_token',
        'barcode_code',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
        ];
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(TableSession::class, 'table_id');
    }

    public function activeSession(): ?TableSession
    {
        return $this->sessions()->where('status', TableSession::STATUS_ACTIVE)->latest('id')->first();
    }
}
