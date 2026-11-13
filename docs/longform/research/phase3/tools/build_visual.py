import os
from docs_common import *
import subprocess, sys
subprocess.run([sys.executable, "doc_visual.py"], check=True)
head = open(os.path.join(HERE, "_visual_head.md"), encoding="utf8").read()
body = open(os.path.join(HERE, "_visual_findings.md"), encoding="utf8").read()
open(os.path.join(DOCS, "VISUAL-EDITING-RESEARCH.md"), "w", encoding="utf8").write(head + "\n" + body)
print("wrote VISUAL-EDITING-RESEARCH.md")
