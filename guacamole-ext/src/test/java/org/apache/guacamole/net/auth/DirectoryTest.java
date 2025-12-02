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

package org.apache.guacamole.net.auth;

import java.lang.reflect.Method;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import org.junit.Assert;
import org.junit.Test;

/**
 * Test that verifies the functionality provided by the Directory interface.
 */
public class DirectoryTest {

    /**
     * Returns a Collection of all classes that have associated Directories
     * available via the UserContext interface. The classes are retrieved
     * using reflection by enumerating the type parameters of the return types
     * of all functions that return a Directory.
     *
     * @return
     *     A Collection of all classes that have associated Directories
     *     available via the UserContext interface.
     */
    @SuppressWarnings("unchecked") // Verified via calls to isAssignableFrom()
    private Collection<Class<? extends Identifiable>> getDirectoryTypes() {

        Set<Class<? extends Identifiable>> types = new HashSet<>();

        Method[] methods = UserContext.class.getMethods();
        for (Method method : methods) {

            if (!Directory.class.isAssignableFrom(method.getReturnType()))
                continue;

            Type retType = method.getGenericReturnType();
            Assert.assertTrue("UserContext functions that return directories "
                    + "must have proper type parameters for the returned "
                    + "directory.", retType instanceof ParameterizedType);

            Type[] typeArgs = ((ParameterizedType) retType).getActualTypeArguments();
            Assert.assertEquals("UserContext functions that return directories "
                    + "must properly declare exactly one type argument for "
                    + "those directories.", 1, typeArgs.length);

            Class<?> directoryType = (Class<?>) typeArgs[0];
            Assert.assertTrue("Directories returned by UserContext functions "
                    + "must contain subclasses of Identifiable.",
                    Identifiable.class.isAssignableFrom(directoryType));

            types.add((Class<? extends Identifiable>) directoryType);

        }

        return Collections.unmodifiableSet(types);

    }

    /**
     * Verifies that Directory.Type covers the types of all directories exposed
     * by the UserContext interface.
     */
    @Test
    public void testTypeCoverage() {

        Collection<Class<? extends Identifiable>> types = getDirectoryTypes();

        Assert.assertEquals("Directory.Type must provide exactly one value "
                + "for each type of directory provideed by the UserContext "
                + "interface.", types.size(), Directory.Type.values().length);

        for (Class<? extends Identifiable> type : types) {

            Directory.Type dirType = Directory.Type.of(type);
            Assert.assertNotNull("of() must provide mappings for all directory "
                    + "types defined on the UserContext interface.", dirType);

            Assert.assertEquals("getObjectType() must return the same base "
                    + "superclass used by UserContext for all directory "
                    + "types defined on the UserContext interface.", type,
                    dirType.getObjectType());

        }

    }

    /**
     * Verifies that each type declared by Directory.Type exposes an
     * associated class via getObjectType() which then maps back to the same
     * type via Directory.Type.of().
     */
    @Test
    public void testTypeIdentity() {
        for (Directory.Type dirType : Directory.Type.values()) {
            Assert.assertEquals("For all defined directory types, "
                    + "Directory.Type.of(theType.getObjectType()) must "
                    + "correctly map back to theType.", dirType,
                    Directory.Type.of(dirType.getObjectType()));
        }
    }

}
