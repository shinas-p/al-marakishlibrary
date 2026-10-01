const { query } = require('./config/database');

async function checkSchema() {
    try {
        const notif = await query('DESCRIBE notifications');
        console.log('Notifications Table:', JSON.stringify(notif, null, 2));
    } catch (e) { console.log('No notifications table'); }

    try {
        const ann = await query('DESCRIBE announcements');
        console.log('Announcements Table:', JSON.stringify(ann, null, 2));
    } catch (e) { console.log('No announcements table'); }

    process.exit();
}
checkSchema();
