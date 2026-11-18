'use strict';
// scripts/release.js: bump detection, release planning, file rewrites and release notes.
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var R = require('../scripts/release.js');

var HEAD = '# Changelog\nAll notable changes.\n\n## [Known Issues]\n- None.\n\n';
var OLD = '## [0.1.14] - 2026-11-14\n### Fixed\n- An old fix\n\n## [0.1.13] - 2026-09-19\n### Fixed\n- Older\n';
function changelog(unreleased) { return HEAD + (unreleased == null ? '' : '## [Unreleased]\n' + unreleased + '\n') + OLD; }
var TAGS = ['v0.1.9', 'v0.1.10', 'v0.1.14', 'v0.1.11', 'not-a-version', 'v0.2.0-rc1'];
function plan(extra) { return R.planRelease(Object.assign({ changelog: changelog('### Fixed\n- A fix\n'), configVersion: '0.1.14', tags: TAGS, headTags: [], headMessage: 'Fix a thing\n', bump: 'auto' }, extra)); }

test('versions: parse, compare numerically, newest exact vX.Y.Z tag, bump', function () {
    assert.deepStrictEqual(R.parseVersion('v1.2.3'), [1, 2, 3]);
    assert.strictEqual(R.parseVersion('1.2'), null);
    assert.strictEqual(R.compareVersions('0.1.10', '0.1.9'), 1);
    assert.strictEqual(R.newestVersion(TAGS), '0.1.14');
    assert.strictEqual(R.newestVersion([]), null);
    assert.strictEqual(R.bumpVersion('0.1.14', 'patch'), '0.1.15');
    assert.strictEqual(R.bumpVersion('0.1.14', 'minor'), '0.2.0');
    assert.strictEqual(R.bumpVersion('0.1.14', 'major'), '1.0.0');
    assert.throws(function () { R.bumpVersion('0.1.14', 'huge'); });
});

test('detectBump: empty -> null, Changed/Fixed/Security -> patch, Added -> minor, breaking -> major (minor in 0.x)', function () {
    assert.strictEqual(R.detectBump('', '0.1.0'), null);
    assert.strictEqual(R.detectBump('\n\n', '0.1.0'), null);
    assert.strictEqual(R.detectBump('### Added\n\n### Fixed\n', '0.1.0'), null, 'headings without entries are empty');
    assert.strictEqual(R.detectBump('<!-- nothing yet -->\n', '0.1.0'), null);
    assert.strictEqual(R.detectBump(null, '0.1.0'), null);
    assert.strictEqual(R.detectBump('### Fixed\n- x\n', '0.1.0'), 'patch');
    assert.strictEqual(R.detectBump('### Security\n- x\n### Deprecated\n- y\n', '1.0.0'), 'patch');
    assert.strictEqual(R.detectBump('### Added\n- x\n', '0.1.0'), 'minor');
    assert.strictEqual(R.detectBump('### Changed\n- x\n', '0.1.0'), 'patch', 'Changed alone is a patch');
    assert.strictEqual(R.detectBump('### changed\n- x\n### Fixed\n- y\n', '2.3.4'), 'patch');
    assert.strictEqual(R.detectBump('### Changed\n- x\n### Added\n- y\n', '1.2.3'), 'minor', 'Added wins over Changed');
    assert.strictEqual(R.detectBump('### added\n- x\n', '2.0.0'), 'minor');
    assert.strictEqual(R.detectBump('### Changed\n- **Breaking: access changed.** More\n', '0.1.14'), 'minor');
    assert.strictEqual(R.detectBump('### Changed\n- **breaking** api\n', '1.4.2'), 'major');
    assert.strictEqual(R.detectBump('### Breaking\n- removed x\n', '3.0.0'), 'major');
    assert.strictEqual(R.detectBump('### Fixed\n- line breaking in long messages\n', '1.0.0'), 'patch', 'the plain word is no marker');
});

