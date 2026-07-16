"""
compare_top_models.py
======================
GaiaVolt — Deep Comparison of Top-4 Champion Models (Phase 0, Decision 0.1 — Round 2)

KYA KARTI HAI:
Pehle round mein humne 17 models ko thodi images (20/class) par test kiya tha.
4 models ne sab se acha kiya (~82-84% accuracy) — yeh script unhi 4 ko
PURE validation-set (sab images, har class ki) par dobara test karegi,
taake confidently pata chale ASAL champion kaun hai.

Yeh bhi check karegi: kya 'ecox_final_best.h5' aur 'ecox_model_final.h5' (models/ wali)
ASAL mein identical files hain (same content, alag naam).

KAISE CHALANI HAI:
1. Yeh file 'D:\\Gaia Volt' folder mein (compare_models.py ke sath) copy karo
2. Terminal mein: cd "D:\\Gaia Volt"
3. Chalao: python compare_top_models.py
4. Pehle se zyada time lagega (zyada images test ho rahi hain) — sabar karo
"""

import os
import sys
import time
import hashlib

os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import numpy as np

try:
    import tensorflow as tf
    from tensorflow.keras.applications.efficientnet import preprocess_input
except ImportError:
    print("\n[ERROR] TensorFlow installed nahi hai.")
    sys.exit(1)

try:
    import cv2
except ImportError:
    print("\n[ERROR] opencv-python installed nahi hai.")
    sys.exit(1)


IMG_SIZE = (224, 224)

CLASSES = [
    'cycling', 'electric_cars', 'led_lighting',
    'ocean_cleanup', 'organic_farming', 'plantation',
    'public_transport', 'recycling', 'solar_panels',
    'utility_bills', 'water_conservation', 'wind_energy'
]

VAL_DIR = 'dataset/val/'

# Round 1 ke results se top-4 "champion" models — sirf yehi test honge
TOP_MODELS = [
    'models/ecox_phase1_best.h5',
    'models/ecox_model_pruned.h5',
    'models/ecox_final_best.h5',
    'models/ecox_model_final.h5',
]


def file_md5(path, chunk_size=8192):
    """File ka MD5 hash nikalo — taake confirm ho sake do files identical hain ya nahi"""
    h = hashlib.md5()
    with open(path, 'rb') as f:
        while chunk := f.read(chunk_size):
            h.update(chunk)
    return h.hexdigest()


def check_identical_files():
    """Check karo kya in models mein se koi bilkul identical hain (byte-for-byte)"""
    print("\n" + "=" * 80)
    print("  STEP 1: Identical Files Check")
    print("=" * 80)

    hashes = {}
    for model_path in TOP_MODELS:
        if not os.path.exists(model_path):
            print(f"   [SKIP] {model_path} — file nahi mili")
            continue
        h = file_md5(model_path)
        size = os.path.getsize(model_path)
        print(f"   {model_path}")
        print(f"      MD5: {h}  |  Size: {size:,} bytes")
        hashes[model_path] = h

    print()
    seen = {}
    found_duplicates = False
    for path, h in hashes.items():
        if h in seen:
            print(f"   [IDENTICAL] '{path}' aur '{seen[h]}' BILKUL EK JAISI FILES HAIN!")
            found_duplicates = True
        else:
            seen[h] = path

    if not found_duplicates:
        print("   [INFO] Sab 4 files ALAG hain (kam se kam byte-level par) — koi exact duplicate nahi.")

    print("=" * 80 + "\n")
    return hashes


def load_full_validation_set():
    """Pura validation set load karo — har class ki SAB images"""
    if not os.path.exists(VAL_DIR):
        print(f"\n[ERROR] Validation folder nahi mila: {VAL_DIR}")
        sys.exit(1)

    images = []
    labels = []
    filenames = []

    print(f"\n[INFO] PURA validation set load ho raha hai (yeh thora time lega)...")
    for class_name in CLASSES:
        class_dir = os.path.join(VAL_DIR, class_name)
        if not os.path.isdir(class_dir):
            print(f"   [SKIP] '{class_name}' folder nahi mila")
            continue

        files = [f for f in os.listdir(class_dir)
                 if f.lower().endswith(('.jpg', '.jpeg', '.png'))]

        count = 0
        for fname in files:
            img_path = os.path.join(class_dir, fname)
            img = cv2.imread(img_path)
            if img is None:
                continue
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img = cv2.resize(img, IMG_SIZE)
            images.append(img)
            labels.append(class_name)
            filenames.append(fname)
            count += 1

        print(f"   [OK] {class_name}: {count} images loaded (total available: {len(files)})")

    print(f"\n[INFO] Total {len(images)} images load hui — yeh PURA validation set hai\n")
    return np.array(images, dtype=np.float32), labels, filenames


