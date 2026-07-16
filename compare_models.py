"""
compare_models.py
==================
GaiaVolt — Model Comparison Tool (Phase 0, Decision 0.1)

KYA KARTI HAI:
Yeh script tumhare 'D:\\Eco X' folder mein jitni bhi .h5 model files milengi,
sab ko load karegi aur 'dataset/val/' folder ke images par test karegi.
Aakhir mein ek table degi jo dikhayegi konsa model sabse zyada accurate hai.

KAISE CHALANI HAI:
1. Yeh file 'compare_models.py' ko apne 'D:\\Eco X' folder ke ANDAR copy karo
   (jahan 'dataset' aur 'models' folders hain, wahi level par)
2. Command Prompt ya VS Code Terminal khol kar 'D:\\Eco X' folder mein jao:
       cd "D:\\Eco X"
3. Yeh command chalao:
       python compare_models.py
4. Thora time lagega (har model load hoga aur test hoga) — sabar se wait karo
5. Aakhir mein ek table milegi + 'model_comparison_report.txt' file ban jayegi

NOTE: Agar koi model file load nahi hoti (corrupt ya format-mismatch),
script us ko skip kar degi aur error likh degi report mein — rukegi nahi.
"""

import os
import sys
import time
import json

os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import numpy as np

try:
    import tensorflow as tf
    from tensorflow.keras.applications.efficientnet import preprocess_input
except ImportError:
    print("\n[ERROR] TensorFlow installed nahi hai is environment mein.")
    print("Pehle yeh chalao: pip install tensorflow")
    sys.exit(1)

try:
    import cv2
except ImportError:
    print("\n[ERROR] opencv-python installed nahi hai.")
    print("Pehle yeh chalao: pip install opencv-python")
    sys.exit(1)


# ─────────────────────────────────────────────
#  CONFIG — apni zaroorat ke hisab se badal sakti ho
# ─────────────────────────────────────────────

IMG_SIZE = (224, 224)

# Classes — agar tumhari constants.py mein order alag hai, yahan match kar lena
CLASSES = [
    'cycling', 'electric_cars', 'led_lighting',
    'ocean_cleanup', 'organic_farming', 'plantation',
    'public_transport', 'recycling', 'solar_panels',
    'utility_bills', 'water_conservation', 'wind_energy'
]

VAL_DIR = 'dataset/val/'

# Sab jagah jahan model files mil sakti hain — script khud dhoondegi
SEARCH_LOCATIONS = ['models/', './', 'src/models/']

# Konsi files test karni hain (sirf .h5 — TFLite/ONNX/PT alag handling chahte hain)
MODEL_EXTENSIONS = ['.h5']


def find_all_models():
    """Saari .h5 model files dhoondo project ke andar"""
    found = []
    for location in SEARCH_LOCATIONS:
        if not os.path.exists(location):
            continue
        for fname in os.listdir(location):
            if any(fname.endswith(ext) for ext in MODEL_EXTENSIONS):
                full_path = os.path.join(location, fname)
                if full_path not in found:
                    found.append(full_path)

    # Root directory bhi check karo (kabhi kabhi models root mein hoti hain)
    for fname in os.listdir('.'):
        if fname.endswith('.h5'):
            if fname not in found and os.path.join('.', fname) not in found:
                found.append(fname)

    return sorted(set(found))


