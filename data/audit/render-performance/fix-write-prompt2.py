"""
Fix write-script.md prompt: update duration target from 35-45s to 30-50s.
"""
prompt = r'C:\Users\user\YOUTUBE\prompts\write-script.md'

with open(prompt, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Duration cap line
old1 = '**Duration cap: ALL videos must be 35-45 seconds.** At 30 fps this means'
new1 = '**Duration cap: ALL videos must be 30-50 seconds.** At 30 fps this means'
if old1 in content:
    content = content.replace(old1, new1)
    print('Fixed duration cap: 35-45 to 30-50')
else:
    print('WARNING: duration cap pattern not found')

# Fix 2: Frame count line
old2 = '1050-1350 frames. Target word count: ~90-120 words (depending on the'
new2 = '900-1500 frames. Target word count: ~75-130 words (depending on the'
if old2 in content:
    content = content.replace(old2, new2)
    print('Fixed frame/word count: 1050-1350/90-120 to 900-1500/75-130')
else:
    print('WARNING: frame count pattern not found')

# Fix 3: Word count target line
old3 = "- Voiceover word count is **90-120 words** (targets 35-45 seconds at the"
new3 = "- Voiceover word count is **75-130 words** (targets 30-50 seconds at the"
if old3 in content:
    content = content.replace(old3, new3)
    print('Fixed word count target: 90-120/35-45 to 75-130/30-50')
else:
    print('WARNING: word count target pattern not found')

with open(prompt, 'w', encoding='utf-8') as f:
    f.write(content)

print('\nwrite-script.md updated')
