<?php

/**
 * Smoke test end-to-end backend MICRODINE.
 *
 * Menjalankan skenario nyata lewat HTTP terhadap server yang sedang hidup,
 * termasuk pengujian 5 aturan bisnis inti.
 *
 * Pakai:
 *   php scripts/smoke-test.php            (default http://127.0.0.1:8000)
 *   php scripts/smoke-test.php http://host:port
 */

$base = rtrim($argv[1] ?? 'http://127.0.0.1:8000', '/').'/api/v1';
$secret = getenv('PAYMENT_GATEWAY_SECRET') ?: 'mock-secret-key';

$pass = 0;
$fail = 0;
$failures = [];

function request(string $method, string $path, array|string|null $body = null, ?string $token = null, array $headers = []): array
{
    global $base;

    $url = str_starts_with($path, 'http') ? $path : $base.$path;

    $ch = curl_init($url);
    $allHeaders = array_merge(['Accept: application/json'], $headers);

    if ($body !== null) {
        $allHeaders[] = 'Content-Type: application/json';
    }
    if ($token !== null) {
        $allHeaders[] = 'Authorization: Bearer '.$token;
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $allHeaders,
        CURLOPT_TIMEOUT => 20,
    ]);

    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($body) ? $body : json_encode($body));
    }

    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);

    return [
        'status' => $status,
        'body' => json_decode((string) $raw, true),
        'raw' => (string) $raw,
        'error' => $error,
    ];
}