def evaluate_model_deep(model_path, val_images, val_labels, val_filenames):
    """Model ko deeply evaluate karo — per-class accuracy bhi nikalo"""
    result = {
        "model_path": model_path,
        "load_success": False,
        "error": None,
        "overall_accuracy": None,
        "avg_confidence": None,
        "per_class_accuracy": {},
        "misclassified_examples": [],
    }

    try:
        model = tf.keras.models.load_model(model_path, compile=False)
        result["load_success"] = True
    except Exception as e:
        result["error"] = f"Load failed: {str(e)[:150]}"
        return result

    try:
        preprocessed = preprocess_input(val_images.copy())
        predictions = model.predict(preprocessed, verbose=0, batch_size=16)
        pred_indices = np.argmax(predictions, axis=1)
        confidences = np.max(predictions, axis=1)

        # Per-class accuracy
        class_correct = {c: 0 for c in CLASSES}
        class_total = {c: 0 for c in CLASSES}

        correct = 0
        for i, true_label in enumerate(val_labels):
            if true_label not in CLASSES:
                continue
            true_idx = CLASSES.index(true_label)
            class_total[true_label] += 1

            if pred_indices[i] == true_idx:
                correct += 1
                class_correct[true_label] += 1
            else:
                if len(result["misclassified_examples"]) < 5:
                    result["misclassified_examples"].append({
                        "file": val_filenames[i],
                        "true": true_label,
                        "predicted": CLASSES[pred_indices[i]],
                        "confidence": round(float(confidences[i]) * 100, 1)
                    })

        for c in CLASSES:
            if class_total[c] > 0:
                result["per_class_accuracy"][c] = round((class_correct[c] / class_total[c]) * 100, 1)
            else:
                result["per_class_accuracy"][c] = None

        result["overall_accuracy"] = round((correct / len(val_labels)) * 100, 2)
        result["avg_confidence"] = round(float(np.mean(confidences)) * 100, 2)

    except Exception as e:
        result["error"] = f"Prediction failed: {str(e)[:150]}"

    del model
    tf.keras.backend.clear_session()
    return result


def print_deep_report(results):
    print("\n" + "=" * 80)
    print("  STEP 2: Deep Comparison Report (Full Validation Set)")
    print("=" * 80)

    successful = [r for r in results if r["load_success"] and r["overall_accuracy"] is not None]
    successful.sort(key=lambda x: x["overall_accuracy"], reverse=True)

    print(f"\n{'Rank':<5}{'Model':<35}{'Overall Acc':<14}{'Avg Conf':<10}")
    print("-" * 80)
    for i, r in enumerate(successful, 1):
        name = os.path.basename(r["model_path"])
        print(f"{i:<5}{name:<35}{r['overall_accuracy']:<14}{r['avg_confidence']:<10}")

    if successful:
        print("\n" + "=" * 80)
        winner = successful[0]
        print(f"  CONFIRMED WINNER: {os.path.basename(winner['model_path'])} ({winner['model_path']})")
        print(f"  Overall Accuracy: {winner['overall_accuracy']}%")
        print("=" * 80)

        print(f"\n  Per-Class Breakdown for Winner ({os.path.basename(winner['model_path'])}):")
        print("-" * 50)
        for class_name, acc in winner["per_class_accuracy"].items():
            if acc is not None:
                marker = "  [WEAK]" if acc < 60 else ""
                print(f"     {class_name:<22} {acc}%{marker}")

        if winner["misclassified_examples"]:
            print(f"\n  Sample Misclassifications (winner se):")
            for ex in winner["misclassified_examples"]:
                print(f"     '{ex['file']}': asal '{ex['true']}' -> AI ne kaha '{ex['predicted']}' ({ex['confidence']}% confident)")

    print("\n" + "=" * 80 + "\n")


def main():
    print("\n" + "=" * 80)
    print("  GaiaVolt Deep Model Comparison — Top 4 Champions")
    print("=" * 80)

    check_identical_files()

    val_images, val_labels, val_filenames = load_full_validation_set()

    if len(val_images) == 0:
        print("\n[ERROR] Koi validation image load nahi hui.")
        sys.exit(1)

    results = []
    for i, model_path in enumerate(TOP_MODELS, 1):
        if not os.path.exists(model_path):
            print(f"[{i}/{len(TOP_MODELS)}] [SKIP] {model_path} nahi mili")
            continue
        print(f"\n[{i}/{len(TOP_MODELS)}] Deep testing: {model_path}")
        print("-" * 60)
        start = time.perf_counter()
        r = evaluate_model_deep(model_path, val_images, val_labels, val_filenames)
        elapsed = round(time.perf_counter() - start, 1)
        if r["load_success"]:
            print(f"   Done in {elapsed}s — Accuracy: {r['overall_accuracy']}%  Avg Conf: {r['avg_confidence']}%")
        else:
            print(f"   [FAILED] {r['error']}")
        results.append(r)

    print_deep_report(results)


if __name__ == "__main__":
    main()
