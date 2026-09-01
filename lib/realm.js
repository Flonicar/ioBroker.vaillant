"use strict";

const ALLOWED_LOCATIONS = new Set(["germany", "denmark", "switzerland", "austria", "belgium"]);
const ALLOWED_BRANDS = new Set(["vaillant"]);

/**
 * @param {string} location
 * @param {string} [brand]
 * @returns {string}
 */
function buildMyVaillantRealm(location, brand = "vaillant") {
    const normalizedBrand = String(brand || "")
        .trim()
        .toLowerCase();
    const normalizedLocation = String(location || "")
        .trim()
        .toLowerCase();
    if (!ALLOWED_BRANDS.has(normalizedBrand)) {
        throw new Error(`Unsupported myVAILLANT brand: ${brand}`);
    }
    if (!ALLOWED_LOCATIONS.has(normalizedLocation)) {
        throw new Error(`Invalid myVAILLANT location "${location}". Supported values: germany, denmark, switzerland, austria, belgium`);
    }
    return `${normalizedBrand}-${normalizedLocation}-b2c`;
}

module.exports = { buildMyVaillantRealm, ALLOWED_LOCATIONS, ALLOWED_BRANDS };
