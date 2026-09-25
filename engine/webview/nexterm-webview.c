#include <gtk/gtk.h>
#include <webkit/webkit.h>

#include "webview_pages.h"

#include <gdk/x11/gdkx.h>
#include <X11/cursorfont.h>

#include <stdio.h>
#include <string.h>

#define WEBVIEW_MAX_FAVICON_BYTES 32768

#define WEBVIEW_DEFAULT_WIDTH 1280
#define WEBVIEW_DEFAULT_HEIGHT 720

typedef struct {
    WebKitWebView *view;
    GtkWidget *window;
    GMainLoop *loop;
    gboolean loading;
    const char *proxy_user;
    const char *proxy_password;
    GdkClipboard *clipboard;
    char *injected_clipboard;
} webview_ctx;

static void json_append_string(GString *out, const char *value) {
    g_string_append_c(out, '"');
    for (const unsigned char *p = (const unsigned char *) (value ? value : ""); *p; p++) {
        switch (*p) {
            case '"': g_string_append(out, "\\\""); break;
            case '\\': g_string_append(out, "\\\\"); break;
            case '\n': g_string_append(out, "\\n"); break;
            case '\r': g_string_append(out, "\\r"); break;
            case '\t': g_string_append(out, "\\t"); break;
            default:
                if (*p < 0x20)
                    g_string_append_printf(out, "\\u%04x", *p);
                else
                    g_string_append_c(out, (char) *p);
                break;
        }
    }
    g_string_append_c(out, '"');
}

static void emit_state(webview_ctx *ctx) {
    GString *line = g_string_new("{\"event\":\"state\",\"uri\":");
    json_append_string(line, webkit_web_view_get_uri(ctx->view));
    g_string_append(line, ",\"title\":");
    json_append_string(line, webkit_web_view_get_title(ctx->view));
    g_string_append_printf(line, ",\"loading\":%s,\"canBack\":%s,\"canForward\":%s}\n",
                           ctx->loading ? "true" : "false",
                           webkit_web_view_can_go_back(ctx->view) ? "true" : "false",
                           webkit_web_view_can_go_forward(ctx->view) ? "true" : "false");

    fputs(line->str, stdout);
    fflush(stdout);
    g_string_free(line, TRUE);
}

static void emit_favicon(webview_ctx *ctx) {
    GdkTexture *icon = webkit_web_view_get_favicon(ctx->view);

    if (icon == NULL) {
        fputs("{\"event\":\"favicon\",\"data\":\"\"}\n", stdout);
        fflush(stdout);
        return;
    }

    GBytes *png = gdk_texture_save_to_png_bytes(icon);
    if (png == NULL) return;

    gsize size = 0;
    const guchar *data = g_bytes_get_data(png, &size);

    if (size > 0 && size <= WEBVIEW_MAX_FAVICON_BYTES) {
        gchar *encoded = g_base64_encode(data, size);

        GString *line = g_string_new("{\"event\":\"favicon\",\"data\":");
        json_append_string(line, encoded);
        g_string_append(line, "}\n");

        fputs(line->str, stdout);
        fflush(stdout);

        g_string_free(line, TRUE);
        g_free(encoded);
    }

    g_bytes_unref(png);
}

static void on_notify_favicon(GObject *object, GParamSpec *spec, gpointer user_data) {
    (void) object;
    (void) spec;
    emit_favicon(user_data);
}

static void on_clipboard_text(GObject *source, GAsyncResult *result, gpointer user_data) {
    webview_ctx *ctx = user_data;

    char *text = gdk_clipboard_read_text_finish(GDK_CLIPBOARD(source), result, NULL);
    if (text == NULL || *text == '\0') {
        g_free(text);
        return;
    }

    if (ctx->injected_clipboard && g_strcmp0(ctx->injected_clipboard, text) == 0) {
        g_free(text);
        return;
    }

    GString *line = g_string_new("{\"event\":\"clipboard\",\"text\":");
    json_append_string(line, text);
    g_string_append(line, "}\n");

    fputs(line->str, stdout);
    fflush(stdout);

    g_string_free(line, TRUE);
    g_free(text);
}

static void on_clipboard_changed(GdkClipboard *clipboard, gpointer user_data) {
    gdk_clipboard_read_text_async(clipboard, NULL, on_clipboard_text, user_data);
}

