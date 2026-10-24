// Read-only static probe: which hook dependency arrays (transitively) depend on a
// locale-bound value (useTranslations / useLocale results) inside one component/hook.
// Usage: bun locale-deps.ts <file> [seedParam,seedParam...]
import ts from "typescript";
import { readFileSync } from "node:fs";

const [file, seedArg] = process.argv.slice(2);
const src = readFileSync(file, "utf8");
const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const seeds = new Set((seedArg ?? "").split(",").filter(Boolean));
const line = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;

function idents(n: ts.Node, out = new Set<string>()) {
  if (ts.isIdentifier(n)) out.add(n.text);
  // property access: only the base object matters
  if (ts.isPropertyAccessExpression(n)) { idents(n.expression, out); return out; }
  ts.forEachChild(n, c => { idents(c, out); });
  return out;
}
const calleeName = (c: ts.CallExpression) => ts.isIdentifier(c.expression) ? c.expression.text
  : ts.isPropertyAccessExpression(c.expression) ? c.expression.name.text : "";

type Decl = { names: string[]; init: ts.Expression; line: number };
const decls: Decl[] = [];
const effects: { kind: string; deps: string[]; line: number }[] = [];
const hookCalls: { name: string; props: Map<string, Set<string>>; outputs: string[]; line: number }[] = [];

function bindingNames(b: ts.BindingName): string[] {
  if (ts.isIdentifier(b)) return [b.text];
  const r: string[] = [];
  for (const el of b.elements) if (!ts.isOmittedExpression(el)) r.push(...bindingNames(el.name));
  return r;
}
function visit(n: ts.Node) {
  if (ts.isVariableDeclaration(n) && n.initializer) {
    decls.push({ names: bindingNames(n.name), init: n.initializer, line: line(n) });
  }
  if (ts.isCallExpression(n)) {
    const name = calleeName(n);
    if (["useEffect", "useLayoutEffect", "useInsertionEffect"].includes(name) && n.arguments[1] && ts.isArrayLiteralExpression(n.arguments[1])) {
      effects.push({ kind: name, deps: n.arguments[1].elements.map(e => e.getText()), line: line(n) });
    }
  }
  ts.forEachChild(n, visit);
}
visit(sf);

const L = new Set<string>(seeds);
const hookArgs = new Set<string>();
const why = new Map<string, string>();
for (const s of seeds) why.set(s, "seed");
let changed = true;
while (changed) {
  changed = false;
  for (const d of decls) {
    let hit: string | undefined;
    const init = ts.isAsExpression(d.init) ? d.init.expression : d.init;
    if (ts.isCallExpression(init)) {
      const name = calleeName(init);
      if (name === "useTranslations" || name === "useLocale" || name === "useFormatter" || name === "useNow") hit = name + "()";
      else if (name === "useCallback" || name === "useMemo") {
        const depsArg = init.arguments[1];
        if (depsArg && ts.isArrayLiteralExpression(depsArg)) {
          for (const e of depsArg.elements) for (const id of idents(e)) if (L.has(id)) { hit = `${name} dep ${id}`; break; }
        }
      } else if (name === "useRef" || name === "useState" || name === "useReducer") {
        hit = undefined; // stable identity
      } else if (/^use[A-Z]/.test(name)) {
        // custom hook: outputs are only locale-bound when the hook's own analysis says so
        // (pass them via the EXTRA env, "hookName:output,output;..."); record locale-bound args.
        const extra = (process.env.EXTRA ?? "").split(";").map(x => x.split(":")).find(([h]) => h === name);
        const outs = new Set((extra?.[1] ?? "").split(",").filter(Boolean));
        if (outs.size) { for (const nm of d.names) if (outs.has(nm) && !L.has(nm)) { L.add(nm); why.set(nm, `${name} output (line ${d.line})`); changed = true; } }
        const arg = init.arguments[0];
        if (arg && ts.isObjectLiteralExpression(arg)) for (const pr of arg.properties) {
          const key = pr.name && ts.isIdentifier(pr.name) ? pr.name.text : pr.getText();
          const val = ts.isShorthandPropertyAssignment(pr) ? new Set([pr.name.text]) : ts.isPropertyAssignment(pr) ? idents(pr.initializer) : new Set<string>();
          for (const id of val) if (L.has(id)) hookArgs.add(`${name} line ${d.line}: param ${key} <- ${id}`);
        }
      } else {
        for (const id of idents(init)) if (L.has(id)) { hit = `expr ${id}`; break; }
      }
    } else if (!ts.isArrowFunction(init) && !ts.isFunctionExpression(init)) {
      for (const id of idents(init)) if (L.has(id)) { hit = `expr ${id}`; break; }
    }
    if (hit) for (const nm of d.names) if (!L.has(nm)) { L.add(nm); why.set(nm, `${hit} (line ${d.line})`); changed = true; }
  }
}

console.log(`# ${file}`);
console.log(`locale-bound names (${L.size}):`);
for (const nm of L) console.log(`  ${nm}  <- ${why.get(nm)}`);
// statement-level custom hook calls (no destructured output)
(function stmt(n: ts.Node) {
  if (ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && /^use[A-Z]/.test(calleeName(n.expression))) {
    const c = n.expression, arg = c.arguments[0];
    if (arg && ts.isObjectLiteralExpression(arg)) for (const pr of arg.properties) {
      const key = pr.name && ts.isIdentifier(pr.name) ? pr.name.text : pr.getText();
      const val = ts.isShorthandPropertyAssignment(pr) ? new Set([pr.name.text]) : ts.isPropertyAssignment(pr) ? idents(pr.initializer) : new Set<string>();
      for (const id of val) if (L.has(id)) hookArgs.add(`${calleeName(c)} line ${line(c)} (statement): param ${key} <- ${id}`);
    }
  }
  ts.forEachChild(n, stmt);
})(sf);
console.log(`custom hook params fed with locale-bound values:`);
for (const h of hookArgs) console.log(`  ${h}`);
console.log(`effects with locale-bound deps:`);
for (const e of effects) {
  const hits = e.deps.filter(dep => [...idents(ts.createSourceFile("x.ts", dep, ts.ScriptTarget.Latest, true))].some(id => L.has(id)));
  if (hits.length) console.log(`  ${e.kind} line ${e.line}: [${hits.join(", ")}]`);
}
