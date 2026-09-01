"use strict";

const { isFetchEnabled } = require("../config/features");

/**
 * @param {unknown} value
 * @param {string} keyHint
 * @returns {unknown}
 */
function findFirstByKeyHint(value, keyHint) {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findFirstByKeyHint(item, keyHint);
            if (found !== undefined) {
                return found;
            }
        }
        return undefined;
    }
    if (typeof value === "object") {
        for (const [key, nested] of Object.entries(value)) {
            if (key.toLowerCase().includes(keyHint.toLowerCase())) {
                if (typeof nested !== "object" || nested === null) {
                    return nested;
                }
            }
            const found = findFirstByKeyHint(nested, keyHint);
            if (found !== undefined) {
                return found;
            }
        }
    }
    return undefined;
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {string} systemId
 * @param {Record<string, unknown>} data
 */
async function updateSummaryFromSystemData(adapter, systemId, data) {
    if (!isFetchEnabled(adapter, "fetchSummary")) {
        return;
    }

    const outdoorTemperature = findFirstByKeyHint(data, "outdoortemperature");
    const operationMode =
        findFirstByKeyHint(data, "operationmode") ||
        findFirstByKeyHint(data, "heatingoperationmode") ||
        findFirstByKeyHint(data, "activeoperatingmode");

    await adapter.setObjectNotExistsAsync(`${systemId}.summary`, {
        type: "channel",
        common: { name: "Summary" },
        native: {},
    });

    const states = [
        {
            id: `${systemId}.summary.outdoorTemperature`,
            common: {
                name: "Outdoor temperature",
                type: "number",
                role: "value.temperature",
                read: true,
                write: false,
                unit: "°C",
            },
        },
        {
            id: `${systemId}.summary.operationMode`,
            common: {
                name: "Operation mode",
                type: "string",
                role: "text",
                read: true,
                write: false,
            },
        },
    ];

    for (const state of states) {
        await adapter.setObjectNotExistsAsync(state.id, {
            type: "state",
            common: state.common,
            native: {},
        });
    }

    if (typeof outdoorTemperature === "number") {
        adapter.setState(`${systemId}.summary.outdoorTemperature`, outdoorTemperature, true);
    }
    if (typeof operationMode === "string" && operationMode.length > 0) {
        adapter.setState(`${systemId}.summary.operationMode`, operationMode, true);
    }
}

module.exports = {
    updateSummaryFromSystemData,
    findFirstByKeyHint,
};
