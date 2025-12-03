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

package org.apache.guacamole.token;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Filtering object which replaces tokens of the form "${TOKEN_NAME}" with
 * their corresponding values. Unknown tokens are not replaced. If TOKEN_NAME
 * is a valid token, the literal value "${TOKEN_NAME}" can be included by using
 * "$${TOKEN_NAME}".
 */
public class TokenFilter {

    /**
     * Regular expression which matches individual tokens, with additional
     * capturing groups for convenient retrieval of leading text, the possible
     * escape character preceding the token, the name of the token, and the
     * entire token itself.
     */
    private final Pattern tokenPattern = Pattern.compile("(.*?)(^|.)(\\$\\{([A-Za-z0-9_]*)(\\:(.*))?\\})");

    /**
     * The index of the capturing group within tokenPattern which matches
     * non-token text preceding a possible token.
     */
    private static final int LEADING_TEXT_GROUP = 1;

    /**
     * The index of the capturing group within tokenPattern which matches the
     * character immediately preceding a possible token, possibly denoting that
     * the token should instead be interpreted as a literal.
     */
    private static final int ESCAPE_CHAR_GROUP = 2;

    /**
     * The index of the capturing group within tokenPattern which matches the
     * entire token, including the leading "${" and terminating "}" strings.
     */
    private static final int TOKEN_GROUP = 3;

    /**
     * The index of the capturing group within tokenPattern which matches only
     * the token name contained within the "${" and "}" strings.
     */
    private static final int TOKEN_NAME_GROUP = 4;
    
    /**
     * The index of the capturing group within tokenPattern which matches the
     * string of the actual modifier for the token.
     */
    private static final int TOKEN_MODIFIER = 6;
    
    /**
     * The values of all known tokens.
     */
    private final Map<String, String> tokenValues;

    /**
     * Creates a new TokenFilter which has no associated tokens. Tokens must
     * later be given using {@link #setToken(java.lang.String, java.lang.String)}
     * or {@link #setTokens(java.util.Map)}.
     */
    public TokenFilter() {
         this(Collections.<String, String>emptyMap());
    }

    /**
     * Creates a new TokenFilter which is initialized with the given token
     * name/value pairs.
     *
     * @param tokenValues
     *     A map containing token names and their corresponding values.
     */
    public TokenFilter(Map<String, String> tokenValues) {
        this.tokenValues = new HashMap<>(tokenValues);
    }

    /**
     * Sets the token having the given name to the given value. Any existing
     * value for that token is replaced.
     *
     * @param name
     *     The name of the token to set.
     *
     * @param value
     *     The value to set the token to.
     */
    public void setToken(String name, String value) {
        tokenValues.put(name, value);
    }

    /**
     * Returns the value of the token with the given name, or null if no such
     * token has been set.
     *
     * @param name
     *     The name of the token to return.
     * 
     * @return
     *     The value of the token with the given name, or null if no such
     *     token exists.
     */
    public String getToken(String name) {
        return tokenValues.get(name);
    }

    /**
     * Removes the value of the token with the given name. If no such token
     * exists, this function has no effect.
     *
     * @param name
     *     The name of the token whose value should be removed.
     */
    public void unsetToken(String name) {
        tokenValues.remove(name);
    }

    /**
     * Returns a map of all tokens, with each key being a token name, and each
     * value being the corresponding token value. Changes to this map will
     * directly affect the tokens associated with this filter.
     *
     * @return
     *     A map of all token names and their corresponding values.
     */
    public Map<String, String> getTokens() {
        return tokenValues;
    }

    /**
     * Replaces all current token values with the contents of the given map,
     * where each map key represents a token name, and each map value
     * represents a token value.
     *
     * @param tokens
     *     A map containing the token names and corresponding values to
     *     assign.
     */
    public void setTokens(Map<String, String> tokens) {
        tokenValues.clear();
        tokenValues.putAll(tokens);
    }

