"use strict";

const endpoints = require("../api/endpoints");
const multimatic = require("../legacy/multimatic");

/**
 * @param {import("@iobroker/adapter-core").Adapter} adapter
 * @param {string} id
 * @param {ioBroker.State | null | undefined} state
 */
async function handleStateChange(adapter, id, state) {
    if (state) {
        if (!state.ack) {
            if (adapter.config.myv) {
                const deviceId = id.split(".")[2];

                if (id.split(".")[4] === "Refresh") {
                    adapter.updateMyvDevices();
                    adapter.updateMyvRooms();
                    return;
                }
                if (id.split(".")[4] === "RefreshStats") {
                    adapter.updateMyStats();
                    return;
                }
                let data = {};
                let method = "POST";
                const command = id.split(".").pop();
                let url = "";
                //find deviceidentifier
                const identifier = adapter.deviceArray.find(device => device.systemId === deviceId).identifier;

                if (command === "awayMode") {
                    method = state.val ? "POST" : "DELETE";
                    url = endpoints.getMyvDualEndpoint(identifier, deviceId, "away-mode", "away-mode");
                }
                if (command === "boost") {
                    method = state.val ? "POST" : "DELETE";
                    url = endpoints.getMyvDualEndpoint(
                        identifier,
                        deviceId,
                        "domestic-hot-water/255/boost",
                        "domestic-hot-water/255/boost",
                    );
                }
                if (command === "ventilationBoost") {
                    method = state.val ? "POST" : "DELETE";
                    data = {};
                    url = endpoints.getMyvDualEndpoint(identifier, deviceId, "ventilation-boost", "ventilation-boost");
                }
                if (command === "coolingForDays") {
                    // mypyllant set_cooling_for_days / cancel_cooling_for_days.
                    // Only exactly 0 cancels. A positive finite integer starts cooling. Anything
                    // else (NaN, negative, fractional) is rejected so we never send a bad write.
                    const days = Number(state.val);
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
                        adapter.log.error("coolingForDays needs 0 (cancel) or a positive whole number of days");
                        return;
                    }
                    url = endpoints.getMyvDualEndpoint(identifier, deviceId, "cooling-for-days", "cooling-for-days");
                }
                if (command === "eebusEnabled") {
                    method = "PUT";
                    data = { enabled: !!state.val };
                    url = endpoints.getEebusSpineEndpoint(deviceId);
                }
                if (command === "holiday") {
                    // mypyllant set_holiday / cancel_holiday.
                    // Cancel ONLY on an explicit empty value. Any non-empty but malformed input
                    // aborts without a request, so a typo can never silently cancel an active holiday.
                    const raw = typeof state.val === "string" ? state.val.trim() : state.val;
                    if (!raw || raw === "{}" || raw === "cancel") {
                        method = "DELETE";
                        data = {};
                    } else {
                        let holidayData;
                        try {
                            holidayData = JSON.parse(raw);
                        } catch (error) {
                            adapter.log.error("Failed to parse holiday json, no request sent. Send empty value to cancel.");
                            adapter.log.error(error);
                            return;
                        }
                        if (!holidayData || !holidayData.startDateTime || !holidayData.endDateTime) {
                            adapter.log.error("holiday needs startDateTime and endDateTime. Send empty value to cancel.");
                            return;
                        }
                        if (new Date(holidayData.startDateTime) >= new Date(holidayData.endDateTime)) {
                            adapter.log.error("holiday startDateTime must be before endDateTime");
                            return;
                        }
                        method = "POST";
                        // Build a clean payload: vrc700 requires setpoint, tli must not receive it.
                        data = { startDateTime: holidayData.startDateTime, endDateTime: holidayData.endDateTime };
                        if (identifier !== "tli") {
                            if (holidayData.setpoint == null) {
                                adapter.log.error("holiday on vrc700 controllers requires a numeric setpoint");
                                return;
                            }
                            data.setpoint = holidayData.setpoint;
                        }
                    }
                    url = endpoints.getHolidayWriteUrl(identifier, deviceId);
                }
                if (command === "ventilationIndex" || command === "ventilationFanStageType") {
                    // Local selectors only, used by the ventilation commands. Never sent to the API.
                    return;
                }
                if (command === "ventilationOperationMode" || command === "ventilationFanStage") {
                    // mypyllant set_ventilation_operation_mode / set_ventilation_fan_stage.
                    // Both need a ventilation index, read from the sibling ventilationIndex state.
                    const base = id.split(".").slice(0, -1).join(".");
                    const indexState = await adapter.getStateAsync(`${base}.ventilationIndex`);
                    const ventilationIndex = indexState && indexState.val != null ? indexState.val : 0;
                    method = "PATCH";
                    let postfix;
                    if (command === "ventilationOperationMode") {
                        postfix = "operation-mode";
                        data = { operationMode: state.val };
                    } else {
                        // fan-stage: vrc700 needs a DAY/NIGHT specific endpoint, tli needs the type in the body.
                        const typeState = await adapter.getStateAsync(`${base}.ventilationFanStageType`);
                        const fanStageType = (typeState && typeState.val ? String(typeState.val) : "DAY").toUpperCase();
                        if (fanStageType !== "DAY" && fanStageType !== "NIGHT") {
                            adapter.log.error("ventilationFanStageType must be DAY or NIGHT");
                            return;
                        }
                        if (identifier !== "tli") {
                            postfix = `${fanStageType.toLowerCase()}-fan-stage`;
                            data = { maximumFanStage: Number(state.val) };
                        } else {
                            postfix = "fan-stage";
                            data = { maximumFanStage: Number(state.val), type: fanStageType };
                        }
                    }
                    url = endpoints.getVentilationCommandUrl(identifier, deviceId, ventilationIndex, postfix);
                }
                if (command === "quickVeto") {
                    method = state.val ? "POST" : "DELETE";
                    const durationState = await adapter.getStateAsync(`${id.split(".").slice(0, -1).join(".")}.duration`);
                    let duration = 3;
                    if (durationState && durationState.val) {
                        duration = durationState.val;
                    }
                    data = { desiredRoomTemperatureSetpoint: state.val, duration: duration };
                    url = endpoints.getMyvDualEndpoint(identifier, deviceId, "zones/0/quick-veto", "zones/0/quick-veto");
                }
                // Explicit write-endpoint map (issue #112). The read API exposes camelCase
                // field names that are NOT valid write endpoints, and tli vs vrc700 use
                // different path shapes. Confirmed on vrc700 hardware for the marked entries.
                // API zone/dhw indices are 0-based while ioBroker states are 1-based -> we -1.
                if (id.split(".")[4].includes("zones")) {
                    const stateZone = Number(id.split(".")[4].replace("zones", ""));
                    const isTli = identifier === "tli";
                    // vrc700 is 0-based (confirmed: state zones01 -> API zone 0). For tli we keep
                    // the previous 1:1 index behaviour to avoid regressing working tli setups.
                    const zoneId = isTli ? stateZone : stateZone > 0 ? stateZone - 1 : 0;
                    adapter.log.debug(`zoneId: ${zoneId} (state ${stateZone}), deviceId: ${deviceId}, identifier: ${identifier}`);
                    method = "PATCH";
                    // command -> { path per controller, body key, optional extra body }
                    const zoneCommands = {
                        // confirmed on vrc700: operation mode
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
                        // confirmed on vrc700: comfort room temperature
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
                            // vrc700 /zone/{i}/heating/manual-mode-setpoint returns 404 (per mypyllant);
                            // the real app uses comfort-room-temperature instead.
                            vrc700: "zone/$z/heating/comfort-room-temperature",
                            tli: "zones/$z/manual-mode-setpoint",
                            key: "comfortRoomTemperature",
                            tliKey: "setpoint",
                            tliExtra: { type: "HEATING" },
                        },
                        manualModeSetpointCooling: {
                            // vrc700 cooling setpoint uses /zone/{i}/cooling/setpoint with {setpoint};
                            // tli uses zones/{i}/setpoint-cooling, also just {setpoint} (no type).
                            vrc700: "zone/$z/cooling/setpoint",
                            tli: "zones/$z/setpoint-cooling",
                            key: "setpoint",
                        },
                        setpointCooling: {
                            // same endpoint as manualModeSetpointCooling (real API field name in cooling config)
                            vrc700: "zone/$z/cooling/setpoint",
                            tli: "zones/$z/setpoint-cooling",
                            key: "setpoint",
                        },
                    };
                    const base = endpoints.getMyvSystemWriteBase(identifier, deviceId);

                    if (command === "desiredRoomTemperatureSetpoint") {
                        // quick veto (temperature setpoint outside a time program)
                        data = { desiredRoomTemperatureSetpoint: state.val };
                        url = isTli ? `${base}zones/${zoneId}/quick-veto` : `${base}zone/${zoneId}/heating/quick-veto`;
                    } else if (zoneCommands[command]) {
                        const map = zoneCommands[command];
                        const pathTemplate = (isTli ? map.tli : map.vrc700).replace("$z", zoneId);
                        const bodyKey = isTli && map.tliKey ? map.tliKey : map.key;
                        data = {};
                        data[bodyKey] = state.val;
                        const extra = isTli ? map.tliExtra : map.vrc700Extra;
                        if (extra) {
                            Object.assign(data, extra);
                        }
                        url = base + pathTemplate;
                    } else {
                        adapter.log.warn(
                            `No write mapping for zone state "${id}" (command "${command}"). ` +
                                `Use remote.customCommand instead, e.g. {"url":"zone/${zoneId}/heating/operation-mode","data":{"operationMode":"AUTO"}}`,
                        );
                        return;
                    }
                }
                if (id.split(".")[4].includes("circuits")) {
                    // Endpoints from APK 3.9.0 + mypyllant. Path is /circuit/{i}/ (singular).
                    // Index 0-based for vrc700; tli kept 1:1 to avoid regressing existing setups.
                    const stateCircuit = Number(id.split(".")[4].replace("circuits", ""));
                    const isTli = identifier === "tli";
                    const circuitsId = isTli ? stateCircuit : stateCircuit > 0 ? stateCircuit - 1 : 0;
                    adapter.log.debug(
                        `circuitsId: ${circuitsId} (state ${stateCircuit}), deviceId: ${deviceId}, identifier: ${identifier}`,
                    );
                    const base = endpoints.getMyvSystemWriteBase(identifier, deviceId);
                    if (command === "heatingCurve") {
                        method = "PATCH";
                        data = isTli ? { heatingCurve: state.val } : { setPoint: state.val };
                        url = `${base}circuit/${circuitsId}/heating-curve`;
                    } else if (command === "minFlowTemperatureSetpoint" || command === "heatingFlowTemperatureMinimumSetpoint") {
                        method = "PATCH";
                        data = { minFlowTemperatureSetpoint: state.val };
                        url = `${base}circuit/${circuitsId}/min-flow-temperature-setpoint`;
                    } else if (command === "heatDemandLimitedByOutsideTemperature") {
                        method = "POST";
                        if (isTli) {
                            data = { heatDemandLimitedByOutsideTemperature: state.val };
                            url = `${base}circuit/${circuitsId}/heat-demand-limited-by-outside-temperature`;
                        } else {
                            data = { setpoint: state.val };
                            url = endpoints.getHeatDemandLimitedEndpoint(identifier, deviceId, circuitsId);
                        }
                    } else {
                        adapter.log.warn(
                            `No write mapping for circuit state "${id}" (command "${command}"). ` +
                                `Use remote.customCommand instead, e.g. {"url":"circuit/${circuitsId}/heating-curve","data":{"heatingCurve":1.2}}`,
                        );
                        return;
                    }
                }
                // VRC700 exposes this branch as "dhw01", tli as "domesticHotWater01"
                // (the API renames domesticHotWater -> dhw for vrc700). Match both.
                if (id.split(".")[4].includes("domesticHotWater") || id.split(".")[4].includes("dhw")) {
                    const idArray = id.split(".");
                    idArray.pop();
                    idArray.push("index");
                    const indexState = await adapter.getStateAsync(idArray.join("."));
                    const dhwIndex = indexState && indexState.val != null ? indexState.val : 255;
                    adapter.log.debug(`dhwIndex: ${dhwIndex}, deviceId: ${deviceId}, identifier: ${identifier}`);
                    const base = endpoints.getMyvSystemWriteBase(identifier, deviceId);

                    if (command === "boost") {
                        // boost on/off - POST to start, DELETE to cancel
                        method = state.val ? "POST" : "DELETE";
                        data = {};
                        url = `${base}domestic-hot-water/${dhwIndex}/boost`;
                    } else if (command === "tappingSetpoint" || command === "setPoint" || command === "setpoint") {
                        // confirmed on vrc700: DHW temperature. Body key is "setpoint".
                        method = "PATCH";
                        data = { setpoint: state.val };
                        url = `${base}domestic-hot-water/${dhwIndex}/temperature`;
                    } else if (
                        command === "operationMode" ||
                        command === "operationModeDomesticHotWater" ||
                        command === "operationModeDhw"
                    ) {
                        // confirmed on vrc700: DHW operation mode
                        method = "PATCH";
                        data = { operationMode: state.val };
                        url = `${base}domestic-hot-water/${dhwIndex}/operation-mode`;
                    } else {
                        adapter.log.warn(
                            `No write mapping for domestic hot water state "${id}" (command "${command}"). ` +
                                `Use remote.customCommand instead, e.g. {"url":"domestic-hot-water/${dhwIndex}/temperature","data":{"setpoint":55}}`,
                        );
                        return;
                    }
                }

                if (id.split(".")[4].includes("ventilation")) {
                    // configuration.ventilationNN.* (real API field names: operationModeVentilation,
                    // maximumDayFanStage, maximumNightFanStage). Endpoints from APK 3.9.0, body keys
                    // per mypyllant (fan-stage verified live on VRC700: only maximumFanStage in body).
                    const stateVent = Number(id.split(".")[4].replace("ventilation", ""));
                    const isTli = identifier === "tli";
                    const ventIndex = isTli ? stateVent : stateVent > 0 ? stateVent - 1 : 0;
                    const base = endpoints.getMyvSystemWriteBase(identifier, deviceId);
                    method = "PATCH";
                    if (command === "operationModeVentilation") {
                        data = { operationMode: state.val };
                        url = `${base}ventilation/${ventIndex}/operation-mode`;
                    } else if (command === "maximumDayFanStage" || command === "maximumNightFanStage") {
                        const stage = command === "maximumDayFanStage" ? "day" : "night";
                        if (isTli) {
                            data = { maximumFanStage: Number(state.val), type: stage.toUpperCase() };
                            url = `${base}ventilation/${ventIndex}/fan-stage`;
                        } else {
                            // vrc700: separate day/night endpoint, body only maximumFanStage
                            data = { maximumFanStage: Number(state.val) };
                            url = `${base}ventilation/${ventIndex}/${stage}-fan-stage`;
                        }
                    } else {
                        adapter.log.warn(
                            `No write mapping for ventilation state "${id}" (command "${command}"). ` +
                                `Use remote.customCommand instead, e.g. {"url":"ventilation/${ventIndex}/operation-mode","data":{"operationMode":"AUTO"}}`,
                        );
                        return;
                    }
                }

                if (id.includes(".rooms.")) {
                    const roomIndex = await adapter.getStateAsync(`${id.split(".")[2]}.rooms.${id.split(".")[4]}.roomIndex`);
                    if (roomIndex) {
                        method = "PUT";
                        data = {};
                        data[command] = state.val;
                        //replace uppercase with lowercase and add - between
                        const urlCommand = command.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
                        url = endpoints.getRoomConfigurationUrl(deviceId, roomIndex.val, urlCommand);
                    }
                }
                if (command === "customCommand") {
                    try {
                        const parsedCommand = JSON.parse(state.val);
                        method = "PATCH";
                        if (parsedCommand.method) {
                            method = parsedCommand.method;
                        }
                        url = endpoints.getCustomCommandUrl(identifier, deviceId, parsedCommand.url);
                        data = parsedCommand.data;
                    } catch (error) {
                        adapter.log.error("Failed to parse custom command");
                        adapter.log.error(error);
                    }
                }
                adapter.log.debug(url);
                adapter.log.debug(JSON.stringify(data));
                if (!url) {
                    adapter.log.warn(
                        `No predefined write mapping for "${id}". Use remote.customCommand instead ` +
                            `(see README). This state category is not directly writable yet.`,
                    );
                    return;
                }
                await adapter
                    .requestClient({
                        method: method,
                        url: url,
                        headers: {
                            Authorization: `Bearer ${adapter.session.access_token}`,
                            "Content-Type": "application/json",
                        },
                        data: JSON.stringify(data),
                    })
                    .then(async res => {
                        adapter.log.info(JSON.stringify(res.data));
                        adapter.refreshTimeout = adapter.setTimeout(async () => {
                            adapter.log.info("Update devices");
                            await adapter.updateMyvDevices();
                            await adapter.updateMyvRooms();
                        }, 10 * 1000);
                    })
                    .catch(error => {
                        adapter.log.error(error);
                        error.response && adapter.log.error(JSON.stringify(error.response.data));
                    });
                return;
            }
            if (id.indexOf("configuration") !== -1 || id.indexOf("parameterValue") !== -1) {
                multimatic.setMethod(adapter, id, state.val).catch(() => {
                    adapter.log.error(`Failed to set: ${id} to: ${state.val}`);
                });
            }
        } else {
            // if (id.indexOf("heating.manualModeSetpointHeating") !== -1) {
            //   const deviceId = id.split(".")[2];
            //   adapter.setState(deviceId + ".remote.quickVeto", state.val, true);
            // }
        }
    } else {
        // The state was deleted
    }
}

module.exports = { handleStateChange };
