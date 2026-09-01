"use strict";

const crypto = require("node:crypto");

/**
 * Solves the ALTCHA proof-of-work challenge from Vaillant Keycloak login.
 *
 * @param {object} challenge
 * @returns {string|null}
 */
function solveAltchaChallenge(challenge) {
    if (!challenge || !challenge.parameters) {
        return null;
    }
    const parameters = challenge.parameters;
    const nonceBuf = Buffer.from(parameters.nonce, "hex");
    const saltBuf = Buffer.from(parameters.salt, "hex");
    const keyPrefixBuf = Buffer.from(parameters.keyPrefix, "hex");
    const cost = parameters.cost;
    const keyLength = parameters.keyLength || 32;
    const digest =
        {
            "PBKDF2/SHA-512": "sha512",
            "PBKDF2/SHA-384": "sha384",
        }[parameters.algorithm] || "sha256";

    const maxCounter = Math.max(cost * 10, 1000000);
    for (let counter = 0; counter <= maxCounter; counter++) {
        const counterBuf = Buffer.alloc(4);
        counterBuf.writeUInt32BE(counter, 0);
        const password = Buffer.concat([nonceBuf, counterBuf]);
        const derived = crypto.pbkdf2Sync(password, saltBuf, cost, keyLength, digest);
        if (derived.subarray(0, keyPrefixBuf.length).equals(keyPrefixBuf)) {
            const payload = {
                challenge: {
                    parameters: parameters,
                    signature: challenge.signature,
                },
                solution: { counter: counter, derivedKey: derived.toString("hex"), time: 0 },
            };
            return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
        }
    }
    return null;
}

module.exports = { solveAltchaChallenge };
