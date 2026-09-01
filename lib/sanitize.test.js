"use strict";

const { expect } = require("chai");
const { sanitizeLogString, sanitizeLogData, stringifyForLog } = require("./sanitize");

describe("lib/sanitize", () => {
    it("redacts bearer tokens in strings", () => {
        const input = "Authorization: Bearer secret-token-123";
        expect(sanitizeLogString(input)).to.equal("Authorization: Bearer [REDACTED]");
    });

    it("redacts sensitive JSON fields", () => {
        const data = {
            user: "demo",
            password: "secret",
            nested: { refresh_token: "abc" },
        };
        const sanitized = sanitizeLogData(data);
        expect(sanitized.password).to.equal("[REDACTED]");
        expect(sanitized.nested.refresh_token).to.equal("[REDACTED]");
        expect(sanitized.user).to.equal("demo");
    });

    it("stringifies sanitized objects", () => {
        const output = stringifyForLog({ access_token: "x", ok: true });
        expect(output).to.include("[REDACTED]");
        expect(output).to.include('"ok":true');
    });
});
