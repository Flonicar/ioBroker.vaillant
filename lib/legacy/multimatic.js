"use strict";

const axios = require("axios").default;
const tough = require("tough-cookie");
const traverse = require("traverse");
const { HttpsCookieAgent } = require("http-cookie-agent/http");
const diagnostics = require("../diagnostics");
const { sanitizeLogString } = require("../sanitize");

function updateValues(adapter) {
    adapter.log.debug("update values");
    cleanConfigurations(adapter)
        .then(async () => {
            await adapter.sleep(5000);
            await getMethod(adapter, "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/system/v1/status", "status").catch(() =>
                adapter.log.debug("Failed to get status"),
            );

            await adapter.sleep(20000);
            await getMethod(adapter, "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/systemcontrol/v1", "systemcontrol").catch(
                () => adapter.log.debug("Failed to get systemcontrol"),
            );

            await adapter.sleep(20000);
            await getMethod(
                adapter,
                "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/systemcontrol/tli/v1",
                "systemcontrol/tli",
            ).catch(() => adapter.log.debug("Failed to get tli systemcontrol"));

            await adapter.sleep(20000);
            await getMethod(adapter, "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/livereport/v1", "livereport").catch(() =>
                adapter.log.debug("Failed to get livereport"),
            );

            await adapter.sleep(20000);
            await getMethod(
                adapter,
                "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/spine/v1/currentPVMeteringInfo",
                "spine",
            ).catch(() => adapter.log.debug("Failed to get spine"));

            await adapter.sleep(20000);
            await getMethod(adapter, "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/emf/v1/devices/", "emf").catch(() =>
                adapter.log.debug("Failed to get emf"),
            );

            await adapter.sleep(10000);
            await getMethod(adapter, "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/rbr/v1/rooms", "rooms").catch(() =>
                adapter.log.debug("Failed to get rooms"),
            );
            if (adapter.config.fetchReports) {
                await adapter.sleep(20000);
                // await adapter.receiveReports();
            }
        })

        .catch(() => {
            adapter.log.error("clean configuration failed");
        });
}

function login(adapter) {
    return new Promise((resolve, reject) => {
        if (!adapter.config.password || !adapter.config.user) {
            adapter.log.warn("Missing username or password");
            reject();
            return;
        }
        adapter.jar = new tough.CookieJar();
        adapter.mmClient = axios.create({
            withCredentials: true,
            httpsAgent: new HttpsCookieAgent({
                cookies: {
                    jar: adapter.jar,
                },
            }),
        });
        const body = { smartphoneId: adapter.config.smartPhoneId, password: adapter.config.password, username: adapter.config.user };
        adapter.isRelogin && adapter.log.debug("Start relogin");
        adapter
            .mmClient({
                method: "POST",
                url: "https://smart.vaillant.com/mobile/api/v4/account/authentication/v1/token/new",
                headers: adapter.baseHeader,
                data: body,
            })
            .then(resp => {
                const body = resp.data;
                adapter.isRelogin && adapter.log.debug("Relogin completed start reauth");

                if (!body) {
                    adapter.log.error("Failed to login");
                    reject();
                    return;
                }
                adapter.log.debug(JSON.stringify(body));
                if (body.errorCode || !body.body.authToken) {
                    adapter.log.error(JSON.stringify(body));
                    reject();
                    return;
                }
                adapter.atoken = body.body.authToken;
                try {
                    adapter.log.debug("Login successful");
                    authenticate(adapter, reject, resolve);
                    adapter.reauthInterval && adapter.clearInterval(adapter.reauthInterval);
                    adapter.reauthInterval = adapter.setInterval(
                        () => {
                            login(adapter);
                        },
                        4 * 60 * 60 * 1000,
                    ); //4h;
                } catch (error) {
                    adapter.log.error(JSON.stringify(error));
                    error && adapter.log.error(JSON.stringify(error.stack));
                    reject();
                }
            })
            .catch(err => {
                adapter.log.error("Failed to login");
                if (err.response && err.response.status === 503) {
                    adapter.log.error(
                        "multiMATIC API returned 503 (legacy smart.vaillant.com). Enable myVaillant (myv) in adapter settings — the legacy API is often unavailable.",
                    );
                }
                adapter.log.error(err);
                err.response && adapter.log.error(JSON.stringify(err.response.data));
                err.response && adapter.log.error(err.response.status);
                void diagnostics.setLastError(adapter, sanitizeLogString(err.message || "multiMATIC login failed"));
                reject();
            });
    });
}

