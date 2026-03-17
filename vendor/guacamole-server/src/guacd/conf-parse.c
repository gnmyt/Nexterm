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

#include "config.h"

#include "conf.h"
#include "conf-parse.h"

#include <guacamole/client.h>

#include <ctype.h>
#include <string.h>

/*
 * Simple recursive descent parser for an INI-like conf file grammar.  The
 * grammar is, roughly:
 *
 * <line>            ::= <opt-whitespace> <declaration> <line-end>
 * <line-end>        ::= <opt-whitespace> <opt-comment> <EOL>
 * <declaration>     ::= <section-name> | <parameter-value> | ""
 * <section-name>    ::= "[" <name> "]"
 * <parameter-value> ::= <name> <opt-whitespace> "=" <opt-whitespace> <value>
 *
 * Where:
 *  <opt-whitespace> is any number of tabs or spaces.
 *  <opt-comment> is a # character followed by any length of text without an EOL.
 *  <name> is an alpha-numeric string consisting of: [A-Za-z0-9_-].
 *  <value> is any length of text without an EOL or # character, or a double-quoted string (backslash escapes legal).
 *  <EOL> is a carriage return or line feed character.
 */

/**
 * The current section. Note that this means the parser is NOT threadsafe.
 */
char __guacd_current_section[GUACD_CONF_MAX_NAME_LENGTH + 1] = "";

char* guacd_conf_parse_error = NULL;

char* guacd_conf_parse_error_location = NULL;

/**
 * Reads through all whitespace at the beginning of the buffer, returning the
 * number of characters read. This is <opt-whitespace> in the grammar above. As
 * the whitespace is zero or more whitespace characters, this function cannot
 * fail, but it may read zero chars overall.
 */
static int guacd_parse_whitespace(char* buffer, int length) {

    int chars_read = 0;

    /* Read through all whitespace */
    while (chars_read < length) {

        /* Read character */
        char c = *buffer;

        /* Stop at non-whitespace */
        if (c != ' ' && c != '\t')
            break;

        chars_read++;
        buffer++;

    }

    return chars_read;

}

/**
 * Parses the name of a parameter, section, etc. A section/parameter name can
 * consist only of alphanumeric characters and underscores. The resulting name
 * will be stored in the name string, which must have at least 256 bytes
 * available.
 */
static int guacd_parse_name(char* buffer, int length, char* name) {

    char* name_start = buffer;
    int chars_read = 0;

    /* Read through all valid name chars */
    while (chars_read < length) {

        /* Read character */
        char c = *buffer;

        /* Stop at non-name characters */
        if (!isalnum(c) && c != '_')
            break;

        chars_read++;
        buffer++;

        /* Ensure name does not exceed maximum length */
        if (chars_read > GUACD_CONF_MAX_NAME_LENGTH) {
            guacd_conf_parse_error = "Names can be no more than 255 characters long";
            guacd_conf_parse_error_location = buffer;
            return -1;
        }

    }

    /* Names must contain at least one character */
    if (chars_read == 0)
        return 0;

    /* Copy name from buffer */
    memcpy(name, name_start, chars_read);
    name[chars_read] = '\0';

    return chars_read;

}

/**
 * Parses the value of a parameter. A value can consist of any character except
 * '#', whitespace, or EOL. The resulting value will be stored in the value
 * string, which must have at least 256 bytes available.
 */ 
static int guacd_parse_value(char* buffer, int length, char* value) {

    char* value_start = buffer;
    int chars_read = 0;

    /* Read through all valid value chars */
    while (chars_read < length) {

        /* Read character */
        char c = *buffer;

        /* Stop at invalid character */
        if (c == '#' || c == '"' || c == '\r' || c == '\n' || c == ' ' || c == '\t')
            break;

        chars_read++;
        buffer++;

        /* Ensure value does not exceed maximum length */
        if (chars_read > GUACD_CONF_MAX_VALUE_LENGTH) {
            guacd_conf_parse_error = "Values can be no more than 8191 characters long";
            guacd_conf_parse_error_location = buffer;
            return -1;
        }

    }

    /* Values must contain at least one character */
    if (chars_read == 0) {
        guacd_conf_parse_error = "Unquoted values must contain at least one character";
        guacd_conf_parse_error_location = buffer;
        return -1;
    }

    /* Copy value from buffer */
    memcpy(value, value_start, chars_read);
    value[chars_read] = '\0';

    return chars_read;

}

