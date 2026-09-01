"use strict";

const crypto = require("node:crypto");
const { expect } = require("chai");
const { getCodeChallenge } = require("./pkce");

describe("lib/pkce", () => {
    it("returns verifier and S256 challenge as base64url", () => {
        const [verifier, challenge] = getCodeChallenge();
        expect(verifier).to.match(/^[0-9a-f]{64}$/);
        expect(challenge).to.match(/^[A-Za-z0-9_-]+$/);
        expect(challenge).to.not.include("=");
        expect(challenge).to.not.include("+");
        expect(challenge).to.not.include("/");

        const expected = crypto
            .createHash("sha256")
            .update(verifier)
            .digest("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");
        expect(challenge).to.equal(expected);
    });
});
