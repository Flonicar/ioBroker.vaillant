"use strict";

const endpoints = require("../api/endpoints");
const { bearerAuth, requestWithRetry } = require("../api/client");

async function clearOldStats(adapter) {
    for (const device of adapter.deviceArray) {
        const id = device.systemId;
        const newStatsState = await adapter.getStateAsync(`${id}.v2`);
        if (!newStatsState) {
            adapter.log.info(`Clear old stats for ${id}`);
            await adapter.delObjectAsync(`${id}.stats`, { recursive: true });
            await adapter.extendObjectAsync(`${id}.v2`, {
                type: "state",
                common: {
                    name: "v2",
                    write: false,
                    read: true,
                    type: "boolean",
                    role: "indicator",
                    def: true,
                },
                native: {},
            });
        }
    }
}

async function updateMyStats(adapter) {
    for (const device of adapter.deviceArray) {
        const id = device.systemId;
        await requestWithRetry(() =>
            adapter.requestClient({
                method: "get",
                url: endpoints.getEmfCurrentSystemEndpoint(id),
                headers: bearerAuth(adapter.session.access_token),
            }),
        )
            .then(async res => {
                await adapter.setObjectNotExistsAsync(`${id}.stats`, {
                    type: "channel",
                    common: {
                        name: "Statistics",
                    },
                    native: {},
                });

                adapter.json2iob.parse(`${id}.stats`, res.data, { forceIndex: true });
                adapter.log.debug(JSON.stringify(res.data));
                const resolutions = ["DAY", "MONTH"];

                for (const deviceKey in res.data) {
                    if (!res.data[deviceKey] || !res.data[deviceKey].data) {
                        continue;
                    }
                    for (const stats of res.data[deviceKey].data) {
                        // if (!stats.calculated) {
                        //   continue;
                        // }
                        // await adapter.sleep(5000);
                        for (const resolution of resolutions) {
                            const toDate = stats.to;
                            let fromDate;

                            if (resolution === "MONTH") {
                                const lastMonthDate = new Date(toDate);
                                lastMonthDate.setMonth(lastMonthDate.getMonth() - 12);
                                fromDate = lastMonthDate.toISOString().replace(".000Z", "Z");
                            } else {
                                const lastDateTimeStamp = new Date(toDate) - adapter.config.fetchReportsLimit * 24 * 60 * 60 * 1000;
                                fromDate = new Date(lastDateTimeStamp).toISOString().replace(".000Z", "Z");
                            }

                            // startDate minus adapter.config.fetchReportsLimit days

                            await requestWithRetry(() =>
                                adapter.requestClient({
                                    method: "get",
                                    url: endpoints.getEmfBucketsEndpoint(
                                        id,
                                        res.data[deviceKey].device_uuid,
                                        resolution,
                                        stats.operation_mode,
                                        stats.value_type,
                                        fromDate,
                                        toDate,
                                    ),
                                    headers: bearerAuth(adapter.session.access_token),
                                }),
                            )
                                .then(async res => {
                                    // adapter.log.debug(JSON.stringify(res.data));
                                    if (res.data && res.data.data) {
                                        res.data.data.sort((a, b) => (a.endDate < b.endDate ? 1 : -1));

                                        let stateId = `${id}.stats.${deviceKey}.${stats.value_type}.${stats.operation_mode}`;

                                        if (resolution === "MONTH") {
                                            stateId += ".month";
                                        } else {
                                            stateId += ".day";
                                        }
                                        await adapter.setObjectNotExistsAsync(`${stateId}.json`, {
                                            type: "state",
                                            common: {
                                                name: "Json Stats",
                                                write: false,
                                                read: true,
                                                type: "string",
                                                role: "json",
                                            },
                                            native: {},
                                        });
                                        adapter.json2iob.parse(stateId, res.data, {
                                            forceIndex: true,
                                            preferedArrayName: "",
                                        });
                                        adapter.setState(`${stateId}.json`, JSON.stringify(res.data), true);
                                    } else {
                                        adapter.log.debug(`No data found for ${deviceKey}.${stats.value_type}.${stats.operation_mode}`);
                                    }
                                })
                                .catch(error => {
                                    adapter.log.error(error);
                                    error.response && adapter.log.error(JSON.stringify(error.response.data));
                                });
                        }
                    }
                }
            })
            .catch(error => {
                adapter.log.error(error);
                error.response && adapter.log.error(JSON.stringify(error.response.data));
            });
    }
}

