"""
run_evaluation.py
==================
GaiaVolt — Day 7: Model Evaluation Runner

KAISE CHALANI HAI:
1. D:\\Gaia Volt folder mein copy karo
2. python run_evaluation.py
"""
import os
import sys
import traceback

os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

print("=" * 60)
print("  GaiaVolt — Model Evaluation (Day 7)")
print("=" * 60)

try:
    import tensorflow as tf
    from tensorflow.keras.preprocessing.image import ImageDataGenerator
    from tensorflow.keras.applications.efficientnet import preprocess_input
    from src.utils.constants import CONFIG
    from src.utils.model_evaluation import evaluate_model

    VAL_DIR      = CONFIG['VAL_DIR']
    MODEL_PATH   = CONFIG['MODEL_PATH']
    IMG_SIZE     = CONFIG['IMG_SIZE']
    BATCH_SIZE   = CONFIG['BATCH_SIZE']

    print(f"\n[INFO] Model:   {MODEL_PATH}")
    print(f"[INFO] Val dir: {VAL_DIR}")

    # Val generator
    val_datagen = ImageDataGenerator(
        preprocessing_function=preprocess_input
    )
    val_gen = val_datagen.flow_from_directory(
        VAL_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        shuffle=False
    )

    print(f"[INFO] Val samples: {val_gen.samples}")
    print(f"[INFO] Classes:     {val_gen.num_classes}")

    # Evaluate
    accuracy = evaluate_model(MODEL_PATH, val_gen)

    # Save report
    with open('accuracy_report.txt', 'w') as f:
        f.write(f"GaiaVolt Model Evaluation Report\n")
        f.write(f"=" * 40 + "\n")
        f.write(f"Model: {MODEL_PATH}\n")
        f.write(f"Val samples: {val_gen.samples}\n")
        f.write(f"Overall Accuracy: {accuracy:.2f}%\n")

    print(f"\n[INFO] Report saved: accuracy_report.txt")
    print(f"[INFO] Confusion matrix: assets/confusion_matrix.png")
    print(f"\n{'=' * 60}")
    print(f"  EVALUATION COMPLETE — Overall Accuracy: {accuracy:.2f}%")
    print(f"{'=' * 60}\n")

except Exception as e:
    print(f"\nERROR: {e}")
    traceback.print_exc()
    sys.exit(1)