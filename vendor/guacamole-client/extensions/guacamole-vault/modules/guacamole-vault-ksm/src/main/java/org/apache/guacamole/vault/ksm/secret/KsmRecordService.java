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

package org.apache.guacamole.vault.ksm.secret;

import com.google.inject.Singleton;
import com.keepersecurity.secretsManager.core.HiddenField;
import com.keepersecurity.secretsManager.core.Host;
import com.keepersecurity.secretsManager.core.Hosts;
import com.keepersecurity.secretsManager.core.KeeperFile;
import com.keepersecurity.secretsManager.core.KeeperRecord;
import com.keepersecurity.secretsManager.core.KeeperRecordData;
import com.keepersecurity.secretsManager.core.KeeperRecordField;
import com.keepersecurity.secretsManager.core.KeyPair;
import com.keepersecurity.secretsManager.core.KeyPairs;
import com.keepersecurity.secretsManager.core.Login;
import com.keepersecurity.secretsManager.core.PamHostnames;
import com.keepersecurity.secretsManager.core.Password;
import com.keepersecurity.secretsManager.core.SecretsManager;
import com.keepersecurity.secretsManager.core.Text;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Future;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;


/**
 * Service for automatically parsing out secrets and data from Keeper records.
 */
@Singleton
public class KsmRecordService {

    /**
     * Regular expression which matches the labels of custom fields containing
     * domains.
     */
    private static final Pattern DOMAIN_LABEL_PATTERN =
            Pattern.compile("domain", Pattern.CASE_INSENSITIVE);

    /**
     * Regular expression which matches the labels of custom fields containing
     * hostnames/addresses.
     */
    private static final Pattern HOSTNAME_LABEL_PATTERN =
            Pattern.compile("hostname|(ip\\s*)?address", Pattern.CASE_INSENSITIVE);

    /**
     * Regular expression which matches the labels of custom fields containing
     * usernames.
     */
    private static final Pattern USERNAME_LABEL_PATTERN =
            Pattern.compile("username", Pattern.CASE_INSENSITIVE);

    /**
     * Regular expression which matches the labels of custom fields containing
     * passwords.
     */
    private static final Pattern PASSWORD_LABEL_PATTERN =
            Pattern.compile("password", Pattern.CASE_INSENSITIVE);

    /**
     * Regular expression which matches the labels of custom fields containing
     * passphrases for private keys.
     */
    private static final Pattern PASSPHRASE_LABEL_PATTERN =
            Pattern.compile("passphrase", Pattern.CASE_INSENSITIVE);

    /**
     * Regular expression which matches the labels of custom fields containing
     * private keys.
     */
    private static final Pattern PRIVATE_KEY_CUSTOM_LABEL_PATTERN =
            Pattern.compile("private\\s*key", Pattern.CASE_INSENSITIVE);

    /**
     * Regular expression which matches the labels of standard fields containing
     * private keys.
     */
    private static final Pattern PRIVATE_KEY_STANDARD_LABEL_PATTERN =
            Pattern.compile("private\\s*pem\\s*key", Pattern.CASE_INSENSITIVE);

    /**
     * Regular expression which matches the filenames of private keys attached
     * to Keeper records.
     */
    private static final Pattern PRIVATE_KEY_FILENAME_PATTERN =
            Pattern.compile(".*\\.pem", Pattern.CASE_INSENSITIVE);

    /**
     * Returns the single value stored in the given list. If the list is empty
     * or contains multiple values, null is returned. Note that null will also
     * be returned if the single value stored in the list is itself null.
     *
     * @param <T>
     *     The type of object stored in the list.
     *
     * @param values
     *     The list to retrieve a single value from.
     *
     * @return
     *     The single value stored in the given list, or null if the list is
     *     empty or contains multiple values.
     */
    private <T> T getSingleValue(List<T> values) {

        if (values == null || values.size() != 1)
            return null;

        return values.get(0);

    }

