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

Optional API sources (DTC, RTS, MPC, EEBUS, connection status, time zone, **hourly EMF buckets**, **yearly report**) are **off by default** to reduce Vaillant API quota usage. Enable only what you need.

On HTTP **403** (API quota exceeded), cloud polls pause automatically for one hour.

`fetchReports` applies to **legacy multiMATIC only**, not myVaillant EMF statistics.

### EMF statistics resolutions

| Toggle | States suffix | Default |
|--------|---------------|---------|
| `fetchStats` | day buckets (`.day`) | on |
| `fetchStatsMonths` | month buckets (`.month`) | off |
| `fetchStatsHours` | hour buckets (`.hour`) | off |
| `fetchYearlyReport` | `{systemId}.stats.yearlyReport.*` | off |

`fetchReportsLimit` controls how many past **days** are requested for day buckets. `fetchStatsHoursLimit` controls the hour window (max. 72 hours).

### Summary states

When `fetchSummary` is enabled, flat states are created under `{systemId}.summary.*` (outdoor temperature, operation mode) from the system status response without extra API calls.

---

## myVaillant API coverage

Research reference (compared with [myPyllant](https://github.com/signalkraft/myPyllant) and real installations).  
Base URL: `https://api.vaillant-group.com/service-connected-control/end-user-app-api/v1`

### Implemented reads

| Area | API endpoint | Config toggle | Default | ioBroker states |
|------|--------------|---------------|---------|-----------------|
| Discovery | `GET /homes` | (always on login) | — | device list |
| Control type | `GET /systems/{id}/meta-info/control-identifier` | (discovery) | — | used for TLI vs VRC paths |
| Live status | `GET /systems/{id}/tli` or VRC system URL | `fetchStatus` | on | `{systemId}.*` (ETag caching) |
| Ambisense rooms | `GET /api/v1/ambisense/facilities/{id}/rooms` | `fetchRooms` | on | `{systemId}.rooms.*` |
| Ambisense capability | `GET …/ambisense/…/capability` | `fetchAmbisenseCapability` | off | `{systemId}.meta.ambisenseCapability.*` |
| EMF overview | `GET /emf/v2/{id}/currentSystem` | `fetchStats` | on | `{systemId}.stats.*` |
| EMF day buckets | `GET …/devices/{uuid}/buckets?resolution=DAY` | `fetchStats` | on | `….day.*` |
| EMF month buckets | `…&resolution=MONTH` | `fetchStatsMonths` | off | `….month.*` |
| EMF hour buckets | `…&resolution=HOUR` | `fetchStatsHours` | off | `….hour.*` |
| EMF yearly report | `GET /emf/v2/{id}/report/{year}` | `fetchYearlyReport` | off | `{systemId}.stats.yearlyReport.*` |
| EMF efficiency | `GET …/currentSystemWithEfficiency` | `fetchEfficiency` | on | `{systemId}.stats.efficiency.*` |
| PV live data | `GET /rts/{id}/currentPvData` | `fetchPvData` | on | `{systemId}.pvData.*` |
| Trouble codes | `GET /systems/{id}/diagnostic-trouble-codes` | `fetchTroubleCodes` | off | `{systemId}.troubleCodes.*` |
| RTS devices | `GET /rts/{id}/devices` | `fetchRts` | off | `{systemId}.rts.*` (often TLI) |
| MPC power | `GET /hem/{id}/mpc` | `fetchMpc` | off | `{systemId}.mpc.*` (often TLI) |
| Energy management | `GET /eebus/energy-management/{id}` | `fetchEnergyManagement` | off | `{systemId}.energyManagement.*` |
| EEBUS / SHIP | `GET /ship/{id}/self` | `fetchEebus` | off | `{systemId}.eebus.*` |
| Connection status | `GET …/meta-info/connection-status` | `fetchConnectionStatus` | off | `{systemId}.meta.connection.*`, `info.connection` |
| Time zone | `GET …/meta-info/time-zone` | `fetchTimeZone` | off | `{systemId}.meta.timeZone.*` (cached once) |
| Summary | derived from status JSON | `fetchSummary` | on | `{systemId}.summary.*` (no extra call) |

`fetchReports` / `fetchReportsLimit` apply to **legacy multiMATIC** (`smart.vaillant.com`) only — not myVaillant EMF.

### Implemented writes (experimental)

Via `{systemId}.remote.*`, zone states and `remotes.customCommand`:

* Zones: operation mode, setpoint, quick veto, setback, time windows, cooling
* DHW: boost, temperature, operation mode
* Circuits: heating curve, min flow temperature, heat-demand limit
* Ventilation: operation mode, fan stages, boost
* System: away mode, holiday, cooling-for-days
* Ambisense rooms: operation mode, quick veto, temperature setpoint (`remote.room.*`)
* EEBUS: enable/disable spine (`PUT /ship/{id}/self/spine`)
* Custom relative URLs for TLI and VRC700 controllers

### Known gaps (API exists, adapter does not cover yet)

| Topic | Notes |
|-------|-------|
| Ambisense time program write | `PUT …/rooms/{i}/timeprogram` — time program is **read** with rooms; changing it from ioBroker is not implemented |
| Legacy spine metering | Old multiMATIC API had `currentPVMeteringInfo`; myVaillant uses `currentPvData` instead |
| Further `meta-info` keys | Only `control-identifier`, `connection-status` and `time-zone` are known in public references |

### Quota and polling

Vaillant enforces API quotas (HTTP **403**). The adapter pauses all cloud polls for **one hour** after a 403.

| Risk | Recommendation |
|------|----------------|
| Low | `fetchStatus` + `fetchSummary` at 15 min interval |
| Medium | `fetchStats` (day) + `fetchEfficiency` once per day (`statsInterval` 1440) |
| High | `fetchStatsHours`, `fetchStatsMonths`, `fetchConnectionStatus`, many extras enabled together |
| Very high | Status interval under 15 min with all toggles on |

**Rule of thumb:** keep defaults, enable extras only when needed. Hour buckets use a short window (`fetchStatsHoursLimit`, max 72 h) because each device/mode/type combination is a separate request.

---

## Supported Features

* Login via myVaillant using Keycloak / PKCE
* Discover available systems
* Read system status
* Read statistics (day/month/hour buckets and optional yearly report)
* Create ioBroker states from received API data
* Automatic API quota pause on HTTP 403

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
