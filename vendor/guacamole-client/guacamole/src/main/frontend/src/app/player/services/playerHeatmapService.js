/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * 'License'); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { curveCatmullRom } from 'd3-shape';
import { path } from 'd3-path';

/**
 * A service for generating heat maps of activity levels per time interval,
 * for session recording playback.
 */
angular.module('player').factory('playerHeatmapService', [() => {

    /**
     * A default, relatively-gentle Gaussian smoothing kernel. This kernel
     * should help heatmaps look a bit less jagged, while not reducing fidelity
     * very much.
     *
     * @type {!number[]}
     */
    const GAUSSIAN_KERNEL = [0.0013, 0.1573, 0.6827, 0.1573, 0.0013];

    /**
     * The number of buckets that a series of activity timestamps should be
     * divided into.
     *
     * @type {!number}
     */
    const NUM_BUCKETS = 100;

    /**
     * Given a list of values to smooth out, produce a smoothed data set with
     * the same length as the original provided list.
     *
     * @param {!number[]} values
     *     The list of histogram values to smooth out.
     *
     * @returns {!number[]}
     *     The smoothed value array.
     */
    function smooth(values) {

        // The starting offset into the values array for each calculation
        const lookBack = Math.floor(GAUSSIAN_KERNEL.length / 2);

        // Apply the smoothing kernel to each value in the provided array
        return _.map(values, (value, index) => {

            // Total up the weighted values for each position in the kernel
            return _.reduce(GAUSSIAN_KERNEL, (total, weight, kernelIndex) => {

                // The offset into the original values array for the kernel
                const valuesOffset = kernelIndex - lookBack;

                // The position inside the original values array to be included
                const valuesIndex = index + valuesOffset;

                // If the contribution to the final smoothed value would be outside
                // the bounds of the array, just use the original value instead
                const contribution = ((valuesIndex >= 0) && valuesIndex < values.length)
                        ? values[valuesIndex] : value;

                // Use the provided weight from the kernel and add to the total
                return total + (contribution * weight);

            }, 0);

        });
    }

    /**
     * Given an array of values, with each value representing an activity count
     * during a bucket of time, generate a smooth curve, scaled to PATH_HEIGHT
     * height, and PATH_WIDTH width.
     *
     * @param {!number[]} bucketizedData
     *     The bucketized counts to create an SVG path from.
     *
     * @param {!number} maxBucketValue
     *     The size of the largest value in the bucketized data.
     *
     * @param {!number} height
     *     The target height, in pixels, of the highest point in the heatmap.
     *
     * @param {!number} width
     *     The target width, in pixels, of the heatmap.
     *
     * @returns {!string}
     *     An SVG path representing a smooth curve, passing through all points
     *     in the provided data.
     */
    function createPath(bucketizedData, maxBucketValue, height, width) {

        // Calculate scaling factor to ensure that paths are all the same heigh
        const yScalingFactor = height / maxBucketValue;

        // Scale a given Y value appropriately
        const scaleYValue = yValue => height - (yValue * yScalingFactor);

        // Calculate scaling factor to ensure that paths are all the same width
        const xScalingFactor = width / bucketizedData.length;

        // Construct a continuous curved path
        const curvedPath = path();
        const curve = curveCatmullRom(curvedPath);

        curve.lineStart();

        // Add all the data points
        for (let i = 0; i < bucketizedData.length; i++) {

            // Scale up the x value to hit the target width
            const x = xScalingFactor * i;

            // Scale and invert the height for display
            const y = scaleYValue(bucketizedData[i]);

            // Add the scaled point
            curve.point(x, y);

        }

        // Move back to 0 to complete the path
        curve.lineEnd();
        curvedPath.lineTo(width, scaleYValue(0));

        // Generate the SVG path for this curve
        const rawPathText = curvedPath.toString();

        // The SVG path as generated by D3 starts with a move to the first data
        // point. This means that when the path ends and the subpath is closed,
        // it returns to the position of the first data point instead of the
        // origin. To fix this, the initial move command is removed, and the
        // path is amended to start at the origin. TODO: Find a better way to
        // handle this.
        const startAtOrigin = (

            // Start at origin
            'M0,' + scaleYValue(0) +

            // Line to the first point in the curve, to close the shape
            'L0,' + scaleYValue(bucketizedData[0])

        );

        // Strip off the first move command from the path
        const strippedPathText = _.replace(rawPathText, /^[^C]*/, '');

        return startAtOrigin + strippedPathText;
    }

    const service = {};

    /**
     * Given a raw array of timestamps indicating when events of a certain type
     * occured during a record, generate and return a smoothed SVG path
     * indicating how many events occured during each equal-length bucket.
     *
     * @param {!number[]} timestamps
     *     A raw array of timestamps, one for every relevant event. These
     *     must be monotonically increasing.
     *
     * @param {!number} duration
     *     The duration over which the heatmap should apply. This value may
     *     be greater than the maximum timestamp value, in which case the path
     *     will drop to 0 after the last timestamp in the provided array.
     *
     * @param {number} maxRate
     *     The maximum number of events per millisecond that should be displayed
     *     in the final path. Any rates over this amount will just be capped at
     *     this value.
     *
     * @param {!number} height
     *     The target height, in pixels, of the highest point in the heatmap.
     *
     * @param {!number} width
     *     The target width, in pixels, of the heatmap.
     *
     * @returns {!string}
     *     A smoothed, graphable SVG path representing levels of activity over
     *     time, as extracted from the provided timestamps.
     */
    service.generateHeatmapPath = (timestamps, duration, maxRate, height, width) => {

        // The height and width must both be valid in order to create the path
        if (!height || !width) {
            console.warn("Heatmap height and width must be positive.");
            return '';
        }

        // If no timestamps are available, no path can be created
        if (!timestamps || !timestamps.length)
            return '';

        // An initially empty array containing no activity in any bucket
        const buckets = new Array(NUM_BUCKETS).fill(0);

        // If no events occured, return the an empty path
        if (!timestamps.length)
            return '';

        // Determine the bucket granularity
        const bucketDuration = duration / NUM_BUCKETS;

        // The rate-limited maximum number of events that any bucket can have,
        const maxPossibleBucketValue = Math.floor(bucketDuration * maxRate);

        // If the duration is invalid, return the still-empty array
        if (duration <= 0)
            return '';

        let maxBucketValue = 0;

        // Partition the events into a count of events per bucket
        let currentBucketIndex = 0;
        timestamps.forEach(timestamp => {

            // If the current timestamp has passed the end of the current
            // bucket, move to the appropriate bucket
            if (timestamp >= (currentBucketIndex + 1) * bucketDuration)
                currentBucketIndex = Math.min(
                    Math.floor((timestamp / bucketDuration)), NUM_BUCKETS - 1);

            // Do not record events that exceed the maximum allowable rate
            if (buckets[currentBucketIndex] >= maxPossibleBucketValue)
                buckets[currentBucketIndex] = maxPossibleBucketValue;

            else
                // Increment the count for the current bucket
                buckets[currentBucketIndex]++;

            // Keep track of the maximum value seen so far
            maxBucketValue = Math.max(
                maxBucketValue, buckets[currentBucketIndex]);

        });

        // Smooth the data for better aesthetics before creating the path
        const smoothed = smooth(buckets);

        // Create an SVG path based on the smoothed data
        return createPath(smoothed, maxBucketValue, height, width);

    }


    return service;

}]);
