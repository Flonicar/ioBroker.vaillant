"use strict";

const { getRoomsEndpoint } = require("../api/endpoints");
const { requestWithRetry } = require("../api/client");
const { isFetchEnabled } = require("../config/features");

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function updateMyvRooms(adapter) {
    if (!isFetchEnabled(adapter, "fetchRooms")) {
        return;
    }
    for (const device of adapter.deviceArray) {
        if (adapter.disabledRooms.includes(device.systemId)) {
            continue;
        }
        const url = getRoomsEndpoint(device.systemId);
        const headers = {
            Authorization: `Bearer ${adapter.session.access_token}`,
        };
        if (adapter.etags[url]) {
            headers["If-None-Match"] = adapter.etags[url];
        }
        try {
            const res = await requestWithRetry(() =>
                adapter.requestClient({
                    method: "get",
                    url: url,
                    headers: headers,
                }),
            );
            adapter.log.debug(JSON.stringify(res.data));

            const id = `${device.systemId}.rooms`;
            if (res.headers.etag) {
                adapter.etags[url] = res.headers.etag;
            }
            adapter.json2iob.parse(id, adapter.removeNull(res.data), {
                write: true,
                channelName: "Rooms",
                preferedArrayName: "roomConfiguration/name",
            });
        } catch (error) {
            if (error.response && error.response.status === 304) {
                adapter.log.debug(`No changes for ${url}`);
                return;
            }

            adapter.log.error(`Failed to get room status for ${device.systemId}`);
            adapter.log.error(error);
            error.response && adapter.log.error(JSON.stringify(error.response.data));
            adapter.log.info("Stop fetching of rooms until restart");
            adapter.disabledRooms.push(device.systemId);
        }
    }
}

module.exports = { updateMyvRooms };
