<#
.SYNOPSIS
    Generates visual dependency graphs for Vault Budget JavaScript modules
    
.DESCRIPTION
    Analyzes ES6 import statements and generates:
    - Mermaid flowchart showing module dependencies
    - Dependency matrix (who imports what)
    - Circular dependency detection
    - Module layer classification
    - Refactoring impact analysis
    
.PARAMETER Path
    Root directory to scan (defaults to PWA workspace root)
    
.PARAMETER OutputFormat
    Output format: Mermaid (default), JSON, Text
    
.PARAMETER OutputFile
    File to save output (if not specified, outputs to console)
    
.PARAMETER CheckCircular
    Only check for circular dependencies (faster)
    
.EXAMPLE
    .\dependency-graph.ps1
    
.EXAMPLE
    .\dependency-graph.ps1 -OutputFile "docs\dependencies.md"
    
.EXAMPLE
    .\dependency-graph.ps1 -CheckCircular
    
.EXAMPLE
    .\dependency-graph.ps1 -OutputFormat JSON -OutputFile "deps.json"
    
.NOTES
    File Name   : dependency-graph.ps1
    Author      : Vault Budget Team
    Version     : 1.0
    Last Updated: 2025-12-30
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$Path = "c:\Users\apdix\OneDrive\_Personal\App Programming\PWA",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('Mermaid', 'JSON', 'Text')]
    [string]$OutputFormat = 'Mermaid',
    
    [Parameter(Mandatory=$false)]
    [string]$OutputFile = '',
    
    [Parameter(Mandatory=$false)]
    [switch]$CheckCircular
)

# Module layer classification based on architecture
$script:LayerDefinitions = @{
    0 = @{ Name = 'CDN'; Color = '#E8F4F8'; Description = 'External libraries (Dexie, PapaParse, Lucide)' }
    1 = @{ Name = 'Core Security'; Color = '#FFF4E6'; Description = 'Security manager (Web Crypto API)' }
    2 = @{ Name = 'Core Database'; Color = '#FFE6E6'; Description = 'Database manager (Dexie wrapper)' }
    3 = @{ Name = 'Core Services'; Color = '#E6F7FF'; Description = 'CSV, validation, helpers' }
    4 = @{ Name = 'Templates'; Color = '#F0F5FF'; Description = 'Reusable templates' }
    5 = @{ Name = 'UI Components'; Color = '#F6FFED'; Description = 'UI modules' }
    6 = @{ Name = 'Entry Point'; Color = '#FFF1F0'; Description = 'main.js' }
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = 'White'
    )
    Write-Host $Message -ForegroundColor $Color
}

