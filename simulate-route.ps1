<#
.SYNOPSIS
    Simula llamadas a la API para crear y actualizar una ruta de vehiculo.
.DESCRIPTION
    1. Crea una ruta  -- POST /api/routes/start  (omitir con -RouteId)
    2. Envia updates  -- POST /api/routes/update
    Escenarios: normal | duplicates | polyline | all
.PARAMETER BaseUrl     URL base de la API.          Default: https://in-ova-maps.runasp.net          cls
.PARAMETER RouteId     rId existente. Si se da, omite el paso de crear la ruta.
                       Default: r-2-00001 (ruta activa del entorno de prueba)
.PARAMETER ProviderId  ID del proveedor.            Default: 2
.PARAMETER DriverId    UUID del conductor.          Default: f04dabe3-...
.PARAMETER VehicleId   Placa / ID vehiculo.         Default: SIM-001
.PARAMETER WarehouseId 1=Malambo 2=Tulua.           Default: 1
.PARAMETER DelayMs     Ms entre updates.            Default: 2000
.PARAMETER Scenario    normal|duplicates|polyline|all
.EXAMPLE
    # Usar la ruta activa existente (recomendado mientras el start tenga bug)
    .\simulate-route.ps1 -RouteId r-2-00001 -Scenario all -DelayMs 1000
    # Crear ruta nueva y simular
    .\simulate-route.ps1 -RouteId '' -ProviderId 2 -DriverId '4eea5bb9-...' -Scenario normal
