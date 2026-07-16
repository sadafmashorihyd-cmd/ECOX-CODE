import easyocr
import hashlib
import shutil
import os
import json
from datetime import datetime
from PIL import Image, ImageChops

class EcoXAuditor:
    def __init__(self, db_path='blockchain_history.json'):
        print("🔍 Initializing Global OCR (English + Arabic)...")
        self.reader = easyocr.Reader(['en', 'ar'], gpu=False)
        self.db_path = db_path
        self.load_history()

    def load_history(self):
        if os.path.exists(self.db_path):
            with open(self.db_path, 'r') as f: self.history = json.load(f)
        else: self.history = []

    def generate_fingerprint(self, image_path):
        with open(image_path, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest()

    def forensic_scan(self, image_path):
        tmp_path = "temp_audit.jpg"
        org = Image.open(image_path).convert('RGB')
        org.save(tmp_path, 'JPEG', quality=90)
        tmp = Image.open(tmp_path)
        diff = ImageChops.difference(org, tmp)
        extrema = diff.getextrema()
        max_diff = max([ex[1] for ex in extrema])
        os.remove(tmp_path)
        return True if max_diff < 180 else False

    def verify_document(self, image_path, user_address):
        print(f"\n🚀 FORENSIC AUDIT STARTED: {os.path.basename(image_path)}")
        
        if not self.forensic_scan(image_path):
            return "FRAUD: Digital Manipulation Detected (ELA Failed)."
        
        file_hash = self.generate_fingerprint(image_path)
        if any(entry['hash'] == file_hash for entry in self.history):
            return "FRAUD: Duplicate Document Detected."

        result = self.reader.readtext(image_path)
        raw_text = " ".join([res[1].lower() for res in result])
        
        address_parts = [part.strip() for part in user_address.lower().split(',') if len(part.strip()) > 3]
        address_verified = any(part in raw_text for part in address_parts)
        
        if not address_verified:
            return "FRAUD: Service Address Mismatch."
        
        return "VALID: Authentic Document. Eco-Coins Minting Authorized."

    def log_for_learning(self, image_path, reason):
        learning_dir = 'dataset/active_learning_loop/'
        if not os.path.exists(learning_dir):
            os.makedirs(learning_dir)
        
        file_name = os.path.basename(image_path)
        destination = os.path.join(learning_dir, f"{reason}_{file_name}")
        shutil.copy(image_path, destination)
        print(f"🔄 Loop Active: Image logged for retraining due to {reason}")

if __name__ == "__main__":
    auditor = EcoXAuditor()
    sadaf_address = "Latifabad, Hyderabad, Pakistan"
    test_bill = 'dataset/utility_bills/test_bill_2026.jpeg'   

    if os.path.exists(test_bill):
        result = auditor.verify_document(test_bill, sadaf_address)
        print(f"\n{result}")

        if "FRAUD" in result:
            auditor.log_for_learning(test_bill, "address_mismatch")
    else:
        print(f"\n⚠️ Error: Image file missing at {test_bill}")