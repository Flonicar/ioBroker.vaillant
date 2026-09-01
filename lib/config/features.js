"use strict";

const CONFIG_DEFAULTS = {
    fetchStatus: true,
    fetchRooms: true,
    fetchPvData: true,
    fetchStats: true,
    fetchStatsMonths: false,
    fetchStatsHours: false,
    fetchStatsHoursLimit: 48,
    fetchYearlyReport: false,
    fetchEfficiency: true,
    fetchTroubleCodes: false,
    fetchRts: false,
    fetchMpc: false,
    fetchEnergyManagement: false,
    fetchEebus: false,
    fetchConnectionStatus: false,
    fetchTimeZone: false,
    fetchAmbisenseCapability: false,
    fetchSummary: true,
    statsInterval: 1440,
};

/**
 * @param {Record<string, unknown>} config
 */
function migrateConfig(config) {
    if (config.fetchMonths === true && config.fetchStatsMonths === undefined) {
        config.fetchStatsMonths = true;
    }
    delete config.fetchMonths;

    for (const [key, value] of Object.entries(CONFIG_DEFAULTS)) {
        if (config[key] === undefined) {
            config[key] = value;
        }
    }
}

/**
 * @param {{ config: Record<string, unknown> }} adapter
 * @param {string} key
 */
function isFetchEnabled(adapter, key) {
    return adapter.config[key] !== false;
}

module.exports = {
    CONFIG_DEFAULTS,
    migrateConfig,
    isFetchEnabled,
};
