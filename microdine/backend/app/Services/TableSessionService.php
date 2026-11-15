<?php

namespace App\Services;

use App\Models\DiningTable;
use App\Models\TableSession;
use Illuminate\Support\Facades\DB;

class TableSessionService
{
    /**
     * Validasi QR meja dan pastikan ada tepat satu sesi aktif.
     */
    public function scan(string $qrToken): array
    {
        return DB::transaction(function () use ($qrToken) {
            /** @var DiningTable $table */
            $table = DiningTable::query()
                ->where('qr_token', $qrToken)
                ->lockForUpdate()
                ->firstOrFail();

            return $this->openOrJoin($table);
        });
    }

    /**
     * Sama seperti scan(), tetapi meja dicari lewat barcode (scanner kasir).
     */
    public function scanByBarcode(string $barcodeCode): array
    {
        return DB::transaction(function () use ($barcodeCode) {
            /** @var DiningTable $table */
            $table = DiningTable::query()
                ->where('barcode_code', $barcodeCode)
                ->lockForUpdate()
                ->firstOrFail();

            return $this->openOrJoin($table);
        });
    }

    public function close(TableSession $session, int $userId): TableSession
    {
        return DB::transaction(function () use ($session, $userId) {
            /** @var TableSession $locked */
            $locked = TableSession::query()->lockForUpdate()->findOrFail($session->id);

            $locked->update([
                'status' => TableSession::STATUS_CLOSED,
                'closed_at' => now(),
                'closed_by_user_id' => $userId,
            ]);

            DiningTable::query()
                ->whereKey($locked->table_id)
                ->update(['status' => DiningTable::STATUS_AVAILABLE]);

            return $locked->refresh();
        });
    }

    /**
     * Satu meja hanya boleh punya satu sesi aktif. Pelanggan kedua yang memindai
     * meja yang sama otomatis bergabung (shared table session).
     *
     * Wajib dipanggil di dalam transaksi dengan baris meja sudah terkunci.
     *
     * @return array{table: DiningTable, session: TableSession, created: bool}
     */
    private function openOrJoin(DiningTable $table): array
    {
        $activeSession = TableSession::query()
            ->where('table_id', $table->id)
            ->where('status', TableSession::STATUS_ACTIVE)
            ->latest('id')
            ->first();

        if ($activeSession !== null) {
            return ['table' => $table, 'session' => $activeSession, 'created' => false];
        }

        $sequence = TableSession::query()->where('table_id', $table->id)->count() + 1;

        $session = TableSession::create([
            'table_id' => $table->id,
            'session_code' => sprintf('S-%s-%02d', $table->table_number, $sequence),
            'status' => TableSession::STATUS_ACTIVE,
            'opened_at' => now(),
        ]);

        $table->update(['status' => DiningTable::STATUS_OCCUPIED]);

        return ['table' => $table->refresh(), 'session' => $session, 'created' => true];
    }
}
