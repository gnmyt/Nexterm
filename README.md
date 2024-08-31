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

The open source server management software for SSH, VNC & RDP

## 🚀 Run preview

> [!CAUTION]
> Nexterm is currently in early development and subject to change. It is not recommended to use it in a production
> environment.

> [!WARNING]  
> Your password needs to be at least 8 characters long and contain at least one uppercase letter, one lowercase letter,
> one number and one special character.
> The current error message might be confusing, but it will be fixed in the future.

### 🐳 Docker

```bash
docker run -d -p 6989:6989 --name nexterm --restart always -v nexterm:/app/data germannewsmaker/nexterm:latest
```

### 📦 Docker Compose

```yaml
services:
  nexterm:
    ports:
      - "6989:6989"
    restart: always
    volumes:
      - nexterm:/app/data
    image: germannewsmaker/nexterm:latest
volumes:
  nexterm:
```

```bash
docker-compose up -d
```

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
