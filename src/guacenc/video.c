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
#include "buffer.h"
#include "ffmpeg-compat.h"
#include "log.h"
#include "video.h"

#include <cairo/cairo.h>
#include <libavcodec/avcodec.h>
#ifndef AVFORMAT_AVFORMAT_H
#include <libavformat/avformat.h>
#endif
#include <libavutil/common.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/timestamp.h>

#include <sys/types.h>
#include <sys/stat.h>
#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

guacenc_video* guacenc_video_alloc(const char* path, const char* codec_name,
        int width, int height, int bitrate) {

    const AVOutputFormat *container_format;
    AVFormatContext *container_format_context;
    AVStream *video_stream;
    int ret;
    int failed_header = 0;

    /* allocate the output media context */
    avformat_alloc_output_context2(&container_format_context, NULL, NULL, path);
    if (container_format_context == NULL) {
        guacenc_log(GUAC_LOG_ERROR, "Failed to determine container from output file name");
        goto fail_codec;
    }

    container_format = container_format_context->oformat;

    /* Pull codec based on name */
    const AVCodec* codec = avcodec_find_encoder_by_name(codec_name);
    if (codec == NULL) {
        guacenc_log(GUAC_LOG_ERROR, "Failed to locate codec \"%s\".",
                codec_name);
        goto fail_codec;
    }

    /* create stream */
    video_stream = NULL;
    video_stream = avformat_new_stream(container_format_context, codec);
    if (video_stream == NULL) {
        guacenc_log(GUAC_LOG_ERROR, "Could not allocate encoder stream. Cannot continue.");
        goto fail_format_context;
    }
    video_stream->id = container_format_context->nb_streams - 1;

    /* Retrieve encoding context */
    AVCodecContext* avcodec_context =
            guacenc_build_avcodeccontext(video_stream, codec, bitrate, width,
                    height, /*gop size*/ 10, /*qmax*/ 31, /*qmin*/ 2,
                    /*pix fmt*/ AV_PIX_FMT_YUV420P,
                    /*time base*/ (AVRational) { 1, GUACENC_VIDEO_FRAMERATE });

    if (avcodec_context == NULL) {
        guacenc_log(GUAC_LOG_ERROR, "Failed to allocate context for "
                "codec \"%s\".", codec_name);
        goto fail_context;
    }

    /* If format needs global headers, write them */
    if (container_format_context->oformat->flags & AVFMT_GLOBALHEADER) {
        avcodec_context->flags |= GUACENC_FLAG_GLOBAL_HEADER;
    }

    /* Open codec for use */
    if (guacenc_open_avcodec(avcodec_context, codec, NULL, video_stream) < 0) {
        guacenc_log(GUAC_LOG_ERROR, "Failed to open codec \"%s\".", codec_name);
        goto fail_codec_open;
    }

    /* Allocate corresponding frame */
    AVFrame* frame = av_frame_alloc();
    if (frame == NULL) {
        goto fail_frame;
    }

    /* Copy necessary data for frame from context */
    frame->format = avcodec_context->pix_fmt;
    frame->width = avcodec_context->width;
    frame->height = avcodec_context->height;

    /* Allocate actual backing data for frame */
    if (av_image_alloc(frame->data, frame->linesize, frame->width,
                frame->height, frame->format, 32) < 0) {
        goto fail_frame_data;
    }

    /* Open output file, if the container needs it */
    if (!(container_format->flags & AVFMT_NOFILE)) {
        ret = avio_open(&container_format_context->pb, path, AVIO_FLAG_WRITE);
        if (ret < 0) {
            guacenc_log(GUAC_LOG_ERROR, "Error occurred while opening output file.");
            goto fail_output_avio;
        }
    }

    /* write the stream header, if needed */
    ret = avformat_write_header(container_format_context, NULL);
    if (ret < 0) {
        guacenc_log(GUAC_LOG_ERROR, "Error occurred while writing output file header.");
        failed_header = true;
        goto fail_output_file;
    }

    /* Allocate video structure */
    guacenc_video* video = guac_mem_alloc(sizeof(guacenc_video));
    if (video == NULL)
        goto fail_alloc_video;

    /* Init properties of video */
    video->output_stream = video_stream;
    video->context = avcodec_context;
    video->container_format_context = container_format_context;
    video->next_frame = frame;
    video->width = width;
    video->height = height;
    video->bitrate = bitrate;

    /* No frames have been written or prepared yet */
    video->last_timestamp = 0;
    video->next_pts = 0;

    return video;

    /* Free all allocated data in case of failure */
fail_alloc_video:
fail_output_file:
    avio_close(container_format_context->pb);

    /* Delete the file that was created if it was actually created */
    if (unlink(path) == -1 && errno != ENOENT)
        guacenc_log(GUAC_LOG_WARNING, "Failed output file \"%s\" could not "
                "be automatically deleted: %s", path, strerror(errno));

fail_output_avio:
    av_freep(&frame->data[0]);

fail_frame_data:
    av_frame_free(&frame);

fail_frame:
fail_codec_open:
    avcodec_free_context(&avcodec_context);

fail_format_context:
    /* failing to write the container implicitly frees the context */
    if (!failed_header) {
        avformat_free_context(container_format_context);
    }

fail_context:
fail_codec:
    return NULL;

}

