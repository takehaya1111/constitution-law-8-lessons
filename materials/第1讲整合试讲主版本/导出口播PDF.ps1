[CmdletBinding()]
param(
    [string]$RecordsPath = (Join-Path $env:TEMP 'pdfread/constitution-lesson1-proof-20261008/export-paragraphs.json')
)

# PDF只从已生成且与当前Markdown一致的实际DOCX导出；本脚本不创建另一套正文。
# 仅用新建的Word.Application，关闭自身打开的文档，不连接或关闭用户现有文档。
# Word.Application在本机映射WPS；不安装或调用LibreOffice，不改Markdown/DOCX。
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$docxFull = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '01_完整讲稿.docx'))
$sourceFull = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '01_完整讲稿.md'))
$pdfFull = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '01_完整讲稿.pdf'))
$recordsFull = [IO.Path]::GetFullPath($RecordsPath)
$pdfDirectory = [IO.Path]::GetDirectoryName($pdfFull)
$temporaryPdf = [IO.Path]::GetFullPath((Join-Path $pdfDirectory ('.01_完整讲稿-' + [Guid]::NewGuid().ToString('N') + '.pdf')))
if ([IO.Path]::GetDirectoryName($temporaryPdf) -ne $pdfDirectory) {
    throw '临时PDF路径不在指定导出目录内。'
}

$application = $null
$documents = $null
$document = $null
$failure = $null
$mayQuitApplication = $false
$docxHash = $null
$sourceHash = $null
$stage = "核输入"
$exportCompleted = $false
$cleanupNote = $null

try {
    foreach ($inputFile in @($sourceFull, $docxFull, $recordsFull)) {
        if (-not (Test-Path -LiteralPath $inputFile -PathType Leaf)) {
            throw ('缺少当前导出输入：' + $inputFile + '。请先运行Node口播文档导出器。')
        }
    }
    $records = Get-Content -LiteralPath $recordsFull -Raw -Encoding UTF8 | ConvertFrom-Json
    $docxHash = (Get-FileHash -LiteralPath $docxFull -Algorithm SHA256).Hash.ToLowerInvariant()
    $sourceHash = (Get-FileHash -LiteralPath $sourceFull -Algorithm SHA256).Hash.ToLowerInvariant()
    if ([IO.Path]::GetFullPath([string]$records.docx.path) -ne $docxFull -or [string]$records.docx.sha256 -ne $docxHash) {
        throw '逐段记录与实际Word不一致；未导出PDF。'
    }
    if ([IO.Path]::GetFullPath([string]$records.source.path) -ne $sourceFull -or [string]$records.source.sha256 -ne $sourceHash) {
        throw 'Word对应的文字源已不是当前Markdown；请重生成Word。'
    }

    $stage = "创建Word接口"
    $application = New-Object -ComObject Word.Application
    $documents = $application.Documents
    if ([int]$documents.Count -ne 0) {
        throw '新建COM对象关联到了已有文档；为保留现有会话，本次未打开或导出文档。'
    }
    $mayQuitApplication = $true
    $application.Visible = $false
    $application.DisplayAlerts = 0
    # FileName, ConfirmConversions, ReadOnly, AddToRecentFiles。
    $stage = "只读打开Word"
    $document = $documents.Open($docxFull, $false, $true, $false)
    if (-not [bool]$document.ReadOnly) {
        throw '实际Word未以只读方式打开；停止PDF导出。'
    }
    $stage = "导出PDF"
    $document.ExportAsFixedFormat($temporaryPdf, 17)
    $stage = "核导出结果"
    if (-not (Test-Path -LiteralPath $temporaryPdf -PathType Leaf)) {
        throw '文档程序没有生成PDF。'
    }
    $pdfBytes = [IO.File]::ReadAllBytes($temporaryPdf)
    if ($pdfBytes.Length -lt 100 -or [Text.Encoding]::ASCII.GetString($pdfBytes, 0, 5) -ne '%PDF-') {
        throw '导出结果不是完整可识别的PDF。'
    }
    if ((Get-FileHash -LiteralPath $docxFull -Algorithm SHA256).Hash.ToLowerInvariant() -ne $docxHash) {
        throw '导出期间Word文件发生变化；未替换PDF。'
    }
    if ((Get-FileHash -LiteralPath $sourceFull -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sourceHash) {
        throw '导出期间Markdown发生变化；未替换PDF。'
    }
    $exportCompleted = $true
}
catch {
    $failure = $_
}
finally {
    if ($null -ne $document) {
        try { $document.Close(0) } catch { if ($null -eq $failure) { $failure = $_ } }
        try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) } catch { if ($null -eq $failure) { $failure = $_ } }
        $document = $null
    }
    if ($null -ne $application -and $mayQuitApplication) {
        try {
            # 若期间出现别的文档，不关闭那些文档及其应用会话。
            if ($null -ne $documents -and [int]$documents.Count -eq 0) { $application.Quit(0) }
        }
        catch {
            $cleanupException = $_.Exception
            while ($null -ne $cleanupException.InnerException) { $cleanupException = $cleanupException.InnerException }
            # 本机WPS关闭唯一只读文档后会结束其COM服务。只有PDF已完整核验且
            # 错误确为RPC服务已不可用时，视为已关闭；其他清理错误仍报告失败。
            if ($exportCompleted -and $cleanupException.HResult -eq -2147023174) {
                $cleanupNote = 'WPS关闭只读文档后COM服务已结束，未再次强制退出应用。'
            } elseif ($null -eq $failure) { $failure = $_ }
        }
    }
    if ($null -ne $documents) {
        try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($documents) } catch { if ($null -eq $failure) { $failure = $_ } }
        $documents = $null
    }
    if ($null -ne $application) {
        try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($application) } catch { if ($null -eq $failure) { $failure = $_ } }
        $application = $null
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

if ($null -ne $failure) {
    if (Test-Path -LiteralPath $temporaryPdf -PathType Leaf) {
        Remove-Item -LiteralPath $temporaryPdf -Force
    }
    [Console]::Error.WriteLine($stage + ": " + $failure.Exception.Message + " | " + $failure.ScriptStackTrace)
    exit 1
}

try {
    # COM已关闭后再次核对；仅成功的新PDF替换原路径。
    if ((Get-FileHash -LiteralPath $docxFull -Algorithm SHA256).Hash.ToLowerInvariant() -ne $docxHash -or
        (Get-FileHash -LiteralPath $sourceFull -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sourceHash) {
        throw '替换前源稿或Word发生变化；请重新导出。'
    }
    Move-Item -LiteralPath $temporaryPdf -Destination $pdfFull -Force
    [pscustomobject]@{
        PdfPath = $pdfFull
        PdfSha256 = (Get-FileHash -LiteralPath $pdfFull -Algorithm SHA256).Hash.ToLowerInvariant()
        DocxPath = $docxFull
        DocxSha256 = $docxHash
        SourceSha256 = $sourceHash
        Format = 17
        Method = 'Word.Application Documents.Open(read-only) ExportAsFixedFormat'
        Bytes = (Get-Item -LiteralPath $pdfFull).Length
        CleanupNote = $cleanupNote
    } | ConvertTo-Json -Depth 3
}
catch {
    if (Test-Path -LiteralPath $temporaryPdf -PathType Leaf) {
        Remove-Item -LiteralPath $temporaryPdf -Force
    }
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
