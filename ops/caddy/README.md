<!-- Purpose: review/build/validate the DNS-01 proxy; runbook §2.4; REVIEW BEFORE USE. -->
# Caddy operator notes

Nothing here has been installed, validated with Caddy, or used to issue a certificate.
Use the existing host Caddy unit under its own `caddy` account, not `noctua`. Keep
state in `/var/lib/caddy`; verify that assumption against the installed unit.

Build later on the approved ARM64 build host (documentation only):

```sh
GOOS=linux GOARCH=arm64 xcaddy build '<approved-caddy-version>'   --with 'github.com/caddy-dns/netcup@<approved-provider-commit>'
./caddy version
./caddy list-modules
```

Require `dns.providers.netcup`. Pin binary checksum, Caddy version and provider commit.
The chosen version must support `log_skip`, filter deletion and `write_idle -1s`.
Review and validate syntax locally with that binary before any service action. Validation
can provision modules and use the network: it was deliberately not run for this task.
Do not print adapted JSON containing resolved credentials.

Privately create `/etc/caddy/netcup.env` root:root 0600, with shell/systemd-compatible
assignments, no `export`:

```dotenv
NETCUP_CUSTOMER_NUMBER=<legacy-customer-number>
NETCUP_API_KEY=<legacy-api-key>
NETCUP_API_PASSWORD=<legacy-api-password>
```

Use the approved secret workflow. The API key/password map to
`NETCUP_LEGACY_API_KEY` / `NETCUP_LEGACY_API_PASSWORD`, not the new CloudDNS REST keys.
Do not copy DNS credentials to the app environment. A reviewed drop-in for the existing
Caddy unit must include `EnvironmentFile=/etc/caddy/netcup.env`,
`After=network-online.target tailscaled.service`, `Wants=network-online.target`,
`LimitNOFILE=65536`, `Restart=on-failure`, `RestartSec=10s`.
The unit needs its normal bind capability, persistent state and DNS access.

## Port 443 is occupied: choose before starting

The checked-in site uses **100.92.134.1:443**, and the app uses **127.0.0.1:3654**.
Caddy does not open an HTTP redirect listener. Bind only the tailnet IP; check that
no public listener appears. DNS/MX records remain untouched by these files.

1. Preferred runbook path: the owner of Tailscale Serve `443 → 4173` approves moving
   that exact endpoint to a verified free port (runbook proposes 8446) or another host.
   Preserve its configuration; leave 3790 and unrelated Funnel/webhooks intact. Follow
   runbook §2.4A for targeted changes and reversal; never `tailscale serve reset`.
   Then keep the checked-in canonical URL and Caddyfile unchanged.
2. Alternative, **requires an explicit exception to runbook §2.4A**: leave Serve on
   443 and use `https://mails.monkeymed.de:8443` after checking that port is free.
   In a private Caddyfile copy change the site address, `Host`, `X-Forwarded-Host`
   to `mails.monkeymed.de:8443`, and `X-Forwarded-Port` to `8443`.
   Set runtime `BETTER_AUTH_URL=https://mails.monkeymed.de:8443`; keep
   `PASSKEY_RP_ID=mails.monkeymed.de` (RP IDs have no port). Review exact reset
   callback/trusted-origin behavior, all device URLs, healthcheck proxy headers in
   `ops/lib/operations.sh` and the drill, and rerun auth/browser/device acceptance.
   Slice 6 documents the portless canonical production callback: this alternative
   is a separate deployment decision, not an equivalent untested production origin.
   If the canonical origin must remain portless, moving Serve is required.

## Proxy and logging contract

Every request overwrites Host, X-Forwarded-Host/Proto/Port/For and X-Real-IP with
canonical values/client address and removes Forwarded. Do not enable trusted proxy
chains; this is a single direct tailnet proxy to IPv4 loopback. SSE buffering is
avoided (`flush_interval -1`), with no total response/write timeout. The 15-minute
header timeout allows slow sends; it is not a stream lifetime limit.

`64MB` is the runbook's proposed **whole request** limit, not a guarantee for raw
attachment sizes (base64 and JSON/MIME overhead apply). Confirm the required maximum,
netcup SMTP limit, 10 MB attachment and real MIME behavior before approval.
Security headers deliberately omit a speculative CSP; test the app before adding one.

Auth/admin/reset paths are omitted with `log_skip`. For all other access records,
filter encoding deletes the **whole request URI**, all request/response headers and
TLS metadata. This omits query strings, path tokens, Cookie/Authorization, Location
and Referer even for encoded/nonmatching reset paths. Remaining log fields contain
method/status/duration/client metadata; request bodies are never enabled. Global
runtime diagnostics are discarded, matching nginx's request-error suppression;
this also removes useful renewal/error diagnostics. Monitor certificate expiry and
service state externally. Do not enable debug or a raw second access/error logger.

Before enabling access logging in production, test the pinned binary privately with
synthetic reset tokens in path/query, encoded/case variants, invalid upstream/502,
redirect Location and Referer/Cookie headers. Search every destination (stdout,
journald and any configured global sinks) for the synthetic sentinel. Require zero
occurrences and confirm normal requests still emit safe status records. Until
that proof, remove the site `log` block **and keep** runtime output discarded.
App logs need their own slice-6 leak test; bootstrap/recovery secrets are retrieved
only through the final offline operator commands, never from a startup-journal grep.

Tailnet ACL/device DNS acceptance, issuance and a later renewal remain manual gates.
