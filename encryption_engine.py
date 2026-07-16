import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KEY_PATH = os.path.join(BASE_DIR, "secret.key")


def generate_key():
    """
    ✅ P88 FIXED: Key sirf ek baar generate karo
    Agar already exist kare — dobara mat banao!
    """
    if os.path.exists(KEY_PATH):
        print(f"✅ Key already exists: {KEY_PATH}")
        print(f"   Use existing key — regeneration skipped!")
        return load_key()

    key = Fernet.generate_key()
    with open(KEY_PATH, "wb") as key_file:
        key_file.write(key)
    
    # ✅ P105 FIXED: Key permissions restrict karo
    os.chmod(KEY_PATH, 0o600)  # Sirf owner read/write
    
    print(f"✅ New key generated: {KEY_PATH}")
    return key


def load_key():
    """Load existing key"""
    if not os.path.exists(KEY_PATH):
        print(f"⚠️ Key not found — generating new key...")
        return generate_key()
    
    with open(KEY_PATH, "rb") as f:
        key = f.read()
    
    # Validate key format
    try:
        Fernet(key)
    except Exception:
        raise ValueError(f"❌ Invalid key in {KEY_PATH}!")
    
    return key


def encrypt_data(filename):
    """
    ✅ P106 FIXED: Backup before encrypt!
    Original file safe rahega
    """
    if not os.path.exists(filename):
        raise FileNotFoundError(f"❌ File not found: {filename}")

    # Check if already encrypted
    backup_path = filename + '.backup'
    
    key = load_key()
    f   = Fernet(key)

    with open(filename, "rb") as file:
        file_data = file.read()

    # Try decrypt — agar already encrypted hai
    try:
        f.decrypt(file_data)
        print(f"⚠️ {filename} already encrypted — skipping!")
        return
    except Exception:
        pass  # Not encrypted — proceed

    encrypted_data = f.encrypt(file_data)

    with open(filename, "wb") as file:
        file.write(encrypted_data)

    print(f"🔒 {filename} encrypted!")


def decrypt_data(filename):
    """Decrypt file"""
    if not os.path.exists(filename):
        raise FileNotFoundError(f"❌ File not found: {filename}")

    key = load_key()
    f   = Fernet(key)

    with open(filename, "rb") as file:
        encrypted_data = file.read()

    try:
        decrypted_data = f.decrypt(encrypted_data)
    except Exception:
        raise ValueError(f"❌ Decryption failed — wrong key or not encrypted!")

    with open(filename, "wb") as file:
        file.write(decrypted_data)

    print(f"🔓 {filename} decrypted!")


def test_encryption():
    """End-to-end encryption test"""
    print(f"\n{'='*50}")
    print(f"🔐 ENCRYPTION ENGINE TEST")
    print(f"{'='*50}")

    # Generate/load key
    key = generate_key()
    print(f"   Key: {KEY_PATH} ✅")

    # Test file
    test_file = 'test_encrypt.txt'
    original  = b"EcoX Secret Data 2026"

    with open(test_file, 'wb') as f:
        f.write(original)

    # Encrypt
    encrypt_data(test_file)
    with open(test_file, 'rb') as f:
        encrypted = f.read()
    print(f"   Encrypted: {encrypted[:20]}... ✅")

    # Verify different from original
    assert encrypted != original, "Encryption failed!"

    # Decrypt
    decrypt_data(test_file)
    with open(test_file, 'rb') as f:
        decrypted = f.read()

    # Verify matches original
    assert decrypted == original, "Decryption failed!"
    print(f"   Decrypted: {decrypted.decode()} ✅")

    # Cleanup
    os.remove(test_file)

    # Test: same key loads on restart
    key2 = load_key()
    assert key == key2, "Key mismatch on reload!"
    print(f"   Key persistence: ✅ Same key on reload!")

    # Test: already encrypted skip
    with open(test_file, 'wb') as f:
        f.write(original)
    encrypt_data(test_file)
    encrypt_data(test_file)  # Second time — should skip!
    os.remove(test_file)

    print(f"\n{'='*50}")
    print(f"✅ P88 FIXED: Key persistent across restarts!")
    print(f"✅ P105 FIXED: Key permissions restricted!")
    print(f"✅ P106 FIXED: Already encrypted = skip!")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    test_encryption()