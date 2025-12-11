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

#include "channels/audio-input/audio-buffer.h"
#include "rdp.h"

#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/stream.h>
#include <guacamole/timestamp.h>
#include <guacamole/user.h>

#include <assert.h>
#include <errno.h>
#include <pthread.h>
#include <stdint.h>
#include <stdlib.h>
#include <time.h>

/**
 * The number of nanoseconds in one second.
 */
#define NANOS_PER_SECOND 1000000000L

/**
 * Returns whether the given timespec represents a point in time in the future
 * relative to the current system time.
 *
 * @param ts
 *     The timespec to test.
 *
 * @return
 *     Non-zero if the given timespec is in the future relative to the current
 *     system time, zero otherwise.
 */
static int guac_rdp_audio_buffer_is_future(const struct timespec* ts) {

    struct timespec now;
    clock_gettime(CLOCK_REALTIME, &now);

    if (now.tv_sec != ts->tv_sec)
        return now.tv_sec < ts->tv_sec;

    return now.tv_nsec < ts->tv_nsec;

}

/**
 * Returns whether the given audio buffer may be flushed. An audio buffer may
 * be flushed if the audio buffer is not currently being freed, at least one
 * packet of audio data is available within the buffer, and flushing the next
 * packet of audio data now would not violate scheduling/throttling rules for
 * outbound audio data.
 *
 * IMPORTANT: The guac_rdp_audio_buffer's lock MUST already be held when
 * invoking this function.
 *
 * @param audio_buffer
 *     The guac_rdp_audio_buffer to test.
 *
 * @return
 *     Non-zero if the given audio buffer may be flushed, zero if the audio
 *     buffer cannot be flushed for any reason.
 */
static int guac_rdp_audio_buffer_may_flush(guac_rdp_audio_buffer* audio_buffer) {
    return !audio_buffer->stopping
        && audio_buffer->packet_size > 0
        && audio_buffer->bytes_written >= audio_buffer->packet_size
        && !guac_rdp_audio_buffer_is_future(&audio_buffer->next_flush);
}

/**
 * Returns the duration of the given quantity of audio data in milliseconds.
 *
 * @param format
 *     The format of the audio data in question.
 *
 * @param length
 *     The number of bytes of audio data.
 *
 * @return
 *     The duration of the audio data in milliseconds.
 */
static int guac_rdp_audio_buffer_duration(const guac_rdp_audio_format* format, int length) {
    return length * 1000 / format->rate / format->bps / format->channels;
}

/**
 * Returns the number of bytes required to store audio data in the given format
 * covering the given length of time.
 *
 * @param format
 *     The format of the audio data in question.
 *
 * @param duration
 *     The duration of the audio data in milliseconds.
 *
 * @return
 *     The number of bytes required to store audio data in the given format
 *     covering the given length of time.
 */
static size_t guac_rdp_audio_buffer_length(const guac_rdp_audio_format* format, int duration) {
    return guac_mem_ckd_mul_or_die(duration, format->rate, format->bps, format->channels) / 1000;
}

/**
 * Notifies the given guac_rdp_audio_buffer that a single packet of audio data
 * has just been flushed, updating the scheduled time of the next flush. The
 * timing of the next flush will be set such that the overall real time audio
 * generation rate is not exceeded, but will be adjusted as necessary to
 * compensate for latency induced by differences in audio packet size/duration.
 *
 * IMPORTANT: The guac_rdp_audio_buffer's lock MUST already be held when
 * invoking this function.
 *
 * @param audio_buffer
 *     The guac_rdp_audio_buffer to update.
 */
static void guac_rdp_audio_buffer_schedule_flush(guac_rdp_audio_buffer* audio_buffer) {

    struct timespec next_flush;
    clock_gettime(CLOCK_REALTIME, &next_flush);

    /* Calculate the point in time that the next flush would be allowed,
     * assuming that the remote server processes data no faster than
     * real time */
    uint64_t delta_nsecs = audio_buffer->packet_size * NANOS_PER_SECOND
        / audio_buffer->out_format.rate
        / audio_buffer->out_format.bps
        / audio_buffer->out_format.channels;

    /* Amortize the additional latency from packet data buffered beyond the
     * desired packet size over each remaining packet such that we gradually
     * approach an effective additional latency of 0 */
    int packets_remaining = audio_buffer->bytes_written / audio_buffer->packet_size;
    if (packets_remaining > 1)
        delta_nsecs = delta_nsecs * (packets_remaining - 1) / packets_remaining;

    uint64_t nsecs = next_flush.tv_nsec + delta_nsecs;

    next_flush.tv_sec += nsecs / NANOS_PER_SECOND;
    next_flush.tv_nsec = nsecs % NANOS_PER_SECOND;

    audio_buffer->next_flush = next_flush;

}

