<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Menu;
use App\Models\RestaurantSetting;
use App\Models\SalesTarget;
use App\Models\User;
use App\Models\DiningTable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        RestaurantSetting::current();

        $this->seedUsers();
        $this->seedTables();
        $this->seedMenus();
        $this->seedTarget();
    }

    private function seedUsers(): void
    {
        $users = [
            ['name' => 'Admin MICRODINE', 'username' => 'admin', 'role' => User::ROLE_ADMIN, 'password' => 'password'],
            ['name' => 'Kasir Satu', 'username' => 'kasir', 'role' => User::ROLE_KASIR, 'password' => 'password'],
            ['name' => 'Dapur Satu', 'username' => 'kitchen', 'role' => User::ROLE_KITCHEN, 'password' => 'password'],
        ];

        foreach ($users as $user) {
            User::query()->updateOrCreate(
                ['username' => $user['username']],
                $user + ['is_active' => true],
            );
        }
    }

    private function seedTables(): void
    {
        $areas = ['Dalam' => 4, 'Teras' => 3, 'Lantai 2' => 3];
        $number = 1;

        foreach ($areas as $area => $count) {
            for ($i = 0; $i < $count; $i++) {
                $tableNumber = str_pad((string) $number, 2, '0', STR_PAD_LEFT);

                DiningTable::query()->updateOrCreate(
                    ['table_number' => $tableNumber],
                    [
                        'area' => $area,
                        'capacity' => $area === 'Dalam' ? 2 : 4,
                        'qr_token' => 'QR-'.$tableNumber.'-'.Str::lower(Str::random(10)),
                        'barcode_code' => 'TBL-'.$tableNumber,
                        'status' => DiningTable::STATUS_AVAILABLE,
                    ],
                );

                $number++;
            }
        }
    }

    private function seedMenus(): void
    {
        $catalog = [
            ['name' => 'Makanan Utama', 'sort_order' => 1, 'menus' => [
                ['name' => 'Nasi Goreng Spesial', 'hpp' => 12000, 'selling_price' => 25000, 'description' => 'Nasi goreng dengan telur, ayam, dan kerupuk.'],
                ['name' => 'Ayam Bakar Madu', 'hpp' => 18000, 'selling_price' => 35000, 'description' => 'Ayam kampung dibakar dengan saus madu.'],
                ['name' => 'Mie Goreng Jawa', 'hpp' => 10000, 'selling_price' => 22000, 'description' => 'Mie goreng bumbu jawa dengan sayuran.'],
            ]],
            ['name' => 'Minuman', 'sort_order' => 2, 'menus' => [
                ['name' => 'Es Teh Manis', 'hpp' => 2000, 'selling_price' => 8000, 'description' => 'Teh manis dingin segar.'],
                ['name' => 'Es Jeruk', 'hpp' => 3500, 'selling_price' => 10000, 'description' => 'Perasan jeruk segar dengan es.'],
                ['name' => 'Kopi Susu', 'hpp' => 6000, 'selling_price' => 18000, 'description' => 'Espresso dengan susu segar.'],
            ]],
            ['name' => 'Camilan', 'sort_order' => 3, 'menus' => [
                ['name' => 'Kentang Goreng', 'hpp' => 7000, 'selling_price' => 15000, 'description' => 'Kentang goreng renyah dengan saus.'],
                ['name' => 'Pisang Goreng Keju', 'hpp' => 6000, 'selling_price' => 14000, 'description' => 'Pisang goreng topping keju parut.'],
            ]],
        ];

        foreach ($catalog as $group) {
            /** @var Category $category */
            $category = Category::query()->updateOrCreate(
                ['name' => $group['name']],
                ['sort_order' => $group['sort_order']],
            );

            foreach ($group['menus'] as $menu) {
                Menu::query()->updateOrCreate(
                    ['name' => $menu['name']],
                    $menu + ['category_id' => $category->id, 'is_available' => true],
                );
            }
        }
    }

    private function seedTarget(): void
    {
        SalesTarget::query()->updateOrCreate(
            ['month_year' => now()->format('Y-m')],
            ['monthly_target_amount' => 15000000],
        );
    }
}