function authenticate(adapter, reject, resolve) {
    const authBody = {
        authToken: adapter.atoken,
        smartphoneId: adapter.config.smartPhoneId,
        username: adapter.config.user,
    };
    adapter
        .mmClient({
            method: "POST",
            url: "https://smart.vaillant.com/mobile/api/v4/account/authentication/v1/authenticate",
            headers: adapter.baseHeader,
            data: authBody,
        })
        .then(resp => {
            const body = resp.data;
            adapter.isRelogin = false;
            adapter.log.debug("Authentication successful");
            adapter.log.debug(JSON.stringify(body));
            adapter.setState("info.connection", true, true);
            if (resolve) {
                resolve();
            }
        })
        .catch(err => {
            adapter.isRelogin = false;
            adapter.log.error("Authentication failed");
            adapter.setState("info.connection", false, true);
            err && adapter.log.error(JSON.stringify(err));
            err.response && adapter.log.error(err.response.status);
            err.response && adapter.log.error(JSON.stringify(err.response.data));
            reject();
        });
}

async function cleanConfigurations(adapter) {
    if (adapter.config.cleantype) {
        adapter.log.debug("skip clean config");
        return;
    }
    adapter.log.debug("clean config");
    const pre = `${adapter.name}.${adapter.instance}`;
    const states = await adapter.getStatesAsync(`${pre}.*`);
    const allIds = Object.keys(states);
    for (const keyName of allIds) {
        if (keyName.indexOf(".configuration") !== -1) {
            try {
                await adapter.delObjectAsync(keyName.split(".").slice(2).join("."));
            } catch (error) {
                adapter.log.debug(JSON.stringify(error));
            }
        }
    }
}

function getFacility(adapter) {
    return new Promise((resolve, reject) => {
        adapter
            .mmClient({
                method: "GET",
                url: "https://smart.vaillant.com/mobile/api/v4/facilities",
                headers: adapter.baseHeader,
            })
            .then(async resp => {
                const body = resp.data;
                if (!body) {
                    reject();
                    return;
                }
                adapter.log.debug(JSON.stringify(body));
                if (body.errorCode || !body.body.facilitiesList || body.body.facilitiesList.length === 0) {
                    adapter.log.error(JSON.stringify(body));
                    reject();
                    return;
                }
                adapter.log.info(`${body.body.facilitiesList.length} facilities found`);
                const facility = body.body.facilitiesList[0];
                adapter.serialNr = facility.serialNumber;
                await adapter.setObjectNotExistsAsync(facility.serialNumber, {
                    type: "device",
                    common: {
                        name: facility.name,
                        role: "indicator",
                    },
                    native: {},
                });
                try {
                    traverse(facility).forEach(function (value) {
                        if (this.path.length > 0 && this.isLeaf) {
                            const modPath = this.path;
                            this.path.forEach((pathElement, pathIndex) => {
                                if (!isNaN(parseInt(pathElement))) {
                                    let stringPathIndex = `${parseInt(pathElement) + 1}`;
                                    while (stringPathIndex.length < 2) {
                                        stringPathIndex = `0${stringPathIndex}`;
                                    }
                                    const key = this.path[pathIndex - 1] + stringPathIndex;
                                    const parentIndex = modPath.indexOf(pathElement) - 1;
                                    modPath[parentIndex] = key;
                                    modPath.splice(parentIndex + 1, 1);
                                }
                            });
                            adapter
                                .setObjectNotExistsAsync(`${facility.serialNumber}.general.${modPath.join(".")}`, {
                                    type: "state",
                                    common: {
                                        name: this.key,
                                        role: "indicator",
                                        type: typeof value,
                                        write: false,
                                        read: true,
                                    },
                                    native: {},
                                })
                                .then(() => {
                                    if (typeof value === "object") {
                                        value = JSON.stringify(value);
                                    }
                                    adapter.setState(`${facility.serialNumber}.general.${modPath.join(".")}`, value, true);
                                });
                        }
                    });
                    resolve();
                } catch (error) {
                    adapter.log.error(error);
                    adapter.log.error(error.stack);
                    reject();
                }
            })
            .catch(err => {
                adapter.log.error(err);
                err.response && adapter.log.error(JSON.stringify(err.response.data));
                reject();
            });
    });
}

