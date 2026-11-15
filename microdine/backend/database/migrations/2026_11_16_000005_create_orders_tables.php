<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number', 20)->unique();
            $table->foreignId('table_session_id')->constrained('table_sessions')->cascadeOnDelete();
            $table->string('source', 20)->default('qr_customer');
            $table->string('customer_name')->nullable();
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('tax_amount', 14, 2)->default(0);
            $table->decimal('grand_total', 14, 2)->default(0);
            $table->string('payment_method', 20);
            $table->string('payment_status', 20)->default('pending');
            $table->string('kitchen_status', 20)->default('waiting');
            $table->string('gateway_ref_id')->nullable()->index();
            $table->text('qris_payload')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['payment_status', 'created_at']);
            $table->index(['kitchen_status', 'payment_status']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('menu_id')->nullable()->constrained('menus')->nullOnDelete();
            $table->string('menu_name_snapshot');
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price_snapshot', 14, 2);
            $table->decimal('unit_hpp_snapshot', 14, 2);
            $table->decimal('subtotal_price', 14, 2);
            $table->decimal('subtotal_hpp', 14, 2);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('order_status_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('status_type', 20);
            $table->string('status_value', 30);
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['order_id', 'status_type']);
        });

        Schema::create('sales_targets', function (Blueprint $table) {
            $table->id();
            $table->string('month_year', 7)->unique();
            $table->decimal('monthly_target_amount', 16, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_targets');
        Schema::dropIfExists('order_status_logs');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