    /**
     * Returns the single value stored in the given list of strings. If the
     * list is empty, contains multiple values, or contains only a single empty
     * string, null is returned. Note that null will also be returned if the
     * single value stored in the list is itself null.
     *
     * @param values
     *     The list to retrieve a single value from.
     *
     * @return
     *     The single value stored in the given list, or null if the list is
     *     empty, contains multiple values, or contains only a single empty
     *     string.
     */
    private String getSingleStringValue(List<String> values) {

        String value = getSingleValue(values);
        if (value != null && !value.isEmpty())
            return value;

        return null;

    }

    /**
     * Returns the single value stored in the given list, additionally
     * performing a mapping transformation on the single value. If the list is
     * empty or contains multiple values, null is returned. Note that null will
     * also be returned if the mapping transformation returns null for the
     * single value stored in the list.
     *
     * @param <T>
     *     The type of object stored in the list.
     *
     * @param <R>
     *     The type of object to return.
     *
     * @param values
     *     The list to retrieve a single value from.
     *
     * @param mapper
     *     The function to use to map the single object of type T to type R.
     *
     * @return
     *     The single value stored in the given list, transformed using the
     *     provided mapping function, or null if the list is empty or contains
     *     multiple values.
     */
    private <T, R> R getSingleValue(List<T> values, Function<T, R> mapper) {

        T value = getSingleValue(values);
        if (value == null)
            return null;

        return mapper.apply(value);

    }

    /**
     * Returns the single value stored in the given list of strings,
     * additionally performing a mapping transformation on the single value. If
     * the list is empty, contains multiple values, or contains only a single
     * empty string, null is returned. Note that null will also be returned if
     * the mapping transformation returns null for the single value stored in
     * the list.
     *
     * @param <T>
     *     The type of object stored in the list.
     *
     * @param values
     *     The list to retrieve a single value from.
     *
     * @param mapper
     *     The function to use to map the single object of type T to type R.
     *
     * @return
     *     The single value stored in the given list, transformed using the
     *     provided mapping function, or null if the list is empty, contains
     *     multiple values, or contains only a single empty string.
     */
    private <T> String getSingleStringValue(List<T> values, Function<T, String> mapper) {

        String value = getSingleValue(values, mapper);
        if (value != null && !value.isEmpty())
            return value;

        return null;

    }

    /**
     * Returns the instance of the only field that has the given type and
     * matches the given label pattern. If there are no such fields, or
     * multiple such fields, null is returned.
     *
     * @param <T>
     *     The type of field to return.
     *
     * @param fields
     *     The list of fields to retrieve the field from. For convenience, this
     *     may be null. A null list will be considered equivalent to an empty
     *     list.
     *
     * @param fieldClass
     *     The class representing the type of field to return.
     *
     * @param labelPattern
     *     The pattern to match against the desired field's label, or null if
     *     no label pattern match should be performed.
     *
     * @return
     *     The field having the given type and matching the given label
     *     pattern, or null if there is not exactly one such field.
     */
    @SuppressWarnings("unchecked") // Manually verified with isAssignableFrom()
    private <T extends KeeperRecordField> T getField(List<KeeperRecordField> fields,
            Class<T> fieldClass, Pattern labelPattern) {

        // There are no fields if no List was provided at all
        if (fields == null)
            return null;

        T foundField = null;
        for (KeeperRecordField field : fields) {

            // Ignore fields of wrong class
            if (!fieldClass.isAssignableFrom(field.getClass()))
                continue;

            // Match against provided pattern, if any
            if (labelPattern != null) {

                // Ignore fields without labels if a label match is requested
                String label = field.getLabel();
                if (label == null)
                    continue;

                // Ignore fields whose labels do not match
                Matcher labelMatcher = labelPattern.matcher(label);
                if (!labelMatcher.matches())
                    continue;

            }

            // Ignore ambiguous fields
            if (foundField != null)
                return null;

            // Tentative match found - we can use this as long as no other
            // field matches the criteria
            foundField = (T) field;

        }

        return foundField;

    }