    /**
     * Filters the given string, replacing any tokens with their corresponding
     * values. Handling of undefined tokens depends on the value given for the
     * strict flag.
     *
     * @param input
     *     The string to filter.
     *
     * @param strict
     *     Whether to disallow tokens which lack values from existing in the
     *     string. If true, an exception will be thrown if any tokens in the
     *     string lack corresponding values. If false, tokens which lack values
     *     will be interpreted as literals.
     *
     * @return
     *     A copy of the input string, with any tokens replaced with their
     *     corresponding values.
     *
     * @throws GuacamoleTokenUndefinedException
     *     If the strict flag is set to true and at least one token in the
     *     given string has no corresponding value.
     */
    private String filter(String input, boolean strict)
            throws GuacamoleTokenUndefinedException {

        StringBuilder output = new StringBuilder();
        Matcher tokenMatcher = tokenPattern.matcher(input);

        // Track last regex match
        int endOfLastMatch = 0;

        // For each possible token
        while (tokenMatcher.find()) {

            // Pull possible leading text and first char before possible token
            String literal = tokenMatcher.group(LEADING_TEXT_GROUP);
            String escape = tokenMatcher.group(ESCAPE_CHAR_GROUP);
            String modifier = tokenMatcher.group(TOKEN_MODIFIER);

            // Append leading non-token text
            output.append(literal);

            // If char before token is '$', the token itself is escaped
            if ("$".equals(escape)) {
                String notToken = tokenMatcher.group(TOKEN_GROUP);
                output.append(notToken);
            }

            // If char is not '$', interpret as a token
            else {

                // The char before the token, if any, is a literal
                output.append(escape);

                // Pull token value
                String tokenName = tokenMatcher.group(TOKEN_NAME_GROUP);
                String tokenValue = getToken(tokenName);

                // If token is unknown, interpretation depends on whether
                // strict mode is enabled
                if (tokenValue == null) {

                    // Fail outright if strict mode is enabled
                    if (strict)
                        throw new GuacamoleTokenUndefinedException("Token "
                                + "has no defined value.", tokenName);

                    // If strict mode is NOT enabled, simply interpret as
                    // a literal
                    String notToken = tokenMatcher.group(TOKEN_GROUP);
                    output.append(notToken);

                }

                // Otherwise, check for modifiers and substitute value appropriately
                else {
                    
                    // If a modifier is present, try to use it.
                    if (modifier != null && !modifier.isEmpty()) {
                        switch (modifier) {
                            // Switch token to upper-case
                            case "UPPER":
                                output.append(tokenValue.toUpperCase());
                                break;
                                
                            // Switch token to lower case
                            case "LOWER":
                                output.append(tokenValue.toLowerCase());
                                break;
                                
                            // Just append the token value
                            default:
                                output.append(tokenValue);
                        }
                    }
                    
                    // No modifier present, so just append token value.
                    else
                        output.append(tokenValue);
                    
                }

            }

            // Update last regex match
            endOfLastMatch = tokenMatcher.end();

        }

        // Append any remaining non-token text
        output.append(input.substring(endOfLastMatch));

        return output.toString();

    }

    /**
     * Filters the given string, replacing any tokens with their corresponding
     * values. Any tokens present in the given string which lack values will
     * be interpreted as literals.
     *
     * @param input
     *     The string to filter.
     *
     * @return
     *     A copy of the input string, with any tokens replaced with their
     *     corresponding values.
     */
    public String filter(String input) {

        // Filter with strict mode disabled (should always succeed)
        try {
            return filter(input, false);
        }

        // GuacamoleTokenUndefinedException cannot be thrown when strict mode
        // is disabled
        catch (GuacamoleTokenUndefinedException e) {
            throw new IllegalStateException("filter() threw "
                    + "GuacamoleTokenUndefinedException despite strict mode "
                    + "being disabled.");
        }

    }

    /**
     * Filters the given string, replacing any tokens with their corresponding
     * values. If any token in the given string has no defined value within
     * this TokenFilter, a GuacamoleTokenUndefinedException will be thrown.
     *
     * @param input
     *     The string to filter.
     *
     * @return
     *     A copy of the input string, with any tokens replaced with their
     *     corresponding values.
     *
     * @throws GuacamoleTokenUndefinedException
     *     If at least one token in the given string has no corresponding
     *     value.
     */
    public String filterStrict(String input)
            throws GuacamoleTokenUndefinedException {
        return filter(input, true);
    }

    /**
     * Given an arbitrary map containing String values, replace each non-null
     * value with the corresponding filtered value. Any tokens present in the
     * values of the given map which lack defined values within this
     * TokenFilter will be interpreted as literals.
     *
     * @param map
     *     The map whose values should be filtered.
     */
    public void filterValues(Map<?, String> map) {

        // For each map entry
        for (Map.Entry<?, String> entry : map.entrySet()) {

            // If value is non-null, filter value through this TokenFilter
            String value = entry.getValue();
            if (value != null)
                entry.setValue(filter(value));

        }

    }

    /**
     * Given an arbitrary map containing String values, replace each non-null
     * value with the corresponding filtered value. If any token in any string
     * has no defined value within this TokenFilter, a
     * GuacamoleTokenUndefinedException will be thrown.
     *
     * @param map
     *     The map whose values should be filtered.
     *
     * @throws GuacamoleTokenUndefinedException
     *     If at least one token in at least one string has no corresponding
     *     value.
     */
    public void filterValuesStrict(Map<?, String> map)
            throws GuacamoleTokenUndefinedException {

        // For each map entry
        for (Map.Entry<?, String> entry : map.entrySet()) {

            // If value is non-null, filter value through this TokenFilter
            String value = entry.getValue();
            if (value != null)
                entry.setValue(filterStrict(value));
            
        }
        
    }

}