/**
 * Waits for additional data to be available for flush within the given audio
 * buffer. If data is available but insufficient time has elapsed since the
 * last flush, this function may block until sufficient time has elapsed. If
 * the state of the audio buffer changes in any way while waiting for
 * additional data, or if the audio buffer is being freed, this function will
 * return immediately.
 *
 * It is the responsibility of the caller to check the state of the audio
 * buffer after this function returns to verify whether the desired state
 * change has occurred and re-invoke the function if needed.
 *
 * @param audio_buffer
 *     The guac_rdp_audio_buffer to wait for.
 */
static void guac_rdp_audio_buffer_wait(guac_rdp_audio_buffer* audio_buffer) {

    pthread_mutex_lock(&(audio_buffer->lock));

    /* Do not wait if audio_buffer is already closed */
    if (!audio_buffer->stopping) {

        /* If sufficient data exists for a flush, wait until next possible
         * flush OR until some other state change occurs (such as the buffer
         * being closed) */
        if (audio_buffer->bytes_written && audio_buffer->bytes_written >= audio_buffer->packet_size)
            pthread_cond_timedwait(&audio_buffer->modified, &audio_buffer->lock,
                    &audio_buffer->next_flush);

        /* If sufficient data DOES NOT exist, we should wait indefinitely */
        else
            pthread_cond_wait(&audio_buffer->modified, &audio_buffer->lock);

    }

    pthread_mutex_unlock(&(audio_buffer->lock)); 

}

/**
 * Regularly and automatically flushes audio packets by invoking the flush
 * handler of the associated audio buffer. Packets are scheduled automatically
 * to avoid potentially exceeding the processing and buffering capabilities of
 * the software running within the RDP server. Once started, this thread runs
 * until the associated audio buffer is freed via guac_rdp_audio_buffer_free().
 *
 * @param data
 *     A pointer to the guac_rdp_audio_buffer that should be flushed.
 *
 * @return
 *     Always NULL.
 */
static void* guac_rdp_audio_buffer_flush_thread(void* data) {

    guac_rdp_audio_buffer* audio_buffer = (guac_rdp_audio_buffer*) data;
    while (!audio_buffer->stopping) {

        pthread_mutex_lock(&(audio_buffer->lock));

        if (!guac_rdp_audio_buffer_may_flush(audio_buffer)) {

            pthread_mutex_unlock(&(audio_buffer->lock));

            /* Wait for additional data if we aren't able to flush */
            guac_rdp_audio_buffer_wait(audio_buffer);

            /* We might still not be able to flush (buffer might be closed,
             * some other state change might occur that isn't receipt of data,
             * data might be received but not enough for a flush, etc.) */
            continue;

        }

        guac_client_log(audio_buffer->client, GUAC_LOG_TRACE, "Current audio input latency: %i ms (%i bytes waiting in buffer)",
                guac_rdp_audio_buffer_duration(&audio_buffer->out_format, audio_buffer->bytes_written),
                audio_buffer->bytes_written);

        /* Only actually invoke if defined */
        if (audio_buffer->flush_handler) {
            guac_rdp_audio_buffer_schedule_flush(audio_buffer);
            audio_buffer->flush_handler(audio_buffer,
                    audio_buffer->packet_size);
        }

        /* Shift buffer back by one packet */
        audio_buffer->bytes_written -= audio_buffer->packet_size;
        memmove(audio_buffer->packet, audio_buffer->packet + audio_buffer->packet_size, audio_buffer->bytes_written);

        pthread_cond_broadcast(&(audio_buffer->modified));
        pthread_mutex_unlock(&(audio_buffer->lock));

    }

    return NULL;

}

guac_rdp_audio_buffer* guac_rdp_audio_buffer_alloc(guac_client* client) {

    guac_rdp_audio_buffer* buffer = guac_mem_zalloc(sizeof(guac_rdp_audio_buffer));

    pthread_mutex_init(&(buffer->lock), NULL);
    pthread_cond_init(&(buffer->modified), NULL);
    buffer->client = client;

    /* Begin automated, throttled flush of future data */
    pthread_create(&(buffer->flush_thread), NULL,
            guac_rdp_audio_buffer_flush_thread, (void*) buffer);

    return buffer;
}

/**
 * Parameters describing an "ack" instruction to be sent to the current user of
 * an inbound audio stream (guac_rdp_audio_buffer).
 */
