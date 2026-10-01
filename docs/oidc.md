# 🔐 OIDC Authentication

SSO via OpenID Connect. Users log in with their existing identity provider.

## Setup

Go to **Settings** → **Authentication** → **Add Provider**.

![Add OIDC Provider](/assets/add-oidc-provider.png)

| Field         | Description              |
|---------------|--------------------------|
| Display Name  | Shown on login button    |
| Issuer URL    | IdP's discovery URL      |
| Client ID     | From your IdP            |
| Client Secret | From your IdP            |
| Redirect URI  | Copy this to your IdP    |
| Scope         | Usually `openid profile` |
| End Session Endpoint | Optional logout URL override when discovery does not advertise one |

## Provider Setup

### Microsoft Entra ID (Azure AD)

1. [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Add redirect URI: `https://nexterm.yourdomain.com/api/auth/oidc/callback`
3. Copy **Application (client) ID** → Client ID
4. **Certificates & secrets** → **New client secret** → copy value → Client Secret
5. Issuer URL: `https://login.microsoftonline.com/{tenant-id}/v2.0`

### Google

1. [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID** → **Web application**
3. Add redirect URI: `https://nexterm.yourdomain.com/api/auth/oidc/callback`
4. Issuer URL: `https://accounts.google.com`

> [!WARNING]
> Google requires app verification for production. Add test users in OAuth consent screen during dev.

### Keycloak

1. **Clients** → **Create client**
2. Enable **Client authentication**
3. Add redirect URI, copy Client Secret from **Credentials** tab
4. Issuer URL: `https://keycloak.yourdomain.com/realms/{realm-name}`

### Authentik

1. **Applications** → **Providers** → **Create** → **OAuth2/OpenID Provider**
2. Set redirect URI, copy Client ID/Secret
3. Issuer URL: `https://authentik.yourdomain.com/application/o/{application-slug}/`

> [!TIP]
> The trailing slash matters. Check `/.well-known/openid-configuration` to see the exact issuer value.

### Authelia

```yaml
identity_providers:
  oidc:
    clients:
      - client_id: nexterm
        client_secret: '$pbkdf2-sha512$your-hashed-secret'
        redirect_uris:
          - https://nexterm.yourdomain.com/api/auth/oidc/callback
        scopes: [ openid, profile, email ]
```

Issuer URL: `https://auth.yourdomain.com`

## Logout Setup

Register this post-logout redirect URI with your identity provider in addition to the login redirect URI:

```text
https://<nexterm-host>/api/auth/oidc/logout/callback
```

Nexterm uses the provider's discovered `end_session_endpoint` by default. If the provider does not advertise one, set **End Session Endpoint** in the provider's **Advanced Settings**. The configured override takes precedence over discovery.

Sessions created before upgrading do not have an ID-token hint and therefore use local-only logout until the user signs in again. Providers without a logout endpoint also continue to log out locally.

For Authentik, add both the login callback and post-logout callback to the provider's allowed redirect URIs.

## Attribute Mapping

Defaults in **Advanced Settings**:

| Field      | Claim                |
|------------|----------------------|
| Username   | `preferred_username` |
| First Name | `given_name`         |
| Last Name  | `family_name`        |

## Troubleshooting

**Redirect URI mismatch** - Must match exactly. Check trailing slashes, http vs https.

**User attributes wrong** - Check claim names in your IdP's token and adjust mapping.
