"use strict";

/**
 * @param {string} accessToken
 * @returns {{Authorization: string}}
 */
function bearerAuth(accessToken) {
    return {
        Authorization: `Bearer ${accessToken}`,
    };
}

/**
 * @param {() => Promise<unknown>} requestFn
 * @param {{ maxAttempts?: number, baseDelayMs?: number }} [options]
 * @returns {Promise<unknown>}
 */
async function requestWithRetry(requestFn, options = {}) {
    const maxAttempts = options.maxAttempts || 3;
    const baseDelayMs = options.baseDelayMs || 1000;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await requestFn();
        } catch (error) {
            lastError = error;
            const response = error && typeof error === "object" && "response" in error ? error.response : undefined;
            const status =
                response && typeof response === "object" && "status" in response && typeof response.status === "number"
                    ? response.status
                    : undefined;
            const retryable = status === 429 || (status !== undefined && status >= 500);
            if (!retryable || attempt === maxAttempts) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, baseDelayMs * attempt));
        }
    }
    throw lastError;
}

module.exports = { bearerAuth, requestWithRetry };
