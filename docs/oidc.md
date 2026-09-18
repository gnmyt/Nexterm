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

## Attribute Mapping

Defaults in **Advanced Settings**:

| Field      | Claim                |
|------------|----------------------|
| Username   | `preferred_username` |
| First Name | `given_name`         |
| Last Name  | `family_name`        |

## Group Sync

In **Advanced Settings**, under **Group Sync**, you can map group claims from your identity provider to Nexterm organizations and
restrict access to specific users.

| Field                | Description                                                                                             |
|----------------------|-----------------------------------------------------------------------------------------------------------|
| Groups Claim          | The claim in the userinfo/ID token response that contains the user's groups, e.g. `groups`. Accepts a JSON array or a space/comma separated string. Leave empty to disable group sync. |
| Required Group        | If set, only users whose groups claim contains this value are allowed to log in. Useful when your identity provider has many users who shouldn't have access to Nexterm. |
| Organization Mappings | A list of `group value → organization (+ role)` mappings. On every login, Nexterm adds the user as a member (or owner) of every mapped organization whose group value is present in their claim, and removes them from any organization that was previously granted this way but is no longer matched. |

Memberships created through group sync are tracked separately from manually invited members, so removing a group mapping — or a
user losing a group in your IdP — never touches memberships that were added by hand. Organization owners added by manual
invitation are never removed by sync.

### Keycloak Example

1. In your realm, create a **Client Scope** (e.g. `groups`) with a **Group Membership** mapper, add it to your client.
2. Set **Groups Claim** to `groups`.
3. Add mappings such as `/devops → DevOps Team` or set **Required Group** to `/nexterm-users` to gate access.

## Troubleshooting

**Redirect URI mismatch** - Must match exactly. Check trailing slashes, http vs https.

**User attributes wrong** - Check claim names in your IdP's token and adjust mapping.
