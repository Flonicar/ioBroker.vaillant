"use strict";

const { expect } = require("chai");
const { isQuotaPaused, handleQuotaError, QUOTA_PAUSE_MS } = require("./quota");

describe("lib/api/quota", () => {
    it("detects active quota pause", () => {
        const adapter = { quotaPausedUntil: Date.now() + 60000 };
        expect(isQuotaPaused(adapter)).to.equal(true);
    });

    it("detects expired quota pause", () => {
        const adapter = { quotaPausedUntil: Date.now() - 1000 };
        expect(isQuotaPaused(adapter)).to.equal(false);
    });

    it("sets quota pause on HTTP 403", () => {
        const warnings = [];
        const adapter = { log: { warn: msg => warnings.push(msg) } };
        const error = { response: { status: 403 } };

        expect(handleQuotaError(adapter, error)).to.equal(true);
        expect(adapter.quotaPausedUntil).to.be.greaterThan(Date.now());
        expect(warnings[0]).to.include(String(QUOTA_PAUSE_MS / 60000));
    });

    it("ignores non-403 errors", () => {
        const adapter = {};
        expect(handleQuotaError(adapter, { response: { status: 429 } })).to.equal(false);
    });
});
