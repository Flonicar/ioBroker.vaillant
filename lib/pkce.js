"use strict";

const crypto = require("node:crypto");

/**
 * @returns {[string, string]} code_verifier and S256 code_challenge (base64url)
 */
function getCodeChallenge() {
    const chars = "0123456789abcdef";
    let codeVerifier = "";
    for (let i = 64; i > 0; --i) {
        codeVerifier += chars[Math.floor(Math.random() * chars.length)];
    }
    let hash = crypto.createHash("sha256").update(codeVerifier).digest("base64");
    hash = hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    return [codeVerifier, hash];
}

module.exports = { getCodeChallenge };
