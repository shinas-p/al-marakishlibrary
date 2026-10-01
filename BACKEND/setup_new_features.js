const { query } = require('./config/database');

async function setup() {
    try {
        console.log('Creating reservations table...');
        await query(`
            CREATE TABLE IF NOT EXISTS reservations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                book_id INT NOT NULL,
                reservation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ready_date DATE DEFAULT NULL,
                expiration_date DATE DEFAULT NULL,
                status ENUM('Pending', 'Ready', 'Completed', 'Cancelled') DEFAULT 'Pending',
                notes TEXT,
                FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
            )
        `);

        console.log('Creating book_suggestions table...');
        await query(`
            CREATE TABLE IF NOT EXISTS book_suggestions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                author VARCHAR(255),
                category VARCHAR(100),
                description TEXT,
                reason TEXT,
                status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
                admin_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('Database setup complete.');
    } catch (e) {
        console.error('Setup failed:', e);
    }
    process.exit();
}
setup();
