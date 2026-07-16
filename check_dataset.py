import os

dataset_dir = 'dataset/train_balanced'
print(f"\n{'='*40}")
print(f"DATASET STATUS")
print(f"{'='*40}")

total = 0
for cls in sorted(os.listdir(dataset_dir)):
    path = os.path.join(dataset_dir, cls)
    if os.path.isdir(path):
        count = len(os.listdir(path))
        total += count
        status = "✅" if count >= 500 else "⚠️" if count >= 200 else "❌"
        print(f"{status} {cls:<25} {count} images")

print(f"{'='*40}")
print(f"TOTAL: {total} images")
print(f"{'='*40}\n")
