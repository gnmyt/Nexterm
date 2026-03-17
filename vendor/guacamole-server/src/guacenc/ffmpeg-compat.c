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

#include "config.h"
#include "ffmpeg-compat.h"
#include "log.h"
#include "video.h"

#include <libavcodec/avcodec.h>
#include <libavutil/common.h>
#include <libavutil/imgutils.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>

#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>

/**
 * Writes a single packet of video data to the current output file. If an error
 * occurs preventing the packet from being written, messages describing the
 * error are logged.
 *
 * @param video
 *     The video associated with the output file that the given packet should
 *     be written to.
 *
 * @param data
 *     The buffer of data containing the video packet which should be written.
 *
 * @param size
 *     The number of bytes within the video packet.
 *
 * @return
 *     Zero if the packet was written successfully, non-zero otherwise.
 */
static int guacenc_write_packet(guacenc_video* video, void* data, int size) {

    int ret;

#if LIBAVCODEC_VERSION_INT < AV_VERSION_INT(54,1,0)

    AVPacket pkt;

    /* Have to create a packet around the encoded data we have */
    av_init_packet(&pkt);

    if (video->context->coded_frame->pts != AV_NOPTS_VALUE) {
        pkt.pts = av_rescale_q(video->context->coded_frame->pts,
                video->context->time_base,
                video->output_stream->time_base);
    }
    if (video->context->coded_frame->key_frame) {
        pkt->flags |= AV_PKT_FLAG_KEY;
    }

    pkt.data = data;
    pkt.size = size;
    pkt.stream_index = video->output_stream->index;
    ret = av_interleaved_write_frame(video->container_format_context, &pkt);

#else

    /* We know data is already a packet if we're using a newer libavcodec */
    AVPacket* pkt = (AVPacket*) data;
    av_packet_rescale_ts(pkt, video->context->time_base, video->output_stream->time_base);
    pkt->stream_index = video->output_stream->index;
    ret = av_interleaved_write_frame(video->container_format_context, pkt);

#endif

    if (ret != 0) {
        guacenc_log(GUAC_LOG_ERROR, "Unable to write frame "
                "#%" PRId64 ": %s", video->next_pts, strerror(errno));
        return -1;
    }

    /* Data was written successfully */
    guacenc_log(GUAC_LOG_DEBUG, "Frame #%08" PRId64 ": wrote %i bytes",
            video->next_pts, size);

    return ret;
}

int guacenc_avcodec_encode_video(guacenc_video* video, AVFrame* frame) {

/* For libavcodec < 54.1.0: packets were handled as raw malloc'd buffers */
#if LIBAVCODEC_VERSION_INT < AV_VERSION_INT(54,1,0)

    AVCodecContext* context = video->context;

    /* Calculate appropriate buffer size */
    size_t length = guac_mem_ckd_add_or_die(FF_MIN_BUFFER_SIZE,
            guac_mem_ckd_mul_or_die(12, context->width, context->height));

    /* Allocate space for output */
    uint8_t* data = guac_mem_alloc(length);
    if (data == NULL)
        return -1;

    /* Encode packet of video data */
    int used = avcodec_encode_video(context, data, length, frame);
    if (used < 0) {
        guacenc_log(GUAC_LOG_WARNING, "Error encoding frame #%" PRId64,
                video->next_pts);
        guac_mem_free(data);
        return -1;
    }

    /* Report if no data needs to be written */
    if (used == 0) {
        guac_mem_free(data);
        return 0;
    }

    /* Write data, logging any errors */
    guacenc_write_packet(video, data, used);
    guac_mem_free(data);
    return 1;

#else

/* For libavcodec < 57.37.100: input/output was not decoupled and static
 * allocation of AVPacket was supported.
 *
 * NOTE: Since dynamic allocation of AVPacket was added before this point (in
 * 57.12.100) and static allocation was deprecated later (in 58.133.100), it is
 * convenient to tie static vs. dynamic allocation to the old vs. new I/O
 * mechanism and avoid further complicating the version comparison logic. */
#if LIBAVCODEC_VERSION_INT < AV_VERSION_INT(57, 37, 100)

    /* Init video packet */
    AVPacket packet;
    av_init_packet(&packet);

    /* Request that encoder allocate data for packet */
    packet.data = NULL;
    packet.size = 0;

    /* Write frame to video */
    int got_data;
    if (avcodec_encode_video2(video->context, &packet, frame, &got_data) < 0) {
        guacenc_log(GUAC_LOG_WARNING, "Error encoding frame #%" PRId64,
                video->next_pts);
        return -1;
    }

    /* Write corresponding data to file */
    if (got_data) {
        guacenc_write_packet(video, (void*) &packet, packet.size);
        av_packet_unref(&packet);
    }

#else

    /* Write frame to video */
    int result = avcodec_send_frame(video->context, frame);

    /* Stop once encoded has been flushed */
    if (result == AVERROR_EOF)
        return 0;

    /* Abort on error */
    else if (result < 0) {
        guacenc_log(GUAC_LOG_WARNING, "Error encoding frame #%" PRId64,
                video->next_pts);
        return -1;
    }

    AVPacket* packet = av_packet_alloc();
    if (packet == NULL)
        return -1;

    /* Flush all available packets */
    int got_data = 0;
    while (avcodec_receive_packet(video->context, packet) == 0) {

        /* Data was received */
        got_data = 1;

        /* Attempt to write data to output file */
        guacenc_write_packet(video, (void*) packet, packet->size);
        av_packet_unref(packet);

    }

    av_packet_free(&packet);

#endif

    /* Frame may have been queued for later writing / reordering */
    if (!got_data)
        guacenc_log(GUAC_LOG_DEBUG, "Frame #%08" PRId64 ": queued for later",
                video->next_pts);

    return got_data;

#endif
}

AVCodecContext* guacenc_build_avcodeccontext(AVStream* stream, const AVCodec* codec,
        int bitrate, int width, int height, int gop_size, int qmax, int qmin,
        int pix_fmt, AVRational time_base) {

#if LIBAVFORMAT_VERSION_INT < AV_VERSION_INT(57, 33, 100)
    stream->codec->bit_rate = bitrate;
    stream->codec->width = width;
    stream->codec->height = height;
    stream->codec->gop_size = gop_size;
    stream->codec->qmax = qmax;
    stream->codec->qmin = qmin;
    stream->codec->pix_fmt = pix_fmt;
    stream->codec->time_base = time_base;
#if LIBAVFORMAT_VERSION_INT >= AV_VERSION_INT(55, 44, 100)
    stream->time_base = time_base;
#endif
    return stream->codec;
#else
    AVCodecContext* context = avcodec_alloc_context3(codec);
    if (context) {
        context->bit_rate = bitrate;
        context->width = width;
        context->height = height;
        context->gop_size = gop_size;
        context->qmax = qmax;
        context->qmin = qmin;
        context->pix_fmt = pix_fmt;
        context->time_base = time_base;
        stream->time_base = time_base;
    }
    return context;
#endif

}

int guacenc_open_avcodec(AVCodecContext *avcodec_context,
        const AVCodec *codec, AVDictionary **options,
        AVStream* stream) {

    int ret = avcodec_open2(avcodec_context, codec, options);

#if LIBAVFORMAT_VERSION_INT >= AV_VERSION_INT(57, 33, 100)
    /* Copy stream parameters to the muxer */
    int codecpar_ret = avcodec_parameters_from_context(stream->codecpar, avcodec_context);
    if (codecpar_ret < 0)
        return codecpar_ret;
#endif

    return ret;

}
