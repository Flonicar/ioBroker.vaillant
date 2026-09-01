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
});
