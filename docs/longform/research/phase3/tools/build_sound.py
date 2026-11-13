import os, subprocess, sys
from docs_common import *
subprocess.run([sys.executable, "doc_sound.py"], check=True)
open(os.path.join(DOCS, "SOUND-DESIGN-RESEARCH.md"), "w", encoding="utf8").write(open(os.path.join(HERE, "_sound_head.md"), encoding="utf8").read() + "\n" + open(os.path.join(HERE, "_sound_grammar.md"), encoding="utf8").read())
print("wrote SOUND-DESIGN-RESEARCH.md")
