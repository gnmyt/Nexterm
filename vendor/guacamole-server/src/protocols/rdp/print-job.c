/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

#include "print-job.h"
#include "rdp.h"

#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/stream.h>
#include <guacamole/user.h>

#include <errno.h>
#include <pthread.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

/**
 * The command to run when filtering postscript to produce PDF. This must be
 * a NULL-terminated array of arguments, where the first argument is the name
 * of the file to run.
 */
char* const guac_rdp_pdf_filter_command[] = {
    "gs",
    "-q",
    "-dNOPAUSE",
    "-dBATCH",
    "-dSAFER",
    "-dPARANOIDSAFER",
    "-sDEVICE=pdfwrite",
    "-sOutputFile=-",
    "-sstdout=/dev/null",
    "-f",
    "-",
    NULL
};

/**
 * Updates the state of the given print job. Any threads currently blocked by a
 * call to guac_rdp_print_job_wait_for_ack() will be unblocked.
 *
 * @param job
 *     The print job whose state should be updated.
 *
 * @param state
 *     The new state to assign to the given print job.
 */
static void guac_rdp_print_job_set_state(guac_rdp_print_job* job,
        guac_rdp_print_job_state state) {

    pthread_mutex_lock(&(job->state_lock));

    /* Update stream state, signalling modification */
    job->state = state;
    pthread_cond_signal(&(job->state_modified));

    pthread_mutex_unlock(&(job->state_lock));

}

/**
 * Suspends execution of the current thread until the state of the given print
 * job is not GUAC_RDP_PRINT_JOB_WAITING_FOR_ACK. If the state of the print
 * job is GUAC_RDP_PRINT_JOB_ACK_RECEIVED, the state is automatically reset
 * back to GUAC_RDP_PRINT_JOB_WAITING_FOR_ACK prior to returning.
 *
 * @param job
 *     The print job to wait for.
 *
 * @return
 *     Zero if the state of the print job is GUAC_RDP_PRINT_JOB_CLOSED,
 *     non-zero if the state was GUAC_RDP_PRINT_JOB_ACK_RECEIVED and has been
 *     automatically reset to GUAC_RDP_PRINT_JOB_WAITING_FOR_ACK.
 */
static int guac_rdp_print_job_wait_for_ack(guac_rdp_print_job* job) {

    /* Wait for ack if stream open and not yet received */
    pthread_mutex_lock(&(job->state_lock));
    if (job->state == GUAC_RDP_PRINT_JOB_WAITING_FOR_ACK)
        pthread_cond_wait(&job->state_modified, &job->state_lock);

    /* Reset state if ack received */
    int got_ack = (job->state == GUAC_RDP_PRINT_JOB_ACK_RECEIVED);
    if (got_ack)
        job->state = GUAC_RDP_PRINT_JOB_WAITING_FOR_ACK;

    /* Return whether ack was successfully received */
    pthread_mutex_unlock(&(job->state_lock));
    return got_ack;

}

/**
 * Sends a "file" instruction to the given user describing the PDF file that
 * will be sent using the output of the given print job. If the given user no
 * longer exists, the print stream will be automatically terminated.
 *
 * @param user
 *     The user receiving the "file" instruction.
 *
 * @param data
 *     A pointer to the guac_rdp_print_job representing the print job being
 *     streamed.
 *
 * @return
 *     Always NULL.
 */
static void* guac_rdp_print_job_begin_stream(guac_user* user, void* data) {

    guac_rdp_print_job* job = (guac_rdp_print_job*) data;
    guac_client_log(job->client, GUAC_LOG_DEBUG, "Beginning print stream: %s",
            job->filename);

    /* Kill job and do nothing if user no longer exists */
    if (user == NULL) {
        guac_rdp_print_job_kill(job);
        return NULL;
    }

    /* Send document as a PDF file stream */
    guac_protocol_send_file(user->socket, job->stream,
            "application/pdf", job->filename);

    guac_socket_flush(user->socket);
    return NULL;

}

