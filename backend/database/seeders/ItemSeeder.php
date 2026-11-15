<?php

namespace Database\Seeders;

use App\Models\Item;
use Illuminate\Database\Seeder;

class ItemSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            ['name' => 'Setup monorepo', 'description' => 'Frontend dan backend terpisah', 'is_done' => true],
            ['name' => 'Koneksi PostgreSQL', 'description' => 'Migrasi berhasil dijalankan', 'is_done' => true],
            ['name' => 'Integrasi REST API', 'description' => 'React memanggil Laravel', 'is_done' => false],
        ];

        foreach ($items as $item) {
            Item::query()->firstOrCreate(['name' => $item['name']], $item);
        }
    }
}