static void tame_bare_x_display(GdkDisplay *display) {
    static const char *popover_css =
        "popover, popover > contents, popover > arrow {"
        "  box-shadow: none; margin: 0; border-radius: 0;"
        "}"
        "popover { background-color: @theme_bg_color; }"
        "popover > arrow { min-width: 0; min-height: 0; background: none; border: none; }";

    GtkCssProvider *css = gtk_css_provider_new();
#if GTK_CHECK_VERSION(4, 12, 0)
    gtk_css_provider_load_from_string(css, popover_css);
#else
    gtk_css_provider_load_from_data(css, popover_css, -1);
#endif
    gtk_style_context_add_provider_for_display(display, GTK_STYLE_PROVIDER(css),
                                               GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);
    g_object_unref(css);

    if (!GDK_IS_X11_DISPLAY(display)) return;

    Display *xdisplay = gdk_x11_display_get_xdisplay(display);
    Cursor pointer = XCreateFontCursor(xdisplay, XC_left_ptr);
    XDefineCursor(xdisplay, DefaultRootWindow(xdisplay), pointer);
    XFreeCursor(xdisplay, pointer);
    XFlush(xdisplay);
}

static void follow_screen_size(webview_ctx *ctx) {
    if (ctx->window == NULL) return;

    int width = WEBVIEW_DEFAULT_WIDTH;
    int height = WEBVIEW_DEFAULT_HEIGHT;

    GListModel *monitors = gdk_display_get_monitors(gtk_widget_get_display(ctx->window));
    GdkMonitor *monitor = g_list_model_get_item(monitors, 0);
    if (monitor != NULL) {
        GdkRectangle geometry;
        gdk_monitor_get_geometry(monitor, &geometry);
        g_object_unref(monitor);
        if (geometry.width > 0 && geometry.height > 0) {
            width = geometry.width;
            height = geometry.height;
        }
    }

    gtk_window_set_default_size(GTK_WINDOW(ctx->window), width, height);
    gtk_widget_set_size_request(GTK_WIDGET(ctx->window), width, height);
}

static void on_monitors_changed(GListModel *monitors, guint position, guint removed,
                                guint added, gpointer user_data) {
    (void) monitors; (void) position; (void) removed; (void) added;
    follow_screen_size(user_data);
}

static void on_monitor_geometry(GObject *object, GParamSpec *spec, gpointer user_data) {
    (void) object; (void) spec;
    follow_screen_size(user_data);
}

static void on_load_changed(WebKitWebView *view, WebKitLoadEvent event, gpointer user_data) {
    webview_ctx *ctx = user_data;
    (void) view;

    ctx->loading = (event != WEBKIT_LOAD_FINISHED);
    emit_state(ctx);
}

static gchar *render_page(const char *template, const char *const *vars) {
    GString *out = g_string_new(NULL);

    for (const char *at = template; *at != '\0';) {
        const char *open = strstr(at, "{{");
        const char *close = open ? strstr(open, "}}") : NULL;
        if (close == NULL) {
            g_string_append(out, at);
            break;
        }

        g_string_append_len(out, at, open - at);

        gsize length = close - (open + 2);
        for (int i = 0; vars[i] != NULL; i += 2) {
            if (strlen(vars[i]) == length && strncmp(vars[i], open + 2, length) == 0) {
                g_string_append(out, vars[i + 1]);
                break;
            }
        }

        at = close + 2;
    }

    return g_string_free(out, FALSE);
}

static void load_blank_page(webview_ctx *ctx) {
    const char *const vars[] = {"STYLE", WEBVIEW_STYLE_CSS, NULL};
    gchar *html = render_page(WEBVIEW_BLANK_HTML, vars);

    webkit_web_view_load_alternate_html(ctx->view, html, "about:blank", NULL);
    g_free(html);
}

static void load_uri(webview_ctx *ctx, const char *uri) {
    if (g_ascii_strncasecmp(uri, "about:blank", strlen("about:blank")) == 0) {
        load_blank_page(ctx);
        return;
    }

    webkit_web_view_load_uri(ctx->view, uri);
}

