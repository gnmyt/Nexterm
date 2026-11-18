/* Exercise the real LibVNCClient parser against a local socketpair. */
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <rfb/rfbclient.h>
#include <zlib.h>

static const char sample[] = "剪贴板中文测试 ABC 123 😀";
static char received[4096];
static int received_len = -1;

static void got_text(rfbClient* client, const char* text, int len) {
    (void)client;
    assert(len >= 0 && len < (int)sizeof(received));
    memcpy(received, text, len);
    received_len = len;
}

static void transfer(int fd, void* data, size_t len, int writing) {
    char* p = data;
    while (len) {
        ssize_t n = writing ? write(fd, p, len) : read(fd, p, len);
        assert(n > 0);
        p += n;
        len -= n;
    }
}

static void send_extended(int fd, uint32_t flags, const void* data, size_t len) {
    rfbServerCutTextMsg msg = {0};
    uint32_t encoded_flags = htonl(flags);
    msg.type = rfbServerCutText;
    msg.length = htonl(-(int32_t)(sizeof(flags) + len));
    transfer(fd, &msg, sz_rfbServerCutTextMsg, 1);
    transfer(fd, &encoded_flags, sizeof(encoded_flags), 1);
    if (len) transfer(fd, (void*)data, len, 1);
}

static size_t read_extended(int fd, uint32_t* flags, unsigned char* data, size_t capacity) {
    rfbClientCutTextMsg msg;
    uint32_t encoded_flags;
    transfer(fd, &msg, sz_rfbClientCutTextMsg, 0);
    int32_t wire_len = (int32_t)ntohl(msg.length);
    assert(msg.type == rfbClientCutText && wire_len <= -4);
    size_t len = -(int64_t)wire_len - sizeof(encoded_flags);
    assert(len <= capacity);
    transfer(fd, &encoded_flags, sizeof(encoded_flags), 0);
    *flags = ntohl(encoded_flags);
    if (len) transfer(fd, data, len, 0);
    return len;
}

static void provide(int fd, const char* text, size_t len) {
    unsigned char raw[4096], compressed[8192];
    uint32_t wire_len = htonl(len + 1);
    assert(len + 5 <= sizeof(raw));
    memcpy(raw, &wire_len, 4);
    memcpy(raw + 4, text, len);
    raw[4 + len] = 0;
    uLongf compressed_len = sizeof(compressed);
    assert(compress2(compressed, &compressed_len, raw, len + 5, Z_DEFAULT_COMPRESSION) == Z_OK);
    send_extended(fd, rfbExtendedClipboard_Provide | rfbExtendedClipboard_Text,
            compressed, compressed_len);
}

int main(void) {
    int sockets[2];
    assert(socketpair(AF_UNIX, SOCK_STREAM, 0, sockets) == 0);
    struct timeval timeout = {3, 0};
    assert(setsockopt(sockets[1], SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout)) == 0);
    rfbClient* client = rfbGetClient(8, 3, 4);
    assert(client != NULL);
    client->sock = sockets[0];
    client->readTimeout = 3;
    client->GotXCutTextUTF8 = got_text;
    client->GotXCutText = got_text;

    /* No negotiated capability: the caller can fall back to classic CutText. */
    assert(!SendClientCutTextUTF8(client, (char*)sample, strlen(sample)));

    unsigned char payload[8192];
    uint32_t flags, limit = htonl(1 << 20);
    send_extended(sockets[1], rfbExtendedClipboard_Caps | rfbExtendedClipboard_Text
            | rfbExtendedClipboard_Notify | rfbExtendedClipboard_Provide, &limit, 4);
    assert(HandleRFBServerMessage(client));
    assert(read_extended(sockets[1], &flags, payload, sizeof(payload)) == 4);
    assert(flags == (rfbExtendedClipboard_Caps | rfbExtendedClipboard_Text
                | rfbExtendedClipboard_Notify | rfbExtendedClipboard_Provide));
    memcpy(&limit, payload, 4);
    assert(ntohl(limit) == 1 << 20);
    puts("PASS: capabilities reply and text size limit");

    send_extended(sockets[1], rfbExtendedClipboard_Notify | rfbExtendedClipboard_Text, NULL, 0);
    assert(HandleRFBServerMessage(client));
    assert(read_extended(sockets[1], &flags, payload, sizeof(payload)) == 0);
    assert(flags == (rfbExtendedClipboard_Request | rfbExtendedClipboard_Text));
    puts("PASS: Notify -> Request");

    provide(sockets[1], sample, strlen(sample));
    assert(HandleRFBServerMessage(client));
    assert(received_len == (int)strlen(sample));
    assert(memcmp(received, sample, received_len) == 0);
    puts("PASS: received Chinese/emoji exactly, without trailing NUL");

    provide(sockets[1], "", 0);
    assert(HandleRFBServerMessage(client));
    assert(received_len == 0);
    puts("PASS: empty UTF-8 clipboard");

    assert(SendClientCutTextUTF8(client, (char*)sample, strlen(sample)));
    assert(read_extended(sockets[1], &flags, payload, sizeof(payload)) == 0);
    assert(flags == (rfbExtendedClipboard_Notify | rfbExtendedClipboard_Text));
    size_t len = read_extended(sockets[1], &flags, payload, sizeof(payload));
    assert(flags == (rfbExtendedClipboard_Provide | rfbExtendedClipboard_Text));
    unsigned char inflated[4096];
    z_stream stream = {0};
    assert(inflateInit(&stream) == Z_OK);
    stream.next_in = payload;
    stream.avail_in = len;
    stream.next_out = inflated;
    stream.avail_out = sizeof(inflated);
    int result = inflate(&stream, Z_SYNC_FLUSH);
    assert(result == Z_OK || result == Z_STREAM_END);
    assert(stream.total_out == strlen(sample) + 5);
    memcpy(&limit, inflated, 4);
    assert(ntohl(limit) == strlen(sample) + 1);
    assert(memcmp(inflated + 4, sample, strlen(sample)) == 0);
    assert(inflated[4 + strlen(sample)] == 0);
    inflateEnd(&stream);
    puts("PASS: sent Chinese/emoji as Extended Clipboard Notify+Provide");

    /* Classic transfer still works independently of the UTF-8 extension. */
    rfbServerCutTextMsg classic = {0};
    classic.type = rfbServerCutText;
    classic.length = htonl(3);
    transfer(sockets[1], &classic, sz_rfbServerCutTextMsg, 1);
    transfer(sockets[1], "abc", 3, 1);
    assert(HandleRFBServerMessage(client));
    assert(received_len == 3 && memcmp(received, "abc", 3) == 0);
    puts("PASS: classic clipboard fallback");

    close(sockets[1]);
    close(sockets[0]);
    client->sock = RFB_INVALID_SOCKET;
    rfbClientCleanup(client);
    return 0;
}
