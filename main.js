"use strict";

/*
 * Created with @iobroker/create-adapter v1.20.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const Json2iob = require("json2iob");
const axios = require("axios").default;
const tough = require("tough-cookie");
const { HttpsCookieAgent } = require("http-cookie-agent/http");
const myVaillantAuth = require("./lib/auth/myvaillant");
const deviceSync = require("./lib/sync/devices");
const roomSync = require("./lib/sync/rooms");
const diagnostics = require("./lib/diagnostics");
const ioPackage = require("./io-package.json");
const stateChangeHandler = require("./lib/handlers/stateChange");
const statsSync = require("./lib/sync/stats");
const multimatic = require("./lib/legacy/multimatic");

class Vaillant extends utils.Adapter {
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options]
     */
    constructor(options) {
        super({
            ...options,
            name: "vaillant",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.session = {};
        this.deviceArray = [];
        this.disabledRooms = [];
        this.disabledPv = [];
        this.json2iob = new Json2iob(this);
        this.cookieJar = new tough.CookieJar();
        this.requestClient = axios.create({
            withCredentials: true,
            httpsAgent: new HttpsCookieAgent({
                cookies: {
                    jar: this.cookieJar,
                },
            }),
            headers: {
                "x-app-identifier": "VAILLANT",
                "Accept-Language": "de-de",
                Accept: "application/json, text/plain, */*",
                "x-client-locale": "de-DE",
                "x-idm-identifier": "KEYCLOAK",
                "x-app-version": "3.9.0",
                "x-app-build": "25662",
                "ocp-apim-subscription-key": "1e0a2f3511fb4c5bbb1c7f9fedd20b1c",
                "User-Agent": "myVAILLANT/25662 CFNetwork/1496.0.7 Darwin/23.5.0",
            },
        });
        this.jar = new tough.CookieJar();
        this.mmClient = axios.create({
            withCredentials: true,
            httpsAgent: new HttpsCookieAgent({
                cookies: {
                    jar: this.jar,
                },
            }),
        });
        this.updateInterval = null;
        this.reauthInterval = null;
        this.reloginTimeout = null;
        this.isRelogin = false;
        this.baseHeader = {
            "Vaillant-Mobile-App": "multiMATIC v2.1.45 b389 (Android)",
            "User-Agent": "okhttp/3.10.0",
            "Content-Type": "application/json; charset=UTF-8",
            "Accept-Encoding": "gzip",
        };
        this.myvHeader = {
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "user-agent": "myVAILLANT/25662 CFNetwork/1496.0.7 Darwin/23.5.0",
            "accept-language": "de-de",
        };
        this.atoken = "";
        this.serialNr = "";
        this.adapterStopped = false;
        this.isSpineActive = true;
        this.reports = {};
        this.etags = {};
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        // passwordv2 is auto-decrypted by js-controller (encryptedNative). The old XOR-encrypted
        // "password" field is no longer used; users must re-enter their password once.
        if (!this.config.passwordv2) {
            this.log.error("No password set. Please open the adapter settings and enter your Vaillant App password again.");
            await diagnostics.ensureDiagnosticStates(this, ioPackage.common.version);
            await diagnostics.setAuthMode(this, "none");
            await diagnostics.setLastError(this, "No password configured");
            this.setState("info.connection", false, true);
            return;
        }
        this.config.password = this.config.passwordv2;
        if (this.config.interval < 5) {
            this.log.warn("Interval under 5min is not recommended. Set it back to 5min");
            this.config.interval = 5;
        }
        if (this.config && !this.config.smartPhoneId) {
            this.log.info("Generate new Id");
            this.config.smartPhoneId = this.makeid();
        }

        if (this.config.fetchReportsLimit > 60) {
            this.log.warn("Only 60 days of the last reports are supported. Set it back to 60 days");
            this.config.fetchReportsLimit = 60;
        }
        this.subscribeStates("*");
        // Reset the connection indicator during startup
        this.setState("info.connection", false, true);
        await diagnostics.ensureDiagnosticStates(this, ioPackage.common.version);
        if (this.config.myv) {
            await diagnostics.setAuthMode(this, "myvaillant");
            // Try to reuse a persisted session first so we skip the ALTCHA login on restarts.
            await this.loadSession();
            if (this.session.refresh_token) {
                this.log.info("Found persisted session, trying to refresh token");
                await this.refreshToken();
            }
            if (!this.session.access_token) {
                await this.myvLoginv2();
            }
            if (this.session.access_token) {
                this.log.info("Getting myv devices");
                await this.getMyvDeviceList();
                this.log.info("Receiving first time status");
                await this.updateMyvDevices();
                await this.updateMyvRooms();
                await this.updateMyvPvData();
                this.log.info("Receiving first time stats");
                await this.clearOldStats();
                await this.updateMyStats();
                await this.updateMyvEfficiency();
                await this.updateMyvExtras();
                this.updateInterval = this.setInterval(
                    async () => {
                        await this.updateMyvDevices();
                        await this.updateMyvRooms();
                        await this.updateMyvPvData();
                        await this.updateMyvExtras();
                    },
                    this.config.interval * 60 * 1000,
                );
                this.statInterval = this.setInterval(
                    async () => {
                        //run only between 00:00 and 00:11
                        const now = new Date();
                        if (now.getHours() === 0 && now.getMinutes() < 11) {
                            await this.updateMyStats();
                            await this.updateMyvEfficiency();
                        }
                    },
                    10 * 60 * 1000,
                );
            }
            this.refreshTokenInterval = this.setInterval(
                () => {
                    this.refreshToken();
                },
                ((this.session.expires_in || 3600) - 100) * 1000,
            );
        } else {
            await diagnostics.setAuthMode(this, "multimatic");
            this.login()
                .then(() => {
                    this.setState("info.connection", true, true);
                    this.getFacility()
                        .then(() => {
                            this.cleanConfigurations()
                                .then(async () => {
                                    this.log.info("Receiving first time status");
                                    this.getMethod(
                                        "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/system/v1/status",
                                        "status",
                                    ).catch(() => this.log.debug("Failed to get status"));

                                    await this.sleep(10000);

                                    this.log.info("Receiving first time systemcontrol");
                                    await this.getMethod(
                                        "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/systemcontrol/v1",
                                        "systemcontrol",
                                    ).catch(() => this.log.debug("Failed to get systemcontrol"));
                                    await this.sleep(10000);

                                    this.log.info("Receiving first time systemcontrol tli");
                                    await this.getMethod(
                                        "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/systemcontrol/tli/v1",
                                        "systemcontrol/tli",
                                    ).catch(() => this.log.debug("Failed to get tli systemcontrol"));
                                    await this.sleep(10000);

                                    this.log.info("Receiving first time livereport");
                                    await this.getMethod(
                                        "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/livereport/v1",
                                        "livereport",
                                    ).catch(() => this.log.debug("Failed to get livereport"));

                                    await this.sleep(10000);

                                    this.log.info("Receiving first time PVMetering");
                                    await this.getMethod(
                                        "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/spine/v1/currentPVMeteringInfo",
                                        "spine",
                                    ).catch(() => this.log.debug("Failed to get spine"));

                                    await this.sleep(10000);

                                    this.log.info("Receiving first time emf devices");
                                    await this.getMethod(
                                        "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/emf/v1/devices/",
                                        "emf",
                                    ).catch(() => this.log.debug("Failed to get emf"));
                                    this.log.debug(JSON.stringify(this.reports));

                                    await this.sleep(10000);

                                    this.log.info("Receiving first time hvac state");
                                    await this.getMethod(
                                        "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/hvacstate/v1/overview",
                                        "hvacstate",
                                    ).catch(() => this.log.debug("Failed to get hvacstate"));

                                    await this.sleep(10000);

                                    this.log.info("Receiving first time rooms");
                                    await this.getMethod(
                                        "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/rbr/v1/rooms",
                                        "rooms",
                                    )
                                        .catch(() => this.log.debug("Failed to get rooms"))
                                        .finally(() => {});
                                    await this.sleep(10000);
                                    if (this.config.fetchReports) {
                                        this.log.info("Receiving first time reports");
                                        // await this.receiveReports();
                                    }
                                })
                                .catch(() => {
                                    this.log.error("clean configuration failed");
                                });

                            this.updateInterval = this.setInterval(
                                () => {
                                    this.updateValues();
                                },
                                this.config.interval * 60 * 1000,
                            );
                            this.log.debug(`Set update interval to: ${this.config.interval}min`);
                        })
                        .catch(() => {
                            this.log.error("facility failed");
                        });
                })
                .catch(() => {
                    this.log.error("Login failed");
                });
        }
        // in this template all states changes inside the adapters namespace are subscribed
    }
    async myvLoginv2() {
        return myVaillantAuth.myvLoginv2(this);
    }

    async getMyvDeviceList() {
        return deviceSync.getMyvDeviceList(this);
    }

    async updateMyvDevices() {
        return deviceSync.updateMyvDevices(this);
    }

    async updateMyvRooms() {
        return roomSync.updateMyvRooms(this);
    }
    async clearOldStats() {
        return statsSync.clearOldStats(this);
    }
    async updateMyStats() {
        return statsSync.updateMyStats(this);
    }
    async updateMyvEfficiency() {
        return statsSync.updateMyvEfficiency(this);
    }
    async updateMyvPvData() {
        return statsSync.updateMyvPvData(this);
    }
    async updateMyvExtras() {
        return statsSync.updateMyvExtras(this);
    }
    async refreshToken() {
        return myVaillantAuth.refreshToken(this);
    }

    async persistSession() {
        return myVaillantAuth.persistSession(this);
    }

    async loadSession() {
        return myVaillantAuth.loadSession(this);
    }

    async clearSession() {
        return myVaillantAuth.clearSession(this);
    }
    updateValues() {
        return multimatic.updateValues(this);
    }

    login() {
        return multimatic.login(this);
    }
    authenticate(reject, resolve) {
        return multimatic.authenticate(this, reject, resolve);
    }
    async cleanConfigurations() {
        return multimatic.cleanConfigurations(this);
    }
    getFacility() {
        return multimatic.getFacility(this);
    }
    getMethod(url, path) {
        return multimatic.getMethod(this, url, path);
    }
    async setMethod(id, val) {
        return multimatic.setMethod(this, id, val);
    }
    makeid(length = 202) {
        let result = "";
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }

        return `multimatic_${result}`;
    }
    randomString(length = 202) {
        let result = "";
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }
    sleep(ms) {
        if (this.adapterStopped) {
            ms = 0;
        }
        return new Promise(resolve => this.setTimeout(resolve, ms));
    }
    /**
     * Recursively drops keys whose value is null so json2iob does not create the state as
     * type "mixed" and later flip it to "number" once a real value arrives. That type flip
     * is what makes history/charting adapters complain (e.g. rooms currentHumidity is often
     * null). Removing the key just skips the update and keeps the last known value.
     *
     * @param {unknown} obj
     * @returns {unknown}
     */
    removeNull(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.removeNull(item));
        }
        if (obj && typeof obj === "object") {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                if (value === null) {
                    continue;
                }
                result[key] = value && typeof value === "object" ? this.removeNull(value) : value;
            }
            return result;
        }
        return obj;
    }
    /**
  async receiveReports() {
  const date = new Date().toISOString().split("T")[0];
  this.log.debug(date);
  for (const id of Object.keys(this.reports)) {
  this.log.debug(id);
  this.log.debug(this.reports[id]);
  for (const report of this.reports[id]) {
  await this.sleep(2000);
  this.log.debug(report);
  await this.getMethod(
  "https://smart.vaillant.com/mobile/api/v4/facilities/$serial/emf/v1/devices/" +
  id +
  "?energyType=" +
  report.energyType +
  "&function=" +
  report.function +
  "&offset=6&start=" +
  date +
  "&timeRange=DAY",
  "reports." + id + "." + report.energyType + "." + report.function
  );
  }
  }
  }
  /**
   Is called when adapter shuts down - callback has to be called under any circumstances!
     
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.log.info("cleaned everything up...");
            this.adapterStopped = true;
            this.updateInterval && this.clearInterval(this.updateInterval);
            this.statInterval && this.clearInterval(this.statInterval);
            this.reauthInterval && this.clearInterval(this.reauthInterval);
            this.reloginTimeout && this.clearTimeout(this.reloginTimeout);
            this.refreshTimeout && this.clearTimeout(this.refreshTimeout);
            this.refreshTokenInterval && this.clearInterval(this.refreshTokenInterval);
            callback();
        } catch {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     *
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    async onStateChange(id, state) {
        return stateChangeHandler.handleStateChange(this, id, state);
    }
}

// @ts-expect-error parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options]
     */
    module.exports = options => new Vaillant(options);
} else {
    // otherwise start the instance directly
    new Vaillant();
}