function Get-ModuleLayer {
    param([string]$FilePath)
    
    $relativePath = $FilePath.Replace($Path, '').TrimStart('\')
    
    # Classify based on file location and name
    if ($relativePath -match '^main\.js$') {
        return 6
    } elseif ($relativePath -match '^js\\ui\\') {
        return 5
    } elseif ($relativePath -match '^js\\templates\\') {
        return 4
    } elseif ($relativePath -match '^js\\core\\(csv-|ui-helpers|transaction-preloader)') {
        return 3
    } elseif ($relativePath -match '^js\\core\\database\.js$') {
        return 2
    } elseif ($relativePath -match '^js\\core\\security\.js$') {
        return 1
    } else {
        return 3  # Default to core services
    }
}

function Get-ModuleName {
    param([string]$FilePath)
    
    $relativePath = $FilePath.Replace($Path, '').TrimStart('\')
    $name = $relativePath -replace '\\', '/' -replace '\.js$', ''
    
    return $name
}

function Get-ImportStatements {
    param([string]$FilePath)
    
    try {
        $content = Get-Content -Path $FilePath -Raw -ErrorAction Stop
        
        # Match ES6 import statements
        # Patterns: import { ... } from '...'; import * as ... from '...';
        $importPattern = "import\s+(?:(?:\{[^}]+\}|\*\s+as\s+\w+)\s+from\s+)?['""]([^'""]+)['""]"
        
        $matches = [regex]::Matches($content, $importPattern)
        
        $imports = @()
        foreach ($match in $matches) {
            $importPath = $match.Groups[1].Value
            
            # Convert relative import to absolute file path
            if ($importPath -match '^\./|^\.\.\/') {
                $currentDir = Split-Path -Path $FilePath -Parent
                $resolvedPath = Join-Path -Path $currentDir -ChildPath $importPath
                
                # Add .js extension if missing
                if (-not ($resolvedPath -match '\.js$')) {
                    $resolvedPath += '.js'
                }
                
                # Normalize path
                $resolvedPath = [System.IO.Path]::GetFullPath($resolvedPath)
                
                if (Test-Path -Path $resolvedPath) {
                    $imports += $resolvedPath
                }
            }
        }
        
        return $imports
    } catch {
        Write-ColorOutput "Error parsing imports in: $FilePath" -Color 'Red'
        return @()
    }
}

function Build-DependencyGraph {
    param([string]$RootPath)
    
    Write-ColorOutput "`nScanning JavaScript modules..." -Color 'Cyan'
    
    # Find all JS files
    $jsFiles = Get-ChildItem -Path $RootPath -Filter "*.js" -Recurse -File |
        Where-Object { $_.FullName -notmatch '\\node_modules\\|\\dist\\|\\build\\|\\.git\\' }
    
    Write-ColorOutput "Found $($jsFiles.Count) modules`n" -Color 'Green'
    
    # Build dependency map
    $dependencies = @{}
    
    foreach ($file in $jsFiles) {
        $moduleName = Get-ModuleName -FilePath $file.FullName
        $layer = Get-ModuleLayer -FilePath $file.FullName
        $imports = Get-ImportStatements -FilePath $file.FullName
        
        $dependencies[$moduleName] = @{
            FullPath    = $file.FullName
            Layer       = $layer
            Imports     = @()
            ImportedBy  = @()
        }
        
        foreach ($import in $imports) {
            $importedModuleName = Get-ModuleName -FilePath $import
            $dependencies[$moduleName].Imports += $importedModuleName
        }
    }
    
    # Calculate reverse dependencies (who imports this module)
    foreach ($module in $dependencies.Keys) {
        foreach ($import in $dependencies[$module].Imports) {
            if ($dependencies.ContainsKey($import)) {
                $dependencies[$import].ImportedBy += $module
            }
        }
    }
    
    return $dependencies
}

function Find-CircularDependencies {
    param([hashtable]$Dependencies)
    
    Write-ColorOutput "`nChecking for circular dependencies..." -Color 'Cyan'
    
    $circular = @()
    
    function Test-CircularPath {
        param(
            [string]$Start,
            [string]$Current,
            [array]$Path
        )
        
        if ($Path -contains $Current) {
            if ($Current -eq $Start) {
                return $Path + $Current
            }
            return $null
        }
        
        $newPath = $Path + $Current
        
        if (-not $Dependencies.ContainsKey($Current)) {
            return $null
        }
        
        foreach ($import in $Dependencies[$Current].Imports) {
            $result = Test-CircularPath -Start $Start -Current $import -Path $newPath
            if ($result) {
                return $result
            }
        }
        
        return $null
    }
    
    foreach ($module in $Dependencies.Keys) {
        $cycle = Test-CircularPath -Start $module -Current $module -Path @()
        if ($cycle) {
            $cycleStr = ($cycle -join ' -> ')
            if ($circular -notcontains $cycleStr) {
                $circular += $cycleStr
            }
        }
    }
    
    if ($circular.Count -eq 0) {
        Write-ColorOutput "[OK] No circular dependencies found" -Color 'Green'
    } else {
        Write-ColorOutput "[WARNING] Found $($circular.Count) circular dependency chain(s):" -Color 'Yellow'
        foreach ($cycle in $circular) {
            Write-ColorOutput "  $cycle" -Color 'Red'
        }
    }
    
    return $circular
}

function Generate-MermaidGraph {
    param([hashtable]$Dependencies)
    
    $output = @()
    
    $output += "# Vault Budget Module Dependencies"
    $output += ""
    $output += "**Generated:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $output += ""
    $output += "## Dependency Graph"
    $output += ""
    $output += '```mermaid'
    $output += 'graph TD'
    $output += ''
    
    # Define node styles based on layer
    foreach ($layerNum in $LayerDefinitions.Keys | Sort-Object) {
        $layer = $LayerDefinitions[$layerNum]
        $output += "    classDef layer$layerNum fill:$($layer.Color),stroke:#333,stroke-width:2px"
    }
    $output += ''
    
    # Add nodes grouped by layer
    foreach ($layerNum in $LayerDefinitions.Keys | Sort-Object) {
        $layer = $LayerDefinitions[$layerNum]
        $modulesInLayer = $Dependencies.Keys | Where-Object { $Dependencies[$_].Layer -eq $layerNum }
        
        if ($modulesInLayer.Count -gt 0) {
            $layerName = $layer.Name
            $output += "    %% Layer $layerNum - $layerName"
            foreach ($module in $modulesInLayer | Sort-Object) {
                $nodeId = ($module -replace '[/\-\.]', '_')
                $displayName = Split-Path -Path $module -Leaf
                $output += "    $nodeId[`"$displayName`"]:::layer$layerNum"
            }
            $output += ''
        }
    }
    
    # Add edges (dependencies)
    $output += '    %% Dependencies'
    foreach ($module in $Dependencies.Keys | Sort-Object) {
        $fromId = ($module -replace '[/\-\.]', '_')
        
        foreach ($import in $Dependencies[$module].Imports | Sort-Object) {
            $toId = ($import -replace '[/\-\.]', '_')
            $output += "    $fromId --> $toId"
        }
    }
    
    $output += '```'
    $output += ''
    
    # Add legend
    $output += '## Layer Legend'
    $output += ''
    foreach ($layerNum in $LayerDefinitions.Keys | Sort-Object) {
        $layer = $LayerDefinitions[$layerNum]
        $output += "- **Layer $layerNum - $($layer.Name)** - $($layer.Description)"
    }
    $output += ''
    
    # Add module details
    $output += '## Module Details'
    $output += ''
    
    foreach ($layerNum in $LayerDefinitions.Keys | Sort-Object) {
        $layer = $LayerDefinitions[$layerNum]
        $modulesInLayer = $Dependencies.Keys | Where-Object { $Dependencies[$_].Layer -eq $layerNum } | Sort-Object
        
        if ($modulesInLayer.Count -gt 0) {
            $output += "### Layer $layerNum - $($layer.Name)"
            $output += ''
            
            foreach ($module in $modulesInLayer) {
                $output += "#### $module"
                
                if ($Dependencies[$module].Imports.Count -gt 0) {
                    $output += "**Imports:**"
                    foreach ($import in $Dependencies[$module].Imports | Sort-Object) {
                        $output += "- $import"
                    }
                } else {
                    $output += "**Imports:** None (leaf module)"
                }
                
                if ($Dependencies[$module].ImportedBy.Count -gt 0) {
                    $output += ""
                    $output += "**Imported by:**"
                    foreach ($importer in $Dependencies[$module].ImportedBy | Sort-Object) {
                        $output += "- $importer"
                    }
                } else {
                    $output += ""
                    $output += "**Imported by:** None (unused or entry point)"
                }
                
                $output += ''
            }
        }
    }
    
    return $output -join "`n"
}

function Generate-JSONOutput {
    param([hashtable]$Dependencies)
    
    $json = @{
        generated = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
        layers    = $LayerDefinitions
        modules   = @{}
    }
    
    foreach ($module in $Dependencies.Keys) {
        $json.modules[$module] = @{
            layer      = $Dependencies[$module].Layer
            imports    = $Dependencies[$module].Imports
            importedBy = $Dependencies[$module].ImportedBy
        }
    }
    
    return ($json | ConvertTo-Json -Depth 10)
}

function Generate-TextOutput {
    param([hashtable]$Dependencies)
    
    $output = @()
    
    $output += "VAULT BUDGET MODULE DEPENDENCIES"
    $output += "=" * 60
    $output += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $output += ""
    
    foreach ($layerNum in $LayerDefinitions.Keys | Sort-Object) {
        $layer = $LayerDefinitions[$layerNum]
        $modulesInLayer = $Dependencies.Keys | Where-Object { $Dependencies[$_].Layer -eq $layerNum } | Sort-Object
        
        if ($modulesInLayer.Count -gt 0) {
            $output += "LAYER $layerNum - $($layer.Name)"
            $output += "-" * 60
            
            foreach ($module in $modulesInLayer) {
                $output += "  $module"
                
                if ($Dependencies[$module].Imports.Count -gt 0) {
                    $output += "    Imports:"
                    foreach ($import in $Dependencies[$module].Imports | Sort-Object) {
                        $output += "      - $import"
                    }
                }
                
                if ($Dependencies[$module].ImportedBy.Count -gt 0) {
                    $output += "    Imported by:"
                    foreach ($importer in $Dependencies[$module].ImportedBy | Sort-Object) {
                        $output += "      - $importer"
                    }
                }
                
                $output += ""
            }
        }
    }
    
    return $output -join "`n"
}

function Show-ImpactAnalysis {
    param([hashtable]$Dependencies)
    
    Write-ColorOutput "`n================================" -Color 'Magenta'
    Write-ColorOutput "  REFACTORING IMPACT ANALYSIS" -Color 'Magenta'
    Write-ColorOutput "================================`n" -Color 'Magenta'
    
    # Find hub modules (high number of importers)
    $hubs = $Dependencies.Keys | ForEach-Object {
        [PSCustomObject]@{
            Module     = $_
            ImportedBy = $Dependencies[$_].ImportedBy.Count
        }
    } | Where-Object { $_.ImportedBy -gt 0 } | Sort-Object ImportedBy -Descending | Select-Object -First 5
    
    Write-ColorOutput "Top 5 Hub Modules (most dependents):" -Color 'Cyan'
    foreach ($hub in $hubs) {
        $risk = if ($hub.ImportedBy -ge 10) { 'HIGH' } elseif ($hub.ImportedBy -ge 5) { 'MEDIUM' } else { 'LOW' }
        $color = if ($risk -eq 'HIGH') { 'Red' } elseif ($risk -eq 'MEDIUM') { 'Yellow' } else { 'Green' }
        
        Write-Host "  " -NoNewline
        Write-Host "$($hub.Module)" -ForegroundColor White -NoNewline
        Write-Host " - " -NoNewline
        Write-Host "$($hub.ImportedBy) dependents" -ForegroundColor $color -NoNewline
        Write-Host " (Risk: $risk)" -ForegroundColor $color
    }
    
    Write-ColorOutput "`nSafe to Modify (leaf modules, 0 dependents):" -Color 'Cyan'
    $leaves = $Dependencies.Keys | Where-Object { $Dependencies[$_].ImportedBy.Count -eq 0 } | Sort-Object
    foreach ($leaf in $leaves) {
        Write-ColorOutput "  [OK] $leaf" -Color 'Green'
    }
}

# MAIN EXECUTION
try {
    Write-ColorOutput "`n================================" -Color 'Magenta'
    Write-ColorOutput "  DEPENDENCY GRAPH GENERATOR" -Color 'Magenta'
    Write-ColorOutput "================================`n" -Color 'Magenta'
    
    # Build dependency graph
    $dependencies = Build-DependencyGraph -RootPath $Path
    
    # Check for circular dependencies
    $circular = Find-CircularDependencies -Dependencies $dependencies
    
    if ($CheckCircular) {
        # Only check for circular deps, don't generate full output
        if ($circular.Count -gt 0) {
            exit 1
        } else {
            exit 0
        }
    }
    
    # Show impact analysis
    Show-ImpactAnalysis -Dependencies $dependencies
    
    # Generate output based on format
    Write-ColorOutput "`nGenerating $OutputFormat output..." -Color 'Cyan'
    
    $output = switch ($OutputFormat) {
        'Mermaid' { Generate-MermaidGraph -Dependencies $dependencies }
        'JSON'    { Generate-JSONOutput -Dependencies $dependencies }
        'Text'    { Generate-TextOutput -Dependencies $dependencies }
    }
    
    # Output to file or console
    if ($OutputFile) {
        $output | Out-File -FilePath $OutputFile -Encoding UTF8
        Write-ColorOutput "`n[OK] Output saved to: $OutputFile" -Color 'Green'
    } else {
        Write-ColorOutput "`n$output" -Color 'White'
    }
    
    Write-ColorOutput "`n[OK] Dependency analysis complete" -Color 'Green'
    
    # Exit with appropriate code
    if ($circular.Count -gt 0) {
        exit 1  # Circular dependencies found
    } else {
        exit 0  # All OK
    }
    
} catch {
    Write-ColorOutput "`n[ERROR] $($_.Exception.Message)" -Color 'Red'
    Write-ColorOutput $_.ScriptStackTrace -Color 'Yellow'
    exit 99
}
