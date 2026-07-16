"""
debug_trainer.py
Trainer engine ka debug test
"""
import sys
import traceback

print("Step 1: Basic imports...")
import os
print("Step 2: OS ok")

print("Step 3: TensorFlow import...")
import tensorflow as tf
print(f"Step 4: TF ok — version {tf.__version__}")

print("Step 5: upgrade_brain import...")
from src.models.upgrade_brain import build_futuristic_brain
print("Step 6: upgrade_brain ok")

print("Step 7: data_auditor import...")
from src.utils.data_auditor import get_class_weights
print("Step 8: data_auditor ok")

print("Step 9: ImageDataGenerator import...")
from tensorflow.keras.preprocessing.image import ImageDataGenerator
print("Step 10: ImageDataGenerator ok")

print("Step 11: Checking dataset folders...")
folders = [
    'dataset/train/cycling',
    'dataset/train/solar_panels',
    'dataset/train_adversarial/cycling',
    'dataset/val/cycling',
]
for f in folders:
    exists = os.path.isdir(f)
    count = len([x for x in os.listdir(f) if x.lower().endswith(('.jpg','.jpeg','.png'))]) if exists else 0
    print(f"   {f}: {'EXISTS' if exists else 'MISSING'} — {count} images")

print("\nStep 12: Building model...")
try:
    model, base_model = build_futuristic_brain(num_classes=6)
    print(f"Step 13: Model ok — output shape: {model.output_shape}")
except Exception as e:
    print(f"Step 13: MODEL ERROR: {e}")
    traceback.print_exc()
    sys.exit(1)

print("\nStep 14: Making train generator...")
try:
    from tensorflow.keras.applications.efficientnet import preprocess_input
    ACTIVE_CLASSES = ['cycling','solar_panels','electric_cars','led_lighting','recycling','plantation']
    datagen = ImageDataGenerator(preprocessing_function=preprocess_input)
    gen = datagen.flow_from_directory(
        'dataset/train',
        target_size=(224,224),
        batch_size=32,
        class_mode='categorical',
        classes=ACTIVE_CLASSES,
        shuffle=True
    )
    print(f"Step 15: Train generator ok — {gen.samples} samples, classes: {gen.class_indices}")
except Exception as e:
    print(f"Step 15: GENERATOR ERROR: {e}")
    traceback.print_exc()
    sys.exit(1)

print("\n✅ ALL CHECKS PASSED — trainer_engine should work!")
print("Run: python -m src.training.trainer_engine")