function getMethod(adapter, url, path) {
    return new Promise((resolve, reject) => {
        adapter.log.debug(`get method: ${url} ${path}`);
        if (adapter.isRelogin || adapter.adapterStopped) {
            adapter.log.debug(`Instance is relogining ignores: ${path}`);
            resolve();
            return;
        }
        if (path === "spine" && !adapter.isSpineActive) {
            resolve();
            return;
        }
        if (path === "emf") {
            adapter.reports = {};
        }
        adapter.log.debug(`Get: ${path}`);

        url = url.replace("/$serial/", `/${adapter.serialNr}/`);

        adapter
            .mmClient({
                method: "GET",
                url: url,
                headers: adapter.baseHeader,
            })
            .then(resp => {
                const body = resp.data;
                if (body && body.errorCode) {
                    if (body.errorCode === "SPINE_NOT_SUPPORTED_BY_FACILITY") {
                        adapter.isSpineActive = false;
                    }
                    adapter.log.debug(JSON.stringify(body.errorCode));
                    reject();
                    return;
                }
                adapter.log.debug(`${path} successful`);
                adapter.log.debug(JSON.stringify(body));
                if (!body) {
                    resolve();
                    return;
                }
                if (path.indexOf("reports.") !== -1) {
                    adapter.json2iob.parse(`${adapter.serialNr}.${path}`, body.body, { forceIndex: true, channelName: "Reports" });
                    resolve();
                    return;
                }
                try {
                    traverse(body.body).forEach(function (value) {
                        if (this.path.length > 0 && this.isLeaf) {
                            const modPath = this.path;
                            this.path.forEach((pathElement, pathIndex) => {
                                if (!isNaN(parseInt(pathElement))) {
                                    let stringPathIndex = `${parseInt(pathElement) + 1}`;
                                    while (stringPathIndex.length < 2) {
                                        stringPathIndex = `0${stringPathIndex}`;
                                    }
                                    const key = this.path[pathIndex - 1] + stringPathIndex;
                                    const parentIndex = modPath.indexOf(pathElement) - 1;
                                    modPath[parentIndex] = key;
                                    modPath.splice(parentIndex + 1, 1);
                                }
                            });
                            if (path === "livereport" && modPath.length > 2) {
                                modPath[1] = this.parent.node._id;
                                modPath[0] = this.parent.parent.parent.node._id ? this.parent.parent.parent.node._id : modPath[0];
                            }
                            if (path === "livereport" && modPath.length == 2) {
                                modPath[0] = this.parent.node._id;
                            }

                            if (path === "systemcontrol" && modPath[0].indexOf("parameters") !== -1 && modPath[1] === "name") {
                                //add value field for parameters
                                adapter.setObjectNotExistsAsync(`${adapter.serialNr}.${path}.${modPath[0]}.parameterValue`, {
                                    type: "state",
                                    common: {
                                        name: `Value for ${value}. See definition for values.`,
                                        role: "indicator",
                                        type: "mixed",
                                        write: true,
                                        read: true,
                                    },
                                    native: {},
                                });
                            }

                            if (path === "emf") {
                                if (modPath[0].indexOf("reports") !== -1) {
                                    modPath[0] = `${this.parent.node.function}_${this.parent.node.energyType}`;
                                    if (this.parent.parent && this.parent.parent.parent && this.parent.parent.parent.node.id) {
                                        const id = this.parent.parent.parent.node.id;
                                        if (!adapter.reports[id]) {
                                            adapter.reports[id] = [];
                                        }
                                        adapter.reports[id].push({
                                            function: this.parent.node.function,
                                            energyType: this.parent.node.energyType,
                                        });
                                    }
                                }
                            }

                            adapter
                                .setObjectNotExistsAsync(`${adapter.serialNr}.${path}.${modPath.join(".")}`, {
                                    type: "state",
                                    common: {
                                        name: this.key,
                                        role: "indicator",
                                        type: value ? typeof value : "mixed",
                                        write: true,
                                        read: true,
                                    },
                                    native: {},
                                })
                                .then(() => {
                                    if (typeof value === "object") {
                                        value = JSON.stringify(value);
                                    }
                                    adapter.setState(`${adapter.serialNr}.${path}.${modPath.join(".")}`, value, true);
                                });
                        } else if (path === "systemcontrol" && this.path.length > 0 && !isNaN(this.path[this.path.length - 1])) {
                            const modPath = this.path;
                            this.path.forEach((pathElement, pathIndex) => {
                                if (!isNaN(parseInt(pathElement))) {
                                    let stringPathIndex = `${parseInt(pathElement) + 1}`;
                                    while (stringPathIndex.length < 2) {
                                        stringPathIndex = `0${stringPathIndex}`;
                                    }
                                    const key = this.path[pathIndex - 1] + stringPathIndex;
                                    const parentIndex = modPath.indexOf(pathElement) - 1;
                                    modPath[parentIndex] = key;

                                    modPath.splice(parentIndex + 1, 1);
                                }
                            });

                            if (this.node.name) {
                                adapter.setObjectNotExistsAsync(`${adapter.serialNr}.${path}.${modPath.join(".")}`, {
                                    type: "state",
                                    common: {
                                        name: this.node.name,
                                        role: "indicator",
                                        type: "mixed",
                                        write: true,
                                        read: true,
                                    },
                                    native: {},
                                });
                            }
                        }
                    });
                    resolve();
                } catch (error) {
                    adapter.log.error(error);
                    adapter.log.error(error.stack);
                    reject();
                }
            })
            .catch(err => {
                const resp = err.response;
                const body = resp && resp.data;
                if (body && body.errorCode) {
                    if (body.errorCode === "SPINE_NOT_SUPPORTED_BY_FACILITY") {
                        adapter.isSpineActive = false;
                    }
                    adapter.log.debug(JSON.stringify(body.errorCode));
                    reject();
                    return;
                }
                adapter.log.debug(`Error response from: ${path}`);
                adapter.setState("info.connection", false, true);
                if ((resp && resp.status === 401) || JSON.stringify(body) === "NOT_AUTHORIZED") {
                    adapter.log.info(JSON.stringify(body));
                    if (!adapter.isRelogin) {
                        adapter.log.info("401 Error try to relogin.");
                        adapter.isRelogin = true;
                        adapter.reloginTimeout && adapter.clearTimeout(adapter.reloginTimeout);
                        adapter.reloginTimeout = adapter.setTimeout(() => {
                            adapter.log.debug("Start relogin");
                            login(adapter)
                                .then(() => {
                                    adapter.log.debug("Relogin completed");
                                })
                                .catch(() => {
                                    adapter.log.error("Relogin failed");
                                });
                        }, 10000);
                    } else {
                        adapter.log.info("Instance is already trying to relogin.");
                    }
                } else {
                    adapter.log.error(err);
                    resp && adapter.log.error(resp.status);
                    body && adapter.log.error(JSON.stringify(body));
                    adapter.log.error(`Failed to get:${path}`);
                }
                reject();
            });
    });
}