#>
param(
    [string]        $BaseUrl     = "https://in-ova-maps.runasp.net",
    #[string]        $BaseUrl     = "https://localhost:5001",
    [string]        $RouteId     = "r-1-00001",
    [int]           $ProviderId  = 2,
    [string]        $DriverId    = "f04dabe3-94d5-423f-8dd0-8e30b1e80fd9",
    [string]        $VehicleId   = "SIM-001",
    [int]           $WarehouseId = 1,
    [int]           $DelayMs     = 2000,
    [ValidateSet('normal','duplicates','polyline','all')]
    [string]        $Scenario    = "all"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step ([string]$m) { Write-Host "`n>> $m" -ForegroundColor Cyan }
function Write-Ok   ([string]$m) { Write-Host "   OK  $m" -ForegroundColor Green }
function Write-Info ([string]$m) { Write-Host "   ... $m" -ForegroundColor Gray }
function Write-Warn ([string]$m) { Write-Host "   W   $m" -ForegroundColor Yellow }
function Write-Fail ([string]$m) { Write-Host "   ERR $m" -ForegroundColor Red }

function Invoke-Api {
    param([string]$Method, [string]$Path, [object]$Body = $null)
    $url = "$BaseUrl$Path"
    $p = @{ Method=$Method; Uri=$url; ContentType="application/json"; UseBasicParsing=$true }
    if ($Body) {
        $p.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
        Write-Info "Body: $($p.Body)"
    }
    Write-Info "$Method $url"
    try {
        $r = Invoke-WebRequest @p
        Write-Ok "HTTP $($r.StatusCode)"
        if ($r.Content) { return ($r.Content | ConvertFrom-Json) }
        return $null
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Fail "HTTP $code -- $($_.Exception.Message)"
        try {
            $s = $_.Exception.Response.GetResponseStream()
            Write-Fail "Body: $((New-Object System.IO.StreamReader($s)).ReadToEnd())"
        } catch {}
        throw
    }
}

# Google Polyline encoder  -- recibe [lat,lng][] y devuelve string codificado.
# Los parentesis en (($v -band 0x1f) -bor 0x20) + 63 son obligatorios:
# -bor tiene menor precedencia que + en PowerShell.
function ConvertTo-Polyline {
    param([double[][]]$Coords)
    function Enc([double]$d) {
        $v = [int][Math]::Round($d * 1e5)
        $v = $v -shl 1
        if ($v -lt 0) { $v = -bnot $v }
        $sb = New-Object System.Text.StringBuilder
        while ($v -ge 0x20) {
            [void]$sb.Append([char]((($v -band 0x1f) -bor 0x20) + 63))
            $v = $v -shr 5
        }
        [void]$sb.Append([char]($v + 63))
        return $sb.ToString()
    }
    $sb = New-Object System.Text.StringBuilder
    $pLat = 0.0; $pLng = 0.0
    foreach ($p in $Coords) {
        [void]$sb.Append((Enc ($p[0] - $pLat)))
        [void]$sb.Append((Enc ($p[1] - $pLng)))
        $pLat = $p[0]; $pLng = $p[1]
    }
    return $sb.ToString()
}

function Get-UnixNow { return [int][DateTimeOffset]::UtcNow.ToUnixTimeSeconds() }

# Construye el body de update. Regla de la API: d.length == coordinates.length - 1
# Para 1 punto d=[], para N puntos d tiene N-1 deltas de tiempo entre puntos.
function New-UpdateBody {
    param([string]$rId, [double[][]]$Coords, [string]$Polyline = $null)
    $ts = Get-UnixNow
    $n = ($Coords | Measure-Object).Count
    # d.length == coordinates.length - 1. Use List[int] so ConvertTo-Json always emits [] when empty.
    $deltas = [System.Collections.Generic.List[int]]::new()
    if ($n -gt 1) { 1..($n-1) | ForEach-Object { [void]$deltas.Add(3) } }
    if ($Polyline) {
        return @{ rId=$rId; ts=$ts; polyline=$Polyline; d=$deltas }
    } else {
        return @{ rId=$rId; ts=$ts; coordinates=[object[]]$Coords; d=$deltas }
    }
}

# ---------------------------------------------------------------------------
# Coordenadas GPS -- Envigado / sur de Medellin (coords reales del usuario)
# Formato de la API: [lat, lng]
# ---------------------------------------------------------------------------

$SEG_NORMAL = @(
    @(6.08680,-75.63573), @(6.08673,-75.63544), @(6.08672,-75.63551),
    @(6.08671,-75.63547), @(6.08669,-75.63562), @(6.08654,-75.63562),
    @(6.08654,-75.63570), @(6.08644,-75.63570), @(6.08628,-75.63554),
    @(6.08628,-75.63525), @(6.08634,-75.63509), @(6.08637,-75.63500),
    @(6.08640,-75.63500), @(6.08590,-75.63518), @(6.08596,-75.63551),
    @(6.08596,-75.63565), @(6.08634,-75.63565), @(6.08658,-75.63563),
    @(6.08658,-75.63564), @(6.08672,-75.63558), @(6.08672,-75.63550),
    @(6.08643,-75.63550)
)

$SEG_EXTENDED = @(
    @(6.08650,-75.63480), @(6.08670,-75.63440), @(6.08700,-75.63410),
    @(6.08730,-75.63390), @(6.08760,-75.63370), @(6.08790,-75.63350),
    @(6.08820,-75.63330), @(6.08850,-75.63310)
)

# Reproduce el caso del usuario: muchos puntos casi iguales (83 puntos en su ejemplo)
$SEG_DUPLICATES = @(
    @(6.08680,-75.63573), @(6.08680,-75.63573),
    @(6.08681,-75.63573), @(6.08681,-75.63573),
    @(6.08681,-75.63572), @(6.08681,-75.63572), @(6.08681,-75.63572),
    @(6.08682,-75.63572), @(6.08682,-75.63572), @(6.08682,-75.63572),
    @(6.08682,-75.63571), @(6.08682,-75.63571), @(6.08682,-75.63571),
    @(6.08683,-75.63571), @(6.08683,-75.63571), @(6.08683,-75.63571),
    @(6.08683,-75.63570), @(6.08684,-75.63570), @(6.08684,-75.63570),
    @(6.08684,-75.63569)
)

# ---------------------------------------------------------------------------
# Iniciar ruta (solo cuando -RouteId esta vacio)
# ---------------------------------------------------------------------------

function Start-Route {
    Write-Step "Iniciando ruta..."
    $body = @{
        providerId  = $ProviderId
        warehouseId = $WarehouseId
        vehId       = $VehicleId
        loadInfo    = @{ load="Carga de prueba"; quantity=100; unit="kg" }
        coordinates = @(,$SEG_NORMAL[0])
        d           = [System.Collections.Generic.List[int]]::new()
    }
    if ($DriverId -and $DriverId -ne '') {
        $body.dId = $DriverId
    } else {
        $body.driverNombres   = "Test"
        $body.driverApellidos = "Simulacion"
        $body.driverTelefono  = "3001234567"
        $body.driverDocumento = "99999999"
    }
    $resp = Invoke-Api -Method POST -Path "/api/routes/start" -Body $body
    if (-not $resp -or -not $resp.rId) { throw "API no retorno rId. Resp: $($resp | ConvertTo-Json)" }
    Write-Ok "Ruta creada -- rId = $($resp.rId)"
    return $resp.rId
}

# ---------------------------------------------------------------------------
# Escenario 1: movimiento normal  (coordinates, un punto por update)
# ---------------------------------------------------------------------------

function Invoke-ScenarioNormal([string]$rId) {
    $all = $SEG_NORMAL + $SEG_EXTENDED
    Write-Step "ESCENARIO NORMAL -- coordinates, un punto por update"
    Write-Info "$($all.Count) puntos, intervalo ${DelayMs}ms"
    $i = 0
    foreach ($pt in $all) {
        $i++
        Write-Info "Update $i/$($all.Count) -- lat=$($pt[0])  lng=$($pt[1])"
        Invoke-Api -Method POST -Path "/api/routes/update" -Body (New-UpdateBody -rId $rId -Coords @(,$pt)) | Out-Null
        Start-Sleep -Milliseconds $DelayMs
    }
    Write-Ok "Escenario normal OK ($i updates)"
}

# ---------------------------------------------------------------------------
# Escenario 2: puntos duplicados / muy cercanos
# Reproduce el patron que puede generar el bug de Africa
# ---------------------------------------------------------------------------

function Invoke-ScenarioDuplicates([string]$rId) {
    Write-Step "ESCENARIO DUPLICADOS -- puntos casi identicos"
    Write-Warn "Reproduce el patron del bug de Africa (muchos puntos cercanos)."
    Write-Info "$($SEG_DUPLICATES.Count) puntos, intervalo ${DelayMs}ms"
    $i = 0
    foreach ($pt in $SEG_DUPLICATES) {
        $i++
        $dm = 0
        if ($i -gt 1) {
            $prev = $SEG_DUPLICATES[$i-2]
            $dLat = $pt[0] - $prev[0]; $dLng = $pt[1] - $prev[1]
            $dm = [Math]::Round([Math]::Sqrt($dLat*$dLat + $dLng*$dLng) * 111000, 2)
        }
        Write-Info "Update $i/$($SEG_DUPLICATES.Count) -- lat=$($pt[0]) lng=$($pt[1])  (delta ~${dm}m)"
        Invoke-Api -Method POST -Path "/api/routes/update" -Body (New-UpdateBody -rId $rId -Coords @(,$pt)) | Out-Null
        Start-Sleep -Milliseconds $DelayMs
    }
    Write-Ok "Escenario duplicados OK ($i updates)"
}

# ---------------------------------------------------------------------------
# Escenario 3: batch polyline
# ---------------------------------------------------------------------------

function Invoke-ScenarioPolyline([string]$rId) {
    Write-Step "ESCENARIO POLYLINE -- batches como Google Polyline"
    Write-Info "3 batches con timestamps no superpuestos"

    # Calcular timestamps base para evitar conflictos de rangos
    # Batch 1: 7 puntos con 6 deltas de 3s = rango de 18s
    $ts1 = Get-UnixNow
    $b1 = $SEG_NORMAL[0..6]
    $deltas1 = [System.Collections.Generic.List[int]]::new()
    1..($b1.Count - 1) | ForEach-Object { [void]$deltas1.Add(3) }
    $p1 = ConvertTo-Polyline -Coords $b1

    Write-Info "Batch 1 ($($b1.Count) pts, rango ${ts1}-$($ts1 + ($deltas1.Count * 3))) -- $p1"
    Invoke-Api -Method POST -Path "/api/routes/update" -Body @{ rId=$rId; ts=$ts1; polyline=$p1; d=$deltas1 } | Out-Null

    # Esperar a que el rango del batch anterior termine + margen
    $waitTime = ($deltas1.Count * 3000) + $DelayMs
    Write-Info "Esperando ${waitTime}ms para evitar superposicion de rangos..."
    Start-Sleep -Milliseconds $waitTime

    # Batch 2: siguientes 7 puntos
    $ts2 = Get-UnixNow
    $b2 = $SEG_NORMAL[7..13]
    $deltas2 = [System.Collections.Generic.List[int]]::new()
    1..($b2.Count - 1) | ForEach-Object { [void]$deltas2.Add(3) }
    $p2 = ConvertTo-Polyline -Coords $b2

    Write-Info "Batch 2 ($($b2.Count) pts, rango ${ts2}-$($ts2 + ($deltas2.Count * 3))) -- $p2"
    Invoke-Api -Method POST -Path "/api/routes/update" -Body @{ rId=$rId; ts=$ts2; polyline=$p2; d=$deltas2 } | Out-Null

    Start-Sleep -Milliseconds $waitTime

    # Batch 3: HISTORIA COMPLETA acumulada (escenario real de la app Java)
    $ts3 = Get-UnixNow
    $deltasFull = [System.Collections.Generic.List[int]]::new()
    1..($SEG_NORMAL.Count - 1) | ForEach-Object { [void]$deltasFull.Add(3) }
    $pFull = ConvertTo-Polyline -Coords $SEG_NORMAL

    Write-Info "Batch 3 FULL HISTORY ($($SEG_NORMAL.Count) pts, $($pFull.Length) chars, rango ${ts3}-$($ts3 + ($deltasFull.Count * 3)))"
    Write-Info "Polyline: $pFull"
    Invoke-Api -Method POST -Path "/api/routes/update" -Body @{ rId=$rId; ts=$ts3; polyline=$pFull; d=$deltasFull } | Out-Null

    Write-Ok "Escenario polyline OK"
}

# ---------------------------------------------------------------------------
# Verificar estado final
# ---------------------------------------------------------------------------

function Get-RouteState([string]$rId) {
    Write-Step "Estado final de la ruta $rId..."
    $route = Invoke-Api -Method GET -Path "/api/routes/${rId}?format=coordinates"
    if ($route) { Write-Info ($route | ConvertTo-Json -Depth 5) }
}

# Devuelve $true si la ruta existe en la API, $false si retorna 404.
function Test-RouteExists([string]$rId) {
    $url = "$BaseUrl/api/routes/${rId}"
    Write-Info "GET $url"
    try {
        $r = Invoke-WebRequest -Method GET -Uri $url -UseBasicParsing
        Write-Ok "HTTP $($r.StatusCode) -- ruta encontrada"
        return $true
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 404) {
            Write-Warn "Ruta $rId no existe (HTTP 404)"
            return $false
        }
        Write-Fail "Error verificando ruta: HTTP $code -- $($_.Exception.Message)"
        throw
    }
}

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Magenta
Write-Host "  in-ova Route Simulator" -ForegroundColor Magenta
Write-Host "=======================================================" -ForegroundColor Magenta
Write-Info "BaseUrl     : $BaseUrl"
Write-Info "RouteId     : $(if ($RouteId) { $RouteId } else { '(crear nueva ruta)' })"
Write-Info "ProviderId  : $ProviderId"
Write-Info "DriverId    : $(if ($DriverId -and $DriverId -ne '') { $DriverId } else { '(nuevo conductor de prueba)' })"
Write-Info "VehicleId   : $VehicleId"
Write-Info "WarehouseId : $WarehouseId"
Write-Info "DelayMs     : $DelayMs"
Write-Info "Scenario    : $Scenario"
Write-Host "=======================================================" -ForegroundColor Magenta