async function updateMyvEfficiency(adapter) {
    for (const device of adapter.deviceArray) {
        const id = device.systemId;
        const now = new Date();
        const startDate = new Date(now.getFullYear(), 0, 1).toISOString().replace(".000Z", "Z");
        const endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString().replace(".000Z", "Z");
        const url = endpoints.getEmfEfficiencyEndpoint(id, startDate, endDate);
        await requestWithRetry(() =>
            adapter.requestClient({
                method: "get",
                url: url,
                headers: bearerAuth(adapter.session.access_token),
            }),
        )
            .then(async res => {
                adapter.log.debug(JSON.stringify(res.data));
                await adapter.setObjectNotExistsAsync(`${id}.stats.efficiency`, {
                    type: "channel",
                    common: {
                        name: "Efficiency",
                    },
                    native: {},
                });
                adapter.json2iob.parse(`${id}.stats.efficiency`, res.data, { forceIndex: true });
            })
            .catch(error => {
                if (error.response && error.response.status === 404) {
                    adapter.log.debug(`No efficiency data for ${id}`);
                    return;
                }
                adapter.log.error(error);
                error.response && adapter.log.error(JSON.stringify(error.response.data));
            });
    }
}

async function updateMyvPvData(adapter) {
    for (const device of adapter.deviceArray) {
        if (adapter.disabledPv.includes(device.systemId)) {
            continue;
        }
        const id = device.systemId;
        const url = endpoints.getPvDataEndpoint(id);
        await requestWithRetry(() =>
            adapter.requestClient({
                method: "get",
                url: url,
                headers: bearerAuth(adapter.session.access_token),
            }),
        )
            .then(async res => {
                adapter.log.debug(JSON.stringify(res.data));
                await adapter.setObjectNotExistsAsync(`${id}.pvData`, {
                    type: "channel",
                    common: {
                        name: "PV Data",
                    },
                    native: {},
                });
                adapter.json2iob.parse(`${id}.pvData`, res.data, { forceIndex: true });
            })
            .catch(error => {
                if (error.response && error.response.status === 404) {
                    adapter.log.debug(`No PV data for ${id} - disabling`);
                    adapter.disabledPv.push(device.systemId);
                    return;
                }
                adapter.log.error(error);
                error.response && adapter.log.error(JSON.stringify(error.response.data));
            });
    }
}

async function updateMyvExtras(adapter) {
    const extras = [
        { path: "/systems/$id/diagnostic-trouble-codes", channel: "troubleCodes", name: "Diagnostic Trouble Codes" },
        { path: "/rts/$id/devices", channel: "rts", name: "RTS Statistics (cycles / operation time)" },
        { path: "/hem/$id/mpc", channel: "mpc", name: "MPC live power usage per device" },
        { path: "/eebus/energy-management/$id", channel: "energyManagement", name: "Energy Management" },
        { path: "/ship/$id/self", channel: "eebus", name: "EEBUS" },
    ];
    for (const device of adapter.deviceArray) {
        const id = device.systemId;
        for (const extra of extras) {
            const url = endpoints.getExtraDataEndpoint(extra.path, id);
            await requestWithRetry(() =>
                adapter.requestClient({
                    method: "get",
                    url: url,
                    headers: bearerAuth(adapter.session.access_token),
                }),
            )
                .then(async res => {
                    adapter.log.debug(JSON.stringify(res.data));
                    await adapter.setObjectNotExistsAsync(`${id}.${extra.channel}`, {
                        type: "channel",
                        common: {
                            name: extra.name,
                        },
                        native: {},
                    });
                    adapter.json2iob.parse(`${id}.${extra.channel}`, res.data, { forceIndex: true });
                })
                .catch(error => {
                    if (error.response && (error.response.status === 404 || error.response.status === 400)) {
                        adapter.log.debug(`No ${extra.channel} data for ${id}`);
                        return;
                    }
                    adapter.log.error(error);
                    error.response && adapter.log.error(JSON.stringify(error.response.data));
                });
        }
    }
}

module.exports = {
    clearOldStats,
    updateMyStats,
    updateMyvEfficiency,
    updateMyvPvData,
    updateMyvExtras,
};
