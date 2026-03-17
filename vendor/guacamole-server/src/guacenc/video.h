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

#ifndef GUACENC_VIDEO_H
#define GUACENC_VIDEO_H

#include "config.h"
#include "buffer.h"

#include <guacamole/timestamp.h>
#include <libavcodec/avcodec.h>

#ifndef AVCODEC_AVCODEC_H
#include <libavcodec/avcodec.h>
#endif

#ifndef AVFORMAT_AVFORMAT_H
#include <libavformat/avformat.h>
#endif

#include <stdint.h>
#include <stdio.h>

/**
 * The framerate at which video should be encoded, in frames per second.
 */
#define GUACENC_VIDEO_FRAMERATE 25

/**
 * A video which is actively being encoded. Frames can be added to the video
 * as they are generated, along with their associated timestamps, and the
 * corresponding video will be continuously written as it is encoded.
 */
typedef struct guacenc_video {

    /**
     * AVStream for video output.
     * Frames sent to this stream are written into
     * the output file in the specified container format.
     */
    AVStream* output_stream;

    /**
     * The open encoding context from libavcodec, created for the codec
     * specified when this guacenc_video was created.
     */
    AVCodecContext* context;

    /**
     * The open format context from libavformat, created for the file
     * container specified when this guacenc_video was created.
     */
    AVFormatContext* container_format_context;

    /**
     * The width of the video, in pixels.
     */
    int width;

    /**
     * The height of the video, in pixels.
     */
    int height;

    /**
     * The desired output bitrate of the video, in bits per second.
     */
    int bitrate;

    /**
     * An image data area containing the next frame to be written, encoded as
     * YCbCr image data in the format required by avcodec_encode_video2(), for
     * use and re-use as frames are rendered.
     */
    AVFrame* next_frame;

    /**
     * The presentation timestamp that should be used for the next frame. This
     * is equivalent to the frame number.
     */
    int64_t next_pts;

    /**
     * The timestamp associated with the last frame, or 0 if no frames have yet
     * been added.
     */
    guac_timestamp last_timestamp;

} guacenc_video;

/**
 * Allocates a new guacenc_video which encodes video according to the given
 * specifications, saving the output in the given file. If the output file
 * already exists, encoding will be aborted, and the original file contents
 * will be preserved. Frames will be scaled up or down as necessary to fit the
 * given width and height.
 *
 * @param path
 *     The full path to the file in which encoded video should be written.
 *
 * @param codec_name
 *     The name of the codec to use for the video encoding, as defined by
 *     ffmpeg / libavcodec.
 *
 * @param width
 *     The width of the desired video, in pixels.
 *
 * @param height
 *     The height of the desired video, in pixels.
 *
 * @param bitrate
 *     The desired overall bitrate of the resulting encoded video, in bits per
 *     second.
 */
guacenc_video* guacenc_video_alloc(const char* path, const char* codec_name,
        int width, int height, int bitrate);

/**
 * Advances the timeline of the encoding process to the given timestamp, such
 * that frames added via guacenc_video_prepare_frame() will be encoded at the
 * proper frame boundaries within the video. Duplicate frames will be encoded
 * as necessary to ensure that the output is correctly timed with respect to
 * the given timestamp. This is particularly important as Guacamole does not
 * have a framerate per se, and the time between each Guacamole "frame" will
 * vary significantly.
 *
 * This function MUST be called prior to invoking guacenc_video_prepare_frame()
 * to ensure the prepared frame will be encoded at the correct point in time.
 *
 * @param video
 *     The video whose timeline should be adjusted.
 *
 * @param timestamp
 *     The Guacamole timestamp denoting the point in time that the video
 *     timeline should be advanced to, as dictated by a parsed "sync"
 *     instruction.
 *
 * @return
 *     Zero if the timeline was adjusted successfully, non-zero if an error
 *     occurs (such as during the encoding of duplicate frames).
 */
int guacenc_video_advance_timeline(guacenc_video* video,
        guac_timestamp timestamp);

/**
 * Stores the given buffer within the given video structure such that it will
 * be written if it falls within proper frame boundaries. If the timeline of
 * the video (as dictated by guacenc_video_advance_timeline()) is not at a
 * frame boundary with respect to the video framerate (it occurs between frame
 * boundaries), the prepared frame will only be written if another frame is not
 * prepared within the same pair of frame boundaries). The prepared frame will
 * not be written until it is implicitly flushed through updates to the video
 * timeline or through reaching the end of the encoding process
 * (guacenc_video_free()).
 *
 * @param video
 *     The video in which the given buffer should be queued for possible
 *     writing (depending on timing vs. video framerate).
 *
 * @param buffer
 *     The guacenc_buffer representing the image data of the frame that should
 *     be queued.
 */
void guacenc_video_prepare_frame(guacenc_video* video, guacenc_buffer* buffer);

/**
 * Frees all resources associated with the given video, finalizing the encoding
 * process. Any buffered frames which have not yet been written will be written
 * at this point.
 *
 * @return
 *     Zero if the video was successfully written and freed, non-zero if the
 *     video could not be written due to an error.
 */
int guacenc_video_free(guacenc_video* video);

#endif

