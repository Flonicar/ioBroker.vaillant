# Agent-Anleitung (ioBroker.vaillant Fork)

Kurzreferenz für Releases und Repo-Kontext. Repo: **Flonicar/ioBroker.vaillant** (Fork von TA2k).

## Wichtig: `gh` immer mit `--repo`

In diesem Workspace zeigt `gh` standardmäßig auf **TA2k/ioBroker.vaillant**. Alle GitHub-CLI-Befehle für Releases, Issues, Actions usw. müssen explizit sein:

```bash
gh release list --repo Flonicar/ioBroker.vaillant
gh run list --repo Flonicar/ioBroker.vaillant
```

## Release-Checkliste (immer vollständig)

Ein Release ist **erst fertig**, wenn alle Schritte erledigt sind — **nicht** nur Tag pushen.

| Schritt | Aktion |
|--------|--------|
| 1 | `package.json` und `io-package.json` → gleiche Version |
| 2 | `io-package.json` → `common.news` für die neue Version in **allen** Sprachen (wie bei 1.0.3) |
| 2b | Neue `native`-Keys in `io-package.json` und `admin/jsonConfig.json` konsistent? Defaults quota-sicher? |
| 3 | `npm test` (und bei Bedarf `npm run check`, `npm run lint`) |
| 4 | Commit, z. B. `chore(release): prepare version X.Y.Z` |
| 5 | Tag `vX.Y.Z` erstellen und nach `origin` pushen |
| 6 | **GitHub Release** auf dem Fork anlegen (siehe unten) — sonst zeigt GitHub weiterhin ein altes „Latest release“ |
| 7 | CI prüfen: `gh run list --repo Flonicar/ioBroker.vaillant --workflow "Test and Release"` |

### GitHub Release anlegen (Pflicht)

Tag allein reicht nicht. Ohne Release-Seite bleibt z. B. **v0.7.2** als „Latest“ sichtbar.

```bash
gh release create vX.Y.Z \
  --repo Flonicar/ioBroker.vaillant \
  --title "vX.Y.Z" \
  --latest \
  --notes "Kurzbeschreibung + Install-URL"
```

**Install-URL für ioBroker** (in Release-Notes angeben):

```
https://github.com/Flonicar/ioBroker.vaillant/tarball/vX.Y.Z
```

### Was wir bewusst nicht automatisch machen

- **npm publish**: Deploy-Job in `.github/workflows/test-and-release.yml` ist auskommentiert (kein NPM_TOKEN). Installation läuft über GitHub/tarball, nicht über den offiziellen ioBroker-Adapter-Store.

## Vor jedem Release

Siehe `docs/UPSTREAM-SYNC.md`: upstream fetchen, Drift prüfen, ggf. mergen.

## Smoke-Test nach Update (Betrieb)

- Adapter-Instanz stoppen → von tarball/Git installieren → starten
- Log: Login, System gefunden, Status/Stats ohne Fehler
- Optional: `remote.Refresh` toggeln (nur **debug**-Log, nicht info)

## Projekt-Kontext

- **Upstream**: TA2k/ioBroker.vaillant
- **Fork-Remote**: `origin` → Flonicar
- **Struktur**: `lib/` (api, auth, config, handlers, sync, legacy), schlankes `main.js`
- **Doku**: `docs/README-de.md` (Diagnose), `docs/UPSTREAM-SYNC.md`
