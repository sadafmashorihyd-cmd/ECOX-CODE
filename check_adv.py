import os

adv_dir = 'dataset/train_adversarial'
print(f"\n{'='*40}")
print(f"ADVERSARIAL DATASET")
print(f"{'='*40}")

total = 0
for cls in sorted(os.listdir(adv_dir)):
    path = os.path.join(adv_dir, cls)
    if os.path.isdir(path):
        count = len(os.listdir(path))
        total += count
        print(f"  {cls:<25} {count} images")

print(f"{'='*40}")
print(f"TOTAL: {total} images")
print(f"{'='*40}\n")