test('planRelease: auto mode', function () {
    var p = plan();
    assert.deepStrictEqual([p.release, p.current, p.next, p.bump], [true, '0.1.14', '0.1.15', 'patch']);
    assert.strictEqual(p.notes, '### Fixed\n- A fix');
    p = plan({ changelog: changelog('### Added\n- New\n### Changed\n- **Breaking: x**\n') });
    assert.deepStrictEqual([p.release, p.next, p.bump], [true, '0.2.0', 'minor']);
    p = plan({ changelog: changelog('') });
    assert.strictEqual(p.release, false);
    assert.match(p.reason, /empty/);
    assert.strictEqual(p.next, null);
    p = plan({ changelog: changelog(null) });
    assert.strictEqual(p.release, false);
    assert.match(p.reason, /no \[Unreleased\]/);
    p = plan({ headMessage: 'Docs\n\nTypo only [skip release]\n' });
    assert.strictEqual(p.release, false);
    assert.match(p.reason, /skip release/);
    p = plan({ headMessage: 'Release v0.1.14 [skip ci]\n' });
    assert.strictEqual(p.release, false);
});

test('planRelease: explicit bump overrides the changelog and [skip release]', function () {
    var p = plan({ bump: 'minor', changelog: changelog(''), headMessage: 'x [skip release]' });
    assert.deepStrictEqual([p.release, p.next, p.bump], [true, '0.2.0', 'minor']);
    assert.strictEqual(plan({ bump: 'major' }).next, '1.0.0');
    assert.throws(function () { plan({ bump: 'huge' }); }, /--bump/);
});

test('planRelease: current version is the newest tag, config.json only without tags', function () {
    assert.strictEqual(plan({ tags: [], configVersion: '0.3.1' }).next, '0.3.2');
    assert.throws(function () { plan({ tags: [], configVersion: 'x' }); });
    assert.strictEqual(plan({ tags: ['v0.1.14', 'v0.1.15'], configVersion: '0.1.14' }).next, '0.1.16', 'the tag wins over config.json');
});

test('planRelease: a HEAD that is already tagged only repairs its GitHub release', function () {
    var cl = HEAD + '## [Unreleased]\n\n## [0.1.15] - 2026-11-18\n### Fixed\n- A fix\n\n' + OLD;
    var p = plan({ changelog: cl, tags: TAGS.concat('v0.1.15'), headTags: ['v0.1.15'], headMessage: 'Release v0.1.15 [skip ci]' });
    assert.deepStrictEqual([p.release, p.repair, p.next], [false, 'v0.1.15', null]);
    assert.strictEqual(p.notes, '### Fixed\n- A fix');
    assert.strictEqual(plan({ changelog: cl, tags: TAGS.concat('v0.1.15'), headTags: ['v0.1.15'], bump: 'patch' }).repair, 'v0.1.15');
    // a manual minor on a patch-tagged HEAD is a new release; on a minor-tagged HEAD it is a re-run
    p = plan({ changelog: cl, tags: TAGS.concat('v0.1.15'), headTags: ['v0.1.15'], bump: 'minor' });
    assert.deepStrictEqual([p.release, p.next, p.repair], [true, '0.2.0', null]);
    p = plan({ changelog: cl, tags: TAGS.concat('v0.2.0'), headTags: ['v0.2.0'], bump: 'minor' });
    assert.deepStrictEqual([p.release, p.repair], [false, 'v0.2.0']);
    p = plan({ changelog: cl, tags: TAGS.concat('v0.2.0'), headTags: ['v0.2.0'], bump: 'major' });
    assert.deepStrictEqual([p.release, p.next], [true, '1.0.0']);
});

test('applyConfig: only the version changes, formatting and the missing trailing newline are kept', function () {
    var src = '{\n  "name": "Event Log",\n  "version": "0.1.14",\n  "repository": {\n    "type": "git"\n  },\n  "meshCentralCompat": ">=0.9.29"\n}';
    var out = R.applyConfig(src, '0.2.0');
    assert.strictEqual(out, src.replace('"0.1.14"', '"0.2.0"'));
    assert.ok(!out.endsWith('\n'));
    assert.throws(function () { R.applyConfig('{ "name": "x" }', '1.0.0'); });
});

test('applyReadme: version and release date lines at the top', function () {
    var src = '# MeshCentral-EventLog\n\n*Current Version: 0.1.14\nReleased: 2026-09-01*\n\nText mentioning Released: later\n';
    var out = R.applyReadme(src, '0.2.0', '2026-11-18');
    assert.strictEqual(out, '# MeshCentral-EventLog\n\n*Current Version: 0.2.0\nReleased: 2026-11-18*\n\nText mentioning Released: later\n');
    assert.throws(function () { R.applyReadme('# x\n', '0.2.0', '2026-11-18'); });
});

