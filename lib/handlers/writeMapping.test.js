"use strict";

const { expect } = require("chai");
const writeMapping = require("./writeMapping");

const DEVICE_ID = "sys-1";

describe("lib/handlers/writeMapping", () => {
    describe("buildSimpleCommandMapping", () => {
        it("maps awayMode POST/DELETE for tli", () => {
            const on = writeMapping.buildSimpleCommandMapping({
                identifier: "tli",
                deviceId: DEVICE_ID,
                command: "awayMode",
                stateVal: true,
            });
            expect(on.method).to.equal("POST");
            expect(on.url).to.include("/systems/sys-1/tli/away-mode");

            const off = writeMapping.buildSimpleCommandMapping({
                identifier: "tli",
                deviceId: DEVICE_ID,
                command: "awayMode",
                stateVal: false,
            });
            expect(off.method).to.equal("DELETE");
        });

        it("maps awayMode for vrc700", () => {
            const mapping = writeMapping.buildSimpleCommandMapping({
                identifier: "vrc700",
                deviceId: DEVICE_ID,
                command: "awayMode",
                stateVal: true,
            });
            expect(mapping.url).to.include("/vrc700/v1/systems/sys-1/away-mode");
        });

        it("maps ventilationBoost toggle", () => {
            const mapping = writeMapping.buildSimpleCommandMapping({
                identifier: "vrc700",
                deviceId: DEVICE_ID,
                command: "ventilationBoost",
                stateVal: true,
            });
            expect(mapping.method).to.equal("POST");
            expect(mapping.url).to.include("ventilation-boost");
        });
    });

    describe("buildCoolingForDaysMapping", () => {
        it("cancels with DELETE when days is 0", () => {
            const result = writeMapping.buildCoolingForDaysMapping({
                identifier: "vrc700",
                deviceId: DEVICE_ID,
                stateVal: 0,
            });
            expect(result.ok).to.equal(true);
            expect(result.mapping.method).to.equal("DELETE");
        });

        it("uses value body for vrc700", () => {
            const result = writeMapping.buildCoolingForDaysMapping({
                identifier: "vrc700",
                deviceId: DEVICE_ID,
                stateVal: 3,
            });
            expect(result.ok).to.equal(true);
            expect(result.mapping.method).to.equal("POST");
            expect(result.mapping.data).to.deep.equal({ value: 3 });
        });

        it("uses date range body for tli", () => {
            const result = writeMapping.buildCoolingForDaysMapping({
                identifier: "tli",
                deviceId: DEVICE_ID,
                stateVal: 2,
            });
            expect(result.ok).to.equal(true);
            expect(result.mapping.data).to.have.property("startDateTime");
            expect(result.mapping.data).to.have.property("endDateTime");
        });

        it("rejects invalid day counts", () => {
            const result = writeMapping.buildCoolingForDaysMapping({
                identifier: "tli",
                deviceId: DEVICE_ID,
                stateVal: 1.5,
            });
            expect(result.ok).to.equal(false);
        });
    });

    describe("buildHolidayMapping", () => {
        it("cancels holiday on empty value", () => {
            const result = writeMapping.buildHolidayMapping({
                identifier: "tli",
                deviceId: DEVICE_ID,
                rawValue: "",
            });
            expect(result.ok).to.equal(true);
            expect(result.mapping.method).to.equal("DELETE");
            expect(result.mapping.url).to.include("away-mode");
        });

        it("requires setpoint on vrc700", () => {
            const result = writeMapping.buildHolidayMapping({
                identifier: "vrc700",
                deviceId: DEVICE_ID,
                rawValue: JSON.stringify({
                    startDateTime: "2026-01-01T00:00:00Z",
                    endDateTime: "2026-01-10T00:00:00Z",
                }),
            });
            expect(result.ok).to.equal(false);
        });

        it("posts holiday with setpoint on vrc700", () => {
            const result = writeMapping.buildHolidayMapping({
                identifier: "vrc700",
                deviceId: DEVICE_ID,
                rawValue: JSON.stringify({
                    startDateTime: "2026-01-01T00:00:00Z",
                    endDateTime: "2026-01-10T00:00:00Z",
                    setpoint: 18,
                }),
            });
            expect(result.ok).to.equal(true);
            expect(result.mapping.method).to.equal("POST");
            expect(result.mapping.data.setpoint).to.equal(18);
            expect(result.mapping.url).to.include("/holiday");
        });
    });

    describe("buildZoneCommandMapping", () => {
        it("maps vrc700 zone index 0-based from state zones01", () => {
            expect(writeMapping.getZoneId("vrc700", 1)).to.equal(0);
            const mapping = writeMapping.buildZoneCommandMapping({
                identifier: "vrc700",
                deviceId: DEVICE_ID,
                command: "heatingOperationMode",
                stateVal: "AUTO",
                stateZone: 1,
            });
            expect(mapping.url).to.include("zone/0/heating/operation-mode");
            expect(mapping.data).to.deep.equal({ operationMode: "AUTO" });
        });

        it("maps tli zone index 1:1", () => {
            expect(writeMapping.getZoneId("tli", 1)).to.equal(1);
            const mapping = writeMapping.buildZoneCommandMapping({
                identifier: "tli",
                deviceId: DEVICE_ID,
                command: "heatingOperationMode",
                stateVal: "MANUAL",
                stateZone: 1,
            });
            expect(mapping.url).to.include("zones/1/heating-operation-mode");
            expect(mapping.data).to.deep.equal({ operationMode: "MANUAL" });
        });

        it("maps desiredRoomTemperatureSetpoint quick-veto paths", () => {
            const vrc = writeMapping.buildZoneCommandMapping({
                identifier: "vrc700",
                deviceId: DEVICE_ID,
                command: "desiredRoomTemperatureSetpoint",
                stateVal: 22,
                stateZone: 1,
            });
            expect(vrc.url).to.include("zone/0/heating/quick-veto");

            const tli = writeMapping.buildZoneCommandMapping({
                identifier: "tli",
                deviceId: DEVICE_ID,
                command: "desiredRoomTemperatureSetpoint",
                stateVal: 22,
                stateZone: 1,
            });
            expect(tli.url).to.include("zones/1/quick-veto");
        });
    });

    describe("buildCircuitCommandMapping", () => {
        it("maps heatingCurve for vrc700 and tli", () => {
            const vrc = writeMapping.buildCircuitCommandMapping({
                identifier: "vrc700",
                deviceId: DEVICE_ID,
                command: "heatingCurve",
                stateVal: 1.2,
                stateCircuit: 1,
            });
            expect(vrc.url).to.include("circuit/0/heating-curve");
            expect(vrc.data).to.deep.equal({ setPoint: 1.2 });

            const tli = writeMapping.buildCircuitCommandMapping({
                identifier: "tli",
                deviceId: DEVICE_ID,
                command: "heatingCurve",
                stateVal: 1.2,
                stateCircuit: 1,
            });
            expect(tli.data).to.deep.equal({ heatingCurve: 1.2 });
        });
    });

    describe("buildDhwCommandMapping", () => {
        it("maps DHW boost and temperature for vrc700", () => {
            const boost = writeMapping.buildDhwCommandMapping({
                identifier: "vrc700",
                deviceId: DEVICE_ID,
                command: "boost",
                stateVal: true,
                dhwIndex: 0,
            });
            expect(boost.method).to.equal("POST");
            expect(boost.url).to.include("domestic-hot-water/0/boost");

            const temp = writeMapping.buildDhwCommandMapping({
                identifier: "vrc700",
                deviceId: DEVICE_ID,
                command: "setpoint",
                stateVal: 55,
                dhwIndex: 0,
            });
            expect(temp.method).to.equal("PATCH");
            expect(temp.data).to.deep.equal({ setpoint: 55 });
            expect(temp.url).to.include("domestic-hot-water/0/temperature");
        });
    });

    describe("buildVentilationConfigMapping", () => {
        it("maps day fan stage for vrc700 and tli", () => {
            const vrc = writeMapping.buildVentilationConfigMapping({
                identifier: "vrc700",
                deviceId: DEVICE_ID,
                command: "maximumDayFanStage",
                stateVal: 80,
                stateVent: 1,
            });
            expect(vrc.url).to.include("ventilation/0/day-fan-stage");
            expect(vrc.data).to.deep.equal({ maximumFanStage: 80 });

            const tli = writeMapping.buildVentilationConfigMapping({
                identifier: "tli",
                deviceId: DEVICE_ID,
                command: "maximumDayFanStage",
                stateVal: 80,
                stateVent: 1,
            });
            expect(tli.url).to.include("ventilation/1/fan-stage");
            expect(tli.data).to.deep.equal({ maximumFanStage: 80, type: "DAY" });
        });
    });

    describe("buildQuickVetoMapping", () => {
        it("maps quick veto with duration", () => {
            const mapping = writeMapping.buildQuickVetoMapping({
                identifier: "vrc700",
                deviceId: DEVICE_ID,
                stateVal: 22,
                duration: 3600,
            });
            expect(mapping.method).to.equal("POST");
            expect(mapping.data).to.deep.equal({ desiredRoomTemperatureSetpoint: 22, duration: 3600 });
        });
    });

    describe("buildCustomCommandMapping", () => {
        it("parses custom command JSON", () => {
            const result = writeMapping.buildCustomCommandMapping({
                identifier: "vrc700",
                deviceId: DEVICE_ID,
                stateVal: JSON.stringify({
                    method: "PATCH",
                    url: "zone/0/heating/operation-mode",
                    data: { operationMode: "AUTO" },
                }),
            });
            expect(result.ok).to.equal(true);
            expect(result.mapping.method).to.equal("PATCH");
            expect(result.mapping.url).to.include("zone/0/heating/operation-mode");
        });
    });
});
