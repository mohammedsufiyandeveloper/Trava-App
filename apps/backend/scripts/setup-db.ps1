# Database Setup Script
# Run this after cloning the repository or when setting up a new database

Write-Host "🚀 Setting up database..." -ForegroundColor Cyan

# Generate Prisma Client
Write-Host "`n📦 Generating Prisma Client..." -ForegroundColor Yellow
pnpm prisma generate

# Push schema to database (if not using migrations)
Write-Host "`n🔄 Pushing schema to database..." -ForegroundColor Yellow
pnpm db:push

# Seed database with default units
Write-Host "`n🌱 Seeding database with default units (from seed-units.ts)..." -ForegroundColor Yellow
pnpm db:seed

Write-Host "`n✅ Database setup complete!" -ForegroundColor Green
Write-Host "   - Prisma Client generated" -ForegroundColor Gray
Write-Host "   - Schema pushed to database" -ForegroundColor Gray
Write-Host "   - 30 default units seeded" -ForegroundColor Gray
Write-Host "`n🎉 You're ready to go!" -ForegroundColor Cyan
