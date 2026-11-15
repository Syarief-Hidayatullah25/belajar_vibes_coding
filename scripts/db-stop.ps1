# Stop PostgreSQL portabel.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$pgCtl = Join-Path $root '.tools\pgsql\bin\pg_ctl.exe'
$data = Join-Path $root '.data\pgdata'

if (-not (Test-Path $pgCtl)) {
    throw "PostgreSQL portabel tidak ditemukan di $pgCtl"
}

& $pgCtl -D $data -m fast -w -t 60 stop
Write-Host "PostgreSQL berhenti."
