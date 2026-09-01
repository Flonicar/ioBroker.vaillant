"use strict";

const DIAGNOSTIC_STATES = [
    {
        id: "info.lastSuccessfulPoll",
        common: {
            name: "Last successful cloud poll (unix ms)",
            type: "number",
            role: "value.time",
            read: true,
            write: false,
        },
    },
    {
        id: "info.lastError",
        common: {
            name: "Last error (sanitized)",
            type: "string",
            role: "text",
            read: true,
            write: false,
        },
    },
    {
        id: "info.authMode",
        common: {
            name: "Active auth mode",
            type: "string",
            role: "text",
            read: true,
            write: false,
        },
    },
    {
        id: "info.adapterVersion",
        common: {
            name: "Adapter version",
            type: "string",
            role: "text",
            read: true,
            write: false,
        },
    },
];

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {string} version
 */
async function ensureDiagnosticStates(adapter, version) {
    for (const state of DIAGNOSTIC_STATES) {
        await adapter.setObjectNotExistsAsync(state.id, {
            type: "state",
            common: state.common,
            native: {},
        });
    }
    await adapter.setStateAsync("info.adapterVersion", version, true);
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {"myvaillant"|"multimatic"|"none"} mode
 */
async function setAuthMode(adapter, mode) {
    await adapter.setStateAsync("info.authMode", mode, true);
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {string} message
 */
async function setLastError(adapter, message) {
    const text = message ? String(message).slice(0, 500) : "";
    await adapter.setStateAsync("info.lastError", text, true);
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function setLastSuccessfulPoll(adapter) {
    await adapter.setStateAsync("info.lastSuccessfulPoll", Date.now(), true);
    await setLastError(adapter, "");
}

module.exports = {
    DIAGNOSTIC_STATES,
    ensureDiagnosticStates,
    setAuthMode,
    setLastError,
    setLastSuccessfulPoll,
};
