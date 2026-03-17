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

package org.apache.guacamole.history.connection;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.net.MalformedURLException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.history.HistoryAuthenticationProvider;
import org.apache.guacamole.io.GuacamoleReader;
import org.apache.guacamole.io.ReaderGuacamoleReader;
import org.apache.guacamole.language.TranslatableMessage;
import org.apache.guacamole.net.auth.ActivityLog;
import org.apache.guacamole.net.auth.ConnectionRecord;
import org.apache.guacamole.net.auth.DelegatingConnectionRecord;
import org.apache.guacamole.net.auth.FileActivityLog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * ConnectionRecord implementation that automatically defines ActivityLogs for
 * files that relate to the wrapped record.
 */
public class HistoryConnectionRecord extends DelegatingConnectionRecord {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(HistoryConnectionRecord.class);

    /**
     * The namespace for URL UUIDs as defined by RFC 4122.
     */
    private static final UUID UUID_NAMESPACE_URL = UUID.fromString("6ba7b811-9dad-11d1-80b4-00c04fd430c8");

    /**
     * The filename suffix of typescript timing files.
     */
    private static final String TIMING_FILE_SUFFIX = ".timing";

    /**
     * The recording file associated with the wrapped connection record. This
     * may be a single file or a directory that may contain any number of
     * relevant recordings.
     */
    private final File recording;

    /**
     * Returns the file or directory providing recording storage for the given
     * history record. If no such file or directory exists, or the file cannot
     * be read, null is returned.
     *
     * @param record
     *     The ConnectionRecord whose associated recording storage file
     *     or directory should be returned.
     *
     * @return
     *     A File pointing to the file or directory providing recording storage
     *     for the given history record, or null if no such file exists.
     *
     * @throws GuacamoleException
     *     If the configured path for stored recordings cannot be read.
     */
    private static File getRecordingFile(ConnectionRecord record) throws GuacamoleException {

        UUID uuid = record.getUUID();
        if (uuid != null) {
            File recordingFile = new File(HistoryAuthenticationProvider.getRecordingSearchPath(), uuid.toString());
            if (recordingFile.canRead())
                return recordingFile;
        }

        return null;

    }

    /**
     * Creates a new HistoryConnectionRecord that wraps the given
     * ConnectionRecord, automatically associating ActivityLogs based on
     * related files (session recordings, typescripts, etc.).
     *
     * @param record
     *     The ConnectionRecord to wrap.
     *
     * @throws GuacamoleException
     *     If the configured path for stored recordings cannot be read.
     */
    public HistoryConnectionRecord(ConnectionRecord record) throws GuacamoleException {
        super(record);
        this.recording = getRecordingFile(record);
    }

    /**
     * Returns whether the given file appears to be a Guacamole session
     * recording. As there is no standard extension for session recordings,
     * this is determined by attempting to read a single Guacamole instruction
     * from the file.
     *
     * @param file
     *     The file to test.
     *
     * @return
     *     true if the file appears to be a Guacamole session recording, false
     *     otherwise.
     */
    private boolean isSessionRecording(File file) {

        Reader reader = null;
        try {
            reader = new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8);

            GuacamoleReader guacReader = new ReaderGuacamoleReader(reader);
            if (guacReader.readInstruction() != null)
                return true;

        }
        catch (GuacamoleException e) {
            logger.debug("File \"{}\" does not appear to be a session "
                    + "recording, as it could not be parsed as Guacamole "
                    + "protocol data.", file, e);
        }
        catch (IOException e) {
            logger.warn("Possible session recording \"{}\" could not be "
                    + "identified as it cannot be read: {}", file, e.getMessage());
            logger.debug("Possible session recording \"{}\" could not be read.", file, e);
        }
        finally {

            // If the reader was successfully constructed, close it
            if (reader != null) {

                try {
                    reader.close();
                }

                catch (IOException e) {
                    logger.warn("Unexpected error closing recording file \"{}\": {}",
                            file, e.getMessage());
                    logger.debug("Session recording file \"{}\" could not be closed.",
                            file, e);
                }

            }
        }

