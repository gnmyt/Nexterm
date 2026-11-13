#include "../src/net/ssh_common.h"
#include <arpa/inet.h>
#include <stdlib.h>
#include <sys/socket.h>
#include <unistd.h>

int main(int argc, char** argv) {
    if (argc != 3 || libssh2_init(0) != 0) return 2;
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    struct sockaddr_in addr = { .sin_family = AF_INET, .sin_port = htons(atoi(argv[1])) };
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (connect(sock, (struct sockaddr*)&addr, sizeof(addr)) != 0) return 2;
    LIBSSH2_SESSION* session = libssh2_session_init();
    if (!session) return 2;
    libssh2_session_set_timeout(session, 5000);
    int rc = libssh2_session_handshake(session, sock);
    if (rc == 0) rc = nexterm_ssh_auth(session, "root", argv[2], NULL, NULL);
    libssh2_session_disconnect(session, "test complete");
    libssh2_session_free(session);
    close(sock);
    libssh2_exit();
    return rc == 0 ? 0 : 1;
}
