"use strict";

const multimatic = require("../legacy/multimatic");
const writeMapping = require("./writeMapping");

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
                const identifier = adapter.deviceArray.find(device => device.systemId === deviceId).identifier;

                const simple = writeMapping.buildSimpleCommandMapping({ identifier, deviceId, command, stateVal: state.val });
                if (simple) {
                    method = simple.method;
                    url = simple.url;
                    data = simple.data;
                }
                if (command === "coolingForDays") {
                    const result = writeMapping.buildCoolingForDaysMapping({ identifier, deviceId, stateVal: state.val });
                    if (!result.ok) {
                        adapter.log.error(result.error);
                        return;
                    }
                    method = result.mapping.method;
                    url = result.mapping.url;
                    data = result.mapping.data;
                }
                if (command === "holiday") {
                    const result = writeMapping.buildHolidayMapping({ identifier, deviceId, rawValue: state.val });
                    if (!result.ok) {
                        adapter.log.error(result.error);
                        return;
                    }
                    method = result.mapping.method;
                    url = result.mapping.url;
                    data = result.mapping.data;
                }
                if (command === "ventilationIndex" || command === "ventilationFanStageType") {
                    return;
                }
                if (command === "ventilationOperationMode" || command === "ventilationFanStage") {
                    const base = id.split(".").slice(0, -1).join(".");
                    const indexState = await adapter.getStateAsync(`${base}.ventilationIndex`);
                    const ventilationIndex = indexState && indexState.val != null ? indexState.val : 0;
                    const typeState = await adapter.getStateAsync(`${base}.ventilationFanStageType`);
                    const fanStageType = typeState && typeState.val ? String(typeState.val) : "DAY";
                    const result = writeMapping.buildVentilationCommandMapping({
                        identifier,
                        deviceId,
                        command,
                        stateVal: state.val,
                        ventilationIndex,
                        fanStageType,
                    });
                    if (result && result.ok === false) {
                        adapter.log.error(result.error);
                        return;
                    }
                    if (result) {
                        method = result.method;
                        url = result.url;
                        data = result.data;
                    }
                }
                if (command === "quickVeto") {
                    const durationState = await adapter.getStateAsync(`${id.split(".").slice(0, -1).join(".")}.duration`);
                    const duration = durationState && durationState.val ? durationState.val : 3;
                    const mapping = writeMapping.buildQuickVetoMapping({
                        identifier,
                        deviceId,
                        stateVal: state.val,
                        duration,
                    });
                    method = mapping.method;
                    url = mapping.url;
                    data = mapping.data;
                }
                if (id.split(".")[4].includes("zones")) {
                    const stateZone = Number(id.split(".")[4].replace("zones", ""));
                    adapter.log.debug(
                        `zoneId: ${writeMapping.getZoneId(identifier, stateZone)} (state ${stateZone}), deviceId: ${deviceId}, identifier: ${identifier}`,
                    );
                    const mapping = writeMapping.buildZoneCommandMapping({
                        identifier,
                        deviceId,
                        command,
                        stateVal: state.val,
                        stateZone,
                    });
                    if (!mapping) {
                        adapter.log.warn(
                            `No write mapping for zone state "${id}" (command "${command}"). ` +
                                `Use remote.customCommand instead, e.g. {"url":"zone/0/heating/operation-mode","data":{"operationMode":"AUTO"}}`,
                        );
                        return;
                    }
                    method = mapping.method;
                    url = mapping.url;
                    data = mapping.data;
                }
                if (id.split(".")[4].includes("circuits")) {
                    const stateCircuit = Number(id.split(".")[4].replace("circuits", ""));
                    adapter.log.debug(
                        `circuitsId: ${writeMapping.getCircuitId(identifier, stateCircuit)} (state ${stateCircuit}), deviceId: ${deviceId}, identifier: ${identifier}`,
                    );
                    const mapping = writeMapping.buildCircuitCommandMapping({
                        identifier,
                        deviceId,
                        command,
                        stateVal: state.val,
                        stateCircuit,
                    });
                    if (!mapping) {
                        adapter.log.warn(
                            `No write mapping for circuit state "${id}" (command "${command}"). ` +
                                `Use remote.customCommand instead, e.g. {"url":"circuit/0/heating-curve","data":{"heatingCurve":1.2}}`,
                        );
                        return;
                    }
                    method = mapping.method;
                    url = mapping.url;
                    data = mapping.data;
                }
                if (id.split(".")[4].includes("domesticHotWater") || id.split(".")[4].includes("dhw")) {
                    const idArray = id.split(".");
                    idArray.pop();
                    idArray.push("index");
                    const indexState = await adapter.getStateAsync(idArray.join("."));
                    const dhwIndex = indexState && indexState.val != null ? indexState.val : 255;
                    adapter.log.debug(`dhwIndex: ${dhwIndex}, deviceId: ${deviceId}, identifier: ${identifier}`);
                    const mapping = writeMapping.buildDhwCommandMapping({
                        identifier,
                        deviceId,
                        command,
                        stateVal: state.val,
                        dhwIndex,
                    });
                    if (!mapping) {
                        adapter.log.warn(
                            `No write mapping for domestic hot water state "${id}" (command "${command}"). ` +
                                `Use remote.customCommand instead, e.g. {"url":"domestic-hot-water/${dhwIndex}/temperature","data":{"setpoint":55}}`,
                        );
                        return;
                    }
                    method = mapping.method;
                    url = mapping.url;
                    data = mapping.data;
                }
                if (id.split(".")[4].includes("ventilation")) {
                    const stateVent = Number(id.split(".")[4].replace("ventilation", ""));
                    const mapping = writeMapping.buildVentilationConfigMapping({
                        identifier,
                        deviceId,
                        command,
                        stateVal: state.val,
                        stateVent,
                    });
                    if (!mapping) {
                        adapter.log.warn(
                            `No write mapping for ventilation state "${id}" (command "${command}"). ` +
                                `Use remote.customCommand instead, e.g. {"url":"ventilation/0/operation-mode","data":{"operationMode":"AUTO"}}`,
                        );
                        return;
                    }
                    method = mapping.method;
                    url = mapping.url;
                    data = mapping.data;
                }
                if (id.includes(".rooms.")) {
                    const roomIndex = await adapter.getStateAsync(`${id.split(".")[2]}.rooms.${id.split(".")[4]}.roomIndex`);
                    if (roomIndex) {
                        const mapping = writeMapping.buildRoomCommandMapping({
                            deviceId,
                            roomIndex: roomIndex.val,
                            command,
                            stateVal: state.val,
                        });
                        method = mapping.method;
                        url = mapping.url;
                        data = mapping.data;
                    }
                }
                if (command === "customCommand") {
                    const result = writeMapping.buildCustomCommandMapping({
                        identifier,
                        deviceId,
                        stateVal: state.val,
                    });
                    if (!result.ok) {
                        adapter.log.error(result.error);
                        return;
                    }
                    method = result.mapping.method;
                    url = result.mapping.url;
                    data = result.mapping.data;
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
        }
    }
}

module.exports = { handleStateChange };
