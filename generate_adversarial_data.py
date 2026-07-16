"""
generate_adversarial_data.py
=============================
GaiaVolt — Day 2: Adversarial/Fake Data Generator

KYA KARTI HAI:
Tumhare existing CLEAN training-images se khud-be-khud "fake-looking"
versions banati hai — taake AI seekhe "yeh image fake/manipulated hai"
pehchaanna, sirf "yeh category kya hai" nahi.

DO TARAH KI FAKE-IMAGES BANATI HAI (har clean-image se):
1. SCREEN-CAPTURE-SIMULATION: Jaisa kisi doosri-screen se photo li ho
   (Moire-pattern, slight-color-shift, scan-lines add karti hai)
2. DIGITAL-TAMPERING-SIMULATION: Jaisa Photoshop mein edit kiya ho
   (sudden color-patches, copy-paste-jaisa artifact, blur-inconsistency)

SIRF 6 ACTIVE-CLASSES KE LIYE CHALEGI:
cycling, solar_panels, electric_cars, led_lighting, recycling, plantation

KAISE CHALANI HAI:
1. Yeh file 'D:\\Gaia Volt' folder mein copy karo
2. Terminal: cd "D:\\Gaia Volt"
3. Chalao: python generate_adversarial_data.py
4. Naya folder banega: dataset/train_adversarial/<class>/
   Yeh ORIGINAL train/ folder ko NAHI touch karti — sirf naya folder banati hai
5. Baad mein yeh adversarial-images training-mein add hongi (alag step)
"""

import os
import cv2
import numpy as np
import random

ACTIVE_CLASSES = [
    'cycling', 'solar_panels', 'electric_cars',
    'led_lighting', 'recycling', 'plantation'
]

SOURCE_DIR = 'dataset/train'
OUTPUT_DIR = 'dataset/train_adversarial'

# Har class se kitni clean-images lekar fake-version banani hai
IMAGES_PER_CLASS = 40  # 40 source-images -> 80 fake-images (2 variants har ek se)


def simulate_screen_capture(img):
    """
    Jaisa screen ki photo li gayi ho — Moire-pattern, color-shift, scan-lines
    """
    h, w = img.shape[:2]
    result = img.copy().astype(np.float32)

    # 1. Halka color-shift (screens ka color-temperature alag hota hai)
    shift = random.uniform(0.85, 0.95)
    result[:, :, 0] *= shift  # Blue-channel kam karo (warmer-look)

    # 2. Scan-lines simulate karo (horizontal stripes)
    for y in range(0, h, 3):
        result[y, :, :] *= 0.92

    # 3. Moire-pattern simulate karo (high-frequency grid-overlay)
    grid = np.zeros((h, w), dtype=np.float32)
    grid[::4, :] = 8
    grid[:, ::4] += 8
    for c in range(3):
        result[:, :, c] += grid

    # 4. Halka blur (screen-ki-photo-mein-thoda-soft-focus-aata-hai)
    result = np.clip(result, 0, 255).astype(np.uint8)
    result = cv2.GaussianBlur(result, (3, 3), 0)

    return result


def simulate_digital_tampering(img):
    """
    Jaisa Photoshop mein edit kiya ho — patch-inconsistency, sharp-edges,
    unnatural-color-blocks
    """
    h, w = img.shape[:2]
    result = img.copy()

    # 1. Ek random-rectangular-patch ka color/brightness alag karo
    #    (jaisa kisi ne photo ka ek-hissa copy-paste kiya ho)
    patch_w = random.randint(w // 5, w // 3)
    patch_h = random.randint(h // 5, h // 3)
    x = random.randint(0, max(1, w - patch_w))
    y = random.randint(0, max(1, h - patch_h))

    brightness_shift = random.choice([-40, -30, 30, 40])
    patch = result[y:y+patch_h, x:x+patch_w].astype(np.int16)
    patch = np.clip(patch + brightness_shift, 0, 255).astype(np.uint8)
    result[y:y+patch_h, x:x+patch_w] = patch

    # 2. Patch ke edges par sharp-unnatural-boundary (no blending)
    cv2.rectangle(result, (x, y), (x+patch_w, y+patch_h), (0, 0, 0), 1)

    # 3. JPEG-recompression-artifacts simulate karo (multiple re-saves)
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 35]
    _, encoded = cv2.imencode('.jpg', result, encode_param)
    result = cv2.imdecode(encoded, cv2.IMREAD_COLOR)

    return result


def process_class(class_name):
    """Ek class ki images process karo"""
    source_path = os.path.join(SOURCE_DIR, class_name)
    output_path = os.path.join(OUTPUT_DIR, class_name)

    if not os.path.isdir(source_path):
        print(f"   [SKIP] {class_name}: source-folder nahi mila")
        return 0

    os.makedirs(output_path, exist_ok=True)

    files = [f for f in os.listdir(source_path)
             if f.lower().endswith(('.jpg', '.jpeg', '.png'))]

    if not files:
        print(f"   [SKIP] {class_name}: koi image nahi mili")
        return 0

    random.shuffle(files)
    selected = files[:IMAGES_PER_CLASS]

    count = 0
    for fname in selected:
        img_path = os.path.join(source_path, fname)
        img = cv2.imread(img_path)
        if img is None:
            continue

        base_name = os.path.splitext(fname)[0]

        # Variant 1: Screen-capture-simulation
        try:
            fake1 = simulate_screen_capture(img)
            out1 = os.path.join(output_path, f"{base_name}_screenfake.jpg")
            cv2.imwrite(out1, fake1)
            count += 1
        except Exception as e:
            print(f"      [ERROR] screen-fake {fname}: {e}")

        # Variant 2: Digital-tampering-simulation
        try:
            fake2 = simulate_digital_tampering(img)
            out2 = os.path.join(output_path, f"{base_name}_tamperfake.jpg")
            cv2.imwrite(out2, fake2)
            count += 1
        except Exception as e:
            print(f"      [ERROR] tamper-fake {fname}: {e}")

    return count


def main():
    print("\n" + "=" * 70)
    print("  GaiaVolt Adversarial Data Generator — Day 2")
    print("=" * 70)

    if not os.path.isdir(SOURCE_DIR):
        print(f"\n[ERROR] '{SOURCE_DIR}' nahi mila. Confirm karo script")
        print("'D:\\Gaia Volt' folder ke andar hi chal rahi hai.")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    total = 0
    print(f"\n[INFO] {len(ACTIVE_CLASSES)} active-classes ke liye fake-data generate ho raha hai...\n")

    for class_name in ACTIVE_CLASSES:
        print(f"[INFO] Processing: {class_name}")
        count = process_class(class_name)
        print(f"   -> {count} fake-images banayi (folder: {OUTPUT_DIR}/{class_name}/)")
        total += count

    print(f"\n{'=' * 70}")
    print(f"  DONE — Total {total} adversarial/fake images generated")
    print(f"  Location: {OUTPUT_DIR}/")
    print(f"{'=' * 70}\n")
    print("[NOTE] Yeh images abhi 'train_adversarial/' mein hain, 'train/' mein nahi.")
    print("[NOTE] Inhe training mein shamil karne ke liye agla-step follow karo")
    print("       (trainer_engine.py ko in dono-folders se data load karna hoga).\n")


if __name__ == "__main__":
    main()