import os
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import tensorflow as tf
from tensorflow.keras import layers
from tensorflow.keras.applications import EfficientNetB0
from src.utils.constants import CONFIG


def build_model():
    """
    EfficientNetB0 based model — 12 classes
    Replaces old toy model (10 class Conv2D)
    """
    print("\n" + "="*55)
    print("🧠 MODEL CREATION ENGINE")
    print("="*55)

    base_model = EfficientNetB0(
        weights='imagenet',
        include_top=False,
        input_shape=(224, 224, 3)
    )
    base_model.trainable = False

    model = tf.keras.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.BatchNormalization(),
        layers.Dense(512, activation='relu'),
        layers.Dropout(0.4),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(CONFIG['NUM_CLASSES'], activation='softmax')
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(
            learning_rate=CONFIG['LEARNING_RATE']
        ),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    print(f"   Architecture:  EfficientNetB0 ✅")
    print(f"   Classes:       {CONFIG['NUM_CLASSES']} ✅")
    print(f"   Input shape:   (224, 224, 3) ✅")
    print(f"   Parameters:    {model.count_params():,}")

    os.makedirs('models', exist_ok=True)
    
    # Base model alag save karo — trained model overwrite nahi hoga!
    model.save('models/ecox_base_model.h5')

    print(f"   Saved to:      models/ecox_base_model.h5 ✅")
    print(f"   Trained model: models/ecox_final_best.h5 SAFE ✅")
    print(f"\n{'='*55}")
    print(f"✅ P10 FIXED: EfficientNetB0 12-class model!")
    print(f"{'='*55}\n")

    return model


if __name__ == "__main__":
    build_model()