<#
  Zone Guard setup - checks the requirements, offers to install what is missing, then installs
  the backend (Python) and frontend (Node, React, Vite) packages.

  Normally started through setup.bat in the project root (which also handles the PowerShell
  execution policy). Nothing is installed without asking first.

    setup.bat                 interactive: asks before each installation
    setup.bat -CheckOnly      only report what is installed; change nothing
    setup.bat -AssumeYes      answer "yes" to every question (unattended)
    setup.bat -DryRun         show the install commands instead of running them

  This file is ASCII only on purpose; drawing characters are created from character codes.
#>
param(
    [switch]$CheckOnly,
    [switch]$AssumeYes,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$script:startTime = Get-Date
$script:results = New-Object System.Collections.ArrayList

# ------------------------------------------------------------------------------ look and feel
$cp = 0
try { $cp = [Console]::OutputEncoding.CodePage } catch { $cp = 0 }
$fancy = @(437, 850, 852, 860, 863, 865, 866, 65001) -contains $cp
if ($fancy) {
    $H = [string][char]0x2550; $V = [string][char]0x2551
    $TL = [string][char]0x2554; $TR = [string][char]0x2557; $BL = [string][char]0x255A; $BR = [string][char]0x255D
    $G1 = [string][char]0x2591; $G2 = [string][char]0x2592; $G3 = [string][char]0x2593; $G4 = [string][char]0x2588
} else {
    $H = '='; $V = '|'; $TL = '+'; $TR = '+'; $BL = '+'; $BR = '+'
    $G1 = '.'; $G2 = ':'; $G3 = '*'; $G4 = '#'
}
$Badge = @{
    OK      = @{ Text = 'OK';       Bg = 'Green';      Fg = 'Black' }
    MISSING = @{ Text = 'MISSING';  Bg = 'Red';        Fg = 'White' }
    FAIL    = @{ Text = 'FAILED';   Bg = 'Red';        Fg = 'White' }
    OLD     = @{ Text = 'OUTDATED'; Bg = 'Yellow';     Fg = 'Black' }
    STOPPED = @{ Text = 'STOPPED';  Bg = 'Yellow';     Fg = 'Black' }
    WARN    = @{ Text = 'NOTE';     Bg = 'Yellow';     Fg = 'Black' }
    INFO    = @{ Text = 'INFO';     Bg = 'Cyan';       Fg = 'Black' }
    ASK     = @{ Text = '?';        Bg = 'Magenta';    Fg = 'White' }
    SKIP    = @{ Text = 'SKIPPED';  Bg = 'DarkGray';   Fg = 'White' }
    DRY     = @{ Text = 'DRY RUN';  Bg = 'DarkCyan';   Fg = 'White' }
}
$StateColor = @{ OK = 'Green'; MISSING = 'Red'; FAIL = 'Red'; OLD = 'Yellow'; STOPPED = 'Yellow'; SKIP = 'DarkGray' }

function Write-Badge([string]$kind) {
    $b = $Badge[$kind]
    Write-Host (' {0,-8} ' -f $b.Text) -NoNewline -ForegroundColor $b.Fg -BackgroundColor $b.Bg
    Write-Host ' ' -NoNewline
}
function Say([string]$kind, [string]$text, [string]$color = 'Gray') {
    Write-Host '  ' -NoNewline
    Write-Badge $kind
    Write-Host $text -ForegroundColor $color
}
function Detail([string]$text, [string]$color = 'DarkGray') { Write-Host ('              ' + $text) -ForegroundColor $color }

function Show-Strip([int]$width) {
    $palette = @('DarkCyan', 'Cyan', 'Blue', 'Magenta', 'DarkMagenta', 'Magenta', 'Blue', 'Cyan')
    $glyphs = @($G1, $G2, $G3, $G4, $G3, $G2)
    $i = 0
    Write-Host '  ' -NoNewline
    for ($n = 0; $n -lt $width; $n += 3) {
        Write-Host (($glyphs[$i % $glyphs.Count]) * 3) -NoNewline -ForegroundColor $palette[$i % $palette.Count]
        $i++
    }
    Write-Host ''
}
function Show-Box([string[]]$lines, [string]$color, [int]$width = 56) {
    Write-Host ('  ' + $TL + ($H * $width) + $TR) -ForegroundColor $color
    foreach ($l in $lines) {
        $pad = $width - $l.Length; if ($pad -lt 0) { $pad = 0 }
        $left = [int][math]::Floor($pad / 2); $right = $pad - $left
        Write-Host ('  ' + $V) -NoNewline -ForegroundColor $color
        Write-Host ((' ' * $left) + $l + (' ' * $right)) -NoNewline -ForegroundColor White
        Write-Host $V -ForegroundColor $color
    }
    Write-Host ('  ' + $BL + ($H * $width) + $BR) -ForegroundColor $color
}
function Show-Banner {
    try { Clear-Host } catch { }
    Write-Host ''
    Show-Strip 58
    Show-Box @('', 'Z O N E   G U A R D   -   S E T U P', 'perimeter security prototype  |  TRL 7', '') 'Cyan'
    Show-Strip 58
    Write-Host ''
    if ($CheckOnly) { Say 'INFO' 'Check-only mode: nothing will be installed or changed.' 'Cyan' }
    if ($DryRun)    { Say 'DRY'  'Dry run: install commands are shown, not executed.' 'Cyan' }
    if ($AssumeYes) { Say 'WARN' 'Unattended mode: every question is answered "yes".' 'Yellow' }
}
function Show-Step([int]$n, [int]$total, [string]$title) {
    $len = 24
    $filled = [int][math]::Round($len * $n / $total)
    Write-Host ''
    Write-Host ('  STEP {0}/{1} ' -f $n, $total) -NoNewline -ForegroundColor Cyan
    Write-Host ($G4 * $filled) -NoNewline -ForegroundColor Cyan
    Write-Host ($G1 * ($len - $filled)) -NoNewline -ForegroundColor DarkGray
    Write-Host ('  ' + $title) -ForegroundColor White
    Write-Host ('  ' + ($H * 58)) -ForegroundColor DarkGray
}

function Add-Result([string]$name, [string]$state, [string]$detail) {
    [void]$script:results.Add([pscustomobject]@{ Item = $name; State = $state; Detail = $detail })
}

function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

function Ask-YesNo([string]$question, [string]$prompt = 'Install it now?') {
    if ($CheckOnly) { return $false }
    Write-Host ''
    Write-Host '  ' -NoNewline; Write-Badge 'ASK'; Write-Host $question -ForegroundColor White
    if ($AssumeYes) { Detail 'auto-answer: yes' 'Magenta'; return $true }
    while ($true) {
        Write-Host ('              ' + $prompt + '  ') -NoNewline -ForegroundColor Gray
        Write-Host '[Y]es' -NoNewline -ForegroundColor Green
        Write-Host ' / ' -NoNewline -ForegroundColor DarkGray
        Write-Host '[N]o ' -NoNewline -ForegroundColor Red
        $answer = Read-Host
        if ($answer -match '^(y|yes)$') { return $true }
        if ($answer -match '^(n|no)$')  { return $false }
        Detail 'please type Y or N' 'Yellow'
    }
}

function Test-Winget { return [bool](Get-Command winget -ErrorAction SilentlyContinue) }

function Install-WithWinget([string]$id, [string]$label, [string]$manualUrl) {
    if (-not (Test-Winget)) {
        Say 'WARN' "winget is not available. Install $label manually:" 'Yellow'
        Detail $manualUrl 'Cyan'
        return $false
    }
    $cmd = "winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements"
    if ($DryRun) { Say 'DRY' "would run: $cmd" 'Cyan'; return $false }
    Say 'INFO' "Installing $label with winget (this can take a few minutes) ..." 'Cyan'
    & winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { Say 'WARN' "winget finished with exit code $LASTEXITCODE." 'Yellow' }
    Refresh-Path
    return $true
}

# Runs a long command with a spinner, keeps the output in a log, shows the tail only on failure.
function Invoke-Step([string]$label, [string]$file, [string]$arguments, [string]$workDir) {
    $log = Join-Path $env:TEMP ('zg_setup_' + [guid]::NewGuid().ToString('N') + '.log')
    $err = $log + '.err'
    $frames = @('|', '/', '-', '\')
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $p = Start-Process -FilePath $file -ArgumentList $arguments -WorkingDirectory $workDir -NoNewWindow -PassThru -RedirectStandardOutput $log -RedirectStandardError $err
    $null = $p.Handle   # Windows PowerShell 5.1 returns an empty ExitCode unless the handle is cached
    $i = 0
    while (-not $p.HasExited) {
        Write-Host ("`r    {0} {1}  {2:N0}s " -f $frames[$i % 4], $label, $watch.Elapsed.TotalSeconds) -NoNewline -ForegroundColor Cyan
        $i++
        Start-Sleep -Milliseconds 120
    }
    $p.WaitForExit()
    $code = $p.ExitCode
    if ($null -eq $code) { $code = 1 }   # never report success when the exit code is unknown
    Write-Host ("`r" + (' ' * 78) + "`r") -NoNewline
    if ($code -eq 0) {
        Say 'OK' ('{0}  ({1:N1}s)' -f $label, $watch.Elapsed.TotalSeconds) 'Green'
    } else {
        Say 'FAIL' ('{0}  (exit code {1})' -f $label, $code) 'Red'
        foreach ($f in @($log, $err)) {
            if (Test-Path $f) { Get-Content $f -Tail 12 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ('              ' + $_) -ForegroundColor DarkRed } }
        }
    }
    Remove-Item $log, $err -Force -ErrorAction SilentlyContinue
    return ($code -eq 0)
}
function Quote([string]$s) { if ($s -match '\s') { return '"' + $s + '"' } else { return $s } }

# ------------------------------------------------------------------------------ detection
# Zone Guard is tested with Python 3.12 (64-bit). Its pinned packages (pydantic-core 2.16.2 and others)
# ship prebuilt Windows wheels only up to Python 3.12; on 3.13+ pip would try to compile Rust code and fail.
function Test-PythonCandidate([string]$exe, [string[]]$extra) {
    if (-not (Get-Command $exe -ErrorAction SilentlyContinue) -and -not (Test-Path $exe)) { return $null }
    try {
        $text = (& $exe @extra -c "import sys,struct,platform;print(sys.version_info[0],sys.version_info[1],sys.version_info[2],struct.calcsize('P')*8,platform.machine())" 2>&1 | Out-String)
    } catch { return $null }
    if ($text -notmatch '(?m)^(\d+) (\d+) (\d+) (\d+) (\S+)\s*$') { return $null }   # also skips the Microsoft Store stub
    $maj = [int]$Matches[1]; $min = [int]$Matches[2]; $bits = [int]$Matches[4]; $machine = $Matches[5]
    $why = ''
    if (-not ($maj -eq 3 -and $min -eq 12)) { $why = "this is Python $maj.$min, not 3.12" }
    elseif ($bits -ne 64) { $why = 'this is a 32-bit Python, 64-bit is required' }
    elseif ($machine -ne 'AMD64') { $why = "this Python runs on $machine; the packages are only available for 64-bit Intel/AMD (AMD64)" }
    return [pscustomobject]@{ Exe = $exe; Args = $extra; Version = "$maj.$min.$($Matches[3])"; Bits = $bits; Machine = $machine; Ok = ($why -eq ''); Why = $why }
}
function Get-PythonCommand {
    $candidates = New-Object System.Collections.ArrayList
    [void]$candidates.Add(@('py', @('-3.12')))
    [void]$candidates.Add(@('python', @()))
    [void]$candidates.Add(@('py', @('-3')))
    foreach ($path in @((Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'), (Join-Path $env:ProgramFiles 'Python312\python.exe'), 'C:\Python312\python.exe')) {
        [void]$candidates.Add(@($path, @()))
    }
    $firstFound = $null
    foreach ($c in $candidates) {
        $info = Test-PythonCandidate $c[0] $c[1]
        if (-not $info) { continue }
        if ($info.Ok) { return $info }
        if (-not $firstFound) { $firstFound = $info }
    }
    return $firstFound
}
function Get-NodeInfo {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $null }
    $text = (& node --version 2>&1 | Out-String)
    if ($text -match 'v(\d+)\.(\d+)\.(\d+)') {
        $maj = [int]$Matches[1]; $min = [int]$Matches[2]
        $ok = ($maj -ge 23) -or ($maj -eq 22 -and $min -ge 12) -or ($maj -eq 20 -and $min -ge 19)
        return [pscustomobject]@{ Version = "$maj.$min.$($Matches[3])"; Ok = $ok }
    }
    return $null
}
function Test-Port([int]$port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect('127.0.0.1', $port, $null, $null)
        return ($async.AsyncWaitHandle.WaitOne(1500) -and $client.Connected)
    } catch { return $false } finally { $client.Close() }
}
function Get-MongoInfo {
    $service = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^MongoDB' } | Select-Object -First 1
    $binary = (Get-Command mongod -ErrorAction SilentlyContinue) -or [bool](Get-ChildItem 'C:\Program Files\MongoDB\Server\*\bin\mongod.exe' -ErrorAction SilentlyContinue)
    return [pscustomobject]@{ Service = $service; Installed = ($binary -or ($null -ne $service)); Listening = (Test-Port 27017) }
}

# ------------------------------------------------------------------------------ run
Show-Banner
$totalSteps = 4
if ($CheckOnly) { $totalSteps = 1 }

# ---- step 1: requirements
Show-Step 1 $totalSteps 'Checking requirements'

$py = Get-PythonCommand
if ($py -and $py.Ok) {
    Say 'OK' "Python $($py.Version) (64-bit)" 'Green'; Add-Result 'Python 3.12 (64-bit)' 'OK' $py.Version
} else {
    if ($py) {
        Say 'OLD' "Python $($py.Version) ($($py.Bits)-bit, $($py.Machine)) found, but Zone Guard needs Python 3.12 (64-bit)" 'Yellow'
        Detail $py.Why 'Yellow'
        Detail 'The backend packages have no prebuilt versions for other Python versions, so pip would try to compile them (needs Rust) and fail.' 'DarkYellow'
        $question = "Install Python 3.12 next to your Python $($py.Version)? Your existing Python stays untouched."
    } else {
        Say 'MISSING' 'Python 3.12 (64-bit) was not found' 'Red'
        $question = 'Python 3.12 is needed to run the Zone Guard backend.'
    }
    if (Ask-YesNo $question) {
        [void](Install-WithWinget 'Python.Python.3.12' 'Python 3.12' 'https://www.python.org/downloads/release/python-3128/')
        $py = Get-PythonCommand
    }
    if ($py -and $py.Ok) { Say 'OK' "Python $($py.Version) (64-bit)" 'Green'; Add-Result 'Python 3.12 (64-bit)' 'OK' $py.Version }
    else { Add-Result 'Python 3.12 (64-bit)' 'MISSING' 'install Python 3.12, 64-bit (https://www.python.org/downloads/release/python-3128/) - it can sit next to other versions - then run setup.bat again' }
}

$node = Get-NodeInfo
if ($node -and $node.Ok) {
    Say 'OK' "Node.js $($node.Version)" 'Green'; Add-Result 'Node.js 20.19+ / 22.12+' 'OK' $node.Version
} else {
    if ($node) { Say 'OLD' "Node.js $($node.Version) found - Vite needs 20.19+ or 22.12+" 'Yellow' } else { Say 'MISSING' 'Node.js was not found' 'Red' }
    if (Ask-YesNo 'Node.js (current LTS) is needed to build and run the Zone Guard frontend.') {
        [void](Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js LTS' 'https://nodejs.org/')
        $node = Get-NodeInfo
    }
    if ($node -and $node.Ok) { Say 'OK' "Node.js $($node.Version)" 'Green'; Add-Result 'Node.js 20.19+ / 22.12+' 'OK' $node.Version }
    else { Add-Result 'Node.js 20.19+ / 22.12+' 'MISSING' 'install Node.js LTS (https://nodejs.org/), then run setup.bat again' }
}
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmVersion = (& npm --version 2>&1 | Out-String).Trim()
    Say 'OK' "npm $npmVersion" 'Green'; Add-Result 'npm' 'OK' $npmVersion
} else { Say 'MISSING' 'npm was not found (it comes with Node.js)' 'Red'; Add-Result 'npm' 'MISSING' 'comes with Node.js' }

$mongo = Get-MongoInfo
if ($mongo.Listening) {
    Say 'OK' 'MongoDB is running on localhost:27017' 'Green'; Add-Result 'MongoDB (localhost:27017)' 'OK' 'running'
} elseif ($mongo.Installed) {
    Say 'STOPPED' 'MongoDB is installed but not running on localhost:27017' 'Yellow'
    if ($mongo.Service -and (Ask-YesNo "MongoDB stores the events and incidents. Start the '$($mongo.Service.Name)' Windows service now?")) {
        if ($DryRun) { Say 'DRY' "would run: Start-Service $($mongo.Service.Name)" 'Cyan' }
        else {
            try { Start-Service $mongo.Service.Name; Start-Sleep 4 }
            catch { Say 'WARN' "Could not start the service: $($_.Exception.Message)" 'Yellow'; Detail "from an administrator prompt run:  net start $($mongo.Service.Name)" 'Cyan' }
        }
        $mongo = Get-MongoInfo
    }
    if ($mongo.Listening) { Say 'OK' 'MongoDB is running on localhost:27017' 'Green'; Add-Result 'MongoDB (localhost:27017)' 'OK' 'running' }
    else { Add-Result 'MongoDB (localhost:27017)' 'STOPPED' 'start MongoDB (service or mongod.exe) before start.bat' }
} else {
    Say 'MISSING' 'MongoDB was not found' 'Red'
    if (Ask-YesNo 'MongoDB Community Server stores the events and incidents (Windows will ask for administrator approval).') {
        [void](Install-WithWinget 'MongoDB.Server' 'MongoDB Community Server' 'https://www.mongodb.com/try/download/community')
        Start-Sleep 5
        $mongo = Get-MongoInfo
    }
    if ($mongo.Listening) { Say 'OK' 'MongoDB is running on localhost:27017' 'Green'; Add-Result 'MongoDB (localhost:27017)' 'OK' 'running' }
    elseif ($mongo.Installed) { Add-Result 'MongoDB (localhost:27017)' 'STOPPED' 'installed; start the MongoDB service before start.bat' }
    else { Add-Result 'MongoDB (localhost:27017)' 'MISSING' 'install MongoDB Community Server (https://www.mongodb.com/try/download/community)' }
}

foreach ($p in 8000, 5174) {
    if (Test-Port $p) { Say 'WARN' "Port $p is already in use (a running Zone Guard, or another program)" 'Yellow' }
}

# ---- steps 2 and 3: packages
$blocking = @($script:results | Where-Object { $_.Item -match '^(Python|Node|npm)' -and $_.State -ne 'OK' })
if ($CheckOnly) {
    # nothing more to do
} elseif ($blocking.Count -gt 0) {
    Say 'SKIP' 'Python and Node.js are both required before the packages can be installed' 'DarkGray'
    Add-Result 'Backend packages' 'SKIP' 'waiting for Python'
    Add-Result 'Frontend packages' 'SKIP' 'waiting for Node.js'
} else {
    Show-Step 2 $totalSteps 'Backend packages (Python)'
    $venvDir = Join-Path $Root 'backend\venv'
    $venvPython = Join-Path $venvDir 'Scripts\python.exe'
    $backendOk = $true
    if (Test-Path $venvPython) {
        $vp = Test-PythonCandidate $venvPython @()
        if (-not ($vp -and $vp.Ok) -and ($venvDir -eq (Join-Path $Root 'backend\venv'))) {
            $was = 'an unknown Python'; if ($vp) { $was = "Python $($vp.Version)" }
            Say 'WARN' "The existing virtual environment was built with $was - recreating it with Python $($py.Version)" 'Yellow'
            Remove-Item $venvDir -Recurse -Force
        }
    }
    if (-not (Test-Path $venvPython)) {
        $venvArgs = (@($py.Args) + @('-m', 'venv', (Quote $venvDir))) -join ' '
        $backendOk = Invoke-Step 'Creating virtual environment' $py.Exe $venvArgs $Root
    } else { Say 'OK' 'Virtual environment already exists' 'Green' }
    if ($backendOk) { $backendOk = Invoke-Step 'Updating pip' $venvPython '-m pip install --upgrade pip --quiet' $Root }
    if ($backendOk) {
        # --only-binary: never compile packages (that needs Rust/C++ build tools); fail fast with a clear message instead
        $backendOk = Invoke-Step 'Installing backend packages' $venvPython ('-m pip install --only-binary=:all: -r ' + (Quote (Join-Path $Root 'backend\requirements.txt'))) $Root
        if (-not $backendOk) {
            Detail 'Typical cause: no prebuilt package for this Python or computer (needs Python 3.12, 64-bit Intel/AMD),' 'Yellow'
            Detail 'or no internet connection. Check the lines above for the package pip could not find.' 'Yellow'
        }
    }
    if ($backendOk) {
        & $venvPython -c "import fastapi, uvicorn, pydantic, motor, pymongo, bcrypt, jwt, multipart, httpx"
        if ($LASTEXITCODE -eq 0) { Say 'OK' 'All backend packages load correctly' 'Green'; Add-Result 'Backend packages' 'OK' 'fastapi, uvicorn, pydantic, motor, pymongo, bcrypt, PyJWT, httpx' }
        else { Say 'FAIL' 'Packages installed but some cannot be imported' 'Red'; Add-Result 'Backend packages' 'FAIL' 'packages installed but some cannot be imported' }
    } else { Add-Result 'Backend packages' 'FAIL' 'see the messages above (internet connection?)' }

    Show-Step 3 $totalSteps 'Frontend packages (React, Vite)'
    $frontend = Join-Path $Root 'frontend'
    if (Invoke-Step 'Installing frontend packages (npm ci)' 'cmd.exe' '/c npm ci --no-audit --no-fund' $frontend) {
        if ((Test-Path (Join-Path $frontend 'node_modules\.bin\vite.cmd')) -and (Test-Path (Join-Path $frontend 'node_modules\react'))) {
            Say 'OK' 'React and Vite are installed' 'Green'; Add-Result 'Frontend packages' 'OK' 'react, vite and dependencies'
        } else { Say 'FAIL' 'npm finished but Vite or React is missing' 'Red'; Add-Result 'Frontend packages' 'FAIL' 'npm finished but Vite or React is missing' }
    } else { Add-Result 'Frontend packages' 'FAIL' 'see the messages above (internet connection?)' }

    # ---- step 4: optional demo data (needs the backend packages only, not MongoDB)
    Show-Step 4 $totalSteps 'Demo data (optional)'
    if (-not $backendOk) {
        Say 'SKIP' 'Demo data needs the backend packages' 'DarkGray'
        Add-Result 'Demo data' 'SKIP' 'backend packages are not installed'
    } else {
        $question = 'Load demo data? 10 zones, 9 devices and one user per role (shown on screen once).'
        if (Ask-YesNo $question 'Load the demo data, or start with an empty application?') {
            if ($DryRun) {
                Say 'DRY' 'would run: backend\venv\Scripts\python.exe tools\load_demo_data.py' 'Cyan'
                Add-Result 'Demo data' 'OK' 'dry run - would be loaded'
            } else {
                Push-Location (Join-Path $Root 'backend')
                try {
                    # run directly (not through Invoke-Step) so the generated passwords are visible on screen
                    & $venvPython 'tools\load_demo_data.py'
                    $demoExit = $LASTEXITCODE
                } finally { Pop-Location }
                if ($demoExit -eq 0) {
                    Say 'OK' 'Demo data is ready - note the passwords above, they are shown only once' 'Green'
                    Add-Result 'Demo data' 'OK' 'zones, devices and demo users loaded (list also in backend\data\accounts.txt)'
                } else {
                    Say 'FAIL' "Loading the demo data failed (exit code $demoExit)" 'Red'
                    Add-Result 'Demo data' 'FAIL' 'run backend\venv\Scripts\python.exe tools\load_demo_data.py to see why'
                }
            }
        } else {
            Say 'INFO' 'Starting with an empty application. Load the demo later with tools\load_demo_data.py' 'Cyan'
            Add-Result 'Demo data' 'OK' 'not loaded - empty application (your choice)'
        }
    }
}

# ---- summary
Write-Host ''
Write-Host '  SUMMARY' -ForegroundColor White
Write-Host ('  ' + ($H * 58)) -ForegroundColor DarkGray
foreach ($r in $script:results) {
    $badgeKind = $r.State
    Write-Host '  ' -NoNewline; Write-Badge $badgeKind
    Write-Host ('{0,-27}' -f $r.Item) -NoNewline -ForegroundColor White
    Write-Host $r.Detail -ForegroundColor $StateColor[$r.State]
}
Write-Host ''
$notOk = @($script:results | Where-Object { $_.State -ne 'OK' })
$seconds = [int]((Get-Date) - $script:startTime).TotalSeconds
if ($notOk.Count -eq 0) {
    if ($CheckOnly) {
        Show-Box @('', 'ALL REQUIREMENTS PRESENT', 'run setup.bat to install the packages', '') 'Green'
    } else {
        Show-Box @('', 'SETUP COMPLETE', ('finished in {0}s' -f $seconds), 'next: start.bat  (it also starts the event simulator)', '') 'Green'
    }
    Write-Host ''
    if (-not $CheckOnly -and -not $DryRun) {
        # self-destruct: setup succeeded, so remove this script and its folder (setup.bat removes itself afterwards)
        try {
            Set-Location $Root
            Remove-Item -LiteralPath $PSScriptRoot -Recurse -Force -ErrorAction Stop
            Say 'INFO' 'Setup finished successfully - the setup folder was removed, so the setup cannot be run again.' 'Cyan'
        } catch { Say 'WARN' "Could not remove the setup folder: $($_.Exception.Message)" 'Yellow' }
        Write-Host ''
    }
    exit 0
}
Show-Box @('', $(if ($CheckOnly) { 'SOME REQUIREMENTS ARE MISSING' } else { 'SETUP IS NOT COMPLETE' }), 'fix the red items above, then run setup.bat again', '') 'Red'
Write-Host ''
exit 1