/**
 * Parses the quoted value of a parameter. Quoted values may contain any
 * character except double quotes or backslashes, which must be
 * backslash-escaped.
 */ 
static int guacd_parse_quoted_value(char* buffer, int length, char* value) {

    int escaped = 0;

    /* Assert first character is '"' */
    if (length == 0 || *buffer != '"')
        return 0;

    int chars_read = 1;
    buffer++;
    length--;

    /* Read until end of quoted value */
    while (chars_read < length) {

        /* Read character */
        char c = *buffer;

        /* Handle special characters if not escaped */
        if (!escaped) {

            /* Stop at quote or invalid character */
            if (c == '"' || c == '\r' || c == '\n')
                break;

            /* Backslash escaping */
            else if (c == '\\')
                escaped = 1;

            else
                *(value++) = c;

        }

        /* Reset escape flag */
        else {
            escaped = 0;
            *(value++) = c;
        }

        chars_read++;
        buffer++;

        /* Ensure value does not exceed maximum length */
        if (chars_read > GUACD_CONF_MAX_VALUE_LENGTH) {
            guacd_conf_parse_error = "Values can be no more than 8191 characters long";
            guacd_conf_parse_error_location = buffer;
            return -1;
        }

    }

    /* Assert value ends with '"' */
    if (length == 0 || *buffer != '"') {
        guacd_conf_parse_error = "'\"' expected";
        guacd_conf_parse_error_location = buffer;
        return -1;
    }

    chars_read++;

    /* Terminate read value */
    *value = '\0';

    return chars_read;

}

/**
 * Reads a parameter/value pair, separated by an '=' character. If the
 * parameter/value pair is invalid for any reason, a negative value is
 * returned.
 */
static int guacd_parse_parameter(guacd_param_callback* callback, char* buffer, int length, void* data) {

    char param_name[GUACD_CONF_MAX_NAME_LENGTH + 1];
    char param_value[GUACD_CONF_MAX_VALUE_LENGTH + 1];

    int retval;
    int chars_read = 0;

    char* param_start = buffer;

    retval = guacd_parse_name(buffer, length, param_name);
    if (retval < 0)
        return -1;

    /* If no name found, no parameter/value pair */
    if (retval == 0)
        return 0;

    /* Validate presence of section header */
    if (__guacd_current_section[0] == '\0') {
        guacd_conf_parse_error = "Parameters must have a corresponding section";
        guacd_conf_parse_error_location = buffer;
        return -1;
    }

    chars_read += retval;
    buffer += retval;
    length -= retval;

    /* Optional whitespace before '=' */
    retval = guacd_parse_whitespace(buffer, length);
    chars_read += retval;
    buffer += retval;
    length -= retval;

    /* Required '=' */
    if (length == 0 || *buffer != '=') {
        guacd_conf_parse_error = "'=' expected";
        guacd_conf_parse_error_location = buffer;
        return -1;
    }

    chars_read++;
    buffer++;
    length--;

    /* Optional whitespace before value */
    retval = guacd_parse_whitespace(buffer, length);
    chars_read += retval;
    buffer += retval;
    length -= retval;

    /* Quoted parameter value */
    retval = guacd_parse_quoted_value(buffer, length, param_value);
    if (retval < 0)
        return -1;

    /* Non-quoted parameter value (required if no quoted value given) */
    if (retval == 0) retval = guacd_parse_value(buffer, length, param_value);
    if (retval < 0)
        return -1;
    
    chars_read += retval;

    /* Call callback, handling error code */
    if (callback(__guacd_current_section, param_name, param_value, data)) {
        guacd_conf_parse_error_location = param_start;
        return -1;
    }

    return chars_read;

}

/**
 * Reads a section name from the beginning of the given buffer. This section
 * name must conform to the grammar definition. If the section name does not
 * match, a negative value is returned.
 */
static int guacd_parse_section(char* buffer, int length) {

    int retval;

    /* Assert first character is '[' */
    if (length == 0 || *buffer != '[')
        return 0;

    int chars_read = 1;
    buffer++;
    length--;

    retval = guacd_parse_name(buffer, length, __guacd_current_section);
    if (retval < 0)
        return -1;

    /* If no name found, invalid section */
    if (retval == 0) {
        guacd_conf_parse_error = "Section names must contain at least one character";
        guacd_conf_parse_error_location = buffer;
        return -1;
    }

    chars_read += retval;
    buffer += retval;
    length -= retval;

    /* Name must end with ']' */
    if (length == 0 || *buffer != ']') {
        guacd_conf_parse_error = "']' expected";
        guacd_conf_parse_error_location = buffer;
        return -1;
    }

    chars_read++;
    
    return chars_read;

}

