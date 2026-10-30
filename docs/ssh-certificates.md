# SSH certificates

Nexterm can present an OpenSSH user certificate when it opens an SSH session, and it can ask a certificate authority for a short-lived certificate at connection time.

Uploaded certificates are the static case: an identity keeps its private key and an optional certificate. Short-lived certificates replace that key for one session. The session key is generated in memory, signed, and discarded when the request that opened the session finishes. It is not written to the identity store.

## Static certificates

An SSH or key-and-password identity accepts an optional OpenSSH user certificate (`*-cert.pub`). The certificate is stored with the identity's other secrets. SSH, SFTP, tunnels, and the remote browser pass it to the engine with the private key. The engine presents the certificate as the public key during public-key authentication.

A certificate is optional. A server that requires certificate authentication will reject a key that has none.

## Short-lived certificates

An administrator creates a certificate authority under Settings → SSH Certificates. It can apply to every server or to one organization, and it can be limited to account groups, a directory domain, or an environment. A server can select one authority directly. When it does not, Nexterm uses the most specific enabled authority that matches the signed-in account and the server. When the server is selected, the next SSH, SFTP, tunnel, or remote-browser connection does this:

1. Generate an Ed25519 key for that connection.
2. Build the principal list from the identity username, extra principals on the authority, and group mappings.
3. Ask the authority to sign a user certificate.
4. Authenticate with that key and certificate instead of the stored key or password.
5. Record the authority, key id, serial, principals, validity, and source address. The private key is not recorded.

Group mappings use the groups and subject saved from the last OpenID Connect login. Keycloak, AD FS, and Entra ID are connected through that login, including a directory that the identity provider federates. A mapping line `linux-admins=root,ubuntu` adds those principals when the signed-in account has the group `linux-admins`. The identity username is always included.

The certificate lifetime is the server override when one is set. Otherwise it is the shortest matching group lifetime, then the environment lifetime, then the authority default. The key id template also accepts `{{subject}}`.

A step-ca authority can store a one-time token, a bearer token, or the P-256 private key of a JWK provisioner. With a provisioner key, Nexterm mints the short-lived sign-in token for that connection. The provisioner name is the name configured on step-ca. The token carries that key's `kid` when the stored key has one, and otherwise the public-key thumbprint step-ca uses as the key id.

A local authority accepts an unencrypted Ed25519, ECDSA, or RSA private key in OpenSSH or PKCS#8 form. The session key is always Ed25519. Vault, step-ca, and webhooks can return other certificate types.

Each connection is signed when it starts. The audit entry records the account, identity provider subject, server, principals, key id, serial, lifetime, and start time. When the session closes, a second entry records the end time. The private key is not recorded. OpenSSH checks the certificate when the session authenticates, so the next connection receives a new certificate.

The source address, when set, becomes the certificate's `source-address` restriction. That address is the address the SSH server sees, which is the engine's address, not the browser's address. Leave it empty when the engine address changes.

Supported authorities:

| Backend | What Nexterm stores | Request |
| --- | --- | --- |
| Local CA key | Unencrypted Ed25519, ECDSA, or RSA OpenSSH or PKCS#8 private key | Signed inside Nexterm |
| Vault SSH | Address, mount, role, and token | `POST /v1/{mount}/sign/{role}` |
| step-ca | URL and a one-time token, bearer token, or P-256 provisioner key | `POST /ssh/sign` |
| Webhook | URL and optional bearer token | JSON shown below |

Webhook body:

```json
{
  "publicKey": "ssh-ed25519 AAAA... nexterm-session",
  "principals": ["alice"],
  "keyId": "alice",
  "ttlSeconds": 300,
  "validAfter": "2026-01-01T00:00:00.000Z",
  "validBefore": "2026-01-01T00:05:00.000Z",
  "sourceAddress": "10.0.0.8/32",
  "certType": "user"
}
```

The response is JSON with `certificate`, `crt`, or `signed_key`, or the certificate text itself. Lifetime is limited to between 30 seconds and 24 hours. The default is 5 minutes.

The key id template accepts `{{username}}`, `{{account}}`, `{{subject}}`, `{{server}}`, and `{{host}}`.

An authority with an organization can only sign for servers in that organization. An authority without an organization can sign for any server. An authority that is not limited by organization, group, domain, or environment is used only when a server selects it.

Linux hosts still need `TrustedUserCAKeys` pointing at the authority's public key. Nexterm does not change host configuration, and it does not replace the identity provider's own authentication. A security key, passkey, or smart card is enforced by that provider before Nexterm sees the account.
