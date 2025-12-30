<# 
.SYNOPSIS
    Monitors JavaScript file sizes to prevent exceeding 800-line limit
    
.DESCRIPTION
    Scans all JavaScript files in the workspace and reports:
    - Files approaching size limits (>500 lines = warning)
    - Files exceeding limits (>800 lines = critical)
    - Total line count statistics
    - Suggested refactoring candidates
    
.PARAMETER Path
    Root directory to scan (defaults to PWA workspace root)
    
.PARAMETER Threshold
    Warning threshold in lines (default: 500)
    
.PARAMETER Limit
    Critical limit in lines (default: 800)
    
.PARAMETER ShowAll
    Show all files, not just warnings/critical
    
.EXAMPLE
    .\file-size-monitor.ps1
    
.EXAMPLE
    .\file-size-monitor.ps1 -ShowAll
    
.EXAMPLE
    .\file-size-monitor.ps1 -Threshold 400 -Limit 600
    
.NOTES
    File Name   : file-size-monitor.ps1
    Author      : Vault Budget Team
    Version     : 1.0
    Last Updated: 2025-12-30
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$Path = "c:\Users\apdix\OneDrive\_Personal\App Programming\PWA",
    
    [Parameter(Mandatory=$false)]
    [int]$Threshold = 500,
    
    [Parameter(Mandatory=$false)]
    [int]$Limit = 800,
    
    [Parameter(Mandatory=$false)]
    [switch]$ShowAll
)

# Color codes for console output
$script:Colors = @{
    Normal   = 'White'
    Warning  = 'Yellow'
    Critical = 'Red'
    Success  = 'Green'
    Info     = 'Cyan'
    Header   = 'Magenta'
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = 'White',
        [switch]$NoNewline
    )
    
    if ($NoNewline) {
        Write-Host $Message -ForegroundColor $Color -NoNewline
    } else {
        Write-Host $Message -ForegroundColor $Color
    }
}

function Get-LineCount {
    param([string]$FilePath)
    
    try {
        $content = Get-Content -Path $FilePath -Raw -ErrorAction Stop
        
        # Count non-empty lines (more accurate than total lines)
        $lines = ($content -split "`r`n|`r|`n") | Where-Object { $_.Trim() -ne '' }
        
        return $lines.Count
    } catch {
        Write-ColorOutput "Error reading file: $FilePath" -Color $Colors.Critical
        return 0
    }
}

function Get-FileStatus {
    param(
        [int]$LineCount,
        [int]$Threshold,
        [int]$Limit
    )
    
    if ($LineCount -ge $Limit) {
        return @{
            Status = 'CRITICAL'
            Color  = $Colors.Critical
            Icon   = '[!]'
        }
    } elseif ($LineCount -ge $Threshold) {
        return @{
            Status = 'WARNING'
            Color  = $Colors.Warning
            Icon   = '[*]'
        }
    } else {
        return @{
            Status = 'OK'
            Color  = $Colors.Success
            Icon   = '[OK]'
        }
    }
}

