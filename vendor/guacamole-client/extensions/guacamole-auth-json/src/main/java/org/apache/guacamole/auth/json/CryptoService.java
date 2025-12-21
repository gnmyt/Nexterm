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

package org.apache.guacamole.auth.json;

import java.security.InvalidAlgorithmParameterException;
import java.security.InvalidKeyException;
import java.security.Key;
import java.security.NoSuchAlgorithmException;
import javax.crypto.BadPaddingException;
import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.Mac;
import javax.crypto.NoSuchPaddingException;
import javax.crypto.SecretKey;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;

/**
 * Service for handling cryptography-related operations, such as decrypting
 * encrypted data.
 */
public class CryptoService {

    /**
     * The length of all signatures, in bytes.
     */
    public static final int SIGNATURE_LENGTH = 32;

    /**
     * The name of the key generation algorithm used for decryption.
     */
    private static final String DECRYPTION_KEY_GENERATION_ALGORITHM_NAME = "AES";

    /**
     * The name of the cipher transformation that should be used to decrypt any
     * String provided to decrypt().
     */
    private static final String DECRYPTION_CIPHER_NAME = "AES/CBC/PKCS5Padding";

    /**
     * The name of the key generation algorithm used for verifying signatures.
     */
    private static final String SIGNATURE_KEY_GENERATION_ALGORITHM_NAME = "HmacSHA256";

    /**
     * The name of the MAC algorithm used for verifying signatures.
     */
    private static final String SIGNATURE_MAC_ALGORITHM_NAME = "HmacSHA256";

    /**
     * IV which is all null bytes (all binary zeroes). Usually, using a null IV
     * is a horrible idea. As our plaintext will always be prepended with the
     * HMAC signature of the rest of the message, we are effectively using the
     * HMAC signature itself as the IV. For our purposes, where the encrypted
     * value becomes an authentication token, this is OK.
     */
    private static final IvParameterSpec NULL_IV = new IvParameterSpec(new byte[] {
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0
    });

    /**
     * Creates a new key suitable for decryption using the provided raw key
     * bytes. The algorithm used to generate this key is dictated by
     * DECRYPTION_KEY_GENERATION_ALGORITHM_NAME and must match the algorithm
     * used by decrypt().
     *
     * @param keyBytes
     *     The raw bytes from which the encryption/decryption key should be
     *     generated.
     *
     * @return
     *     A new key suitable for encryption or decryption, generated from the
     *     given bytes.
     */
    public SecretKey createEncryptionKey(byte[] keyBytes) {
        return new SecretKeySpec(keyBytes, DECRYPTION_KEY_GENERATION_ALGORITHM_NAME);
    }

    /**
     * Creates a new key suitable for signature verification using the provided
     * raw key bytes. The algorithm used to generate this key is dictated by
     * SIGNATURE_KEY_GENERATION_ALGORITHM_NAME and must match the algorithm
     * used by sign().
     *
     * @param keyBytes
     *     The raw bytes from which the signature verification key should be
     *     generated.
     *
     * @return
     *     A new key suitable for signature verification, generated from the
     *     given bytes.
     */
    public SecretKey createSignatureKey(byte[] keyBytes) {
        return new SecretKeySpec(keyBytes, SIGNATURE_KEY_GENERATION_ALGORITHM_NAME);
    }

    /**
     * Decrypts the given ciphertext using the provided key, returning the
     * resulting plaintext. If any error occurs during decryption at all, a
     * GuacamoleException is thrown. The IV used for the decryption process is
     * a null IV (all binary zeroes).
     *
     * @param key
     *     The key to use to decrypt the provided ciphertext.
     *
     * @param cipherText
     *     The ciphertext to decrypt.
     *
     * @return
     *     The plaintext which results from decrypting the ciphertext with the
     *     provided key.
     *
     * @throws GuacamoleException
     *     If any error at all occurs during decryption.
     */
    public byte[] decrypt(Key key, byte[] cipherText) throws GuacamoleException {

        try {

            // Init cipher for descryption using secret key
            Cipher cipher = Cipher.getInstance(DECRYPTION_CIPHER_NAME);
            cipher.init(Cipher.DECRYPT_MODE, key, NULL_IV);

            // Perform decryption
            return cipher.doFinal(cipherText);

        }

        // Rethrow all decryption failures identically
        catch (InvalidAlgorithmParameterException
                | NoSuchAlgorithmException
                | NoSuchPaddingException
                | InvalidKeyException
                | IllegalBlockSizeException
                | BadPaddingException e) {
            throw new GuacamoleServerException(e);
        }

    }

    /**
     * Signs the given arbitrary data using the provided key, returning the
     * resulting signature. If any error occurs during signing at all, a
     * GuacamoleException is thrown.
     *
     * @param key
     *     The key to use to sign the provided data.
     *
     * @param data
     *     The arbitrary data to sign.
     *
     * @return
     *     The signature which results from signing the arbitrary data with the
     *     provided key.
     *
     * @throws GuacamoleException
     *     If any error at all occurs during signing.
     */
    public byte[] sign(Key key, byte[] data) throws GuacamoleException {

        try {

            // Init MAC for signing using secret key
            Mac mac = Mac.getInstance(SIGNATURE_MAC_ALGORITHM_NAME);
            mac.init(key);

            // Sign provided data
            return mac.doFinal(data);

        }

        // Rethrow all signature failures identically
        catch (NoSuchAlgorithmException | InvalidKeyException | IllegalStateException e) {
            throw new GuacamoleServerException(e);
        }

    }

}
