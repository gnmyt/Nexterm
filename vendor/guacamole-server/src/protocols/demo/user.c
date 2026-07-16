#include "demo.h"
#include "input.h"
#include "user.h"

#include <guacamole/client.h>
#include <guacamole/display.h>
#include <guacamole/user.h>

#include <pthread.h>

const char* GUAC_DEMO_CLIENT_ARGS[] = { NULL };

int guac_demo_user_join_handler(guac_user* user, int argc, char** argv) {
    guac_client* client = user->client;
    guac_demo_client* demo_client = (guac_demo_client*) client->data;

    if (argc != 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Badly formatted client arguments.");
        return 1;
    }

    if (user->owner) {
        demo_client->width = user->info.optimal_width;
        demo_client->height = user->info.optimal_height;
        guac_demo_clamp_size(&demo_client->width, &demo_client->height);

        demo_client->dpi = user->info.optimal_resolution > 0
            ? user->info.optimal_resolution : GUAC_DEMO_DEFAULT_DPI;

        if (pthread_create(&demo_client->render_loop_thread, NULL,
                    guac_demo_render_loop_thread, client)) {
            guac_user_log(user, GUAC_LOG_ERROR,
                    "Unable to start demo render loop thread.");
            return 1;
        }

        demo_client->render_loop_thread_started = 1;

    }

    user->mouse_handler = guac_demo_user_mouse_handler;
    user->key_handler = guac_demo_user_key_handler;

    user->size_handler = guac_demo_user_size_handler;

    return 0;
}

int guac_demo_user_leave_handler(guac_user* user) {
    guac_demo_client* demo_client = (guac_demo_client*) user->client->data;

    if (demo_client->display != NULL)
        guac_display_notify_user_left(demo_client->display, user);

    return 0;
}