static const char *error_code_label(GError *error) {
    if (error->domain == WEBKIT_NETWORK_ERROR) {
        switch (error->code) {
            case WEBKIT_NETWORK_ERROR_TRANSPORT: return "ERR_CONNECTION_FAILED";
            case WEBKIT_NETWORK_ERROR_UNKNOWN_PROTOCOL: return "ERR_UNKNOWN_URL_SCHEME";
            case WEBKIT_NETWORK_ERROR_CANCELLED: return "ERR_ABORTED";
            case WEBKIT_NETWORK_ERROR_FILE_DOES_NOT_EXIST: return "ERR_FILE_NOT_FOUND";
            default: return "ERR_FAILED";
        }
    }
    if (error->domain == WEBKIT_POLICY_ERROR) return "ERR_BLOCKED_BY_CLIENT";
    if (error->domain == G_TLS_ERROR) return "ERR_SSL_PROTOCOL_ERROR";
    if (error->domain == G_RESOLVER_ERROR) return "ERR_NAME_NOT_RESOLVED";
    if (error->domain == G_IO_ERROR && error->code == G_IO_ERROR_TIMED_OUT) return "ERR_TIMED_OUT";
    return "ERR_FAILED";
}

static gboolean on_load_failed(WebKitWebView *view, WebKitLoadEvent event, gchar *uri, GError *error,
                               gpointer user_data) {
    webview_ctx *ctx = user_data;
    (void) view;
    (void) event;

    ctx->loading = FALSE;

    gchar *escaped_message = g_markup_escape_text(error->message, -1);
    gchar *escaped_uri = g_markup_escape_text(uri, -1);

    const char *const vars[] = {"STYLE", WEBVIEW_STYLE_CSS,
                                "URL", escaped_uri,
                                "MESSAGE", escaped_message,
                                "CODE", error_code_label(error),
                                NULL};
    gchar *html = render_page(WEBVIEW_ERROR_HTML, vars);

    webkit_web_view_load_alternate_html(ctx->view, html, uri, NULL);

    g_free(html);
    g_free(escaped_message);
    g_free(escaped_uri);

    emit_state(ctx);
    return TRUE;
}

static gboolean on_authenticate(WebKitWebView *view, WebKitAuthenticationRequest *request,
                                gpointer user_data) {
    webview_ctx *ctx = user_data;
    (void) view;

    if (!webkit_authentication_request_is_for_proxy(request)) return FALSE;
    if (ctx->proxy_user == NULL) return FALSE;

    WebKitCredential *credential = webkit_credential_new(ctx->proxy_user, ctx->proxy_password,
                                                         WEBKIT_CREDENTIAL_PERSISTENCE_FOR_SESSION);
    webkit_authentication_request_authenticate(request, credential);
    webkit_credential_free(credential);
    return TRUE;
}

static void on_notify_title(GObject *object, GParamSpec *spec, gpointer user_data) {
    (void) object;
    (void) spec;
    emit_state(user_data);
}

static gboolean uri_scheme_allowed(const char *uri) {
    if (uri == NULL) return FALSE;

    static const char *allowed[] = {"http://", "https://", "about:blank", NULL};
    for (int i = 0; allowed[i] != NULL; i++)
        if (g_ascii_strncasecmp(uri, allowed[i], strlen(allowed[i])) == 0) return TRUE;

    return FALSE;
}

static gboolean on_decide_policy(WebKitWebView *view, WebKitPolicyDecision *decision,
                                 WebKitPolicyDecisionType type, gpointer user_data) {
    webview_ctx *ctx = user_data;
    (void) view;

    if (type == WEBKIT_POLICY_DECISION_TYPE_NAVIGATION_ACTION) {
        WebKitNavigationPolicyDecision *nav = WEBKIT_NAVIGATION_POLICY_DECISION(decision);
        WebKitNavigationAction *action = webkit_navigation_policy_decision_get_navigation_action(nav);
        const char *uri = webkit_uri_request_get_uri(webkit_navigation_action_get_request(action));

        if (!uri_scheme_allowed(uri)) {
            g_warning("refusing to load a non-tunnelled URI: %s", uri ? uri : "(null)");
            webkit_policy_decision_ignore(decision);
            return TRUE;
        }

        return FALSE;
    }

    if (type != WEBKIT_POLICY_DECISION_TYPE_NEW_WINDOW_ACTION) return FALSE;

    WebKitNavigationPolicyDecision *nav = WEBKIT_NAVIGATION_POLICY_DECISION(decision);
    WebKitNavigationAction *action = webkit_navigation_policy_decision_get_navigation_action(nav);
    WebKitURIRequest *request = webkit_navigation_action_get_request(action);
    const char *uri = webkit_uri_request_get_uri(request);

    if (uri_scheme_allowed(uri)) load_uri(ctx, uri);
    webkit_policy_decision_ignore(decision);
    return TRUE;
}

