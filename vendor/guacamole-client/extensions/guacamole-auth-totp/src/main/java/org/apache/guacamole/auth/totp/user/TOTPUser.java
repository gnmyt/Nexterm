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

package org.apache.guacamole.auth.totp.user;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import org.apache.guacamole.form.BooleanField;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.net.auth.DelegatingUser;
import org.apache.guacamole.net.auth.User;

/**
 * TOTP-specific User implementation which wraps a User from another extension,
 * hiding and blocking access to the core attributes used by TOTP.
 */
public class TOTPUser extends DelegatingUser {

    /**
     * The name of the user attribute which disables the TOTP requirement
     * for that specific user.
     */
    public static final String TOTP_KEY_DISABLED_ATTRIBUTE_NAME = "guac-totp-disabled";
    
    /**
     * The name of the user attribute which stores the TOTP key.
     */
    public static final String TOTP_KEY_SECRET_ATTRIBUTE_NAME = "guac-totp-key-secret";

    /**
     * The name of the user attribute defines whether the TOTP key has been
     * confirmed by the user, and the user is thus fully enrolled.
     */
    public static final String TOTP_KEY_CONFIRMED_ATTRIBUTE_NAME = "guac-totp-key-confirmed";
    
    /**
     * The name of the user attribute defines whether the TOTP key has been
     * generated for the user, regardless of whether that key has been
     * confirmed. This attribute is not stored, but is instead exposed
     * dynamically in lieu of exposing the actual TOTP key.
     */
    public static final String TOTP_KEY_SECRET_GENERATED_ATTRIBUTE_NAME = "guac-totp-key-generated";

    /**
     * The string value used by TOTP user attributes to represent the boolean
     * value "true".
     */
    public static final String TRUTH_VALUE = "true";

    /**
     * The form which contains all configurable properties for this user.
     */
    public static final Form TOTP_ENROLLMENT_STATUS = new Form("totp-enrollment-status",
            Arrays.asList(
                    new BooleanField(TOTP_KEY_DISABLED_ATTRIBUTE_NAME, TRUTH_VALUE),
                    new BooleanField(TOTP_KEY_SECRET_GENERATED_ATTRIBUTE_NAME, TRUTH_VALUE),
                    new BooleanField(TOTP_KEY_CONFIRMED_ATTRIBUTE_NAME, TRUTH_VALUE)
            )
    );
    
    
    /**
     * Wraps the given User object, hiding and blocking access to the core
     * attributes used by TOTP.
     *
     * @param user
     *     The User object to wrap.
     */
    public TOTPUser(User user) {
        super(user);
    }

    /**
     * Returns the User object wrapped by this TOTPUser.
     *
     * @return
     *     The wrapped User object.
     */
    public User getUndecorated() {
        return getDelegateUser();
    }

    @Override
    public Map<String, String> getAttributes() {

        // Create independent, mutable copy of attributes
        Map<String, String> attributes = new HashMap<>(super.getAttributes());
        
        if (!attributes.containsKey(TOTP_KEY_DISABLED_ATTRIBUTE_NAME))
            attributes.put(TOTP_KEY_DISABLED_ATTRIBUTE_NAME, null);

        // Replace secret key with simple boolean attribute representing
        // whether a key has been generated at all
        String secret = attributes.remove(TOTP_KEY_SECRET_ATTRIBUTE_NAME);
        if (secret != null && !secret.isEmpty())
            attributes.put(TOTP_KEY_SECRET_GENERATED_ATTRIBUTE_NAME, TRUTH_VALUE);

        return attributes;

    }

    @Override
    public void setAttributes(Map<String, String> attributes) {

        // Create independent, mutable copy of attributes
        attributes = new HashMap<>(attributes);

        // Do not allow TOTP secret to be directly manipulated
        attributes.remove(TOTP_KEY_SECRET_ATTRIBUTE_NAME);

        // Reset TOTP status entirely if requested
        String generated = attributes.remove(TOTP_KEY_SECRET_GENERATED_ATTRIBUTE_NAME);
        if (generated != null && !generated.equals(TRUTH_VALUE)) {
            attributes.put(TOTP_KEY_SECRET_ATTRIBUTE_NAME, null);
            attributes.put(TOTP_KEY_CONFIRMED_ATTRIBUTE_NAME, null);
        }

        super.setAttributes(attributes);

    }

}
