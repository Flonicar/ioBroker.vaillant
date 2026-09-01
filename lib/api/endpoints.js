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

function getMyvSystemWriteBase(identifier, deviceId) {
    const encodedSystemId = encodeURIComponent(deviceId);
    if (identifier === "tli") {
        return `${MYVAILLANT_END_USER_BASE}/systems/${encodedSystemId}/tli/`;
    }
    return `${MYVAILLANT_API_BASE}/${encodeURIComponent(identifier)}/v1/systems/${encodedSystemId}/`;
}

/**
 * @param {string} identifier
 * @param {string} deviceId
 * @param {string} tliPath path after /tli/
 * @param {string} vrcPath path after /systems/{id}/
 */
function getMyvDualEndpoint(identifier, deviceId, tliPath, vrcPath) {
    const encodedSystemId = encodeURIComponent(deviceId);
    if (identifier === "tli") {
        return `${MYVAILLANT_END_USER_BASE}/systems/${encodedSystemId}/tli/${tliPath}`;
    }
    return `${MYVAILLANT_API_BASE}/${encodeURIComponent(identifier)}/v1/systems/${encodedSystemId}/${vrcPath}`;
}

function getEebusSpineEndpoint(deviceId) {
    return `${MYVAILLANT_END_USER_BASE}/ship/${encodeURIComponent(deviceId)}/self/spine`;
}

function getHolidayWriteUrl(identifier, deviceId) {
    if (identifier === "tli") {
        return getMyvDualEndpoint(identifier, deviceId, "away-mode", "holiday");
    }
    return `${MYVAILLANT_API_BASE}/${encodeURIComponent(identifier)}/v1/systems/${encodeURIComponent(deviceId)}/holiday`;
}

function getVentilationCommandUrl(identifier, deviceId, ventilationIndex, postfix) {
    return getMyvDualEndpoint(
        identifier,
        deviceId,
        `ventilation/${ventilationIndex}/${postfix}`,
        `ventilation/${ventilationIndex}/${postfix}`,
    );
}

function getRoomConfigurationUrl(deviceId, roomIndex, urlCommand) {
    return `${MYVAILLANT_END_USER_BASE}/api/v1/ambisense/facilities/${encodeURIComponent(deviceId)}/rooms/${roomIndex}/configuration/${urlCommand}`;
}

function getCustomCommandUrl(identifier, deviceId, relativeUrl) {
    if (identifier === "tli") {
        return `${MYVAILLANT_END_USER_BASE}/systems/${encodeURIComponent(deviceId)}/tli/${relativeUrl}`;
    }
    return `${MYVAILLANT_API_BASE}/${encodeURIComponent(identifier)}/v1/systems/${encodeURIComponent(deviceId)}/${relativeUrl}`;
}

function getEmfCurrentSystemEndpoint(systemId) {
    return `${MYVAILLANT_END_USER_BASE}/emf/v2/${encodeURIComponent(systemId)}/currentSystem`;
}

function getEmfBucketsEndpoint(systemId, deviceUuid, resolution, operationMode, energyType, startDate, endDate) {
    return `${MYVAILLANT_END_USER_BASE}/emf/v2/${encodeURIComponent(systemId)}/devices/${encodeURIComponent(deviceUuid)}/buckets?resolution=${resolution}&operationMode=${operationMode}&energyType=${energyType}&startDate=${startDate}&endDate=${endDate}`;
}

function getEmfEfficiencyEndpoint(systemId, startDate, endDate) {
    return `${MYVAILLANT_END_USER_BASE}/emf/v2/${encodeURIComponent(systemId)}/currentSystemWithEfficiency?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&operationModes=HEATING&operationModes=COOLING&operationModes=DOMESTIC_HOT_WATER`;
}

function getEmfYearlyReportEndpoint(systemId, year) {
    return `${MYVAILLANT_END_USER_BASE}/emf/v2/${encodeURIComponent(systemId)}/report/${year}`;
}

function getPvDataEndpoint(systemId) {
    return `${MYVAILLANT_END_USER_BASE}/rts/${encodeURIComponent(systemId)}/currentPvData`;
}

function getExtraDataEndpoint(pathTemplate, systemId) {
    return `${MYVAILLANT_END_USER_BASE}${pathTemplate.replace("$id", encodeURIComponent(systemId))}`;
}

function getMetaInfoEndpoint(systemId, metaKey) {
    return `${MYVAILLANT_END_USER_BASE}/systems/${encodeURIComponent(systemId)}/meta-info/${metaKey}`;
}

function getAmbisenseCapabilityEndpoint(facilityId) {
    return `${MYVAILLANT_END_USER_BASE}/api/v1/ambisense/facilities/${encodeURIComponent(facilityId)}/capability`;
}

function getHeatDemandLimitedEndpoint(identifier, deviceId, circuitsId) {
    if (identifier === "tli") {
        return `${getMyvSystemWriteBase(identifier, deviceId)}circuit/${circuitsId}/heat-demand-limited-by-outside-temperature`;
    }
    return `${MYVAILLANT_API_BASE}/system-control/v1/systems/${encodeURIComponent(deviceId)}/circuits/${circuitsId}/heat-demand-limited-by-outside-temperature`;
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
    getMyvSystemWriteBase,
    getMyvDualEndpoint,
    getEebusSpineEndpoint,
    getHolidayWriteUrl,
    getVentilationCommandUrl,
    getRoomConfigurationUrl,
    getCustomCommandUrl,
    getEmfCurrentSystemEndpoint,
    getEmfBucketsEndpoint,
    getEmfEfficiencyEndpoint,
    getEmfYearlyReportEndpoint,
    getPvDataEndpoint,
    getExtraDataEndpoint,
    getMetaInfoEndpoint,
    getAmbisenseCapabilityEndpoint,
    getHeatDemandLimitedEndpoint,
};
