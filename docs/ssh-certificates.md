# SSH Client Certificates

Nexterm can authenticate to SSH servers with an OpenSSH user certificate paired with its matching private key. The certificate is uploaded separately from the private key and is used as a companion to it; the existing SSH key and password authentication modes remain unchanged.

Certificates are available for:

- saved identities;
- Quick Connect;
- SSH configuration import via `CertificateFile`; and
- SSH connections that use jump hosts, SFTP, tunnels, command execution, or monitoring.

The certificate file should contain the OpenSSH public certificate, usually a line beginning with an algorithm such as `ssh-ed25519-cert-v01@openssh.com`. It must correspond to the private key supplied in the same identity. Passphrases continue to apply to the private key.

Credential material is encrypted with Nexterm's normal credential storage before it is persisted. The certificate itself is public-key material, but it should still be treated as part of the identity configuration and rotated with the private key when its signing authority or validity period changes.

## Runtime compatibility

This feature does not change or pin the bundled libssh2 dependency version. The engine runtime must provide the libssh2 public-key authentication API with support for passing an OpenSSH certificate alongside the private key. When deploying a custom or older engine image, verify its libssh2 build supports SSH user certificates before relying on this authentication mode.
