"use strict";

const { expect } = require("chai");
const { CONFIG_DEFAULTS, migrateConfig, isFetchEnabled } = require("./features");

describe("lib/config/features", () => {
    it("applies defaults for missing keys", () => {
        const config = { interval: 10 };
        migrateConfig(config);

        expect(config.fetchStatus).to.equal(true);
        expect(config.fetchTroubleCodes).to.equal(false);
        expect(config.fetchStatsHours).to.equal(false);
        expect(config.fetchStatsHoursLimit).to.equal(48);
        expect(config.fetchYearlyReport).to.equal(false);
        expect(config.statsInterval).to.equal(1440);
        expect(config.fetchMonths).to.equal(undefined);
    });

    it("migrates fetchMonths to fetchStatsMonths", () => {
        const config = { fetchMonths: true };
        migrateConfig(config);

        expect(config.fetchStatsMonths).to.equal(true);
        expect(config.fetchMonths).to.equal(undefined);
    });

    it("isFetchEnabled treats only explicit false as disabled", () => {
        const adapter = { config: { ...CONFIG_DEFAULTS, fetchRts: false } };
        expect(isFetchEnabled(adapter, "fetchRts")).to.equal(false);
        expect(isFetchEnabled(adapter, "fetchStats")).to.equal(true);
    });
});
