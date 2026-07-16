#include "client.h"
#include "demo.h"
#include "user.h"

#include <guacamole/client.h>
#include <guacamole/display.h>
#include <guacamole/mem.h>
#include <guacamole/socket.h>

#include <pthread.h>

static int guac_demo_join_pending_handler(guac_client* client) {
    guac_demo_client* demo_client = (guac_demo_client*) client->data;

    if (demo_client->display != NULL) {
        guac_socket* broadcast_socket = client->pending_socket;
        guac_display_dup(demo_client->display, broadcast_socket);
        guac_socket_flush(broadcast_socket);
    }

    return 0;
}

int guac_client_init(guac_client* client) {
    client->args = GUAC_DEMO_CLIENT_ARGS;

    guac_demo_client* demo_client = guac_mem_zalloc(sizeof(guac_demo_client));
    client->data = demo_client;

    pthread_mutex_init(&demo_client->state_lock, NULL);

    client->join_handler = guac_demo_user_join_handler;
    client->join_pending_handler = guac_demo_join_pending_handler;
    client->leave_handler = guac_demo_user_leave_handler;
    client->free_handler = guac_demo_client_free_handler;

    return 0;
}

int guac_demo_client_free_handler(guac_client* client) {
    guac_demo_client* demo_client = (guac_demo_client*) client->data;

    if (demo_client->display != NULL)
        guac_display_stop(demo_client->display);

    if (demo_client->render_loop_thread_started)
        pthread_join(demo_client->render_loop_thread, NULL);

    if (demo_client->display != NULL)
        guac_display_free(demo_client->display);

    pthread_mutex_destroy(&demo_client->state_lock);

    guac_mem_free(demo_client);
    return 0;
}