/**
 * Flushes the specified frame as a new frame of video, updating the internal
 * video timestamp by one frame's worth of time. The pts member of the given
 * frame structure will be updated with the current presentation timestamp of
 * the video. If pending frames of the video are being flushed, the given frame
 * may be NULL (as required by avcodec_encode_video2()).
 *
 * @param video
 *     The video to write the given frame to.
 *
 * @param frame
 *     The frame to write to the video, or NULL if previously-written frames
 *     are being flushed.
 *
 * @return
 *     A positive value if the frame was successfully written, zero if the
 *     frame has been saved for later writing / reordering, negative if an
 *     error occurs.
 */
static int guacenc_video_write_frame(guacenc_video* video, AVFrame* frame) {

    /* Set timestamp of frame, if frame given */
    if (frame != NULL)
        frame->pts = video->next_pts;

    /* Write frame to video */
    int got_data = guacenc_avcodec_encode_video(video, frame);
    if (got_data < 0)
        return -1;

    /* Update presentation timestamp for next frame */
    video->next_pts++;

    /* Write was successful */
    return got_data;

}

/**
 * Flushes the frame previously specified by guacenc_video_prepare_frame() as a
 * new frame of video, updating the internal video timestamp by one frame's
 * worth of time.
 *
 * @param video
 *     The video to flush.
 *
 * @return
 *     Zero if flushing was successful, non-zero if an error occurs.
 */
static int guacenc_video_flush_frame(guacenc_video* video) {

    /* Write frame to video */
    return guacenc_video_write_frame(video, video->next_frame) < 0;

}

int guacenc_video_advance_timeline(guacenc_video* video,
        guac_timestamp timestamp) {

    guac_timestamp next_timestamp = timestamp;

    /* Flush frames as necessary if previously updated */
    if (video->last_timestamp != 0) {

        /* Calculate the number of frames that should have been written */
        int elapsed = (timestamp - video->last_timestamp)
                    * GUACENC_VIDEO_FRAMERATE / 1000;

        /* Keep previous timestamp if insufficient time has elapsed */
        if (elapsed == 0)
            return 0;

        /* Use frame time as last_timestamp */
        next_timestamp = video->last_timestamp
                        + elapsed * 1000 / GUACENC_VIDEO_FRAMERATE;

        /* Flush frames to bring timeline in sync, duplicating if necessary */
        do {
            if (guacenc_video_flush_frame(video)) {
                guacenc_log(GUAC_LOG_ERROR, "Unable to flush frame to video "
                        "stream.");
                return 1;
            }
        } while (--elapsed != 0);

    }

    /* Update timestamp */
    video->last_timestamp = next_timestamp;
    return 0;

}

/**
 * Converts the given Guacamole video encoder buffer to a frame in the format
 * required by libavcodec / libswscale. Black margins of the specified sizes
 * will be added. No scaling is performed; the image data is copied verbatim.
 *
 * @param buffer
 *     The guacenc_buffer to copy as a new AVFrame.
 *
 * @param lsize
 *     The size of the letterboxes to add, in pixels. Letterboxes are the
 *     horizontal black boxes added to images which are scaled down to fit the
 *     destination because they are too wide (the width is scaled to exactly
 *     fit the destination, resulting in extra space at the top and bottom).
 *
 * @param psize
 *     The size of the pillarboxes to add, in pixels. Pillarboxes are the
 *     vertical black boxes added to images which are scaled down to fit the
 *     destination because they are too tall (the height is scaled to exactly
 *     fit the destination, resulting in extra space on the sides).
 *
 * @return
 *     A pointer to a newly-allocated AVFrame containing exactly the same image
 *     data as the given buffer. The image data within the frame and the frame
 *     itself must be manually freed later.
 */
