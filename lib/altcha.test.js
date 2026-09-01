"use strict";

const { expect } = require("chai");
const crypto = require("node:crypto");
const { solveAltchaChallenge } = require("./altcha");

describe("lib/altcha", () => {
    it("returns null for invalid challenges", () => {
        expect(solveAltchaChallenge(null)).to.equal(null);
        expect(solveAltchaChallenge({})).to.equal(null);
        expect(solveAltchaChallenge({ parameters: null })).to.equal(null);
    });

    it("solves a minimal PBKDF2 challenge", () => {
        const nonce = "aa".repeat(16);
        const salt = "bb".repeat(8);
        const cost = 1;
        const keyLength = 32;
        const nonceBuf = Buffer.from(nonce, "hex");
        const saltBuf = Buffer.from(salt, "hex");
        const counterBuf = Buffer.alloc(4);
        counterBuf.writeUInt32BE(0, 0);
        const derived = crypto.pbkdf2Sync(Buffer.concat([nonceBuf, counterBuf]), saltBuf, cost, keyLength, "sha256");
        const keyPrefix = derived.subarray(0, 4).toString("hex");

        const challenge = {
            parameters: {
                nonce,
                salt,
                keyPrefix,
                cost,
                keyLength,
                algorithm: "PBKDF2/SHA-256",
            },
            signature: "test-signature",
        };

        const result = solveAltchaChallenge(challenge);
        expect(result).to.be.a("string");
        const decoded = JSON.parse(Buffer.from(result, "base64").toString("utf-8"));
        expect(decoded.solution.counter).to.equal(0);
        expect(decoded.challenge.signature).to.equal("test-signature");
    });
});
