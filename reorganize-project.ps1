#!/usr/bin/env pwsh
# VendAI POS - Automated Project Reorganization Script
# Run with: .\reorganize-project.ps1

param(
    [switch]$DryRun = $false,
    [switch]$BackupFirst = $true,
    [string]$Phase = "all"  # all, docs, scripts, config
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 VendAI POS Project Reorganization Script" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Define project root
$projectRoot = $PSScriptRoot
if ($projectRoot -eq "") {
    $projectRoot = Get-Location
}

Write-Host "📁 Project Root: $projectRoot" -ForegroundColor Yellow

# Backup function
function Backup-Project {
    Write-Host "`n📦 Creating backup branch..." -ForegroundColor Cyan
    
    if (-not $DryRun) {
        git checkout -b reorganization-backup-$(Get-Date -Format "yyyyMMdd-HHmmss")
        git add -A
        git commit -m "Backup before reorganization - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        Write-Host "✅ Backup created successfully" -ForegroundColor Green
    } else {
        Write-Host "🔍 DRY RUN: Would create backup branch" -ForegroundColor Yellow
    }
}

# Create directory function
function New-DirectorySafe {
    param([string]$Path)
    
    $fullPath = Join-Path $projectRoot $Path
    
    if (-not (Test-Path $fullPath)) {
        if (-not $DryRun) {
            New-Item -ItemType Directory -Force -Path $fullPath | Out-Null
            Write-Host "  ✅ Created: $Path" -ForegroundColor Green
        } else {
            Write-Host "  🔍 Would create: $Path" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⏭️  Exists: $Path" -ForegroundColor Gray
    }
}

# Move file function
function Move-FileSafe {
    param(
        [string]$Source,
        [string]$Destination
    )
    
    $sourcePath = Join-Path $projectRoot $Source
    $destPath = Join-Path $projectRoot $Destination
    
    if (Test-Path $sourcePath) {
        if (-not $DryRun) {
            Move-Item -Path $sourcePath -Destination $destPath -Force
            Write-Host "  ✅ Moved: $Source → $Destination" -ForegroundColor Green
        } else {
            Write-Host "  🔍 Would move: $Source → $Destination" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠️  Not found: $Source" -ForegroundColor DarkYellow
    }
}

# Phase 1: Documentation Reorganization
function Reorganize-Documentation {
    Write-Host "`n📚 Phase 1: Reorganizing Documentation..." -ForegroundColor Cyan
    
    # Create directory structure
    Write-Host "`nCreating directory structure..." -ForegroundColor White
    New-DirectorySafe "docs/architecture"
    New-DirectorySafe "docs/guides/user"
    New-DirectorySafe "docs/guides/developer"
    New-DirectorySafe "docs/guides/setup"
    New-DirectorySafe "docs/implementation/features"
    New-DirectorySafe "docs/implementation/modules"
    New-DirectorySafe "docs/implementation/updates"
    New-DirectorySafe "docs/api/endpoints"
    New-DirectorySafe "docs/api/webhooks"
    New-DirectorySafe "docs/operations"
    New-DirectorySafe "docs/security"
    New-DirectorySafe "docs/planning"
    New-DirectorySafe "docs/troubleshooting"
    New-DirectorySafe "docs/assets/screenshots"
    New-DirectorySafe "docs/legacy"
    
    # Move architecture docs
    Write-Host "`nMoving architecture documents..." -ForegroundColor White
    Move-FileSafe "FIREBASE_ARCHITECTURE_OPTIMIZATION.md" "docs/architecture/"
    Move-FileSafe "ORGANIZATION-AND-DISTRIBUTOR-STRUCTURE.md" "docs/architecture/"
    
    # Move guide docs
    Write-Host "`nMoving guide documents..." -ForegroundColor White
    Move-FileSafe "GO-LIVE-GUIDE.md" "docs/guides/user/"
    Move-FileSafe "QUICK-TEST.md" "docs/guides/developer/"
    Move-FileSafe "BUILD.md" "docs/guides/developer/"
    Move-FileSafe "VERCEL-DEPLOYMENT-GUIDE.md" "docs/guides/developer/"
    Move-FileSafe "GOOGLE-OAUTH-SETUP.md" "docs/guides/setup/"
    Move-FileSafe "FIREBASE_SERVICE_ACCOUNT_SETUP.md" "docs/guides/setup/"
    Move-FileSafe "AUTHENTICATION-QUICK-FIX.md" "docs/guides/setup/"
    
    # Move implementation docs
    Write-Host "`nMoving implementation documents..." -ForegroundColor White
    Move-FileSafe "AUTO_REPLENISHMENT_COMPLETE.md" "docs/implementation/features/"
    Move-FileSafe "REPLENISHMENT_INTEGRATION_GUIDE.md" "docs/implementation/features/"
    Move-FileSafe "REPLENISHMENT_STATUS.md" "docs/implementation/features/"
    Move-FileSafe "ENHANCED_SALES_TAB_COMPLETE.md" "docs/implementation/features/"
    Move-FileSafe "WEBHOOK_SYSTEM_COMPLETE.md" "docs/implementation/features/"
    Move-FileSafe "RECEIVING_FLOW_COMPLETE.md" "docs/implementation/features/"
    Move-FileSafe "TWO_WAY_SYNC_SUMMARY.md" "docs/implementation/features/"
    Move-FileSafe "SUPPLIER-MODULE-COMPLETE.md" "docs/implementation/features/"
    Move-FileSafe "SUPPLIER-MODULE-FINAL-UPDATE.md" "docs/implementation/updates/"
    Move-FileSafe "SUPPLIER-CONNECTION-UPDATE.md" "docs/implementation/updates/"
    Move-FileSafe "SUPPLIER-MODULE-ENHANCEMENTS.md" "docs/implementation/modules/"
    Move-FileSafe "FIXES_SUMMARY_2025-10-04.md" "docs/implementation/updates/"
    Move-FileSafe "POS-MODULE-TODO.md" "docs/implementation/modules/"
    
    # Move operations docs
    Write-Host "`nMoving operations documents..." -ForegroundColor White
    Move-FileSafe "PRODUCTION-CHECKLIST.md" "docs/operations/"
    Move-FileSafe "PRODUCTION-READINESS-REPORT.md" "docs/operations/"
    Move-FileSafe "DEPLOYMENT-SUMMARY.md" "docs/operations/"
    Move-FileSafe "RELEASE.md" "docs/operations/"
    Move-FileSafe "RELEASE-SYSTEM.md" "docs/operations/"
    Move-FileSafe "FIREBASE_OPTIMIZATION_STATUS.md" "docs/operations/"
    
    # Move security docs
    Write-Host "`nMoving security documents..." -ForegroundColor White
    Move-FileSafe "SECRET-LEAK-RESOLVED.md" "docs/security/"
    Move-FileSafe "AUTHENTICATION-FIX-SUMMARY.md" "docs/security/"
    Move-FileSafe "AUTH-FIX-ACTIONS.md" "docs/security/"
    Move-FileSafe "AUTH-FIX-QUICKSTART.md" "docs/security/"
    
    # Move planning docs
    Move-FileSafe "AI_IMAGE_GENERATION_TODO.md" "docs/planning/"
    Move-FileSafe "DISTRIBUTOR-IMAGE-GENERATION.md" "docs/planning/"
    Move-FileSafe "VENDAI-DIGITAL-PROMPT.md" "docs/planning/"
    
    # Move troubleshooting docs
    Write-Host "`nMoving troubleshooting documents..." -ForegroundColor White
    Move-FileSafe "VERCEL-AUTH-DEBUG.md" "docs/troubleshooting/"
    Move-FileSafe "MANUAL_WEBHOOK_INDEXES.md" "docs/troubleshooting/"
    Move-FileSafe "WEBHOOK_INDEXES_DEPLOYED.md" "docs/troubleshooting/"
    Move-FileSafe "RECEIVING_FLOW_DIAGRAM.md" "docs/troubleshooting/"
    
    # Move legacy docs
    Write-Host "`nMoving legacy documents..." -ForegroundColor White
    Move-FileSafe "DOWNLOAD-SYSTEM-SIMPLE.md" "docs/legacy/"
    Move-FileSafe "website-download-template.html" "docs/legacy/"
    Move-FileSafe "website-homepage-windows-only.tsx" "docs/legacy/"
    Move-FileSafe "website-integration.html" "docs/legacy/"
    
    # Move screenshots
    Write-Host "`nMoving screenshots..." -ForegroundColor White
    if (Test-Path (Join-Path $projectRoot "odoo screenshots")) {
        if (-not $DryRun) {
            Move-Item -Path (Join-Path $projectRoot "odoo screenshots") -Destination (Join-Path $projectRoot "docs/assets/screenshots/odoo") -Force
            Write-Host "  ✅ Moved: odoo screenshots → docs/assets/screenshots/odoo" -ForegroundColor Green
        } else {
            Write-Host "  🔍 Would move: odoo screenshots → docs/assets/screenshots/odoo" -ForegroundColor Yellow
        }
    }
    
    Write-Host "`n✅ Documentation reorganization complete!" -ForegroundColor Green
}

# Phase 2: Scripts Reorganization
function Reorganize-Scripts {
    Write-Host "`n🔧 Phase 2: Reorganizing Scripts..." -ForegroundColor Cyan
    
    # Create directory structure
    Write-Host "`nCreating directory structure..." -ForegroundColor White
    New-DirectorySafe "scripts/dev"
    New-DirectorySafe "scripts/build"
    New-DirectorySafe "scripts/deploy"
    New-DirectorySafe "scripts/database"
    New-DirectorySafe "scripts/generators"
    New-DirectorySafe "scripts/testing"
    
    # Move dev scripts
    Write-Host "`nMoving development scripts..." -ForegroundColor White
    Move-FileSafe "test-openai.js" "scripts/dev/"
    Move-FileSafe "test-auth-simple.html" "scripts/dev/"
    Move-FileSafe "test-build.bat" "scripts/dev/"
    Move-FileSafe "test-receiving-flow.ps1" "scripts/dev/"
    
    # Move build scripts
    Write-Host "`nMoving build scripts..." -ForegroundColor White
    Move-FileSafe "simple-run.bat" "scripts/build/"
    
    # Move deploy scripts
    Write-Host "`nMoving deployment scripts..." -ForegroundColor White
    Move-FileSafe "scripts/deploy-replenishment-indexes.js" "scripts/deploy/"
    Move-FileSafe "scripts/deploy-indexes-admin-sdk.js" "scripts/deploy/"
    
    # Move generator scripts
    Write-Host "`nMoving generator scripts..." -ForegroundColor White
    Move-FileSafe "generate-products.bat" "scripts/generators/"
    Move-FileSafe "generate-products.ps1" "scripts/generators/"
    Move-FileSafe "generate-distributor-images.bat" "scripts/generators/"
    Move-FileSafe "generate-distributor-images.ps1" "scripts/generators/"
    Move-FileSafe "run-generator.bat" "scripts/generators/"
    Move-FileSafe "run-generator.ps1" "scripts/generators/"
    
    Write-Host "`n✅ Scripts reorganization complete!" -ForegroundColor Green
}

# Phase 3: Config Files
function Reorganize-Config {
    Write-Host "`n⚙️  Phase 3: Reorganizing Configuration Files..." -ForegroundColor Cyan
    Write-Host "⚠️  NOTE: Config reorganization requires updating references in code!" -ForegroundColor Yellow
    Write-Host "This phase will COPY files first, then you can update references." -ForegroundColor Yellow
    
    # Create directory structure
    Write-Host "`nCreating directory structure..." -ForegroundColor White
    New-DirectorySafe "config/firebase"
    New-DirectorySafe "config/env"
    New-DirectorySafe "config/build"
    New-DirectorySafe "config/typescript"
    
    # Copy (not move) config files for safety
    Write-Host "`nCopying configuration files..." -ForegroundColor White
    
    if (-not $DryRun) {
        Copy-Item -Path "firebase.json" -Destination "config/firebase/" -Force -ErrorAction SilentlyContinue
        Copy-Item -Path "firestore.rules" -Destination "config/firebase/" -Force -ErrorAction SilentlyContinue
        Copy-Item -Path "firestore-optimized.rules" -Destination "config/firebase/" -Force -ErrorAction SilentlyContinue
        Copy-Item -Path "firestore.indexes.json" -Destination "config/firebase/" -Force -ErrorAction SilentlyContinue
        Copy-Item -Path "storage.rules" -Destination "config/firebase/" -Force -ErrorAction SilentlyContinue
        Copy-Item -Path ".firebaserc" -Destination "config/firebase/" -Force -ErrorAction SilentlyContinue
        
        Copy-Item -Path ".env.example" -Destination "config/env/" -Force -ErrorAction SilentlyContinue
        Copy-Item -Path ".env.template" -Destination "config/env/" -Force -ErrorAction SilentlyContinue
        Copy-Item -Path ".env.vercel.template" -Destination "config/env/" -Force -ErrorAction SilentlyContinue
        
        Copy-Item -Path "electron-builder.json" -Destination "config/build/" -Force -ErrorAction SilentlyContinue
        Copy-Item -Path "vercel.json" -Destination "config/build/" -Force -ErrorAction SilentlyContinue
        Copy-Item -Path "components.json" -Destination "config/build/" -Force -ErrorAction SilentlyContinue
        
        Copy-Item -Path "tsconfig.json" -Destination "config/typescript/" -Force -ErrorAction SilentlyContinue
        
        Write-Host "  ✅ Config files copied (originals kept at root for now)" -ForegroundColor Green
    } else {
        Write-Host "  🔍 Would copy config files to config/ directory" -ForegroundColor Yellow
    }
    
    Write-Host "`n⚠️  MANUAL STEPS REQUIRED:" -ForegroundColor Yellow
    Write-Host "  1. Update package.json script paths" -ForegroundColor White
    Write-Host "  2. Update next.config.mjs references" -ForegroundColor White
    Write-Host "  3. Update GitHub Actions workflows" -ForegroundColor White
    Write-Host "  4. Test build and deploy" -ForegroundColor White
    Write-Host "  5. After testing, remove originals from root" -ForegroundColor White
    
    Write-Host "`n✅ Config reorganization (copy phase) complete!" -ForegroundColor Green
}

# Main execution
try {
    if ($BackupFirst) {
        Backup-Project
    }
    
    if ($Phase -eq "all" -or $Phase -eq "docs") {
        Reorganize-Documentation
    }
    
    if ($Phase -eq "all" -or $Phase -eq "scripts") {
        Reorganize-Scripts
    }
    
    if ($Phase -eq "all" -or $Phase -eq "config") {
        Reorganize-Config
    }
    
    Write-Host "`n🎉 Project Reorganization Complete!" -ForegroundColor Green
    Write-Host "=" * 60 -ForegroundColor Cyan
    
    if (-not $DryRun) {
        Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
        Write-Host "  1. Review changes: git status" -ForegroundColor White
        Write-Host "  2. Update README.md with new structure" -ForegroundColor White
        Write-Host "  3. Test build: npm run build" -ForegroundColor White
        Write-Host "  4. Test dev: npm run dev" -ForegroundColor White
        Write-Host "  5. Commit: git add -A && git commit -m 'Reorganize project structure'" -ForegroundColor White
    } else {
        Write-Host "`n🔍 Dry run complete. Run without -DryRun to apply changes." -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "`n❌ Error occurred: $_" -ForegroundColor Red
    Write-Host "Stack Trace: $($_.ScriptStackTrace)" -ForegroundColor Red
    exit 1
}
