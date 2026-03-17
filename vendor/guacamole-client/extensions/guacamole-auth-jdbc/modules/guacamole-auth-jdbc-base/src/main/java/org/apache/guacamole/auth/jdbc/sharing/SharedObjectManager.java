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

package org.apache.guacamole.auth.jdbc.sharing;

import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Provides thread-safe registration and cleanup of a growing set of objects.
 * Each SharedObjectManager can track arbitrarily-many objects, each registered
 * with the register() function. A SharedObjectManager tracks objects until it
 * is invalidated, after which all registered objects are cleaned up. Attempts
 * to register new objects after the SharedObjectManager has been invalidated
 * will cause the provided object to be immediately cleaned up.
 *
 * @param <T>
 *     The type of object managed by this SharedObjectManager.
 */
public abstract class SharedObjectManager<T> {

    /**
     * Whether this SharedObjectManager has been invalidated.
     */
    private final AtomicBoolean invalidated = new AtomicBoolean(false);

    /**
     * The collection of all objects being tracked by this SharedObjectManager.
     */
    private final Queue<T> objects = new ConcurrentLinkedQueue<T>();

    /**
     * Cleans up the given object. This function is invoked exactly once on all
     * tracked objects after invalidate() is called, and exactly once for any
     * call to register() which occurs after invalidate() was called.
     *
     * @param object
     *     The object to cleanup.
     */
    protected abstract void cleanup(T object);

    /**
     * Invokes the cleanup() function on all tracked objects, removing each
     * object from the underlying collection. It is guaranteed that cleanup()
     * will be invoked only once for each object, even if multiple calls to
     * cleanupAll() are running concurrently, and that the underlying collection
     * will be empty after all calls to cleanupAll() complete.
     */
    private void cleanupAll() {

        T current;

        // Remove all objects from underlying collection, cleaning up each
        // object individually
        while ((current = objects.poll()) != null)
            cleanup(current);

    }

    /**
     * Registers the given object with this SharedObjectManager such that it is
     * cleaned up once the SharedObjectManager is invalidated. If the
     * SharedObjectManager has already been invalidated, the object will be
     * cleaned up immediately.
     *
     * @param object
     *     The object to register with this SharedObjectManager.
     */
    public void register(T object) {

        // If already invalidated (or invalidation is in progress), avoid adding
        // the object unnecessarily - just cleanup now
        if (invalidated.get()) {
            cleanup(object);
            return;
        }

        // Store provided object
        objects.add(object);

        // If collection was invalidated while object was being added, recheck
        // the underlying collection and cleanup
        if (invalidated.get())
            cleanupAll();

    }

    /**
     * Invalidates this SharedObjectManager, cleaning up any registered objects
     * and preventing future registration of objects. If attempts to register
     * objects are made after this function is invoked, those objects will be
     * immediately cleaned up.
     */
    public void invalidate() {

        // Mark collection as invalidated, but do not bother cleaning up if
        // already invalidated
        if (!invalidated.compareAndSet(false, true))
            return;

        // Clean up all stored objects
        cleanupAll();

    }

}
