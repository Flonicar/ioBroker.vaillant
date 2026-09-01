"use strict";

const { expect } = require("chai");
const { findFirstByKeyHint, updateSummaryFromSystemData } = require("./summary");

describe("lib/sync/summary", () => {
    it("findFirstByKeyHint finds nested outdoor temperature", () => {
        const data = {
            installations: [{ outdoorTemperature: 7.5 }],
        };
        expect(findFirstByKeyHint(data, "outdoortemperature")).to.equal(7.5);
    });

    it("updateSummaryFromSystemData writes summary states", async () => {
        const setStateCalls = [];
        const adapter = {
            config: { fetchSummary: true },
            setObjectNotExistsAsync: async () => {},
            setState: (id, val) => {
                setStateCalls.push({ id, val });
            },
        };

        await updateSummaryFromSystemData(adapter, "sys-1", {
            circuits: [{ heatingOperationMode: "HEATING" }],
            outdoorTemperature: 4.2,
        });

        expect(setStateCalls.some(call => call.id === "sys-1.summary.outdoorTemperature" && call.val === 4.2)).to.equal(
            true,
        );
        expect(setStateCalls.some(call => call.id === "sys-1.summary.operationMode" && call.val === "HEATING")).to.equal(
            true,
        );
    });

    it("updateSummaryFromSystemData skips when disabled", async () => {
        let called = false;
        const adapter = {
            config: { fetchSummary: false },
            setObjectNotExistsAsync: async () => {
                called = true;
            },
            setState: () => {},
        };

        await updateSummaryFromSystemData(adapter, "sys-1", { outdoorTemperature: 1 });
        expect(called).to.equal(false);
    });
});