    /**
     * Returns the instance of the only field that has the given type and
     * matches the given label pattern. If there are no such fields, or
     * multiple such fields, null is returned. Both standard and custom fields
     * are searched. As standard fields do not have labels, any given label
     * pattern is ignored for standard fields.
     *
     * @param <T>
     *     The type of field to return.
     *
     * @param record
     *     The Keeper record to retrieve the field from.
     *
     * @param fieldClass
     *     The class representing the type of field to return.
     *
     * @param labelPattern
     *     The pattern to match against the labels of custom fields, or null if
     *     no label pattern match should be performed.
     *
     * @return
     *     The field having the given type and matching the given label
     *     pattern, or null if there is not exactly one such field.
     */
    private <T extends KeeperRecordField> T getField(KeeperRecord record,
            Class<T> fieldClass, Pattern labelPattern) {

        KeeperRecordData data = record.getData();

        // Attempt to find standard field first, ignoring custom fields if a
        // standard field exists (NOTE: standard fields do not have labels)
        T field = getField(data.getFields(), fieldClass, null);
        if (field != null)
            return field;

        // Fall back on custom fields
        return getField(data.getCustom(), fieldClass, labelPattern);

    }

    /**
     * Returns the file attached to the give Keeper record whose filename
     * matches the given pattern. If there are no such files, or multiple such
     * files, null is returned.
     *
     * @param record
     *     The record to retrieve the file from.
     *
     * @param filenamePattern
     *     The pattern to match filenames against.
     *
     * @return
     *     The single matching file attached to the given Keeper record, or
     *     null if there is not exactly one matching file.
     */
    private KeeperFile getFile(KeeperRecord record, Pattern filenamePattern) {

        List<KeeperFile> files = record.getFiles();
        if (files == null)
            return null;

        KeeperFile foundFile = null;
        for (KeeperFile file : files) {

            // Ignore files whose filenames do not match
            Matcher filenameMatcher = filenamePattern.matcher(file.getData().getName());
            if (!filenameMatcher.matches())
                continue;

            // Ignore ambiguous fields
            if (foundFile != null)
                return null;

            foundFile = file;

        }

        return foundFile;

    }

    /**
     * Downloads the given file from the Keeper vault asynchronously. All files
     * are read as UTF-8.
     *
     * @param file
     *     The file to download, which may be null.
     *
     * @return
     *     A Future which resolves with the contents of the file once
     *     downloaded. If no file was provided (file was null), this Future
     *     resolves with null.
     */
    public Future<String> download(final KeeperFile file) {

        if (file == null)
            return CompletableFuture.completedFuture(null);

        return CompletableFuture.supplyAsync(() -> {
            return new String(SecretsManager.downloadFile(file), StandardCharsets.UTF_8);
        });

    }

    /**
     * Returns the single hostname (or address) associated with the given
     * record. If the record has no associated hostname, or multiple hostnames,
     * null is returned. Hostnames are retrieved from "Hosts" or "PamHostnames"
     * fields, as well as "Text" and "Hidden" fields that have the label
     * "hostname", "address", or "ip address" (case-insensitive, space optional).
     * These field types are checked in the above order, and the first matching
     * field is returned.
     *
     * @param record
     *     The record to retrieve the hostname from.
     *
     * @return
     *     The hostname associated with the given record, or null if the record
     *     has no associated hostname or multiple hostnames.
     */
    public String getHostname(KeeperRecord record) {

        // Prefer standard login field
        Hosts hostsField = getField(record, Hosts.class, null);
        if (hostsField != null)
            return getSingleStringValue(hostsField.getValue(), Host::getHostName);

        // Next, try a PAM hostname
        PamHostnames pamHostsField = getField(record, PamHostnames.class, null);
        if (pamHostsField != null)
            return getSingleStringValue(pamHostsField.getValue(), Host::getHostName);

        KeeperRecordData data = record.getData();
        List<KeeperRecordField> custom = data.getCustom();

        // Use text "hostname" custom field as fallback ...
        Text textField = getField(custom, Text.class, HOSTNAME_LABEL_PATTERN);
        if (textField != null)
            return getSingleStringValue(textField.getValue());

        // ... or hidden "hostname" custom field
        HiddenField hiddenField = getField(custom, HiddenField.class, HOSTNAME_LABEL_PATTERN);
        if (hiddenField != null)
            return getSingleStringValue(hiddenField.getValue());

        return null;

    }

