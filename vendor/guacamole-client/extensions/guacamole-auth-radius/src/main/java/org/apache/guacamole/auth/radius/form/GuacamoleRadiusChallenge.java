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

package org.apache.guacamole.auth.radius.form;

import org.apache.guacamole.net.auth.credentials.CredentialsInfo;

/**
 * Stores the RADIUS challenge message and expected credentials in a single
 * object.
 */
public class GuacamoleRadiusChallenge {
    
    /**
     * The challenge text sent by the RADIUS server.
     */
    private final String challengeText;
    
    /**
     * The expected credentials that need to be provided to satisfy the
     * RADIUS authentication challenge.
     */
    private final CredentialsInfo expectedCredentials;
    
    /**
     * Creates a new GuacamoleRadiusChallenge object with the provided
     * challenge message and expected credentials.
     * 
     * @param challengeText
     *     The challenge message sent by the RADIUS server.
     * 
     * @param expectedCredentials 
     *     The credentials required to complete the challenge.
     */
    public GuacamoleRadiusChallenge(String challengeText,
            CredentialsInfo expectedCredentials) {
        this.challengeText = challengeText;
        this.expectedCredentials = expectedCredentials;
    }
    
    /**
     * Returns the challenge message provided by the RADIUS server.
     * 
     * @return
     *     The challenge message provided by the RADIUS server.
     */
    public String getChallengeText() {
        return challengeText;
    }
    
    /**
     * Returns the credentials required to satisfy the RADIUS challenge.
     * 
     * @return 
     *     The credentials required to satisfy the RADIUS challenge.
     */
    public CredentialsInfo getExpectedCredentials() {
        return expectedCredentials;
    }
    
}
