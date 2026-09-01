"use strict";

const { expect } = require("chai");
const { isValidPersistedSession } = require("./session");

describe("lib/session", () => {
    it("accepts matching persisted sessions", () => {
        const session = { refresh_token: "rt", _user: "user@example.com", _location: "germany" };
        expect(isValidPersistedSession(session, "user@example.com", "germany")).to.equal(true);
    });

    it("rejects malformed or mismatched sessions", () => {
        expect(isValidPersistedSession(null, "u", "germany")).to.equal(false);
        expect(isValidPersistedSession({}, "u", "germany")).to.equal(false);
        expect(isValidPersistedSession({ refresh_token: "rt" }, "u", "germany")).to.equal(false);
        expect(isValidPersistedSession({ refresh_token: "rt", _user: "a", _location: "germany" }, "b", "germany")).to.equal(false);
        expect(isValidPersistedSession({ refresh_token: "rt", _user: "a", _location: "austria" }, "a", "germany")).to.equal(false);
    });
});