/**
 * Sends a "blob" instruction to the given user containing the provided data
 * along the stream associated with the provided print job. If the given user
 * no longer exists, the print stream will be automatically terminated.
 *
 * @param user
 *     The user receiving the "blob" instruction.
 *
 * @param data
 *     A pointer to an guac_rdp_print_blob structure containing the data to
 *     be written, the number of bytes being written, and the print job being
 *     streamed.
 *
 * @return
 *     Always NULL.
 */
static void* guac_rdp_print_job_send_blob(guac_user* user, void* data) {

    guac_rdp_print_blob* blob = (guac_rdp_print_blob*) data;
    guac_rdp_print_job* job = blob->job;

    guac_client_log(job->client, GUAC_LOG_DEBUG, "Sending %i byte(s) "
            "of filtered output.", blob->length);

    /* Kill job and do nothing if user no longer exists */
    if (user == NULL) {
        guac_rdp_print_job_kill(job);
        return NULL;
    }

    /* Send single blob of print data */
    guac_protocol_send_blob(user->socket, job->stream,
            blob->buffer, blob->length);

    guac_socket_flush(user->socket);
    return NULL;

}

/**
 * Sends an "end" instruction to the given user, closing the stream associated
 * with the given print job. If the given user no longer exists, the print
 * stream will be automatically terminated.
 *
 * @param user
 *     The user receiving the "end" instruction.
 *
 * @param data
 *     A pointer to the guac_rdp_print_job representing the print job being
 *     streamed.
 *
 * @return
 *     Always NULL.
 */
static void* guac_rdp_print_job_end_stream(guac_user* user, void* data) {

    guac_rdp_print_job* job = (guac_rdp_print_job*) data;
    guac_client_log(job->client, GUAC_LOG_DEBUG, "End of print stream.");

    /* Kill job and do nothing if user no longer exists */
    if (user == NULL) {
        guac_rdp_print_job_kill(job);
        return NULL;
    }

    /* Explicitly close down stream */
    guac_protocol_send_end(user->socket, job->stream);
    guac_socket_flush(user->socket);

    /* Clean up our end of the stream */
    guac_user_free_stream(job->user, job->stream);

    return NULL;

}

/**
 * Handler for "ack" messages received in response to printed data. Additional
 * data will be sent as a result or, if no data remains, the stream will be
 * terminated. It is required that the data pointer of the provided stream be
 * set to the file descriptor from which the printed data should be read.
 *
 * @param user
 *     The user to whom the printed data is being sent.
 *
 * @param stream
 *     The stream along which the printed data is to be sent. The data pointer
 *     of this stream MUST be set to the file descriptor from which the data
 *     being sent is to be read.
 *
 * @param message
 *     An arbitrary, human-readable message describing the success/failure of
 *     the operation being acknowledged (either stream creation or receipt of
 *     a blob).
 *
 * @param status
 *     The status code describing the success/failure of the operation being
 *     acknowledged (either stream creation or receipt of a blob).
 *
 * @return
 *     Always zero.
 */
static int guac_rdp_print_filter_ack_handler(guac_user* user,
        guac_stream* stream, char* message, guac_protocol_status status) {

    guac_rdp_print_job* job = (guac_rdp_print_job*) stream->data;

    /* Update state for successful acks */
    if (status == GUAC_PROTOCOL_STATUS_SUCCESS)
        guac_rdp_print_job_set_state(job, GUAC_RDP_PRINT_JOB_ACK_RECEIVED);

    /* Terminate stream if ack signals an error */
    else {

        /* Note that the stream was aborted by the user */
        guac_client_log(job->client, GUAC_LOG_INFO, "User explicitly aborted "
                "print stream.");

        /* Kill job (the results will no longer be received) */
        guac_rdp_print_job_kill(job);

    }

    return 0;

}

