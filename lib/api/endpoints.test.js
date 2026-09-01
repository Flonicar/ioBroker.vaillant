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

    it("builds write URLs for tli and vrc700 controllers", () => {
        expect(endpoints.getMyvDualEndpoint("tli", "sys-1", "away-mode", "away-mode")).to.include("/systems/sys-1/tli/away-mode");
        expect(endpoints.getMyvDualEndpoint("vrc700", "sys-1", "away-mode", "away-mode")).to.include(
            "/vrc700/v1/systems/sys-1/away-mode",
        );
        expect(endpoints.getEebusSpineEndpoint("sys-1")).to.include("/ship/sys-1/self/spine");
        expect(endpoints.getHolidayWriteUrl("vrc700", "sys-1")).to.include("/holiday");
        expect(endpoints.getMyvSystemWriteBase("tli", "sys-1")).to.match(/\/systems\/sys-1\/tli\/$/);
    });
});
