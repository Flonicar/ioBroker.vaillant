# ioBroker.vaillant

This adapter connects ioBroker to Vaillant heating systems via the myVaillant cloud API.

> ⚠️ This adapter uses an **unofficial Vaillant cloud API**.
> It may break at any time if Vaillant changes their backend.

---

## Status

* myVaillant login via Keycloak / PKCE is working
* Read access has been verified with a real installation
* Systems, status and statistics are received successfully
* Write commands are experimental and should be used carefully
* The old Okta-based login flow has been removed

---

## Requirements

* ioBroker installation
* myVaillant account
* Vaillant system connected to the cloud
* Supported location, for example `germany`

---

## Configuration

The admin UI is organized in tabs:

| Tab | Purpose |
|-----|---------|
| **myVaillant** | Login, password, location (select) |
| **Polling & data** | Status/stats intervals and per-feature fetch toggles |
| **Legacy multiMATIC** | Legacy-only options (`fetchReports`) |
| **Advanced** | Legacy state cleanup (`cleantype`) |

Recommended starting point:

```text
myv = true
user = your email
password = your password
location = germany
interval = 15
statsInterval = 1440
```

Optional API sources (DTC, RTS, MPC, EEBUS, connection status, time zone) are **off by default** to reduce Vaillant API quota usage. Enable only what you need.

`fetchReports` applies to **legacy multiMATIC only**, not myVaillant EMF statistics.

### Summary states

When `fetchSummary` is enabled, flat states are created under `{systemId}.summary.*` (outdoor temperature, operation mode) from the system status response without extra API calls.

---

## Supported Features

* Login via myVaillant using Keycloak / PKCE
* Discover available systems
* Read system status
* Read statistics if enabled
* Create ioBroker states from received API data

---

## Write Commands / Experimental

> ⚠️ Write commands may change heating behavior.
> Use them carefully. Read functionality has been verified; write functionality may require additional testing depending on the system.

### Example: Set room temperature

Sets a temporary override temperature for a heating zone.

```json
{
  "quickVeto": {
    "setpoint": 22,
    "duration": 3600
  }
}
```

### Example: Activate away mode

Switches the system into away mode.

```json
{
  "awayMode": {
    "active": true
  }
}
```

### Example: Custom command

Advanced users can send custom API payloads. This is experimental and may not work on all systems.

```json
{
  "customCommand": {
    "method": "PATCH",
    "url": "/systems/12345/zones/67890",
    "data": {
      "desiredRoomTemperatureSetpoint": 21
    }
  }
}
```

---

## Diagnostics

The adapter exposes additional instance states under `info.*` for troubleshooting:

| State | Description |
|-------|-------------|
| `info.connection` | Cloud connection indicator |
| `info.authMode` | Active path: `myvaillant`, `multimatic`, or `none` |
| `info.lastError` | Last sanitized error message (no tokens) |
| `info.lastSuccessfulPoll` | Unix timestamp (ms) of the last successful myVaillant device poll |
| `info.adapterVersion` | Installed adapter version |

Use `info.lastError` together with the adapter log to diagnose login or sync issues quickly.

---

## Limitations and Warnings

* This adapter uses an **unofficial Vaillant cloud API**
* The API may change at any time without notice
* The adapter depends on Vaillant cloud availability
* Write commands can affect heating configuration
* Not all systems or regions may behave identically
* Do not share logs containing credentials, tokens or authorization headers

---

## Breaking Changes

### 0.8.0

* Okta-based login has been removed
* Only myVaillant using Keycloak / PKCE is supported
* Legacy cloud behavior may no longer work

---

## Notes

* multiMATIC / sensoAPP legacy support is not actively maintained
* The current focus is myVaillant cloud integration
* Contributions and testing feedback are welcome
