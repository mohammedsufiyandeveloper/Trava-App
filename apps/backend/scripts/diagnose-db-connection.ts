/**
 * Database Connection Diagnostics
 * Run this to check if you're hitting Neon's connection limits
 */

import prisma from "@/lib/db";

async function runDiagnostics() {
    console.log("🔍 Running Database Connection Diagnostics...\n");

    // 1. Check basic connectivity
    console.log("1️⃣ Testing basic database connection...");
    try {
        await prisma.$queryRaw`SELECT 1 as test`;
        console.log("✅ Basic connection: OK\n");
    } catch (error) {
        console.error("❌ Basic connection: FAILED");
        console.error("Error:", error);
        console.log("\n");
    }

    // 2. Check active connections
    console.log("2️⃣ Checking active database connections...");
    try {
        const result = await prisma.$queryRaw<Array<{
            total_connections: bigint;
            active_connections: bigint;
            idle_connections: bigint;
            max_connections: bigint;
        }>>`
            SELECT 
                (SELECT count(*) FROM pg_stat_activity) as total_connections,
                (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
                (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
                (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
        `;

        const stats = result[0];
        const total = Number(stats.total_connections);
        const active = Number(stats.active_connections);
        const idle = Number(stats.idle_connections);
        const max = Number(stats.max_connections);
        const usagePercent = ((total / max) * 100).toFixed(1);

        console.log(`📊 Connection Stats:`);
        console.log(`   Total connections: ${total}/${max} (${usagePercent}% used)`);
        console.log(`   Active: ${active}`);
        console.log(`   Idle: ${idle}`);

        if (total > max * 0.8) {
            console.log(`⚠️  WARNING: Using ${usagePercent}% of available connections!`);
            console.log(`   You're close to the limit. This is likely causing "Connection Closed" errors.\n`);
        } else if (total > max * 0.5) {
            console.log(`⚠️  CAUTION: Using ${usagePercent}% of available connections.\n`);
        } else {
            console.log(`✅ Connection usage is healthy.\n`);
        }
    } catch (error) {
        console.error("❌ Failed to check connections");
        console.error("Error:", error);
        console.log("\n");
    }

    // 3. Check for connection leaks
    console.log("3️⃣ Checking for connection leaks...");
    try {
        const result = await prisma.$queryRaw<Array<{
            application_name: string;
            count: bigint;
            state: string;
        }>>`
            SELECT 
                application_name,
                state,
                count(*) as count
            FROM pg_stat_activity 
            WHERE datname = current_database()
            GROUP BY application_name, state
            ORDER BY count DESC
        `;

        console.log("📊 Connections by application:");
        result.forEach(row => {
            console.log(`   ${row.application_name || 'unknown'} (${row.state}): ${row.count}`);
        });
        console.log("\n");
    } catch (error) {
        console.error("❌ Failed to check connection leaks");
        console.error("Error:", error);
        console.log("\n");
    }

    // 4. Check DATABASE_URL configuration
    console.log("4️⃣ Checking DATABASE_URL configuration...");
    const dbUrl = process.env.DATABASE_URL || "";

    console.log("📋 Current DATABASE_URL analysis:");
    console.log(`   Has pooler: ${dbUrl.includes('-pooler') ? '✅' : '❌'}`);
    console.log(`   Has pgbouncer: ${dbUrl.includes('pgbouncer=true') ? '✅' : '❌ MISSING'}`);
    console.log(`   Has connection_limit: ${dbUrl.includes('connection_limit=') ? '✅' : '❌ MISSING'}`);
    console.log(`   Has pool_timeout: ${dbUrl.includes('pool_timeout=') ? '✅' : '❌ MISSING'}`);

    if (!dbUrl.includes('pgbouncer=true') || !dbUrl.includes('connection_limit=')) {
        console.log("\n⚠️  ISSUE FOUND: Your DATABASE_URL is missing critical parameters!");
        console.log("   This is likely causing the 'Connection Closed' errors.\n");
        console.log("📝 Recommended DATABASE_URL format:");
        console.log("   postgresql://user:pass@host-pooler.region.neon.tech/db?sslmode=require&pgbouncer=true&connection_limit=10&pool_timeout=20&connect_timeout=10\n");
    } else {
        console.log("✅ DATABASE_URL configuration looks good.\n");
    }

    // 5. Test connection pool behavior
    console.log("5️⃣ Testing connection pool behavior...");
    try {
        const promises = Array.from({ length: 5 }, (_, i) =>
            prisma.$queryRaw`SELECT ${i} as test, pg_sleep(0.1)`
        );

        const start = Date.now();
        await Promise.all(promises);
        const duration = Date.now() - start;

        console.log(`✅ Concurrent queries test: OK (${duration}ms)`);
        console.log(`   5 concurrent queries completed successfully.\n`);
    } catch (error) {
        console.error("❌ Concurrent queries test: FAILED");
        console.error("Error:", error);
        console.log("   This suggests connection pool issues.\n");
    }

    // Summary
    console.log("=".repeat(60));
    console.log("📋 DIAGNOSIS SUMMARY");
    console.log("=".repeat(60));

    const hasPooler = dbUrl.includes('-pooler');
    const hasPgBouncer = dbUrl.includes('pgbouncer=true');
    const hasConnectionLimit = dbUrl.includes('connection_limit=');

    if (!hasPooler) {
        console.log("❌ CRITICAL: Not using Neon pooler endpoint");
        console.log("   Fix: Use the '-pooler' endpoint from Neon dashboard\n");
    }

    if (!hasPgBouncer || !hasConnectionLimit) {
        console.log("❌ CRITICAL: Missing connection pool parameters");
        console.log("   Fix: Add these parameters to your DATABASE_URL:");
        console.log("   - pgbouncer=true");
        console.log("   - connection_limit=10");
        console.log("   - pool_timeout=20");
        console.log("   - connect_timeout=10\n");
    }

    console.log("💡 Next Steps:");
    console.log("1. Update your .env file with the corrected DATABASE_URL");
    console.log("2. Restart your development server");
    console.log("3. Run this diagnostic again to verify the fix\n");

    console.log("=".repeat(60));
}

// Run diagnostics
runDiagnostics()
    .then(() => {
        console.log("✅ Diagnostics complete!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Diagnostics failed:", error);
        process.exit(1);
    });
