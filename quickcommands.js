/**
* @description MeshCentral Quick Commands plugin
* @license Apache-2.0
*
* One-click "keys" for commands you run again and again. Keys appear on the
* Terminal tab (as a strip or a menu), optionally on the General tab, and in
* the device's Plugins tab. Commands are managed in My Server > Plugins.
*/

"use strict";

module.exports.quickcommands = function (parent) {
    var obj = {};
    obj.parent = parent;                 // pluginHandler
    obj.meshServer = parent.parent;      // meshcentral
    obj.db = obj.meshServer.db;
    obj.configId = 'plugin_quickcommands_config';
    obj.config = null;

    // ------------------------------------------------------------------
    //  Client side. Every function listed here is serialised with
    //  .toString() and runs in the browser. They must be self-contained and
    //  reach each other only through pluginHandler.quickcommands.<name>.
    // ------------------------------------------------------------------
    obj.exports = [
        'onWebUIStartupEnd',
        'onDeviceRefreshEnd',
        'onConfig',
        'onConfigChanged',
        'qcState',
        'qcInjectStyles',
        'qcRequestConfig',
        'qcApplicable',
        'qcVisible',
        'qcEsc',
        'qcKeyHtml',
        'qcGroupsFor',
        'qcRenderAll',
        'qcRenderTerminal',
        'qcRenderGeneral',
        'qcRenderPluginTab',
        'qcRenderLog',
        'qcToggleMenu',
        'qcCloseMenu',
        'qcSetTermView',
        'qcOpenManage',
        'qcDialog',
        'qcDialogClose',
        'qcRun',
        'qcRunAgain',
        'qcRunNow',
        'qcExec',
        'qcTypeIntoTerminal',
        'qcSendToTerminal',
        'qcIntercept',
        'qcFinish',
        'qcShowOutput',
        'qcShowRunning',
        'qcCancelRun',
        'qcCopyOutput',
        'qcFmtMs',
        'qcClearLog'
    ];

    // Shared per-page state bag.
    obj.qcState = function () {
        var Q = pluginHandler.quickcommands;
        if (Q._st == null) {
            Q._st = { config: null, canManage: false, pending: {}, log: [], menuOpen: false, hooked: false, nodeid: null };
        }
        return Q._st;
    };

    obj.onWebUIStartupEnd = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        Q.qcInjectStyles();
        // Wrap the server message handler once so command results can be picked up.
        if ((st.hooked == false) && (typeof meshserver == 'object') && (meshserver != null) && (typeof meshserver.onMessage == 'function')) {
            var orig = meshserver.onMessage;
            meshserver.onMessage = function (server, message) {
                try { pluginHandler.quickcommands.qcIntercept(message); } catch (e) { }
                return orig.apply(this, arguments);
            };
            st.hooked = true;
        }
        document.addEventListener('click', function (e) {
            var st2 = pluginHandler.quickcommands.qcState();
            if (st2.menuOpen && !(e.target.closest && e.target.closest('#qcTermMenuWrap'))) { pluginHandler.quickcommands.qcCloseMenu(); }
        });
    };

    obj.onDeviceRefreshEnd = function (nodeid, panel, refresh, event) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        Q.qcInjectStyles();
        try { pluginHandler.registerPluginTab({ tabId: 'pluginQuickCommands', tabTitle: 'Quick Commands' }); } catch (e) { }
        if (st.nodeid != nodeid) { st.log = []; st.nodeid = nodeid; }
        if (st.config == null) { Q.qcRequestConfig(); } else { Q.qcRenderAll(); Q.qcRequestConfig(); }
    };

    obj.qcRequestConfig = function () {
        meshserver.send({ action: 'plugin', plugin: 'quickcommands', pluginaction: 'getConfig' });
    };

    // Server reply to getConfig.
    obj.onConfig = function (server, message) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        st.config = message.config;
        st.canManage = (message.canManage === true);
        Q.qcRenderAll();
    };

    // Broadcast event after an admin saved the commands.
    obj.onConfigChanged = function (message) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if ((typeof currentNode != 'undefined') && (currentNode != null) && (xxcurrentView >= 10) && (xxcurrentView < 20)) { Q.qcRequestConfig(); } else { st.config = null; }
    };

    obj.qcInjectStyles = function () {
        if (document.getElementById('qcStyles')) return;
        var css = `
.qcStrip { display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding:5px 6px; background:#E4E9E7; border-bottom:1px solid #b9c2bf; text-align:left; }
.night .qcStrip { background:#1a1f1e; border-bottom-color:#333; }
.qcLabel { font-size:11px; color:#5a6368; text-transform:uppercase; letter-spacing:0.6px; margin-right:4px; white-space:nowrap; }
.night .qcLabel { color:#8b9591; }
.qcGroup { display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding-right:10px; margin-right:4px; border-right:1px solid #b9c2bf; }
.night .qcGroup { border-right-color:#333; }
.qcGroup:last-of-type { border-right:0; }
.qcKey { position:relative; overflow:hidden; display:inline-flex; flex-direction:column; gap:1px; padding:3px 9px 4px 8px; border:1px solid #8f9a9f; border-bottom-width:3px; border-radius:4px; background:#fff; cursor:pointer; text-align:left; font-family:inherit; color:#1a1a1a; }
.qcKey:hover { background:#f4f8f7; }
.qcKey:active { transform:translateY(1px); border-bottom-width:2px; }
.qcKey:focus-visible { outline:2px solid #1E6BD6; outline-offset:1px; }
.night .qcKey { background:#111; border-color:#555; color:#ddd; }
.night .qcKey:hover { background:#1d2422; }
.qcKey .qcN { font-size:12px; line-height:14px; font-weight:bold; display:flex; align-items:center; gap:5px; white-space:nowrap; }
.qcKey .qcC { font-family:"Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace; font-size:11px; line-height:13px; color:#5a6368; white-space:nowrap; max-width:260px; overflow:hidden; text-overflow:ellipsis; }
.night .qcKey .qcC { color:#8b9591; }
.qcTag { font-family:"Cascadia Mono", Consolas, monospace; font-size:9px; line-height:12px; font-weight:bold; padding:0 4px; border-radius:2px; color:#fff; letter-spacing:0.4px; }
.qcTag.cmd { background:#3C5A78; } .qcTag.ps { background:#1E6BD6; } .qcTag.sh { background:#2C8C5A; } .qcTag.agent { background:#7A52C4; }
.qcKey.danger { border-color:#C8362B; padding-top:6px; }
.qcKey.danger::before { content:""; position:absolute; left:0; right:0; top:0; height:4px; background:repeating-linear-gradient(135deg,#C8362B 0 6px,transparent 6px 10px); }
.qcKey.termMode .qcN::after { content:"\\203A_"; font-family:"Cascadia Mono", Consolas, monospace; font-size:10px; color:#7c868b; font-weight:normal; }
.qcKey.busy { background:#fff7dc; border-color:#b88a00; cursor:progress; }
.night .qcKey.busy { background:#2a2410; }
.qcKey:disabled { opacity:0.55; cursor:default; }
.qcMenuWrap { position:relative; display:inline-block; float:left; margin-right:6px; }
.qcMenu { position:absolute; right:0; top:24px; min-width:300px; max-height:420px; overflow:auto; background:#fff; border:1px solid #8f9a9f; box-shadow:0 4px 14px rgba(0,0,0,0.25); z-index:1000; font-size:12px; text-align:left; color:#000; line-height:normal; }
.night .qcMenu { background:#111; border-color:#555; color:#ddd; }
.qcMenuH { padding:5px 10px; background:#E4E9E7; font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:#5a6368; }
.night .qcMenuH { background:#1a1f1e; color:#8b9591; }
.qcMenuI { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 10px; cursor:pointer; border:0; width:100%; background:none; font:inherit; color:inherit; text-align:left; }
.qcMenuI:hover { background:#f4f8f7; } .night .qcMenuI:hover { background:#1d2422; }
.qcMenuI .qcN { font-weight:bold; display:flex; align-items:center; gap:5px; }
.qcMenuI .qcC { font-family:"Cascadia Mono", Consolas, monospace; color:#5a6368; white-space:nowrap; max-width:200px; overflow:hidden; text-overflow:ellipsis; }
.qcMenuI.danger .qcN, .qcMenuI.danger .qcC { color:#C8362B; }
.qcMenuI.termMode .qcN::after { content:"\\203A_"; font-family:"Cascadia Mono", Consolas, monospace; font-size:10px; color:#7c868b; font-weight:normal; }
.qcMenuF { padding:6px 10px; border-top:1px solid #d8dedc; display:flex; gap:12px; font-size:11px; }
.night .qcMenuF { border-top-color:#333; }
.qcPanel { margin:10px 0 14px; border:1px solid #AAA; background:#EEE; }
.night .qcPanel { border-color:#444; background:#141414; }
.qcPanelH { background:#AAA; padding:3px 6px; font-weight:bold; display:flex; align-items:center; gap:10px; color:#000; }
.night .qcPanelH { background:#333; color:#ccc; }
.qcPanelH .qcHint { font-weight:normal; font-size:11px; color:#333; } .night .qcPanelH .qcHint { color:#aaa; }
.qcPanelB { display:flex; flex-wrap:wrap; gap:8px; padding:10px 8px; align-items:flex-start; }
.qcGrow { flex-grow:1; }
.qcLink { font-weight:normal; font-size:12px; cursor:pointer; color:#00f; } .night .qcLink { color:#6ea8ff; }
.qcMini { font-size:11px; color:#5a6368; }
#pluginQuickCommands .qcCols { display:flex; gap:16px; align-items:flex-start; }
#pluginQuickCommands .qcList { width:340px; display:flex; flex-direction:column; gap:10px; }
#pluginQuickCommands .qcGH { font-size:11px; color:#5a6368; text-transform:uppercase; letter-spacing:0.6px; }
#pluginQuickCommands .qcWrap { display:flex; flex-wrap:wrap; gap:6px; }
#pluginQuickCommands .qcLog { flex-grow:1; border:1px solid #AAA; background:#fff; min-height:200px; }
.night #pluginQuickCommands .qcLog { border-color:#444; background:#0a0a0a; }
.qcLogRow { display:flex; gap:10px; align-items:center; padding:5px 8px; border-bottom:1px solid #e3e7e5; font-size:12px; cursor:pointer; }
.night .qcLogRow { border-bottom-color:#222; }
.qcLogRow:hover { background:#f4f8f7; } .night .qcLogRow:hover { background:#1d2422; }
.qcLogRow .qcT { font-family:"Cascadia Mono", Consolas, monospace; color:#5a6368; }
.qcLogRow .qcC { font-family:"Cascadia Mono", Consolas, monospace; color:#5a6368; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px; }
.qcOk { color:#2C8C5A; } .qcErr { color:#C8362B; } .qcMuted { color:#5a6368; }
.qcOut { margin:0; padding:8px; max-height:340px; overflow:auto; font-family:"Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace; font-size:11px; line-height:14px; background:#fff; color:#1a1a1a; white-space:pre-wrap; word-break:break-all; text-align:left; border:1px solid #d8dedc; }
.night .qcOut { background:#0a0a0a; color:#ddd; border-color:#333; }
.qcOutH { display:flex; gap:8px; align-items:center; font-size:12px; color:#5a6368; padding:0 0 6px; text-align:left; }
.qcOutH .qcC { font-family:"Cascadia Mono", Consolas, monospace; }
.qcEmpty { padding:14px 10px; font-size:12px; color:#5a6368; }
#xxAddAgentModalConf.qcWide { max-width:760px; }
`;
        var s = document.createElement('style'); s.id = 'qcStyles'; s.textContent = css; document.head.appendChild(s);
    };

    obj.qcEsc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

    // Does this command apply to the current device's OS?
    obj.qcApplicable = function (cmd) {
        if ((typeof currentNode == 'undefined') || (currentNode == null) || (currentNode.agent == null)) return false;
        var win = isWindowsNode(currentNode);
        if (cmd.shell == 'cmd' || cmd.shell == 'ps') return win;
        if (cmd.shell == 'sh') return !win;
        return true; // agent console
    };

    obj.qcVisible = function (where) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if (st.config == null) return [];
        return st.config.commands.filter(function (c) {
            if (!Q.qcApplicable(c)) return false;
            if (where == 'terminal') return c.showTerminal !== false;
            if (where == 'general') return c.showGeneral === true;
            return true;
        });
    };

    // Ordered groups with the commands that belong to them.
    obj.qcGroupsFor = function (cmds) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var order = (st.config && Array.isArray(st.config.groups)) ? st.config.groups.slice() : [];
        var byGroup = {}, out = [];
        cmds.forEach(function (c) { var g = c.group || ''; if (byGroup[g] == null) { byGroup[g] = []; } byGroup[g].push(c); });
        Object.keys(byGroup).forEach(function (g) { if (order.indexOf(g) == -1) order.push(g); });
        order.forEach(function (g) { if (byGroup[g]) out.push({ name: g, commands: byGroup[g] }); });
        return out;
    };

    obj.qcKeyHtml = function (c, where) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var busy = false; for (var k in st.pending) { if (st.pending[k].cmd.id == c.id) busy = true; }
        var cls = 'qcKey' + (c.confirm ? ' danger' : '') + (c.mode == 'terminal' ? ' termMode' : '') + (busy ? ' busy' : '');
        var sub = busy ? ('Running… (view / cancel)') : c.command.split(/\r?\n/)[0];
        var title = (c.description ? c.description + '\n' : '') + c.command + (c.mode == 'terminal' ? '\n(typed into the terminal)' : '');
        var click = busy ? ('qcShowRunning(\'' + Q.qcEsc(c.id) + '\')') : ('qcRun(\'' + Q.qcEsc(c.id) + '\',\'' + where + '\')');
        return '<button type="button" class="' + cls + '" title="' + Q.qcEsc(title) + '" onclick="return pluginHandler.quickcommands.' + click + '">'
            + '<span class="qcN"><span class="qcTag ' + c.shell + '">' + Q.qcEsc(c.shell == 'ps' ? 'PS' : c.shell.toUpperCase()) + '</span>' + Q.qcEsc(c.name) + '</span>'
            + '<span class="qcC">' + Q.qcEsc(sub) + '</span></button>';
    };

    obj.qcRenderAll = function () {
        var Q = pluginHandler.quickcommands;
        try { Q.qcRenderTerminal(); } catch (e) { console.log('quickcommands terminal render', e); }
        try { Q.qcRenderGeneral(); } catch (e) { console.log('quickcommands general render', e); }
        try { Q.qcRenderPluginTab(); } catch (e) { console.log('quickcommands tab render', e); }
    };

    // Terminal tab: either a strip under the toolbar or a menu button inside it.
    obj.qcRenderTerminal = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var table = document.querySelector('#termTable table');
        if (table == null) return;
        var row = document.getElementById('qcTermRow');
        var wrap = document.getElementById('qcTermMenuWrap');
        var cmds = Q.qcVisible('terminal');
        var view = getstore('qc_termview', (st.config && st.config.settings) ? st.config.settings.terminalView : 'strip');
        if ((st.config == null) || (cmds.length == 0)) { if (row) row.remove(); if (wrap) wrap.remove(); return; }
        var groups = Q.qcGroupsFor(cmds);
        var manage = st.canManage ? '<span class="qcLink" onclick="return pluginHandler.quickcommands.qcOpenManage()">Manage…</span>' : '';

        if (view == 'menu') {
            if (row) row.remove();
            if (wrap == null) {
                var host = document.getElementById('terminalCustomUpperRight');
                if (host == null) return;
                wrap = document.createElement('div'); wrap.id = 'qcTermMenuWrap'; wrap.className = 'qcMenuWrap';
                host.parentNode.insertBefore(wrap, host);
            }
            var x = '<input type="button" value="Quick commands ▾" onclick="return pluginHandler.quickcommands.qcToggleMenu(event)" onkeypress="return false" onkeydown="return false" />';
            x += '<div class="qcMenu" id="qcTermMenu" style="display:' + (st.menuOpen ? '' : 'none') + '">';
            groups.forEach(function (g) {
                if (g.name) x += '<div class="qcMenuH">' + Q.qcEsc(g.name) + '</div>';
                g.commands.forEach(function (c) {
                    x += '<button type="button" class="qcMenuI' + (c.confirm ? ' danger' : '') + (c.mode == 'terminal' ? ' termMode' : '') + '" title="' + Q.qcEsc(c.description || '') + '" onclick="return pluginHandler.quickcommands.qcRun(\'' + Q.qcEsc(c.id) + '\',\'terminal\')">'
                        + '<span class="qcN"><span class="qcTag ' + c.shell + '">' + Q.qcEsc(c.shell == 'ps' ? 'PS' : c.shell.toUpperCase()) + '</span>' + Q.qcEsc(c.name) + '</span><span class="qcC">' + Q.qcEsc(c.command.split(/\r?\n/)[0]) + '</span></button>';
                });
            });
            x += '<div class="qcMenuF"><span class="qcLink" onclick="return pluginHandler.quickcommands.qcSetTermView(\'strip\')">Show as strip</span>' + manage + '</div></div>';
            wrap.innerHTML = x;
        } else {
            if (wrap) { wrap.remove(); st.menuOpen = false; }
            if (row == null) {
                var first = table.querySelector('tr');
                if (first == null) return;
                row = document.createElement('tr'); row.id = 'qcTermRow';
                first.insertAdjacentElement('afterend', row);
            }
            var x = '<td><div class="qcStrip"><span class="qcLabel">Quick commands</span>';
            groups.forEach(function (g) {
                x += '<div class="qcGroup" title="' + Q.qcEsc(g.name) + '">';
                g.commands.forEach(function (c) { x += Q.qcKeyHtml(c, 'terminal'); });
                x += '</div>';
            });
            x += '<span class="qcGrow"></span><span class="qcLink" title="Move the commands into a menu in the toolbar" onclick="return pluginHandler.quickcommands.qcSetTermView(\'menu\')">Menu</span>' + (manage ? '&nbsp;&nbsp;' + manage : '') + '</div></td>';
            row.innerHTML = x;
        }
    };

    obj.qcToggleMenu = function (e) {
        var st = pluginHandler.quickcommands.qcState();
        st.menuOpen = !st.menuOpen;
        var m = document.getElementById('qcTermMenu'); if (m) m.style.display = st.menuOpen ? '' : 'none';
        if (e && e.stopPropagation) e.stopPropagation();
        return false;
    };
    obj.qcCloseMenu = function () {
        var st = pluginHandler.quickcommands.qcState();
        st.menuOpen = false;
        var m = document.getElementById('qcTermMenu'); if (m) m.style.display = 'none';
    };
    obj.qcSetTermView = function (view) {
        putstore('qc_termview', view);
        pluginHandler.quickcommands.qcCloseMenu();
        pluginHandler.quickcommands.qcRenderTerminal();
        return false;
    };
    obj.qcOpenManage = function () {
        var w = window.open(domainUrl + 'pluginadmin.ashx?pin=quickcommands', '_blank');
        if (w) w.opener = null;
        return false;
    };

    // General tab: a panel under the device information, only for flagged commands.
    obj.qcRenderGeneral = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var anchor = document.getElementById('p10html2');
        if (anchor == null) return;
        var panel = document.getElementById('qcGeneral');
        var cmds = Q.qcVisible('general');
        if ((st.config == null) || (cmds.length == 0)) { if (panel) panel.remove(); return; }
        if (panel == null) { panel = document.createElement('div'); panel.id = 'qcGeneral'; anchor.parentNode.insertBefore(panel, anchor); }
        var x = '<div class="qcPanel"><div class="qcPanelH"><span>Quick commands</span><span class="qcHint">Output opens in a window when the command finishes</span><span class="qcGrow"></span>'
            + (st.canManage ? '<span class="qcLink" onclick="return pluginHandler.quickcommands.qcOpenManage()">Manage…</span>' : '') + '</div><div class="qcPanelB">';
        cmds.forEach(function (c) { x += Q.qcKeyHtml(c, 'general'); });
        x += '</div></div>';
        panel.innerHTML = x;
    };

    // Plugins tab: every applicable command plus the run log.
    obj.qcRenderPluginTab = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var host = document.getElementById('pluginQuickCommands');
        if (host == null) return;
        if (st.config == null) { host.innerHTML = '<div class="qcEmpty">Loading commands…</div>'; return; }
        var cmds = Q.qcVisible('all');
        var x = '<div class="qcCols"><div class="qcList">';
        if (cmds.length == 0) {
            x += '<div class="qcEmpty">No commands for this device yet.' + (st.canManage ? ' <span class="qcLink" onclick="return pluginHandler.quickcommands.qcOpenManage()">Add some…</span>' : ' Ask an administrator to add some under My Server &gt; Plugins.') + '</div>';
        } else {
            Q.qcGroupsFor(cmds).forEach(function (g) {
                if (g.name) x += '<div class="qcGH">' + Q.qcEsc(g.name) + '</div>';
                x += '<div class="qcWrap">';
                g.commands.forEach(function (c) { x += Q.qcKeyHtml(c, 'tab'); });
                x += '</div>';
            });
        }
        x += '<div class="qcMini">›_ is typed into the Terminal tab instead of running silently.' + (st.canManage ? ' <span class="qcLink" onclick="return pluginHandler.quickcommands.qcOpenManage()">Manage commands…</span>' : '') + '</div>';
        x += '</div><div class="qcLog" id="qcLog"></div></div>';
        host.innerHTML = x;
        Q.qcRenderLog();
    };

    obj.qcRenderLog = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var host = document.getElementById('qcLog');
        if (host == null) return;
        var x = '<div class="qcPanelH"><span>Run log</span><span class="qcHint">this session</span><span class="qcGrow"></span>' + (st.log.length ? '<span class="qcLink" onclick="return pluginHandler.quickcommands.qcClearLog()">Clear</span>' : '') + '</div>';
        if (st.log.length == 0) { x += '<div class="qcEmpty">Nothing has run yet. Output of every command you run from here, the General tab or the Terminal tab is kept in this list.</div>'; }
        for (var i = 0; i < st.log.length; i++) {
            var e = st.log[i], status;
            if (e.state == 'running') status = '<span class="qcMuted">running…</span>';
            else if (e.state == 'typed') status = '<span class="qcMuted">typed into terminal</span>';
            else if (e.state == 'error') status = '<span class="qcErr">' + Q.qcEsc(e.error) + '</span>';
            else status = '<span class="qcOk">done · ' + Q.qcFmtMs(e.ms) + '</span>';
            x += '<div class="qcLogRow" onclick="return pluginHandler.quickcommands.qcShowOutput(' + i + ')"><span class="qcT">' + Q.qcEsc(e.time) + '</span><span class="qcTag ' + e.cmd.shell + '">' + Q.qcEsc(e.cmd.shell == 'ps' ? 'PS' : e.cmd.shell.toUpperCase()) + '</span><b>' + Q.qcEsc(e.cmd.name) + '</b><span class="qcC">' + Q.qcEsc(e.cmd.command.split(/\r?\n/)[0]) + '</span><span class="qcGrow"></span>' + status + '</div>';
        }
        host.innerHTML = x;
    };

    obj.qcClearLog = function () { var st = pluginHandler.quickcommands.qcState(); st.log = []; pluginHandler.quickcommands.qcRenderLog(); return false; };
    obj.qcFmtMs = function (ms) { if (ms == null) return ''; return (ms < 1000) ? (ms + ' ms') : ((ms / 1000).toFixed(1) + ' s'); };

    // MeshCentral has two web UIs. The classic one (default.handlebars) shows a
    // dialog as soon as setDialogMode() is called. The Bootstrap one
    // (default3.handlebars) only prepares it there and needs showModal() as well
    // - without it nothing appears and xxdialogMode stays set, which blocks every
    // click in the interface. So always go through here.
    obj.qcDialog = function (title, buttons, okFn, html, wide) {
        var newUi = (typeof showModal === 'function');
        setDialogMode(2, title, buttons, okFn, html);
        if (newUi) {
            var conf = document.getElementById('xxAddAgentModalConf');
            if (conf) { if (wide) { conf.classList.add('qcWide'); } else { conf.classList.remove('qcWide'); } }
            showModal('xxAddAgentModal', 'idx_dlgOkButton', okFn);
        } else {
            var dlg = document.getElementById('dialog'); // classic dialog is a fixed 400px
            if (dlg && wide) { dlg.style.width = '680px'; dlg.style.left = 'calc(50% - 340px)'; }
        }
        return newUi;
    };

    obj.qcDialogClose = function () {
        if ((typeof xxModal !== 'undefined') && (xxModal != null)) {
            try { xxModal.hide(); } catch (e) { }
            if (typeof xxdialogMode !== 'undefined') { xxdialogMode = 0; }
        } else if (typeof dialogclose === 'function') { dialogclose(0); }
    };

    // Entry point for every key.
    obj.qcRun = function (id, where) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if (st.config == null) return false;
        if (typeof xxdialogMode != 'undefined' && xxdialogMode) return false;
        var cmd = null; st.config.commands.forEach(function (c) { if (c.id == id) cmd = c; });
        if (cmd == null) return false;
        Q.qcCloseMenu();
        // Already running? Show the live output instead of queueing a second run
        // (the agent executes one run command at a time and rejects the rest).
        for (var k in st.pending) { if (st.pending[k].cmd.id == id) { return Q.qcShowRunning(id); } }
        if (cmd.confirm) {
            var html = '<div class="qcOutH"><span class="qcTag ' + cmd.shell + '">' + Q.qcEsc(cmd.shell == 'ps' ? 'PS' : cmd.shell.toUpperCase()) + '</span><b>' + Q.qcEsc(cmd.name) + '</b><span>on ' + Q.qcEsc(currentNode.name) + '</span></div>'
                + '<pre class="qcOut" style="max-height:120px">' + Q.qcEsc(cmd.command) + '</pre>'
                + (cmd.description ? '<div class="qcMini" style="margin-top:6px">' + Q.qcEsc(cmd.description) + '</div>' : '');
            Q.qcDialog('Run this command?', 3, function () { pluginHandler.quickcommands.qcRunNow(cmd); }, html);
            return false;
        }
        Q.qcRunNow(cmd);
        return false;
    };

    obj.qcRunNow = function (cmd) {
        var Q = pluginHandler.quickcommands;
        if (cmd.mode == 'terminal') { Q.qcTypeIntoTerminal(cmd); } else { Q.qcExec(cmd); }
    };

    // Silent run through the agent's "runcommands"; the result comes back via qcIntercept.
    obj.qcExec = function (cmd) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if ((currentNode == null) || (currentNode.conn & 1) == 0) { Q.qcDialog('Quick commands', 1, null, 'The agent is not connected, so "' + Q.qcEsc(cmd.name) + '" cannot run right now.'); return; }
        var types = { cmd: 1, ps: 2, sh: 3, agent: 4 };
        var rid = 'qc-' + Math.random().toString(36).substring(2, 12);
        var entry = { cmd: cmd, state: 'running', time: new Date().toLocaleTimeString(), start: Date.now(), output: '', rid: rid };
        st.log.unshift(entry); if (st.log.length > 50) st.log.pop();
        st.pending[rid] = entry;
        // The agent streams everything the command prints to the console channel while it
        // runs (the reply only arrives when the shell exits), so collect it for live output.
        entry.collect = true;
        if (cmd.shell == 'agent') { entry.timer = setTimeout(function () { pluginHandler.quickcommands.qcFinish(rid, null); }, 4000); }
        else { entry.timer = setTimeout(function () { pluginHandler.quickcommands.qcFinish(rid, 'No reply from the agent after 5 minutes. The command is probably still running or waiting for input on the device; the agent accepts no new run commands until it ends (or the agent restarts).'); }, 300000); }
        meshserver.send({ action: 'runcommands', nodeids: [currentNode._id], type: types[cmd.shell] || 1, cmds: cmd.command, runAsUser: (cmd.runAs | 0), reply: true, responseid: rid });
        Q.qcRenderAll();
    };

    // Picks up results from the server message stream.
    obj.qcIntercept = function (message) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if ((message == null) || (typeof message != 'object')) return;
        if ((message.action == 'msg') && (message.type == 'runcommands') && (message.responseid != null) && st.pending[message.responseid]) {
            st.pending[message.responseid].output = (typeof message.result == 'string') ? message.result : JSON.stringify(message.result);
            Q.qcFinish(message.responseid, null);
        } else if ((message.action == 'runcommands') && (message.responseid != null) && st.pending[message.responseid]) {
            var r = message.result;
            if (r == 'OK') { if (!st.pending[message.responseid].collect) { /* reply will follow */ } }
            else { Q.qcFinish(message.responseid, (typeof r == 'string') ? r : 'Failed'); }
        } else if ((message.action == 'msg') && (message.type == 'console') && (typeof message.value == 'string')) {
            if ((currentNode == null) || (message.nodeid != currentNode._id)) return;
            // The agent runs one command at a time; a second one is rejected with this
            // console message and never gets a reply, so fail it right away.
            if (message.value.indexOf('Run commands can\'t execute, already busy') != -1) {
                var newest = null;
                for (var k in st.pending) { var e = st.pending[k]; if ((e.cmd.shell != 'agent') && ((Date.now() - e.start) < 15000) && ((newest == null) || (e.start > newest.start))) { newest = e; } }
                if (newest != null) { Q.qcFinish(newest.rid, 'The agent is still busy with an earlier run command - it executes one at a time and rejected this one. Wait for the running command to end, or restart the agent.'); return; }
            }
            for (var k in st.pending) {
                var e = st.pending[k];
                if (e.collect) {
                    e.output += message.value + '\n';
                    // Live-update the output window when it is showing this run.
                    if (typeof xxdialogMode != 'undefined' && xxdialogMode) {
                        var pre = document.getElementById('qcOutPre');
                        if (pre && (pre.getAttribute('data-rid') == e.rid)) { pre.textContent = e.output; pre.scrollTop = pre.scrollHeight; }
                    }
                }
            }
        }
    };

    obj.qcFinish = function (rid, error) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var e = st.pending[rid]; if (e == null) return;
        delete st.pending[rid];
        if (e.timer) clearTimeout(e.timer);
        e.ms = Date.now() - e.start;
        e.state = error ? 'error' : 'done';
        e.error = error;
        Q.qcRenderAll();
        // If the output window is already open on this run, update it in place.
        if (typeof xxdialogMode != 'undefined' && xxdialogMode) {
            var pre = document.getElementById('qcOutPre');
            if (pre && (pre.getAttribute('data-rid') == rid)) {
                pre.textContent = (e.output && e.output.length) ? e.output : '(no output)';
                var stat = document.getElementById('qcOutStatus');
                if (stat) { stat.innerHTML = error ? ('<span class="qcErr">' + Q.qcEsc(error) + '</span>') : ('<span class="qcOk">' + Q.qcFmtMs(e.ms) + '</span>'); }
                var btns = document.getElementById('qcOutBtns');
                if (btns) { btns.innerHTML = '<input type="button" value="Copy" onclick="return pluginHandler.quickcommands.qcCopyOutput(' + st.log.indexOf(e) + ')" />&nbsp;<input type="button" value="Run again" onclick="return pluginHandler.quickcommands.qcRunAgain(\'' + Q.qcEsc(e.cmd.id) + '\')" />'; }
                return;
            }
        }
        // Show the result when the user is still looking at this device.
        if ((currentNode != null) && (st.nodeid == currentNode._id) && (xxcurrentView >= 10) && (xxcurrentView < 20) && !xxdialogMode) { Q.qcShowOutput(st.log.indexOf(e)); }
    };

    // Stop waiting for a run that never replies. This only releases the browser side:
    // the process keeps running on the device until it ends on its own.
    obj.qcCancelRun = function (rid) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if (st.pending[rid] == null) return false;
        Q.qcFinish(rid, 'Cancelled. The command may still be running on the device; the agent accepts new run commands only once it ends (or the agent restarts).');
        return false;
    };

    // Open the output window of the run that is currently pending for a command.
    obj.qcShowRunning = function (cmdid) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        for (var k in st.pending) { if (st.pending[k].cmd.id == cmdid) { return Q.qcShowOutput(st.log.indexOf(st.pending[k])); } }
        return false;
    };

    obj.qcShowOutput = function (idx) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var e = st.log[idx]; if (e == null) return false;
        if (xxdialogMode) return false;
        var status = (e.state == 'error') ? '<span class="qcErr">' + Q.qcEsc(e.error) + '</span>' : (e.state == 'running' ? '<span class="qcMuted">running…</span>' : (e.state == 'typed' ? '<span class="qcMuted">typed into terminal</span>' : '<span class="qcOk">' + Q.qcFmtMs(e.ms) + '</span>'));
        var runAs = ['as agent', 'as user if signed in', 'as user'][e.cmd.runAs | 0] || '';
        var body = (e.output && e.output.length) ? Q.qcEsc(e.output) : '<span class="qcMuted">(no output' + (e.state == 'running' ? ' yet' : (e.cmd.shell == 'agent' ? ' captured; see the Console tab' : '')) + ')</span>';
        var buttons = (e.state == 'running')
            ? '<input type="button" value="Copy" onclick="return pluginHandler.quickcommands.qcCopyOutput(' + idx + ')" />&nbsp;<input type="button" value="Cancel" onclick="return pluginHandler.quickcommands.qcCancelRun(\'' + Q.qcEsc(e.rid) + '\')" />'
            : '<input type="button" value="Copy" onclick="return pluginHandler.quickcommands.qcCopyOutput(' + idx + ')" />&nbsp;<input type="button" value="Run again" onclick="return pluginHandler.quickcommands.qcRunAgain(\'' + Q.qcEsc(e.cmd.id) + '\')" />';
        var html = '<div class="qcOutH"><span class="qcTag ' + e.cmd.shell + '">' + Q.qcEsc(e.cmd.shell == 'ps' ? 'PS' : e.cmd.shell.toUpperCase()) + '</span><b>' + Q.qcEsc(e.cmd.name) + '</b><span>on ' + Q.qcEsc(currentNode ? currentNode.name : '') + '</span><span class="qcGrow"></span><span id="qcOutStatus">' + status + '</span></div>'
            + '<div class="qcOutH"><span class="qcC">' + Q.qcEsc(e.cmd.command.split(/\r?\n/)[0]) + '</span><span class="qcGrow"></span><span>' + runAs + '</span></div>'
            + '<pre class="qcOut" id="qcOutPre"' + (e.rid ? (' data-rid="' + Q.qcEsc(e.rid) + '"') : '') + '>' + body + '</pre>'
            + '<div style="margin-top:8px;text-align:right" id="qcOutBtns">' + buttons + '</div>';
        Q.qcDialog('Quick command', 1, null, html, true);
        return false;
    };

    obj.qcRunAgain = function (id) {
        var Q = pluginHandler.quickcommands;
        Q.qcDialogClose();
        // The Bootstrap modal needs to finish hiding before a new one is shown.
        setTimeout(function () { pluginHandler.quickcommands.qcRun(id, 'dialog'); }, 400);
        return false;
    };

    obj.qcCopyOutput = function (idx) {
        var st = pluginHandler.quickcommands.qcState();
        var e = st.log[idx]; if (e == null) return false;
        try { navigator.clipboard.writeText(e.output || ''); } catch (ex) { }
        return false;
    };

    // Interactive run: switch to the Terminal tab, connect if needed, type the command.
    obj.qcTypeIntoTerminal = function (cmd) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if ((currentNode == null) || (currentNode.conn & 1) == 0) { Q.qcDialog('Quick commands', 1, null, 'The agent is not connected, so the terminal cannot be opened.'); return; }
        if (xxcurrentView != 12) { go(12); }
        var entry = { cmd: cmd, state: 'typed', time: new Date().toLocaleTimeString(), start: Date.now(), output: '' };
        st.log.unshift(entry); if (st.log.length > 50) st.log.pop();
        var text = cmd.command.replace(/\r?\n/g, '\r') + '\r';
        var send = function () { Q.qcSendToTerminal(text); Q.qcRenderLog(); };
        if ((typeof terminal != 'undefined') && (terminal != null) && (terminal.State == 3)) { send(); return; }
        if ((typeof terminal == 'undefined') || (terminal == null)) {
            var opts = {};
            if ((cmd.shell == 'ps') && isWindowsNode(currentNode)) { opts.protocol = 6; } // PowerShell
            try { connectTerminal(null, 1, opts); } catch (ex) { console.log('quickcommands: connectTerminal failed', ex); return; }
        }
        var tries = 0;
        var wait = setInterval(function () {
            tries++;
            if ((typeof terminal != 'undefined') && (terminal != null) && (terminal.State == 3)) { clearInterval(wait); setTimeout(send, 600); }
            else if ((tries > 80) || (typeof terminal == 'undefined') || (terminal == null && tries > 4)) { clearInterval(wait); entry.state = 'error'; entry.error = 'Terminal did not connect'; Q.qcRenderLog(); }
        }, 250);
    };

    obj.qcSendToTerminal = function (text) {
        if ((typeof terminal == 'undefined') || (terminal == null)) return;
        if (terminal.urlname == 'sshterminalrelay.ashx') { terminal.socket.send('~' + text); }
        else if (typeof terminal.sendText == 'function') { terminal.sendText(text); }
        else if (terminal.m && (typeof terminal.m.TermSendKeys == 'function')) { terminal.m.TermSendKeys(text); }
        if ((typeof xterm != 'undefined') && (xterm != null)) { try { xterm.focus(); } catch (ex) { } }
    };

    // ------------------------------------------------------------------
    //  Server side
    // ------------------------------------------------------------------
    var SHELLS = ['cmd', 'ps', 'sh', 'agent'], MODES = ['run', 'terminal'];

    obj.defaultConfig = function () {
        return {
            version: 1,
            settings: { terminalView: 'strip' },
            groups: ['Network', 'Policy', 'Power', 'Linux'],
            commands: [
                { id: 'ipconfig', name: 'IP config', group: 'Network', shell: 'cmd', command: 'ipconfig /all', mode: 'run', runAs: 0, showTerminal: true, showGeneral: true, confirm: false, description: 'Full adapter, DNS and DHCP details.' },
                { id: 'flushdns', name: 'Flush DNS', group: 'Network', shell: 'cmd', command: 'ipconfig /flushdns', mode: 'run', runAs: 0, showTerminal: true, showGeneral: false, confirm: false, description: '' },
                { id: 'netinfo', name: 'Network info', group: 'Network', shell: 'agent', command: 'netinfo', mode: 'run', runAs: 0, showTerminal: false, showGeneral: true, confirm: false, description: 'Interfaces as the agent sees them.' },
                { id: 'gpupdate', name: 'Group policy', group: 'Policy', shell: 'cmd', command: 'echo n | gpupdate /force', mode: 'run', runAs: 0, showTerminal: true, showGeneral: true, confirm: false, description: 'Re-applies computer and user policy. Takes a while. The piped "n" answers a possible logoff/restart question with No so the run cannot get stuck.' },
                { id: 'restart', name: 'Restart now', group: 'Power', shell: 'cmd', command: 'shutdown /r /f /t 0', mode: 'run', runAs: 0, showTerminal: true, showGeneral: true, confirm: true, description: 'Forces all programs to close and restarts immediately.' },
                { id: 'linuxreboot', name: 'Reboot', group: 'Linux', shell: 'sh', command: 'systemctl reboot', mode: 'run', runAs: 0, showTerminal: true, showGeneral: false, confirm: true, description: '' },
                { id: 'linuxdf', name: 'Disk usage', group: 'Linux', shell: 'sh', command: 'df -h', mode: 'run', runAs: 0, showTerminal: true, showGeneral: true, confirm: false, description: '' }
            ]
        };
    };

    // Validates and normalises a configuration object coming from the admin page or an import.
    obj.sanitize = function (input) {
        var clean = { version: 1, settings: { terminalView: 'strip' }, groups: [], commands: [] };
        if ((input == null) || (typeof input != 'object')) return clean;
        if ((input.settings != null) && (input.settings.terminalView == 'menu')) clean.settings.terminalView = 'menu';
        var str = function (v, max) { if (typeof v != 'string') return ''; v = v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ''); return v.length > max ? v.substring(0, max) : v; };
        if (Array.isArray(input.groups)) { input.groups.forEach(function (g) { g = str(g, 64).trim(); if (g.length && (clean.groups.indexOf(g) == -1)) clean.groups.push(g); }); }
        var seen = {};
        if (Array.isArray(input.commands)) {
            input.commands.forEach(function (c) {
                if ((c == null) || (typeof c != 'object')) return;
                var cmd = str(c.command, 8192).replace(/\r\n/g, '\n').trim();
                var name = str(c.name, 80).trim();
                if (!cmd.length || !name.length) return;
                var id = str(c.id, 40).replace(/[^A-Za-z0-9_-]/g, '');
                if (!id.length || seen[id]) { id = 'c' + Math.random().toString(36).substring(2, 10); }
                seen[id] = true;
                var group = str(c.group, 64).trim();
                if (group.length && (clean.groups.indexOf(group) == -1)) clean.groups.push(group);
                clean.commands.push({
                    id: id, name: name, group: group,
                    shell: (SHELLS.indexOf(c.shell) >= 0) ? c.shell : 'cmd',
                    command: cmd,
                    mode: (MODES.indexOf(c.mode) >= 0) ? c.mode : 'run',
                    runAs: ([0, 1, 2].indexOf(c.runAs | 0) >= 0) ? (c.runAs | 0) : 0,
                    showTerminal: (c.showTerminal !== false),
                    showGeneral: (c.showGeneral === true),
                    confirm: (c.confirm === true),
                    description: str(c.description, 300).trim()
                });
            });
        }
        if (clean.commands.length > 500) clean.commands = clean.commands.slice(0, 500);
        return clean;
    };

    obj.loadConfig = function (func) {
        if (obj.config != null) { func(obj.config); return; }
        obj.db.Get(obj.configId, function (err, docs) {
            if ((err == null) && Array.isArray(docs) && (docs.length > 0) && (docs[0].config != null)) { obj.config = obj.sanitize(docs[0].config); }
            else { obj.config = obj.defaultConfig(); }
            func(obj.config);
        });
    };

    obj.saveConfig = function (config, func) {
        obj.config = obj.sanitize(config);
        obj.db.Set({ _id: obj.configId, type: 'plugin_quickcommands', config: obj.config }, function () { if (func) func(obj.config); });
    };

    obj.isAdmin = function (user) { return (user != null) && (user.siteadmin == 0xFFFFFFFF); };

    obj.server_startup = function () {
        obj.loadConfig(function () { });
    };

    // Messages from the web UI (action: 'plugin', plugin: 'quickcommands').
    obj.serveraction = function (command, myparent, grandparent) {
        var user = myparent.user;
        switch (command.pluginaction) {
            case 'getConfig': {
                obj.loadConfig(function (cfg) {
                    myparent.send({ action: 'plugin', plugin: 'quickcommands', method: 'onConfig', config: cfg, canManage: obj.isAdmin(user) });
                });
                break;
            }
            default: break;
        }
    };

    // Admin page: My Server > Plugins > Quick Commands (GET /pluginadmin.ashx?pin=quickcommands)
    obj.handleAdminReq = function (req, res, user) {
        if (!obj.isAdmin(user)) { res.sendStatus(401); return; }
        obj.loadConfig(function (cfg) {
            res.render('admin', {
                configJson: JSON.stringify(cfg).replace(/</g, '\\u003c'),
                defaultsJson: JSON.stringify(obj.defaultConfig()).replace(/</g, '\\u003c')
            });
        });
    };

    obj.handleAdminPostReq = function (req, res, user) {
        if (!obj.isAdmin(user)) { res.sendStatus(401); return; }
        if ((req.body == null) || (typeof req.body.config != 'string')) { res.status(400).json({ ok: false, error: 'No configuration received.' }); return; }
        var parsed = null;
        try { parsed = JSON.parse(req.body.config); } catch (e) { res.status(400).json({ ok: false, error: 'The configuration is not valid JSON.' }); return; }
        obj.saveConfig(parsed, function (cfg) {
            // Tell every open web session so device pages refresh their keys.
            try { obj.meshServer.DispatchEvent(['*'], obj, { action: 'plugin', plugin: 'quickcommands', pluginaction: 'onConfigChanged', nolog: 1, domain: user.domain }); } catch (e) { }
            res.json({ ok: true, config: cfg });
        });
    };

    return obj;
};
