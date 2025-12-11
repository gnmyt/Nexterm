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

package org.apache.guacamole.auth.totp.form;

import com.google.common.io.BaseEncoding;
import com.google.inject.Inject;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import javax.ws.rs.core.UriBuilder;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.totp.user.UserTOTPKey;
import org.apache.guacamole.auth.totp.conf.ConfigurationService;
import org.apache.guacamole.form.Field;
import org.apache.guacamole.totp.TOTPGenerator;

/**
 * Field which prompts the user for an authentication code generated via TOTP.
 */
public class AuthenticationCodeField extends Field {

    /**
     * The name of the HTTP parameter which will contain the TOTP code provided
     * by the user to verify their identity.
     */
    public static final String PARAMETER_NAME = "guac-totp";

    /**
     * The unique name associated with this field type.
     */
    private static final String FIELD_TYPE_NAME = "GUAC_TOTP_CODE";

    /**
     * The width of QR codes to generate, in pixels.
     */
    private static final int QR_CODE_WIDTH = 256;

    /**
     * The height of QR codes to generate, in pixels.
     */
    private static final int QR_CODE_HEIGHT = 256;

    /**
     * BaseEncoding which encodes/decodes base32.
     */
    private static final BaseEncoding BASE32 = BaseEncoding.base32();

    /**
     * Service for retrieving configuration information.
     */
    @Inject
    private ConfigurationService confService;

    /**
     * The TOTP key to expose to the user for the sake of enrollment, if any.
     * If no such key should be exposed to the user, this will be null.
     */
    private UserTOTPKey key;

    /**
     * Creates a new field which prompts the user for an authentication code
     * generated via TOTP. The user's TOTP key is not exposed for enrollment.
     */
    public AuthenticationCodeField() {
        super(PARAMETER_NAME, FIELD_TYPE_NAME);
    }

    /**
     * Exposes the given key to facilitate enrollment.
     *
     * @param key
     *     The TOTP key to expose to the user for the sake of enrollment.
     */
    public void exposeKey(UserTOTPKey key) {
        this.key = key;
    }

    /**
     * Returns the username of the user associated with the key being used to
     * generate TOTP codes. If the user's key is not being exposed to facilitate
     * enrollment, this value will not be exposed either.
     *
     * @return
     *     The username of the user associated with the key being used to
     *     generate TOTP codes, or null if the user's key is not being exposed
     *     to facilitate enrollment.
     */
    public String getUsername() {

        // Do not reveal TOTP mode unless enrollment is in progress
        if (key == null)
            return null;

        return key.getUsername();

    }

    /**
     * Returns the base32-encoded secret key that is being used to generate TOTP
     * codes for the authenticating user. If the user's key is not being exposed
     * to facilitate enrollment, this value will not be exposed either.
     *
     * @return
     *     The base32-encoded secret key that is being used to generate TOTP
     *     codes for the authenticating user, or null if the user's key is not
     *     being exposed to facilitate enrollment.
     */
    public String getSecret() {

        // Do not reveal TOTP mode unless enrollment is in progress
        if (key == null)
            return null;

        return BASE32.encode(key.getSecret());

    }

    /**
     * Returns the number of digits used for each TOTP code. If the user's key
     * is not being exposed to facilitate enrollment, this value will not be
     * exposed either.
     *
     * @return
     *     The number of digits used for each TOTP code, or null if the user's
     *     key is not being exposed to facilitate enrollment.
     *
     * @throws GuacamoleException
     *     If the number of digits cannot be read from guacamole.properties.
     */
    public Integer getDigits() throws GuacamoleException {

        // Do not reveal code size unless enrollment is in progress
        if (key == null)
            return null;

        return confService.getDigits();
        
    }

    /**
     * Returns the human-readable name of the entity issuing user accounts. If
     * the user's key is not being exposed to facilitate enrollment, this value
     * will not be exposed either.
     *
     * @return
     *     The human-readable name of the entity issuing user accounts, or null
     *     if the user's key is not being exposed to facilitate enrollment.
     *
     * @throws GuacamoleException
     *     If the issuer cannot be read from guacamole.properties.
     */
    public String getIssuer() throws GuacamoleException {

        // Do not reveal code issuer unless enrollment is in progress
        if (key == null)
            return null;

        return confService.getIssuer();

    }

