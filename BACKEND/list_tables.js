const { query } = require('./config/database');
query('SHOW TABLES').then(res => {
    console.log(JSON.stringify(res.map(r => Object.values(r)[0])));
    process.exit(0);
});
