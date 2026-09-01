"use strict";

const { expect } = require("chai");
const { buildMyVaillantRealm } = require("./lib/realm");
const { getHomesEndpoint } = require("./lib/api/endpoints");

describe("adapter entry wiring", () => {
    it("exposes extracted lib modules used by main.js", () => {
        expect(buildMyVaillantRealm("germany")).to.equal("vaillant-germany-b2c");
        expect(getHomesEndpoint()).to.be.a("string");
    });
});
