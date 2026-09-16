"""
Fix remaining attempt counter in the echo header line.
"""
wf = r'C:\Users\user\YOUTUBE\.github\workflows\daily-pipeline-v2.yml'

with open(wf, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 321 (0-indexed: 320) has the header echo
idx = 320
old_line = lines[idx]
# Replace /3) === with /5) ===
new_line = old_line.replace('/3) ===', '/5) ===')
if new_line != old_line:
    lines[idx] = new_line
    with open(wf, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print('Fixed line %d: attempt counter 3 -> 5' % (idx+1))
else:
    print('No change needed on line %d' % (idx+1))
