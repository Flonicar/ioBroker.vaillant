"use strict";

const endpoints = require("../api/endpoints");

const ZONE_COMMANDS = {
    operationModeHeating: {
        vrc700: "zone/$z/heating/operation-mode",
        tli: "zones/$z/heating-operation-mode",
        key: "operationMode",
    },
    heatingOperationMode: {
        vrc700: "zone/$z/heating/operation-mode",
        tli: "zones/$z/heating-operation-mode",
        key: "operationMode",
    },
    operationModeCooling: {
        vrc700: "zone/$z/cooling/operation-mode",
        tli: "zones/$z/operation-mode",
        key: "operationMode",
        tliExtra: { type: "COOLING" },
    },
    coolingOperationMode: {
        vrc700: "zone/$z/cooling/operation-mode",
        tli: "zones/$z/operation-mode",
        key: "operationMode",
        tliExtra: { type: "COOLING" },
    },
    dayTemperatureHeating: {
        vrc700: "zone/$z/heating/comfort-room-temperature",
        tli: "zones/$z/manual-mode-setpoint",
        key: "comfortRoomTemperature",
        tliKey: "setpoint",
        tliExtra: { type: "HEATING" },
    },
    comfortRoomTemperature: {
        vrc700: "zone/$z/heating/comfort-room-temperature",
        tli: "zones/$z/manual-mode-setpoint",
        key: "comfortRoomTemperature",
        tliKey: "setpoint",
        tliExtra: { type: "HEATING" },
    },
    setBackTemperature: {
        vrc700: "zone/$z/heating/set-back-temperature",
        tli: "zones/$z/set-back-temperature",
        key: "setBackTemperature",
    },
    manualModeSetpointHeating: {
        vrc700: "zone/$z/heating/comfort-room-temperature",
        tli: "zones/$z/manual-mode-setpoint",
        key: "comfortRoomTemperature",
        tliKey: "setpoint",
        tliExtra: { type: "HEATING" },
    },
    manualModeSetpointCooling: {
        vrc700: "zone/$z/cooling/setpoint",
        tli: "zones/$z/setpoint-cooling",
        key: "setpoint",
    },
    setpointCooling: {
        vrc700: "zone/$z/cooling/setpoint",
        tli: "zones/$z/setpoint-cooling",
        key: "setpoint",
    },
};

/**
 * @param {string} identifier
 * @param {number} stateZone
 */
function getZoneId(identifier, stateZone) {
    const isTli = identifier === "tli";
    return isTli ? stateZone : stateZone > 0 ? stateZone - 1 : 0;
}

/**
 * @param {string} identifier
 * @param {number} stateCircuit
 */
function getCircuitId(identifier, stateCircuit) {
    const isTli = identifier === "tli";
    return isTli ? stateCircuit : stateCircuit > 0 ? stateCircuit - 1 : 0;
}

/**
 * @param {string} identifier
 * @param {number} stateVent
 */
function getVentIndex(identifier, stateVent) {
    const isTli = identifier === "tli";
    return isTli ? stateVent : stateVent > 0 ? stateVent - 1 : 0;
}

/**
 * @param {{ identifier: string, deviceId: string, command: string, stateVal: unknown }} params
 * @returns {{ method: string, url: string, data: object } | null}
 */
function buildSimpleCommandMapping({ identifier, deviceId, command, stateVal }) {
    if (command === "awayMode") {
        return {
            method: stateVal ? "POST" : "DELETE",
            url: endpoints.getMyvDualEndpoint(identifier, deviceId, "away-mode", "away-mode"),
            data: {},
        };
    }
    if (command === "boost") {
        return {
            method: stateVal ? "POST" : "DELETE",
            url: endpoints.getMyvDualEndpoint(identifier, deviceId, "domestic-hot-water/255/boost", "domestic-hot-water/255/boost"),
            data: {},
        };
    }
    if (command === "ventilationBoost") {
        return {
            method: stateVal ? "POST" : "DELETE",
            url: endpoints.getMyvDualEndpoint(identifier, deviceId, "ventilation-boost", "ventilation-boost"),
            data: {},
        };
    }
    if (command === "eebusEnabled") {
        return {
            method: "PUT",
            url: endpoints.getEebusSpineEndpoint(deviceId),
            data: { enabled: !!stateVal },
        };
    }
    return null;
}

