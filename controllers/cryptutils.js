const crypto = require('crypto');
require("dotenv").config();

const algorithm = 'chacha20-poly1305';
const secretKey = Buffer.from(process.env.CRYPT_KEY, 'hex'); // Store securely in .env

if (secretKey.length !== 32) {
    throw new Error("Invalid secret key length. Must be 32 bytes.");
}

// Encrypt function
function encrypt(text) {
    const iv = crypto.randomBytes(12); // ChaCha20 requires a 12-byte IV
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv, { authTagLength: 16 });

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

// Decrypt function
function decrypt(combined) {
    try {
        const [iv, encrypted, authTag] = combined.split(':');
        const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(iv, 'hex'), { authTagLength: 16 });

        decipher.setAuthTag(Buffer.from(authTag, 'hex'));

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error);
        return null;
    }
}

module.exports = { encrypt, decrypt };


// 🔐 How It Works:
//  Encrypt Function:
//       Generates a random IV (nonce).
//       Encrypts the text using the secret key and IV.
//       Creates an authentication tag (to prevent tampering).
//       Returns the IV, encrypted text, and auth tag as a combined string.
//       Example: "iv:encryptedText:authTag"
//       (e.g., "1234567890abcdef:encryptedText:authTag")
//       - IV: 12 bytes
//       - Encrypted Text: Variable length
//  Decrypt Function:
//        Splits the IV, encrypted text, and auth tag.
//        Uses the same secret key to decrypt the text.
//        Verifies authenticity using the auth tag.
//        Returns the original text (or null if decryption fails).
//  Example Usage:
//          const { encrypt, decrypt } = require('./cryptutils');
//          const encrypted = encrypt('Hello, World!');
//          console.log('Encrypted:', encrypted);
//          const decrypted = decrypt(encrypted);
//          console.log('Decrypted:', decrypted);
//  // Output:
//          // Encrypted: iv:encryptedText:authTag
//         // Decrypted: Hello, World!
//   Example Output:
//           Encrypted: 1234567890abcdef:encryptedText:authTag
//           Decrypted: Hello, World!
//  Example:
//          Encrypted: 1234567890abcdef:encryptedText:authTag
//          Decrypted: Hello, World!

// 🛡 Why Use It?
//       Secure 🔒 (Prevents data tampering)
//       Fast ⚡ (Better than AES on low-power devices)
//       Authentication Built-in ✅ (Detects unauthorized changes)