#include "ssh_common.h"

#include <ctype.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    const char* password;
    int answered;
} password_challenge_t;

/* Only answer a password prompt, never an OTP, echoing question or multi-prompt
 * challenge. Prompt lengths come from the wire and need not be NUL-terminated. */
static int is_password_prompt(const LIBSSH2_USERAUTH_KBDINT_PROMPT* prompt) {
    const char* text = prompt->text;
    size_t len = prompt->length;
    if (prompt->echo || !text) return 0;
    while (len && isspace((unsigned char)*text)) { text++; len--; }
    while (len && isspace((unsigned char)text[len - 1])) len--;
    if (len && text[len - 1] == ':') len--;
    const char expected[] = "password";
    if (len != sizeof(expected) - 1) return 0;
    for (size_t i = 0; i < len; i++)
        if (tolower((unsigned char)text[i]) != expected[i]) return 0;
    return 1;
}

static void password_callback(const char* name, int name_len,
                              const char* instruction, int instruction_len,
                              int num_prompts,
                              const LIBSSH2_USERAUTH_KBDINT_PROMPT* prompts,
                              LIBSSH2_USERAUTH_KBDINT_RESPONSE* responses,
                              void** abstract) {
    (void)name;
    (void)name_len;
    (void)instruction;
    (void)instruction_len;
    password_challenge_t* challenge = abstract ? *abstract : NULL;
    if (!challenge || challenge->answered || num_prompts != 1
            || !prompts || !responses || !is_password_prompt(&prompts[0]))
        return;

    size_t len = strlen(challenge->password);
    /* Sessions use libssh2's default allocator; libssh2 owns and frees this copy. */
    char* answer = malloc(len + 1);
    if (!answer) return;
    memcpy(answer, challenge->password, len + 1);
    responses[0].text = answer;
    responses[0].length = (unsigned int)len;
    challenge->answered = 1;
}

static int has_method(const char* methods, const char* method) {
    size_t len = strlen(method);
    while (methods && *methods) {
        const char* end = strchr(methods, ',');
        size_t token_len = end ? (size_t)(end - methods) : strlen(methods);
        if (token_len == len && memcmp(methods, method, len) == 0) return 1;
        methods = end ? end + 1 : NULL;
    }
    return 0;
}

int nexterm_ssh_auth(LIBSSH2_SESSION* session, const char* username,
                     const char* password, const char* private_key,
                     const char* passphrase) {
    if (private_key && private_key[0] != '\0') {
        const char* pp = (passphrase && passphrase[0] != '\0') ? passphrase : NULL;
        if (libssh2_userauth_publickey_frommemory(
                session, username, strlen(username),
                NULL, 0, private_key, strlen(private_key), pp) == 0)
            return 0;
    }

    if (!password || password[0] == '\0') return -1;
    const char* methods = libssh2_userauth_list(session, username, strlen(username));
    if (!methods) return libssh2_userauth_authenticated(session) ? 0 : -1;
    /* The method list belongs to libssh2 and may change during authentication. */
    int use_password = has_method(methods, "password");
    int use_interactive = has_method(methods, "keyboard-interactive");
    if (use_password) {
        int rc = libssh2_userauth_password(session, username, password);
        if (rc == 0) return 0;
        if (rc != LIBSSH2_ERROR_AUTHENTICATION_FAILED
                && rc != LIBSSH2_ERROR_METHOD_NOT_SUPPORTED) return -1;
    }
    if (use_interactive) {
        password_challenge_t challenge = { .password = password, .answered = 0 };
        void** abstract = libssh2_session_abstract(session);
        void* previous = *abstract;
        *abstract = &challenge;
        int rc = libssh2_userauth_keyboard_interactive(session, username, password_callback);
        *abstract = previous;
        if (rc == 0) return 0;
    }
    return -1;
}
