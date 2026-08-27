/**
 * Undefined-identifier check for the scene components.
 *
 * WHY THIS EXISTS. `OppositionComparison` in quantity-scenes.jsx read
 * `f.w`, `f.cx` and `f.h` while `f` was never a parameter, never declared,
 * and never a module binding — a guaranteed ReferenceError the moment a
 * qualitative COMPARISON beat rendered. It survived:
 *
 *   - every text-based check, which does not model scope at all;
 *   - the per-file esbuild parse (VIS-21), which only proves it is syntax;
 *   - the whole-graph esbuild bundle (VIS-23), because a free identifier is
 *     a legal reference to a global as far as a bundler is concerned;
 *   - the render, because that scene's branch never fired in the clips I
 *     had rendered.
 *
 * The gap is real: nothing else here can tell "this name resolves at
 * runtime" from "this name does not exist".
 *
 * WHAT IT DOES AND DOES NOT PROVE. This is a deliberately CONSERVATIVE
 * analysis. Every name bound ANYWHERE inside a function counts as bound for
 * the whole function, so it does not model block scope, shadowing, or
 * temporal-dead-zone errors, and it will not catch a use-before-declare. It
 * catches exactly one thing: a name referenced in a function that has no
 * binding in that function, in any enclosing function, at module scope, or
 * in the global list. That is the bug that shipped, and false positives
 * here would be worse than a narrower net.
 */

import { createRequire } from "module";

const require_ = createRequire(import.meta.url);

/**
 * Globals a browser-rendered Remotion component may legitimately reach for.
 * Kept SHORT on purpose — a long list is a way to make this check quiet
 * rather than correct. Add a name here only when a scene genuinely needs
 * the real global.
 */
const ALLOWED_GLOBALS = new Set([
  // Language
  "Math", "Number", "String", "Boolean", "Object", "Array", "JSON", "Date",
  "Map", "Set", "WeakMap", "WeakSet", "Symbol", "Promise", "RegExp", "Error",
  "TypeError", "RangeError", "Intl", "BigInt", "Proxy", "Reflect",
  "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent",
  "decodeURIComponent", "undefined", "NaN", "Infinity", "globalThis",
  // Browser surface Remotion components actually touch
  "window", "document", "console", "performance", "requestAnimationFrame",
  "cancelAnimationFrame", "setTimeout", "clearTimeout", "setInterval",
  "clearInterval", "URL", "Image", "fetch", "navigator", "getComputedStyle",
  "HTMLElement", "SVGElement", "ResizeObserver", "DOMMatrix",
  // Module surface
  "process", "require", "module", "exports", "__dirname", "__filename",
  "arguments", "this", "super",
]);

/** Node types that introduce a new function scope. */
const FUNCTION_TYPES = new Set([
  "FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression",
  "ObjectMethod", "ClassMethod", "ClassPrivateMethod",
]);

/** Walk every child node of an AST node. */
function children(node) {
  const out = [];
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "range" || key === "leadingComments" || key === "trailingComments" || key === "innerComments") continue;
    const v = node[key];
    if (Array.isArray(v)) {
      for (const c of v) if (c && typeof c.type === "string") out.push(c);
    } else if (v && typeof v.type === "string") {
      out.push(v);
    }
  }
  return out;
}

/** Every name a binding pattern introduces (destructuring included). */
function patternNames(node, into) {
  if (!node) return;
  switch (node.type) {
    case "Identifier":
      into.add(node.name);
      return;
    case "ObjectPattern":
      for (const p of node.properties) {
        if (p.type === "RestElement") patternNames(p.argument, into);
        else patternNames(p.value, into);
      }
      return;
    case "ArrayPattern":
      for (const e of node.elements) patternNames(e, into);
      return;
    case "AssignmentPattern":
      patternNames(node.left, into);
      return;
    case "RestElement":
      patternNames(node.argument, into);
      return;
    default:
      return;
  }
}

/**
 * Every name bound anywhere in this subtree, NOT descending into nested
 * functions (their bindings belong to their own scope).
 */
function bindingsIn(node, into, isRoot) {
  if (!isRoot && FUNCTION_TYPES.has(node.type)) {
    // A nested function contributes only its own name to the outer scope.
    if (node.type === "FunctionDeclaration" && node.id) into.add(node.id.name);
    return;
  }
  switch (node.type) {
    case "VariableDeclarator":
      patternNames(node.id, into);
      break;
    case "FunctionDeclaration":
    case "ClassDeclaration":
      if (node.id) into.add(node.id.name);
      break;
    case "ImportDefaultSpecifier":
    case "ImportNamespaceSpecifier":
    case "ImportSpecifier":
      if (node.local) into.add(node.local.name);
      break;
    case "CatchClause":
      patternNames(node.param, into);
      break;
    default:
      break;
  }
  if (isRoot && FUNCTION_TYPES.has(node.type)) {
    for (const p of node.params) patternNames(p, into);
    if (node.id) into.add(node.id.name);
  }
  for (const c of children(node)) bindingsIn(c, into, false);
}