        return false;

    }

    /**
     * Returns whether the given file appears to be a typescript (text
     * recording of a terminal session). As there is no standard extension for
     * session recordings, this is determined by testing whether there is an
     * associated timing file. Guacamole will always include a timing file for
     * its typescripts.
     *
     * @param file
     *     The file to test.
     *
     * @return
     *     true if the file appears to be a typescript, false otherwise.
     */
    private boolean isTypescript(File file) {
        return new File(file.getAbsolutePath() + TIMING_FILE_SUFFIX).exists();
    }

    /**
     * Returns whether the given file appears to be a typescript timing file.
     * Typescript timing files have the standard extension ".timing".
     *
     * @param file
     *     The file to test.
     *
     * @return
     *     true if the file appears to be a typescript timing file, false
     *     otherwise.
     */
    private boolean isTypescriptTiming(File file) {
        return file.getName().endsWith(TIMING_FILE_SUFFIX);
    }

    /**
     * Returns the type of session recording or log contained within the given
     * file by inspecting its name and contents.
     *
     * @param file
     *     The file to test.
     *
     * @return
     *     The type of session recording or log contained within the given
     *     file, or null if this cannot be determined.
     */
    private ActivityLog.Type getType(File file) {

        if (isSessionRecording(file))
            return ActivityLog.Type.GUACAMOLE_SESSION_RECORDING;

        if (isTypescript(file))
            return ActivityLog.Type.TYPESCRIPT;

        if (isTypescriptTiming(file))
            return ActivityLog.Type.TYPESCRIPT_TIMING;

        return ActivityLog.Type.SERVER_LOG;

    }

    /**
     * Returns a new ActivityLog instance representing the session recording or
     * log contained within the given file. If the type of recording/log cannot
     * be determined, or if the file is unreadable, null is returned.
     *
     * @param file
     *     The file to produce an ActivityLog instance for.
     *
     * @return
     *     A new ActivityLog instance representing the recording/log contained
     *     within the given file, or null if the file is unreadable or cannot
     *     be identified.
     */
    private ActivityLog getActivityLog(File file) {

        // Verify file can actually be read
        if (!file.canRead()) {
            logger.warn("Ignoring file \"{}\" relevant to connection history "
                    + "record as it cannot be read.", file);
            return null;
        }

        // Determine type of recording/log by inspecting file
        ActivityLog.Type logType = getType(file);
        if (logType == null) {
            logger.warn("Recording/log type of \"{}\" cannot be determined.", file);
            return null;
        }

        return new FileActivityLog(
            logType,
            new TranslatableMessage("RECORDING_STORAGE.INFO_" + logType.name()),
            file
        );

    }

    /**
     * Adds an ActivityLog instance representing the session recording or log
     * contained within the given file to the given map of logs. If no
     * ActivityLog can be produced for the given file (it is unreadable or
     * cannot be identified), this function has no effect.
     *
     * @param logs
     *     The map of logs to add the ActivityLog to.
     *
     * @param file
     *     The file to produce an ActivityLog instance for.
     */
    private void addActivityLog(Map<String, ActivityLog> logs, File file) {

        ActivityLog log = getActivityLog(file);
        if (log == null)
            return;

        // Convert file into deterministic name UUID within URL namespace
        UUID fileUUID;
        try {
            byte[] urlBytes = file.toURI().toURL().toString().getBytes(StandardCharsets.UTF_8);
            fileUUID = UUID.nameUUIDFromBytes(ByteBuffer.allocate(16 + urlBytes.length)
                    .putLong(UUID_NAMESPACE_URL.getMostSignificantBits())
                    .putLong(UUID_NAMESPACE_URL.getLeastSignificantBits())
                    .put(urlBytes)
                    .array());
        }
        catch (MalformedURLException e) {
            logger.warn("Ignoring file \"{}\" as a unique URL and UUID for that file could not be generated: {}", e.getMessage());
            logger.debug("URL for file \"{}\" could not be determined.", file, e);
            return;
        }

        logs.put(fileUUID.toString(), log);

    }

    @Override
    public Map<String, ActivityLog> getLogs() {

        // Do nothing if there are no associated logs
        if (recording == null)
            return super.getLogs();

        // Add associated log (or logs, if this is a directory)
        Map<String, ActivityLog> logs = new HashMap<>(super.getLogs());
        if (recording.isDirectory()) {
            Arrays.asList(recording.listFiles()).stream()
                    .forEach((file) -> addActivityLog(logs, file));
        }
        else
            addActivityLog(logs, recording);

        return logs;

    }

}
