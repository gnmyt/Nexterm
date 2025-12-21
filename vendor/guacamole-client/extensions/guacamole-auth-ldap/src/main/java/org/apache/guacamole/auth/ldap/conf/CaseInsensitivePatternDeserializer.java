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

package org.apache.guacamole.auth.ldap.conf;

import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdScalarDeserializer;
import com.fasterxml.jackson.databind.type.LogicalType;
import java.io.IOException;
import java.io.Serializable;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/**
 * Custom JSON (or YAML) deserializer for Jackson that deserializes string
 * values as Patterns with the case insensitive flag set by default. Jackson
 * will actually handle deserialization of Patterns automatically, but does not
 * provide for setting the default flags.
 */
public class CaseInsensitivePatternDeserializer extends StdScalarDeserializer<Pattern> {

    /**
     * Unique version identifier of this {@link Serializable} class.
     */
    private static final long serialVersionUID = 1L;

    /**
     * Creates a new CaseInsensitivePatternDeserializer which deserializes
     * string values to Pattern objects with the case insensitive flag set.
     */
    public CaseInsensitivePatternDeserializer() {
        super(Pattern.class);
    }

    @Override
    public LogicalType logicalType() {
        return LogicalType.Textual;
    }

    @Override
    public boolean isCachable() {
        return true;
    }

    @Override
    public Pattern deserialize(JsonParser parser, DeserializationContext context)
            throws IOException, JsonProcessingException {

        if (!parser.hasToken(JsonToken.VALUE_STRING))
            throw new JsonParseException(parser, "Regular expressions may only be represented as strings.");

        try {
            return Pattern.compile(parser.getText(), Pattern.CASE_INSENSITIVE);
        }
        catch (PatternSyntaxException e) {
            throw new JsonParseException(parser, "Invalid regular expression.", e);
        }

    }

}
