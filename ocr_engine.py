import os
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import easyocr
import numpy as np
import hashlib
from difflib import SequenceMatcher
from PIL import Image, ImageChops


class GaiaVoltOCR:
    """
    ✅ Day 5: Official OCR + Document Verification Engine
    
    Kya karta hai:
    - 9 languages mein text extract karta hai (Arabic, Urdu, Persian,
      Hindi, Marathi, English, French, German, Spanish)
    - ELA forensic scan se digital tampering detect karta hai
    - Fuzzy address matching (OCR errors tolerate karta hai)
    - Fake keywords detect karta hai
    - SHA-256 fingerprint generate karta hai
    
    Merged from: ocr_engine.py + document_expert.py (Day 5)
    """

    def __init__(self):
        print("Initializing GaiaVolt OCR Engine...")

        print("   Loading Arabic/Urdu/Persian group...")
        self.reader_arabic = easyocr.Reader(['ar', 'fa', 'ur', 'en'], gpu=False)

        print("   Loading Hindi group...")
        self.reader_hindi = easyocr.Reader(['hi', 'mr', 'ne', 'en'], gpu=False)

        print("   Loading Latin group...")
        self.reader_latin = easyocr.Reader(['en', 'fr', 'de', 'es'], gpu=False)

        print("GaiaVolt OCR Engine Ready!")
        print("   Arabic/Urdu/Persian: OK")
        print("   Hindi/Marathi:       OK")
        print("   English/French/German/Spanish: OK")

    # ── Text Extraction ──────────────────────────────────────────────────
    def extract_text(self, image_path):
        """9 languages mein text extract karo"""
        results_arabic = self.reader_arabic.readtext(image_path)
        results_hindi  = self.reader_hindi.readtext(image_path)
        results_latin  = self.reader_latin.readtext(image_path)
        all_results    = results_arabic + results_hindi + results_latin
        raw_text       = " ".join([res[1] for res in all_results])
        confidences    = [res[2] for res in all_results]
        avg_confidence = np.mean(confidences) if confidences else 0
        return {
            'text':       raw_text,
            'confidence': avg_confidence,
            'word_count': len(raw_text.split())
        }

    # ── ELA Forensic Scan (Merged from document_expert.py) ───────────────
    def forensic_scan(self, image_path):
        """
        ELA (Error Level Analysis) — digital tampering detect karo.
        Agar image Photoshop/edit se tampered hai, JPEG re-compression
        mein inconsistency aati hai jo ELA pakad leta hai.
        
        Returns: True = genuine, False = tampered
        """
        tmp_path = "temp_ela_audit.jpg"
        try:
            org = Image.open(image_path).convert('RGB')
            org.save(tmp_path, 'JPEG', quality=90)
            tmp  = Image.open(tmp_path)
            diff = ImageChops.difference(org, tmp)
            extrema  = diff.getextrema()
            max_diff = max([ex[1] for ex in extrema])
            return max_diff < 180  # True = genuine, False = tampered
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    # ── SHA-256 Fingerprint ──────────────────────────────────────────────
    def generate_fingerprint(self, image_path):
        """File ka unique SHA-256 hash banao"""
        with open(image_path, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest()

    # ── Fake Keywords Check ──────────────────────────────────────────────
    def check_authenticity(self, text):
        """Common fake/sample document keywords check karo"""
        fake_keywords = ['sample', 'void', 'specimen', 'fake',
                         'photocopy', 'test', 'demo', 'example']
        text_lower = text.lower()
        for keyword in fake_keywords:
            if keyword in text_lower:
                return False, f"Fake keyword found: '{keyword}'"
        return True, "No fake keywords found"

    # ── Fuzzy Address Matching ───────────────────────────────────────────
    def check_address_match(self, extracted_text, user_address, threshold=0.75):
        """
        Fuzzy matching se address verify karo.
        Pehle simple substring check, phir similarity ratio.
        
        threshold=0.75 matlab 75% se zyada similar hona chahiye.
        (Pehle sirf exact substring tha — OCR errors tolerate nahi karta tha)
        """
        text_lower    = extracted_text.lower()
        address_lower = user_address.lower()

        # Step 1: Direct substring check (fast)
        address_parts = [p.strip() for p in address_lower.split(',')
                         if len(p.strip()) > 3]
        for part in address_parts:
            if part in text_lower:
                return True, f"Address part found: '{part}'"

        # Step 2: Fuzzy similarity check (handles OCR typos)
        ratio = SequenceMatcher(None, address_lower, text_lower).ratio()
        if ratio >= threshold:
            return True, f"Address fuzzy match: {ratio:.0%} similarity"

        return False, f"Address not found (best match: {ratio:.0%})"

    # ── Full Document Verification ───────────────────────────────────────
    def verify_document(self, image_path, user_address):
        """
        Complete document verification — Fail-Closed (Principle #1):
        Koi bhi check fail ho → REJECT, kabhi silent-pass nahi.
        
        Steps:
        1. ELA forensic scan (tampering check)
        2. Text extract karo
        3. Fake keywords check
        4. Address fuzzy match
        """
        print(f"\nVerifying: {os.path.basename(image_path)}")

        # Step 1: Forensic scan — Fail-Closed
        try:
            is_genuine = self.forensic_scan(image_path)
            if not is_genuine:
                return {
                    'verdict': 'REJECTED',
                    'reason': 'Digital manipulation detected (ELA failed)',
                    'coins_authorized': False
                }
        except Exception as e:
            # Fail-Closed: exception = REJECT (Principle #1)
            return {
                'verdict': 'REJECTED',
                'reason': f'Forensic scan failed: {e}',
                'coins_authorized': False
            }

        # Step 2: Text extraction — Fail-Closed
        try:
            result = self.extract_text(image_path)
            if result['word_count'] == 0:
                return {
                    'verdict': 'REJECTED',
                    'reason': 'No text found in document',
                    'coins_authorized': False
                }
        except Exception as e:
            return {
                'verdict': 'REJECTED',
                'reason': f'OCR failed: {e}',
                'coins_authorized': False
            }

        # Step 3: Fake keywords — Fail-Closed
        try:
            is_authentic, auth_msg = self.check_authenticity(result['text'])
            if not is_authentic:
                return {
                    'verdict': 'REJECTED',
                    'reason': auth_msg,
                    'coins_authorized': False
                }
        except Exception as e:
            return {
                'verdict': 'REJECTED',
                'reason': f'Authenticity check failed: {e}',
                'coins_authorized': False
            }

        # Step 4: Address match — Fail-Closed
        try:
            addr_match, addr_msg = self.check_address_match(
                result['text'], user_address
            )
            if not addr_match:
                return {
                    'verdict': 'REJECTED',
                    'reason': f'Address mismatch: {addr_msg}',
                    'coins_authorized': False
                }
        except Exception as e:
            return {
                'verdict': 'REJECTED',
                'reason': f'Address check failed: {e}',
                'coins_authorized': False
            }

        # All checks passed
        return {
            'verdict': 'APPROVED',
            'reason': f'Document verified. {addr_msg}',
            'fingerprint': self.generate_fingerprint(image_path),
            'ocr_confidence': result['confidence'],
            'word_count': result['word_count'],
            'coins_authorized': True
        }

    # ── Data Bias Check ──────────────────────────────────────────────────
    def check_data_bias(self, dataset_path):
        """Training dataset ka class-distribution check karo"""
        print(f"\n{'='*55}")
        print(f"DATA BIAS ANALYSIS")
        print(f"{'='*55}")

        class_counts = {}
        for cls in os.listdir(dataset_path):
            cls_path = os.path.join(dataset_path, cls)
            if os.path.isdir(cls_path) and not cls.startswith('_'):
                count = len([f for f in os.listdir(cls_path)
                             if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
                class_counts[cls] = count

        total      = sum(class_counts.values())
        avg        = total / len(class_counts)
        max_count  = max(class_counts.values())
        min_count  = min(class_counts.values())
        bias_ratio = max_count / min_count if min_count > 0 else 999

        print(f"   Total images:  {total}")
        print(f"   Total classes: {len(class_counts)}")
        print(f"   Average/class: {avg:.0f}")
        print(f"   Bias ratio:    {bias_ratio:.2f}x")

        if bias_ratio <= 1.5:
            print(f"   Bias Status:   EXCELLENT")
        elif bias_ratio <= 2.0:
            print(f"   Bias Status:   ACCEPTABLE")
        else:
            print(f"   Bias Status:   HIGH BIAS")

        print(f"\n   Per class breakdown:")
        for cls, count in sorted(class_counts.items()):
            bar = "x" * int(count / max_count * 20)
            print(f"   {cls:<22} {count:>4}  {bar}")

        return bias_ratio


# ── Backward compatibility alias ────────────────────────────────────────
# Agar koi purana code 'MultiLangOCR' import kare, kaam karta rahega
MultiLangOCR = GaiaVoltOCR


if __name__ == "__main__":
    print("GaiaVolt OCR Engine — Test")
    print("Import test: from ocr_engine import GaiaVoltOCR")
    ocr = GaiaVoltOCR()
    print("Import OK — GaiaVoltOCR ready")