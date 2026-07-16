import re

with open('ipfs_manager.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the path
old = """        self._local_backup_dir = os.path.join(
            os.path.dirname(os.path.dirname(
                os.path.dirname(os.path.abspath(__file__))
            )), 'logs', 'ipfs_backup'
        )"""

new = """        self._local_backup_dir = os.path.join('/app', 'logs', 'ipfs_backup')"""

content = content.replace(old, new)

with open('ipfs_manager.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done! Path fixed.')