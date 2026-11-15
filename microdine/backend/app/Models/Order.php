<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    public const SOURCE_QR = 'qr_customer';

    public const SOURCE_POS = 'pos_cashier';

    public const PAYMENT_METHOD_QRIS = 'qris';

    public const PAYMENT_METHOD_CASH = 'cash';

    public const PAYMENT_PENDING = 'pending';

    public const PAYMENT_PAID = 'paid';

    public const PAYMENT_FAILED = 'failed';

    public const PAYMENT_EXPIRED = 'expired';

    public const KITCHEN_WAITING = 'waiting';

    public const KITCHEN_COOKING = 'cooking';

    public const KITCHEN_READY = 'ready';

    public const KITCHEN_SERVED = 'served';

    /** Transisi status dapur yang diizinkan. */
    public const KITCHEN_TRANSITIONS = [
        self::KITCHEN_WAITING => [self::KITCHEN_COOKING],
        self::KITCHEN_COOKING => [self::KITCHEN_READY],
        self::KITCHEN_READY => [self::KITCHEN_SERVED],
        self::KITCHEN_SERVED => [],
    ];

    protected $fillable = [
        'order_number',
        'table_session_id',
        'source',
        'customer_name',
        'subtotal',
        'tax_amount',
        'grand_total',
        'payment_method',
        'payment_status',
        'kitchen_status',
        'gateway_ref_id',
        'qris_payload',
        'paid_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'paid_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function tableSession(): BelongsTo
    {
        return $this->belongsTo(TableSession::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function statusLogs(): HasMany
    {
        return $this->hasMany(OrderStatusLog::class);
    }

    public function isPaid(): bool
    {
        return $this->payment_status === self::PAYMENT_PAID;
    }

    public function logStatus(string $type, string $value, ?string $notes = null): void
    {
        $this->statusLogs()->create([
            'status_type' => $type,
            'status_value' => $value,
            'notes' => $notes,
            'created_at' => now(),
        ]);
    }
}
