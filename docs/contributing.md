# Contributing to Nexterm

You plan on contributing to Nexterm? That's great! This document will guide you through the process of contributing to the project.

## 📦 Prerequisites

- [Node.js](https://nodejs.org/en/download/) (v18 or higher)
- [Yarn](https://yarnpkg.com/getting-started/install)
- [Git](https://git-scm.com/downloads)
- FlatBuffers compiler (`flatc`)

### Installing FlatBuffers

| Platform | Command |
|-----------|----------|
| macOS | `brew install flatbuffers` |
| Ubuntu / Debian | `sudo apt install flatbuffers-compiler` |
| Windows | `winget install Google.FlatBuffers` |

## 🛠️ Installation

1. Clone the repository:

    ```sh
    git clone https://github.com/gnmyt/Nexterm.git
    cd Nexterm
    ```

2. Create a local environment file:

    ```sh
    cp .env.example .env
    ```

3. Make sure `ENCRYPTION_KEY` is set in `.env`.

    You can generate a secure key using:

    | Platform | Command |
    |-----------|----------|
    | macOS / Linux | `openssl rand -hex 32` |
   
5. Install the dependencies for the server:

    ```sh
    yarn install
    ```

6. Install the dependencies for the client:

    ```sh
    cd client
    yarn install
    cd ..
    ```

7. Generate FlatBuffers schemas:

    ```sh
    yarn schema:generate
    ```

## 🏃 Running the development server

Start the development server:

```sh
yarn dev
```

This will start the server and the client in development mode. You can access the development server at [http://127.0.0.1:5173](http://127.0.0.1:5173).

### Starting an engine

The development server does not automatically start an engine. To connect to servers, an engine must be running separately:

```sh
yarn dev:engine
```

If you want the engine to register automatically with the local control plane, set `LOCAL_ENGINE_TOKEN` in `.env` and use the same value as `REGISTRATION_TOKEN` for the engine.

## 🤝 Contributing

1. **Fork the repository**: Click the "Fork" button at the top right of the [repository page](https://github.com/gnmyt/Nexterm).
2. **Create a new branch**:

    ```sh
    git checkout -b feature/my-new-feature
    ```

3. **Make your changes**: Implement your feature, fix, or improvement.

4. **Commit your changes**:

    ```sh
    git commit -m "Add feature: my new feature"
    ```

5. **Push to your fork**:

    ```sh
    git push origin feature/my-new-feature
    ```

6. **Open a pull request**: Go to the original repository and create a PR with a clear description.

## 📝 Guidelines

- Follow the existing code style.
- Keep PRs focused and minimal.
- Include meaningful commit messages.
- Link related issues when applicable.

## 🌍 Translations

Nexterm uses [Crowdin](https://crowdin.com/project/nexterm) for managing translations. If you'd like to help translate Nexterm into your language or improve existing translations, please visit our [Crowdin project page](https://crowdin.com/project/nexterm).

To suggest a new language, please open an issue in the repository using the language request template. Translation pull requests will not be accepted as all translations are managed through Crowdin.
