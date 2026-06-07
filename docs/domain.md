# Custom Domain Setup

`judgemebro.com` and `www.judgemebro.com` are already attached to the linked Vercel project.

## Current State

The domain is still using Hostinger parking nameservers:

```text
artemis.dns-parking.com
hermes.dns-parking.com
```

Until DNS changes, the custom domain will not serve the Vercel app.

## Recommended DNS Records

Set these at the DNS provider:

```text
A judgemebro.com 76.76.21.21
A www.judgemebro.com 76.76.21.21
```

Vercel CLI currently recommends these records for the attached apex and `www` domains.

## Alternative Nameserver Setup

Instead of editing individual records, move the domain nameservers to Vercel:

```text
ns1.vercel-dns.com
ns2.vercel-dns.com
```

Do not do both at the same time. Either keep the current nameservers and edit DNS records, or switch nameservers to Vercel.

## Verify

After saving DNS changes, run:

```bash
npm run domain:check
npm run test:deployment
npm run launch:audit
```

`domain:check` prints current DNS records and the Vercel domain inspection output. It does not fail while DNS is still propagating. `launch:audit` fails until both custom domains are ready.
