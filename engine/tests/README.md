# SSH authentication tests

Run on Linux with a C compiler, CMake, pkg-config, libssh2 development headers,
Python 3 and Paramiko installed:

```sh
cmake -S engine/tests -B engine/tests/build
cmake --build engine/tests/build
ctest --test-dir engine/tests/build --output-on-failure
```

The unit tests exercise the production authentication code with mocked auth
operations and the real libssh2 session/allocator. They cover method selection,
password fallback, key authentication, transport failures, context restoration,
non-NUL-terminated prompts, repeated challenges and rejecting OTP, echoing and
multiple prompts. Integration tests use the real libssh2 client against ephemeral
loopback Paramiko servers, including a `publickey,keyboard-interactive` server.
No device, SSH key identity or external SSH server is needed.

Automatic keyboard-interactive answers are intentionally restricted to one
non-echoing `Password:` prompt (case-insensitive, surrounding whitespace and
colon optional) per authentication attempt. Other challenge formats and MFA
require a future interactive authentication flow.
