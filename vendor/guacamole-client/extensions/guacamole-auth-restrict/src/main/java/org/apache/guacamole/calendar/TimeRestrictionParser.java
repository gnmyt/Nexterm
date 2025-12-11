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
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A class for parsing time-based restrictions stored in a String into other
 * formats that can be used by Guacamole.
 */
public class TimeRestrictionParser {
    
    /**
     * The compiled regular expression that matches one or more instances of
     * a restriction string, which specifies at least one day and time range
     * that the restriction applies to.
     * 
     * <p>Examples of valid restrictions are as follows:
     * <ul>
     * <li>1:0700-1700 - Monday from 07:00 to 17:00
     * <li>7:0000-2359 - Sunday, all day (00:00 to 23:59)
     * <li>*:0900-1700 - Every day, 09:00 to 17:00
     * <li>6:0900-1600;7:1200-1300 - Saturday, 09:00 to 16:00, and Sunday, 
     * 12:00 - 13:00
     * </ul>
     */
    private static final Pattern RESTRICTION_REGEX = 
            Pattern.compile("(?:^|;)+([0-7*])(?::((?:[01][0-9]|2[0-3])[0-5][0-9])\\-((?:[01][0-9]|2[0-3])[0-5][0-9]))+");
    
    /**
     * The RegEx group that contains the start day-of-week of the restriction.
     */
    private static final int RESTRICTION_DAY_GROUP = 1;
    
    /**
     * The RegEx group that contains the start time of the restriction.
     */
    private static final int RESTRICTION_TIME_START_GROUP = 2;
    
    /**
     * The RegEx group that contains the end time of the restriction.
     */
    private static final int RESTRICTION_TIME_END_GROUP = 3;
    
    /**
     * A list of DayOfWeek items that make up all days of the week.
     */
    private static final List<DayOfWeek> RESTRICTION_ALL_DAYS = Arrays.asList(
            DayOfWeek.MONDAY,
            DayOfWeek.TUESDAY,
            DayOfWeek.WEDNESDAY,
            DayOfWeek.THURSDAY,
            DayOfWeek.FRIDAY,
            DayOfWeek.SATURDAY,
            DayOfWeek.SUNDAY
    );
    
    /**
     * Parse the provided string containing one or more restrictions into
     * a list of objects.
     * 
     * @param restrictionString
     *     The string that should contain one or more semicolon-separated
     *     restriction periods.
     * 
     * @return 
     *     A list of objects parsed from the string.
     */
    public static List<DailyRestriction> parseString(String restrictionString) {
        
        List<DailyRestriction> restrictions = new ArrayList<>();
        Matcher restrictionMatcher = RESTRICTION_REGEX.matcher(restrictionString);
        
        // Loop through RegEx matches
        while (restrictionMatcher.find()) {
            
            // Pull the day string, start time, and end time
            String dayString = restrictionMatcher.group(RESTRICTION_DAY_GROUP);
            String startTimeString = restrictionMatcher.group(RESTRICTION_TIME_START_GROUP);
            String endTimeString = restrictionMatcher.group(RESTRICTION_TIME_END_GROUP);
            LocalTime startTime, endTime;
            
            // We must always have a value for the day.
            if (dayString == null || dayString.isEmpty())
                continue;
                        
            // Convert the start and end time strings to LocalTime values.
            DateTimeFormatter hourFormat = DateTimeFormatter.ofPattern("HHmm");
            
            // If start time is empty, assume the start of the day.
            if (startTimeString == null || startTimeString.isEmpty())
                startTime = LocalTime.of(0, 0, 0);
            
            // Otherwise, parse out the start time.
            else
                startTime = LocalTime.parse(startTimeString, hourFormat);
            
            // If end time is empty, assume the end of the day.
            if (endTimeString == null || endTimeString.isEmpty())
                endTime = LocalTime.of(23, 59, 59);
            
            // Otherwise, parse out the end time.
            else
                endTime = LocalTime.parse(endTimeString, hourFormat);
            
            // Based on value of day string, add the appropriate entry.
            switch(dayString) {
                // All days of the week.
                case "*":
                    restrictions.add(new DailyRestriction(RESTRICTION_ALL_DAYS, startTime, endTime));
                    break;
                    
                // A specific day of the week.
                default:
                    int dayInt = Integer.parseInt(dayString);
                    
                    // While JavaScript sees Sunday as "0" and "7", DayOfWeek
                    // does not, so we'll convert it to "7" in order to process it.
                    if (dayInt == 0)
                        dayInt = 7;
                    
                    restrictions.add(new DailyRestriction(DayOfWeek.of(dayInt), startTime, endTime));
                    
            }
            
        }
        
        // Return the list of restrictions
        return restrictions;
        
    }
    
}
