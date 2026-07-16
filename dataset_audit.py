"""
dataset_audit.py
=================
GaiaVolt — Day 2: Dataset Counting Tool

KYA KARTI HAI:
Tumhare 'dataset/' folder ke andar jitne bhi sub-folders hain
(train, val, train_balanced, augmented, _processed_val_backup, etc),
har EK mein, har CLASS (cycling, solar_panels, etc) ki kitni images
hain — yeh sab khud count kar ke ek clean-table deti hai.

KAISE CHALANI HAI:
1. Yeh file 'D:\\Gaia Volt' folder mein copy karo (root mein, jahan
   'dataset' folder hai)
2. Terminal mein: cd "D:\\Gaia Volt"
3. Chalao: python dataset_audit.py
4. Result terminal par dikhega + 'dataset_audit_report.txt' mein save hoga
"""

import os
import json

DATASET_ROOT = 'dataset'

# Humari 12 official classes (constants.py se)
EXPECTED_CLASSES = [
    'cycling', 'electric_cars', 'led_lighting',
    'ocean_cleanup', 'organic_farming', 'plantation',
    'public_transport', 'recycling', 'solar_panels',
    'utility_bills', 'water_conservation', 'wind_energy'
]

IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.bmp', '.webp')


def count_images_in_folder(folder_path):
    """Ek folder ke andar (sirf is folder mein, subfolders nahi) images count karo"""
    if not os.path.isdir(folder_path):
        return 0
    count = 0
    for f in os.listdir(folder_path):
        if f.lower().endswith(IMAGE_EXTENSIONS):
            count += 1
    return count


def audit_dataset_subfolder(subfolder_name):
    """
    Ek subfolder (jaise 'train', 'val') ke andar jao,
    har class-folder mein images count karo.
    """
    subfolder_path = os.path.join(DATASET_ROOT, subfolder_name)
    if not os.path.isdir(subfolder_path):
        return None

    result = {
        "found_classes": {},
        "unexpected_folders": [],
        "missing_classes": [],
    }

    actual_folders = [
        d for d in os.listdir(subfolder_path)
        if os.path.isdir(os.path.join(subfolder_path, d))
    ]

    for folder_name in actual_folders:
        folder_path = os.path.join(subfolder_path, folder_name)
        img_count = count_images_in_folder(folder_path)
        result["found_classes"][folder_name] = img_count

        if folder_name not in EXPECTED_CLASSES:
            result["unexpected_folders"].append(folder_name)

    for expected_class in EXPECTED_CLASSES:
        if expected_class not in result["found_classes"]:
            result["missing_classes"].append(expected_class)

    return result


def print_subfolder_report(name, result):
    print(f"\n{'='*70}")
    print(f"  📁 dataset/{name}/")
    print(f"{'='*70}")

    if result is None:
        print(f"   [NOT FOUND] — yeh folder exist nahi karta")
        return

    if not result["found_classes"]:
        print(f"   [EMPTY] — koi class-folder nahi mila is ke andar")
        return

    print(f"\n   {'Class Name':<25}{'Image Count':<15}{'Status'}")
    print(f"   {'-'*65}")

    total = 0
    for class_name in EXPECTED_CLASSES:
        count = result["found_classes"].get(class_name, 0)
        total += count
        if class_name not in result["found_classes"]:
            status = "❌ MISSING (folder nahi mila)"
        elif count == 0:
            status = "⚠️  EMPTY (folder hai, image nahi)"
        elif count < 50:
            status = "⚠️  LOW (50 se kam images)"
        else:
            status = "✅ OK"
        print(f"   {class_name:<25}{count:<15}{status}")

    if result["unexpected_folders"]:
        print(f"\n   ⚠️  UNEXPECTED FOLDERS (12-class-list mein nahi hain):")
        for f in result["unexpected_folders"]:
            count = result["found_classes"][f]
            print(f"      - {f}: {count} images")

    print(f"\n   TOTAL IMAGES IN THIS FOLDER: {total}")


def main():
    print("\n" + "█"*70)
    print("  GaiaVolt DATASET AUDIT — Day 2")
    print("█"*70)

    if not os.path.isdir(DATASET_ROOT):
        print(f"\n[ERROR] '{DATASET_ROOT}' folder nahi mila.")
        print("Confirm karo yeh script 'D:\\Gaia Volt' ke andar hi chal rahi hai.")
        return

    # Top-level subfolders dhoondo (train, val, train_balanced, etc)
    subfolders = [
        d for d in os.listdir(DATASET_ROOT)
        if os.path.isdir(os.path.join(DATASET_ROOT, d))
    ]

    print(f"\n[INFO] dataset/ ke andar {len(subfolders)} subfolder(s) mile:")
    for s in subfolders:
        print(f"   - {s}")

    all_results = {}
    for subfolder in subfolders:
        result = audit_dataset_subfolder(subfolder)
        all_results[subfolder] = result
        print_subfolder_report(subfolder, result)

    # Summary
    print(f"\n{'='*70}")
    print(f"  SUMMARY — Sab Folders Ka Khulasa")
    print(f"{'='*70}")
    for subfolder, result in all_results.items():
        if result is None:
            continue
        total = sum(result["found_classes"].values())
        missing = len(result["missing_classes"])
        print(f"   dataset/{subfolder}/: {total} total images, {missing} classes missing")

    # Save to file
    with open("dataset_audit_report.txt", "w", encoding="utf-8") as f:
        f.write("GaiaVolt Dataset Audit Report\n")
        f.write("="*70 + "\n\n")
        f.write(json.dumps(all_results, indent=2, ensure_ascii=False))

    print(f"\n[INFO] Pura detailed report 'dataset_audit_report.txt' mein save ho gaya.")
    print("="*70 + "\n")


if __name__ == "__main__":
    main()