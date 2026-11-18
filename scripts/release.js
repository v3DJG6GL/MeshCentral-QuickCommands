#!/usr/bin/env node
'use strict';
// Version and changelog logic for .github/workflows/release.yml. No dependencies.
//
//   node scripts/release.js plan [--bump auto|patch|minor|major]
//       Prints {release, reason, current, next, bump, notes, repair} as JSON. Changes nothing.
//       current = newest vX.Y.Z git tag (fallback: config.json "version").
//       bump auto: from the changelog's [Unreleased] section (Keep a Changelog):
//         empty or missing                        -> no release
//         a breaking marker (**Breaking ..., ### Breaking, BREAKING CHANGE)
//                                                 -> major, or minor while the major version is 0
//         ### Added                               -> minor
//         anything else (Changed, Fixed, ...)     -> patch
//       "[skip release]" in the HEAD commit message, or a HEAD that is a "Release v..." commit, also means no
//       release in auto mode. When HEAD already carries a version tag, the result is {release: false, repair: tag}:
//       only the GitHub release for that tag may be missing (unless an explicit bump asks for a new version).
//   node scripts/release.js apply --version X.Y.Z --date YYYY-MM-DD
//       Writes the version into config.json and readme.md and turns [Unreleased] into [X.Y.Z] - date in changelog.md.
//   node scripts/release.js notes --version X.Y.Z
//       Prints the body of the changelog section [X.Y.Z].
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

