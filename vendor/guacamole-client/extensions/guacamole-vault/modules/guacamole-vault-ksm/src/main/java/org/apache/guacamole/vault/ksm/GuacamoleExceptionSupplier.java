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

package org.apache.guacamole.vault.ksm;

import org.apache.guacamole.GuacamoleException;

/**
 * A class that is basically equivalent to the standard Supplier class in
 * Java, except that the get() function can throw GuacamoleException, which
 * is impossible with any of the standard Java lambda type classes, since
 * none of them can handle checked exceptions
 *
 * @param <T>
 *     The type of object which will be returned as a result of calling
 *     get().
 */
public interface GuacamoleExceptionSupplier<T> {

    /**
     * Returns a value of the declared type.
     *
     * @return
     *    A value of the declared type.
     *
     * @throws GuacamoleException
     *    If an error occurs while attemping to calculate the return value.
     */
    public T get() throws GuacamoleException;

}