static void on_download_started(WebKitNetworkSession *session, WebKitDownload *download,
                                gpointer user_data) {
    (void) session;
    (void) user_data;

    g_warning("refusing a download: it would write to the engine's filesystem");
    webkit_download_cancel(download);
}

static gboolean on_run_file_chooser(WebKitWebView *view, WebKitFileChooserRequest *request,
                                    gpointer user_data) {
    (void) view;
    (void) user_data;

    g_warning("refusing a file upload dialog: it would expose the engine's filesystem");
    webkit_file_chooser_request_cancel(request);
    return TRUE;
}

static gchar *normalize_uri(const char *input) {
    while (*input == ' ') input++;

    if (*input == '\0') return g_strdup("about:blank");
    if (strstr(input, "://") != NULL) return g_strdup(input);
    if (g_str_has_prefix(input, "about:") || g_str_has_prefix(input, "data:")) return g_strdup(input);

    return g_strdup_printf("http://%s", input);
}

static void handle_command(webview_ctx *ctx, const char *line) {
    if (g_str_has_prefix(line, "navigate ")) {
        gchar *uri = normalize_uri(line + strlen("navigate "));
        load_uri(ctx, uri);
        g_free(uri);
    } else if (g_str_has_prefix(line, "clipboard ")) {
        gsize length = 0;
        guchar *decoded = g_base64_decode(line + strlen("clipboard "), &length);
        if (decoded == NULL) return;

        char *text = g_strndup((const char *) decoded, length);
        g_free(decoded);

        if (g_utf8_validate(text, -1, NULL)) {
            g_free(ctx->injected_clipboard);
            ctx->injected_clipboard = g_strdup(text);
            gdk_clipboard_set_text(ctx->clipboard, text);
        }

        g_free(text);
    } else if (g_strcmp0(line, "back") == 0) {
        webkit_web_view_go_back(ctx->view);
    } else if (g_strcmp0(line, "forward") == 0) {
        webkit_web_view_go_forward(ctx->view);
    } else if (g_strcmp0(line, "reload") == 0) {
        webkit_web_view_reload(ctx->view);
    } else if (g_strcmp0(line, "stop") == 0) {
        webkit_web_view_stop_loading(ctx->view);
    } else if (g_strcmp0(line, "quit") == 0) {
        g_main_loop_quit(ctx->loop);
    } else if (*line != '\0') {
        g_warning("nexterm-webview: unknown command \"%s\"", line);
    }
}

static gboolean on_stdin_ready(GIOChannel *channel, GIOCondition condition, gpointer user_data) {
    webview_ctx *ctx = user_data;
    gchar *line = NULL;
    gsize length = 0;

    if (condition & (G_IO_HUP | G_IO_ERR)) {
        g_main_loop_quit(ctx->loop);
        return FALSE;
    }

    for (;;) {
        GIOStatus status = g_io_channel_read_line(channel, &line, &length, NULL, NULL);

        if (status == G_IO_STATUS_NORMAL) {
            g_strchomp(line);
            handle_command(ctx, line);
            g_free(line);
            line = NULL;
            continue;
        }

        if (status == G_IO_STATUS_EOF) {
            g_main_loop_quit(ctx->loop);
            return FALSE;
        }

        return TRUE;
    }
}