/**
 * @param {{ identifier: string, deviceId: string, stateVal: unknown }} params
 * @returns {{ ok: true, mapping: { method: string, url: string, data: object } } | { ok: false, error: string }}
 */
function buildCoolingForDaysMapping({ identifier, deviceId, stateVal }) {
    const days = Number(stateVal);
    let method;
    let data;
    if (days === 0) {
        method = "DELETE";
        data = {};
    } else if (Number.isInteger(days) && days > 0) {
        method = "POST";
        if (identifier !== "tli") {
            data = { value: days };
        } else {
            const start = new Date();
            const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
            data = {
                startDateTime: start.toISOString(),
                endDateTime: end.toISOString(),
            };
        }
    } else {
        return { ok: false, error: "coolingForDays needs 0 (cancel) or a positive whole number of days" };
    }
    return {
        ok: true,
        mapping: {
            method,
            url: endpoints.getMyvDualEndpoint(identifier, deviceId, "cooling-for-days", "cooling-for-days"),
            data,
        },
    };
}

/**
 * @param {{ identifier: string, deviceId: string, rawValue: unknown }} params
 * @returns {{ ok: true, mapping: { method: string, url: string, data: object } } | { ok: false, error: string }}
 */
function buildHolidayMapping({ identifier, deviceId, rawValue }) {
    const raw = typeof rawValue === "string" ? rawValue.trim() : rawValue;
    let method;
    let data;
    if (!raw || raw === "{}" || raw === "cancel") {
        method = "DELETE";
        data = {};
    } else {
        let holidayData;
        try {
            holidayData = JSON.parse(String(raw));
        } catch {
            return { ok: false, error: "Failed to parse holiday json, no request sent. Send empty value to cancel." };
        }
        if (!holidayData || !holidayData.startDateTime || !holidayData.endDateTime) {
            return { ok: false, error: "holiday needs startDateTime and endDateTime. Send empty value to cancel." };
        }
        if (new Date(holidayData.startDateTime) >= new Date(holidayData.endDateTime)) {
            return { ok: false, error: "holiday startDateTime must be before endDateTime" };
        }
        method = "POST";
        data = { startDateTime: holidayData.startDateTime, endDateTime: holidayData.endDateTime };
        if (identifier !== "tli") {
            if (holidayData.setpoint == null) {
                return { ok: false, error: "holiday on vrc700 controllers requires a numeric setpoint" };
            }
            data.setpoint = holidayData.setpoint;
        }
    }
    return {
        ok: true,
        mapping: {
            method,
            url: endpoints.getHolidayWriteUrl(identifier, deviceId),
            data,
        },
    };
}

/**
 * @param {{ identifier: string, deviceId: string, command: string, stateVal: unknown, stateZone: number }} params
 * @returns {{ method: string, url: string, data: object } | null}
 */
function buildZoneCommandMapping({ identifier, deviceId, command, stateVal, stateZone }) {
    const isTli = identifier === "tli";
    const zoneId = getZoneId(identifier, stateZone);
    const base = endpoints.getMyvSystemWriteBase(identifier, deviceId);

    if (command === "desiredRoomTemperatureSetpoint") {
        return {
            method: "PATCH",
            data: { desiredRoomTemperatureSetpoint: stateVal },
            url: isTli ? `${base}zones/${zoneId}/quick-veto` : `${base}zone/${zoneId}/heating/quick-veto`,
        };
    }
    const map = ZONE_COMMANDS[command];
    if (!map) {
        return null;
    }
    const pathTemplate = (isTli ? map.tli : map.vrc700).replace("$z", String(zoneId));
    const bodyKey = isTli && map.tliKey ? map.tliKey : map.key;
    const data = { [bodyKey]: stateVal };
    const extra = isTli ? map.tliExtra : map.vrc700Extra;
    if (extra) {
        Object.assign(data, extra);
    }
    return {
        method: "PATCH",
        url: base + pathTemplate,
        data,
    };
}

