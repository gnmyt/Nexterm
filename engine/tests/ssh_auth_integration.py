"""Exercise the real libssh2 client against password and interactive SSH servers."""
import socket
import subprocess
import sys
import threading

import paramiko

KEY = paramiko.RSAKey.generate(2048)
SECRET = "integration-test-password"


class Server(paramiko.ServerInterface):
    def __init__(self, method, challenge):
        self.method = method
        self.challenge = challenge
        self.answers = []
        self.password_attempts = 0

    def get_allowed_auths(self, username):
        return self.method

    def check_auth_password(self, username, password):
        self.password_attempts += 1
        if self.method == "password" and password == SECRET:
            return paramiko.AUTH_SUCCESSFUL
        return paramiko.AUTH_FAILED

    def check_auth_interactive(self, username, submethods):
        prompts = {
            "password": [("Password: ", False)],
            "echo": [("Password: ", True)],
            "otp": [("Verification code: ", False)],
            "multiple": [("Password: ", False), ("OTP: ", False)],
        }[self.challenge]
        return paramiko.InteractiveQuery("Authentication", "", *prompts)

    def check_auth_interactive_response(self, responses):
        self.answers.extend(responses)
        if self.challenge == "password" and responses == [SECRET]:
            return paramiko.AUTH_SUCCESSFUL
        return paramiko.AUTH_FAILED


def run_case(method, challenge, password, succeeds):
    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    listener.listen(1)
    listener.settimeout(10)
    port = listener.getsockname()[1]
    server = Server(method, challenge)
    errors = []

    def serve():
        transport = None
        try:
            conn, _ = listener.accept()
            transport = paramiko.Transport(conn)
            transport.add_server_key(KEY)
            transport.start_server(server=server)
            transport.join(10)
        except Exception as exc:
            errors.append(exc)
        finally:
            if transport:
                transport.close()
            listener.close()

    thread = threading.Thread(target=serve)
    thread.start()
    result = subprocess.run([sys.argv[1], str(port), password], timeout=10,
                            capture_output=True, text=True)
    thread.join(15)
    assert not thread.is_alive(), "server did not stop"
    assert not errors, errors
    assert (result.returncode == 0) == succeeds, (method, challenge, result.returncode)
    assert password not in result.stdout + result.stderr, "credential appeared in output"
    if challenge != "password":
        assert all(not answer for answer in server.answers), "unexpected challenge answered"
    if method == "publickey,keyboard-interactive":
        assert server.password_attempts == 0, "unsupported password method attempted"
    print(f"PASS: {method}, {challenge}, {'success' if succeeds else 'rejected'}")


run_case("publickey,keyboard-interactive", "password", SECRET, True)
run_case("publickey,keyboard-interactive", "password", "wrong-password", False)
run_case("password", "password", SECRET, True)
run_case("password,keyboard-interactive", "password", SECRET, True)
for challenge in ("echo", "otp", "multiple"):
    run_case("publickey,keyboard-interactive", challenge, SECRET, False)