int main(int argc, char **argv) {
    const char *proxy_uri = NULL;
    const char *profile_dir = NULL;
    const char *proxy_user = NULL;
    const char *proxy_password = NULL;

    for (int i = 1; i < argc; i++) {
        if (g_strcmp0(argv[i], "--proxy") == 0 && i + 1 < argc)
            proxy_uri = argv[++i];
        else if (g_strcmp0(argv[i], "--profile") == 0 && i + 1 < argc)
            profile_dir = argv[++i];
        else if (g_strcmp0(argv[i], "--proxy-user") == 0 && i + 1 < argc)
            proxy_user = argv[++i];
        else if (g_strcmp0(argv[i], "--proxy-password") == 0 && i + 1 < argc)
            proxy_password = argv[++i];
    }

    gtk_init();

    g_autofree gchar *data_dir = profile_dir ? g_build_filename(profile_dir, "data", NULL) : NULL;
    g_autofree gchar *cache_dir = profile_dir ? g_build_filename(profile_dir, "cache", NULL) : NULL;
    WebKitNetworkSession *session = webkit_network_session_new(data_dir, cache_dir);

    if (proxy_uri != NULL) {
        const gchar *ignore_hosts[] = {NULL};
        WebKitNetworkProxySettings *proxy = webkit_network_proxy_settings_new(proxy_uri, ignore_hosts);
        webkit_network_session_set_proxy_settings(session, WEBKIT_NETWORK_PROXY_MODE_CUSTOM, proxy);
        webkit_network_proxy_settings_free(proxy);
    } else {
        webkit_network_session_set_proxy_settings(session, WEBKIT_NETWORK_PROXY_MODE_NO_PROXY, NULL);
    }

    webkit_network_session_set_tls_errors_policy(session, WEBKIT_TLS_ERRORS_POLICY_IGNORE);

    webkit_website_data_manager_set_favicons_enabled(
        webkit_network_session_get_website_data_manager(session), TRUE);

    WebKitSettings *settings = webkit_settings_new();
    webkit_settings_set_enable_developer_extras(settings, FALSE);
    webkit_settings_set_enable_write_console_messages_to_stdout(settings, FALSE);
    webkit_settings_set_javascript_can_open_windows_automatically(settings, FALSE);
    webkit_settings_set_enable_page_cache(settings, TRUE);

    WebKitWebView *view = g_object_new(WEBKIT_TYPE_WEB_VIEW,
                                       "network-session", session,
                                       "settings", settings,
                                       NULL);

    webview_ctx ctx = {.view = view, .loading = FALSE,
                       .proxy_user = proxy_user, .proxy_password = proxy_password};
    ctx.loop = g_main_loop_new(NULL, FALSE);

    g_signal_connect(view, "load-changed", G_CALLBACK(on_load_changed), &ctx);
    g_signal_connect(view, "load-failed", G_CALLBACK(on_load_failed), &ctx);
    g_signal_connect(view, "notify::title", G_CALLBACK(on_notify_title), &ctx);
    g_signal_connect(view, "notify::favicon", G_CALLBACK(on_notify_favicon), &ctx);
    g_signal_connect(view, "decide-policy", G_CALLBACK(on_decide_policy), &ctx);
    g_signal_connect(view, "run-file-chooser", G_CALLBACK(on_run_file_chooser), &ctx);
    g_signal_connect(session, "download-started", G_CALLBACK(on_download_started), &ctx);
    g_signal_connect(view, "authenticate", G_CALLBACK(on_authenticate), &ctx);

    GtkWidget *window = gtk_window_new();
    ctx.window = window;
    gtk_window_set_title(GTK_WINDOW(window), "Nexterm");
    gtk_window_set_child(GTK_WINDOW(window), GTK_WIDGET(view));
    tame_bare_x_display(gtk_widget_get_display(window));
    gtk_window_set_decorated(GTK_WINDOW(window), FALSE);
    follow_screen_size(&ctx);
    gtk_window_present(GTK_WINDOW(window));

    GListModel *monitors = gdk_display_get_monitors(gtk_widget_get_display(window));
    g_signal_connect(monitors, "items-changed", G_CALLBACK(on_monitors_changed), &ctx);
    GdkMonitor *primary = g_list_model_get_item(monitors, 0);
    if (primary != NULL) {
        g_signal_connect(primary, "notify::geometry", G_CALLBACK(on_monitor_geometry), &ctx);
        g_object_unref(primary);
    }

    ctx.clipboard = gdk_display_get_clipboard(gtk_widget_get_display(window));
    g_signal_connect(ctx.clipboard, "changed", G_CALLBACK(on_clipboard_changed), &ctx);

    GIOChannel *stdin_channel = g_io_channel_unix_new(0);
    g_io_channel_set_flags(stdin_channel, G_IO_FLAG_NONBLOCK, NULL);
    g_io_channel_set_encoding(stdin_channel, NULL, NULL);
    g_io_add_watch(stdin_channel, G_IO_IN | G_IO_HUP | G_IO_ERR, on_stdin_ready, &ctx);

    load_blank_page(&ctx);
    emit_state(&ctx);

    g_main_loop_run(ctx.loop);

    g_io_channel_unref(stdin_channel);
    g_main_loop_unref(ctx.loop);
    g_free(ctx.injected_clipboard);
    g_object_unref(settings);
    g_object_unref(session);
    return 0;
}
