/**
 * ================================================
 * RBAC SYSTEM - QUICK DEPLOYMENT SCRIPT
 * ================================================
 * Run this to automatically set up RBAC system
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function deployRBAC() {
    console.log('🚀 Starting RBAC System Deployment...\n');

    try {
        // Create database connection
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'if0_40748168_almarakish_db',
            multipleStatements: true
        });

        console.log('✅ Connected to database\n');

        // Step 1: Run RBAC migration
        console.log('📊 Step 1: Running RBAC migration...');
        const migrationSQL = await fs.readFile(
            path.join(__dirname, 'migrations', 'rbac_system.sql'),
            'utf8'
        );

        await connection.query(migrationSQL);
        console.log('✅ RBAC tables and permissions created\n');

        // Step 2: Run setup script
        console.log('🔧 Step 2: Running setup script...');
        const setupSQL = await fs.readFile(
            path.join(__dirname, 'RBAC_SETUP.sql'),
            'utf8'
        );

        const [results] = await connection.query(setupSQL);
        console.log('✅ Owner account upgraded\n');

        // Step 3: Verify installation
        console.log('🔍 Step 3: Verifying installation...\n');

        const [permissions] = await connection.query('SELECT COUNT(*) as count FROM permissions');
        console.log(`   📌 Permissions: ${permissions[0].count}`);

        const [rolePerms] = await connection.query(
            'SELECT role, COUNT(*) as count FROM role_permissions GROUP BY role'
        );

        console.log('   📌 Role Permissions:');
        rolePerms.forEach(rp => {
            console.log(`      - ${rp.role}: ${rp.count} permissions`);
        });

        const [settings] = await connection.query('SELECT COUNT(*) as count FROM system_settings');
        console.log(`   📌 System Settings: ${settings[0].count}`);

        const [ownerAccount] = await connection.query(
            "SELECT id, username, full_name, role FROM admin WHERE role = 'owner' LIMIT 1"
        );

        if (ownerAccount.length > 0) {
            console.log('\n   👑 Owner Account:');
            console.log(`      - ID: ${ownerAccount[0].id}`);
            console.log(`      - Username: ${ownerAccount[0].username}`);
            console.log(`      - Name: ${ownerAccount[0].full_name}`);
            console.log(`      - Role: ${ownerAccount[0].role}`);
        }

        await connection.end();

        console.log('\n' + '='.repeat(50));
        console.log('✅ RBAC SYSTEM DEPLOYED SUCCESSFULLY!');
        console.log('='.repeat(50));
        console.log('\n📋 Next Steps:');
        console.log('   1. Restart your Node.js server');
        console.log('   2. Login with your owner account');
        console.log('   3. Test API endpoints with Postman:');
        console.log('      GET /api/permissions/me');
        console.log('      GET /api/owner/settings');
        console.log('      GET /api/owner/health');
        console.log('\n🎯 Phase 1 (Backend RBAC) is COMPLETE!');
        console.log('🎨 Next: Build Owner Control Panel UI\n');

    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        console.error('\nPlease check:');
        console.error('  - Database credentials in .env');
        console.error('  - MySQL server is running');
        console.error('  - Database exists');
        process.exit(1);
    }
}

// Run deployment
deployRBAC();
