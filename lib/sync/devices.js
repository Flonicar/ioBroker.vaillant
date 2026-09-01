"use strict";

const { getHomesEndpoint, getControlIdentifierEndpoint, getSystemEndpoint } = require("../api/endpoints");
const { setLastSuccessfulPoll, setLastError } = require("../diagnostics");
const { sanitizeLogString } = require("../sanitize");

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function getMyvDeviceList(adapter) {
    await adapter
        .requestClient({
            method: "get",
            url: getHomesEndpoint(),
            headers: {
                Authorization: `Bearer ${adapter.session.access_token}`,
            },
        })
        .then(async res => {
            adapter.log.debug(JSON.stringify(res.data));
            if (res.data.length > 0) {
                adapter.log.info(`Found ${res.data.length} system`);
                for (const device of res.data) {
                    adapter.log.debug(JSON.stringify(device));
                    const id = device.systemId;
                    const remoteState = await adapter.getObjectAsync(`${id}.systemControlState`);

                    if (remoteState) {
                        adapter.log.info(`Clean old states${id}`);
                        await adapter.delObjectAsync(id, { recursive: true });
                    }

                    const name = `${device.homeName} ${device.productInformation}`;
                    device.identifier = await adapter
                        .requestClient({
                            method: "get",
                            url: getControlIdentifierEndpoint(id),
                            headers: {
                                Authorization: `Bearer ${adapter.session.access_token}`,
                            },
                        })
                        .then(identifierRes => {
                            adapter.log.debug(JSON.stringify(identifierRes.data));
                            return identifierRes.data.controlIdentifier;
                        })
                        .catch(error => {
                            adapter.log.error(error);
                            error.response && adapter.log.error(JSON.stringify(error.response.data));
                        });
                    adapter.deviceArray.push(device);
                    await adapter.extendObjectAsync(id, {
                        type: "device",
                        common: {
                            name: name,
                        },
                        native: {},
                    });
                    await adapter.delObjectAsync(`${id}.remote`, { recursive: true });
                    await adapter.setObjectNotExistsAsync(`${id}.remote`, {
                        type: "channel",
                        common: {
                            name: "Remote Controls (For Heating use id.configuration.zones...)",
                        },
                        native: {},
                    });

                    const remoteArray = [
                        { command: "Refresh", name: "True = Refresh" },
                        { command: "RefreshStats", name: "True = Stats Refresh" },
                        { command: "boost", name: "True = Switch On, False = Switch Off" },
                        {
                            command: "quickVeto",
                            name: "set Temperature in TimeControlled Mode (0 to disable)",
                            type: "number",
                            def: 21,
                            role: "level.temperature",
                        },
                        { command: "duration", name: "QuickVeto duration in minutes", type: "number", def: 3, role: "level" },
                        {
                            command: "ventilationBoost",
                            name: "Ventilation Boost: True = Switch On, False = Switch Off",
                        },
                        {
                            command: "coolingForDays",
                            name: "Cooling for days: number of days (0 = cancel)",
                            type: "number",
                            def: 0,
                            role: "level",
                        },
                        {
                            command: "eebusEnabled",
                            name: "EEBUS interface: True = Enable, False = Disable",
                        },
                        {
                            command: "holiday",
                            name: "Holiday/Away mode as json (empty data = cancel)",
                            type: "json",
                            role: "json",
                            def: `{"startDateTime":"2024-01-01T00:00:00.000Z","endDateTime":"2024-01-07T23:59:59.999Z","setpoint":10}`,
                        },
                        {
                            command: "ventilationOperationMode",
                            name: "Ventilation operation mode (uses ventilationIndex, e.g. OFF, NORMAL, REDUCED)",
                            type: "string",
                            role: "text",
                            def: "NORMAL",
                        },
                        {
                            command: "ventilationFanStage",
                            name: "Ventilation max fan stage (uses ventilationIndex)",
                            type: "number",
                            def: 1,
                            role: "level",
                        },
                        {
                            command: "ventilationFanStageType",
                            name: "Ventilation fan stage type: DAY or NIGHT",
                            type: "string",
                            role: "text",
                            def: "DAY",
                        },
                        {
                            command: "ventilationIndex",
                            name: "Ventilation index used by ventilation commands",
                            type: "number",
                            def: 0,
                            role: "level",
                        },
                        {
                            command: "customCommand",
                            name: "Send custom command as json",
                            type: "json",
                            role: "json",
                            def: `{"url":"zone/1/heating/comfort-room-temperature", "data":{"comfortRoomTemperature":10.5}}`,
                        },
                    ];
                    remoteArray.forEach(remote => {
                        adapter.extendObjectAsync(`${id}.remote.${remote.command}`, {
                            type: "state",
                            common: {
                                name: remote.name || "",
                                type: remote.type || "boolean",
                                role: remote.role || "switch",
                                def: remote.def != null ? remote.def : false,
                                write: true,
                                read: true,
                            },
                            native: {},
                        });
                    });
                    adapter.json2iob.parse(`${id}.general`, device, {
                        forceIndex: true,
                        write: true,
                        channelName: "General Information",
                    });
                }
            }
        })
        .catch(error => {
            adapter.log.error(error);
            error.response && adapter.log.error(JSON.stringify(error.response.data));
            void setLastError(adapter, sanitizeLogString(error.message || "Failed to fetch homes"));
        });
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function updateMyvDevices(adapter) {
    let pollOk = true;
    for (const device of adapter.deviceArray) {
        const url = getSystemEndpoint(device.identifier, device.systemId);
        const headers = {
            Authorization: `Bearer ${adapter.session.access_token}`,
        };
        if (adapter.etags[url]) {
            headers["If-None-Match"] = adapter.etags[url];
        }
        await adapter
            .requestClient({
                method: "get",
                url: url,
                headers: headers,
            })
            .then(async res => {
                adapter.log.debug(JSON.stringify(res.data));

                const id = device.systemId;
                if (res.headers.etag) {
                    adapter.etags[url] = res.headers.etag;
                }
                adapter.json2iob.parse(id, res.data, {
                    forceIndex: true,
                    write: true,
                    channelName: `${device.homeName} ${device.productInformation}`,
                });
            })
            .catch(error => {
                if (error.response && error.response.status === 304) {
                    adapter.log.debug(`No changes for ${url}`);
                    return;
                }
                pollOk = false;
                adapter.log.error(`Failed to get status for ${device.systemId}`);
                adapter.log.error(error);
                error.response && adapter.log.error(JSON.stringify(error.response.data));
                void setLastError(adapter, sanitizeLogString(error.message || `Poll failed for ${device.systemId}`));
            });
    }
    if (pollOk && adapter.deviceArray.length > 0) {
        await setLastSuccessfulPoll(adapter);
    }
}

module.exports = { getMyvDeviceList, updateMyvDevices };