/**
 * @param {{ identifier: string, deviceId: string, command: string, stateVal: unknown, stateCircuit: number }} params
 * @returns {{ method: string, url: string, data: object } | null}
 */
function buildCircuitCommandMapping({ identifier, deviceId, command, stateVal, stateCircuit }) {
    const isTli = identifier === "tli";
    const circuitsId = getCircuitId(identifier, stateCircuit);
    const base = endpoints.getMyvSystemWriteBase(identifier, deviceId);

    if (command === "heatingCurve") {
        return {
            method: "PATCH",
            data: isTli ? { heatingCurve: stateVal } : { setPoint: stateVal },
            url: `${base}circuit/${circuitsId}/heating-curve`,
        };
    }
    if (command === "minFlowTemperatureSetpoint" || command === "heatingFlowTemperatureMinimumSetpoint") {
        return {
            method: "PATCH",
            data: { minFlowTemperatureSetpoint: stateVal },
            url: `${base}circuit/${circuitsId}/min-flow-temperature-setpoint`,
        };
    }
    if (command === "heatDemandLimitedByOutsideTemperature") {
        if (isTli) {
            return {
                method: "POST",
                data: { heatDemandLimitedByOutsideTemperature: stateVal },
                url: `${base}circuit/${circuitsId}/heat-demand-limited-by-outside-temperature`,
            };
        }
        return {
            method: "POST",
            data: { setpoint: stateVal },
            url: endpoints.getHeatDemandLimitedEndpoint(identifier, deviceId, circuitsId),
        };
    }
    return null;
}

/**
 * @param {{ identifier: string, deviceId: string, command: string, stateVal: unknown, dhwIndex: number }} params
 * @returns {{ method: string, url: string, data: object } | null}
 */
function buildDhwCommandMapping({ identifier, deviceId, command, stateVal, dhwIndex }) {
    const base = endpoints.getMyvSystemWriteBase(identifier, deviceId);

    if (command === "boost") {
        return {
            method: stateVal ? "POST" : "DELETE",
            data: {},
            url: `${base}domestic-hot-water/${dhwIndex}/boost`,
        };
    }
    if (command === "tappingSetpoint" || command === "setPoint" || command === "setpoint") {
        return {
            method: "PATCH",
            data: { setpoint: stateVal },
            url: `${base}domestic-hot-water/${dhwIndex}/temperature`,
        };
    }
    if (command === "operationMode" || command === "operationModeDomesticHotWater" || command === "operationModeDhw") {
        return {
            method: "PATCH",
            data: { operationMode: stateVal },
            url: `${base}domestic-hot-water/${dhwIndex}/operation-mode`,
        };
    }
    return null;
}

/**
 * @param {{ identifier: string, deviceId: string, command: string, stateVal: unknown, stateVent: number }} params
 * @returns {{ method: string, url: string, data: object } | null}
 */
function buildVentilationConfigMapping({ identifier, deviceId, command, stateVal, stateVent }) {
    const isTli = identifier === "tli";
    const ventIndex = getVentIndex(identifier, stateVent);
    const base = endpoints.getMyvSystemWriteBase(identifier, deviceId);

    if (command === "operationModeVentilation") {
        return {
            method: "PATCH",
            data: { operationMode: stateVal },
            url: `${base}ventilation/${ventIndex}/operation-mode`,
        };
    }
    if (command === "maximumDayFanStage" || command === "maximumNightFanStage") {
        const stage = command === "maximumDayFanStage" ? "day" : "night";
        if (isTli) {
            return {
                method: "PATCH",
                data: { maximumFanStage: Number(stateVal), type: stage.toUpperCase() },
                url: `${base}ventilation/${ventIndex}/fan-stage`,
            };
        }
        return {
            method: "PATCH",
            data: { maximumFanStage: Number(stateVal) },
            url: `${base}ventilation/${ventIndex}/${stage}-fan-stage`,
        };
    }
    return null;
}

