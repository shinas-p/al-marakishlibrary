const fetch = require('node-fetch');

async function testLogin() {
    console.log('\n🧪 Testing Admin Login API...\n');

    const testCases = [
        { username: 'muflih', password: '1234', shouldWork: true, note: 'Plain text password' },
        { username: 'admin', password: 'wrongpassword', shouldWork: false, note: 'Wrong password' },
        { username: 'nonexistent', password: 'test', shouldWork: false, note: 'User does not exist' },
    ];

    for (const testCase of testCases) {
        console.log(`Testing: ${testCase.username} / ${testCase.password}`);
        console.log(`Expected: ${testCase.shouldWork ? '✅ SUCCESS' : '❌ FAIL'} (${testCase.note})`);

        try {
            const response = await fetch('http://localhost:5001/api/auth/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: testCase.username,
                    password: testCase.password
                })
            });

            const data = await response.json();

            if (testCase.shouldWork) {
                if (data.success && data.token) {
                    console.log(`Result: ✅ SUCCESS - Login worked!`);
                    console.log(`   Token: ${data.token.substring(0, 20)}...`);
                    console.log(`   User: ${data.user.full_name} (${data.user.role})`);
                } else {
                    console.log(`Result: ❌ FAILED - Should have worked but got: ${data.error}`);
                }
            } else {
                if (!data.success) {
                    console.log(`Result: ✅ CORRECT - Failed as expected: ${data.error}`);
                } else {
                    console.log(`Result: ❌ WRONG - Should have failed but succeeded!`);
                }
            }

        } catch (error) {
            console.log(`Result: ❌ ERROR - ${error.message}`);
        }

        console.log('-----------------------------------\n');
    }

    console.log('✅ Testing complete!\n');
}

testLogin();