function Format-FilePath {
    param(
        [string]$FullPath,
        [string]$RootPath
    )
    
    # Convert to relative path for cleaner display
    $relativePath = $FullPath.Replace($RootPath, '').TrimStart('\')
    
    return $relativePath
}

function Get-RefactoringSuggestion {
    param(
        [string]$FilePath,
        [int]$LineCount,
        [int]$Limit
    )
    
    $fileName = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
    $overage = $LineCount - $Limit
    
    # Generate suggestions based on file type
    $suggestions = @()
    
    if ($FilePath -match '\\ui\\.*-ui\.js$') {
        $suggestions += "Consider extracting render logic to separate renderer module"
        $suggestions += "Move event handlers to dedicated handler file"
        $suggestions += "Extract form validation to utility module"
    } elseif ($FilePath -match '\\core\\.*-engine\.js$') {
        $suggestions += "Split processing logic into separate strategy modules"
        $suggestions += "Extract validation to dedicated validator"
        $suggestions += "Move format handlers to individual format modules"
    } elseif ($FilePath -match 'main\.js$') {
        $suggestions += "Extract initialization logic to bootstrap module"
        $suggestions += "Move dependency injection to DI container module"
    } else {
        $suggestions += "Extract large methods to helper functions"
        $suggestions += "Move related functionality to new module"
        $suggestions += "Split class responsibilities (Single Responsibility Principle)"
    }
    
    return @{
        Overage     = $overage
        Suggestions = $suggestions
    }
}

function Show-Header {
    Write-ColorOutput "`n================================" -Color $Colors.Header
    Write-ColorOutput "  VAULT BUDGET FILE SIZE MONITOR" -Color $Colors.Header
    Write-ColorOutput "================================`n" -Color $Colors.Header
    
    Write-ColorOutput "Scan Path: " -Color $Colors.Info -NoNewline
    Write-ColorOutput "$Path" -Color $Colors.Normal
    
    Write-ColorOutput "Warning Threshold: " -Color $Colors.Info -NoNewline
    Write-ColorOutput "$Threshold lines" -Color $Colors.Warning
    
    Write-ColorOutput "Critical Limit: " -Color $Colors.Info -NoNewline
    Write-ColorOutput "$Limit lines`n" -Color $Colors.Critical
}

function Show-Summary {
    param(
        [array]$Results,
        [hashtable]$Stats
    )
    
    Write-ColorOutput "`n================================" -Color $Colors.Header
    Write-ColorOutput "  SUMMARY" -Color $Colors.Header
    Write-ColorOutput "================================`n" -Color $Colors.Header
    
    Write-ColorOutput "Total Files Scanned: " -Color $Colors.Info -NoNewline
    Write-ColorOutput "$($Stats.Total)" -Color $Colors.Normal
    
    Write-ColorOutput "Total Lines of Code: " -Color $Colors.Info -NoNewline
    Write-ColorOutput "$($Stats.TotalLines)" -Color $Colors.Normal
    
    Write-ColorOutput "Average Lines/File: " -Color $Colors.Info -NoNewline
    Write-ColorOutput "$($Stats.Average)" -Color $Colors.Normal
    
    Write-ColorOutput "`nStatus Breakdown:" -Color $Colors.Info
    Write-ColorOutput "  [OK] OK:       " -Color $Colors.Success -NoNewline
    Write-ColorOutput "$($Stats.OK) files" -Color $Colors.Normal
    
    Write-ColorOutput "  [*] WARNING:  " -Color $Colors.Warning -NoNewline
    Write-ColorOutput "$($Stats.Warning) files" -Color $Colors.Normal
    
    Write-ColorOutput "  [!] CRITICAL: " -Color $Colors.Critical -NoNewline
    Write-ColorOutput "$($Stats.Critical) files" -Color $Colors.Normal
    
    if ($Stats.Critical -gt 0) {
        Write-ColorOutput "`n[!] IMMEDIATE ACTION REQUIRED" -Color $Colors.Critical
        Write-ColorOutput "Files exceeding $Limit line limit MUST be refactored." -Color $Colors.Critical
    } elseif ($Stats.Warning -gt 0) {
        Write-ColorOutput "`n[*] ATTENTION NEEDED" -Color $Colors.Warning
        Write-ColorOutput "Files approaching $Limit line limit should be refactored soon." -Color $Colors.Warning
    } else {
        Write-ColorOutput "`n[OK] ALL FILES WITHIN LIMITS" -Color $Colors.Success
    }
}

function Show-RefactoringRecommendations {
    param([array]$CriticalFiles)
    
    if ($CriticalFiles.Count -eq 0) {
        return
    }
    
    Write-ColorOutput "`n================================" -Color $Colors.Header
    Write-ColorOutput "  REFACTORING RECOMMENDATIONS" -Color $Colors.Header
    Write-ColorOutput "================================`n" -Color $Colors.Header
    
    foreach ($file in $CriticalFiles) {
        $suggestion = Get-RefactoringSuggestion -FilePath $file.FullPath -LineCount $file.Lines -Limit $Limit
        
        Write-ColorOutput "[FILE] $($file.RelativePath)" -Color $Colors.Critical
        Write-ColorOutput "   Lines: $($file.Lines) (exceeds limit by $($suggestion.Overage) lines)" -Color $Colors.Warning
        Write-ColorOutput "   Suggestions:" -Color $Colors.Info
        
        foreach ($s in $suggestion.Suggestions) {
            Write-ColorOutput "     • $s" -Color $Colors.Normal
        }
        
        Write-ColorOutput ""
    }
}

function Show-DetailedResults {
    param(
        [array]$Results,
        [bool]$ShowAll
    )
    
    Write-ColorOutput "`n================================" -Color $Colors.Header
    Write-ColorOutput "  FILE DETAILS" -Color $Colors.Header
    Write-ColorOutput "================================`n" -Color $Colors.Header
    
    # Group by status
    $critical = $Results | Where-Object { $_.Status.Status -eq 'CRITICAL' }
    $warning  = $Results | Where-Object { $_.Status.Status -eq 'WARNING' }
    $ok       = $Results | Where-Object { $_.Status.Status -eq 'OK' }
    
    # Show critical files
    if ($critical.Count -gt 0) {
        Write-ColorOutput "[!] CRITICAL FILES (>= $Limit lines):" -Color $Colors.Critical
        foreach ($file in $critical | Sort-Object Lines -Descending) {
            Write-ColorOutput "  $($file.Status.Icon) " -Color $file.Status.Color -NoNewline
            Write-ColorOutput "$($file.Lines) lines" -Color $Colors.Normal -NoNewline
            Write-ColorOutput " - $($file.RelativePath)" -Color $Colors.Normal
        }
        Write-ColorOutput ""
    }
    
    # Show warning files
    if ($warning.Count -gt 0) {
        $warningRange = "$Threshold to $($Limit - 1)"
        Write-ColorOutput "WARNING FILES ($warningRange lines):" -Color $Colors.Warning
        foreach ($file in $warning | Sort-Object Lines -Descending) {
            Write-ColorOutput "  $($file.Status.Icon) " -Color $file.Status.Color -NoNewline
            Write-ColorOutput "$($file.Lines) lines" -Color $Colors.Normal -NoNewline
            Write-ColorOutput " - $($file.RelativePath)" -Color $Colors.Normal
        }
        Write-ColorOutput ""
    }
    
    # Show OK files (if -ShowAll flag is set)
    if ($ShowAll -and $ok.Count -gt 0) {
        Write-ColorOutput "[OK] OK FILES (< $Threshold lines):" -Color $Colors.Success
        foreach ($file in $ok | Sort-Object Lines -Descending) {
            Write-ColorOutput "  $($file.Status.Icon) " -Color $file.Status.Color -NoNewline
            Write-ColorOutput "$($file.Lines) lines" -Color $Colors.Normal -NoNewline
            Write-ColorOutput " - $($file.RelativePath)" -Color $Colors.Normal
        }
        Write-ColorOutput ""
    }
}

# MAIN EXECUTION
try {
    # Validate path
    if (-not (Test-Path -Path $Path)) {
        throw "Path not found: $Path"
    }
    
    # Show header
    Show-Header
    
    # Find all JavaScript files
    Write-ColorOutput "Scanning JavaScript files..." -Color $Colors.Info
    
    $jsFiles = Get-ChildItem -Path $Path -Filter "*.js" -Recurse -File |
        Where-Object { $_.FullName -notmatch '\\node_modules\\|\\dist\\|\\build\\|\\.git\\' }
    
    if ($jsFiles.Count -eq 0) {
        Write-ColorOutput "No JavaScript files found in: $Path" -Color $Colors.Warning
        exit 0
    }
    
    Write-ColorOutput "Found $($jsFiles.Count) JavaScript files`n" -Color $Colors.Success
    
    # Analyze each file
    $results = @()
    $stats = @{
        Total       = $jsFiles.Count
        TotalLines  = 0
        OK          = 0
        Warning     = 0
        Critical    = 0
        Average     = 0
    }
    
    foreach ($file in $jsFiles) {
        $lineCount = Get-LineCount -FilePath $file.FullName
        $status = Get-FileStatus -LineCount $lineCount -Threshold $Threshold -Limit $Limit
        
        $results += [PSCustomObject]@{
            FullPath     = $file.FullName
            RelativePath = Format-FilePath -FullPath $file.FullName -RootPath $Path
            Lines        = $lineCount
            Status       = $status
        }
        
        $stats.TotalLines += $lineCount
        
        switch ($status.Status) {
            'OK'       { $stats.OK++ }
            'WARNING'  { $stats.Warning++ }
            'CRITICAL' { $stats.Critical++ }
        }
    }
    
    $stats.Average = [math]::Round($stats.TotalLines / $stats.Total, 0)
    
    # Show results
    Show-DetailedResults -Results $results -ShowAll $ShowAll
    
    # Show refactoring recommendations for critical files
    $criticalFiles = $results | Where-Object { $_.Status.Status -eq 'CRITICAL' }
    Show-RefactoringRecommendations -CriticalFiles $criticalFiles
    
    # Show summary
    Show-Summary -Results $results -Stats $stats
    
    # Exit with appropriate code
    if ($stats.Critical -gt 0) {
        exit 1  # Critical issues found
    } elseif ($stats.Warning -gt 0) {
        exit 2  # Warnings found
    } else {
        exit 0  # All OK
    }
    
} catch {
    Write-ColorOutput "`n[ERROR] $($_.Exception.Message)" -Color $Colors.Critical
    Write-ColorOutput $_.ScriptStackTrace -Color $Colors.Warning
    exit 99
}
