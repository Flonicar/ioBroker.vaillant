"use strict";

const endpoints = require("../api/endpoints");
const { bearerAuth, requestWithRetry } = require("../api/client");
const { isFetchEnabled } = require("../config/features");

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {string} systemId
 * @param {string} channelSuffix
 * @param {string} channelName
 * @param {unknown} data
 */
async function writeMetaChannel(adapter, systemId, channelSuffix, channelName, data) {
    await adapter.setObjectNotExistsAsync(`${systemId}.${channelSuffix}`, {
        type: "channel",
        common: { name: channelName },
        native: {},
    });
    adapter.json2iob.parse(`${systemId}.${channelSuffix}`, data, { forceIndex: true });
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function updateConnectionStatus(adapter) {
    if (!isFetchEnabled(adapter, "fetchConnectionStatus")) {
        return;
    }
    for (const device of adapter.deviceArray) {
        const id = device.systemId;
        try {
            const res = await requestWithRetry(() =>
                adapter.requestClient({
                    method: "get",
                    url: endpoints.getMetaInfoEndpoint(id, "connection-status"),
                    headers: bearerAuth(adapter.session.access_token),
                }),
            );
            adapter.log.debug(JSON.stringify(res.data));
            await writeMetaChannel(adapter, id, "meta.connection", "Connection Status", res.data);
            const connected = res.data?.connected === true || res.data?.status === "CONNECTED";
            adapter.setState("info.connection", connected, true);
        } catch (error) {
            if (error.response && (error.response.status === 404 || error.response.status === 400)) {
                adapter.log.debug(`No connection-status for ${id}`);
                continue;
            }
            adapter.log.error(error);
            error.response && adapter.log.error(JSON.stringify(error.response.data));
        }
    }
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function updateTimeZone(adapter) {
    if (!isFetchEnabled(adapter, "fetchTimeZone")) {
        return;
    }
    for (const device of adapter.deviceArray) {
        const id = device.systemId;
        const existing = await adapter.getStateAsync(`${id}.meta.timeZone.cached`);
        if (existing && existing.val === true) {
            adapter.log.debug(`Skip time-zone fetch for ${id} (already cached)`);
            continue;
        }
        try {
            const res = await requestWithRetry(() =>
                adapter.requestClient({
                    method: "get",
                    url: endpoints.getMetaInfoEndpoint(id, "time-zone"),
                    headers: bearerAuth(adapter.session.access_token),
                }),
            );
            adapter.log.debug(JSON.stringify(res.data));
            await writeMetaChannel(adapter, id, "meta.timeZone", "Time Zone", res.data);
            await adapter.setObjectNotExistsAsync(`${id}.meta.timeZone.cached`, {
                type: "state",
                common: {
                    name: "Time zone cached",
                    type: "boolean",
                    role: "indicator",
                    read: true,
                    write: false,
                    def: true,
                },
                native: {},
            });
            adapter.setState(`${id}.meta.timeZone.cached`, true, true);
        } catch (error) {
            if (error.response && (error.response.status === 404 || error.response.status === 400 || error.response.status === 403)) {
                adapter.log.debug(`No time-zone for ${id}`);
                continue;
            }
            adapter.log.error(error);
            error.response && adapter.log.error(JSON.stringify(error.response.data));
        }
    }
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function updateAmbisenseCapability(adapter) {
    if (!isFetchEnabled(adapter, "fetchAmbisenseCapability")) {
        return;
    }
    for (const device of adapter.deviceArray) {
        const id = device.systemId;
        try {
            const res = await requestWithRetry(() =>
                adapter.requestClient({
                    method: "get",
                    url: endpoints.getAmbisenseCapabilityEndpoint(id),
                    headers: bearerAuth(adapter.session.access_token),
                }),
            );
            adapter.log.debug(JSON.stringify(res.data));
            await writeMetaChannel(adapter, id, "meta.ambisenseCapability", "Ambisense Capability", res.data);
        } catch (error) {
            if (error.response && (error.response.status === 404 || error.response.status === 400)) {
                adapter.log.debug(`No ambisense capability for ${id}`);
                continue;
            }
            adapter.log.error(error);
            error.response && adapter.log.error(JSON.stringify(error.response.data));
        }
    }
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function updateMyvMeta(adapter) {
    await updateConnectionStatus(adapter);
    await updateTimeZone(adapter);
    await updateAmbisenseCapability(adapter);
}

module.exports = {
    updateMyvMeta,
    updateConnectionStatus,
    updateTimeZone,
    updateAmbisenseCapability,
};
