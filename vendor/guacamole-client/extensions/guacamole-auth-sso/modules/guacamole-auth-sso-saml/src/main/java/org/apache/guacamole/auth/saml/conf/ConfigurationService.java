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

package org.apache.guacamole.auth.saml.conf;

import com.google.inject.Inject;
import com.onelogin.saml2.settings.IdPMetadataParser;
import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.settings.SettingsBuilder;
import com.onelogin.saml2.util.Constants;
import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;
import javax.ws.rs.core.UriBuilder;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.properties.BooleanGuacamoleProperty;
import org.apache.guacamole.properties.FileGuacamoleProperty;
import org.apache.guacamole.properties.IntegerGuacamoleProperty;
import org.apache.guacamole.properties.StringGuacamoleProperty;
import org.apache.guacamole.properties.URIGuacamoleProperty;

/**
 * Service for retrieving configuration information regarding the SAML
 * authentication module.
 */
public class ConfigurationService {

    /**
     * The URI of the file containing the XML Metadata associated with the
     * SAML IdP.
     */
    private static final URIGuacamoleProperty SAML_IDP_METADATA_URL =
            new URIGuacamoleProperty() {

        @Override
        public String getName() { return "saml-idp-metadata-url"; }

    };

    /**
     * The URL of the SAML IdP.
     */
    private static final URIGuacamoleProperty SAML_IDP_URL =
            new URIGuacamoleProperty() {

        @Override
        public String getName() { return "saml-idp-url"; }

    };

    /**
     * The URL identifier for this SAML client.
     */
    private static final URIGuacamoleProperty SAML_ENTITY_ID =
            new URIGuacamoleProperty() {

        @Override
        public String getName() { return "saml-entity-id"; }

    };

    /**
     * The callback URL to use for SAML IdP, normally the base
     * of the Guacamole install. The SAML extensions callback
     * endpoint will be appended to this value.
     */
    private static final URIGuacamoleProperty SAML_CALLBACK_URL =
            new URIGuacamoleProperty() {

        @Override
        public String getName() { return "saml-callback-url"; }

    };
    
    /**
     * Whether or not debugging should be enabled in the SAML library to help
     * track down errors.
     */
    private static final BooleanGuacamoleProperty SAML_DEBUG =
            new BooleanGuacamoleProperty() {
    
        @Override
        public String getName() { return "saml-debug"; }
                
    };
    
    /**
     * Whether or not to enable compression for the SAML request.
     */
    private static final BooleanGuacamoleProperty SAML_COMPRESS_REQUEST =
            new BooleanGuacamoleProperty() {
            
        @Override
        public String getName() { return "saml-compress-request"; }
                
    };
    
    /**
     * Whether or not to enable compression for the SAML response.
     */
    private static final BooleanGuacamoleProperty SAML_COMPRESS_RESPONSE =
            new BooleanGuacamoleProperty() {
            
        @Override
        public String getName() { return "saml-compress-response"; }
                
    };
    
    /**
     * Whether or not to enforce strict SAML security during processing.
     */
    private static final BooleanGuacamoleProperty SAML_STRICT =
            new BooleanGuacamoleProperty() {
            
        @Override
        public String getName() { return "saml-strict"; }
        
    };
    
    /**
     * The property that defines what attribute the SAML provider will return
     * that contains group membership for the authenticated user.
     */
    private static final StringGuacamoleProperty SAML_GROUP_ATTRIBUTE =
            new StringGuacamoleProperty() {
            
        @Override
        public String getName() { return "saml-group-attribute"; }
                
    };

    /**
     * The maximum amount of time to allow for an in-progress SAML
     * authentication attempt to be completed, in minutes. A user that takes
     * longer than this amount of time to complete authentication with their
     * identity provider will be redirected back to the identity provider to
     * try again.
     */
    private static final IntegerGuacamoleProperty SAML_AUTH_TIMEOUT =
            new IntegerGuacamoleProperty() {
            
        @Override
        public String getName() { return "saml-auth-timeout"; }
                
    };

    /**
     * The file containing the X.509 cert to use when signing or encrypting
     * requests to the SAML IdP.
     */
    private static final FileGuacamoleProperty SAML_X509_CERT_PATH =
            new FileGuacamoleProperty() {

        @Override
        public String getName() { return "saml-x509-cert-path"; }

    };

    /**
     * The file containing the private key to use when signing or encrypting
     * requests to the SAML IdP.
     */
    private static final FileGuacamoleProperty SAML_PRIVATE_KEY_PATH =
            new FileGuacamoleProperty() {

        @Override
        public String getName() { return "saml-private-key-path"; }

    };

    /**
     * The Guacamole server environment.
     */
    @Inject
    private Environment environment;