test('applyChangelog: [Unreleased] becomes the version section under a fresh empty [Unreleased]', function () {
    var src = changelog('### Added\n- New thing\n');
    var out = R.applyChangelog(src, '0.2.0', '2026-11-18');
    assert.strictEqual(out, HEAD + '## [Unreleased]\n\n## [0.2.0] - 2026-11-18\n### Added\n- New thing\n\n' + OLD);
    assert.strictEqual(R.sectionNotes(out, '0.2.0'), '### Added\n- New thing');
    assert.strictEqual(R.detectBump(R.unreleasedBody(out), '0.2.0'), null, 'the new [Unreleased] is empty');
    assert.throws(function () { R.applyChangelog(out, '0.2.0', '2026-11-18'); }, /already exists/);
    // CRLF files keep CRLF
    var crlf = R.applyChangelog(src.replace(/\n/g, '\r\n'), '0.2.0', '2026-11-18');
    assert.strictEqual(crlf, out.replace(/\n/g, '\r\n'));
    // no [Unreleased] section: both headings go above the newest version
    assert.strictEqual(R.applyChangelog(changelog(null), '0.1.15', '2026-11-18'), HEAD + '## [Unreleased]\n\n## [0.1.15] - 2026-11-18\n\n' + OLD);
});

test('sectionNotes: body of a version section without surrounding blank lines', function () {
    assert.strictEqual(R.sectionNotes(OLD, '0.1.14'), '### Fixed\n- An old fix');
    assert.strictEqual(R.sectionNotes(OLD, '0.1.13'), '### Fixed\n- Older');
    assert.strictEqual(R.sectionNotes(OLD, '0.1.1'), null, 'the version dots are literal');
    assert.strictEqual(R.sectionNotes(changelog(''), 'Unreleased'), '');
});

test('applyRelease rewrites the three files of a repo copy; nothing is written when one of them fails', function () {
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evl-release-'));
    try {
        fs.writeFileSync(path.join(dir, 'config.json'), '{\n  "version": "0.1.14"\n}');
        fs.writeFileSync(path.join(dir, 'readme.md'), '# X\n\n*Current Version: 0.1.14\nReleased: 2026-09-01*\n');
        fs.writeFileSync(path.join(dir, 'changelog.md'), changelog('### Fixed\n- y\n'));
        assert.deepStrictEqual(R.applyRelease(dir, '0.1.15', '2026-11-18').sort(), ['changelog.md', 'config.json', 'readme.md']);
        assert.strictEqual(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'), '{\n  "version": "0.1.15"\n}');
        assert.match(fs.readFileSync(path.join(dir, 'readme.md'), 'utf8'), /Current Version: 0\.1\.15\nReleased: 2026-11-18\*/);
        assert.match(fs.readFileSync(path.join(dir, 'changelog.md'), 'utf8'), /## \[Unreleased\]\n\n## \[0\.1\.15\] - 2026-11-18\n### Fixed\n- y\n/);
        // second apply of the same version fails on changelog.md and leaves config.json alone
        fs.writeFileSync(path.join(dir, 'config.json'), '{\n  "version": "0.1.14"\n}');
        assert.throws(function () { R.applyRelease(dir, '0.1.15', '2026-11-18'); }, /already exists/);
        assert.strictEqual(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'), '{\n  "version": "0.1.14"\n}');
        assert.throws(function () { R.applyRelease(dir, 'v0.1.16', '2026-11-18'); }, /X\.Y\.Z/);
        assert.throws(function () { R.applyRelease(dir, '0.1.16', '18.11.2026'); }, /YYYY-MM-DD/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the repo files are in the shape release.js rewrites', function () {
    var root = path.join(__dirname, '..');
    var cfg = fs.readFileSync(path.join(root, 'config.json'), 'utf8'), readme = fs.readFileSync(path.join(root, 'readme.md'), 'utf8');
    var cl = fs.readFileSync(path.join(root, 'changelog.md'), 'utf8');
    var v = JSON.parse(cfg).version;
    assert.ok(R.parseVersion(v), 'config.json version');
    assert.strictEqual(JSON.parse(R.applyConfig(cfg, '9.9.9')).version, '9.9.9');
    assert.match(R.applyReadme(readme, '9.9.9', '2099-01-01'), /^\*Current Version: 9\.9\.9\r?\nReleased: 2099-01-01\*/m);
    assert.ok(R.findSection(cl, 'Unreleased'), 'changelog.md has an [Unreleased] section');
    assert.ok(R.sectionNotes(R.applyChangelog(cl, '9.9.9', '2099-01-01'), '9.9.9') != null);
});
