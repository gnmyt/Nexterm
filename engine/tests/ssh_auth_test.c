#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <libssh2.h>

static const char* methods;
static int key_rc, password_rc, interactive_rc, key_calls, password_calls, interactive_calls;
static int mode;
static void* original;
static char* mock_list(LIBSSH2_SESSION* s, const char* u, unsigned int n) {
    (void)s; (void)u; (void)n;
    return (char*)methods;
}
static int mock_authenticated(LIBSSH2_SESSION* s) { (void)s; return 0; }
static int mock_key(LIBSSH2_SESSION* s, const char* u, size_t n,
                    const char* pub, size_t pub_len, const char* key, size_t key_len,
                    const char* passphrase) {
    (void)s; (void)u; (void)n; (void)pub; (void)pub_len;
    (void)key; (void)key_len; (void)passphrase;
    key_calls++;
    return key_rc;
}
static int mock_password(LIBSSH2_SESSION* s, const char* u, const char* p) {
    (void)s; (void)u;
    assert(strcmp(p, "test-secret") == 0);
    password_calls++;
    return password_rc;
}
static int mock_interactive(LIBSSH2_SESSION* s, const char* u,
        LIBSSH2_USERAUTH_KBDINT_RESPONSE_FUNC((*callback))) {
    (void)u;
    interactive_calls++;
    assert(*libssh2_session_abstract(s) != original);
    /* Deliberately not NUL-terminated. */
    unsigned char prompt[] = {'P','a','S','s','W','o','R','d',':',' '};
    LIBSSH2_USERAUTH_KBDINT_PROMPT prompts[2] = {
        { .text = prompt, .length = sizeof(prompt), .echo = 0 },
        { .text = (unsigned char*)"OTP:", .length = 4, .echo = 0 }
    };
    LIBSSH2_USERAUTH_KBDINT_RESPONSE responses[2] = {{0}, {0}};
    if (mode == 1) prompts[0].echo = 1;
    if (mode == 2) { prompts[0].text = (unsigned char*)"Verification code:"; prompts[0].length = 18; }
    if (mode == 5) { prompts[0].text = (unsigned char*)"password-reset:"; prompts[0].length = 15; }
    if (mode == 6) prompts[0].text = NULL;
    if (mode == 4) callback(NULL, 0, NULL, 0, 0, NULL, NULL, libssh2_session_abstract(s));
    callback(NULL, 0, NULL, 0, mode == 3 ? 2 : 1, prompts, responses,
             libssh2_session_abstract(s));
    if (mode == 0 || mode == 4) {
        assert(responses[0].text);
        assert(responses[0].length == strlen("test-secret"));
        assert(strcmp(responses[0].text, "test-secret") == 0);
        libssh2_free(s, responses[0].text);
        responses[0].text = NULL;
        /* A repeated password or later OTP must not receive the password. */
        callback(NULL, 0, NULL, 0, 1, prompts, responses, libssh2_session_abstract(s));
    }
    assert(responses[0].text == NULL && responses[1].text == NULL);
    return interactive_rc;
}

#define libssh2_userauth_list mock_list
#define libssh2_userauth_authenticated mock_authenticated
#define libssh2_userauth_publickey_frommemory mock_key
#undef libssh2_userauth_password
#define libssh2_userauth_password mock_password
#undef libssh2_userauth_keyboard_interactive
#define libssh2_userauth_keyboard_interactive mock_interactive
#include "../src/net/ssh_auth.c"

static void reset(void) {
    methods = "publickey,keyboard-interactive";
    key_rc = password_rc = LIBSSH2_ERROR_AUTHENTICATION_FAILED;
    interactive_rc = 0;
    key_calls = password_calls = interactive_calls = mode = 0;
}
static int authenticate(LIBSSH2_SESSION* s, const char* password, const char* key) {
    int rc = nexterm_ssh_auth(s, "root", password, key, NULL);
    assert(*libssh2_session_abstract(s) == original);
    return rc;
}
int main(void) {
    assert(libssh2_init(0) == 0);
    LIBSSH2_SESSION* s = libssh2_session_init();
    assert(s);
    int sentinel;
    original = &sentinel;
    *libssh2_session_abstract(s) = original;
    reset();
    assert(authenticate(s, "test-secret", NULL) == 0);
    assert(interactive_calls == 1 && password_calls == 0 && key_calls == 0);
    reset(); methods = "password,keyboard-interactive"; password_rc = 0;
    assert(authenticate(s, "test-secret", NULL) == 0);
    assert(password_calls == 1 && interactive_calls == 0);
    reset(); methods = "password,keyboard-interactive";
    assert(authenticate(s, "test-secret", NULL) == 0);
    assert(password_calls == 1 && interactive_calls == 1);
    reset(); methods = "password,keyboard-interactive"; password_rc = LIBSSH2_ERROR_SOCKET_RECV;
    assert(authenticate(s, "test-secret", NULL) == -1);
    assert(interactive_calls == 0);
    reset(); key_rc = 0;
    assert(authenticate(s, "test-secret", "key") == 0);
    assert(key_calls == 1 && interactive_calls == 0 && password_calls == 0);
    reset();
    assert(authenticate(s, "test-secret", "key") == 0);
    assert(key_calls == 1 && interactive_calls == 1);
    for (int i = 0; i < 7; i++) {
        reset(); mode = i; interactive_rc = LIBSSH2_ERROR_AUTHENTICATION_FAILED;
        assert(authenticate(s, "test-secret", NULL) == -1);
        assert(interactive_calls == 1);
    }
    reset(); methods = "publickey,notkeyboard-interactive,password-extra";
    assert(authenticate(s, "test-secret", NULL) == -1);
    assert(password_calls == 0 && interactive_calls == 0);
    reset(); methods = NULL;
    assert(authenticate(s, "test-secret", NULL) == -1);
    reset();
    assert(authenticate(s, NULL, NULL) == -1);
    assert(authenticate(s, "", NULL) == -1);
    assert(password_calls == 0 && interactive_calls == 0);
    libssh2_session_free(s);
    libssh2_exit();
    puts("SSH authentication unit tests passed");
    return 0;
}
