// probe-node-browser-only.js — machine evidence for the browser-only
// constraint of @remotion/layout-utils@4.0.506 measureText.
// LAYOUT-SYSTEM §4/§R3 says compile.js "runs in Node before any browser
// starts" and calls measureText() at compile time. This probe shows what the
// installed package actually does in Node.
"use strict";
const { measureText, fitTextOnNLines, fillTextBox, fitText } = require("@remotion/layout-utils");

function tryCall(name, fn) {
  try {
    const r = fn();
    console.log(name + ": NO-THROW " + JSON.stringify(r));
  } catch (e) {
    console.log(name + ": THREW " + JSON.stringify(String(e && e.message || e).split("\n")[0]));
  }
}

tryCall("measureText", () =>
  measureText({ text: "Hello", fontFamily: "Arial", fontSize: 12 })
);
tryCall("fitTextOnNLines", () =>
  fitTextOnNLines({ text: "Hello", maxBoxWidth: 100, maxLines: 2, fontFamily: "Arial", fontWeight: "bold" })
);
tryCall("fillTextBox", () => {
  const box = fillTextBox({ maxBoxWidth: 100, maxLines: 1 });
  return box.add({ text: "Hello", fontFamily: "Arial", fontSize: 12 });
});
tryCall("fitText", () => fitText({ text: "Hello", withinWidth: 100, fontFamily: "Arial", fontSize: 12 }));

const pkg = require("@remotion/layout-utils/package.json");
console.log("installed-version: " + pkg.version);
