"use strict";

const nock = require("nock");
const { expect } = require("chai");
const { requestWithRetry } = require("./client");

describe("lib/api/client", () => {
    afterEach(() => {
        nock.cleanAll();
    });

    it("retries on 503 and eventually succeeds", async () => {
        const scope = nock("https://example.test")
            .get("/status")
            .times(2)
            .reply(503)
            .get("/status")
            .reply(200, { ok: true });

        const response = await requestWithRetry(
            () => fetch("https://example.test/status").then(res => {
                if (!res.ok) {
                    const error = new Error(`HTTP ${res.status}`);
                    error.response = { status: res.status };
                    throw error;
                }
                return res.json();
            }),
            { maxAttempts: 3, baseDelayMs: 1 },
        );

        expect(response).to.deep.equal({ ok: true });
        expect(scope.isDone()).to.equal(true);
    });

    it("does not retry on 400", async () => {
        let attempts = 0;
        await expect(
            requestWithRetry(async () => {
                attempts++;
                const error = new Error("bad request");
                error.response = { status: 400 };
                throw error;
            }),
        ).to.be.rejected;
        expect(attempts).to.equal(1);
    });

    it("pauses adapter on HTTP 403 instead of retrying", async () => {
        const warnings = [];
        const adapter = { log: { warn: () => warnings.push("warned") } };
        let attempts = 0;

        await expect(
            requestWithRetry(
                async () => {
                    attempts++;
                    const error = new Error("quota");
                    error.response = { status: 403 };
                    throw error;
                },
                { adapter },
            ),
        ).to.be.rejected;

        expect(attempts).to.equal(1);
        expect(adapter.quotaPausedUntil).to.be.greaterThan(Date.now());
        expect(warnings).to.have.length(1);
    });

    it("blocks requests while quota pause is active", async () => {
        const adapter = { quotaPausedUntil: Date.now() + 60000 };
        let attempts = 0;

        await expect(
            requestWithRetry(
                async () => {
                    attempts++;
                    return "ok";
                },
                { adapter },
            ),
        ).to.be.rejected;

        expect(attempts).to.equal(0);
    });
});
