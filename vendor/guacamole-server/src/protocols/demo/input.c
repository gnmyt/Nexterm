#include "demo.h"
#include "input.h"

#include <guacamole/display.h>
#include <guacamole/user.h>

#include <pthread.h>
#include <stdio.h>
#include <string.h>

typedef struct guac_demo_modifier {
    int keysym;

    int modifier;
} guac_demo_modifier;

static const guac_demo_modifier guac_demo_modifiers[] = {
    { 0xFFE1, GUAC_DEMO_MOD_SHIFT },
    { 0xFFE2, GUAC_DEMO_MOD_SHIFT },
    { 0xFFE3, GUAC_DEMO_MOD_CTRL  },
    { 0xFFE4, GUAC_DEMO_MOD_CTRL  },
    { 0xFFE9, GUAC_DEMO_MOD_ALT   },
    { 0xFFEA, GUAC_DEMO_MOD_ALT   },
    { 0xFFEB, GUAC_DEMO_MOD_SUPER },
    { 0xFFEC, GUAC_DEMO_MOD_SUPER },
    { 0, 0 }
};

typedef struct guac_demo_named_key {
    int keysym;

    const char* name;
} guac_demo_named_key;

static const guac_demo_named_key guac_demo_named_keys[] = {
    { 0x0020, "Space"     },
    { 0xFF08, "Backspace" },
    { 0xFF09, "Tab"       },
    { 0xFF0D, "Enter"     },
    { 0xFF13, "Pause"     },
    { 0xFF14, "ScrollLock"},
    { 0xFF1B, "Escape"    },
    { 0xFF50, "Home"      },
    { 0xFF51, "Left"      },
    { 0xFF52, "Up"        },
    { 0xFF53, "Right"     },
    { 0xFF54, "Down"      },
    { 0xFF55, "PageUp"    },
    { 0xFF56, "PageDown"  },
    { 0xFF57, "End"       },
    { 0xFF63, "Insert"    },
    { 0xFF7F, "NumLock"   },
    { 0xFFE5, "CapsLock"  },
    { 0xFFFF, "Delete"    },
    { 0, NULL }
};

static int guac_demo_modifier_of(int keysym) {
    for (int i = 0; guac_demo_modifiers[i].keysym; i++) {
        if (guac_demo_modifiers[i].keysym == keysym)
            return guac_demo_modifiers[i].modifier;
    }

    return 0;
}

static void guac_demo_key_name(int keysym, char* buffer, size_t size) {
    for (int i = 0; guac_demo_named_keys[i].name != NULL; i++) {
        if (guac_demo_named_keys[i].keysym == keysym) {
            snprintf(buffer, size, "%s", guac_demo_named_keys[i].name);
            return;
        }
    }

    if (keysym >= 0xFFBE && keysym <= 0xFFC9) {
        snprintf(buffer, size, "F%i", keysym - 0xFFBE + 1);
        return;
    }

    if (keysym > 0x20 && keysym <= 0x7E) {
        snprintf(buffer, size, "%c", (char) keysym);
        return;
    }

    snprintf(buffer, size, "0x%04X", keysym);
}

int guac_demo_user_mouse_handler(guac_user* user, int x, int y, int mask) {
    guac_demo_client* demo_client = (guac_demo_client*) user->client->data;

    if (demo_client->render_thread != NULL)
        guac_display_render_thread_notify_user_moved_mouse(
                demo_client->render_thread, user, x, y, mask);

    pthread_mutex_lock(&demo_client->state_lock);
    demo_client->input.mouse_x = x;
    demo_client->input.mouse_y = y;
    demo_client->input.mouse_mask = mask;
    pthread_mutex_unlock(&demo_client->state_lock);

    return 0;
}

int guac_demo_user_size_handler(guac_user* user, int width, int height,
        int x_position, int top_offset) {
    guac_demo_client* demo_client = (guac_demo_client*) user->client->data;

    (void) x_position;
    (void) top_offset;

    guac_demo_clamp_size(&width, &height);

    pthread_mutex_lock(&demo_client->state_lock);
    demo_client->pending_width = width;
    demo_client->pending_height = height;
    pthread_mutex_unlock(&demo_client->state_lock);

    guac_user_log(user, GUAC_LOG_DEBUG, "Display resize requested: %ix%i",
            width, height);

    return 0;
}

int guac_demo_user_key_handler(guac_user* user, int keysym, int pressed) {
    guac_demo_client* demo_client = (guac_demo_client*) user->client->data;
    int modifier = guac_demo_modifier_of(keysym);

    pthread_mutex_lock(&demo_client->state_lock);

    if (modifier) {
        if (pressed)
            demo_client->input.modifiers |= modifier;
        else
            demo_client->input.modifiers &= ~modifier;

    }

    else if (pressed) {
        char name[32];
        guac_demo_key_name(keysym, name, sizeof(name));

        int modifiers = demo_client->input.modifiers;
        snprintf(demo_client->input.last_key, sizeof(demo_client->input.last_key),
                "%s%s%s%s%s",
                (modifiers & GUAC_DEMO_MOD_CTRL)  ? "Ctrl+"  : "",
                (modifiers & GUAC_DEMO_MOD_ALT)   ? "Alt+"   : "",
                (modifiers & GUAC_DEMO_MOD_SHIFT) ? "Shift+" : "",
                (modifiers & GUAC_DEMO_MOD_SUPER) ? "Super+" : "",
                name);

    }

    pthread_mutex_unlock(&demo_client->state_lock);
    return 0;
}