function check(string $label, bool $condition, mixed $context = null): void
{
    global $pass, $fail, $failures;

    if ($condition) {
        $pass++;
        echo "  PASS  {$label}\n";

        return;
    }

    $fail++;
    $failures[] = $label;
    echo "  FAIL  {$label}";
    if ($context !== null) {
        echo '  ->  '.json_encode($context, JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    }
    echo "\n";
}

function section(string $title): void
{
    echo "\n== {$title} ==\n";
}

/**
 * @param  array<int, array<string, mixed>>  $rows
 * @return array<string, mixed>|null
 */
function firstTransaction(array $rows, mixed $value, string $key = 'order_number'): ?array
{
    foreach ($rows as $row) {
        if (($row[$key] ?? null) === $value) {
            return $row;
        }
    }

    return null;
}

function login(string $username, string $password = 'password'): ?string
{
    $res = request('POST', '/auth/login', ['username' => $username, 'password' => $password]);

    return $res['body']['data']['token'] ?? null;
}

echo "MICRODINE smoke test -> {$base}\n";

// ---------------------------------------------------------------- Auth & RBAC
section('Auth & RBAC');

$admin = login('admin');
$kasir = login('kasir');
$kitchen = login('kitchen');

check('login admin mengembalikan token', is_string($admin) && $admin !== '');
check('login kasir mengembalikan token', is_string($kasir) && $kasir !== '');
check('login kitchen mengembalikan token', is_string($kitchen) && $kitchen !== '');

$badLogin = request('POST', '/auth/login', ['username' => 'admin', 'password' => 'salah']);
check('login password salah ditolak 401', $badLogin['status'] === 401, $badLogin['body']);

$anon = request('GET', '/admin/menus');
check('endpoint admin tanpa token ditolak 401', $anon['status'] === 401, $anon['body']);

$kitchenToAdmin = request('GET', '/admin/menus', null, $kitchen);
check('role kitchen ditolak dari endpoint admin 403', $kitchenToAdmin['status'] === 403, $kitchenToAdmin['body']);

$kasirToAdmin = request('GET', '/admin/staff', null, $kasir);
check('role kasir ditolak dari endpoint admin 403', $kasirToAdmin['status'] === 403, $kasirToAdmin['body']);

$adminMenus = request('GET', '/admin/menus', null, $admin);
check('role admin boleh akses master menu 200', $adminMenus['status'] === 200);

// ------------------------------------------------------------- Settings pajak
section('Pengaturan & katalog publik');

$settings = request('GET', '/settings', null, $admin);
check('GET settings 200', $settings['status'] === 200, $settings['body']);

$originalRestaurantName = $settings['body']['data']['restaurant_name'] ?? 'MICRODINE';

$updatedSettings = request('PUT', '/settings', [
    'restaurant_name' => 'MICRODINE Test',
    'tax_name' => 'PB1',
    'tax_percentage' => 10,
    'is_tax_active' => true,
], $admin);
check('PUT settings mengubah nama restoran', ($updatedSettings['body']['data']['restaurant_name'] ?? null) === 'MICRODINE Test');

$publicMenus = request('GET', '/public/menus');
check('GET public menus 200', $publicMenus['status'] === 200);
$firstMenu = $publicMenus['body']['data']['categories'][0]['menus'][0] ?? null;
check('public menu memuat daftar menu', is_array($firstMenu), $publicMenus['body']);

$menuId = $firstMenu['id'];
$menuPrice = (float) $firstMenu['selling_price'];

$guestSettings = request('PUT', '/settings', ['tax_percentage' => 5]);
check('tamu tidak boleh ubah settings 401', $guestSettings['status'] === 401);

// ------------------------------------------------------- Shared table session
section('Sesi meja (shared session + locking)');

$tables = request('GET', '/operations/tables', null, $kasir);
check('kasir dapat grid meja 200', $tables['status'] === 200);

// Pilih meja yang masih kosong agar uji pembuatan sesi bisa dijalankan.
$table = null;
foreach ($tables['body']['data'] as $candidate) {
    if ($candidate['status'] === 'available') {
        $table = $candidate;
        break;
    }
}

$expectNewSession = $table !== null;

if ($table === null) {
    $table = $tables['body']['data'][0];
    echo "  NOTE  semua meja sudah terisi; uji pembuatan sesi baru dilewati.\n";
    echo "        Jalankan `php artisan migrate:fresh --seed` lalu ulangi untuk uji penuh.\n";
}

$qrToken = $table['qr_token'];

$scan1 = request('GET', '/public/tables/scan/'.$qrToken);
$scan2 = request('GET', '/public/tables/scan/'.$qrToken);

if ($expectNewSession) {
    check('scan pertama membuat sesi baru', ($scan1['body']['data']['session_created'] ?? null) === true, $scan1['body']);
} else {
    check('scan pada meja terisi tidak membuat sesi ganda', ($scan1['body']['data']['session_created'] ?? null) === false, $scan1['body']);
}
check('scan kedua TIDAK membuat sesi baru', ($scan2['body']['data']['session_created'] ?? null) === false, $scan2['body']);
check(
    'scan kedua bergabung ke sesi yang sama',
    ($scan1['body']['data']['session']['id'] ?? 0) === ($scan2['body']['data']['session']['id'] ?? -1),
);

$sessionId = $scan1['body']['data']['session']['id'];

$scanInvalid = request('GET', '/public/tables/scan/token-palsu');
check('qr token tidak dikenal ditolak 404', $scanInvalid['status'] === 404, $scanInvalid['body']);

// ---------------------------------------------- Order QRIS + snapshot + pajak
section('Checkout QRIS & snapshot harga');

$orderPayload = [
    'qr_token' => $qrToken,
    'customer_name' => 'Pelanggan Test',
    'payment_method' => 'qris',
    'items' => [['menu_id' => $menuId, 'quantity' => 2, 'notes' => 'pedas']],
];

$orderRes = request('POST', '/public/orders', $orderPayload);
$order = $orderRes['body']['data'] ?? [];
$orderNumber = $order['order_number'] ?? '';

check('order dibuat 201', $orderRes['status'] === 201, $orderRes['body']);
check('status pembayaran awal pending', ($order['payment_status'] ?? null) === 'pending');
check('subtotal = harga x qty', abs(($order['subtotal'] ?? 0) - ($menuPrice * 2)) < 0.01, $order['subtotal'] ?? null);
check('pajak 10% dihitung otomatis', abs(($order['tax_amount'] ?? 0) - ($menuPrice * 2 * 0.10)) < 0.01, $order['tax_amount'] ?? null);
check('grand total = subtotal + pajak', abs(($order['grand_total'] ?? 0) - ($menuPrice * 2 * 1.10)) < 0.01);
check('qris payload tersedia', is_string($order['qris_payload'] ?? null) && $order['qris_payload'] !== '');
check('expiry ~15 menit', ($order['seconds_until_expiry'] ?? 0) > 800 && ($order['seconds_until_expiry'] ?? 0) <= 900, $order['seconds_until_expiry'] ?? null);

$orderDetail = request('GET', '/public/orders/'.$orderNumber);
check('detail order publik dapat diakses tanpa login', $orderDetail['status'] === 200);
check('timeline status tercatat', count($orderDetail['body']['data']['timeline'] ?? []) >= 2);

// ------------------------------------------------------- Pay-First Gate (dapur)
section('Pay-First Gate');

/**
 * @param  array<string, array<int, array<string, mixed>>>  $columns
 * @return array<int, string>
 */
function orderNumbers(array $columns): array
{
    $numbers = [];
    foreach ($columns as $rows) {
        foreach ($rows as $row) {
            $numbers[] = $row['order_number'] ?? null;
        }
    }

    return array_values(array_filter($numbers));
}

$kitchenQueueBefore = request('GET', '/operations/orders/queue?screen=kitchen', null, $kitchen);
$kitchenNumbers = orderNumbers($kitchenQueueBefore['body']['data']['columns'] ?? []);
check('order pending TIDAK muncul di layar dapur', ! in_array($orderNumber, $kitchenNumbers, true), $kitchenNumbers);

$kasirQueue = request('GET', '/operations/orders/queue?screen=kasir', null, $kasir);
$waitingNumbers = array_column($kasirQueue['body']['data']['columns']['waiting_payment'] ?? [], 'order_number');
check('order pending muncul di kolom kasir "waiting_payment"', in_array($orderNumber, $waitingNumbers, true), $waitingNumbers);

$prePayStatus = request('PATCH', '/operations/orders/'.$order['id'].'/kitchen-status', ['kitchen_status' => 'cooking'], $kitchen);
check('status dapur tidak bisa diubah sebelum lunas (409)', $prePayStatus['status'] === 409, $prePayStatus['body']);

// -------------------------------------------------------------- Webhook QRIS
section('Webhook QRIS');

$gatewayRef = json_decode((string) $order['qris_payload'], true)['ref_id'] ?? null;
check('qris_payload memuat ref_id gateway', is_string($gatewayRef) && $gatewayRef !== '');

$webhookBody = json_encode(['ref_id' => $gatewayRef, 'status' => 'paid']);

$badSig = request('POST', '/payments/webhook/qris', $webhookBody, null, ['X-Callback-Signature: signature-palsu']);
check('webhook dengan signature salah ditolak 401', $badSig['status'] === 401, $badSig['body']);

$goodSig = hash_hmac('sha256', $webhookBody, $secret);
$webhook = request('POST', '/payments/webhook/qris', $webhookBody, null, ['X-Callback-Signature: '.$goodSig]);
check('webhook valid mengubah status jadi paid', ($webhook['body']['data']['payment_status'] ?? null) === 'paid', $webhook['body']);
check('paid_at terisi', ! empty($webhook['body']['data']['paid_at']));

$webhookAgain = request('POST', '/payments/webhook/qris', $webhookBody, null, ['X-Callback-Signature: '.$goodSig]);
check('webhook duplikat tetap 200 (idempoten)', $webhookAgain['status'] === 200, $webhookAgain['body']);

$unknownRef = json_encode(['ref_id' => 'MOCK-TIDAK-ADA', 'status' => 'paid']);
$unknown = request('POST', '/payments/webhook/qris', $unknownRef, null, ['X-Callback-Signature: '.hash_hmac('sha256', $unknownRef, $secret)]);
check('webhook ref tak dikenal 404', $unknown['status'] === 404, $unknown['body']);

// --------------------------------------------------------- Transisi dapur
section('Transisi status dapur');

$toCooking = request('PATCH', '/operations/orders/'.$order['id'].'/kitchen-status', ['kitchen_status' => 'cooking'], $kitchen);
check('paid -> cooking 200', $toCooking['status'] === 200, $toCooking['body']);

$kitchenQueueAfter = request('GET', '/operations/orders/queue?screen=kitchen', null, $kitchen);
$cookingNumbers = array_column($kitchenQueueAfter['body']['data']['columns']['cooking'] ?? [], 'order_number');
check('order paid+cooking muncul di layar dapur', in_array($orderNumber, $cookingNumbers, true), $cookingNumbers);

$skipStep = request('PATCH', '/operations/orders/'.$order['id'].'/kitchen-status', ['kitchen_status' => 'served'], $kitchen);
check('lompat transisi cooking -> served ditolak 422', $skipStep['status'] === 422, $skipStep['body']);

$toReady = request('PATCH', '/operations/orders/'.$order['id'].'/kitchen-status', ['kitchen_status' => 'ready'], $kitchen);
check('cooking -> ready 200', $toReady['status'] === 200, $toReady['body']);

$toServed = request('PATCH', '/operations/orders/'.$order['id'].'/kitchen-status', ['kitchen_status' => 'served'], $kitchen);
check('ready -> served 200', $toServed['status'] === 200, $toServed['body']);

// ------------------------------------------------------- Pembayaran tunai
section('Pembayaran tunai kasir');

$cashOrderRes = request('POST', '/public/orders', [
    'table_session_id' => $sessionId,
    'payment_method' => 'cash',
    'items' => [['menu_id' => $menuId, 'quantity' => 1]],
]);
$cashOrder = $cashOrderRes['body']['data'] ?? [];
check('order tunai dibuat 201', $cashOrderRes['status'] === 201, $cashOrderRes['body']);

$underpaid = request('POST', '/cashier/orders/'.$cashOrder['id'].'/confirm-cash', ['cash_received' => 1000], $kasir);
check('uang kurang ditolak 422', $underpaid['status'] === 422, $underpaid['body']);

$grandTotal = (float) $cashOrder['grand_total'];
$cashReceived = ceil($grandTotal / 10000) * 10000;

$confirmCash = request('POST', '/cashier/orders/'.$cashOrder['id'].'/confirm-cash', ['cash_received' => $cashReceived], $kasir);
check('konfirmasi tunai 200', $confirmCash['status'] === 200, $confirmCash['body']);
check('status jadi paid', ($confirmCash['body']['data']['payment_status'] ?? null) === 'paid');
check(
    'kembalian dihitung benar',
    abs(($confirmCash['body']['data']['change_due'] ?? -1) - ($cashReceived - $grandTotal)) < 0.01,
    $confirmCash['body']['data']['change_due'] ?? null,
);

$wrongMethod = request('POST', '/cashier/orders/'.$order['id'].'/confirm-cash', ['cash_received' => 100000], $kasir);
check('konfirmasi tunai untuk order QRIS ditolak 422', $wrongMethod['status'] === 422, $wrongMethod['body']);

// ---------------------------------------------------- Pay-First: analitik
section('Integritas keuangan (hanya paid)');

$pendingOrder = request('POST', '/public/orders', [
    'table_session_id' => $sessionId,
    'payment_method' => 'cash',
    'items' => [['menu_id' => $menuId, 'quantity' => 3]],
])['body']['data'] ?? [];

$dashboardBefore = request('GET', '/admin/analytics/dashboard', null, $admin);
$omzetBefore = (float) ($dashboardBefore['body']['data']['summary']['omzet'] ?? 0);

$dashboardAfter = request('GET', '/admin/analytics/dashboard', null, $admin);
$omzetAfter = (float) ($dashboardAfter['body']['data']['summary']['omzet'] ?? 0);

check('order pending baru tidak menambah omzet', abs($omzetAfter - $omzetBefore) < 0.01, ['before' => $omzetBefore, 'after' => $omzetAfter]);
check('omzet > 0 karena ada transaksi paid', $omzetAfter > 0);
check('HPP dan laba tersedia di ringkasan', isset($dashboardAfter['body']['data']['summary']['hpp_total'], $dashboardAfter['body']['data']['summary']['net_profit']));
check('margin persen dihitung', isset($dashboardAfter['body']['data']['summary']['margin_percent']));
check('tren 14 hari berisi 14 baris', count($dashboardAfter['body']['data']['trend_14_days'] ?? []) === 14);
check('rasio metode bayar memuat qris & cash', array_key_exists('qris', $dashboardAfter['body']['data']['payment_split'] ?? []) && array_key_exists('cash', $dashboardAfter['body']['data']['payment_split'] ?? []));
check('top menu terisi', count($dashboardAfter['body']['data']['top_menus'] ?? []) > 0);

// ------------------------------------------- Snapshot HPP tahan perubahan harga
section('Snapshot harga & HPP');

$reportBefore = request('GET', '/admin/analytics/reports?payment_status=paid', null, $admin);
$rowBefore = firstTransaction($reportBefore['body']['data']['transactions'] ?? [], $orderNumber);

$menuNow = firstTransaction($adminMenus['body']['data'] ?? [], $menuId, 'id');
$newPrice = (float) $menuNow['selling_price'] + 5000;
$newHpp = (float) $menuNow['hpp'] + 3000;

$menuUpdate = request('PUT', '/admin/menus/'.$menuId, [
    'category_id' => $menuNow['category_id'],
    'name' => $menuNow['name'],
    'hpp' => $newHpp,
    'selling_price' => $newPrice,
], $admin);
check('harga menu berhasil diubah admin', $menuUpdate['status'] === 200, $menuUpdate['body']);

$reportAfter = request('GET', '/admin/analytics/reports?payment_status=paid', null, $admin);
$rowAfter = firstTransaction($reportAfter['body']['data']['transactions'] ?? [], $orderNumber);

check(
    'laporan transaksi lama memakai harga snapshot (tidak berubah)',
    abs(($rowAfter['gross_sales'] ?? 0) - ($rowBefore['gross_sales'] ?? -1)) < 0.01,
    ['before' => $rowBefore['gross_sales'] ?? null, 'after' => $rowAfter['gross_sales'] ?? null],
);
check(
    'HPP laporan transaksi lama tidak berubah',
    abs(($rowAfter['hpp'] ?? 0) - ($rowBefore['hpp'] ?? -1)) < 0.01,
    ['before' => $rowBefore['hpp'] ?? null, 'after' => $rowAfter['hpp'] ?? null],
);

// Kembalikan harga menu seperti semula agar data demo rapi.
request('PUT', '/admin/menus/'.$menuId, [
    'category_id' => $menuNow['category_id'],
    'name' => $menuNow['name'],
    'hpp' => $menuNow['hpp'],
    'selling_price' => $menuNow['selling_price'],
], $admin);

// ------------------------------------------------------------------ Tutup meja
section('Tutup sesi meja');

$closeBlocked = request('POST', '/operations/tables/'.$table['id'].'/close', null, $kasir);
check('tutup meja ditolak selama ada pesanan menggantung 422', $closeBlocked['status'] === 422, $closeBlocked['body']);

// ------------------------------------------------------------- Target & ekspor
section('Target penjualan & ekspor laporan');

$targetRes = request('POST', '/admin/analytics/targets', [
    'month_year' => date('Y-m'),
    'monthly_target_amount' => 15000000,
], $admin);
check('simpan target bulanan 200', $targetRes['status'] === 200, $targetRes['body']);
check('progress target menghitung realisasi', isset($targetRes['body']['data']['realization']));
check('progress menyertakan kebutuhan omzet harian', isset($targetRes['body']['data']['progress']['required_daily_omzet']));

$targetsGet = request('GET', '/admin/analytics/targets', null, $admin);
check('GET target 200', $targetsGet['status'] === 200);
check('proyeksi akhir bulan tersedia', isset($targetsGet['body']['data']['progress']['projected_month_end']));

$export = request('GET', '/admin/analytics/reports/export', null, $admin);
check('ekspor CSV 200', $export['status'] === 200, $export['status']);
check('CSV berisi header kolom hpp & net_profit', str_contains($export['raw'], 'hpp') && str_contains($export['raw'], 'net_profit'));

$staffList = request('GET', '/admin/staff', null, $admin);
check('admin dapat daftar staf 200', $staffList['status'] === 200);

$createStaff = request('POST', '/admin/staff', [
    'name' => 'Kasir Baru',
    'username' => 'kasir.baru.'.substr(bin2hex(random_bytes(3)), 0, 6),
    'password' => 'password123',
    'role' => 'kasir',
], $admin);
check('admin dapat membuat akun kasir 201', $createStaff['status'] === 201, $createStaff['body']);

$createAdminViaStaff = request('POST', '/admin/staff', [
    'name' => 'Admin Palsu',
    'username' => 'admin.palsu.'.substr(bin2hex(random_bytes(3)), 0, 6),
    'password' => 'password123',
    'role' => 'admin',
], $admin);
check('role admin tidak bisa dibuat lewat endpoint staff 422', $createAdminViaStaff['status'] === 422, $createAdminViaStaff['body']);

// -------------------------------------------------------------- Ringkasan
// Kembalikan data demo yang diubah oleh uji agar tidak terlihat "kotor".
request('PUT', '/settings', ['restaurant_name' => $originalRestaurantName], $admin);

echo "\n----------------------------------------\n";
echo "PASS: {$pass}   FAIL: {$fail}\n";

if ($fail > 0) {
    echo "Gagal:\n";
    foreach ($failures as $f) {
        echo "  - {$f}\n";
    }
    exit(1);
}

echo "Semua skenario lolos.\n";
exit(0);