/**
 * Parses a declaration, which may be either a section name or a
 * parameter/value pair. The empty string is acceptable, as well, as a
 * "null declaration".
 */
static int guacd_parse_declaration(guacd_param_callback* callback, char* buffer, int length, void* data) {

    int retval;

    /* Look for section name */
    retval = guacd_parse_section(buffer, length);
    if (retval != 0)
        return retval;

    /* Lacking a section name, read parameter/value pair */
    retval = guacd_parse_parameter(callback, buffer, length, data);
    if (retval != 0)
        return retval;

    /* Null declaration (default) */
    return 0;

}

/**
 * Parses a comment, which must start with a '#' character, and terminate with
 * an end-of-line character. If no EOL is found, or the first character is not
 * a '#', a negative value is returned. Otherwise, the number of characters
 * parsed is returned. If no comment is present, zero is returned.
 */
static int guacd_parse_comment(char* buffer, int length) {

    /* Need at least one character */
    if (length == 0)
        return 0;

    /* Assert first character is '#' */
    if (*(buffer++) != '#')
        return 0;

    int chars_read = 1;

    /* Advance to first non-space character */
    while (chars_read < length) {

        /* Read character */
        char c = *buffer;

        /* End of comment found at end of line */
        if (c == '\n' || c == '\r')
            return chars_read;

        chars_read++;
        buffer++;

    }

    /* No end of line in comment */
    guacd_conf_parse_error = "expected end-of-line";
    guacd_conf_parse_error_location = buffer;
    return -1;

}

/**
 * Parses the end of a line, which may contain a comment. If a parse error
 * occurs, a negative value is returned. Otherwise, the number of characters
 * parsed is returned.
 */
static int guacd_parse_line_end(char* buffer, int length) {

    int chars_read = 0;
    int retval;
  
    /* Initial optional whitespace */ 
    retval = guacd_parse_whitespace(buffer, length);
    chars_read += retval;
    buffer += retval;
    length -= retval;

    /* Optional comment */ 
    retval = guacd_parse_comment(buffer, length);
    if (retval < 0)
        return -1;

    chars_read += retval;
    buffer += retval;
    length -= retval;

    /* Assert EOL */
    if (length == 0 || (*buffer != '\r' && *buffer != '\n')) {
        guacd_conf_parse_error = "expected end-of-line";
        guacd_conf_parse_error_location = buffer;
        return -1;
    }

    chars_read++;

    /* Line is valid */
    return chars_read;

}

/**
 * Parses an entire line - declaration, comment, and all. If a parse error
 * occurs, a negative value is returned. Otherwise, the number of characters
 * parsed is returned.
 */
static int guacd_parse_line(guacd_param_callback* callback, char* buffer, int length, void* data) {

    int chars_read = 0;
    int retval;
  
    /* Initial optional whitespace */ 
    retval = guacd_parse_whitespace(buffer, length);
    chars_read += retval;
    buffer += retval;
    length -= retval;

    /* Declaration (which may be the empty string) */
    retval = guacd_parse_declaration(callback, buffer, length, data);
    if (retval < 0)
        return retval;

    chars_read += retval;
    buffer += retval;
    length -= retval;

    /* End of line */
    retval = guacd_parse_line_end(buffer, length);
    if (retval < 0)
        return retval;

    chars_read += retval;

    return chars_read;

}

int guacd_parse_conf(guacd_param_callback* callback, char* buffer, int length, void* data) {

    /* Empty buffers are valid */
    if (length == 0)
        return 0;

    return guacd_parse_line(callback, buffer, length, data);

}

int guacd_parse_log_level(const char* name) {

    /* Translate log level name */
    if (strcmp(name, "info")    == 0) return GUAC_LOG_INFO;
    if (strcmp(name, "error")   == 0) return GUAC_LOG_ERROR;
    if (strcmp(name, "warning") == 0) return GUAC_LOG_WARNING;
    if (strcmp(name, "debug")   == 0) return GUAC_LOG_DEBUG;
    if (strcmp(name, "trace")   == 0) return GUAC_LOG_TRACE;

    /* No such log level */
    return -1;

}

