"use strict";

const { expect } = require("chai");
const statsSync = require("./stats");
const endpoints = require("../api/endpoints");
const emfCurrentFixture = require("../../test/fixtures/emf-current-system.json");
const emfBucketsFixture = require("../../test/fixtures/emf-buckets-day.json");

function createStatsAdapter(overrides = {}) {
    const requestCalls = [];
    const setObjectCalls = [];
    const setStateCalls = [];
    const parseCalls = [];

    const adapter = {
        deviceArray: [{ systemId: "sys-1" }],
        session: { access_token: "test-token" },
        config: { fetchReportsLimit: 7 },
        log: { info: () => {}, debug: () => {}, error: () => {} },
        getStateAsync: async () => null,
        delObjectAsync: async () => {},
        extendObjectAsync: async () => {},
        setObjectNotExistsAsync: async id => {
            setObjectCalls.push(id);
        },
        setState: (id, val) => {
            setStateCalls.push({ id, val });
        },
        json2iob: {
            parse: (id, data) => {
                parseCalls.push({ id, data });
            },
        },
        requestClient: async config => {
            requestCalls.push(config);
            if (config.url.includes("/currentSystem")) {
                return { data: emfCurrentFixture };
            }
            if (config.url.includes("/buckets")) {
                return { data: emfBucketsFixture };
            }
            return { data: {} };
        },
        ...overrides,
    };

    return { adapter, requestCalls, setObjectCalls, setStateCalls, parseCalls };
}

describe("lib/sync/stats", () => {
    it("clearOldStats removes legacy stats when v2 state is missing", async () => {
        const deleted = [];
        const extended = [];
        const { adapter } = createStatsAdapter({
            getStateAsync: async () => null,
            delObjectAsync: async id => {
                deleted.push(id);
            },
            extendObjectAsync: async id => {
                extended.push(id);
            },
        });

        await statsSync.clearOldStats(adapter);

        expect(deleted).to.deep.equal(["sys-1.stats"]);
        expect(extended).to.deep.equal(["sys-1.v2"]);
    });

    it("updateMyStats requests EMF buckets and writes day stats state", async () => {
        const { adapter, requestCalls, setObjectCalls, setStateCalls } = createStatsAdapter();

        await statsSync.updateMyStats(adapter);

        expect(requestCalls[0].url).to.equal(endpoints.getEmfCurrentSystemEndpoint("sys-1"));
        const bucketCall = requestCalls.find(call => call.url.includes("/buckets"));
        expect(bucketCall).to.exist;
        expect(bucketCall.url).to.include("resolution=DAY");
        expect(bucketCall.url).to.include("operationMode=HEATING");
        expect(bucketCall.url).to.include("energyType=CONSUMPTION");
        expect(setObjectCalls.some(id => id === "sys-1.stats.heatPump.CONSUMPTION.HEATING.day.json")).to.equal(true);
        expect(setStateCalls.some(call => call.id === "sys-1.stats.heatPump.CONSUMPTION.HEATING.day.json")).to.equal(true);
    });

    it("updateMyvEfficiency creates efficiency channel on success", async () => {
        const requestCalls = [];
        const parseCalls = [];
        const { adapter } = createStatsAdapter({
            requestClient: async config => {
                requestCalls.push(config);
                return { data: { efficiency: 0.95 } };
            },
            json2iob: {
                parse: (id, data) => {
                    parseCalls.push({ id, data });
                },
            },
        });

        await statsSync.updateMyvEfficiency(adapter);

        expect(requestCalls[0].url).to.include("/currentSystemWithEfficiency");
        expect(parseCalls.some(call => call.id === "sys-1.stats.efficiency")).to.equal(true);
    });

    it("updateMyvPvData disables device on 404", async () => {
        const { adapter } = createStatsAdapter({
            disabledPv: [],
            requestClient: async () => {
                const error = new Error("not found");
                error.response = { status: 404 };
                throw error;
            },
        });

        await statsSync.updateMyvPvData(adapter);

        expect(adapter.disabledPv).to.deep.equal(["sys-1"]);
    });

    it("updateMyStats skips when fetchStats is disabled", async () => {
        const { adapter, requestCalls } = createStatsAdapter({
            config: { fetchReportsLimit: 7, fetchStats: false },
        });

        await statsSync.updateMyStats(adapter);

        expect(requestCalls).to.have.length(0);
    });

    it("updateMyStats skips MONTH buckets when fetchStatsMonths is false", async () => {
        const { adapter, requestCalls } = createStatsAdapter({
            config: { fetchReportsLimit: 7, fetchStats: true, fetchStatsMonths: false },
        });

        await statsSync.updateMyStats(adapter);

        expect(requestCalls.some(call => call.url.includes("resolution=MONTH"))).to.equal(false);
        expect(requestCalls.some(call => call.url.includes("resolution=DAY"))).to.equal(true);
    });

    it("updateMyStats requests HOUR buckets when fetchStatsHours is enabled", async () => {
        const { adapter, requestCalls, setObjectCalls } = createStatsAdapter({
            config: { fetchReportsLimit: 7, fetchStats: true, fetchStatsHours: true, fetchStatsHoursLimit: 24 },
        });

        await statsSync.updateMyStats(adapter);

        const hourCall = requestCalls.find(call => call.url.includes("resolution=HOUR"));
        expect(hourCall).to.exist;
        expect(hourCall.url).to.include("operationMode=HEATING");
        expect(setObjectCalls.some(id => id === "sys-1.stats.heatPump.CONSUMPTION.HEATING.hour.json")).to.equal(true);
    });

    it("updateYearlyReport fetches report for current year", async () => {
        const requestCalls = [];
        const parseCalls = [];
        const year = new Date().getFullYear();
        const { adapter } = createStatsAdapter({
            config: { fetchYearlyReport: true },
            requestClient: async config => {
                requestCalls.push(config);
                return { data: [{ device: "heatPump", year }] };
            },
            json2iob: {
                parse: (id, data) => {
                    parseCalls.push({ id, data });
                },
            },
        });

        await statsSync.updateYearlyReport(adapter);

        expect(requestCalls[0].url).to.equal(endpoints.getEmfYearlyReportEndpoint("sys-1", year));
        expect(parseCalls.some(call => call.id === "sys-1.stats.yearlyReport")).to.equal(true);
    });

    it("updateYearlyReport skips when disabled", async () => {
        const { adapter, requestCalls } = createStatsAdapter({
            config: { fetchYearlyReport: false },
        });

        await statsSync.updateYearlyReport(adapter);

        expect(requestCalls).to.have.length(0);
    });

    it("getBucketFromDate uses hour limit for HOUR resolution", () => {
        const adapter = { config: { fetchStatsHoursLimit: 12, fetchReportsLimit: 7 } };
        const toDate = "2026-01-15T12:00:00Z";
        const fromDate = statsSync.getBucketFromDate("HOUR", toDate, adapter);
        const diffHours = (new Date(toDate) - new Date(fromDate)) / (60 * 60 * 1000);
        expect(diffHours).to.equal(12);
    });
});
