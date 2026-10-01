const { queryOne } = require('../config/database');
const moment = require('moment');

/**
 * Get setting value
 */
const getSetting = async (key, defaultValue = null) => {
  try {
    const setting = await queryOne(
      'SELECT setting_value, setting_type FROM system_settings WHERE setting_key = ?',
      [key]
    );

    if (!setting) return defaultValue;

    const value = setting.setting_value;
    const type = setting.setting_type;

    switch (type) {
      case 'integer':
        return parseInt(value) || defaultValue;
      case 'boolean':
        return value === '1' || value === 'true';
      case 'json':
        return JSON.parse(value);
      default:
        return value || defaultValue;
    }
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return defaultValue;
  }
};

/**
 * Check if setting is enabled
 */
const isEnabled = async (key) => {
  const value = await getSetting(key, false);
  return value === true || value === '1' || value === 1;
};

/**
 * Calculate fine for overdue book
 * @param {string} dueDate - Due date (YYYY-MM-DD format)
 * @param {string|null} returnDate - Return date (YYYY-MM-DD format) - null for current date
 * @param {string} userType - User type: 'student' or 'staff'
 * @returns {Promise<Object>} Fine calculation result
 */
const calculateFine = async (dueDate, returnDate = null, userType = 'student') => {
  const result = {
    fine_amount: 0,
    days_overdue: 0,
    days_charged: 0,
    currency: '₹',
    message: 'No fine'
  };

  try {
    // Check if fines are enabled
    const finesEnabled = await isEnabled('fine_enabled');
    if (!finesEnabled) {
      result.message = 'Fine system is disabled';
      return result;
    }

    // Parse dates
    const due = moment(dueDate);
    const returnDateObj = returnDate ? moment(returnDate) : moment();

    // Calculate days overdue
    const daysOverdue = returnDateObj.diff(due, 'days');
    result.days_overdue = daysOverdue;

    // No fine if returned on time or early
    if (daysOverdue <= 0) {
      result.message = 'Returned on time';
      return result;
    }

    // Get fine configuration
    const gracePeriod = await getSetting('fine_grace_period', 0);
    const separateStaffRate = await getSetting('fine_separate_staff_rate', false);
    const currency = await getSetting('currency_symbol', '₹');
    const maxLimit = await getSetting('fine_max_limit', 0);

    result.currency = currency;

    // Apply grace period
    const daysCharged = Math.max(0, daysOverdue - gracePeriod);
    result.days_charged = daysCharged;

    if (daysCharged === 0) {
      result.message = `Within ${gracePeriod}-day grace period`;
      return result;
    }

    // Determine fine rate based on user type
    let finePerDay = 0;
    if (userType === 'staff' && separateStaffRate) {
      finePerDay = await getSetting('fine_per_day_staff', 10);
    } else {
      finePerDay = await getSetting('fine_per_day_student', 5);
    }

    // Calculate total fine
    let fineAmount = daysCharged * finePerDay;

    // Apply maximum limit if set
    if (maxLimit > 0 && fineAmount > maxLimit) {
      fineAmount = maxLimit;
      result.message = `Fine capped at maximum limit (${currency}${maxLimit})`;
    } else {
      result.message = `${daysCharged} days × ${currency}${finePerDay}`;
    }

    result.fine_amount = fineAmount;
  } catch (error) {
    console.error('Fine calculation error:', error);
    result.message = 'Error calculating fine';
  }

  return result;
};

/**
 * Get formatted fine display string
 */
const getFormattedFine = async (dueDate, returnDate = null, userType = 'student') => {
  const result = await calculateFine(dueDate, returnDate, userType);
  return `${result.currency}${result.fine_amount} (${result.message})`;
};

/**
 * Update overdue transaction statuses
 */
const updateOverdueStatuses = async () => {
  try {
    const today = moment().format('YYYY-MM-DD');

    // Update transactions that are overdue
    await query(
      `UPDATE transactions 
       SET status = 'Overdue' 
       WHERE status = 'Borrowed' AND due_date < ?`,
      [today]
    );

    return { success: true, message: 'Overdue statuses updated' };
  } catch (error) {
    console.error('Update overdue statuses error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  calculateFine,
  getFormattedFine,
  updateOverdueStatuses,
  getSetting,
  isEnabled
};
