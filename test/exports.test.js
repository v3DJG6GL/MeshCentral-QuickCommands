'use strict';
// quickcommands.js: the client side is shipped to the browser by MeshCentral's plugin handler, which serialises
// every function named in obj.exports with .toString(). A name without a function, or a function whose source does
// not compile on its own (outside the module), breaks the web UI for every user, so both are checked here.
var test = require('node:test');
var assert = require('node:assert');
var vm = require('vm');
var path = require('path');

function load() {
    var fakeServer = { db: {}, webserver: { meshes: {} }, DispatchEvent: function () { } };
    var fakePluginHandler = { parent: fakeServer };
    return require(path.join(__dirname, '..', 'quickcommands.js')).quickcommands(fakePluginHandler);
}

test('the plugin module loads with a minimal plugin handler', function () {
    var plugin = load();
    assert.ok(Array.isArray(plugin.exports) && plugin.exports.length > 0, 'obj.exports lists the client functions');
});

test('every name in obj.exports is a function of the plugin, listed once', function () {
    var plugin = load(), seen = {};
    plugin.exports.forEach(function (name) {
        assert.strictEqual(typeof plugin[name], 'function', 'obj.' + name + ' is listed in obj.exports but is not a function');
        assert.ok(!seen[name], name + ' is listed twice in obj.exports');
        seen[name] = true;
    });
});

test('every exported function compiles on its own, as the browser receives it', function () {
    var plugin = load();
    plugin.exports.forEach(function (name) {
        var src = plugin[name].toString();
        assert.doesNotThrow(function () { new vm.Script('pluginHandler.quickcommands.' + name + ' = ' + src + ';', { filename: name }); }, name + ' does not compile standalone');
    });
});
