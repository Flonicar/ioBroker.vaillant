"use strict";

const { expect } = require("chai");
const { buildMyVaillantRealm, ALLOWED_LOCATIONS } = require("./realm");

describe("lib/realm", () => {
    it("builds the expected realm for supported locations", () => {
        for (const location of ALLOWED_LOCATIONS) {
            expect(buildMyVaillantRealm(location)).to.equal(`vaillant-${location}-b2c`);
        }
        expect(buildMyVaillantRealm("Germany")).to.equal("vaillant-germany-b2c");
    });

    it("rejects unsupported locations", () => {
        expect(() => buildMyVaillantRealm("france")).to.throw(/Invalid myVAILLANT location/);
        expect(() => buildMyVaillantRealm("")).to.throw(/Invalid myVAILLANT location/);
    });

    it("rejects unsupported brands", () => {
        expect(() => buildMyVaillantRealm("germany", "other")).to.throw(/Unsupported myVAILLANT brand/);
    });
});
