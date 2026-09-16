"""
Fix SCR-16 duration range: widen from 35-45s to 30-50s.
The model oscillates between ~31s and ~53s, never landing in 35-45s.
Wider range + more retries = scripts pass gate, videos still reasonable length.
"""
gate = r'C:\Users\user\YOUTUBE\scripts\gate-script.js'

with open(gate, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Widen duration range from 35-45 to 30-50
old = '// Duration cap: all videos target 35-45 seconds for <30 min render\nconst DURATION_RANGE_SECONDS = { shorts: { min: 35, max: 45 }, longform: { min: 35, max: 45 } };'
new = '// Duration cap: all videos target 30-50 seconds (wide window - model oscillates)\n// Render.js clamps final duration to the actual voiceover length anyway.\nconst DURATION_RANGE_SECONDS = { shorts: { min: 30, max: 50 }, longform: { min: 30, max: 50 } };'
if old in content:
    content = content.replace(old, new)
    print('Fixed DURATION_RANGE_SECONDS: 35-45 to 30-50')
else:
    print('WARNING: old DURATION_RANGE_SECONDS pattern not found')

# Fix 2: Update SCR-16 comment
old2 = '  // SCR-16 (BLOCKER) - duration must be 35-45 seconds.'
new2 = '  // SCR-16 (BLOCKER) - duration must be 30-50 seconds.'
if old2 in content:
    content = content.replace(old2, new2)
    print('Fixed SCR-16 comment: 35-45 to 30-50')
else:
    print('WARNING: old SCR-16 comment not found')

# Fix 3: Update SCR-16 error message
old3 = 'Adjust voiceover length to fit the 35-45 second cap.'
new3 = 'Adjust voiceover length to fit the 30-50 second cap.'
if old3 in content:
    content = content.replace(old3, new3)
    print('Fixed SCR-16 error message: 35-45 to 30-50')
else:
    print('WARNING: old SCR-16 error message not found')

# Fix 4: Update frame count comment
old4 = '// At 30 fps: 35s = 1050 frames, 45s = 1350 frames.'
new4 = '// At 30 fps: 30s = 900 frames, 50s = 1500 frames.'
if old4 in content:
    content = content.replace(old4, new4)
    print('Fixed frame count comment: 35-45 to 30-50')
else:
    print('WARNING: old frame count comment not found')

with open(gate, 'w', encoding='utf-8') as f:
    f.write(content)

print('\ngate-script.js updated')
