<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tables', function (Blueprint $table) {
            $table->id();
            $table->string('table_number', 10)->unique();
            $table->string('area')->default('Dalam');
            $table->unsignedSmallInteger('capacity')->default(2);
            $table->string('qr_token', 64)->unique();
            $table->string('barcode_code', 64)->unique();
            $table->string('status', 20)->default('available');
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tables');
    }
};
