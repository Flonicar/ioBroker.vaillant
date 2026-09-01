"use strict";

const SENSITIVE_KEY_PATTERN = /password|token|secret|authorization|refresh|access|credential|session|api[_-]?key/i;

/**
 * @param {string} value
 * @returns {string}
 */
function sanitizeLogString(value) {
    if (typeof value !== "string") {
        return value;
    }
    return value
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
        .replace(/"access_token"\s*:\s*"[^"]*"/gi, '"access_token":"[REDACTED]"')
        .replace(/"refresh_token"\s*:\s*"[^"]*"/gi, '"refresh_token":"[REDACTED]"')
        .replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"[REDACTED]"');
}

/**
 * @param {unknown} value
 * @param {string} [keyName]
 * @returns {unknown}
 */
function sanitizeLogData(value, keyName = "") {
    if (value === null || value === undefined) {
        return value;
    }
    if (SENSITIVE_KEY_PATTERN.test(keyName)) {
        return "[REDACTED]";
    }
    if (typeof value === "string") {
        return sanitizeLogString(value);
    }
    if (typeof value !== "object") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(item => sanitizeLogData(item));
    }
    const sanitized = {};
    for (const key of Object.keys(value)) {
        sanitized[key] = sanitizeLogData(value[key], key);
    }
    return sanitized;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function stringifyForLog(value) {
    try {
        return JSON.stringify(sanitizeLogData(value));
    } catch {
        return String(value);
    }
}

module.exports = { sanitizeLogString, sanitizeLogData, stringifyForLog, SENSITIVE_KEY_PATTERN };