    /**
     * Returns the single username associated with the given record. If the
     * record has no associated username, or multiple usernames, null is
     * returned. Usernames are retrieved from "Login" fields, as well as
     * "Text" and "Hidden" fields that have the label "username"
     * (case-insensitive).
     *
     * @param record
     *     The record to retrieve the username from.
     *
     * @return
     *     The username associated with the given record, or null if the record
     *     has no associated username or multiple usernames.
     */
    public String getUsername(KeeperRecord record) {

        // Prefer standard login field
        Login loginField = getField(record, Login.class, null);
        if (loginField != null)
            return getSingleStringValue(loginField.getValue());

        KeeperRecordData data = record.getData();
        List<KeeperRecordField> custom = data.getCustom();

        // Use text "username" custom field as fallback ...
        Text textField = getField(custom, Text.class, USERNAME_LABEL_PATTERN);
        if (textField != null)
            return getSingleStringValue(textField.getValue());

        // ... or hidden "username" custom field
        HiddenField hiddenField = getField(custom, HiddenField.class, USERNAME_LABEL_PATTERN);
        if (hiddenField != null)
            return getSingleStringValue(hiddenField.getValue());

        return null;

    }

    /**
     * Returns the single domain associated with the given record. If the
     * record has no associated domain, or multiple domains, null is
     * returned. Domains are retrieved from "Text" and "Hidden" fields
     * that have the label "domain" (case-insensitive).
     *
     * @param record
     *     The record to retrieve the domain from.
     *
     * @return
     *     The domain associated with the given record, or null if the record
     *     has no associated domain or multiple domains.
     */
    public String getDomain(KeeperRecord record) {

        KeeperRecordData data = record.getData();
        List<KeeperRecordField> custom = data.getCustom();

        // First check text "domain" custom field ...
        Text textField = getField(custom, Text.class, DOMAIN_LABEL_PATTERN);
        if (textField != null)
            return getSingleStringValue(textField.getValue());

        // ... or hidden "domain" custom field if that's not found
        HiddenField hiddenField = getField(custom, HiddenField.class, DOMAIN_LABEL_PATTERN);
        if (hiddenField != null)
            return getSingleStringValue(hiddenField.getValue());

        return null;

    }

    /**
     * Returns the password associated with the given record. Both standard and
     * custom fields are searched. Only "Password" and "Hidden" field types are
     * considered. Custom fields must additionally have the label "password"
     * (case-insensitive).
     *
     * @param record
     *     The record to retrieve the password from.
     *
     * @return
     *     The password associated with the given record, or null if the record
     *     has no associated password.
     */
    public String getPassword(KeeperRecord record) {

        Password passwordField = getField(record, Password.class, PASSWORD_LABEL_PATTERN);
        if (passwordField != null)
            return getSingleStringValue(passwordField.getValue());

        HiddenField hiddenField = getField(record, HiddenField.class, PASSWORD_LABEL_PATTERN);
        if (hiddenField != null)
            return getSingleStringValue(hiddenField.getValue());

        return null;

    }