/**
 * Every identifier this subtree REFERENCES, not descending into nested
 * functions. Property keys, member accessors, JSX attribute names and
 * lowercase JSX intrinsics are not references.
 */
function referencesIn(node, into, isRoot) {
  if (!isRoot && FUNCTION_TYPES.has(node.type)) return;

  if (node.type === "Identifier") {
    into.set(node.name, node.loc ? node.loc.start.line : 0);
    return;
  }
  // `import.meta` / `new.target` — keywords wearing an Identifier node.
  if (node.type === "MetaProperty") return;
  if (node.type === "JSXIdentifier") {
    // <Foo/> is a reference; <div/> is an intrinsic element.
    if (/^[A-Z]/.test(node.name)) into.set(node.name, node.loc ? node.loc.start.line : 0);
    return;
  }

  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "range") continue;
    // Not references: a.b's `b`, {a: 1}'s `a`, <x foo=…>'s `foo`, labels.
    if (key === "property" && !node.computed) continue;
    if (key === "key" && !node.computed) continue;
    if (key === "label") continue;
    if (node.type === "JSXAttribute" && key === "name") continue;
    if (node.type === "JSXNamespacedName") continue;
    if ((node.type === "ImportSpecifier" || node.type === "ExportSpecifier") && key !== "local") continue;
    // A binding pattern names things, it does not reference them — except
    // for defaults and computed keys inside it, which do.
    if ((node.type === "VariableDeclarator" || FUNCTION_TYPES.has(node.type)) && key === "id") continue;
    if (node.type === "ObjectPattern" || node.type === "ArrayPattern" || node.type === "RestElement") continue;
    if (node.type === "AssignmentPattern" && key === "left") continue;
    if (FUNCTION_TYPES.has(node.type) && key === "params") {
      // Defaults inside params are real references.
      for (const p of node.params) if (p.type === "AssignmentPattern") referencesIn(p.right, into, false);
      continue;
    }

    const v = node[key];
    if (Array.isArray(v)) {
      for (const c of v) if (c && typeof c.type === "string") referencesIn(c, into, false);
    } else if (v && typeof v.type === "string") {
      referencesIn(v, into, false);
    }
  }
}

/** Collect every function node in a tree, outermost first. */
function functionsIn(node, out) {
  if (FUNCTION_TYPES.has(node.type)) out.push(node);
  for (const c of children(node)) functionsIn(c, out);
  return out;
}

/**
 * Report every identifier a file references that nothing binds.
 *
 * Returns `[]` when the file is clean, or a list of
 * `{ name, line, fn }` findings.
 */
export function undefinedIdentifiers(source, filename = "<source>") {
  let parser;
  try {
    parser = require_("@babel/parser");
  } catch {
    return [{ name: "@babel/parser", line: 0, fn: "(unavailable)", unavailable: true }];
  }

  const ast = parser.parse(source, {
    sourceType: "module",
    plugins: ["jsx"],
    errorRecovery: false,
  });

  const moduleScope = new Set();
  bindingsIn(ast.program, moduleScope, false);

  const findings = [];
  const seen = new Set();

  // Each function is checked against its OWN bindings plus every enclosing
  // scope. Enclosing scopes are found by containment: cheap, and exact for
  // the shapes these files use.
  const fns = functionsIn(ast.program, []);
  for (const fn of fns) {
    const own = new Set();
    bindingsIn(fn, own, true);

    const enclosing = fns.filter((o) => o !== fn && o.start <= fn.start && o.end >= fn.end);
    for (const outer of enclosing) bindingsIn(outer, own, true);

    const refs = new Map();
    referencesIn(fn.body, refs, false);
    // A concise arrow body is an expression, not a block.
    if (fn.body && fn.body.type !== "BlockStatement") referencesIn(fn.body, refs, false);

    for (const [name, line] of refs) {
      if (own.has(name) || moduleScope.has(name) || ALLOWED_GLOBALS.has(name)) continue;
      const key = `${name}:${line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        name,
        line,
        fn: (fn.id && fn.id.name) || (fn.type === "ArrowFunctionExpression" ? "(arrow)" : "(anonymous)"),
        file: filename,
      });
    }
  }
  return findings;
}
