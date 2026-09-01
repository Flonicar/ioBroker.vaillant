"use strict";

const MYVAILLANT_API_BASE = "https://api.vaillant-group.com/service-connected-control";
const MYVAILLANT_END_USER_BASE = `${MYVAILLANT_API_BASE}/end-user-app-api/v1`;
const IDENTITY_BASE = "https://identity.vaillant-group.com";

function getHomesEndpoint() {
    return `${MYVAILLANT_END_USER_BASE}/homes`;
}

function getControlIdentifierEndpoint(systemId) {
    return `${MYVAILLANT_END_USER_BASE}/systems/${encodeURIComponent(systemId)}/meta-info/control-identifier`;
}

function getSystemEndpoint(identifier, systemId) {
    const encodedSystemId = encodeURIComponent(systemId);
    if (identifier === "tli") {
        return `${MYVAILLANT_END_USER_BASE}/systems/${encodedSystemId}/${encodeURIComponent(identifier)}`;
    }
    return `${MYVAILLANT_API_BASE}/${encodeURIComponent(identifier)}/v1/systems/${encodedSystemId}`;
}

function getRoomsEndpoint(facilityId) {
    return `${MYVAILLANT_END_USER_BASE}/api/v1/ambisense/facilities/${encodeURIComponent(facilityId)}/rooms`;
}

function getTokenEndpoint(realm) {
    return `${IDENTITY_BASE}/auth/realms/${realm}/protocol/openid-connect/token`;
}

function getAuthEndpoint(realm, query) {
    return `${IDENTITY_BASE}/auth/realms/${realm}/protocol/openid-connect/auth?${query}`;
}

function getAltchaChallengeEndpoint() {
    return `${IDENTITY_BASE}/api/altcha/challenge`;
}

module.exports = {
    MYVAILLANT_API_BASE,
    MYVAILLANT_END_USER_BASE,
    IDENTITY_BASE,
    getHomesEndpoint,
    getControlIdentifierEndpoint,
    getSystemEndpoint,
    getRoomsEndpoint,
    getTokenEndpoint,
    getAuthEndpoint,
    getAltchaChallengeEndpoint,
};
