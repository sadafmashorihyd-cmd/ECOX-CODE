"""
verify_adversarial_ratio.py
=============================
GaiaVolt — Day 2, Step E: Adversarial-Data Verification

KYA KARTI HAI:
Simple-tareeke se confirm karti hai: train/ folder mein kitni CLEAN
images hain, train_adversarial/ mein kitni FAKE images hain, aur
total-mein adversarial-percentage kya hai.

KAISE CHALANI HAI:
1. 'D:\\Gaia Volt' folder mein copy karo
2. cd "D:\\Gaia Volt"
3. python verify_adversarial_ratio.py
"""

import os

ACTIVE_CLASSES = [
    'cycling', 'solar_panels', 'electric_cars',
    'led_lighting', 'recycling', 'plantation'
]

CLEAN_DIR = 'dataset/train'
ADVERSARIAL_DIR = 'dataset/train_adversarial'
IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png')


def count_images(folder):
    if not os.path.isdir(folder):
        return 0
    return len([f for f in os.listdir(folder) if f.lower().endswith(IMAGE_EXTENSIONS)])


def main():
    print("\n" + "=" * 70)
    print("  Adversarial-Data Ratio Verification — Day 2")
    print("=" * 70)

    total_clean = 0
    total_adversarial = 0

    print(f"\n{'Class':<20}{'Clean':<12}{'Adversarial':<14}{'Adv %'}")
    print("-" * 70)

    for class_name in ACTIVE_CLASSES:
        clean_count = count_images(os.path.join(CLEAN_DIR, class_name))
        adv_count = count_images(os.path.join(ADVERSARIAL_DIR, class_name))
        total = clean_count + adv_count
        pct = (adv_count / total * 100) if total > 0 else 0

        print(f"{class_name:<20}{clean_count:<12}{adv_count:<14}{pct:.1f}%")

        total_clean += clean_count
        total_adversarial += adv_count

    grand_total = total_clean + total_adversarial
    overall_pct = (total_adversarial / grand_total * 100) if grand_total > 0 else 0

    print("-" * 70)
    print(f"{'TOTAL':<20}{total_clean:<12}{total_adversarial:<14}{overall_pct:.1f}%")
    print("=" * 70)

    if overall_pct > 0:
        print(f"\n[PASS] Adversarial-data percentage = {overall_pct:.1f}% (target: > 0%)")
        print("[INFO] Yeh data abhi 'train_adversarial/' mein hai, training-pipeline mein")
        print("       shamil karne ke liye trainer_engine.py ko update karna hoga taake")
        print("       woh dono folders se data load kare.")
    else:
        print(f"\n[FAIL] Adversarial-data 0% hai — kuch ghalat hua, dobara generate_adversarial_data.py chalao")

    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()