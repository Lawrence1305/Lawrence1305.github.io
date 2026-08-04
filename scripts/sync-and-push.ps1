# scripts/sync-and-push.ps1
# 一键本地更新:同步考试数据 -> 有变化则提交 -> 推送到 GitHub(推送后自动触发线上部署)
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$BundledPy = 'C:\Users\91219\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$SystemPy = Get-Command python -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source

function Test-Deps([string]$py) {
    & $py -c "import pdfplumber, requests, openpyxl" 2>$null
    return $LASTEXITCODE -eq 0
}

$Py = $null
if ($SystemPy -and (Test-Deps $SystemPy)) {
    $Py = $SystemPy
} elseif ((Test-Path $BundledPy) -and (Test-Deps $BundledPy)) {
    $Py = $BundledPy
} else {
    Write-Host "未找到可用的 Python(需要 pdfplumber/requests/openpyxl)。" -ForegroundColor Red
    Write-Host "请先执行: python -m pip install -r scripts/requirements.txt" -ForegroundColor Yellow
    exit 1
}

Write-Host "== 同步考试数据 ==" -ForegroundColor Cyan
& $Py scripts\sync_exams.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "同步失败,未做任何提交。" -ForegroundColor Red
    exit 1
}

$changes = git status --porcelain -- src/data
if (-not $changes) {
    Write-Host "数据无变化,无需提交。" -ForegroundColor Green
    exit 0
}

Write-Host "== 提交并推送 ==" -ForegroundColor Cyan
git add src/data/exams.json src/data/meta.json
git commit -m "chore: update exam timetable data"
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "推送失败,先同步远程变更再重试..." -ForegroundColor Yellow
    git fetch origin main
    git merge origin/main --no-edit
    if ($LASTEXITCODE -ne 0) {
        Write-Host "合并冲突,请手动处理后再推送。" -ForegroundColor Red
        exit 1
    }
    git push origin main
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "完成:数据已更新并推送到 GitHub,线上部署会自动触发。" -ForegroundColor Green
} else {
    Write-Host "推送仍失败,请检查网络后手动执行: git push origin main" -ForegroundColor Red
    exit 1
}