    /**
     * Returns the mode that TOTP code generation is operating in. This value
     * will be one of "SHA1", "SHA256", or "SHA512". If the user's key is not
     * being exposed to facilitate enrollment, this value will not be exposed
     * either.
     *
     * @return
     *     The mode that TOTP code generation is operating in, such as "SHA1",
     *     "SHA256", or "SHA512", or null if the user's key is not being
     *     exposed to facilitate enrollment.
     *
     * @throws GuacamoleException
     *     If the TOTP mode cannot be read from guacamole.properties.
     */
    public TOTPGenerator.Mode getMode() throws GuacamoleException {

        // Do not reveal TOTP mode unless enrollment is in progress
        if (key == null)
            return null;

        return confService.getMode();

    }

    /**
     * Returns the number of seconds that each TOTP code remains valid. If the
     * user's key is not being exposed to facilitate enrollment, this value will
     * not be exposed either.
     *
     * @return
     *     The number of seconds that each TOTP code remains valid, or null if
     *     the user's key is not being exposed to facilitate enrollment.
     *
     * @throws GuacamoleException
     *     If the period cannot be read from guacamole.properties.
     */
    public Integer getPeriod() throws GuacamoleException {

        // Do not reveal code period unless enrollment is in progress
        if (key == null)
            return null;

        return confService.getPeriod();

    }

    /**
     * Returns the "otpauth" URI for the secret key used to generate TOTP codes
     * for the current user. If the secret key is not being exposed to
     * facilitate enrollment, null is returned.
     *
     * @return
     *     The "otpauth" URI for the secret key used to generate TOTP codes
     *     for the current user, or null is the secret ket is not being exposed
     *     to facilitate enrollment.
     *
     * @throws GuacamoleException
     *     If the configuration information required for generating the key URI
     *     cannot be read from guacamole.properties.
     */
    public URI getKeyUri() throws GuacamoleException {

        // Do not generate a key URI if no key is being exposed
        if (key == null)
            return null;

        // Format "otpauth" URL (see https://github.com/google/google-authenticator/wiki/Key-Uri-Format)
        String issuer = confService.getIssuer();
        return UriBuilder.fromUri("otpauth://totp/")
                .path(issuer + ":" + key.getUsername())
                .queryParam("secret", BASE32.encode(key.getSecret()))
                .queryParam("issuer", issuer)
                .queryParam("algorithm", confService.getMode())
                .queryParam("digits", confService.getDigits())
                .queryParam("period", confService.getPeriod())
                .build();

    }

    /**
     * Returns the URL of a QR code describing the user's TOTP key and
     * configuration. If the key is not being exposed for enrollment, null is
     * returned.
     *
     * @return 
     *     The URL of a QR code describing the user's TOTP key and
     *     configuration, or null if the key is not being exposed for
     *     enrollment.
     *
     * @throws GuacamoleException
     *     If the configuration information required for generating the QR code
     *     cannot be read from guacamole.properties.
     */
    public String getQrCode() throws GuacamoleException {

        // Do not generate a QR code if no key is being exposed
        URI keyURI = getKeyUri();
        if (keyURI == null)
            return null;

        ByteArrayOutputStream stream = new ByteArrayOutputStream();

        try {

            // Create QR code writer
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(keyURI.toString(),
                    BarcodeFormat.QR_CODE, QR_CODE_WIDTH, QR_CODE_HEIGHT);

            // Produce PNG image of TOTP key text
            MatrixToImageWriter.writeToStream(matrix, "PNG", stream);

        }
        catch (WriterException e) {
            throw new IllegalArgumentException("QR code could not be "
                    + "generated for TOTP key.", e);
        }
        catch (IOException e) {
            throw new IllegalStateException("Image stream of QR code could "
                    + "not be written.", e);
        }

        // Return data URI for generated image
        return "data:image/png;base64,"
                + BaseEncoding.base64().encode(stream.toByteArray());

    }

}
