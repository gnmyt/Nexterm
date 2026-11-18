# API Reference

Everything the web interface does goes through a REST API, which you can use to automate Nexterm. The pages in this
section are generated from the server code and list every endpoint with its parameters, request body and response.

## Basics

All endpoints live under `/api` of your Nexterm instance, for example `https://nexterm.example.com/api/entries/list`.
Request and response bodies are JSON.

Create an API key under **Settings** → **Account** → **API Keys** and send it as a bearer token with every request:

```sh
curl https://nexterm.example.com/api/entries/list \
  -H "Authorization: Bearer nxt_..."
```

The key acts as the account that created it and has the same permissions.

## Errors

A request body that does not match the documented schema is rejected with status `400` and a `message` that names the
field. A missing or invalid token results in `401`.

Requests that are valid but cannot be fulfilled, such as an unknown id or a missing permission, are answered with
status `200` and a body of the form `{ "code": 403, "message": "..." }`. Check the response for a `code` field before
you treat it as a success.

## Adding a server

A server ("entry") connects with an identity, which holds the username and the password or SSH key. You do not have
to create the identity first: [Create entry](/operations/put-entries) accepts new identities inline, so one request
is enough.

```sh
curl -X PUT https://nexterm.example.com/api/entries \
  -H "Authorization: Bearer nxt_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web01",
    "config": { "protocol": "ssh", "ip": "10.0.0.5", "port": 22 },
    "identities": [
      { "name": "web01 deploy", "username": "deploy", "type": "ssh", "sshKey": "-----BEGIN OPENSSH PRIVATE KEY-----\n..." }
    ]
  }'
```

```json
{ "message": "Entry got successfully created", "id": 1 }
```

An identity created this way belongs to that one entry. To share credentials between servers, create the identity
once with [Create identity](/operations/put-identities) and pass its `id` instead:

```sh
curl -X PUT https://nexterm.example.com/api/identities \
  -H "Authorization: Bearer nxt_..." \
  -H "Content-Type: application/json" \
  -d '{ "name": "homelab root", "username": "root", "type": "password", "password": "..." }'
# { "message": "Identity got successfully created", "id": 7 }

curl -X PUT https://nexterm.example.com/api/entries \
  -H "Authorization: Bearer nxt_..." \
  -H "Content-Type: application/json" \
  -d '{ "name": "web02", "config": { "protocol": "ssh", "ip": "10.0.0.6", "port": 22 }, "identities": [7] }'
```

Add `folderId` to place the entry in a folder and `organizationId` to create it in an organization.