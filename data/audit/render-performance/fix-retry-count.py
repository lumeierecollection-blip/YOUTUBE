"""
Fix workflow retry loop: increase script gate retries from 3 to 5.
The model oscillates between ~31s and ~53s, so 3 attempts often isn't enough.
5 attempts gives it more chances to land in the 30-50s window.
"""
wf = r'C:\Users\user\YOUTUBE\.github\workflows\daily-pipeline-v2.yml'

with open(wf, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Change "attempt $ATTEMPT/3" to "attempt $ATTEMPT/5"
old1 = 'echo "::warning::script gate rejected attempt $ATTEMPT/3 for $SCRIPT_SLUG"'
new1 = 'echo "::warning::script gate rejected attempt $ATTEMPT/5 for $SCRIPT_SLUG"'
if old1 in content:
    content = content.replace(old1, new1)
    print('Fixed attempt counter: 3 to 5')
else:
    print('WARNING: attempt counter pattern not found')

# Fix 2: Change "after 3 attempts" to "after 5 attempts"
old2 = 'echo "::error::script gate still failing for $SCRIPT_SLUG after 3 attempts"'
new2 = 'echo "::error::script gate still failing for $SCRIPT_SLUG after 5 attempts"'
if old2 in content:
    content = content.replace(old2, new2)
    print('Fixed final error message: 3 to 5')
else:
    print('WARNING: final error message pattern not found')

# Fix 3: Change the for loop from "for ATTEMPT in 1 2 3" to "for ATTEMPT in 1 2 3 4 5"
old3 = 'for ATTEMPT in 1 2 3; do'
new3 = 'for ATTEMPT in 1 2 3 4 5; do'
if old3 in content:
    content = content.replace(old3, new3)
    print('Fixed for loop: 1 2 3 to 1 2 3 4 5')
else:
    print('WARNING: for loop pattern not found')

with open(wf, 'w', encoding='utf-8') as f:
    f.write(content)

print('\ndaily-pipeline-v2.yml updated')
