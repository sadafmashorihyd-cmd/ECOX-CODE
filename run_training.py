"""
run_training.py — GaiaVolt v2
==============================
6 active classes only
No albumentations (memory leak fix)
TF native augmentation
BATCH_SIZE = 16 (memory safe)
"""
import os, sys, traceback

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

print("=" * 60)
print("  GaiaVolt Training v2 — 6 Classes")
print("=" * 60)

try:
    import tensorflow as tf
    import numpy as np
    print(f"  TF: {tf.__version__} ✅")

    from src.models.upgrade_brain import build_futuristic_brain
    print("  upgrade_brain ✅")

    # ── Settings ────────────────────────────────────────────────────
    ACTIVE_CLASSES = [
        'cycling', 'solar_panels', 'electric_cars',
        'led_lighting', 'recycling', 'plantation'
    ]

    TRAIN_DIR  = 'dataset/train_balanced'
    ADV_DIR    = 'dataset/train_adversarial'
    VAL_DIR    = 'dataset/val'
    IMG_SIZE   = (224, 224)
    BATCH_SIZE = 16  # memory safe

    # ── Generators (NO albumentations — TF native only) ─────────────
    preprocess = tf.keras.applications.efficientnet.preprocess_input
    ImageDataGenerator = tf.keras.preprocessing.image.ImageDataGenerator

    train_datagen = ImageDataGenerator(
        preprocessing_function=preprocess,
        rotation_range=20,
        width_shift_range=0.15,
        height_shift_range=0.15,
        horizontal_flip=True,
        zoom_range=0.15,
        brightness_range=[0.8, 1.2],
        fill_mode='nearest'
    )
    val_datagen = ImageDataGenerator(preprocessing_function=preprocess)

    print("\n  Making generators...")
    train_gen = train_datagen.flow_from_directory(
        TRAIN_DIR, target_size=IMG_SIZE, batch_size=BATCH_SIZE,
        class_mode='categorical', classes=ACTIVE_CLASSES,
        shuffle=True, seed=42
    )
    adv_gen = train_datagen.flow_from_directory(
        ADV_DIR, target_size=IMG_SIZE, batch_size=BATCH_SIZE,
        class_mode='categorical', classes=ACTIVE_CLASSES,
        shuffle=True, seed=42
    )
    val_gen = val_datagen.flow_from_directory(
        VAL_DIR, target_size=IMG_SIZE, batch_size=BATCH_SIZE,
        class_mode='categorical', classes=ACTIVE_CLASSES,
        shuffle=False
    )

    print(f"  Train: {train_gen.samples} images")
    print(f"  Adv:   {adv_gen.samples} images")
    print(f"  Val:   {val_gen.samples} images")
    print(f"  Classes: {list(train_gen.class_indices.keys())}")

    # ── Combined generator ───────────────────────────────────────────
    def combined_gen(g1, g2):
        while True:
            x1, y1 = next(g1)
            x2, y2 = next(g2)
            x = np.concatenate([x1, x2], axis=0)
            y = np.concatenate([y1, y2], axis=0)
            idx = np.random.permutation(len(x))
            yield x[idx], y[idx]

    steps = (train_gen.samples + adv_gen.samples) // BATCH_SIZE
    print(f"  Steps/epoch: {steps}")

    # ── Callbacks ────────────────────────────────────────────────────
    callbacks_p1 = [
        tf.keras.callbacks.ModelCheckpoint(
            'models/gaiavolt_phase1.h5',
            monitor='val_accuracy', save_best_only=True, verbose=1
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor='val_accuracy', patience=5,
            restore_best_weights=True, verbose=1
        ),
    ]

    callbacks_p2 = [
        tf.keras.callbacks.ModelCheckpoint(
            'models/ecox_final_best.h5',
            monitor='val_accuracy', save_best_only=True, verbose=1
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor='val_accuracy', patience=7,
            restore_best_weights=True, verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss', factor=0.5, patience=3,
            min_lr=1e-7, verbose=1
        ),
    ]

    # ══════════════════════════════════════════════════════════════════
    # PHASE 1 — Frozen base, train head (10 epochs)
    # ══════════════════════════════════════════════════════════════════
    print("\n" + "="*60)
    print("  PHASE 1: Head training (frozen base, 10 epochs)")
    print("="*60)

    model, base_model = build_futuristic_brain(num_classes=6)

    model.fit(
        combined_gen(train_gen, adv_gen),
        steps_per_epoch=steps,
        validation_data=val_gen,
        epochs=10,
        callbacks=callbacks_p1,
        verbose=1
    )

    p1_acc = max(model.history.history['val_accuracy'])
    print(f"\n  Phase 1 best: {p1_acc:.4f} ({p1_acc*100:.1f}%)")

    # ══════════════════════════════════════════════════════════════════
    # PHASE 2 — Unfreeze last 30 layers, fine-tune (20 epochs)
    # ══════════════════════════════════════════════════════════════════
    print("\n" + "="*60)
    print("  PHASE 2: Fine-tuning last 30 layers (20 epochs)")
    print("="*60)

    # Load best phase 1 weights
    model.load_weights('models/gaiavolt_phase1.h5')

    # Unfreeze last 30 layers
    base_model.trainable = True
    for layer in base_model.layers[:-30]:
        layer.trainable = False

    frozen = sum(1 for l in base_model.layers if not l.trainable)
    unfrozen = sum(1 for l in base_model.layers if l.trainable)
    print(f"  Frozen: {frozen} | Unfrozen: {unfrozen}")

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4),
        loss='categorical_crossentropy',
        metrics=['accuracy',
                 tf.keras.metrics.Precision(name='precision'),
                 tf.keras.metrics.Recall(name='recall')]
    )
             
    # Reset generators
    train_gen.reset()
    adv_gen.reset()

    model.fit(
        combined_gen(train_gen, adv_gen),
        steps_per_epoch=steps,
        validation_data=val_gen,
        epochs=20,
        callbacks=callbacks_p2,
        verbose=1
    )

    p2_acc = max(model.history.history['val_accuracy'])
    print(f"\n  Phase 2 best: {p2_acc:.4f} ({p2_acc*100:.1f}%)")
    print(f"  Improvement: +{(p2_acc - p1_acc)*100:.1f}%")

    print("\n" + "="*60)
    print("  TRAINING COMPLETE ✅")
    print(f"  Final accuracy: {p2_acc*100:.1f}%")
    print(f"  Saved: models/ecox_final_best.h5")
    print("="*60)

except Exception as e:
    print(f"\n❌ ERROR: {e}")
    traceback.print_exc()
    sys.exit(1)