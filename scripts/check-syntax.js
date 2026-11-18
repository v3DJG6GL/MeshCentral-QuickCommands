#!/usr/bin/env node
'use strict';
// Syntax check for CI: `node --check` on every .js file of the repo (node_modules and .git excluded) and a compile
// of every inline <script> block of views/*.handlebars. quickcommands.js fills the page's {{{placeholders}}} with JSON
// (configJson, defaultsJson, targetsJson), so they are replaced with sample JSON of the same shape first.
// Lists every error and exits 1 if there was any; no dependencies.
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var childProcess = require('child_process');

var ROOT = path.join(__dirname, '..');
var SKIP_DIRS = { 'node_modules': true, '.git': true };
var PLACEHOLDERS = { configJson: '{}', defaultsJson: '{}', targetsJson: '{"meshes":[],"nodes":[]}' };

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
        var p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!SKIP_DIRS[e.name]) walk(p, out); }
        else if (e.isFile()) out.push(p);
    });
    return out;
}

// Inline classic scripts of a template: [{ line, code }]. HTML comments are blanked first (keeping line numbers),
// so commented-out markup is ignored like the browser does.
function inlineScripts(html) {
    var text = html.replace(/<!--[\s\S]*?-->/g, function (c) { return c.replace(/[^\n]/g, ' '); });
    var re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, m, out = [];
    while ((m = re.exec(text)) != null) {
        var attrs = m[1];
        if (/\bsrc\s*=/i.test(attrs)) continue;
        var type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs);
        if (type && !/^(text|application)\/(javascript|ecmascript)$/i.test(type[1])) continue;   // JSON, templates, ...
        var line = text.slice(0, m.index + m[0].indexOf('>') + 1).split('\n').length;
        out.push({ line: line, code: m[2] });
    }
    return out;
}
function fillPlaceholders(code, file) {
    return code.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, function (all, name) {
        if (!Object.prototype.hasOwnProperty.call(PLACEHOLDERS, name)) throw new Error(file + ': unknown placeholder ' + all + ' - add sample JSON for it to PLACEHOLDERS in scripts/check-syntax.js');
        return PLACEHOLDERS[name];
    });
}

function main() {
    var files = walk(ROOT, []), failed = 0, checked = 0;
    files.filter(function (f) { return /\.(c|m)?js$/.test(f); }).sort().forEach(function (f) {
        var r = childProcess.spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
        checked++;
        if (r.status !== 0) { failed++; process.stderr.write((r.stderr || r.error || 'node --check failed') + '\n'); }
    });
    files.filter(function (f) { return /\.handlebars$/.test(f); }).sort().forEach(function (f) {
        var rel = path.relative(ROOT, f);
        try {
            inlineScripts(fs.readFileSync(f, 'utf8')).forEach(function (s) {
                checked++;
                // line offset: the block's first line is the line of its <script> tag
                try { new vm.Script(fillPlaceholders(s.code, rel), { filename: rel, lineOffset: s.line - 1 }); }
                catch (e) {
                    failed++;
                    var where = (e.stack || '').split('\n')[0];
                    process.stderr.write(rel + ' (<script> at line ' + s.line + '): ' + e.name + ': ' + e.message + (where.indexOf(rel) == 0 ? ' at ' + where : '') + '\n');
                }
            });
        } catch (e) { failed++; process.stderr.write(e.message + '\n'); }
    });
    process.stdout.write('syntax check: ' + checked + ' files / script blocks, ' + failed + ' with errors\n');
    if (failed) process.exit(1);
}

module.exports = { inlineScripts: inlineScripts, fillPlaceholders: fillPlaceholders };
if (require.main === module) main();