/**
 * Forks a new print filtering process which accepts PostScript input and
 * produces PDF output. File descriptors for writing input and reading output
 * will automatically be allocated and must be manually closed when processing
 * is complete.
 *
 * @param client
 *     The guac_client associated with the print job for which this filter
 *     process is being created.
 *
 * @param input_fd
 *     A pointer to an int which should receive the input file descriptor of
 *     the filter process. PostScript input for the filter process should be
 *     written to this file descriptor.
 *
 * @param output_fd
 *     A pointer to an int which should receive the output file descriptor of
 *     the filter process. PDF output from the filter process must be
 *     continuously read from this file descriptor or the pipeline may block.
 *
 * @return
 *     The PID of the filter process, or -1 if the filter process could not be
 *     created. If the filter process could not be created, the values assigned
 *     through input_fd and output_fd are undefined.
 */
static pid_t guac_rdp_create_filter_process(guac_client* client,
        int* input_fd, int* output_fd) {

    int child_pid;
    int stdin_pipe[2];
    int stdout_pipe[2];

    /* Create STDIN pipe */
    if (pipe(stdin_pipe)) {
        guac_client_log(client, GUAC_LOG_ERROR, "Unable to create STDIN "
                "pipe for PDF filter process: %s", strerror(errno));
        return -1;
    }

    /* Create STDOUT pipe */
    if (pipe(stdout_pipe)) {
        guac_client_log(client, GUAC_LOG_ERROR, "Unable to create STDOUT "
                "pipe for PDF filter process: %s", strerror(errno));
        close(stdin_pipe[0]);
        close(stdin_pipe[1]);
        return -1;
    }

    /* Store parent side of stdin/stdout */
    *input_fd = stdin_pipe[1];
    *output_fd = stdout_pipe[0];

    /* Fork child process */
    child_pid = fork();

    /* Log fork errors */
    if (child_pid == -1) {
        guac_client_log(client, GUAC_LOG_ERROR, "Unable to fork PDF filter "
                "process: %s", strerror(errno));
        close(stdin_pipe[0]);
        close(stdin_pipe[1]);
        close(stdout_pipe[0]);
        close(stdout_pipe[1]);
        return -1;
    }

    /* Child process */
    if (child_pid == 0) {

        /* Close unneeded ends of pipe */
        close(stdin_pipe[1]);
        close(stdout_pipe[0]);

        /* Reassign file descriptors as STDIN/STDOUT */
        dup2(stdin_pipe[0], STDIN_FILENO);
        dup2(stdout_pipe[1], STDOUT_FILENO);

        /* Run PDF filter */
        guac_client_log(client, GUAC_LOG_INFO, "Running %s",
                guac_rdp_pdf_filter_command[0]);
        if (execvp(guac_rdp_pdf_filter_command[0],
                    guac_rdp_pdf_filter_command) < 0)
            guac_client_log(client, GUAC_LOG_ERROR, "Unable to execute PDF "
                    "filter command: %s", strerror(errno));
        else
            guac_client_log(client, GUAC_LOG_ERROR, "Unable to execute PDF "
                    "filter command, but no error given");

        /* Terminate child process */
        exit(1);

    }

    /* Log fork success */
    guac_client_log(client, GUAC_LOG_INFO, "Created PDF filter process "
            "PID=%i", child_pid);

    /* Close unneeded ends of pipe */
    close(stdin_pipe[0]);
    close(stdout_pipe[1]);
    return child_pid;

}

/**
 * Thread which continuously reads from the output file descriptor associated
 * with the given print job, writing filtered PDF output to the associated
 * Guacamole stream, and terminating only after the print job has completed
 * processing or the associated Guacamole stream has closed.
 *
 * @param data
 *     A pointer to the guac_rdp_print_job representing the print job that
 *     should be read.
 *
 * @return
 *     Always NULL.
 */
