# Contributing to Nexterm

You plan on contributing to Nexterm? That's great! This document will guide you through the process of contributing to
the project.

## 📦 Prerequisites

- [Node.js](https://nodejs.org/en/download/) (v18 or higher)
- [Yarn](https://yarnpkg.com/getting-started/install)
- [Git](https://git-scm.com/downloads)

## 🛠️ Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/gnmyt/Nexterm.git
    ```
2. Install the dependencies for the server:
    ```sh
    yarn install
    ```
3. Install the dependencies for the client:
    ```sh
    cd client
    yarn install
    ```

## 🏃 Running the development server

Starting the development server is as simple as running the following command:

```sh
yarn dev
```

This will start the server and the client in development mode. You can access the development server
at [http://localhost:5173](http://localhost:5173).

## 🤝 Contributing

1. **Fork the repository**: Click the "Fork" button at the top right of
   the [repository page](https://github.com/gnmyt/Nexterm).
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