    /**
     * Returns the URL to be submitted as the client ID to the SAML IdP, as
     * configured in guacamole.properties.
     *
     * @return
     *     The URL to send to the SAML IdP as the Client Identifier.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    private URI getEntityId() throws GuacamoleException {
        return environment.getProperty(SAML_ENTITY_ID);
    }

    /**
     * The URI that contains the metadata that the SAML client should
     * use to communicate with the SAML IdP. This can either be a remote
     * URL of a server that provides this, or can be a URI to a file on the
     * local filesystem. The metadata file is usually generated by the SAML IdP
     * and should be uploaded to the system where the Guacamole client is
     * running.
     *
     * @return
     *     The URI of the file containing the metadata used by the SAML client
     *     when it communicates with the SAML IdP.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed, or if the client
     *     metadata is missing.
     */
    private URI getIdpMetadata() throws GuacamoleException {
        return environment.getProperty(SAML_IDP_METADATA_URL);
    }

    /**
     * Return the URL used to log in to the SAML IdP.
     *
     * @return
     *     The URL used to log in to the SAML IdP.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    private URI getIdpUrl() throws GuacamoleException {
        return environment.getProperty(SAML_IDP_URL);
    }

    /**
     * The callback URL used for the SAML IdP to POST a response
     * to upon completion of authentication, normally the base
     * of the Guacamole install.
     *
     * @return
     *     The callback URL to be sent to the SAML IdP that will
     *     be POSTed to upon completion of SAML authentication.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed, or the property
     *     is missing.
     */
    public URI getCallbackUrl() throws GuacamoleException {
        return environment.getRequiredProperty(SAML_CALLBACK_URL);
    }
    
    /**
     * Return the Boolean value that indicates whether SAML client debugging
     * will be enabled, as configured in guacamole.properties. The default is
     * false, and debug information will not be generated or logged.
     * 
     * @return
     *     True if debugging should be enabled in the SAML library, otherwise
     *     false.
     * 
     * @throws GuacamoleException 
     *     If guacamole.properties cannot be parsed.
     */
    private boolean getDebug() throws GuacamoleException {
        return environment.getProperty(SAML_DEBUG, false);
    }
    
    /**
     * Return the Boolean value that indicates whether or not compression of
     * SAML requests to the IdP should be enabled or not, as configured in
     * guacamole.properties. The default is to enable compression.
     * 
     * @return
     *     True if compression should be enabled when sending the SAML request,
     *     otherwise false.
     * 
     * @throws GuacamoleException 
     *     If guacamole.properties cannot be parsed.
     */
    private boolean getCompressRequest() throws GuacamoleException {
        return environment.getProperty(SAML_COMPRESS_REQUEST, true);
    }
    
    /**
     * Return a Boolean value that indicates whether or not the SAML login
     * should enforce strict security controls, as configured in
     * guacamole.properties. By default this is true, and should be set to
     * true in any production environment.
     * 
     * @return
     *     True if the SAML login should enforce strict security checks,
     *     otherwise false.
     * 
     * @throws GuacamoleException 
     *     If guacamole.properties cannot be parsed.
     */
    private boolean getStrict() throws GuacamoleException {
        return environment.getProperty(SAML_STRICT, true);
    }
    
    /**
     * Return a Boolean value that indicates whether or not compression should
     * be requested from the server when the SAML response is returned, as
     * configured in guacamole.properties. The default is to request that the
     * response be compressed.
     * 
     * @return
     *     True if compression should be requested from the server for the SAML
     *     response.
     * 
     * @throws GuacamoleException 
     *     If guacamole.properties cannot be parsed.
     */
    private boolean getCompressResponse() throws GuacamoleException {
        return environment.getProperty(SAML_COMPRESS_RESPONSE, true);
    }
    
    /**
     * Return the name of the attribute that will be supplied by the identity
     * provider that contains the groups of which this user is a member.
     * 
     * @return
     *     The name of the attribute that contains the user groups.
     * 
     * @throws GuacamoleException 
     *     If guacamole.properties cannot be parsed.
     */
    public String getGroupAttribute() throws GuacamoleException {
        return environment.getProperty(SAML_GROUP_ATTRIBUTE, "groups");
    }

    /**
     * Returns the maximum amount of time to allow for an in-progress SAML
     * authentication attempt to be completed, in minutes. A user that takes
     * longer than this amount of time to complete authentication with their
     * identity provider will be redirected back to the identity provider to
     * try again.
     *
     * @return
     *     The maximum amount of time to allow for an in-progress SAML
     *     authentication attempt to be completed, in minutes.
     *
     * @throws GuacamoleException
     *     If the authentication timeout cannot be parsed.
     */
    public int getAuthenticationTimeout() throws GuacamoleException {
        return environment.getProperty(SAML_AUTH_TIMEOUT, 5);
    }

    /**
     * Returns the file containing the X.509 certificate to use when signing
     * requests to the SAML IdP. If the property is not set, null will be
     * returned.
     *
     * @return
     *     The file containing the X.509 certificate to use when signing
     *     requests to the SAML IdP, or null if not defined.
     *
     * @throws GuacamoleException
     *     If the X.509 certificate cannot be parsed.
     */
    public File getCertificateFile() throws GuacamoleException {
        return environment.getProperty(SAML_X509_CERT_PATH);
    }