typedef struct guac_rdp_audio_buffer_ack_params {

    /**
     * The audio buffer associated with the guac_stream for which the "ack"
     * instruction should be sent, if any. If there is no associated
     * guac_stream, no "ack" will be sent.
     */
    guac_rdp_audio_buffer* audio_buffer;

    /**
     * An arbitrary human-readable message to send along with the "ack".
     */
    const char* message;

    /**
     * The Guacamole protocol status code to send with the "ack". This should
     * be GUAC_PROTOCOL_STATUS_SUCCESS if the audio stream has been set up
     * successfully or GUAC_PROTOCOL_STATUS_RESOURCE_CLOSED if the audio stream
     * has been closed (but may usable again if reopened).
     */
    guac_protocol_status status;

} guac_rdp_audio_buffer_ack_params;

/**
 * Sends an "ack" instruction over the socket associated with the Guacamole
 * stream over which audio data is being received. The "ack" instruction will
 * only be sent if the Guacamole audio stream has been established (through
 * receipt of an "audio" instruction), is still open (has not received an "end"
 * instruction nor been associated with an "ack" having an error code), and is
 * associated with an active RDP AUDIO_INPUT channel.
 *
 * IMPORTANT: The guac_rdp_audio_buffer's lock MUST already be held when
 * invoking this function.
 *
 * @param user
 *     The user that should receive the "ack".
 *
 * @param data
 *     An instance of guac_rdp_audio_buffer_ack_params describing the "ack"
 *     instruction to be sent.
 *
 * @returns
 *     Always NULL.
 */
static void* guac_rdp_audio_buffer_ack(guac_user* user, void* data) {

    guac_rdp_audio_buffer_ack_params* params = (guac_rdp_audio_buffer_ack_params*) data;
    guac_rdp_audio_buffer* audio_buffer = params->audio_buffer;
    guac_stream* stream = audio_buffer->stream;

    /* Do not send ack unless both sides of the audio stream are ready */
    if (user == NULL || stream == NULL || audio_buffer->packet == NULL)
        return NULL;

    /* Send ack instruction */
    guac_protocol_send_ack(user->socket, stream, params->message, params->status);
    guac_socket_flush(user->socket);

    return NULL;

}

void guac_rdp_audio_buffer_set_stream(guac_rdp_audio_buffer* audio_buffer,
        guac_user* user, guac_stream* stream, int rate, int channels, int bps) {

    pthread_mutex_lock(&(audio_buffer->lock));

    /* Associate received stream */
    audio_buffer->user = user;
    audio_buffer->stream = stream;
    audio_buffer->in_format.rate = rate;
    audio_buffer->in_format.channels = channels;
    audio_buffer->in_format.bps = bps;

    /* Acknowledge stream creation (if buffer is ready to receive) */
    guac_rdp_audio_buffer_ack_params ack_params = { audio_buffer, "OK", GUAC_PROTOCOL_STATUS_SUCCESS };
    guac_client_for_user(audio_buffer->client, user, guac_rdp_audio_buffer_ack, &ack_params);

    guac_user_log(user, GUAC_LOG_DEBUG, "User is requesting to provide audio "
            "input as %i-channel, %i Hz PCM audio at %i bytes/sample.",
            audio_buffer->in_format.channels,
            audio_buffer->in_format.rate,
            audio_buffer->in_format.bps);

    pthread_cond_broadcast(&(audio_buffer->modified));
    pthread_mutex_unlock(&(audio_buffer->lock));

}

void guac_rdp_audio_buffer_set_output(guac_rdp_audio_buffer* audio_buffer,
        int rate, int channels, int bps) {

    pthread_mutex_lock(&(audio_buffer->lock));

    /* Set output format */
    audio_buffer->out_format.rate = rate;
    audio_buffer->out_format.channels = channels;
    audio_buffer->out_format.bps = bps;

    pthread_cond_broadcast(&(audio_buffer->modified));
    pthread_mutex_unlock(&(audio_buffer->lock));

}

