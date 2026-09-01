"use strict";

const nock = require("nock");
const { expect } = require("chai");
const axios = require("axios");
const { getHomesEndpoint, getTokenEndpoint } = require("../lib/api/endpoints");
const { buildMyVaillantRealm } = require("../lib/realm");
const homesFixture = require("./fixtures/homes.json");

describe("HTTP fixtures (nock)", () => {
    afterEach(() => {
        nock.cleanAll();
    });

    it("fetches homes with a bearer token", async () => {
        const scope = nock("https://api.vaillant-group.com")
            .get("/service-connected-control/end-user-app-api/v1/homes")
            .matchHeader("authorization", "Bearer test-token")
            .reply(200, homesFixture);

        const response = await axios.get(getHomesEndpoint(), {
            headers: { Authorization: "Bearer test-token" },
        });

        expect(response.data).to.deep.equal(homesFixture);
        expect(scope.isDone()).to.equal(true);
    });

    it("refreshes an OAuth token against the realm endpoint", async () => {
        const realm = buildMyVaillantRealm("germany");
        const scope = nock("https://identity.vaillant-group.com")
            .post(`/auth/realms/${realm}/protocol/openid-connect/token`)
            .reply(200, {
                access_token: "new-access",
                refresh_token: "new-refresh",
                expires_in: 3600,
            });

        const response = await axios.post(
            getTokenEndpoint(realm),
            "refresh_token=old-refresh&client_id=myvaillant&grant_type=refresh_token",
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        );

        expect(response.data.access_token).to.equal("new-access");
        expect(scope.isDone()).to.equal(true);
    });
});
