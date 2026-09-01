"use strict";

const { expect } = require("chai");
const metaSync = require("./meta");
const endpoints = require("../api/endpoints");

describe("lib/sync/meta", () => {
    it("updateConnectionStatus sets info.connection when enabled", async () => {
        const requestCalls = [];
        let connectionState;
        const adapter = {
            deviceArray: [{ systemId: "sys-1" }],
            session: { access_token: "token" },
            config: { fetchConnectionStatus: true },
            log: { debug: () => {}, error: () => {} },
            requestClient: async config => {
                requestCalls.push(config);
                return { data: { connected: true } };
            },
            setObjectNotExistsAsync: async () => {},
            json2iob: { parse: () => {} },
            setState: (id, val) => {
                if (id === "info.connection") {
                    connectionState = val;
                }
            },
        };

        await metaSync.updateConnectionStatus(adapter);

        expect(requestCalls[0].url).to.equal(endpoints.getMetaInfoEndpoint("sys-1", "connection-status"));
        expect(connectionState).to.equal(true);
    });

    it("updateTimeZone skips when already cached", async () => {
        const requestCalls = [];
        const adapter = {
            deviceArray: [{ systemId: "sys-1" }],
            session: { access_token: "token" },
            config: { fetchTimeZone: true },
            log: { debug: () => {}, error: () => {} },
            getStateAsync: async () => ({ val: true }),
            requestClient: async config => {
                requestCalls.push(config);
                return { data: {} };
            },
        };

        await metaSync.updateTimeZone(adapter);

        expect(requestCalls).to.have.length(0);
    });
});
