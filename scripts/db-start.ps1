# Start PostgreSQL portabel untuk development.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$pgCtl = Join-Path $root '.tools\pgsql\bin\pg_ctl.exe'
$data = Join-Path $root '.data\pgdata'
$log = Join-Path $root '.data\pg.log'

if (-not (Test-Path $pgCtl)) {
    throw "PostgreSQL portabel tidak ditemukan di $pgCtl"
}
if (-not (Test-Path $data)) {
    throw "Data cluster belum ada di $data"
}

& $pgCtl -D $data -l $log -o "-p 5432 -c listen_addresses=127.0.0.1" -w -t 60 start
Write-Host "PostgreSQL berjalan di 127.0.0.1:5432 (log: $log)"
