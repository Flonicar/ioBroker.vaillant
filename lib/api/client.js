"use strict";

/**
 * @param {string} accessToken
 * @returns {{Authorization: string}}
 */
function bearerAuth(accessToken) {
    return {
        Authorization: `Bearer ${accessToken}`,
    };
}

module.exports = { bearerAuth };
