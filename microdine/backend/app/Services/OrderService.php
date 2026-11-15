<?php

namespace App\Services;

use App\Models\Menu;
use App\Models\Order;
use App\Models\RestaurantSetting;
use App\Models\TableSession;
use App\Services\PaymentGateway\PaymentGateway;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(private readonly PaymentGateway $gateway) {}

    /**
     * Buat pesanan: snapshot harga & HPP, hitung pajak, set expiry 15 menit.
     *
     * @param  array<int, array{menu_id: int, quantity: int, notes?: string|null}>  $items
     */
    public function create(
        TableSession $session,
        array $items,
        string $paymentMethod,
        ?string $customerName = null,
        string $source = Order::SOURCE_QR,
    ): Order {
        return DB::transaction(function () use ($session, $items, $paymentMethod, $customerName, $source) {
            $settings = RestaurantSetting::current();

            $menuIds = collect($items)->pluck('menu_id')->all();
            $menus = Menu::query()->whereIn('id', $menuIds)->get()->keyBy('id');

            $subtotal = 0.0;
            $lines = [];

            foreach ($items as $line) {
                /** @var Menu|null $menu */
                $menu = $menus->get($line['menu_id']);

                if ($menu === null) {
                    throw ValidationException::withMessages([
                        'items' => ["Menu id {$line['menu_id']} tidak ditemukan."],
                    ]);
                }

                if (! $menu->is_available) {
                    throw ValidationException::withMessages([
                        'items' => ["Menu \"{$menu->name}\" sedang tidak tersedia."],
                    ]);
                }

                $quantity = (int) $line['quantity'];

                // Snapshot: nilai saat ini disalin permanen ke baris transaksi.
                $unitPrice = (float) $menu->selling_price;
                $unitHpp = (float) $menu->hpp;
                $subtotalPrice = round($unitPrice * $quantity, 2);
                $subtotalHpp = round($unitHpp * $quantity, 2);

                $subtotal += $subtotalPrice;

                $lines[] = [
                    'menu_id' => $menu->id,
                    'menu_name_snapshot' => $menu->name,
                    'quantity' => $quantity,
                    'unit_price_snapshot' => $unitPrice,
                    'unit_hpp_snapshot' => $unitHpp,
                    'subtotal_price' => $subtotalPrice,
                    'subtotal_hpp' => $subtotalHpp,
                    'notes' => $line['notes'] ?? null,
                ];
            }

            $subtotal = round($subtotal, 2);
            $taxAmount = $settings->is_tax_active
                ? round($subtotal * ((float) $settings->tax_percentage / 100), 2)
                : 0.0;

            $expiryMinutes = (int) config('services.payment_gateway.order_expiry_minutes', 15);

            $order = Order::create([
                'order_number' => $this->nextOrderNumber(),
                'table_session_id' => $session->id,
                'source' => $source,
                'customer_name' => $customerName,
                'subtotal' => $subtotal,
                'tax_amount' => $taxAmount,
                'grand_total' => round($subtotal + $taxAmount, 2),
                'payment_method' => $paymentMethod,
                'payment_status' => Order::PAYMENT_PENDING,
                'kitchen_status' => Order::KITCHEN_WAITING,
                'expires_at' => now()->addMinutes($expiryMinutes),
            ]);

            $order->items()->createMany($lines);

            $order->logStatus('payment', Order::PAYMENT_PENDING, 'Pesanan dibuat, menunggu pembayaran.');
            $order->logStatus('kitchen', Order::KITCHEN_WAITING, 'Menunggu pembayaran.');

            if ($paymentMethod === Order::PAYMENT_METHOD_QRIS) {
                $qris = $this->gateway->createQris($order);
                $order->update([
                    'gateway_ref_id' => $qris['ref_id'],
                    'qris_payload' => $qris['payload'],
                ]);
            }

            return $order->load('items', 'tableSession.table');
        });
    }

    /**
     * Nomor pesanan harian berpola A-024.
     */
    private function nextOrderNumber(): string
    {
        $todayCount = Order::query()->whereDate('created_at', now()->toDateString())->count();

        return sprintf('A-%03d', $todayCount + 1);
    }
}
