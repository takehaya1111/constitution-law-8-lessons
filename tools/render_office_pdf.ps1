param(
    [Parameter(Mandatory=$true)][string]$InputPath,
    [Parameter(Mandatory=$true)][string]$OutputPath
)

# 使用本机 Office 兼容 COM 只读打开并导出；关闭本次文档，不退出应用或结束任何进程。
# 本轮实际实现为 WPS 12.1.0.28505。COM 的 Name/Version 可能返回 Microsoft/12.0，
# 因此同时记录真实应用 Path 与导出 PDF 的 Creator，不以注册名认定微软 Office。
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$source = (Resolve-Path -LiteralPath $InputPath).Path
$destination = [System.IO.Path]::GetFullPath($OutputPath)
$parent = Split-Path -Parent $destination
if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
}
$application = $null
$document = $null
$kind = [System.IO.Path]::GetExtension($source).ToLowerInvariant()
try {
    if ($kind -eq '.docx') {
        $application = New-Object -ComObject Word.Application
        # 不修改应用级可见性、提示或用户选项；打开的文档本身为只读、不可见。
        $document = $application.Documents.Open($source, $false, $true, $false,
            [Type]::Missing, [Type]::Missing, [Type]::Missing, [Type]::Missing,
            [Type]::Missing, [Type]::Missing, [Type]::Missing, $false)
        $document.Repaginate()
        $document.ExportAsFixedFormat($destination, 17)
        $pages = $document.ComputeStatistics(2)
    } elseif ($kind -eq '.pptx' -or $kind -eq '.ppt') {
        $application = New-Object -ComObject PowerPoint.Application
        $document = $application.Presentations.Open($source, -1, 0, 0)
        $document.SaveAs($destination, 32)
        $pages = $document.Slides.Count
    } else {
        throw "仅支持 .docx、.pptx、.ppt：$source"
    }
    if (-not (Test-Path -LiteralPath $destination) -or
        (Get-Item -LiteralPath $destination).Length -eq 0) {
        throw "COM 未生成非空 PDF：$destination"
    }
    [PSCustomObject]@{
        input = $source
        output = $destination
        pages = $pages
        applicationPath = $application.Path
        reportedVersion = $application.Version
        bytes = (Get-Item -LiteralPath $destination).Length
    } | ConvertTo-Json -Compress
} finally {
    if ($document) {
        try {
            if ($kind -eq '.docx') { $document.Close(0) }
            else { $document.Close() }
        } catch { Write-Warning "本次文档关闭提示：$($_.Exception.Message)" }
        try { [Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) | Out-Null }
        catch {}
    }
    if ($application) {
        try { [Runtime.InteropServices.Marshal]::FinalReleaseComObject($application) | Out-Null }
        catch {}
    }
}