/**
 * @param {{ identifier: string, deviceId: string, command: string, stateVal: unknown, ventilationIndex: number, fanStageType?: string }} params
 * @returns {{ method: string, url: string, data: object } | { ok: false, error: string } | null}
 */
function buildVentilationCommandMapping({ identifier, deviceId, command, stateVal, ventilationIndex, fanStageType }) {
    if (command === "ventilationOperationMode") {
        return {
            method: "PATCH",
            data: { operationMode: stateVal },
            url: endpoints.getVentilationCommandUrl(identifier, deviceId, ventilationIndex, "operation-mode"),
        };
    }
    if (command === "ventilationFanStage") {
        const stage = (fanStageType || "DAY").toUpperCase();
        if (stage !== "DAY" && stage !== "NIGHT") {
            return { ok: false, error: "ventilationFanStageType must be DAY or NIGHT" };
        }
        if (identifier !== "tli") {
            return {
                method: "PATCH",
                data: { maximumFanStage: Number(stateVal) },
                url: endpoints.getVentilationCommandUrl(identifier, deviceId, ventilationIndex, `${stage.toLowerCase()}-fan-stage`),
            };
        }
        return {
            method: "PATCH",
            data: { maximumFanStage: Number(stateVal), type: stage },
            url: endpoints.getVentilationCommandUrl(identifier, deviceId, ventilationIndex, "fan-stage"),
        };
    }
    return null;
}

/**
 * @param {{ identifier: string, deviceId: string, stateVal: unknown, duration?: number }} params
 * @returns {{ method: string, url: string, data: object }}
 */
function buildQuickVetoMapping({ identifier, deviceId, stateVal, duration = 3 }) {
    return {
        method: stateVal ? "POST" : "DELETE",
        data: { desiredRoomTemperatureSetpoint: stateVal, duration },
        url: endpoints.getMyvDualEndpoint(identifier, deviceId, "zones/0/quick-veto", "zones/0/quick-veto"),
    };
}

/**
 * @param {{ identifier: string, deviceId: string, stateVal: unknown }} params
 * @returns {{ ok: true, mapping: { method: string, url: string, data: object } } | { ok: false, error: string }}
 */
function buildCustomCommandMapping({ identifier, deviceId, stateVal }) {
    try {
        const parsedCommand = JSON.parse(String(stateVal));
        let method = "PATCH";
        if (parsedCommand.method) {
            method = parsedCommand.method;
        }
        return {
            ok: true,
            mapping: {
                method,
                url: endpoints.getCustomCommandUrl(identifier, deviceId, parsedCommand.url),
                data: parsedCommand.data,
            },
        };
    } catch {
        return { ok: false, error: "Failed to parse custom command" };
    }
}

/**
 * @param {{ deviceId: string, roomIndex: number, command: string, stateVal: unknown }} params
 * @returns {{ method: string, url: string, data: object }}
 */
function buildRoomCommandMapping({ deviceId, roomIndex, command, stateVal }) {
    const urlCommand = command.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    return {
        method: "PUT",
        url: endpoints.getRoomConfigurationUrl(deviceId, roomIndex, urlCommand),
        data: { [command]: stateVal },
    };
}

module.exports = {
    ZONE_COMMANDS,
    getZoneId,
    getCircuitId,
    getVentIndex,
    buildSimpleCommandMapping,
    buildCoolingForDaysMapping,
    buildHolidayMapping,
    buildZoneCommandMapping,
    buildCircuitCommandMapping,
    buildDhwCommandMapping,
    buildVentilationConfigMapping,
    buildVentilationCommandMapping,
    buildQuickVetoMapping,
    buildCustomCommandMapping,
    buildRoomCommandMapping,
};