function setMethod(adapter, id, val) {
    // eslint-disable-next-line
    return new Promise(async (resolve, reject) => {
        const idArray = id.split(".");
        const action = idArray[idArray.length - 1];
        const idPath = id.split(".").splice(2).slice(0, 3);
        let path;
        let url = "";
        let body = {};
        if (id.indexOf("configuration") !== -1) {
            const idState = await adapter.getStateAsync(`${idPath.join(".")}._id`);
            path = idArray.splice(4);
            if (idState && idState.val) {
                path.splice(1, 0, idState.val);
            }
            path[0] = path[0].replace(/[0-9]/g, "");
            path = path.join("/");
            url = `https://smart.vaillant.com/mobile/api/v4/facilities/${adapter.serialNr}/${idPath[1]}/v1/${path}`;
            if (idPath[1] === "rooms") {
                let roomId = idPath[2].replace("rooms", "");
                roomId = parseInt(roomId) - 1;
                url = `https://smart.vaillant.com/mobile/api/v4/facilities/${adapter.serialNr}/rbr/v1/rooms/${roomId}/configuration/${
                    action
                }`;
            }
            body[action] = val;
            if (val === "" || val === null || val === undefined) {
                body = null;
            }

            // body["duration"] = 180;
        } else {
            const pathState = await adapter.getStateAsync(`${idPath.join(".")}.link.resourceLink`);
            if (pathState) {
                url = `https://smart.vaillant.com/mobile/api/v4${pathState.val}`;
                const action = pathState.val.split("/").pop();
                const subBody = {};
                subBody[action] = val;
                body[action] = subBody;
            }
        }
        adapter.log.debug(url);
        adapter.log.debug(JSON.stringify(body));
        adapter
            .mmClient({
                method: "PUT",
                url: url,
                headers: adapter.baseHeader,
                data: body,
            })
            .then(resp => {
                try {
                    adapter.log.debug(JSON.stringify(resp.data));
                    resolve();
                } catch (error) {
                    adapter.log.error(JSON.stringify(error));
                    error && adapter.log.error(error.stack);
                    reject();
                }
            })
            .catch(err => {
                adapter.log.error(err);
                url && adapter.log.error(url);
                err.response && adapter.log.error(JSON.stringify(err.response.data));
                reject();
            });
    });
}

module.exports = {
    updateValues,
    login,
    authenticate,
    cleanConfigurations,
    getFacility,
    getMethod,
    setMethod,
};
