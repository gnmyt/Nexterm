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
package org.apache.guacamole.auth.totp.usergroup;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import org.apache.guacamole.form.BooleanField;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.net.auth.DelegatingUserGroup;
import org.apache.guacamole.net.auth.UserGroup;

/**
 * A UserGroup that wraps another UserGroup implementation, decorating it with
 * attributes that control TOTP configuration for users that are members of that
 * group.
 */
public class TOTPUserGroup extends DelegatingUserGroup {
    
    /**
     * The attribute associated with a group that disables the TOTP requirement
     * for any users that are a member of that group, or are members of any
     * groups that are members of this group.
     */
    public static final String TOTP_KEY_DISABLED_ATTRIBUTE_NAME = "guac-totp-disabled";
    
    /**
     * The string value used by TOTP user attributes to represent the boolean
     * value "true".
     */
    public static final String TRUTH_VALUE = "true";
    
    /**
     * The form that contains fields for configuring TOTP for members of this
     * group.
     */
    public static final Form TOTP_USER_GROUP_CONFIG = new Form("totp-user-group-config",
            Arrays.asList(
                    new BooleanField(TOTP_KEY_DISABLED_ATTRIBUTE_NAME, TRUTH_VALUE)
            )
    );
    
    /**
     * Create a new instance of this user group implementation, wrapping the
     * provided UserGroup.
     * 
     * @param userGroup 
     *     The UserGroup to be wrapped.
     */
    public TOTPUserGroup(UserGroup userGroup) {
        super(userGroup);
    }
    
    /**
     * Return the original UserGroup that this implementation is wrapping.
     * 
     * @return 
     *     The original UserGroup that this implementation wraps.
     */
    public UserGroup getUndecorated() {
        return getDelegateUserGroupGroup();
    }
    
    /**
     * Returns whether or not TOTP has been disabled for members of this group.
     * 
     * @return 
     *     True if TOTP has been disabled for members of this group, otherwise
     *     false.
     */
    public boolean totpDisabled() {
        return (TRUTH_VALUE.equals(getAttributes().get(TOTP_KEY_DISABLED_ATTRIBUTE_NAME)));
    }
    
    @Override
    public Map<String, String> getAttributes() {
        
        // Create a mutable copy of the attributes
        Map<String, String> attributes = new HashMap<>(super.getAttributes());
        
        if (!attributes.containsKey(TOTP_KEY_DISABLED_ATTRIBUTE_NAME))
            attributes.put(TOTP_KEY_DISABLED_ATTRIBUTE_NAME, null);
        
        return attributes;
        
    }
    
}
