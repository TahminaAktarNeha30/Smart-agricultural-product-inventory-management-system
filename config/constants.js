// config/constants.js
// Defines system-wide constants, enums, and Bangladesh timezone date helpers

const ROLES = {
  FARM_MANAGER: 'Farm Manager',
  WAREHOUSE_OFFICER: 'Warehouse Officer',
  DISTRIBUTOR: 'Distributor'
};

const ITEM_TYPES = {
  FARMING_INPUT: 'Farming Input',
  FINISHED_PRODUCT: 'Finished Product'
};

const ROTATION_RULES = {
  FIFO: 'FIFO',
  FEFO: 'FEFO'
};

const ORDER_STATUS = {
  PLACED: 'Placed',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DISPATCHED: 'Dispatched',
  CANCELLED: 'Cancelled'
};

const WASTAGE_REASONS = ['spoilage', 'expiry', 'damage', 'other'];

/**
 * Gets the current date in Bangladesh Standard Time (UTC+6) in 'YYYY-MM-DD' format.
 * SRS US-8B: Alerts and expiry checks use the Bangladesh local date.
 */
function getBangladeshDateString(date = new Date()) {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const bdTime = new Date(utc + (3600000 * 6)); // UTC+6
  const year = bdTime.getFullYear();
  const month = String(bdTime.getMonth() + 1).padStart(2, '0');
  const day = String(bdTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates date N days from a given YYYY-MM-DD string
 */
function addDaysToDateString(dateStr, days) {
  const parts = dateStr.split('-');
  const d = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
  d.setUTCDate(d.getUTCDate() + days);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks expiry status for a batch given its expiry date string (YYYY-MM-DD)
 * Returns: 'EXPIRED' | 'EXPIRING_SOON' | 'ACTIVE' | 'NONE'
 */
function getExpiryStatus(expiryDateStr) {
  if (!expiryDateStr) return 'NONE';

  const todayBD = getBangladeshDateString();
  const threeDaysAhead = addDaysToDateString(todayBD, 3);

  // If today's date is strictly greater than expiryDate -> EXPIRED
  if (todayBD > expiryDateStr) {
    return 'EXPIRED';
  }
  // If expiry date is between today and today + 3 calendar days inclusive -> EXPIRING_SOON
  if (expiryDateStr >= todayBD && expiryDateStr <= threeDaysAhead) {
    return 'EXPIRING_SOON';
  }
  return 'ACTIVE';
}

module.exports = {
  ROLES,
  ITEM_TYPES,
  ROTATION_RULES,
  ORDER_STATUS,
  WASTAGE_REASONS,
  getBangladeshDateString,
  addDaysToDateString,
  getExpiryStatus
};