var ROOT = path.join(__dirname, '..');
var BUMPS = ['auto', 'patch', 'minor', 'major'];
var SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(v) {
    var m = SEMVER.exec(String(v == null ? '' : v).trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function compareVersions(a, b) {
    var x = parseVersion(a), y = parseVersion(b);
    for (var i = 0; i < 3; i++) { if (x[i] != y[i]) return x[i] < y[i] ? -1 : 1; }
    return 0;
}
// Newest X.Y.Z of a list of tags (only exact vX.Y.Z tags count), without the leading v; null if none.
function newestVersion(tags) {
    var vs = (tags || []).map(function (t) { return String(t).trim(); })
        .filter(function (t) { return /^v\d+\.\d+\.\d+$/.test(t); })
        .map(function (t) { return t.slice(1); });
    if (vs.length == 0) return null;
    vs.sort(compareVersions);
    return vs[vs.length - 1];
}
function bumpVersion(current, bump) {
    var v = parseVersion(current);
    if (v == null) throw new Error('not a version: ' + current);
    if (bump == 'major') return (v[0] + 1) + '.0.0';
    if (bump == 'minor') return v[0] + '.' + (v[1] + 1) + '.0';
    if (bump == 'patch') return v[0] + '.' + v[1] + '.' + (v[2] + 1);
    throw new Error('unknown bump: ' + bump);
}

function eolOf(text) { return /\r\n/.test(text) ? '\r\n' : '\n'; }
function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// A level-2 section of the changelog: the heading "## [name]..." up to the next "## " heading.
// Returns { headingStart, bodyStart, end, body } (offsets into text) or null.
function findSection(text, name) {
    var re = new RegExp('^##[ \\t]+\\[' + escapeRe(name) + '\\][^\\r\\n]*(\\r?\\n|$)', 'im');
    var m = re.exec(text);
    if (m == null) return null;
    var bodyStart = m.index + m[0].length;
    var next = /^##[ \t]/m.exec(text.slice(bodyStart));
    var end = next ? bodyStart + next.index : text.length;
    return { headingStart: m.index, bodyStart: bodyStart, end: end, body: text.slice(bodyStart, end) };
}
function unreleasedBody(changelog) {
    var s = findSection(changelog, 'Unreleased');
    return s ? s.body : null;
}
// Body of a section without leading/trailing blank lines (line endings as in the file).
function sectionNotes(changelog, name) {
    var s = findSection(changelog, name);
    return s ? s.body.replace(/^(\s*\r?\n)+/, '').replace(/\s+$/, '') : null;
}
// True when a section holds no entries: only blank lines, ### headings and HTML comments.
function isEmptySection(body) {
    if (body == null) return true;
    return body.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/).every(function (l) { return l.trim() == '' || /^###/.test(l.trim()); });
}
// Bump level for a non-empty [Unreleased] body; null when it is empty.
function detectBump(body, current) {
    if (isEmptySection(body)) return null;
    var breaking = /\*\*[ \t]*breaking/i.test(body) || /^###[ \t]+breaking/im.test(body) || /BREAKING[ \t-]CHANGE/i.test(body);
    if (breaking) return (parseVersion(current) || [0])[0] >= 1 ? 'major' : 'minor';
    if (/^###[ \t]+added\b/im.test(body)) return 'minor';
    return 'patch';
}

// Decide what a release run does. All inputs are plain values so this is testable without git:
//   changelog (text), configVersion, tags (all tags), headTags (tags on HEAD), headMessage, bump.
function planRelease(input) {
    var bump = input.bump || 'auto';
    if (BUMPS.indexOf(bump) < 0) throw new Error('--bump must be one of ' + BUMPS.join(', '));
    var current = newestVersion(input.tags) || (parseVersion(input.configVersion) ? String(input.configVersion).trim() : null);
    if (current == null) throw new Error('no vX.Y.Z tag and no valid "version" in config.json');
    var notesBody = unreleasedBody(input.changelog || '');
    var notes = notesBody == null ? '' : notesBody.replace(/^(\s*\r?\n)+/, '').replace(/\s+$/, '');
    var out = { release: false, reason: '', current: current, next: null, bump: null, notes: notes, repair: null };
    var message = String(input.headMessage || '');

    // HEAD is already a release: only the GitHub release can be missing. An explicit minor/major still makes a
    // new release, unless HEAD's tag already is that boundary (a re-run of the same manual release).
    var headVersion = newestVersion(input.headTags);
    if (headVersion != null) {
        var hv = parseVersion(headVersion);
        var sameBoundary = bump == 'auto' || bump == 'patch' || (bump == 'minor' && hv[2] == 0) || (bump == 'major' && hv[1] == 0 && hv[2] == 0);
        if (sameBoundary) {
            out.repair = 'v' + headVersion;
            out.reason = 'HEAD is already tagged v' + headVersion + ' - only check that its GitHub release exists';
            out.notes = sectionNotes(input.changelog || '', headVersion) || '';
            return out;
        }
    }

    if (bump == 'auto') {
        if (message.indexOf('[skip release]') >= 0) { out.reason = '[skip release] in the HEAD commit message'; return out; }
        if (/^Release v/.test(message)) { out.reason = 'HEAD is a release commit'; return out; }
        if (notesBody == null) { out.reason = 'changelog.md has no [Unreleased] section'; return out; }
        var detected = detectBump(notesBody, current);
        if (detected == null) { out.reason = 'the [Unreleased] section of changelog.md is empty'; return out; }
        out.bump = detected;
        out.reason = 'bump ' + detected + ' derived from the [Unreleased] section';
    } else {
        out.bump = bump;
        out.reason = 'bump ' + bump + ' requested';
    }
    out.next = bumpVersion(current, out.bump);
    out.release = true;
    return out;
}

// ---- file rewrites (formatting is preserved: only the version text is replaced) -----------------------------
function applyConfig(text, version) {
    var re = /("version"[ \t]*:[ \t]*")[^"]*(")/;
    if (!re.test(text)) throw new Error('config.json: no "version" field');
    var out = text.replace(re, function (m, a, b) { return a + version + b; });
    if (JSON.parse(out).version !== version) throw new Error('config.json: version not updated');
    return out;
}
function applyReadme(text, version, date) {
    var reV = /^(\*Current Version:[ \t]*)[^\r\n]*$/m, reD = /^(Released:[ \t]*)[^\r\n*]*(\*?)[ \t]*$/m;
    if (!reV.test(text)) throw new Error('readme.md: no "*Current Version: " line');
    if (!reD.test(text)) throw new Error('readme.md: no "Released: ...*" line');
    return text.replace(reV, function (m, a) { return a + version; })
               .replace(reD, function (m, a, star) { return a + date + star; });
}
function applyChangelog(text, version, date) {
    if (findSection(text, version)) throw new Error('changelog.md: a [' + version + '] section already exists');
    var eol = eolOf(text);
    var heading = '## [' + version + '] - ' + date;
    var s = findSection(text, 'Unreleased');
    if (s) {
        // "## [Unreleased]" -> fresh empty [Unreleased], blank line, "## [X.Y.Z] - date" over the old body
        return text.slice(0, s.headingStart) + '## [Unreleased]' + eol + eol + heading + eol + text.slice(s.bodyStart);
    }
    // no [Unreleased]: put both headings above the newest version section (or at the end)
    var m = /^##[ \t]+\[\d+\.\d+\.\d+\]/m.exec(text);
    var block = '## [Unreleased]' + eol + eol + heading + eol + eol;
    if (m) return text.slice(0, m.index) + block + text.slice(m.index);
    return text.replace(/\s*$/, '') + eol + eol + block.replace(/\s+$/, '') + eol;
}
function applyRelease(root, version, date) {
    if (!parseVersion(version) || /^v/.test(version)) throw new Error('--version must be X.Y.Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('--date must be YYYY-MM-DD');
    var files = {
        'config.json': function (t) { return applyConfig(t, version); },
        'readme.md': function (t) { return applyReadme(t, version, date); },
        'changelog.md': function (t) { return applyChangelog(t, version, date); }
    };
    var results = {};
    Object.keys(files).forEach(function (f) { results[f] = files[f](fs.readFileSync(path.join(root, f), 'utf8')); });   // all or nothing
    Object.keys(results).forEach(function (f) { fs.writeFileSync(path.join(root, f), results[f]); });
    return Object.keys(results);
}

// ---- CLI ------------------------------------------------------------------------------------------------------
function git(root, args) {
    try { return childProcess.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch (e) { return ''; }
}
function lines(s) { return String(s).split(/\r?\n/).filter(function (l) { return l.trim() != ''; }); }
function parseArgs(argv) {
    var a = { _: [] };
    for (var i = 0; i < argv.length; i++) {
        var m = /^--([^=]+)(?:=(.*))?$/.exec(argv[i]);
        if (m) { a[m[1]] = m[2] != null ? m[2] : argv[++i]; } else a._.push(argv[i]);
    }
    return a;
}
function main(argv) {
    var args = parseArgs(argv), cmd = args._[0], root = args.root ? path.resolve(args.root) : ROOT;
    if (cmd == 'plan') {
        var cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
        var changelogPath = path.join(root, 'changelog.md');
        var result = planRelease({
            changelog: fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '',
            configVersion: cfg.version,
            tags: lines(git(root, ['tag', '-l', 'v*'])),
            headTags: lines(git(root, ['tag', '--points-at', 'HEAD', '-l', 'v*'])),
            headMessage: git(root, ['log', '-1', '--format=%B', 'HEAD']),
            bump: args.bump || 'auto'
        });
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else if (cmd == 'apply') {
        var changed = applyRelease(root, args.version, args.date);
        process.stdout.write('updated ' + changed.join(', ') + ' to ' + args.version + '\n');
    } else if (cmd == 'notes') {
        if (!parseVersion(args.version)) throw new Error('--version must be X.Y.Z');
        var notes = sectionNotes(fs.readFileSync(path.join(root, 'changelog.md'), 'utf8'), String(args.version).replace(/^v/, ''));
        if (notes) process.stdout.write(notes + '\n');
    } else {
        throw new Error('usage: release.js plan [--bump auto|patch|minor|major] | apply --version X.Y.Z --date YYYY-MM-DD | notes --version X.Y.Z  (all take --root DIR)');
    }
}

module.exports = {
    parseVersion: parseVersion, compareVersions: compareVersions, newestVersion: newestVersion, bumpVersion: bumpVersion,
    findSection: findSection, unreleasedBody: unreleasedBody, sectionNotes: sectionNotes, isEmptySection: isEmptySection,
    detectBump: detectBump, planRelease: planRelease,
    applyConfig: applyConfig, applyReadme: applyReadme, applyChangelog: applyChangelog, applyRelease: applyRelease
};

if (require.main === module) {
    try { main(process.argv.slice(2)); }
    catch (e) { process.stderr.write('release.js: ' + e.message + '\n'); process.exit(1); }
}