static void* guac_rdp_print_job_output_thread(void* data) {

    int length;
    char buffer[6048];

    guac_rdp_print_job* job = (guac_rdp_print_job*) data;
    guac_client_log(job->client, GUAC_LOG_DEBUG, "Reading output from filter "
            "process...");

    /* Read continuously while data remains */
    while ((length = read(job->output_fd, buffer, sizeof(buffer))) > 0) {

        /* Wait for client to be ready for blob */
        if (guac_rdp_print_job_wait_for_ack(job)) {

            guac_rdp_print_blob blob = {
                .job    = job,
                .buffer = buffer,
                .length = length
            };

            /* Write a single blob of output */
            guac_client_for_user(job->client, job->user,
                    guac_rdp_print_job_send_blob, &blob);

        }

        /* Abort if stream is closed */
        else {
            guac_client_log(job->client, GUAC_LOG_DEBUG, "Print stream "
                    "explicitly aborted.");
            break;
        }

    }

    /* Warn of read errors */
    if (length < 0)
        guac_client_log(job->client, GUAC_LOG_ERROR,
                "Error reading from filter: %s", strerror(errno));

    /* Terminate stream */
    guac_client_for_user(job->client, job->user,
            guac_rdp_print_job_end_stream, job);

    /* Ensure all associated file descriptors are closed */
    close(job->input_fd);
    close(job->output_fd);

    guac_client_log(job->client, GUAC_LOG_DEBUG, "Print job completed.");
    return NULL;

}

void* guac_rdp_print_job_alloc(guac_user* user, void* data) {

    /* Allocate nothing if user does not exist */
    if (user == NULL)
        return NULL;

    /* Allocate stream for print job output */
    guac_stream* stream = guac_user_alloc_stream(user);
    if (stream == NULL)
        return NULL;

    /* Bail early if allocation fails */
    guac_rdp_print_job* job = guac_mem_alloc(sizeof(guac_rdp_print_job));
    if (job == NULL)
        return NULL;

    /* Associate job with stream and dependent data */
    job->client = user->client;
    job->user = user;
    job->stream = stream;
    job->bytes_received = 0;

    /* Set default filename for job */
    strcpy(job->filename, GUAC_RDP_PRINT_JOB_DEFAULT_FILENAME);

    /* Prepare stream for receipt of acks */
    stream->ack_handler = guac_rdp_print_filter_ack_handler;
    stream->data = job;

    /* Create print filter process */
    job->filter_pid = guac_rdp_create_filter_process(job->client,
            &job->input_fd, &job->output_fd);

    /* Abort if print filter process cannot be created */
    if (job->filter_pid == -1) {
        guac_user_free_stream(user, stream);
        guac_mem_free(job);
        return NULL;
    }

    /* Init stream state signal and lock */
    job->state = GUAC_RDP_PRINT_JOB_WAITING_FOR_ACK;
    pthread_cond_init(&job->state_modified, NULL);
    pthread_mutex_init(&job->state_lock, NULL);

    /* Start output thread */
    pthread_create(&job->output_thread, NULL,
            guac_rdp_print_job_output_thread, job);

    /* Print job allocated successfully */
    return job;

}

/**
 * Attempts to parse the given PostScript "%%Title:" header, storing the
 * contents within the filename of the given print job. If the given buffer
 * does not immediately begin with the "%%Title:" header, this function has no
 * effect.
 *
 * @param job
 *     The job whose filename should be set if the "%%Title:" header is
 *     successfully parsed.
 *
 * @param buffer
 *     The buffer to parse as the "%%Title:" header.
 *
 * @param length
 *     The number of bytes within the buffer.
 *
 * @return
 *     Non-zero if the given buffer began with the "%%Title:" header and this
 *     header was successfully parsed, zero otherwise.
 */