def load_validation_images(max_per_class=20):
    """
    Validation folder se images load karo.
    max_per_class: har class se kitni images test karein (zyada = zyada accurate
    result, lekin zyada time lagega). 20 per class = 240 images total, reasonable hai.
    """
    if not os.path.exists(VAL_DIR):
        print(f"\n[ERROR] Validation folder nahi mila: {VAL_DIR}")
        print("Confirm karo yeh script 'D:\\Eco X' folder ke andar hi chal rahi hai.")
        sys.exit(1)

    images = []
    labels = []

    print(f"\n[INFO] Validation images load ki ja rahi hain...")
    for class_name in CLASSES:
        class_dir = os.path.join(VAL_DIR, class_name)
        if not os.path.isdir(class_dir):
            print(f"   [SKIP] '{class_name}' folder nahi mila — skip kar rahe hain")
            continue

        files = [f for f in os.listdir(class_dir)
                 if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        files = files[:max_per_class]

        for fname in files:
            img_path = os.path.join(class_dir, fname)
            img = cv2.imread(img_path)
            if img is None:
                continue
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img = cv2.resize(img, IMG_SIZE)
            images.append(img)
            labels.append(class_name)

        print(f"   [OK] {class_name}: {len(files)} images loaded")

    print(f"\n[INFO] Total {len(images)} images load hui, {len(set(labels))} classes se\n")
    return np.array(images, dtype=np.float32), labels


def evaluate_model(model_path, val_images, val_labels):
    """Ek model ko load karo aur validation images par test karo"""
    result = {
        "model_path": model_path,
        "load_success": False,
        "error": None,
        "accuracy": None,
        "avg_confidence": None,
        "num_classes_output": None,
        "load_time_sec": None,
        "predict_time_sec": None,
        "file_size_mb": None,
    }

    try:
        result["file_size_mb"] = round(os.path.getsize(model_path) / (1024 * 1024), 2)
    except Exception:
        pass

    # ── Load model ──
    try:
        start = time.perf_counter()
        model = tf.keras.models.load_model(model_path, compile=False)
        result["load_time_sec"] = round(time.perf_counter() - start, 2)
        result["load_success"] = True
    except Exception as e:
        result["error"] = f"Load failed: {str(e)[:150]}"
        return result

    # ── Check output shape matches expected classes ──
    try:
        output_shape = model.output_shape
        result["num_classes_output"] = output_shape[-1]
    except Exception:
        pass

    # ── Run predictions ──
    try:
        preprocessed = preprocess_input(val_images.copy())
        start = time.perf_counter()
        predictions = model.predict(preprocessed, verbose=0, batch_size=16)
        result["predict_time_sec"] = round(time.perf_counter() - start, 2)

        pred_indices = np.argmax(predictions, axis=1)
        confidences = np.max(predictions, axis=1)

        correct = 0
        for i, true_label in enumerate(val_labels):
            try:
                true_idx = CLASSES.index(true_label)
            except ValueError:
                continue
            if pred_indices[i] == true_idx:
                correct += 1

        result["accuracy"] = round((correct / len(val_labels)) * 100, 2) if val_labels else 0
        result["avg_confidence"] = round(float(np.mean(confidences)) * 100, 2)

    except Exception as e:
        result["error"] = f"Prediction failed: {str(e)[:150]}"

    # Free memory before next model
    del model
    tf.keras.backend.clear_session()

    return result


def print_report(results):
    """Final comparison table print karo"""
    print("\n" + "=" * 80)
    print("  MODEL COMPARISON REPORT")
    print("=" * 80)

    successful = [r for r in results if r["load_success"] and r["accuracy"] is not None]
    failed = [r for r in results if not r["load_success"] or r["accuracy"] is None]

    if successful:
        successful.sort(key=lambda x: x["accuracy"], reverse=True)

        print(f"\n{'Rank':<5}{'Model':<35}{'Accuracy':<12}{'Avg Conf':<12}{'Size (MB)':<10}")
        print("-" * 80)
        for i, r in enumerate(successful, 1):
            name = os.path.basename(r["model_path"])
            print(f"{i:<5}{name:<35}{r['accuracy']:<12}{r['avg_confidence']:<12}{r['file_size_mb']:<10}")

        print("\n" + "=" * 80)
        winner = successful[0]
        print(f"  WINNER (sabse acha): {os.path.basename(winner['model_path'])}")
        print(f"  Accuracy: {winner['accuracy']}%  |  Avg Confidence: {winner['avg_confidence']}%")
        print("=" * 80)

    if failed:
        print(f"\n[WARNING] {len(failed)} models load/test nahi ho saki:")
        for r in failed:
            print(f"   - {os.path.basename(r['model_path'])}: {r['error']}")

    # Save full report to file
    with open("model_comparison_report.txt", "w", encoding="utf-8") as f:
        f.write("GaiaVolt Model Comparison Report\n")
        f.write("=" * 80 + "\n\n")
        for r in results:
            f.write(json.dumps(r, indent=2) + "\n\n")

    print(f"\n[INFO] Pura detailed report 'model_comparison_report.txt' mein save ho gaya hai.")
    print("=" * 80 + "\n")


def main():
    print("\n" + "=" * 80)
    print("  GaiaVolt Model Comparison Tool — Phase 0, Decision 0.1")
    print("=" * 80)

    models = find_all_models()
    if not models:
        print("\n[ERROR] Koi .h5 model file nahi mili 'models/', './' ya 'src/models/' mein.")
        print("Confirm karo models tumhare current folder mein hain.")
        sys.exit(1)

    print(f"\n[INFO] {len(models)} model file(s) mili:")
    for m in models:
        print(f"   - {m}")

    val_images, val_labels = load_validation_images(max_per_class=20)

    if len(val_images) == 0:
        print("\n[ERROR] Koi validation image load nahi hui. Check karo dataset/val/ folder.")
        sys.exit(1)

    results = []
    for i, model_path in enumerate(models, 1):
        print(f"\n[{i}/{len(models)}] Testing: {model_path}")
        print("-" * 60)
        r = evaluate_model(model_path, val_images, val_labels)
        if r["load_success"]:
            print(f"   Load time:    {r['load_time_sec']}s")
            print(f"   Predict time: {r['predict_time_sec']}s")
            print(f"   Accuracy:     {r['accuracy']}%")
            print(f"   Avg Conf:     {r['avg_confidence']}%")
        else:
            print(f"   [FAILED] {r['error']}")
        results.append(r)

    print_report(results)


if __name__ == "__main__":
    main()
