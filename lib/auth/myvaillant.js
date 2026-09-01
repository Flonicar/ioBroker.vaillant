"use strict";

const qs = require("qs");
const { getCodeChallenge } = require("../pkce");
const { solveAltchaChallenge } = require("../altcha");
const { buildMyVaillantRealm } = require("../realm");
const { isValidPersistedSession } = require("../session");
const { sanitizeLogString } = require("../sanitize");
const { setLastError } = require("../diagnostics");
const { getTokenEndpoint, getAuthEndpoint, getAltchaChallengeEndpoint } = require("../api/endpoints");

const TOKEN_HEADERS = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/x-www-form-urlencoded",
    "x-app-identifier": "VAILLANT",
    "Accept-Language": "de-de",
    "x-client-locale": "de-DE",
    "x-idm-identifier": "KEYCLOAK",
    "x-app-version": "3.9.0",
    "x-app-build": "25662",
    "User-Agent": "myVAILLANT/25662 CFNetwork/1496.0.7 Darwin/23.5.0",
};

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function myvLoginv2(adapter) {
    const realm = buildMyVaillantRealm(adapter.config.location);
    const [code_verifier, codeChallenge] = getCodeChallenge();
    const authQuery = [
        "client_id=myvaillant",
        "redirect_uri=enduservaillant.page.link%3A%2F%2Flogin",
        `login_hint=${encodeURIComponent(adapter.config.user)}`,
        "response_mode=fragment",
        "response_type=code",
        "scope=offline_access%20openid",
        `code_challenge=${codeChallenge}`,
        "code_challenge_method=S256",
    ].join("&");

    let loginUrl = await adapter
        .requestClient({
            method: "GET",
            url: getAuthEndpoint(realm, authQuery),
            headers: adapter.myvHeader,
        })
        .then(res => {
            adapter.log.debug(JSON.stringify(res.data));
            if (typeof res.data !== "string" || !res.data.includes('action="')) {
                adapter.log.error("Login failed: no login form action found in auth response");
                return;
            }
            return res.data.split('action="')[1].split('"')[0];
        })
        .catch(error => {
            adapter.log.error(error);
            error.response && adapter.log.error(JSON.stringify(error.response.data));
            void setLastError(adapter, sanitizeLogString(error.message || "Login auth request failed"));
        });
    if (!loginUrl) {
        return;
    }
    loginUrl = loginUrl.replace(/&amp;/g, "&");

    const loginData = { username: adapter.config.user, password: adapter.config.password, credentialId: "" };
    await adapter
        .requestClient({
            method: "GET",
            url: getAltchaChallengeEndpoint(),
            headers: adapter.myvHeader,
        })
        .then(res => {
            adapter.log.debug(JSON.stringify(res.data));
            const altcha = solveAltchaChallenge(res.data);
            if (altcha) {
                loginData.altcha = altcha;
            }
        })
        .catch(error => {
            adapter.log.debug("Could not fetch or solve ALTCHA challenge, continuing without it");
            adapter.log.debug(error);
        });

    const response = await adapter
        .requestClient({
            method: "POST",
            url: loginUrl,
            headers: {
                accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "content-type": "application/x-www-form-urlencoded",
                origin: "null",
                "user-agent":
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1",
                "accept-language": "de-de",
            },
            data: qs.stringify(loginData),
        })
        .then(res => {
            adapter.log.debug(JSON.stringify(res.data));
            adapter.log.error("Login failed no code for myvLoginv2");
            if (typeof res.data === "string" && res.data.includes('polite">')) {
                const message = res.data.split('polite">')[1].split("<")[0].trim();
                adapter.log.error(message);
                void setLastError(adapter, message);
            } else {
                adapter.log.error("No redirect received. Check credentials or ALTCHA handling.");
                void setLastError(adapter, "No redirect received. Check credentials or ALTCHA handling.");
            }
        })
        .catch(error => {
            if (error && error.message.includes("Unsupported protocol")) {
                adapter.log.debug(JSON.stringify(error.message));
                adapter.log.debug(JSON.stringify(error.request._options.href));
                adapter.log.debug(JSON.stringify(error.request._options.hash));
                return qs.parse(error.request._options.href.split("#")[1]);
            }
            adapter.log.error(error);
            error.response && adapter.log.error(JSON.stringify(error.response.data));
            void setLastError(adapter, sanitizeLogString(error.message || "Login POST failed"));
        });
    if (!response || !response.code) {
        return;
    }
    await adapter
        .requestClient({
            method: "post",
            maxBodyLength: Infinity,
            url: getTokenEndpoint(realm),
            headers: TOKEN_HEADERS,
            data: qs.stringify({
                client_id: "myvaillant",
                grant_type: "authorization_code",
                code_verifier: code_verifier,
                code: response.code,
                redirect_uri: "enduservaillant.page.link://login",
            }),
        })
        .then(async res => {
            adapter.log.debug(JSON.stringify(res.data));
            if (res.data.access_token) {
                adapter.log.info("Login successful");
                adapter.session = res.data;
                await persistSession(adapter);
                adapter.setState("info.connection", true, true);
                void setLastError(adapter, "");
            }
        })
        .catch(error => {
            adapter.log.error(error);
            error.response && adapter.log.error(JSON.stringify(error.response.data));
            void setLastError(adapter, sanitizeLogString(error.message || "Token exchange failed"));
        });
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function refreshToken(adapter) {
    const realm = buildMyVaillantRealm(adapter.config.location);
    await adapter
        .requestClient({
            method: "post",
            url: getTokenEndpoint(realm),
            headers: TOKEN_HEADERS,
            data: qs.stringify({
                refresh_token: adapter.session.refresh_token,
                client_id: "myvaillant",
                grant_type: "refresh_token",
            }),
        })
        .then(async res => {
            adapter.log.debug(JSON.stringify(res.data));
            adapter.session = res.data;
            adapter.log.debug("Refresh successful");
            await persistSession(adapter);
            adapter.setState("info.connection", true, true);
            void setLastError(adapter, "");
        })
        .catch(async error => {
            adapter.log.error(error);
            error.response && adapter.log.error(JSON.stringify(error.response.data));
            const rejected = error.response && (error.response.status === 400 || error.response.status === 401);
            if (rejected) {
                adapter.log.warn("Refresh token rejected, running full login");
                adapter.session = {};
                await clearSession(adapter);
                await myvLoginv2(adapter);
                if (adapter.session.access_token) {
                    return;
                }
            }
            await adapter.setStateAsync("info.connection", false, true);
            void setLastError(adapter, sanitizeLogString(error.message || "Token refresh failed"));
        });
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function persistSession(adapter) {
    try {
        await adapter.setObjectNotExistsAsync("auth.session", {
            type: "state",
            common: {
                name: "OAuth session (access/refresh token)",
                type: "string",
                role: "json",
                read: true,
                write: false,
            },
            native: {},
        });
        const persisted = Object.assign({}, adapter.session, {
            _user: adapter.config.user,
            _location: adapter.config.location,
        });
        await adapter.setStateAsync("auth.session", JSON.stringify(persisted), true);
    } catch (error) {
        adapter.log.debug(`Could not persist session: ${error}`);
    }
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function loadSession(adapter) {
    try {
        const state = await adapter.getStateAsync("auth.session");
        if (!state || !state.val) {
            return;
        }
        const parsed = JSON.parse(state.val);
        if (!isValidPersistedSession(parsed, adapter.config.user, adapter.config.location)) {
            adapter.log.debug("Persisted session is invalid or belongs to a different account, ignoring");
            await clearSession(adapter);
            return;
        }
        adapter.session = parsed;
    } catch (error) {
        adapter.log.debug(`Could not load persisted session: ${error}`);
        adapter.session = {};
    }
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function clearSession(adapter) {
    try {
        await adapter.setStateAsync("auth.session", "", true);
    } catch (error) {
        adapter.log.debug(`Could not clear persisted session: ${error}`);
    }
}

module.exports = {
    myvLoginv2,
    refreshToken,
    persistSession,
    loadSession,
    clearSession,
    TOKEN_HEADERS,
};