static int guac_rdp_print_job_parse_title_header(guac_rdp_print_job* job,
        void* buffer, int length) {

    int i;
    char* current = buffer;
    char* filename = job->filename;

    /* Verify that the buffer begins with "%%Title: " */
    if (strncmp(current, "%%Title: ", 9) != 0)
        return 0;

    /* Skip past "%%Title: " */
    current += 9;
    length -= 9;

    /* Calculate space remaining in filename */
    int remaining = sizeof(job->filename) - 5 /* ".pdf\0" */;

    /* Do not exceed bounds of provided buffer */
    if (length < remaining)
        remaining = length;

    /* Copy as much of title as reasonable */
    for (i = 0; i < remaining; i++) {

        /* Get character, stop at EOL */
        char c = *(current++);
        if (c == '\r' || c == '\n')
            break;

        /* Copy to filename */
        *(filename++) = c;

    }

    /* Append extension to filename */
    strcpy(filename, ".pdf");

    /* Title successfully parsed */
    return 1;

}

/**
 * Searches through the given buffer for PostScript headers denoting the title
 * of the document, assigning the filename of the given print job using the
 * discovered title. If no title can be found within
 * GUAC_RDP_PRINT_JOB_TITLE_SEARCH_LENGTH bytes, this function has no effect.
 *
 * @param job
 *     The job whose filename should be set if the document title can be found
 *     within the given buffer.
 *
 * @param buffer
 *     The buffer to search for the document title.
 *
 * @param length
 *     The number of bytes within the buffer.
 */
static void guac_rdp_print_job_read_filename(guac_rdp_print_job* job,
        void* buffer, int length) {

    char* current = buffer;
    int i;

    /* Restrict search area */
    if (length > GUAC_RDP_PRINT_JOB_TITLE_SEARCH_LENGTH)
        length = GUAC_RDP_PRINT_JOB_TITLE_SEARCH_LENGTH;

    /* Search for document title within buffer */
    for (i = 0; i < length; i++) {

        /* If document title has been found, we're done */
        if (guac_rdp_print_job_parse_title_header(job, current, length))
            break;

        /* Advance to next character */
        length--;
        current++;

    }

}

int guac_rdp_print_job_write(guac_rdp_print_job* job,
        void* buffer, int length) {

    guac_client* client = job->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /* Create print job, if not yet created */
    if (job->bytes_received == 0) {

        /* Attempt to read document title from first buffer of data */
        guac_rdp_print_job_read_filename(job, buffer, length);

        /* Begin print stream */
        guac_client_for_user(job->client, job->user,
                guac_rdp_print_job_begin_stream, job);

    }

    /* Update counter of bytes received */
    job->bytes_received += length;

    /* Write data to filter process, unblocking any threads waiting on the
     * generic RDP message lock as this may be a lengthy operation that depends
     * on other threads sending outstanding messages (resulting in deadlock if
     * those messages are blocked) */
    int unlock_status = pthread_mutex_unlock(&(rdp_client->message_lock));
    int write_status = write(job->input_fd, buffer, length);

    /* Restore RDP message lock state */
    if (!unlock_status)
        pthread_mutex_lock(&(rdp_client->message_lock));

    return write_status;

}

void guac_rdp_print_job_free(guac_rdp_print_job* job) {

    guac_client* client = job->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /* No more input will be provided */
    close(job->input_fd);

    /* Wait for job to terminate, unblocking any threads waiting on the generic
     * RDP message lock as this may be a lengthy operation that depends on
     * other threads sending outstanding messages (resulting in deadlock if
     * those messages are blocked) */
    int unlock_status = pthread_mutex_unlock(&(rdp_client->message_lock));
    pthread_join(job->output_thread, NULL);

    /* Restore RDP message lock state */
    if (!unlock_status)
        pthread_mutex_lock(&(rdp_client->message_lock));

    /* Destroy lock */
    pthread_mutex_destroy(&(job->state_lock));

    /* Free base structure */
    guac_mem_free(job);

}

void guac_rdp_print_job_kill(guac_rdp_print_job* job) {

    /* Forcibly kill filter process, if running */
    kill(job->filter_pid, SIGKILL);

    /* Stop all handling of I/O */
    close(job->input_fd);
    close(job->output_fd);

    /* Mark stream as closed */
    guac_rdp_print_job_set_state(job, GUAC_RDP_PRINT_JOB_CLOSED);

}

