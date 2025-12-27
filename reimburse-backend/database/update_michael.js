const db = require('../config/database');

async function updateMichael() {
  try {
    const email = 'michael.eltim@gmail.com';
    const name = '周黎明 Michael';
    
    console.log(`Updating name for user ${email}...`);
    
    const [result] = await db.query(
      'UPDATE users SET name = ? WHERE email = ?',
      [name, email]
    );

    if (result.changedRows > 0) {
      console.log('✓ User updated successfully');
    } else if (result.affectedRows > 0) {
        console.log('ℹ️  User found but name was already set');
    } else {
      console.log('⚠️  User not found');
    }

    process.exit(0);
  } catch (error) {
    console.error('Update failed:', error);
    process.exit(1);
  }
}

updateMichael();
