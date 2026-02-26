#include "session.h"
#include "log.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

void nexterm_sm_init(nexterm_session_manager_t* sm) {
    memset(sm, 0, sizeof(nexterm_session_manager_t));
    pthread_mutex_init(&sm->mutex, NULL);
}

nexterm_session_t* nexterm_sm_create(nexterm_session_manager_t* sm,
                                     const char* session_id,
                                     session_type_t type,
                                     const char* host,
                                     uint16_t port) {
    pthread_mutex_lock(&sm->mutex);

    if (sm->count >= MAX_SESSIONS) {
        LOG_ERROR("Maximum sessions reached (%d)", MAX_SESSIONS);
        pthread_mutex_unlock(&sm->mutex);
        return NULL;
    }

    for (int i = 0; i < sm->count; i++) {
        if (strcmp(sm->sessions[i].session_id, session_id) == 0) {
            LOG_WARN("Session already exists: %s", session_id);
            pthread_mutex_unlock(&sm->mutex);
            return NULL;
        }
    }

    nexterm_session_t* session = &sm->sessions[sm->count];
    memset(session, 0, sizeof(nexterm_session_t));

    snprintf(session->session_id, sizeof(session->session_id), "%s", session_id);
    session->type = type;
    session->state = SESSION_STATE_PENDING;
    snprintf(session->host, sizeof(session->host), "%s", host);
    session->port = port;
    session->data_fd = -1;
    session->join_pipe[0] = -1;
    session->join_pipe[1] = -1;
    session->guac_client = NULL;
    session->ssh_sock = -1;
    session->param_count = 0;

    sm->count++;

    LOG_INFO("Session created: %s (type=%d, target=%s:%d)", session_id, type, host, port);
    pthread_mutex_unlock(&sm->mutex);

    return session;
}

nexterm_session_t* nexterm_sm_find(nexterm_session_manager_t* sm,
                                   const char* session_id) {
    pthread_mutex_lock(&sm->mutex);

    for (int i = 0; i < sm->count; i++) {
        if (strcmp(sm->sessions[i].session_id, session_id) == 0) {
            nexterm_session_t* s = &sm->sessions[i];
            pthread_mutex_unlock(&sm->mutex);
            return s;
        }
    }

    pthread_mutex_unlock(&sm->mutex);
    return NULL;
}

static void session_cleanup_resources(nexterm_session_t* session) {
    for (int j = 0; j < session->param_count; j++) {
        free(session->params[j].value);
        session->params[j].value = NULL;
    }

    if (session->data_fd >= 0) {
        close(session->data_fd);
        session->data_fd = -1;
    }
    if (session->join_pipe[0] >= 0) {
        close(session->join_pipe[0]);
        session->join_pipe[0] = -1;
    }
    if (session->join_pipe[1] >= 0) {
        close(session->join_pipe[1]);
        session->join_pipe[1] = -1;
    }
}

void nexterm_sm_remove(nexterm_session_manager_t* sm,
                       const char* session_id) {
    pthread_mutex_lock(&sm->mutex);

    for (int i = 0; i < sm->count; i++) {
        if (strcmp(sm->sessions[i].session_id, session_id) == 0) {
            LOG_INFO("Session removed: %s", session_id);
            session_cleanup_resources(&sm->sessions[i]);

            if (i < sm->count - 1) {
                memmove(&sm->sessions[i], &sm->sessions[i + 1],
                        (sm->count - i - 1) * sizeof(nexterm_session_t));
            }
            sm->count--;
            break;
        }
    }

    pthread_mutex_unlock(&sm->mutex);
}

const char* nexterm_session_get_param(const nexterm_session_t* session,
                                      const char* key) {
    for (int i = 0; i < session->param_count; i++) {
        if (strcmp(session->params[i].key, key) == 0)
            return session->params[i].value;
    }
    return NULL;
}

int nexterm_session_add_param(nexterm_session_t* session,
                              const char* key,
                              const char* value) {
    if (session->param_count >= MAX_PARAMS) {
        LOG_WARN("Max params reached for session %s", session->session_id);
        return -1;
    }

    snprintf(session->params[session->param_count].key,
             sizeof(session->params[session->param_count].key), "%s", key);
    session->params[session->param_count].value = strdup(value ? value : "");
    if (!session->params[session->param_count].value)
        return -1;
    session->param_count++;

    return 0;
}

void nexterm_sm_destroy(nexterm_session_manager_t* sm) {
    pthread_mutex_lock(&sm->mutex);

    for (int i = 0; i < sm->count; i++)
        session_cleanup_resources(&sm->sessions[i]);

    sm->count = 0;
    pthread_mutex_unlock(&sm->mutex);
    pthread_mutex_destroy(&sm->mutex);
}
