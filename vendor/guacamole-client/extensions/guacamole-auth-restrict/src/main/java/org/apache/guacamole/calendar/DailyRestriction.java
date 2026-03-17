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

package org.apache.guacamole.calendar;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Collections;
import java.util.List;

/**
 * A class that stores a daily time restriction that can be used to determine
 * whether or not a user can log in on a certain day of the week and during
 * a certain time window.
 */
public class DailyRestriction {
    
    /**
     * The days of the week that this restriction applies to.
     */
    private final List<DayOfWeek> weekDays;
    
    /**
     * The time that the restriction starts.
     */
    private final LocalTime startTime;
    
    /**
     * The time that the restriction ends.
     */
    private final LocalTime endTime;
    
    /**
     * Create a new daily restriction with the specified day of the week, start
     * time, and end time.
     * 
     * @param weekDay
     *     The day of the week that this restriction should apply to.
     * 
     * @param startTime
     *     The start time of the restriction.
     * 
     * @param endTime 
     *     The end time of the restriction.
     */
    public DailyRestriction(DayOfWeek weekDay,
            LocalTime startTime, LocalTime endTime) {
        this.weekDays = Collections.singletonList(weekDay);
        this.startTime = startTime;
        this.endTime = endTime;
    }
    
    /**
     * Create a new daily restriction with the specified days of the week, start
     * time, and end time.
     * 
     * @param weekDays
     *     The days of the week that this restriction should apply to.
     * 
     * @param startTime
     *     The start time of the restriction.
     * 
     * @param endTime 
     *     The end time of the restriction.
     */
    public DailyRestriction(List<DayOfWeek> weekDays,
            LocalTime startTime, LocalTime endTime) {
        this.weekDays = weekDays;
        this.startTime = startTime;
        this.endTime = endTime;
    }
    
    /**
     * Create a new daily restriction for an entire day, settings the start
     * time at midnight and the end time at the end of the day (235959).
     * 
     * @param weekDay
     *     The day of the week that this restriction should apply to.
     */
    public DailyRestriction(DayOfWeek weekDay) {
        this.weekDays = Collections.singletonList(weekDay);
        this.startTime = LocalTime.of(0, 0, 0);
        this.endTime = LocalTime.of(23, 59, 59);
    }
    
    /**
     * Create a new daily restriction for entire days, settings the start
     * time at midnight and the end time at the end of the day (235959).
     * 
     * @param weekDays
     *     The days of the week that this restriction should apply to.
     */
    public DailyRestriction(List<DayOfWeek> weekDays) {
        this.weekDays = weekDays;
        this.startTime = LocalTime.of(0, 0, 0);
        this.endTime = LocalTime.of(23, 59, 59);
    }
    
    /**
     * Returns true if this restriction applies now, otherwise false.
     * 
     * @return 
     *     true if the current time of day falls within this restriction,
     *     otherwise false.
     */
    public boolean appliesNow() {
        DayOfWeek currentDay = LocalDate.now(ZoneId.of("UTC")).getDayOfWeek();
        LocalTime currentTime = LocalTime.now(ZoneId.of("UTC"));
        
        // If end time is less than the start time, we check the remainder of this
        // day and the beginning of the next day.
        if (endTime.isBefore(startTime)) {
            if (weekDays.contains(currentDay) && currentTime.isAfter(startTime) && currentTime.isBefore(LocalTime.MAX))
                return true;
            return (weekDays.contains(currentDay.plus(1)) && currentTime.isAfter(LocalTime.MIDNIGHT) && currentTime.isBefore(endTime));
        }
        
        // Check that we are in the specified time restriction
        return (weekDays.contains(currentDay) && currentTime.isAfter(startTime) && currentTime.isBefore(endTime));
    }
    
}