    /**
     * Returns the private key associated with the given record. If the record
     * has no associated private key, or multiple private keys, null is
     * returned. Private keys are retrieved from "KeyPairs" fields.
     * Alternatively, private keys are retrieved from PEM-type attachments or
     * standard "Hidden" fields with the label "private pem key", or custom
     * fields with the label "private key" if they are "KeyPairs", "Password",
     * or "Hidden" fields. All label matching is case-insensitive, with spaces
     * between words being optional. If file downloads are required, they will
     * be performed asynchronously.
     *
     * @param record
     *     The record to retrieve the private key from.
     *
     * @return
     *     A Future which resolves with the private key associated with the
     *     given record. If the record has no associated private key or
     *     multiple private keys, the returned Future will resolve to null.
     */
    public Future<String> getPrivateKey(KeeperRecord record) {

        // Attempt to find single matching keypair field
        KeyPairs keyPairsField = getField(
                record, KeyPairs.class, PRIVATE_KEY_CUSTOM_LABEL_PATTERN);
        if (keyPairsField != null) {
            String privateKey = getSingleStringValue(keyPairsField.getValue(), KeyPair::getPrivateKey);
            if (privateKey != null && !privateKey.isEmpty())
                return CompletableFuture.completedFuture(privateKey);
        }

        // Lacking a typed keypair field, prefer a PEM-type attachment
        KeeperFile keyFile = getFile(record, PRIVATE_KEY_FILENAME_PATTERN);
        if (keyFile != null)
            return download(keyFile);

        KeeperRecordData data = record.getData();
        List<KeeperRecordField> custom = data.getCustom();

        // Use a hidden "private pem key" standard field as fallback ...
        HiddenField hiddenField = getField(
                data.getFields(), HiddenField.class, PRIVATE_KEY_STANDARD_LABEL_PATTERN);
        if (hiddenField != null)
            return CompletableFuture.completedFuture(getSingleStringValue(hiddenField.getValue()));

        // ... or password "private key" custom field ...
        Password passwordField = getField(
                custom, Password.class, PRIVATE_KEY_CUSTOM_LABEL_PATTERN);
        if (passwordField != null)
            return CompletableFuture.completedFuture(getSingleStringValue(passwordField.getValue()));

        // ... or hidden "private key" custom field
        hiddenField = getField(
                custom, HiddenField.class, PRIVATE_KEY_CUSTOM_LABEL_PATTERN);
        if (hiddenField != null)
            return CompletableFuture.completedFuture(getSingleStringValue(hiddenField.getValue()));

        return CompletableFuture.completedFuture(null);

    }

    /**
     * Returns the passphrase for the private key associated with the given
     * record. Both standard and custom fields are searched. Only "Password"
     * and "Hidden" field types are considered. Custom fields must additionally
     * have the label "passphrase" (case-insensitive). Note that there is no
     * specific association between private keys and passphrases in the
     * "KeyPairs" field type.
     *
     * @param record
     *     The record to retrieve the passphrase from.
     *
     * @return
     *     The passphrase for the private key associated with the given record,
     *     or null if there is no such passphrase associated with the record.
     */
    public String getPassphrase(KeeperRecord record) {

        KeeperRecordData data = record.getData();
        List<KeeperRecordField> fields = data.getFields();
        List<KeeperRecordField> custom = data.getCustom();

        // For records with a standard keypair field, the passphrase is the
        // standard password field
        if (getField(fields, KeyPairs.class, null) != null) {
            Password passwordField = getField(fields, Password.class, null);
            if (passwordField != null)
                return getSingleStringValue(passwordField.getValue());
        }

        // For records WITHOUT a standard keypair field, the passphrase can
        // only reasonably be a custom field (consider a "Login" record with
        // a pair of custom hidden fields for the private key and passphrase:
        // the standard password field of the "Login" record refers to the
        // user's own password, if any, not the passphrase of their key)

        // Use password "private key" custom field as fallback ...
        Password passwordField = getField(custom, Password.class, PASSPHRASE_LABEL_PATTERN);
        if (passwordField != null)
            return getSingleStringValue(passwordField.getValue());

        // ... or hidden "private key" custom field
        HiddenField hiddenField = getField(custom, HiddenField.class, PASSPHRASE_LABEL_PATTERN);
        if (hiddenField != null)
            return getSingleStringValue(hiddenField.getValue());

        return null;

    }

}
