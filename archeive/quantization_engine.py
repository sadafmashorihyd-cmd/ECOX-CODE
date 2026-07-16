import tensorflow as tf

def convert_to_tflite():
    print("📉 Starting Robust Quantization...")
    # Load model
    model = tf.keras.models.load_model('ecox_model_pruned.h5')
    
    # Concrete function banayein (Yeh model ko 'freeze' kar deta hai)
    run_model = tf.function(lambda x: model(x))
    concrete_func = run_model.get_concrete_function(
        tf.TensorSpec([1, 224, 224, 3], model.inputs[0].dtype)
    )
    
    # Converter mein concrete function pass karein
    converter = tf.lite.TFLiteConverter.from_concrete_functions([concrete_func])
    converter.optimizations = [tf.lite.Optimize.DEaFAULT]
    
    tflite_model = converter.convert()
    
    with open('ecox_model_optimized.tflite', 'wb') as f:
        f.write(tflite_model)
    print("✅ Quantization Complete: Optimized .tflite model created.")

if __name__ == "__main__":
    convert_to_tflite()