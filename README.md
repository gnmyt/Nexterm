[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![Release][release-shield]][release-url]

<br />
<p align="center">
  <a href="https://github.com/gnmyt/Nexterm">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://i.imgur.com/WhNYRgX.png">
        <img alt="Nexterm Banner" src="https://i.imgur.com/TBMT7dt.png">
    </picture>
  </a>
</p>

## 🤔 What is Nexterm?

Nexterm is an open-source server management software that allows you to:

-   Connect remotely via SSH, VNC and RDP
-   Manage files through SFTP
-   Deploy applications via Docker
-   Manage Proxmox LXC and QEMU containers
-   Secure access with two-factor authentication

## 🚀 Run preview

You can run a preview of Nexterm by clicking [here](https://docs.nexterm.dev/preview).

## 💻 Development

### Prerequisites

-   Node.js 18+
-   Yarn
-   Docker (optional)

### Local Setup

#### Clone the repository

```sh
git clone https://github.com/gnmyt/Nexterm.git
cd Nexterm
```

#### Install dependencies

```sh
yarn install
cd client && yarn install
cd ..
```

#### Start development mode

```sh
yarn dev
```

## 🔧 Configuration

The server listens on port 6989 by default. You can modify this behavior using environment variables:

-   `SERVER_PORT`: Server listening port (default: 6989)
-   `NODE_ENV`: Runtime environment (development/production)
-   `ENCRYPTION_KEY`: Encryption key for passwords, SSH keys and passphrases (default: Randomly generated key)
-   `AI_SYSTEM_PROMPT`: System prompt for AI features (example: You are a Linux command generator assistant.)
-   `LOG_LEVEL`: Logging level for application and guacd (system/info/verbose/debug/warn/error, default: system)

## 🛡️ Security

-   Two-factor authentication
-   Session management
-   Password encryption
-   Docker container isolation

## 🤝 Contributing

Contributions are welcome! Please feel free to:

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🔗 Useful Links

-   [Documentation](https://docs.nexterm.dev)
-   [Discord](https://dc.gnmyt.dev)
-   [Report a bug](https://github.com/gnmyt/Nexterm/issues)
-   [Request a feature](https://github.com/gnmyt/Nexterm/issues)

## License

Distributed under the MIT license. See `LICENSE` for more information.

[contributors-shield]: https://img.shields.io/github/contributors/gnmyt/Nexterm.svg?style=for-the-badge
[contributors-url]: https://github.com/gnmyt/Nexterm/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/gnmyt/Nexterm.svg?style=for-the-badge
[forks-url]: https://github.com/gnmyt/Nexterm/network/members
[stars-shield]: https://img.shields.io/github/stars/gnmyt/Nexterm.svg?style=for-the-badge
[stars-url]: https://github.com/gnmyt/Nexterm/stargazers
[issues-shield]: https://img.shields.io/github/issues/gnmyt/Nexterm.svg?style=for-the-badge
[issues-url]: https://github.com/gnmyt/Nexterm/issues
[license-shield]: https://img.shields.io/github/license/gnmyt/Nexterm.svg?style=for-the-badge
[license-url]: https://github.com/gnmyt/Nexterm/blob/master/LICENSE
[release-shield]: https://img.shields.io/github/v/release/gnmyt/Nexterm.svg?style=for-the-badge
[release-url]: https://github.com/gnmyt/Nexterm/releases/latest
