"use strict";

/**
 * @param {unknown} parsed
 * @param {string} user
 * @param {string} location
 * @returns {boolean}
 */
function isValidPersistedSession(parsed, user, location) {
    if (!parsed || typeof parsed !== "object") {
        return false;
    }
    const record = /** @type {Record<string, unknown>} */ (parsed);
    if (typeof record.refresh_token !== "string") {
        return false;
    }
    if (record._user !== user || record._location !== location) {
        return false;
    }
    return true;
}

module.exports = { isValidPersistedSession };