static AVFrame* guacenc_video_frame_convert(guacenc_buffer* buffer, int lsize,
        int psize) {

    /* Init size of left/right pillarboxes */
    int left = psize;
    int right = psize;

    /* Init size of top/bottom letterboxes */
    int top = lsize;
    int bottom = lsize;

    /* Prepare source frame for buffer */
    AVFrame* frame = av_frame_alloc();
    if (frame == NULL)
        return NULL;

    /* Copy buffer properties to frame */
    frame->format = AV_PIX_FMT_RGB32;
    frame->width = buffer->width + left + right;
    frame->height = buffer->height + top + bottom;

    /* Allocate actual backing data for frame */
    if (av_image_alloc(frame->data, frame->linesize, frame->width,
                frame->height, frame->format, 32) < 0) {
        av_frame_free(&frame);
        return NULL;
    }

    /* Flush any pending operations */
    cairo_surface_flush(buffer->surface);

    /* Get pointer to source image data */
    unsigned char* src_data = buffer->image;
    int src_stride = buffer->stride;

    /* Get pointer to destination image data */
    unsigned char* dst_data = frame->data[0];
    int dst_stride = frame->linesize[0];

    /* Get source/destination dimensions */
    int width = buffer->width;
    int height = buffer->height;

    /* Source buffer is guaranteed to fit within destination buffer */
    assert(width <= frame->width);
    assert(height <= frame->height);

    /* Add top margin */
    while (top > 0) {
        memset(dst_data, 0, frame->width * 4);
        dst_data += dst_stride;
        top--;
    }

    /* Copy all data from source buffer to destination frame */
    while (height > 0) {

        /* Calculate size of margin and data regions */
        int left_size = left * 4;
        int data_size = width * 4;
        int right_size = right * 4;

        /* Add left margin */
        memset(dst_data, 0, left_size);

        /* Copy data */
        memcpy(dst_data + left_size, src_data, data_size);

        /* Add right margin */
        memset(dst_data + left_size + data_size, 0, right_size);

        dst_data += dst_stride;
        src_data += src_stride;

        height--;

    }

    /* Add bottom margin */
    while (bottom > 0) {
        memset(dst_data, 0, frame->width * 4);
        dst_data += dst_stride;
        bottom--;
    }

    /* Frame converted */
    return frame;

}

void guacenc_video_prepare_frame(guacenc_video* video, guacenc_buffer* buffer) {

    int lsize;
    int psize;

    /* Ignore NULL buffers */
    if (buffer == NULL || buffer->surface == NULL)
        return;

    /* Obtain destination frame */
    AVFrame* dst = video->next_frame;

    /* Determine width of image if height is scaled to match destination */
    int scaled_width = buffer->width * dst->height / buffer->height;

    /* Determine height of image if width is scaled to match destination */
    int scaled_height = buffer->height * dst->width / buffer->width;

    /* If height-based scaling results in a fit width, add pillarboxes */
    if (scaled_width <= dst->width) {
        lsize = 0;
        psize = (dst->width - scaled_width)
               * buffer->height / dst->height / 2;
    }

    /* If width-based scaling results in a fit width, add letterboxes */
    else {
        assert(scaled_height <= dst->height);
        psize = 0;
        lsize = (dst->height - scaled_height)
               * buffer->width / dst->width / 2;
    }

    /* Prepare source frame for buffer */
    AVFrame* src = guacenc_video_frame_convert(buffer, lsize, psize);
    if (src == NULL) {
        guacenc_log(GUAC_LOG_WARNING, "Failed to allocate source frame. "
                "Frame dropped.");
        return;
    }

    /* Prepare scaling context */
    struct SwsContext* sws = sws_getContext(src->width, src->height,
            AV_PIX_FMT_RGB32, dst->width, dst->height, AV_PIX_FMT_YUV420P,
            SWS_BICUBIC, NULL, NULL, NULL);

    /* Abort if scaling context could not be created */
    if (sws == NULL) {
        guacenc_log(GUAC_LOG_WARNING, "Failed to allocate software scaling "
                "context. Frame dropped.");
        av_freep(&src->data[0]);
        av_frame_free(&src);
        return;
    }

    /* Apply scaling, copying the source frame to the destination */
    sws_scale(sws, (const uint8_t* const*) src->data, src->linesize,
            0, src->height, dst->data, dst->linesize);

    /* Free scaling context */
    sws_freeContext(sws);

    /* Free source frame */
    av_freep(&src->data[0]);
    av_frame_free(&src);

}

int guacenc_video_free(guacenc_video* video) {

    /* Ignore NULL video */
    if (video == NULL)
        return 0;

    /* Write final frame */
    guacenc_video_flush_frame(video);

    /* Flush any unwritten frames */
    int retval;
    do {
        retval = guacenc_video_write_frame(video, NULL);
    } while (retval > 0);

    /* write trailer, if needed */
    if (video->container_format_context != NULL &&
            video->output_stream != NULL) {
        guacenc_log(GUAC_LOG_DEBUG, "Writing trailer: %s",
                av_write_trailer(video->container_format_context) == 0 ?
                        "success" : "failure");
    }

    /* File is now completely written */
    if (video->container_format_context != NULL) {
        avio_close(video->container_format_context->pb);
    }

    /* Free frame encoding data */
    av_freep(&video->next_frame->data[0]);
    av_frame_free(&video->next_frame);

    /* Clean up encoding context */
    if (video->context != NULL) {
#if LIBAVCODEC_VERSION_INT < AV_VERSION_INT(61, 3, 100)
        avcodec_close(video->context);
#endif
        avcodec_free_context(&(video->context));
    }

    guac_mem_free(video);
    return 0;

}

