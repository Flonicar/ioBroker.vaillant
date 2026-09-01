"use strict";

const QUOTA_PAUSE_MS = 60 * 60 * 1000;

/**
 * @param {{ quotaPausedUntil?: number }} adapter
 */
function isQuotaPaused(adapter) {
    return Boolean(adapter.quotaPausedUntil && Date.now() < adapter.quotaPausedUntil);
}

/**
 * @param {{ quotaPausedUntil?: number, log?: { warn: (msg: string) => void } }} adapter
 * @param {unknown} error
 */
function handleQuotaError(adapter, error) {
    const response = error && typeof error === "object" && "response" in error ? error.response : undefined;
    const status =
        response && typeof response === "object" && "status" in response && typeof response.status === "number"
            ? response.status
            : undefined;
    if (status !== 403) {
        return false;
    }
    adapter.quotaPausedUntil = Date.now() + QUOTA_PAUSE_MS;
    adapter.log?.warn(`API quota exceeded (403). Pausing cloud polls for ${QUOTA_PAUSE_MS / 60000} minutes.`);
    return true;
}

module.exports = {
    QUOTA_PAUSE_MS,
    isQuotaPaused,
    handleQuotaError,
};
