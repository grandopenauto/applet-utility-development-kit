# Disposable GitHub-hosted Windows identity experiment. Never use on production/VPS.
# Creates a temporary nonadmin account and removes it during finally cleanup.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $env:GITHUB_ACTIONS -or $env:RUNNER_OS -ne 'Windows' -or -not $env:RUNNER_TEMP) {
  throw 'AUDK_CI_WORKER_EXPERIMENT_REQUIRES_GITHUB_HOSTED_WINDOWS_RUNNER'
}
if (-not (Get-Command New-LocalUser -ErrorAction SilentlyContinue)) { throw 'WINDOWS_LOCAL_USER_API_MISSING' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node = (Get-Command node.exe -ErrorAction Stop).Source
$python = (Get-Command python.exe -ErrorAction Stop).Source
$nonce = [Guid]::NewGuid().ToString('N').Substring(0,9)
$username = 'audkci' + $nonce
$root = Join-Path $env:RUNNER_TEMP ('AUDK-Restricted-' + $nonce)
$src = Join-Path $root 'source'
$data = Join-Path $root 'jobs'
$secure = Join-Path $root 'private'
$sentinel = Join-Path $secure 'secret-sentinel.txt'
$wrapper = Join-Path $src 'audk-ci-launch.cmd'
$out = Join-Path $root 'worker.stdout'
$err = Join-Path $root 'worker.stderr'
$createdUser = $false
function Grant-ScopedAcl([string]$path,[string]$principal,[string]$permissions) {
  & icacls.exe $path /grant:r "${principal}:${permissions}" /T /Q | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'AUDK_CI_ACL_GRANT_FAILED' }
}
function Protect-Tree([string]$path) {
  & icacls.exe $path /inheritance:r /T /C /Q | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'AUDK_CI_ACL_INHERITANCE_FAILED' }
}
try {
  New-Item -ItemType Directory -Path $src,$data,$secure -Force | Out-Null
  Copy-Item -Path (Join-Path $repo '*') -Destination $src -Recurse -Force -ErrorAction Stop
  Copy-Item (Join-Path $repo '.gitattributes') $src -Force
  $passwordText = [Guid]::NewGuid().ToString('N') + 'aA!9'
  $password = ConvertTo-SecureString $passwordText -AsPlainText -Force
  New-LocalUser -Name $username -Password $password -Description 'AUDK ephemeral non-admin CI sandbox identity' -PasswordNeverExpires -UserMayNotChangePassword | Out-Null
  $createdUser = $true
  $sid = (Get-LocalUser -Name $username).SID.Value
  if ($sid -notmatch '^S-1-5-21-') { throw 'AUDK_CI_INVALID_LOCAL_ACCOUNT_SID' }
  # Prevent broad inherited access to the sentinel; require source read-only and job write.
  Set-Content -LiteralPath $sentinel -Value 'CI ONLY synthetic sentinel' -NoNewline
  Protect-Tree $src
  Protect-Tree $data
  Protect-Tree $secure
  # The hosted runner may have a filtered administrator token; preserve its own
  # explicit ACL access while limiting the disposable non-admin account.
  $runnerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  Grant-ScopedAcl $src $runnerSid '(OI)(CI)F'
  Grant-ScopedAcl $data $runnerSid '(OI)(CI)F'
  Grant-ScopedAcl $secure $runnerSid '(OI)(CI)F'
  Grant-ScopedAcl $src 'SYSTEM' '(OI)(CI)F'
  Grant-ScopedAcl $src 'BUILTIN\Administrators' '(OI)(CI)F'
  Grant-ScopedAcl $src $username '(OI)(CI)RX'
  Grant-ScopedAcl $data 'SYSTEM' '(OI)(CI)F'
  Grant-ScopedAcl $data 'BUILTIN\Administrators' '(OI)(CI)F'
  Grant-ScopedAcl $data $username '(OI)(CI)M'
  Grant-ScopedAcl $secure 'SYSTEM' '(OI)(CI)F'
  Grant-ScopedAcl $secure 'BUILTIN\Administrators' '(OI)(CI)F'
  # Parent traversability is needed for source+data. Never grant user access to private.
  & icacls.exe $root /grant "${username}:(RX)" /Q | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'AUDK_CI_PARENT_TRAVERSE_DENIED' }
  # The source-lock is verified against the staged files before the job runs.
  & $node (Join-Path $src 'scripts\verify-worker-lock.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'AUDK_CI_SOURCE_LOCK_DENIED' }
  & $node (Join-Path $src 'scripts\ci-seed-restricted-job.mjs') $data
  if ($LASTEXITCODE -ne 0) { throw 'AUDK_CI_JOB_SEED_DENIED' }
  # Provide only nonsensitive static config; no public API token or other secrets.
  $lines = @(
    '@echo off',
    'setlocal',
    ('set "AUDK_BUILD_DATA_DIR=' + $data + '"'),
    ('set "AUDK_WORKER_ALLOWED_SID=' + $sid + '"'),
    ('set "AUDK_PYTHON=' + $python + '"'),
    ('"' + $node + '" "' + (Join-Path $src 'scripts\ci-check-worker-boundaries.mjs') + '" "' + (Join-Path $src 'README.md') + '" "' + $sentinel + '" "' + (Join-Path $data 'probe.tmp') + '"'),
    'if errorlevel 1 exit /b 11',
    ('"' + $node + '" "' + (Join-Path $src 'scripts\run-restricted-worker.mjs') + '" --check'),
    'if errorlevel 1 exit /b 12',
    ('"' + $node + '" "' + (Join-Path $src 'scripts\run-restricted-worker.mjs') + '"'),
    'if errorlevel 1 exit /b 13',
    'exit /b 0'
  )
  # Wrapper is written by admin under source, which remains read-only to the worker.
  [System.IO.File]::WriteAllLines($wrapper,$lines,[System.Text.UTF8Encoding]::new($false))
  $credential = [System.Management.Automation.PSCredential]::new("$env:COMPUTERNAME\$username",$password)
  $run = Start-Process -FilePath $env:ComSpec -ArgumentList @('/d','/c',('"'+$wrapper+'"')) -Credential $credential -WorkingDirectory $src -RedirectStandardOutput $out -RedirectStandardError $err -Wait -PassThru -NoNewWindow
  if ($run.ExitCode -ne 0) {
    Write-Output ('AUDK_CI_RESTRICTED_CHILD_EXIT='+$run.ExitCode)
    $stderr=Get-Content $err -Raw -ErrorAction SilentlyContinue
    if ($stderr) { Write-Output ($stderr.Substring(0,[Math]::Min(2200,$stderr.Length))) }
    throw 'AUDK_CI_RESTRICTED_CHILD_FAILED'
  }
  $output = Get-Content $out -Raw
  foreach($marker in @('AUDK_NONADMIN_SOURCE_WRITE_DENIED=PASS','AUDK_NONADMIN_PROTECTED_FILE_READ_DENIED=PASS','AUDK_NONADMIN_JOB_ROOT_WRITE_GRANTED=PASS','"identity":"dedicated-non-admin"','"processed":1','"completed":1')) {
    if(-not $output.Contains($marker)) { throw ('AUDK_CI_MISSING_RESTRICTED_PROOF '+$marker) }
  }
  & $node (Join-Path $src 'scripts\ci-verify-restricted-job.mjs') $data
  if($LASTEXITCODE -ne 0){throw 'AUDK_CI_BUILD_EVIDENCE_DENIED'}
  Write-Output 'AUDK_DISPOSABLE_NONADMIN_WINDOWS_EXECUTION=PASS'
  Write-Output 'AUDK_NO_PERSISTENT_SERVICE_OR_PUBLIC_ENDPOINT=TRUE'
} finally {
  if ($createdUser) { Remove-LocalUser -Name $username -ErrorAction SilentlyContinue }
  $passwordText = $null
  $password = $null
  # The entire runner is discarded by GitHub. Remove files best-effort as admin.
  if (Test-Path $root) { Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue }
}