    /**
     * Returns the file containing the private key to use when signing
     * requests to the SAML IdP. If the property is not set, null will be
     * returned.
     *
     * @return
     *     The file containing the private key to use when signing
     *     requests to the SAML IdP, or null if not defined.
     *
     * @throws GuacamoleException
     *     If the private key file cannot be parsed.
     */
    public File getPrivateKeyFile() throws GuacamoleException {
        return environment.getProperty(SAML_PRIVATE_KEY_PATH);
    }

    /**
     * Returns the contents of a small file, such as a private key or certificate into
     * a String. If the file does not exist, or cannot be read for any reason, an exception
     * will be thrown with the details of the failure.
     *
     * @param file
     *     The file to read into a string.
     *
     * @param name
     *     A human-readable name for the file, to be used when formatting log messages.
     *
     * @return
     *     The contents of the file having the given path.
     *
     * @throws GuacamoleException
     *     If the provided file does not exist, or cannot be read for any reason.
     */
    private String readFileContentsIntoString(File file, String name) throws GuacamoleException {

        // Attempt to read the file directly into a String
        try {
            return new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
        }

        // If the file cannot be read, log a warning and treat it as if it does not exist
        catch (IOException e) {
            throw new GuacamoleServerException(
                    name + " at \"" + file.getAbsolutePath() + "\" could not be read.", e);
        }

    }

    /**
     * Returns the collection of SAML settings used to initialize the client.
     *
     * @return
     *     The collection of SAML settings used to initialize the SAML client.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed or if required parameters
     *     are missing.
     */
    public Saml2Settings getSamlSettings() throws GuacamoleException {

        // Try to get the XML file, first.
        URI idpMetadata = getIdpMetadata();
        Map<String, Object> samlMap;
        if (idpMetadata != null) {
            try {
                samlMap = IdPMetadataParser.parseRemoteXML(idpMetadata.toURL());
            }
            catch (Exception e) {
                throw new GuacamoleServerException(
                        "Could not parse SAML IdP Metadata file.", e);
            }
        }

        // If no XML metadata is provided, fall-back to individual values.
        else {
            samlMap = new HashMap<>();
            samlMap.put(SettingsBuilder.IDP_ENTITYID_PROPERTY_KEY,
                    getIdpUrl().toString());
            samlMap.put(SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_URL_PROPERTY_KEY,
                    getIdpUrl().toString());
            samlMap.put(SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_BINDING_PROPERTY_KEY,
                    Constants.BINDING_HTTP_REDIRECT);
        }

        // Read entity ID from properties if not provided within metadata XML
        if (!samlMap.containsKey(SettingsBuilder.SP_ENTITYID_PROPERTY_KEY)) {
            URI entityId = getEntityId();
            if (entityId == null)
                throw new GuacamoleServerException("SAML Entity ID was not found"
                        + " in either the metadata XML file or guacamole.properties");
            samlMap.put(SettingsBuilder.SP_ENTITYID_PROPERTY_KEY, entityId.toString());
        }

        // Derive ACS URL from properties if not provided within metadata XML
        if (!samlMap.containsKey(SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_URL_PROPERTY_KEY)) {
            samlMap.put(SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_URL_PROPERTY_KEY,
                    UriBuilder.fromUri(getCallbackUrl()).path("api/ext/saml/callback").build().toString());
        }

        // If a private key file is set, load the value into the builder now
        File privateKeyFile = getPrivateKeyFile();
        if (privateKeyFile != null)
            samlMap.put(SettingsBuilder.SP_PRIVATEKEY_PROPERTY_KEY,
                    readFileContentsIntoString(privateKeyFile, "Private Key"));

        // If a certificate file is set, load the value into the builder now
        File certificateFile = getCertificateFile();
        if (certificateFile != null)
            samlMap.put(SettingsBuilder.SP_X509CERT_PROPERTY_KEY,
                    readFileContentsIntoString(certificateFile, "X.509 Certificate"));

        SettingsBuilder samlBuilder = new SettingsBuilder();
        Saml2Settings samlSettings = samlBuilder.fromValues(samlMap).build();
        samlSettings.setStrict(getStrict());
        samlSettings.setDebug(getDebug());
        samlSettings.setCompressRequest(getCompressRequest());
        samlSettings.setCompressResponse(getCompressResponse());

        // Request that the SAML library sign everything that it can, if
        // both private key and certificate are specified
        if (privateKeyFile != null && certificateFile != null) {
            samlSettings.setAuthnRequestsSigned(true);
            samlSettings.setLogoutRequestSigned(true);
            samlSettings.setLogoutResponseSigned(true);
        }

        return samlSettings;
    }


}