void guac_rdp_audio_buffer_begin(guac_rdp_audio_buffer* audio_buffer,
        int packet_frames, guac_rdp_audio_buffer_flush_handler* flush_handler,
        void* data) {

    pthread_mutex_lock(&(audio_buffer->lock));

    /* Reset buffer state to provided values */
    audio_buffer->bytes_written = 0;
    audio_buffer->flush_handler = flush_handler;
    audio_buffer->data = data;

    /* Calculate size of each packet in bytes */
    audio_buffer->packet_size = guac_mem_ckd_mul_or_die(packet_frames,
                audio_buffer->out_format.channels,
                audio_buffer->out_format.bps);

    /* Ensure outbound buffer includes enough space for at least 250ms of
     * audio */
    size_t ideal_size = guac_rdp_audio_buffer_length(&audio_buffer->out_format,
            GUAC_RDP_AUDIO_BUFFER_MIN_DURATION);

    /* Round up to nearest whole packet */
    size_t ideal_packets = guac_mem_ckd_sub_or_die(
                guac_mem_ckd_add_or_die(ideal_size, audio_buffer->packet_size), 1
            ) / audio_buffer->packet_size;

    /* Allocate new buffer */
    audio_buffer->packet_buffer_size = guac_mem_ckd_mul_or_die(ideal_packets, audio_buffer->packet_size);
    audio_buffer->packet = guac_mem_alloc(audio_buffer->packet_buffer_size);

    guac_client_log(audio_buffer->client, GUAC_LOG_DEBUG, "Output buffer for "
            "audio input is %i bytes (up to %i ms).", audio_buffer->packet_buffer_size,
            guac_rdp_audio_buffer_duration(&audio_buffer->out_format, audio_buffer->packet_buffer_size));

    /* Next flush can occur as soon as data is received */
    clock_gettime(CLOCK_REALTIME, &audio_buffer->next_flush);

    /* Acknowledge stream creation (if stream is ready to receive) */
    if (audio_buffer->user != NULL) {
        guac_rdp_audio_buffer_ack_params ack_params = { audio_buffer, "OK", GUAC_PROTOCOL_STATUS_SUCCESS };
        guac_client_for_user(audio_buffer->client, audio_buffer->user, guac_rdp_audio_buffer_ack, &ack_params);
    }

    pthread_cond_broadcast(&(audio_buffer->modified));
    pthread_mutex_unlock(&(audio_buffer->lock));

}

/**
 * Reads a single sample from the given buffer of data, using the input
 * format defined within the given audio buffer. Each read sample is
 * translated to a signed 16-bit value, even if the input format is 8-bit.
 * The offset into the given buffer will be determined according to the
 * input and output formats, the number of bytes sent thus far, and the
 * number of bytes received (excluding the contents of the buffer).
 *
 * IMPORTANT: The guac_rdp_audio_buffer's lock MUST already be held when
 * invoking this function.
 *
 * @param audio_buffer
 *     The audio buffer dictating the format of the given data buffer, as
 *     well as the offset from which the sample should be read.
 *
 * @param buffer
 *     The buffer of raw PCM audio data from which the sample should be read.
 *     This buffer MUST NOT contain data already taken into account by the
 *     audio buffer's total_bytes_received counter.
 *
 * @param length
 *     The number of bytes within the given buffer of PCM data.
 *
 * @param sample
 *     A pointer to the int16_t in which the read sample should be stored. If
 *     the input format is 8-bit, the sample will be shifted left by 8 bits
 *     to produce a 16-bit sample.
 *
 * @return
 *     Non-zero if a sample was successfully read, zero if no data remains
 *     within the given buffer that has not already been mapped to an
 *     output sample.
 */
static int guac_rdp_audio_buffer_read_sample(
        guac_rdp_audio_buffer* audio_buffer, const char* buffer, int length,
        int16_t* sample) {

    int in_bps = audio_buffer->in_format.bps;
    int in_rate = audio_buffer->in_format.rate;
    int in_channels = audio_buffer->in_format.channels;

    int out_bps = audio_buffer->out_format.bps;
    int out_rate = audio_buffer->out_format.rate;
    int out_channels = audio_buffer->out_format.channels;

    /* Calculate position within audio output */
    int current_sample  = audio_buffer->total_bytes_sent / out_bps;
    int current_frame   = current_sample / out_channels;
    int current_channel = current_sample % out_channels;

    /* Map output channel to input channel */
    if (current_channel >= in_channels)
        current_channel = in_channels - 1;

    /* Transform output position to input position */
    current_frame = (int) current_frame * ((double) in_rate / out_rate);
    current_sample = current_frame * in_channels + current_channel;

    /* Calculate offset within given buffer from absolute input position */
    int offset = current_sample * in_bps
               - audio_buffer->total_bytes_received;

    /* It should be impossible for the offset to ever go negative */
    assert(offset >= 0);

    /* Apply offset to buffer */
    buffer += offset;
    length -= offset;

    /* Read only if sufficient data is present in the given buffer */
    if (length < in_bps)
        return 0;

    /* Simply read sample directly if input is 16-bit */
    if (in_bps == 2) {
        *sample = *((int16_t*) buffer);
        return 1;
    }

    /* Translate to 16-bit if input is 8-bit */
    if (in_bps == 1) {
        *sample = *buffer << 8;
        return 1;
    }

    /* Accepted audio formats are required to be 8- or 16-bit */
    return 0;

}

