"use strict";

const { expect } = require("chai");
const endpoints = require("./endpoints");

describe("lib/api/endpoints", () => {
    it("builds stable myVaillant URLs", () => {
        expect(endpoints.getHomesEndpoint()).to.include("/end-user-app-api/v1/homes");
        expect(endpoints.getControlIdentifierEndpoint("sys-1")).to.include("/systems/sys-1/meta-info/control-identifier");
        expect(endpoints.getSystemEndpoint("tli", "sys-1")).to.include("/systems/sys-1/tli");
        expect(endpoints.getSystemEndpoint("default", "sys-1")).to.include("/default/v1/systems/sys-1");
        expect(endpoints.getTokenEndpoint("vaillant-germany-b2c")).to.include("vaillant-germany-b2c");
    });
});