try {
    $rId = if ($RouteId -and $RouteId -ne '') {
        Write-Step "Verificando si existe la ruta $RouteId..."
        if (Test-RouteExists $RouteId) {
            Write-Ok "Ruta encontrada -- usando $RouteId"
            $RouteId
        } else {
            Write-Warn "Ruta $RouteId no existe -- creando ruta nueva..."
            Start-Route
        }
    } else {
        Start-Route
    }

    switch ($Scenario) {
        "normal"     { Invoke-ScenarioNormal     $rId }
        "duplicates" { Invoke-ScenarioDuplicates $rId }
        "polyline"   { Invoke-ScenarioPolyline   $rId }
        "all" {
            Invoke-ScenarioNormal     $rId
            Invoke-ScenarioDuplicates $rId
            Invoke-ScenarioPolyline   $rId
        }
    }
    Get-RouteState $rId
    Write-Host ""
    Write-Host "=======================================================" -ForegroundColor Magenta
    Write-Ok "Simulacion completada. rId: $rId"
    Write-Info "Revisa console.warn en el navegador para el diagnostico del bug de Africa."
    Write-Host "=======================================================" -ForegroundColor Magenta
}
catch {
    Write-Fail "La simulacion fallo: $_"
    Write-Warn "Si falla al crear ruta, usa -RouteId r-2-00001 para usar la ruta existente."
    exit 1
}