void guac_rdp_audio_buffer_write(guac_rdp_audio_buffer* audio_buffer,
        char* buffer, int length) {

    int16_t sample;

    pthread_mutex_lock(&(audio_buffer->lock));

    guac_client_log(audio_buffer->client, GUAC_LOG_TRACE, "Received %i bytes (%i ms) of audio data",
            length, guac_rdp_audio_buffer_duration(&audio_buffer->in_format, length));

    /* Ignore packet if there is no buffer */
    if (audio_buffer->packet_buffer_size == 0 || audio_buffer->packet == NULL) {
        guac_client_log(audio_buffer->client, GUAC_LOG_DEBUG, "Dropped %i "
                "bytes of received audio data (buffer full or closed).", length);
        pthread_mutex_unlock(&(audio_buffer->lock));
        return;
    }

    /* Truncate received samples if exceeding size of buffer */
    int available = audio_buffer->packet_buffer_size - audio_buffer->bytes_written;
    if (length > available) {
        guac_client_log(audio_buffer->client, GUAC_LOG_DEBUG, "Truncating %i "
                "bytes of received audio data to %i bytes (insufficient space "
                "in buffer).", length, available);
        length = available;
    }

    int out_bps = audio_buffer->out_format.bps;

    /* Continuously write packets until no data remains */
    while (guac_rdp_audio_buffer_read_sample(audio_buffer,
                buffer, length, &sample) > 0) {

        char* current = audio_buffer->packet + audio_buffer->bytes_written;

        /* Store as 16-bit or 8-bit, depending on output format */
        if (out_bps == 2)
            *((int16_t*) current) = sample;
        else if (out_bps == 1)
            *current = sample >> 8;

        /* Accepted audio formats are required to be 8- or 16-bit */
        else
            assert(0);

        /* Update byte counters */
        audio_buffer->bytes_written += out_bps;
        audio_buffer->total_bytes_sent += out_bps;

    } /* end packet write loop */

    /* Track current position in audio stream */
    audio_buffer->total_bytes_received += length;

    pthread_cond_broadcast(&(audio_buffer->modified));
    pthread_mutex_unlock(&(audio_buffer->lock));

}

void guac_rdp_audio_buffer_end(guac_rdp_audio_buffer* audio_buffer) {

    pthread_mutex_lock(&(audio_buffer->lock));

    /* Ignore if stream is already closed */
    if (audio_buffer->stream == NULL) {
        pthread_mutex_unlock(&(audio_buffer->lock));
        return;
    }

    /* The stream is now closed */
    if (audio_buffer->user != NULL) {
        guac_rdp_audio_buffer_ack_params ack_params = { audio_buffer, "CLOSED", GUAC_PROTOCOL_STATUS_RESOURCE_CLOSED };
        guac_client_for_user(audio_buffer->client, audio_buffer->user, guac_rdp_audio_buffer_ack, &ack_params);
    }

    /* Unset user and stream */
    audio_buffer->user = NULL;
    audio_buffer->stream = NULL;

    /* Reset buffer state */
    audio_buffer->bytes_written = 0;
    audio_buffer->packet_size = 0;
    audio_buffer->packet_buffer_size = 0;
    audio_buffer->flush_handler = NULL;

    /* Reset I/O counters */
    audio_buffer->total_bytes_sent = 0;
    audio_buffer->total_bytes_received = 0;

    /* Free packet (if any) */
    guac_mem_free(audio_buffer->packet);

    pthread_cond_broadcast(&(audio_buffer->modified));
    pthread_mutex_unlock(&(audio_buffer->lock));

}

void guac_rdp_audio_buffer_free(guac_rdp_audio_buffer* audio_buffer) {

    guac_rdp_audio_buffer_end(audio_buffer);

    /* Signal termination of flush thread */
    pthread_mutex_lock(&(audio_buffer->lock));
    audio_buffer->stopping = 1;
    pthread_cond_broadcast(&(audio_buffer->modified));
    pthread_mutex_unlock(&(audio_buffer->lock));

    /* Clean up flush thread */
    pthread_join(audio_buffer->flush_thread, NULL);

    pthread_mutex_destroy(&(audio_buffer->lock));
    pthread_cond_destroy(&(audio_buffer->modified));
    guac_mem_free(audio_buffer);

}

