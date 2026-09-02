/**
* @description MeshCentral Quick Commands plugin
* @license Apache-2.0
*
* One-click "keys" for commands you run again and again. Keys appear on the
* Terminal tab (as a strip or a menu), optionally on the Desktop and General tabs, and in
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
        'qcColorOf',
        'qcTagsHtml',
        'qcKeyHtml',
        'qcGroupsFor',
        'qcRenderAll',
        'qcRenderTerminal',
        'qcRenderGeneral',
        'qcRenderDesktop',
        'qcMenuHtml',
        'qcIsMenuKind',
        'qcWhereOf',
        'qcFilterId',
        'qcRenderPluginTab',
        'qcRenderLog',
        'qcToggleMenu',
        'qcCloseMenu',
        'qcSetTermView',
        'qcSetDeskView',
        'qcStripHtml',
        'qcDeskFit',
        'qcOpenManage',
        'qcDialog',
        'qcDialogClose',
        'qcRun',
        'qcRunAgain',
        'qcRunNow',
        'qcExec',
        'qcCmds',
        'qcTypeIntoTerminal',
        'qcSendToTerminal',
        'qcIntercept',
        'qcFinish',
        'qcShowOutput',
        'qcShowRunning',
        'qcCancelRun',
        'qcSendKill',
        'qcSendInput',
        'qcFreeAgent',
        'qcButtonsHtml',
        'qcCopyOutput',
        'qcFmtMs',
        'qcClearLog',
        'qcMyDevicesInit',
        'qcIsMacNode',
        'qcApplicableTo',
        'qcCmdsForNode',
        'qcDevicesBtnClick',
        'qcPickerOpen',
        'qcPickerRun',
        'qcAfterDialog',
        'qcBulkRun',
        'qcBulkResults',
        'qcBulkSummary',
        'qcBulkBack',
        'qcBulkRowHtml',
        'qcBulkRowUpdate',
        'qcBulkShow',
        'qcBulkCopy',
        'qcBulkPillUpdate',
        'qcBulkCounts',
        'qcBulkCtrlHtml',
        'qcBulkCtrlClick',
        'qcLogSave',
        'qcCxUpdate',
        'qcCxToggleFly',
        'qcCxFlyHide',
        'qcCxAll',
        'qcCxRun',
        'qcTermRunOnNode',
        'qcScopePass',
        'qcInScope',
        'qcFilterMatch',
        'qcMark',
        'qcFiltered',
        'qcSetFilter',
        'qcClearFilter',
        'qcFilterKey',
        'qcGroupSel',
        'qcToggleGroup',
        'qcChipsHtml'
    ];

    // Shared per-page state bag.
    obj.qcState = function () {
        var Q = pluginHandler.quickcommands;
        if (Q._st == null) {
            Q._st = { config: null, canManage: false, pending: {}, log: [], menuOpen: false, hooked: false, nodeid: null, mdInit: false, cfgReq: false, cxNodeid: null, picker: null, bulk: null, tFilter: '', gFilter: '', mFilter: '', dFilter: '', sFilter: '', mActive: -1, dActive: -1, tGroups: {}, gGroups: {}, mGroups: {}, dGroups: {}, sGroups: {}, deskFit: {} };
            // The run log survives a page reload (per browser tab). Runs that were
            // still going when the page reloaded cannot be picked up again - the
            // responseid is gone - so they are closed with a note.
            try {
                var saved = sessionStorage.getItem('qcRunLog');
                if (saved) {
                    Q._st.log = JSON.parse(saved);
                    Q._st.log.forEach(function (e) { if (e.state == 'running') { e.state = 'error'; e.error = 'the page was reloaded while it ran'; } });
                }
            } catch (e) { }
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
        try { Q.qcMyDevicesInit(); } catch (e) { }
        document.addEventListener('click', function (e) {
            var Q2 = pluginHandler.quickcommands, st2 = Q2.qcState();
            if (st2.menuOpen && !(e.target.closest && e.target.closest('.qcMenuWrap'))) { Q2.qcCloseMenu(); }
            if (!(e.target.closest && (e.target.closest('#qcCxFly') || e.target.closest('#qcCxItem')))) { Q2.qcCxFlyHide(); }
        });
        // "/" focuses the nearest visible quick-command filter. Never while typing
        // somewhere else, and never while a terminal is connected - its keys are its own.
        document.addEventListener('keydown', function (e) {
            try {
                if ((e.key != '/') || e.ctrlKey || e.altKey || e.metaKey) return;
                var a = document.activeElement;
                if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
                if ((typeof terminal != 'undefined') && (terminal != null)) return;
                var f = null;
                ['qcTermFilter', 'qcMenuFilter', 'qcDeskFilter', 'qcDeskStripFilter', 'qcGenFilter'].forEach(function (id) {
                    var el = document.getElementById(id);
                    if (f == null && el && (el.offsetParent != null)) f = el;
                });
                if (f) { f.focus(); f.select(); e.preventDefault(); }
            } catch (ex) { }
        });
    };

    obj.onDeviceRefreshEnd = function (nodeid, panel, refresh, event) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        Q.qcInjectStyles();
        try { pluginHandler.registerPluginTab({ tabId: 'pluginQuickCommands', tabTitle: 'Quick Commands' }); } catch (e) { }
        st.nodeid = nodeid; // the log is kept across devices and filtered per node when rendered
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

    // Broadcast event after an admin saved the commands. The config is needed on
    // every page now (My Devices toolbar and context menu), so always re-fetch.
    obj.onConfigChanged = function (message) {
        pluginHandler.quickcommands.qcRequestConfig();
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
.qcTag.term { background:#B8741A; }
.qcKey.danger { border-color:#C8362B; padding-top:6px; }
.qcKey.danger::before { content:""; position:absolute; left:0; right:0; top:0; height:4px; background:repeating-linear-gradient(135deg,#C8362B 0 6px,transparent 6px 10px); }
.qcKey.termMode .qcC, .qcMenuI.termMode .qcC { background:#0c1210; color:#c9d4ce; border-radius:3px; padding:1px 6px 1px 5px; }
.qcKey.termMode .qcC { margin:1px -2px 0; }
.qcKey.termMode .qcC::before, .qcMenuI.termMode .qcC::before { content:"> "; color:#4fc07e; font-weight:bold; }
.qcKey.termMode .qcC::after, .qcMenuI.termMode .qcC::after { content:""; display:inline-block; width:6px; height:10px; margin-left:3px; vertical-align:-1px; background:#4fc07e; animation:qcBlink 1.1s steps(1) infinite; }
.night .qcKey.termMode .qcC, .night .qcMenuI.termMode .qcC { background:#000; outline:1px solid #2a3330; }
@keyframes qcBlink { 50% { opacity:0; } }
@media (prefers-reduced-motion: reduce) { .qcKey.termMode .qcC::after, .qcMenuI.termMode .qcC::after { animation:none; } }
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
.qcMenuI .qcN { font-weight:bold; display:flex; align-items:center; gap:5px; white-space:nowrap; }
.qcMenuWrap input.btn { line-height:1.2; }
#qcDeskRow { flex-basis:100%; width:100%; clear:both; }
#qcDeskRow .qcStrip { border-bottom:0; }
.fulldesk #qcDeskRow { display:none; }
.qcMenuI .qcC { font-family:"Cascadia Mono", Consolas, monospace; color:#5a6368; white-space:nowrap; max-width:200px; overflow:hidden; text-overflow:ellipsis; }
.qcMenuI.danger .qcN { color:#C8362B; }
.qcMenuI.danger:not(.termMode) .qcC { color:#C8362B; }
.qcMenuF { padding:6px 10px; border-top:1px solid #d8dedc; display:flex; gap:12px; font-size:11px; }
.night .qcMenuF { border-top-color:#333; }
.qcMenuS { padding:6px 8px; border-bottom:1px solid #d8dedc; }
.night .qcMenuS { border-bottom-color:#333; }
.qcMenuS .qcFwrap, .qcMenuS .qcFin { width:100%; }
.qcMenuI.act { outline:2px solid #1E6BD6; outline-offset:-2px; }
.night .qcMenuI.act { outline-color:#6ea8ff; }
.qcFwrap { position:relative; display:inline-flex; align-items:center; }
.qcFin { padding:2px 20px 3px 9px; border:1px solid #b9c2bf; border-radius:11px; background:#fff; color:#1a1a1a; font-family:inherit; font-size:12px; width:140px; }
.qcFin:focus { outline:2px solid #1E6BD6; outline-offset:1px; }
.night .qcFin { background:#141a19; border-color:#3a4442; color:#dfe5e3; }
.night .qcFin:focus { outline-color:#6ea8ff; }
.qcFclr { position:absolute; right:6px; cursor:pointer; color:#7a8489; font-size:11px; line-height:1; }
.qcFclr:hover { color:#1a1a1a; } .night .qcFclr:hover { color:#fff; }
.qcEmptyF { font-size:12px; color:#5a6368; padding:2px 4px; } .night .qcEmptyF { color:#8b9591; }
.qcChipsF { display:inline-flex; gap:4px; flex-wrap:wrap; align-items:center; margin:0 4px; }
.qcMenuS .qcChipsF { display:flex; margin:6px 0 0; }
.qcGchip { display:inline-flex; align-items:center; gap:4px; padding:1px 9px 2px; border:1px solid #b9c2bf; border-radius:11px; background:#fff; color:#5a6368; font-family:inherit; font-size:11px; font-weight:normal; cursor:pointer; line-height:14px; }
.qcGchip:hover { background:#f4f8f7; color:#1a1a1a; }
.qcGchip.on { background:#E6EDFB; border-color:#1E6BD6; color:#1E6BD6; font-weight:bold; }
.qcGchip:focus-visible { outline:2px solid #1E6BD6; outline-offset:1px; }
.qcGchip .qcDot { margin-right:0; }
.night .qcGchip { background:#141a19; border-color:#3a4442; color:#b8c2bd; }
.night .qcGchip:hover { background:#1d2422; color:#fff; }
.night .qcGchip.on { background:#1D2A44; border-color:#6ea8ff; color:#6ea8ff; }
.qcMk { background:transparent; color:inherit; border-bottom:2px solid #1E6BD6; font-weight:bold; padding:0; }
.night .qcMk { border-bottom-color:#6ea8ff; }
.qcKey.termMode .qcC .qcMk { color:#8fd8ae; border-bottom-color:#8fd8ae; }
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
.qcKey[class*="qcc-"] { border-left:4px solid var(--qcc); }
.qcMenuI[class*="qcc-"] { box-shadow:inset 3px 0 0 var(--qcc); }
.qcGL { font-size:10px; text-transform:uppercase; letter-spacing:0.6px; font-weight:bold; white-space:nowrap; display:inline-flex; align-items:center; gap:4px; color:var(--qccl); }
.night .qcGL { color:var(--qccn); }
.qcGL::before { content:""; width:7px; height:7px; border-radius:2px; background:var(--qcc); }
.qcDot { display:inline-block; width:7px; height:7px; border-radius:2px; margin-right:5px; background:var(--qcc); }
.qcDevBtn { display:inline-flex; align-items:center; gap:6px; margin:0 4px; padding:2px 10px 3px; border:1px solid #8f9a9f; border-bottom-width:3px; border-radius:4px; background:#fff; color:#1a1a1a; font-family:inherit; font-size:12px; font-weight:bold; cursor:pointer; vertical-align:middle; }
.qcDevBtn .qcZap { color:#B8741A; }
.qcDevBtn:hover:enabled { background:#f4f8f7; }
.qcDevBtn:active:enabled { transform:translateY(1px); border-bottom-width:2px; }
.qcDevBtn:disabled { opacity:0.55; cursor:default; }
.qcDevBtn:focus-visible { outline:2px solid #1E6BD6; outline-offset:1px; }
.night .qcDevBtn { background:#111; border-color:#555; color:#ddd; }
.night .qcDevBtn:hover:enabled { background:#1d2422; }
.qcDevBtnBs { font-weight:600; }
.qcDevBtnBs .qcZap { color:#FFC533; margin-right:4px; }
.qcChips { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:4px; text-align:left; }
.qcChip { font-size:11px; border:1px solid #c9d2ce; border-radius:999px; padding:1px 9px 2px; background:#f2f4f3; color:#33403b; }
.night .qcChip { background:#1a1f1e; border-color:#333; color:#b8c2bd; }
.qcKey .qcA { font-size:10px; line-height:12px; color:#1E6BD6; white-space:nowrap; }
.qcKey .qcA.none { color:#99a1a5; }
.night .qcKey .qcA { color:#6ea8ff; } .night .qcKey .qcA.none { color:#666; }
.qcPickH { font-size:10px; text-transform:uppercase; letter-spacing:0.6px; font-weight:bold; color:#4E5560; margin:10px 0 5px; text-align:left; }
.night .qcPickH { color:#8b9591; }
.qcPickWrap { display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start; text-align:left; }
.qcBulkList { border:1px solid #d8dedc; border-radius:4px; margin-top:6px; max-height:300px; overflow:auto; background:#fff; }
.night .qcBulkList { border-color:#333; background:#0a0a0a; }
.qcBR { display:flex; align-items:center; gap:10px; padding:6px 10px; border-bottom:1px solid #e3e7e5; font-size:12px; text-align:left; }
.qcBR:last-child { border-bottom:0; } .night .qcBR { border-bottom-color:#222; }
.qcBR .qcBN { font-weight:bold; min-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.qcBS { width:14px; text-align:center; font-weight:bold; flex:none; }
.qcSpin { display:inline-block; width:9px; height:9px; border:2px solid #B8741A; border-top-color:transparent; border-radius:50%; animation:qcSpin 0.9s linear infinite; }
@keyframes qcSpin { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .qcSpin { animation:none; } }
#qcCxItem { white-space:nowrap; display:block; width:auto; }
#qcCxItem .qcZap { color:#B8741A; font-weight:bold; }
#qcCxItem .qcCxArr { float:right; margin-left:10px; opacity:0.7; }
/* The core caps the context menu at 150px; our entry needs one line. */
#contextMenu.qcWide { max-width:215px; }
#qcCxFly { position:fixed; z-index:1001; min-width:260px; max-height:60vh; overflow:auto; background:#fff; border:1px solid #8f9a9f; box-shadow:0 4px 14px rgba(0,0,0,0.25); font-size:12px; text-align:left; color:#000; display:none; line-height:normal; }
.night #qcCxFly { background:#111; border-color:#555; color:#ddd; }
/* Shared parts of the results controls (toolbar button + floating pill). */
.qcRN { font-weight:600; overflow:hidden; text-overflow:ellipsis; }
.qcRC { font-family:"Cascadia Mono", Consolas, monospace; font-size:12px; }
.qcRCg { color:#2C8C5A; } .qcRCr { color:#C8362B; }
.night .qcRCg, .qcResBtBs .qcRCg { color:#5CB88A; } .night .qcRCr, .qcResBtBs .qcRCr { color:#E06459; }
.qcRX { margin-left:2px; padding:0 4px; color:#5a6368; font-weight:bold; border-radius:6px; }
.qcRX:hover { background:#e3e7e5; color:#000; }
.night .qcRX, .qcResBtBs .qcRX { color:#98A3AD; }
.night .qcRX:hover, .qcResBtBs .qcRX:hover { background:rgba(255,255,255,0.14); color:#fff; }
/* Toolbar results button, classic UI. */
.qcResBt { display:inline-flex; align-items:center; gap:6px; margin:0 4px 0 0; padding:2px 9px 3px; border:1px solid rgba(184,116,26,0.55); border-radius:4px; background:#fff; color:#1a1a1a; font-family:inherit; font-size:12px; cursor:pointer; vertical-align:middle; white-space:nowrap; }
.qcResBt:hover { background:#fdf8f0; }
.qcResBt .qcZap { color:#B8741A; font-weight:bold; }
.night .qcResBt { background:#181d1b; border-color:rgba(224,163,60,0.5); color:#ddd; }
.night .qcResBt:hover { background:#1d2422; }
/* Toolbar results button, modern UI: Bootstrap classes carry size and theme. */
.qcResBtBs { display:inline-flex; align-items:center; gap:6px; border-color:rgba(255,197,51,0.45) !important; white-space:nowrap; }
.qcResBtBs .qcZap { color:#FFC533; }
/* Floating pill (every page except My Devices). */
#qcBulkPill { position:fixed; right:18px; bottom:18px; z-index:1000; display:none; align-items:center; gap:6px; padding:6px 11px 7px; border:1px solid rgba(184,116,26,0.55); border-radius:16px; background:#fff; color:#1a1a1a; font-size:12px; cursor:pointer; box-shadow:0 3px 10px rgba(0,0,0,0.25); max-width:340px; white-space:nowrap; }
#qcBulkPill .qcZap { color:#B8741A; font-weight:bold; }
#qcBulkPill:hover { background:#fdf8f0; }
.night #qcBulkPill { background:#181d1b; border-color:rgba(224,163,60,0.5); color:#ddd; }
.night #qcBulkPill:hover { background:#1d2422; }
`;
        // Fixed palette; each entry is [key stripe, group label on light, group label on night].
        var pal = { red: ['#D2493D', '#B03A30', '#E06459'], orange: ['#D97A1F', '#A85E14', '#E89A4C'], amber: ['#C9A227', '#8F7418', '#D9B84A'], green: ['#3AA06A', '#2C7A50', '#5CB88A'], teal: ['#2E9E9B', '#23807D', '#4FB8B5'], blue: ['#3D7DD8', '#2D62B0', '#5B94E4'], purple: ['#8A63D2', '#6F4DB0', '#A585E0'], pink: ['#C75B9B', '#A34579', '#D67FB2'], slate: ['#6B7280', '#4E5560', '#98A3AD'] };
        for (var k in pal) { css += '.qcc-' + k + ' { --qcc:' + pal[k][0] + '; --qccl:' + pal[k][1] + '; --qccn:' + pal[k][2] + '; }\n'; }
        var s = document.createElement('style'); s.id = 'qcStyles'; s.textContent = css; document.head.appendChild(s);
    };

    obj.qcEsc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

    // Does one scope rule (mode only/except + targets) let this device through?
    // Targets are a union; "except" inverts; an empty "only" matches nothing.
    obj.qcScopePass = function (scope, node) {
        if ((scope == null) || ((scope.mode != 'only') && (scope.mode != 'except'))) return true;
        var hit = false, targets = Array.isArray(scope.targets) ? scope.targets : [];
        for (var i = 0; i < targets.length; i++) {
            var t = targets[i];
            if ((t.t == 'mesh') && (node.meshid == t.id)) { hit = true; break; }
            if ((t.t == 'node') && (node._id == t.id)) { hit = true; break; }
            if ((t.t == 'tag') && Array.isArray(node.tags) && (node.tags.indexOf(t.name) >= 0)) { hit = true; break; }
        }
        return (scope.mode == 'only') ? hit : !hit;
    };

    // A device must pass the group's rule AND the command's own rule.
    // Scoping is visibility only - running still goes through MeshCentral's rights.
    obj.qcInScope = function (cmd, node) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if (node == null) return true;
        var gs = (st.config && st.config.groupScopes) ? st.config.groupScopes[cmd.group || ''] : null;
        return Q.qcScopePass(gs, node) && Q.qcScopePass(cmd.scope, node);
    };

    // Does this command apply to the current device's OS?
    obj.qcApplicable = function (cmd) {
        if ((typeof currentNode == 'undefined') || (currentNode == null) || (currentNode.agent == null)) return false;
        if (!pluginHandler.quickcommands.qcInScope(cmd, currentNode)) return false;
        var win = isWindowsNode(currentNode);
        if (cmd.shell == 'cmd' || cmd.shell == 'ps') return win;
        if (cmd.shell == 'sh') return !win;
        return true; // agent console
    };

    // Case-insensitive substring match over what admins remember: the key's
    // name, the literal command and the group name.
    obj.qcFilterMatch = function (c, q) {
        if (!q) return true;
        q = String(q).toLowerCase();
        return ((c.name || '') + '\n' + (c.command || '') + '\n' + (c.group || '')).toLowerCase().indexOf(q) >= 0;
    };

    // Escapes s and wraps the first match of q in a highlight mark.
    obj.qcMark = function (s, q) {
        var Q = pluginHandler.quickcommands;
        s = String(s == null ? '' : s);
        if (!q) return Q.qcEsc(s);
        var i = s.toLowerCase().indexOf(String(q).toLowerCase());
        if (i < 0) return Q.qcEsc(s);
        return Q.qcEsc(s.substring(0, i)) + '<mark class="qcMk">' + Q.qcEsc(s.substr(i, q.length)) + '</mark>' + Q.qcEsc(s.substring(i + q.length));
    };

    // Surfaces: 't' Terminal strip, 'm' Terminal menu, 's' Desktop strip, 'd' Desktop menu, 'g' General panel.
    obj.qcIsMenuKind = function (kind) { return (kind == 'm') || (kind == 'd'); };
    obj.qcWhereOf = function (kind) { return (kind == 'g') ? 'general' : ((kind == 'd') || (kind == 's')) ? 'desktop' : 'terminal'; };
    obj.qcFilterId = function (kind) { return (kind == 't') ? 'qcTermFilter' : (kind == 'g') ? 'qcGenFilter' : (kind == 'd') ? 'qcDeskFilter' : (kind == 's') ? 'qcDeskStripFilter' : 'qcMenuFilter'; };
    // Selected group chips for a surface as a map name -> true; an empty map means every group.
    obj.qcGroupSel = function (kind) {
        var st = pluginHandler.quickcommands.qcState();
        return st[kind + 'Groups'] || (st[kind + 'Groups'] = {});
    };
    obj.qcToggleGroup = function (kind, name) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var sel = Q.qcGroupSel(kind);
        if (sel[name]) { delete sel[name]; } else { sel[name] = true; }
        if (Q.qcIsMenuKind(kind)) st[kind + 'Active'] = st[kind + 'Filter'] ? 0 : -1;
        return Q.qcSetFilter(kind, st[kind + 'Filter'] || '');
    };
    // Group chips: the chip picks the haystack, the text narrows it. Shown from
    // 2 groups on. Chips show every group of the surface, not only the matches,
    // so a chip can always be switched off again.
    obj.qcChipsHtml = function (kind, cmds) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var groups = Q.qcGroupsFor(cmds).filter(function (g) { return g.name; });
        if (groups.length < 2) return '';
        var sel = Q.qcGroupSel(kind), x = '<span class="qcChipsF">';
        groups.forEach(function (g) {
            var gcol = st.config.groupColors ? st.config.groupColors[g.name] : null;
            x += '<button type="button" class="qcGchip' + (sel[g.name] ? ' on' : '') + (gcol ? ' qcc-' + gcol : '') + '" title="' + (sel[g.name] ? 'Show all groups' : 'Only this group') + '" onclick="event.stopPropagation(); return pluginHandler.quickcommands.qcToggleGroup(\'' + kind + '\',\'' + Q.qcEsc(g.name).replace(/'/g, '\\\'') + '\')">'
                + (gcol ? '<span class="qcDot"></span>' : '') + Q.qcEsc(g.name) + '</button>';
        });
        return x + '</span>';
    };

    // Visible commands for a surface after chips + keyword filter, in display order.
    obj.qcFiltered = function (where, q, kind) {
        var Q = pluginHandler.quickcommands;
        var sel = kind ? Q.qcGroupSel(kind) : {}, any = false;
        for (var k in sel) { any = true; }
        var cmds = Q.qcVisible(where).filter(function (c) {
            if (any && !sel[c.group || '']) return false;
            return Q.qcFilterMatch(c, q);
        });
        var out = [];
        Q.qcGroupsFor(cmds).forEach(function (g) { g.commands.forEach(function (c) { out.push(c); }); });
        return out;
    };

    obj.qcVisible = function (where) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if (st.config == null) return [];
        return st.config.commands.filter(function (c) {
            if (!Q.qcApplicable(c)) return false;
            if (where == 'terminal') return c.showTerminal !== false;
            if (where == 'general') return c.showGeneral === true;
            if (where == 'desktop') return c.showDesktop === true;
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

    // Effective key color: the command's own color wins over its group's color.
    obj.qcColorOf = function (c) {
        var st = pluginHandler.quickcommands.qcState();
        var col = c.color || ((st.config && st.config.groupColors) ? st.config.groupColors[c.group] : '') || '';
        return /^[a-z]+$/.test(col) ? col : '';
    };

    // The CMD/PS/SH/AGENT tag, plus the amber >_ tag on commands typed into the terminal.
    obj.qcTagsHtml = function (c) {
        var Q = pluginHandler.quickcommands;
        return '<span class="qcTag ' + c.shell + '">' + Q.qcEsc(c.shell == 'ps' ? 'PS' : c.shell.toUpperCase()) + '</span>'
            + (c.mode == 'terminal' ? '<span class="qcTag term" title="Typed into the terminal">&gt;_</span>' : '');
    };

    obj.qcKeyHtml = function (c, where, hi) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var busy = false; for (var k in st.pending) { if (st.pending[k].cmd.id == c.id) busy = true; }
        var col = Q.qcColorOf(c);
        var cls = 'qcKey' + (c.confirm ? ' danger' : '') + (c.mode == 'terminal' ? ' termMode' : '') + (busy ? ' busy' : '') + (col ? ' qcc-' + col : '');
        var sub = busy ? ('Running… (view / cancel)') : c.command.split(/\r?\n/)[0];
        var title = (c.description ? c.description + '\n' : '') + c.command + (c.mode == 'terminal' ? '\n(typed into the terminal)' : '');
        var click = busy ? ('qcShowRunning(\'' + Q.qcEsc(c.id) + '\')') : ('qcRun(\'' + Q.qcEsc(c.id) + '\',\'' + where + '\')');
        return '<button type="button" class="' + cls + '" title="' + Q.qcEsc(title) + '" onclick="return pluginHandler.quickcommands.' + click + '">'
            + '<span class="qcN">' + Q.qcTagsHtml(c) + Q.qcMark(c.name, hi) + '</span>'
            + '<span class="qcC">' + (busy ? Q.qcEsc(sub) : Q.qcMark(sub, hi)) + '</span></button>';
    };

    obj.qcRenderAll = function () {
        var Q = pluginHandler.quickcommands;
        try { Q.qcRenderTerminal(); } catch (e) { console.log('quickcommands terminal render', e); }
        try { Q.qcRenderGeneral(); } catch (e) { console.log('quickcommands general render', e); }
        try { Q.qcRenderDesktop(); } catch (e) { console.log('quickcommands desktop render', e); }
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
        var manage = st.canManage ? '<span class="qcLink" onclick="return pluginHandler.quickcommands.qcOpenManage()">Manage…</span>' : '';
        // The keyword filter earns its space once the device has 5+ keys.
        var canFilter = (cmds.length >= 5);

        if (view == 'menu') {
            if (row) row.remove();
            if (wrap == null) {
                var host = document.getElementById('terminalCustomUpperRight');
                if (host == null) return;
                wrap = document.createElement('div'); wrap.id = 'qcTermMenuWrap'; wrap.className = 'qcMenuWrap';
                host.parentNode.insertBefore(wrap, host);
            }
            wrap.innerHTML = Q.qcMenuHtml('m', cmds, canFilter, '<span class="qcLink" onclick="return pluginHandler.quickcommands.qcSetTermView(\'strip\')">Show as strip</span>' + manage);
        } else {
            if (wrap) { wrap.remove(); st.menuOpen = false; }
            if (row == null) {
                var first = table.querySelector('tr');
                if (first == null) return;
                row = document.createElement('tr'); row.id = 'qcTermRow';
                first.insertAdjacentElement('afterend', row);
            }
            row.innerHTML = '<td>' + Q.qcStripHtml('t', cmds, canFilter, '<span class="qcLink" title="Move the commands into a menu in the toolbar" onclick="return pluginHandler.quickcommands.qcSetTermView(\'menu\')">Menu</span>' + (manage ? '&nbsp;&nbsp;' + manage : '')) + '</td>';
        }
    };


    // The keypad strip (label, filter, chips, keys), shared by the Terminal and
    // Desktop strips. tail is the links at the right end.
    obj.qcStripHtml = function (kind, cmds, canFilter, tail) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var where = Q.qcWhereOf(kind), fid = Q.qcFilterId(kind);
        var q = canFilter ? (st[kind + 'Filter'] || '') : '';
        var chips = Q.qcChipsHtml(kind, cmds);
        var shown = Q.qcFiltered(where, q, chips ? kind : null);
        var groups = Q.qcGroupsFor(shown);
        var x = '<div class="qcStrip"><span class="qcLabel">Quick commands</span>';
        if (canFilter) {
            x += '<span class="qcFwrap"><input type="text" id="' + fid + '" class="qcFin" placeholder="Filter" autocomplete="off" title="Filter commands by name, command or group (press / to jump here)" value="' + Q.qcEsc(q) + '" oninput="return pluginHandler.quickcommands.qcSetFilter(\'' + kind + '\', this.value)" onkeydown="return pluginHandler.quickcommands.qcFilterKey(event, \'' + kind + '\')" />'
                + (q ? '<span class="qcFclr" title="Clear filter" onclick="return pluginHandler.quickcommands.qcClearFilter(\'' + kind + '\')">✕</span>' : '') + '</span>';
        }
        x += chips;
        if (shown.length == 0) {
            x += '<span class="qcEmptyF">No commands match ' + (q ? '"' + Q.qcEsc(q) + '"' : 'the chosen groups') + ' · <span class="qcLink" onclick="return pluginHandler.quickcommands.qcClearFilter(\'' + kind + '\')">Clear</span></span>';
        }
        groups.forEach(function (g) {
            var gcol = (g.name && st.config.groupColors) ? st.config.groupColors[g.name] : null;
            x += '<div class="qcGroup" title="' + Q.qcEsc(g.name) + '">';
            if (gcol) x += '<span class="qcGL qcc-' + gcol + '">' + Q.qcEsc(g.name) + '</span>';
            g.commands.forEach(function (c) { x += Q.qcKeyHtml(c, where, q); });
            x += '</div>';
        });
        return x + '<span class="qcGrow"></span>' + tail + '</div>';
    };

    // The "Quick commands ▾" button plus its dropdown, shared by the Terminal
    // and Desktop menus. kind picks the filter state, footer the links at the bottom.
    obj.qcMenuHtml = function (kind, cmds, canFilter, footer) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var where = Q.qcWhereOf(kind), fid = Q.qcFilterId(kind);
        var q = canFilter ? (st[kind + 'Filter'] || '') : '';
        var chips = Q.qcChipsHtml(kind, cmds);
        var shown = Q.qcFiltered(where, q, chips ? kind : null);
        var groups = Q.qcGroupsFor(shown);
        // The modern UI's toolbar buttons are Bootstrap; match them there.
        var bcls = (typeof showModal === 'function') ? ' class="btn btn-secondary btn-sm"' : '';
        var x = '<input type="button"' + bcls + ' value="Quick commands ▾" onclick="return pluginHandler.quickcommands.qcToggleMenu(event)" onkeypress="return false" onkeydown="return false" />';
        x += '<div class="qcMenu" style="display:' + (st.menuOpen ? '' : 'none') + '">';
        if (canFilter || chips) {
            x += '<div class="qcMenuS">';
            if (canFilter) {
                x += '<span class="qcFwrap"><input type="text" id="' + fid + '" class="qcFin" placeholder="Filter commands" autocomplete="off" value="' + Q.qcEsc(q) + '" oninput="return pluginHandler.quickcommands.qcSetFilter(\'' + kind + '\', this.value)" onkeydown="return pluginHandler.quickcommands.qcFilterKey(event, \'' + kind + '\')" />'
                    + (q ? '<span class="qcFclr" title="Clear filter" onclick="return pluginHandler.quickcommands.qcClearFilter(\'' + kind + '\')">✕</span>' : '') + '</span>';
            }
            x += chips + '</div>';
        }
        if (shown.length == 0) {
            x += '<div class="qcEmpty">No commands match ' + (q ? '"' + Q.qcEsc(q) + '"' : 'the chosen groups') + '. <span class="qcLink" onclick="return pluginHandler.quickcommands.qcClearFilter(\'' + kind + '\')">Clear filter</span></div>';
        }
        var idx = 0;
        groups.forEach(function (g) {
            var gcol = (g.name && st.config.groupColors) ? st.config.groupColors[g.name] : null;
            if (g.name) x += '<div class="qcMenuH">' + (gcol ? '<span class="qcDot qcc-' + gcol + '"></span>' : '') + Q.qcEsc(g.name) + '</div>';
            g.commands.forEach(function (c) {
                var col = Q.qcColorOf(c);
                var act = (q && (idx === st[kind + 'Active'])) ? ' act' : '';
                x += '<button type="button" class="qcMenuI' + act + (c.confirm ? ' danger' : '') + (c.mode == 'terminal' ? ' termMode' : '') + (col ? ' qcc-' + col : '') + '" title="' + Q.qcEsc(c.description || '') + '" onclick="return pluginHandler.quickcommands.qcRun(\'' + Q.qcEsc(c.id) + '\',\'' + where + '\')">'
                    + '<span class="qcN">' + Q.qcTagsHtml(c) + Q.qcMark(c.name, q) + '</span><span class="qcC">' + Q.qcMark(c.command.split(/\r?\n/)[0], q) + '</span></button>';
                idx++;
            });
        });
        x += '<div class="qcMenuF">' + footer + '</div></div>';
        return x;
    };

    // Desktop tab: a strip at the bottom of the toolbar, or a menu button next to
    // the Actions button. The desktop area is sized from the viewport by the core,
    // so the strip's height is taken off it (qcDeskFit) to keep the page from scrolling.
    obj.qcRenderDesktop = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var host = document.getElementById('desktopCustomUpperRight'), bar = document.getElementById('deskarea1');
        if ((host == null) || (bar == null)) return;
        var wrap = document.getElementById('qcDeskMenuWrap'), row = document.getElementById('qcDeskRow');
        var cmds = Q.qcVisible('desktop');
        var view = getstore('qc_deskview', (st.config && st.config.settings) ? st.config.settings.desktopView : 'menu');
        if ((st.config == null) || (cmds.length == 0)) { if (wrap) wrap.remove(); if (row) row.remove(); Q.qcDeskFit(); return; }
        var manage = st.canManage ? '<span class="qcLink" onclick="return pluginHandler.quickcommands.qcOpenManage()">Manage…</span>' : '';
        var canFilter = (cmds.length >= 5);
        if (view == 'strip') {
            if (wrap) { wrap.remove(); st.menuOpen = false; }
            if (row == null) { row = document.createElement('div'); row.id = 'qcDeskRow'; bar.appendChild(row); }
            row.innerHTML = Q.qcStripHtml('s', cmds, canFilter, '<span class="qcLink" title="Move the commands into a menu in the toolbar" onclick="return pluginHandler.quickcommands.qcSetDeskView(\'menu\')">Menu</span>' + (manage ? '&nbsp;&nbsp;' + manage : ''));
        } else {
            if (row) row.remove();
            if (wrap == null) {
                wrap = document.createElement('div'); wrap.id = 'qcDeskMenuWrap'; wrap.className = 'qcMenuWrap';
                host.parentNode.insertBefore(wrap, host);
            }
            wrap.innerHTML = Q.qcMenuHtml('d', cmds, canFilter, '<span class="qcLink" onclick="return pluginHandler.quickcommands.qcSetDeskView(\'strip\')">Show as strip</span>' + manage);
        }
        Q.qcDeskFit();
    };

    // Take the strip's height off the desktop area. The core writes the area's
    // height as an inline calc() on every resize; values we wrote ourselves are
    // recognised and skipped, anything else is treated as a fresh base value.
    obj.qcDeskFit = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState(), f = st.deskFit;
        var area = document.getElementById('deskarea3x'), row = document.getElementById('qcDeskRow');
        if (area == null) return;
        if (f.obs == null) {
            try {
                f.obs = new MutationObserver(function () { pluginHandler.quickcommands.qcDeskFit(); });
                f.obs.observe(area, { attributes: true, attributeFilter: ['style'] });
                if (typeof ResizeObserver == 'function') { f.ro = new ResizeObserver(function () { pluginHandler.quickcommands.qcDeskFit(); }); }
            } catch (e) { }
        }
        if (f.ro && row && (f.roRow !== row)) { try { if (f.roRow) f.ro.unobserve(f.roRow); f.ro.observe(row); f.roRow = row; } catch (e) { } }
        var h = (row && (row.offsetParent != null)) ? row.offsetHeight : 0;
        // The browser re-serialises calc() (e.g. "calc(-247px + 100vh)"), so the
        // values are compared as numbers, not as strings.
        var parse = function (v) {
            if (!/^calc\(.*\)$/.test(v || '')) return null;
            var out = { px: 0, vh: 0 }, re = /([+-])?\s*([\d.]+)(px|vh)/g, m, any = false;
            while ((m = re.exec(v.replace(/^calc\(|\)$/g, ''))) != null) { out[m[3]] += parseFloat(m[2]) * ((m[1] == '-') ? -1 : 1); any = true; }
            return any ? out : null;
        };
        var same = function (x, y) { return (x != null) && (y != null) && (Math.abs(x.px - y.px) < 0.5) && (Math.abs(x.vh - y.vh) < 0.5); };
        if (f.base == null) f.base = {}; if (f.mine == null) f.mine = {};
        ['height', 'max-height'].forEach(function (p) {
            var cur = parse(area.style.getPropertyValue(p));
            if (!same(cur, f.mine[p])) { f.base[p] = cur; } // written by the core (or not a calc, e.g. full screen)
            var base = f.base[p];
            if (base == null) { f.mine[p] = null; return; }
            var want = { vh: base.vh, px: base.px - h };
            if (!same(cur, want)) { area.style.setProperty(p, 'calc(' + want.vh + 'vh - ' + (-want.px) + 'px)'); }
            f.mine[p] = want;
        });
    };

    // Keyword filter state + focus restore. Renders replace the whole strip/menu/panel
    // markup, so the input's value and caret are put back by hand after the render.
    obj.qcSetFilter = function (kind, v) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if (Q.qcIsMenuKind(kind) && (v !== st[kind + 'Filter'])) { st[kind + 'Active'] = v ? 0 : -1; }
        st[kind + 'Filter'] = v;
        if (kind == 'g') { Q.qcRenderGeneral(); } else if ((kind == 'd') || (kind == 's')) { Q.qcRenderDesktop(); } else { Q.qcRenderTerminal(); }
        var f = document.getElementById(Q.qcFilterId(kind));
        // Give the field its focus back only when it had it (or is the natural
        // target after a chip click) - never yank focus from a running terminal.
        var a = document.activeElement, fromUs = (a == null) || (a === document.body) || !!(a.closest && a.closest('#qcTermRow, .qcMenuWrap, #qcGeneral'));
        if (f && fromUs) { f.focus(); var l = f.value.length; try { f.setSelectionRange(l, l); } catch (e) { } }
        return false;
    };
    // "Clear" resets the text and the group chips of that surface.
    obj.qcClearFilter = function (kind) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        st[kind + 'Groups'] = {};
        return Q.qcSetFilter(kind, '');
    };
    obj.qcFilterKey = function (e, kind) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var q = st[kind + 'Filter'];
        if (e.key == 'Escape') { // first Esc clears, second leaves the field
            if (q) { Q.qcSetFilter(kind, ''); } else { e.target.blur(); }
            e.stopPropagation(); e.preventDefault(); return false;
        }
        var where = Q.qcWhereOf(kind);
        var vis = Q.qcFiltered(where, q || '', kind);
        if (Q.qcIsMenuKind(kind)) {
            if ((e.key == 'ArrowDown') || (e.key == 'ArrowUp')) {
                if (vis.length) {
                    var cur = (st[kind + 'Active'] == null || st[kind + 'Active'] < 0) ? -1 : st[kind + 'Active'];
                    st[kind + 'Active'] = (cur + ((e.key == 'ArrowDown') ? 1 : -1) + vis.length) % vis.length;
                    Q.qcSetFilter(kind, st[kind + 'Filter'] || ''); // re-render + refocus
                    var act = document.querySelector('.qcMenuWrap .qcMenuI.act');
                    if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest' });
                }
                e.preventDefault(); return false;
            }
            if (e.key == 'Enter') {
                var a = st[kind + 'Active'];
                var c = (q && (a >= 0) && vis[a]) ? vis[a] : ((vis.length == 1) ? vis[0] : null);
                if (c) { Q.qcRun(c.id, where); }
                e.preventDefault(); return false;
            }
        } else if (e.key == 'Enter') {
            // The last key standing runs on Enter - filter-to-one is a launcher.
            if (q && (vis.length == 1)) { Q.qcRun(vis[0].id, where); }
            e.preventDefault(); return false;
        }
        return true;
    };

    obj.qcToggleMenu = function (e) {
        var st = pluginHandler.quickcommands.qcState();
        st.menuOpen = !st.menuOpen;
        var wrap = (e && e.target && e.target.closest) ? e.target.closest('.qcMenuWrap') : null;
        // Only one menu is on screen at a time (Terminal or Desktop tab); close the rest.
        document.querySelectorAll('.qcMenuWrap .qcMenu').forEach(function (m) { m.style.display = (st.menuOpen && wrap && wrap.contains(m)) ? '' : 'none'; });
        if (st.menuOpen && wrap) { var f = wrap.querySelector('.qcFin'); if (f) { f.focus(); f.select(); } }
        if (e && e.stopPropagation) e.stopPropagation();
        return false;
    };
    obj.qcCloseMenu = function () {
        var st = pluginHandler.quickcommands.qcState();
        st.menuOpen = false;
        document.querySelectorAll('.qcMenuWrap .qcMenu').forEach(function (m) { m.style.display = 'none'; });
    };
    obj.qcSetTermView = function (view) {
        putstore('qc_termview', view);
        pluginHandler.quickcommands.qcCloseMenu();
        pluginHandler.quickcommands.qcRenderTerminal();
        return false;
    };
    obj.qcSetDeskView = function (view) {
        putstore('qc_deskview', view);
        pluginHandler.quickcommands.qcCloseMenu();
        pluginHandler.quickcommands.qcRenderDesktop();
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
        var canFilter = (cmds.length >= 5);
        var q = canFilter ? (st.gFilter || '') : '';
        var chips = Q.qcChipsHtml('g', cmds);
        var shown = Q.qcFiltered('general', q, chips ? 'g' : null);
        var x = '<div class="qcPanel"><div class="qcPanelH"><span>Quick commands</span><span class="qcHint">Output opens in a window when the command finishes</span><span class="qcGrow"></span>';
        x += chips;
        if (canFilter) {
            x += '<span class="qcFwrap"><input type="text" id="qcGenFilter" class="qcFin" placeholder="Filter" autocomplete="off" title="Filter commands by name, command or group (press / to jump here)" value="' + Q.qcEsc(q) + '" oninput="return pluginHandler.quickcommands.qcSetFilter(\'g\', this.value)" onkeydown="return pluginHandler.quickcommands.qcFilterKey(event, \'g\')" />'
                + (q ? '<span class="qcFclr" title="Clear filter" onclick="return pluginHandler.quickcommands.qcClearFilter(\'g\')">✕</span>' : '') + '</span>';
        }
        x += (st.canManage ? '<span class="qcLink" onclick="return pluginHandler.quickcommands.qcOpenManage()">Manage…</span>' : '') + '</div><div class="qcPanelB">';
        if (shown.length == 0) {
            x += '<span class="qcEmptyF">No commands match ' + (q ? '"' + Q.qcEsc(q) + '"' : 'the chosen groups') + ' · <span class="qcLink" onclick="return pluginHandler.quickcommands.qcClearFilter(\'g\')">Clear</span></span>';
        }
        shown.forEach(function (c) { x += Q.qcKeyHtml(c, 'general', q); });
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
                var gcol = (g.name && st.config.groupColors) ? st.config.groupColors[g.name] : null;
                if (g.name) x += '<div class="qcGH">' + (gcol ? '<span class="qcDot qcc-' + gcol + '"></span>' : '') + Q.qcEsc(g.name) + '</div>';
                x += '<div class="qcWrap">';
                g.commands.forEach(function (c) { x += Q.qcKeyHtml(c, 'tab'); });
                x += '</div>';
            });
        }
        x += '<div class="qcMini"><span class="qcTag term">&gt;_</span> is typed into the Terminal tab instead of running silently.' + (st.canManage ? ' <span class="qcLink" onclick="return pluginHandler.quickcommands.qcOpenManage()">Manage commands…</span>' : '') + '</div>';
        x += '</div><div class="qcLog" id="qcLog"></div></div>';
        host.innerHTML = x;
        Q.qcRenderLog();
    };

    obj.qcRenderLog = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var host = document.getElementById('qcLog');
        if (host == null) return;
        var shown = 0, rows = '';
        for (var i = 0; i < st.log.length; i++) {
            var e = st.log[i], status;
            if ((e.nodeid != null) && (e.nodeid != st.nodeid)) continue; // other device's runs stay in their own log
            shown++;
            if (e.state == 'running') status = '<span class="qcMuted">running…</span>';
            else if (e.state == 'typed') status = '<span class="qcMuted">typed into terminal</span>';
            else if (e.state == 'error') status = '<span class="qcErr">' + Q.qcEsc(e.error) + '</span>';
            else status = '<span class="qcOk">done · ' + Q.qcFmtMs(e.ms) + '</span>';
            if (e.bulk) status = '<span class="qcMuted" style="font-size:11px">group run</span>&nbsp;&nbsp;' + status;
            rows += '<div class="qcLogRow" onclick="return pluginHandler.quickcommands.qcShowOutput(' + i + ')"><span class="qcT">' + Q.qcEsc(e.time) + '</span><span class="qcTag ' + e.cmd.shell + '">' + Q.qcEsc(e.cmd.shell == 'ps' ? 'PS' : e.cmd.shell.toUpperCase()) + '</span><b>' + Q.qcEsc(e.cmd.name) + '</b><span class="qcC">' + Q.qcEsc(e.cmd.command.split(/\r?\n/)[0]) + '</span><span class="qcGrow"></span>' + status + '</div>';
        }
        var x = '<div class="qcPanelH"><span>Run log</span><span class="qcHint">kept across reloads in this tab</span><span class="qcGrow"></span>' + (shown ? '<span class="qcLink" onclick="return pluginHandler.quickcommands.qcClearLog()">Clear</span>' : '') + '</div>';
        if (shown == 0) { x += '<div class="qcEmpty">Nothing has run on this device yet. Output of every command you run from here, the General tab, the Terminal tab or a My Devices group run is kept in this list.</div>'; }
        host.innerHTML = x + rows;
    };

    obj.qcClearLog = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        st.log = st.log.filter(function (e) { return (e.nodeid != null) && (e.nodeid != st.nodeid); });
        Q.qcLogSave();
        Q.qcRenderLog();
        return false;
    };

    // Persist the run log for this browser tab; heavy fields are capped so a big
    // output cannot blow the sessionStorage quota (~5MB) away.
    obj.qcLogSave = function () {
        var st = pluginHandler.quickcommands.qcState();
        try {
            var out = st.log.map(function (e) {
                return { cmd: e.cmd, state: e.state, time: e.time, start: e.start, ms: e.ms, error: e.error, rid: e.rid, nodeid: e.nodeid, name: e.name, bulk: e.bulk, canKill: e.canKill, output: (e.output && e.output.length > 100000) ? e.output.substring(0, 100000) + '\n[...truncated for the saved log]' : e.output };
            });
            sessionStorage.setItem('qcRunLog', JSON.stringify(out));
        } catch (ex) { }
    };
    obj.qcFmtMs = function (ms) { if (ms == null) return ''; return (ms < 1000) ? (ms + ' ms') : ((ms / 1000).toFixed(1) + ' s'); };

    // MeshCentral has two web UIs. The classic one (default.handlebars) shows a
    // dialog as soon as setDialogMode() is called. The Bootstrap one
    // (default3.handlebars) only prepares it there and needs showModal() as well
    // - without it nothing appears and xxdialogMode stays set, which blocks every
    // click in the interface. So always go through here.
    obj.qcDialog = function (title, buttons, okFn, html, wide) {
        var newUi = (typeof showModal === 'function');
        // Core dialogs built with setModalContent() (e.g. Group Action) overwrite
        // dialog2 and destroy #id_dialogOptions; setDialogMode() then crashes on it.
        // Restore the stock structure first.
        if (newUi && (document.getElementById('id_dialogOptions') == null)) {
            var d2 = document.getElementById('dialog2');
            if (d2) { d2.innerHTML = '<div id=id_dialogOptions></div>'; }
        }
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
        for (var k in st.pending) { if ((st.pending[k].bulk !== true) && (st.pending[k].cmd.id == id)) { return Q.qcShowRunning(id); } }
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

    // The command text as it goes into the runcommands message. The agent pipes the
    // script plus an 'exit' line into 'powershell -command -', whose raw host reads
    // stdin line by line: a multi-line construct (if/else, function, here-string)
    // is collected until a BLANK line submits it - so a script ending with a block
    // swallows the exit line and waits forever, and a blank line INSIDE a block
    // submits it half-finished. Shipping a multi-line script as one self-decoding
    // line avoids that mode entirely (and keeps non-ASCII intact); the base64 is
    // built from UTF-8 bytes to match [Text.Encoding]::UTF8 on the other side.
    obj.qcCmds = function (cmd) {
        if (cmd.shell != 'ps') return cmd.command;
        if (cmd.command.indexOf('\n') == -1) return cmd.command + '\r\n';
        var bytes = new TextEncoder().encode(cmd.command), bin = '';
        for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return "iex([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" + btoa(bin) + "')))\r\n";
    };

    // Silent run through the agent's "runcommands"; the result comes back via qcIntercept.
    obj.qcExec = function (cmd) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if ((currentNode == null) || (currentNode.conn & 1) == 0) { Q.qcDialog('Quick commands', 1, null, 'The agent is not connected, so "' + Q.qcEsc(cmd.name) + '" cannot run right now.'); return; }
        var types = { cmd: 1, ps: 2, sh: 3, agent: 4 };
        var rid = 'qc-' + Math.random().toString(36).substring(2, 12);
        var entry = { cmd: cmd, state: 'running', time: new Date().toLocaleTimeString(), start: Date.now(), output: '', rid: rid, nodeid: currentNode._id, name: currentNode.name };
        st.log.unshift(entry); if (st.log.length > 50) st.log.pop();
        Q.qcLogSave();
        st.pending[rid] = entry;
        // The agent streams everything the command prints to the console channel while it
        // runs (the reply only arrives when the shell exits), so collect it for live output.
        entry.collect = true;
        if (cmd.shell == 'agent') { entry.timer = setTimeout(function () { pluginHandler.quickcommands.qcFinish(rid, null); }, 4000); }
        else { entry.timer = setTimeout(function () { var Q2 = pluginHandler.quickcommands, e2 = Q2.qcState().pending[rid]; if (e2) e2.canKill = true; Q2.qcFinish(rid, 'No reply from the agent after 5 minutes. The command is probably still running or waiting for input on the device and blocks further run commands. "Free the agent" kills it on the device.'); }, 300000); }
        meshserver.send({ action: 'runcommands', nodeids: [currentNode._id], type: types[cmd.shell] || 1, cmds: Q.qcCmds(cmd), runAsUser: (cmd.runAs | 0), reply: true, responseid: rid });
        Q.qcRenderAll();
    };

    // Picks up results from the server message stream.
    obj.qcIntercept = function (message) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if ((message == null) || (typeof message != 'object')) return;
        // The socket is provably open when the first server message arrives - a good
        // moment to fetch the config, which the My Devices surfaces need right away.
        if ((st.config == null) && (st.cfgReq !== true)) { st.cfgReq = true; setTimeout(function () { pluginHandler.quickcommands.qcRequestConfig(); }, 100); }
        if ((message.action == 'msg') && (message.type == 'runcommands') && (message.responseid != null) && st.pending[message.responseid]) {
            var pe = st.pending[message.responseid];
            pe.output = (typeof message.result == 'string') ? message.result : JSON.stringify(message.result);
            Q.qcFinish(message.responseid, pe.cancelling ? 'Cancelled - the command was stopped on the device.' : null);
        } else if ((message.action == 'runcommands') && (message.responseid != null) && st.pending[message.responseid]) {
            var r = message.result;
            if (r == 'OK') { if (!st.pending[message.responseid].collect) { /* reply will follow */ } }
            else { Q.qcFinish(message.responseid, (typeof r == 'string') ? r : 'Failed'); }
        } else if ((message.action == 'msg') && (message.type == 'console') && (typeof message.value == 'string')) {
            // Feedback from our own agent-console evals (kill, input) - not command output.
            if (message.value.indexOf('"quickcommands:') == 0) return;
            // The agent runs one command at a time; a second one is rejected with this
            // console message and never gets a reply, so fail it right away.
            if (message.value.indexOf('Run commands can\'t execute, already busy') != -1) {
                var newest = null;
                for (var k in st.pending) { var e = st.pending[k]; if ((e.cmd.shell != 'agent') && (e.nodeid == message.nodeid) && ((Date.now() - e.start) < 15000) && ((newest == null) || (e.start > newest.start))) { newest = e; } }
                if (newest != null) { newest.canKill = true; Q.qcFinish(newest.rid, 'The agent is still busy with an earlier run command - it executes one at a time and rejected this one. "Free the agent" kills the stuck command on the device.'); return; }
            }
            for (var k in st.pending) {
                var e = st.pending[k];
                if (e.collect && (e.nodeid == message.nodeid)) {
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
        Q.qcLogSave();
        Q.qcRenderAll();
        // If the output window is already open on this run, update it in place.
        if (typeof xxdialogMode != 'undefined' && xxdialogMode) {
            var pre = document.getElementById('qcOutPre');
            if (pre && (pre.getAttribute('data-rid') == rid)) {
                pre.textContent = (e.output && e.output.length) ? e.output : '(no output)';
                var stat = document.getElementById('qcOutStatus');
                if (stat) { stat.innerHTML = error ? ('<span class="qcErr">' + Q.qcEsc(error) + '</span>') : ('<span class="qcOk">' + Q.qcFmtMs(e.ms) + '</span>'); }
                var btns = document.getElementById('qcOutBtns');
                if (btns) { btns.innerHTML = Q.qcButtonsHtml(e, st.log.indexOf(e)); }
                var ir = document.getElementById('qcInRow');
                if (ir) { ir.style.display = 'none'; }
                if (e.bulk) { Q.qcBulkPillUpdate(); }
                return;
            }
        }
        // A run from the My Devices page updates its row in the results dialog instead.
        if (e.bulk) { Q.qcBulkRowUpdate(e); return; }
        // Show the result when the user is still looking at this device.
        if ((currentNode != null) && (st.nodeid == currentNode._id) && (xxcurrentView >= 10) && (xxcurrentView < 20) && !xxdialogMode) { Q.qcShowOutput(st.log.indexOf(e)); }
    };

    // Kill the run-commands shell on the device. meshcore keeps it in mesh.cmdchild
    // and frees the run-commands slot when it exits; there is no protocol message for
    // this, so it goes through the agent console's 'eval' command (which the server
    // only routes for users with agent console rights). On Windows taskkill /T also
    // takes the command's own process (gpupdate, ...) down with the shell.
    obj.qcSendKill = function (nodeid) {
        if (nodeid == null) { nodeid = ((typeof currentNode != 'undefined') && (currentNode != null)) ? currentNode._id : null; }
        if ((nodeid == null) || (typeof meshserver != 'object') || (meshserver == null)) return;
        var js = "(function(){var c=require('MeshAgent').cmdchild;if(c==null){return 'quickcommands: nothing to kill';}var p=c.pid;if((process.platform=='win32')&&p){require('child_process').execFile(process.env['windir']+'\\\\system32\\\\taskkill.exe',['taskkill','/F','/T','/PID',''+p]);}try{c.kill();}catch(e){}return 'quickcommands: kill requested';})()";
        meshserver.send({ action: 'msg', type: 'console', nodeid: nodeid, value: 'eval "' + js + '"' });
    };

    // Cancel a running command: ask the agent to kill it. When the kill works the
    // shell exits and its reply closes the entry with the output so far; when the
    // agent does not confirm within 10 seconds, release the browser side anyway.
    obj.qcCancelRun = function (rid) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var e = st.pending[rid]; if (e == null) return false;
        if (e.cmd.shell == 'agent') { Q.qcFinish(rid, 'Cancelled.'); return false; }
        if (e.cancelling) return false;
        e.cancelling = true;
        Q.qcSendKill(e.nodeid);
        if (e.timer) clearTimeout(e.timer);
        e.timer = setTimeout(function () { pluginHandler.quickcommands.qcFinish(rid, 'Cancelled, but the agent did not confirm the kill (it needs agent console rights and a connected agent). The command may still be running and blocks further run commands until it ends or the agent restarts.'); }, 10000);
        var pre = document.getElementById('qcOutPre');
        if (pre && (pre.getAttribute('data-rid') == rid)) { var s2 = document.getElementById('qcOutStatus'); if (s2) s2.innerHTML = '<span class="qcMuted">cancelling…</span>'; }
        return false;
    };

    // Send one line of input to the running command's stdin (same agent console
    // channel as the kill). This is how a question a background command asks gets
    // answered - mind that the question itself is often invisible here, because
    // programs buffer their output when it goes to a pipe.
    obj.qcSendInput = function (rid) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var e = st.pending[rid]; if (e == null) return false;
        var box = document.getElementById('qcInText'); if (box == null) return false;
        var t = box.value.replace(/[\r\n]/g, '');
        // The text travels as a single-quoted literal inside the eval code; the
        // console argument itself is double-quoted, so double quotes cannot pass.
        var lit = t.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '');
        var inode = (e.nodeid && (typeof getNodeFromId == 'function')) ? getNodeFromId(e.nodeid) : currentNode;
        var nl = ((typeof isWindowsNode == 'function') && inode && isWindowsNode(inode)) ? '\\r\\n' : '\\n';
        // The shell's own 'exit' line gets swallowed by the program that asks the
        // question, so send a fresh one after the answer - the run then ends by
        // itself as soon as the command finishes. If another question follows, the
        // program eats this exit too and the next answer brings the next one.
        var js = "(function(){var c=require('MeshAgent').cmdchild;if(c==null){return 'quickcommands: no running shell';}c.stdin.write('" + lit + nl + "exit" + nl + "');return 'quickcommands: input sent';})()";
        meshserver.send({ action: 'msg', type: 'console', nodeid: (e.nodeid || currentNode._id), value: 'eval "' + js + '"' });
        e.output += '> ' + t + '\n'; // echo locally so the sent answer is visible
        box.value = '';
        var pre = document.getElementById('qcOutPre');
        if (pre && (pre.getAttribute('data-rid') == rid)) { pre.textContent = e.output; pre.scrollTop = pre.scrollHeight; }
        return false;
    };

    // "Free the agent": kill whatever run command is blocking it, whoever started it.
    obj.qcFreeAgent = function (btn, nodeid) {
        pluginHandler.quickcommands.qcSendKill(nodeid);
        if (btn) { btn.value = 'Kill sent'; btn.disabled = true; }
        return false;
    };

    obj.qcButtonsHtml = function (e, idx) {
        var Q = pluginHandler.quickcommands;
        if (e.bulk) {
            var y = '<input type="button" value="Copy" onclick="return pluginHandler.quickcommands.qcBulkCopy(\'' + Q.qcEsc(e.rid) + '\')" />';
            if (e.state == 'running') { y += '&nbsp;<input type="button" value="Cancel" onclick="return pluginHandler.quickcommands.qcCancelRun(\'' + Q.qcEsc(e.rid) + '\')" />'; }
            else if (e.canKill) { y += '&nbsp;<input type="button" value="Free the agent" title="Kills the stuck command on the device so the agent accepts run commands again (needs agent console rights)" onclick="return pluginHandler.quickcommands.qcFreeAgent(this,\'' + Q.qcEsc(e.nodeid) + '\')" />'; }
            // Only when this run's results overview still exists (not after a reload
            // or a newer group run).
            var b = pluginHandler.quickcommands.qcState().bulk;
            if (b && b.byRid[e.rid]) { y += '&nbsp;<input type="button" value="Back to results" onclick="return pluginHandler.quickcommands.qcBulkBack()" />'; }
            return y;
        }
        var x = '<input type="button" value="Copy" onclick="return pluginHandler.quickcommands.qcCopyOutput(' + idx + ')" />';
        if (e.state == 'running') { x += '&nbsp;<input type="button" value="Cancel" onclick="return pluginHandler.quickcommands.qcCancelRun(\'' + Q.qcEsc(e.rid) + '\')" />'; }
        else {
            if (e.canKill) { x += '&nbsp;<input type="button" value="Free the agent" title="Kills the stuck command on the device so the agent accepts run commands again (needs agent console rights)" onclick="return pluginHandler.quickcommands.qcFreeAgent(this)" />'; }
            x += '&nbsp;<input type="button" value="Run again" onclick="return pluginHandler.quickcommands.qcRunAgain(\'' + Q.qcEsc(e.cmd.id) + '\')" />';
        }
        return x;
    };

    // Open the output window of the run that is currently pending for a command.
    obj.qcShowRunning = function (cmdid) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        for (var k in st.pending) { if ((st.pending[k].bulk !== true) && (st.pending[k].cmd.id == cmdid)) { return Q.qcShowOutput(st.log.indexOf(st.pending[k])); } }
        return false;
    };

    obj.qcShowOutput = function (idx) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var e = st.log[idx]; if (e == null) return false;
        if (xxdialogMode) return false;
        var status = (e.state == 'error') ? '<span class="qcErr">' + Q.qcEsc(e.error) + '</span>' : (e.state == 'running' ? '<span class="qcMuted">running…</span>' : (e.state == 'typed' ? '<span class="qcMuted">typed into terminal</span>' : '<span class="qcOk">' + Q.qcFmtMs(e.ms) + '</span>'));
        var runAs = ['as agent', 'as user if signed in', 'as user'][e.cmd.runAs | 0] || '';
        var body = (e.output && e.output.length) ? Q.qcEsc(e.output) : '<span class="qcMuted">(no output' + (e.state == 'running' ? ' yet' : (e.cmd.shell == 'agent' ? ' captured; see the Console tab' : '')) + ')</span>';
        var buttons = Q.qcButtonsHtml(e, idx);
        var inputRow = ((e.state == 'running') && (e.cmd.shell != 'agent'))
            ? '<div id="qcInRow" style="margin-top:8px;display:flex;gap:6px"><input type="text" id="qcInText" style="flex:1" placeholder="Answer the command\'s question (e.g. j or n) - also works before it appears" onkeydown="if(event.keyCode==13){event.preventDefault();pluginHandler.quickcommands.qcSendInput(\'' + Q.qcEsc(e.rid) + '\');return false;}" /><input type="button" value="Send" onclick="return pluginHandler.quickcommands.qcSendInput(\'' + Q.qcEsc(e.rid) + '\')" /></div>'
            : '';
        var html = '<div class="qcOutH"><span class="qcTag ' + e.cmd.shell + '">' + Q.qcEsc(e.cmd.shell == 'ps' ? 'PS' : e.cmd.shell.toUpperCase()) + '</span><b>' + Q.qcEsc(e.cmd.name) + '</b><span>on ' + Q.qcEsc(e.name || (currentNode ? currentNode.name : '')) + '</span><span class="qcGrow"></span><span id="qcOutStatus">' + status + '</span></div>'
            + '<div class="qcOutH"><span class="qcC">' + Q.qcEsc(e.cmd.command.split(/\r?\n/)[0]) + '</span><span class="qcGrow"></span><span>' + runAs + '</span></div>'
            + '<pre class="qcOut" id="qcOutPre"' + (e.rid ? (' data-rid="' + Q.qcEsc(e.rid) + '"') : '') + '>' + body + '</pre>'
            + inputRow
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
        var entry = { cmd: cmd, state: 'typed', time: new Date().toLocaleTimeString(), start: Date.now(), output: '', nodeid: currentNode._id, name: currentNode.name };
        st.log.unshift(entry); if (st.log.length > 50) st.log.pop();
        Q.qcLogSave();
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
    //  My Devices page: toolbar button next to Group Action, an extra Group
    //  Action operation, and a right-click context menu entry with a flyout.
    //  All anchors below exist in both web UIs (default and default3).
    // ------------------------------------------------------------------

    obj.qcMyDevicesInit = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if (st.mdInit) return; st.mdInit = true;
        // 1B: "Quick Commands" button right after Group Action, same enable rules.
        try {
            var ga = document.getElementById('GroupActionButton');
            if (ga != null) {
                var b = document.createElement('button');
                b.id = 'qcDevicesBtn'; b.type = 'button';
                // The modern UI's toolbar buttons are Bootstrap; matching their
                // classes gives the same height and the same gap to the next control.
                b.className = (typeof showModal === 'function') ? (ga.className + ' qcDevBtnBs').replace('btn-primary', 'btn-secondary') : 'qcDevBtn';
                b.title = 'Run a quick command on all selected devices';
                b.innerHTML = '<span class="qcZap">⚡</span>Quick Commands';
                b.disabled = ga.disabled;
                b.onclick = function () { return pluginHandler.quickcommands.qcDevicesBtnClick(); };
                ga.parentNode.insertBefore(b, ga.nextSibling);
                // The core enables/disables Group Action from the selection count; mirror it.
                new MutationObserver(function () { b.disabled = ga.disabled; }).observe(ga, { attributes: true, attributeFilter: ['disabled'] });
                // Results button: appears next to it while a group run is around
                // (the floating pill takes over on every other page).
                var rb = document.createElement('button');
                rb.id = 'qcResultsBtn'; rb.type = 'button';
                rb.className = (typeof showModal === 'function') ? ('btn btn-secondary me-1 btn-sm qcResBtBs') : 'qcResBt';
                rb.title = 'Group run results';
                rb.style.display = 'none';
                rb.onclick = function (ev) { return pluginHandler.quickcommands.qcBulkCtrlClick(ev); };
                b.parentNode.insertBefore(rb, b.nextSibling);
            }
        } catch (e) { }
        // The pill hides on My Devices and shows elsewhere; follow view changes.
        try {
            if (typeof go == 'function') {
                var origGo = go;
                window.go = function () {
                    var r = origGo.apply(this, arguments);
                    try { pluginHandler.quickcommands.qcBulkPillUpdate(); } catch (e) { }
                    return r;
                };
            }
        } catch (e) { }
        // 1A: one more operation in the native Group Action dialog.
        try {
            if ((typeof groupActionFunction == 'function') && (typeof groupActionFunctionEx == 'function')) {
                var origGA = groupActionFunction;
                window.groupActionFunction = function () {
                    var r = origGA.apply(this, arguments);
                    try {
                        var sel = document.getElementById('d2groupop'), st2 = pluginHandler.quickcommands.qcState();
                        if (sel && (st2.config != null) && st2.config.commands.length) {
                            var o = document.createElement('option'); o.value = '990'; o.textContent = '⚡ Run quick command';
                            sel.appendChild(o);
                        }
                    } catch (e) { }
                    return r;
                };
                var origGAEx = groupActionFunctionEx;
                window.groupActionFunctionEx = function () {
                    try {
                        var sel = document.getElementById('d2groupop');
                        if (sel && (sel.value == '990')) {
                            var ids = getCheckedDevices();
                            return pluginHandler.quickcommands.qcAfterDialog(function () { pluginHandler.quickcommands.qcPickerOpen(ids); });
                        }
                    } catch (e) { }
                    return origGAEx.apply(this, arguments);
                };
            }
        } catch (e) { }
        // 2A/2B: context menu entry with a flyout listing the commands.
        try {
            var cm = document.getElementById('contextMenu');
            if (cm != null) {
                var hr = document.createElement('hr'); hr.id = 'qcCxSplit'; hr.style.display = 'none'; cm.appendChild(hr);
                var it = document.createElement('div');
                it.id = 'qcCxItem'; it.className = 'cmtext'; it.style.display = 'none';
                it.innerHTML = '<span class="qcZap">⚡</span> Quick Commands<span class="qcCxArr">▸</span>';
                it.onclick = function () { return pluginHandler.quickcommands.qcCxToggleFly(true); };
                it.onmouseenter = function () { pluginHandler.quickcommands.qcCxToggleFly(false); };
                cm.appendChild(it);
                // Hovering any other menu entry closes the flyout again.
                cm.addEventListener('mouseover', function (ev) {
                    var t = ev.target && ev.target.closest && ev.target.closest('.cmtext');
                    if (t && (t.id != 'qcCxItem')) { pluginHandler.quickcommands.qcCxFlyHide(); }
                });
                var fly = document.createElement('div'); fly.id = 'qcCxFly'; document.body.appendChild(fly);
                if (typeof handleContextMenu == 'function') {
                    var origHCM = handleContextMenu;
                    window.handleContextMenu = function (event) {
                        var r = origHCM.apply(this, arguments);
                        try { pluginHandler.quickcommands.qcCxUpdate(); } catch (e) { }
                        return r;
                    };
                }
                if (typeof hideContextMenu == 'function') {
                    var origHide = hideContextMenu;
                    window.hideContextMenu = function () {
                        try { pluginHandler.quickcommands.qcCxFlyHide(); } catch (e) { }
                        return origHide.apply(this, arguments);
                    };
                }
            }
        } catch (e) { }
    };

    // macOS agents, by agent id (the core has no isMacNode helper); the osdesc
    // check catches agents an older list does not know.
    obj.qcIsMacNode = function (node) {
        if ((node == null) || (node.agent == null)) return false;
        if ([14, 16, 29, 10005].indexOf(node.agent.id) >= 0) return true;
        return (typeof node.osdesc == 'string') && (/mac\s?os|os\s?x/i.test(node.osdesc));
    };

    // Does this command apply to that device's OS? (per-node variant of qcApplicable)
    obj.qcApplicableTo = function (cmd, node) {
        if ((node == null) || (node.mtype != 2) || (node.agent == null)) return false;
        if (!pluginHandler.quickcommands.qcInScope(cmd, node)) return false;
        var win = isWindowsNode(node);
        if (cmd.shell == 'cmd' || cmd.shell == 'ps') return win;
        if (cmd.shell == 'sh') return !win;
        return true; // agent console
    };

    obj.qcCmdsForNode = function (node) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if (st.config == null) return [];
        return st.config.commands.filter(function (c) { return Q.qcApplicableTo(c, node); });
    };

    // Close whatever dialog is open, then run fn once the modal finished hiding
    // (the Bootstrap UI needs that gap before a new dialog can be shown).
    obj.qcAfterDialog = function (fn) {
        pluginHandler.quickcommands.qcDialogClose();
        setTimeout(fn, 450);
        return false;
    };

    obj.qcDevicesBtnClick = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var ids = (typeof getCheckedDevices == 'function') ? getCheckedDevices() : [];
        if (ids.length == 0) return false;
        if (st.config == null) { Q.qcRequestConfig(); Q.qcDialog('Quick Commands', 1, null, 'The commands are still loading - try again in a moment.'); return false; }
        return Q.qcPickerOpen(ids);
    };

    // The command picker for a set of devices. Single entry point for the toolbar
    // button, the Group Action operation and the context menu's "All commands".
    obj.qcPickerOpen = function (nodeids) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        if (st.config == null) { Q.qcRequestConfig(); return false; }
        if (typeof xxdialogMode != 'undefined' && xxdialogMode) return false;
        var devs = [], win = 0, mac = 0, nix = 0, offline = 0, norights = 0, noagent = 0;
        nodeids.forEach(function (id) {
            var n = getNodeFromId(id);
            if ((n == null) || (n.mtype != 2) || (n.agent == null)) { noagent++; return; }
            if ((GetNodeRights(n) & 131072) == 0) { norights++; return; }        // no run-commands right
            if ((n.conn & 1) == 0) { offline++; return; }
            devs.push(n);
            if (isWindowsNode(n)) { win++; } else if (pluginHandler.quickcommands.qcIsMacNode(n)) { mac++; } else { nix++; }
        });
        var chips = '<div class="qcChips"><span class="qcChip"><b>' + devs.length + '</b> device' + (devs.length == 1 ? '' : 's') + '</span>'
            + (win ? ('<span class="qcChip"><b>' + win + '</b> Windows</span>') : '')
            + (mac ? ('<span class="qcChip"><b>' + mac + '</b> macOS</span>') : '')
            + (nix ? ('<span class="qcChip"><b>' + nix + '</b> Linux / BSD</span>') : '')
            + (offline ? ('<span class="qcChip">' + offline + ' offline - skipped</span>') : '')
            + (norights ? ('<span class="qcChip">' + norights + ' without run rights - skipped</span>') : '')
            + (noagent ? ('<span class="qcChip">' + noagent + ' without agent - skipped</span>') : '') + '</div>';
        var single = (devs.length == 1);
        var title = 'Quick Commands - ' + (single ? devs[0].name : (devs.length + ' devices'));
        if (devs.length == 0) {
            Q.qcDialog('Quick Commands', 1, null, chips + '<div class="qcEmpty">None of the selected devices can run commands right now - they must be connected agents you have the "run commands" right on.</div>');
            return false;
        }
        st.picker = { match: {}, count: devs.length };
        var cmds = st.config.commands.filter(function (c) { return single || (c.mode != 'terminal'); });
        var hiddenTerm = st.config.commands.length - cmds.length;
        var x = chips;
        Q.qcGroupsFor(cmds).forEach(function (g) {
            var gcol = (st.config.groupColors && st.config.groupColors[g.name]) || '';
            x += '<div class="qcPickH">' + (gcol ? ('<span class="qcDot qcc-' + gcol + '"></span>') : '') + Q.qcEsc(g.name || 'Commands') + '</div><div class="qcPickWrap">';
            g.commands.forEach(function (c) {
                var m = [];
                devs.forEach(function (n) { if (Q.qcApplicableTo(c, n)) m.push(n._id); });
                st.picker.match[c.id] = m;
                var col = Q.qcColorOf(c);
                var cls = 'qcKey' + (c.confirm ? ' danger' : '') + (c.mode == 'terminal' ? ' termMode' : '') + (col ? ' qcc-' + col : '');
                var ann = (c.mode == 'terminal') ? 'opens the terminal' : (single ? '' : (m.length ? ('runs on ' + m.length + ' of ' + devs.length) : 'no matching device'));
                x += '<button type="button" class="' + cls + '"' + (m.length ? '' : ' disabled') + ' title="' + Q.qcEsc((c.description ? c.description + '\n' : '') + c.command) + '" onclick="return pluginHandler.quickcommands.qcPickerRun(\'' + Q.qcEsc(c.id) + '\')">'
                    + '<span class="qcN">' + Q.qcTagsHtml(c) + Q.qcEsc(c.name) + '</span>'
                    + '<span class="qcC">' + Q.qcEsc(c.command.split(/\r?\n/)[0]) + '</span>'
                    + (ann ? ('<span class="qcA' + (m.length ? '' : ' none') + '">' + ann + '</span>') : '')
                    + '</button>';
            });
            x += '</div>';
        });
        if (hiddenTerm > 0) { x += '<div class="qcMini" style="margin-top:10px;text-align:left">' + hiddenTerm + ' terminal command' + (hiddenTerm == 1 ? ' is' : 's are') + ' not shown - they type into an open terminal and only work on a single device.</div>'; }
        if (!single) { x += '<div class="qcMini" style="margin-top:6px;text-align:left">Commands run only on devices with a matching operating system.</div>'; }
        Q.qcDialog(title, 1, null, x, true);
        return false;
    };

    obj.qcPickerRun = function (id) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var p = st.picker; if ((p == null) || (st.config == null)) return false;
        var cmd = null; st.config.commands.forEach(function (c) { if (c.id == id) cmd = c; });
        if (cmd == null) return false;
        var ids = p.match[cmd.id] || []; if (ids.length == 0) return false;
        var skipped = p.count - ids.length;
        var note = skipped ? (skipped + ' selected device' + (skipped == 1 ? ' was' : 's were') + ' skipped - the command does not apply to their operating system.') : '';
        return Q.qcAfterDialog(function () {
            var Q2 = pluginHandler.quickcommands;
            if (cmd.mode == 'terminal') { Q2.qcTermRunOnNode(cmd, ids[0]); return; }
            if (cmd.confirm) {
                var names = [];
                ids.forEach(function (nid) { var n = getNodeFromId(nid); if (n) names.push(n.name); });
                var shown = names.slice(0, 8).join(', ') + ((names.length > 8) ? (' +' + (names.length - 8) + ' more') : '');
                var html = '<div class="qcOutH">' + Q2.qcTagsHtml(cmd) + '<b>' + Q2.qcEsc(cmd.name) + '</b><span>on ' + ids.length + ' device' + (ids.length == 1 ? '' : 's') + '</span></div>'
                    + '<pre class="qcOut" style="max-height:120px">' + Q2.qcEsc(cmd.command) + '</pre>'
                    + '<div class="qcMini" style="margin-top:6px;text-align:left">' + Q2.qcEsc(shown) + '</div>'
                    + (cmd.description ? '<div class="qcMini" style="margin-top:6px;text-align:left">' + Q2.qcEsc(cmd.description) + '</div>' : '');
                Q2.qcDialog('Run this command?', 3, function () { pluginHandler.quickcommands.qcBulkRun(cmd, ids, note); }, html);
            } else { Q2.qcBulkRun(cmd, ids, note); }
        });
    };

    // Run one command on several devices: one runcommands message per device so
    // every run has its own responseid and flows through the normal pipeline.
    obj.qcBulkRun = function (cmd, nodeids, note) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var types = { cmd: 1, ps: 2, sh: 3, agent: 4 };
        st.bulk = { cmd: cmd, runs: [], byRid: {}, note: note || '' };
        nodeids.forEach(function (id) {
            var n = getNodeFromId(id); if (n == null) return;
            var rid = 'qcb-' + Math.random().toString(36).substring(2, 12);
            var e = { cmd: cmd, state: 'running', time: new Date().toLocaleTimeString(), start: Date.now(), output: '', rid: rid, nodeid: id, name: n.name, bulk: true, collect: true };
            st.pending[rid] = e; st.bulk.runs.push(rid); st.bulk.byRid[rid] = e;
            st.log.unshift(e); if (st.log.length > 50) st.log.pop(); // group runs land in the device's run log too
            if (cmd.shell == 'agent') { e.timer = setTimeout(function () { pluginHandler.quickcommands.qcFinish(rid, null); }, 4000); }
            else { e.timer = setTimeout(function () { var Q2 = pluginHandler.quickcommands, e2 = Q2.qcState().pending[rid]; if (e2) e2.canKill = true; Q2.qcFinish(rid, 'No reply from the agent after 5 minutes. The command is probably still running or waiting for input on the device and blocks further run commands. "Free the agent" kills it on the device.'); }, 300000); }
            meshserver.send({ action: 'runcommands', nodeids: [id], type: types[cmd.shell] || 1, cmds: Q.qcCmds(cmd), runAsUser: (cmd.runAs | 0), reply: true, responseid: rid });
        });
        Q.qcLogSave();
        Q.qcBulkPillUpdate();
        // A confirm dialog may just be hiding; give the Bootstrap modal its gap.
        setTimeout(function () { pluginHandler.quickcommands.qcBulkResults(); }, 500);
        return false;
    };

    obj.qcBulkCounts = function () {
        var st = pluginHandler.quickcommands.qcState(), b = st.bulk;
        if (b == null) return null;
        var run = 0, ok = 0, err = 0;
        b.runs.forEach(function (rid) { var e = b.byRid[rid]; if (e.state == 'running') run++; else if (e.state == 'done') ok++; else err++; });
        return { run: run, ok: ok, err: err };
    };

    // Shared content of the results controls (toolbar button on My Devices, the
    // floating pill everywhere else): spinner or ⚡, the command, live counts, ×.
    obj.qcBulkCtrlHtml = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState(), b = st.bulk;
        var c = Q.qcBulkCounts(); if (c == null) return '';
        var name = (b.cmd.name.length > 14) ? (b.cmd.name.substring(0, 14) + '…') : b.cmd.name;
        var x = c.run ? '<span class="qcSpin"></span>' : '<span class="qcZap">⚡</span>';
        x += '<span class="qcRN">' + Q.qcEsc(name) + '</span><span class="qcRC">';
        if (c.ok || !c.run) { x += '<span class="qcRCg">' + c.ok + '✓</span>'; }
        if (c.run) { x += (c.ok ? '&nbsp;' : '') + c.run + '…'; }
        if (c.err) { x += '&nbsp;<span class="qcRCr">' + c.err + '✗</span>'; }
        x += '</span><span class="qcRX" title="Dismiss">×</span>';
        return x;
    };

    // One click handler for both controls: × dismisses, the rest re-opens the overview.
    obj.qcBulkCtrlClick = function (ev) {
        var Q = pluginHandler.quickcommands;
        if (ev && ev.target && ev.target.closest && ev.target.closest('.qcRX')) { Q.qcState().bulk = null; Q.qcBulkPillUpdate(); return false; }
        if (typeof xxdialogMode != 'undefined' && xxdialogMode) return false;
        return Q.qcBulkResults();
    };

    // Keep the results controls in sync: on My Devices the toolbar button shows
    // the run, on every other page the floating pill does.
    obj.qcBulkPillUpdate = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var has = (st.bulk != null);
        var onDevices = (typeof xxcurrentView != 'undefined') && (xxcurrentView == 1);
        var tb = document.getElementById('qcResultsBtn');
        if (tb) {
            if (has) { tb.innerHTML = Q.qcBulkCtrlHtml(); tb.style.display = 'inline-flex'; }
            else { tb.style.display = 'none'; }
        }
        var p = document.getElementById('qcBulkPill');
        if (!has || (onDevices && (tb != null))) { if (p) { p.style.display = 'none'; } return; }
        if (p == null) {
            p = document.createElement('div');
            p.id = 'qcBulkPill';
            p.onclick = function (ev) { return pluginHandler.quickcommands.qcBulkCtrlClick(ev); };
            document.body.appendChild(p);
        }
        p.innerHTML = Q.qcBulkCtrlHtml();
        p.style.display = 'inline-flex';
    };

    obj.qcBulkSummary = function () {
        var st = pluginHandler.quickcommands.qcState(), b = st.bulk;
        if (b == null) return '';
        var run = 0, ok = 0, err = 0;
        b.runs.forEach(function (rid) { var e = b.byRid[rid]; if (e.state == 'running') run++; else if (e.state == 'done') ok++; else err++; });
        if (run) return '<span class="qcMuted">' + run + ' running…</span>';
        return '<span class="qcOk">' + ok + ' done</span>' + (err ? ('&nbsp;<span class="qcErr">' + err + ' failed</span>') : '');
    };

    obj.qcBulkResults = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState(), b = st.bulk;
        if (b == null) return false;
        var rows = '';
        b.runs.forEach(function (rid) { rows += '<div class="qcBR" id="qcBR-' + Q.qcEsc(rid) + '">' + Q.qcBulkRowHtml(b.byRid[rid]) + '</div>'; });
        var x = '<div class="qcOutH">' + Q.qcTagsHtml(b.cmd) + '<b>' + Q.qcEsc(b.cmd.name) + '</b><span class="qcGrow"></span><span id="qcBulkSum">' + Q.qcBulkSummary() + '</span></div>'
            + '<div class="qcOutH"><span class="qcC">' + Q.qcEsc(b.cmd.command.split(/\r?\n/)[0]) + '</span></div>'
            + '<div class="qcBulkList">' + rows + '</div>'
            + (b.note ? ('<div class="qcMini" style="margin-top:6px;text-align:left">' + Q.qcEsc(b.note) + '</div>') : '');
        Q.qcDialog('Quick command - ' + b.runs.length + ' device' + (b.runs.length == 1 ? '' : 's'), 1, null, x, true);
        return false;
    };

    obj.qcBulkBack = function () {
        return pluginHandler.quickcommands.qcAfterDialog(function () { pluginHandler.quickcommands.qcBulkResults(); });
    };

    obj.qcBulkRowHtml = function (e) {
        var Q = pluginHandler.quickcommands;
        var stat = (e.state == 'running') ? '<span class="qcBS"><span class="qcSpin"></span></span>' : ((e.state == 'done') ? '<span class="qcBS qcOk">✓</span>' : '<span class="qcBS qcErr">✗</span>');
        var meta = (e.state == 'running') ? (e.cancelling ? 'cancelling…' : 'running…') : ((e.state == 'done') ? Q.qcFmtMs(e.ms) : ('<span class="qcErr" title="' + Q.qcEsc(e.error || '') + '">failed</span>'));
        var links = '<span class="qcGrow"></span><span class="qcLink" onclick="return pluginHandler.quickcommands.qcBulkShow(\'' + Q.qcEsc(e.rid) + '\')">View output</span>';
        if (e.state == 'running') { links += '&nbsp;&nbsp;<span class="qcLink" onclick="return pluginHandler.quickcommands.qcCancelRun(\'' + Q.qcEsc(e.rid) + '\')">Cancel</span>'; }
        return stat + '<span class="qcBN" title="' + Q.qcEsc(e.name) + '">' + Q.qcEsc(e.name) + '</span><span class="qcMuted">' + meta + '</span>' + links;
    };

    // Refresh one row of the results dialog when a run finishes or gets cancelled.
    obj.qcBulkRowUpdate = function (e) {
        var Q = pluginHandler.quickcommands;
        var row = document.getElementById('qcBR-' + e.rid);
        if (row) { row.innerHTML = Q.qcBulkRowHtml(e); }
        var sum = document.getElementById('qcBulkSum');
        if (sum) { sum.innerHTML = Q.qcBulkSummary(); }
        Q.qcBulkPillUpdate();
    };

    // Output window for one device of a bulk run (live via qcOutPre, like the single run).
    obj.qcBulkShow = function (rid) {
        var Q = pluginHandler.quickcommands, st = Q.qcState(), b = st.bulk;
        if (b == null) return false;
        var e = b.byRid[rid]; if (e == null) return false;
        return Q.qcAfterDialog(function () {
            var Q2 = pluginHandler.quickcommands;
            var status = (e.state == 'error') ? ('<span class="qcErr">' + Q2.qcEsc(e.error) + '</span>') : ((e.state == 'running') ? '<span class="qcMuted">running…</span>' : ('<span class="qcOk">' + Q2.qcFmtMs(e.ms) + '</span>'));
            var body = (e.output && e.output.length) ? Q2.qcEsc(e.output) : ('<span class="qcMuted">(no output' + (e.state == 'running' ? ' yet' : (e.cmd.shell == 'agent' ? ' captured; see the Console tab' : '')) + ')</span>');
            var inputRow = ((e.state == 'running') && (e.cmd.shell != 'agent'))
                ? '<div id="qcInRow" style="margin-top:8px;display:flex;gap:6px"><input type="text" id="qcInText" style="flex:1" placeholder="Answer the command\'s question (e.g. j or n) - also works before it appears" onkeydown="if(event.keyCode==13){event.preventDefault();pluginHandler.quickcommands.qcSendInput(\'' + Q2.qcEsc(e.rid) + '\');return false;}" /><input type="button" value="Send" onclick="return pluginHandler.quickcommands.qcSendInput(\'' + Q2.qcEsc(e.rid) + '\')" /></div>'
                : '';
            var html = '<div class="qcOutH">' + Q2.qcTagsHtml(e.cmd) + '<b>' + Q2.qcEsc(e.cmd.name) + '</b><span>on ' + Q2.qcEsc(e.name) + '</span><span class="qcGrow"></span><span id="qcOutStatus">' + status + '</span></div>'
                + '<div class="qcOutH"><span class="qcC">' + Q2.qcEsc(e.cmd.command.split(/\r?\n/)[0]) + '</span></div>'
                + '<pre class="qcOut" id="qcOutPre" data-rid="' + Q2.qcEsc(e.rid) + '">' + body + '</pre>'
                + inputRow
                + '<div style="margin-top:8px;text-align:right" id="qcOutBtns">' + Q2.qcButtonsHtml(e, -1) + '</div>';
            // OK leads back to the results overview instead of just closing.
            Q2.qcDialog('Quick command', 1, function () { pluginHandler.quickcommands.qcBulkBack(); }, html, true);
        });
    };

    obj.qcBulkCopy = function (rid) {
        var st = pluginHandler.quickcommands.qcState(), b = st.bulk;
        var e = (b && b.byRid[rid]) || null;
        if (e == null) { for (var i = 0; i < st.log.length; i++) { if (st.log[i].rid == rid) { e = st.log[i]; break; } } }
        if (e == null) return false;
        try { navigator.clipboard.writeText(e.output || ''); } catch (ex) { }
        return false;
    };

    // Called after the core showed a context menu: decide whether the Quick
    // Commands entry applies to the device that was right-clicked.
    obj.qcCxUpdate = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var it = document.getElementById('qcCxItem'), hr = document.getElementById('qcCxSplit');
        if (it == null) return;
        var show = false; st.cxNodeid = null;
        try {
            var cm = document.getElementById('contextMenu');
            if ((cm.style.display != 'none') && (typeof contextelement != 'undefined') && (contextelement != null)) {
                // Same node resolution as the core's cmaction().
                var v;
                if (document.getElementById('viewselect').value == 1) { v = contextelement.children[0].children[0].children[1].children[0].attributes.onmouseup.value; }
                else { v = contextelement.children[1].attributes.onmouseup.value; }
                var nodeid = v.substring(12, v.length - 18);
                var node = getNodeFromId(nodeid);
                if (st.config == null) { Q.qcRequestConfig(); }
                else if ((node != null) && (node.mtype == 2) && ((node.conn & 1) != 0) && ((GetNodeRights(node) & 131072) != 0) && (Q.qcCmdsForNode(node).length > 0)) {
                    st.cxNodeid = nodeid; show = true;
                }
            }
        } catch (e) { }
        it.style.display = show ? '' : 'none';
        if (hr) { hr.style.display = show ? '' : 'none'; }
        try { document.getElementById('contextMenu').classList.toggle('qcWide', show); } catch (e) { }
        Q.qcCxFlyHide();
    };

    obj.qcCxToggleFly = function (isClick) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var fly = document.getElementById('qcCxFly'), it = document.getElementById('qcCxItem');
        if ((fly == null) || (it == null) || (st.cxNodeid == null)) return false;
        var node = getNodeFromId(st.cxNodeid); if (node == null) return false;
        var cmds = Q.qcCmdsForNode(node);
        // With a very long list the flat dialog is the better tool.
        if (cmds.length > 20) { return isClick ? Q.qcCxAll() : false; }
        if (isClick && (fly.style.display == 'block')) { Q.qcCxFlyHide(); return false; }
        var x = '';
        Q.qcGroupsFor(cmds).forEach(function (g) {
            var gcol = (st.config.groupColors && st.config.groupColors[g.name]) || '';
            x += '<div class="qcMenuH">' + (gcol ? ('<span class="qcDot qcc-' + gcol + '"></span>') : '') + Q.qcEsc(g.name || 'Commands') + '</div>';
            g.commands.forEach(function (c) {
                var col = Q.qcColorOf(c);
                x += '<button type="button" class="qcMenuI' + (c.confirm ? ' danger' : '') + (c.mode == 'terminal' ? ' termMode' : '') + (col ? ' qcc-' + col : '') + '" title="' + Q.qcEsc((c.description ? c.description + '\n' : '') + c.command + (c.mode == 'terminal' ? '\n(typed into the terminal)' : '')) + '" onclick="return pluginHandler.quickcommands.qcCxRun(\'' + Q.qcEsc(c.id) + '\')">'
                    + '<span class="qcN">' + Q.qcTagsHtml(c) + Q.qcEsc(c.name) + '</span>'
                    + '<span class="qcC">' + Q.qcEsc(c.command.split(/\r?\n/)[0]) + '</span></button>';
            });
        });
        x += '<div class="qcMenuF"><span class="qcLink" onclick="return pluginHandler.quickcommands.qcCxAll()">All commands…</span></div>';
        fly.innerHTML = x;
        fly.style.display = 'block';
        var r = it.getBoundingClientRect();
        var top = Math.max(6, Math.min(r.top - 4, window.innerHeight - fly.offsetHeight - 10));
        fly.style.top = top + 'px';
        var fw = fly.offsetWidth;
        fly.style.left = (((r.right + fw + 8) < window.innerWidth) ? (r.right + 2) : Math.max(6, r.left - fw - 2)) + 'px';
        return false;
    };

    obj.qcCxFlyHide = function () {
        var fly = document.getElementById('qcCxFly');
        if (fly) { fly.style.display = 'none'; }
        return false;
    };

    obj.qcCxAll = function () {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var nodeid = st.cxNodeid; if (nodeid == null) return false;
        Q.qcCxFlyHide();
        if (typeof hideContextMenu == 'function') { try { hideContextMenu(); } catch (e) { } }
        return Q.qcPickerOpen([nodeid]);
    };

    obj.qcCxRun = function (id) {
        var Q = pluginHandler.quickcommands, st = Q.qcState();
        var nodeid = st.cxNodeid; if ((nodeid == null) || (st.config == null)) return false;
        var cmd = null; st.config.commands.forEach(function (c) { if (c.id == id) cmd = c; });
        if (cmd == null) return false;
        Q.qcCxFlyHide();
        if (typeof hideContextMenu == 'function') { try { hideContextMenu(); } catch (e) { } }
        if (cmd.mode == 'terminal') { return Q.qcTermRunOnNode(cmd, nodeid); }
        if (cmd.confirm) {
            var node = getNodeFromId(nodeid);
            var html = '<div class="qcOutH">' + Q.qcTagsHtml(cmd) + '<b>' + Q.qcEsc(cmd.name) + '</b><span>on ' + Q.qcEsc(node ? node.name : '') + '</span></div>'
                + '<pre class="qcOut" style="max-height:120px">' + Q.qcEsc(cmd.command) + '</pre>'
                + (cmd.description ? '<div class="qcMini" style="margin-top:6px;text-align:left">' + Q.qcEsc(cmd.description) + '</div>' : '');
            Q.qcDialog('Run this command?', 3, function () { pluginHandler.quickcommands.qcBulkRun(cmd, [nodeid]); }, html);
            return false;
        }
        return Q.qcBulkRun(cmd, [nodeid]);
    };

    // A terminal-mode command from My Devices: open the device's Terminal tab
    // first, then type it there through the normal single-device path.
    obj.qcTermRunOnNode = function (cmd, nodeid) {
        var Q = pluginHandler.quickcommands;
        var go = function () {
            gotoDevice(nodeid, 12);
            var tries = 0;
            var wait = setInterval(function () {
                tries++;
                if ((typeof currentNode != 'undefined') && (currentNode != null) && (currentNode._id == nodeid)) {
                    clearInterval(wait);
                    setTimeout(function () { pluginHandler.quickcommands.qcRunNow(cmd); }, 300);
                } else if (tries > 20) { clearInterval(wait); }
            }, 250);
        };
        if (cmd.confirm) {
            var node = getNodeFromId(nodeid);
            var html = '<div class="qcOutH">' + Q.qcTagsHtml(cmd) + '<b>' + Q.qcEsc(cmd.name) + '</b><span>on ' + Q.qcEsc(node ? node.name : '') + '</span></div>'
                + '<pre class="qcOut" style="max-height:120px">' + Q.qcEsc(cmd.command) + '</pre>';
            Q.qcDialog('Run this command?', 3, go, html);
            return false;
        }
        go();
        return false;
    };

    // ------------------------------------------------------------------
    //  Server side
    // ------------------------------------------------------------------
    var SHELLS = ['cmd', 'ps', 'sh', 'agent'], MODES = ['run', 'terminal'];
    var COLORS = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple', 'pink', 'slate'];

    obj.defaultConfig = function () {
        return {
            version: 1,
            settings: { terminalView: 'strip', desktopView: 'menu' },
            groups: ['Network', 'Policy', 'Power', 'Linux'],
            groupColors: { 'Network': 'blue', 'Power': 'red' },
            commands: [
                { id: 'ipconfig', name: 'IP config', group: 'Network', shell: 'cmd', command: 'ipconfig /all', mode: 'run', runAs: 0, showTerminal: true, showGeneral: true, showDesktop: true, confirm: false, description: 'Full adapter, DNS and DHCP details.' },
                { id: 'flushdns', name: 'Flush DNS', group: 'Network', shell: 'cmd', command: 'ipconfig /flushdns', mode: 'run', runAs: 0, showTerminal: true, showGeneral: false, confirm: false, description: '' },
                { id: 'netinfo', name: 'Network info', group: 'Network', shell: 'agent', command: 'netinfo', mode: 'run', runAs: 0, showTerminal: false, showGeneral: true, confirm: false, description: 'Interfaces as the agent sees them.' },
                { id: 'gpupdate', name: 'Group policy', group: 'Policy', shell: 'cmd', command: 'gpupdate /force', mode: 'terminal', runAs: 0, showTerminal: true, showGeneral: true, showDesktop: true, confirm: false, description: 'Interactive: runs in the terminal, so the output appears live and a possible restart question (J/N) can be answered.' },
                { id: 'gpupdatebg', name: 'Group policy (silent)', group: 'Policy', shell: 'cmd', command: 'chcp 65001 >nul & echo n | gpupdate /force', mode: 'run', runAs: 0, showTerminal: true, showGeneral: false, confirm: false, description: 'Hands-off: gpupdate buffers on a pipe, so the output appears when it finishes. The piped "n" answers a possible restart question with No; chcp 65001 keeps umlauts readable.' },
                { id: 'restart', name: 'Restart now', group: 'Power', shell: 'cmd', command: 'shutdown /r /f /t 0', mode: 'run', runAs: 0, showTerminal: true, showGeneral: true, showDesktop: true, confirm: true, description: 'Forces all programs to close and restarts immediately.' },
                { id: 'linuxreboot', name: 'Reboot', group: 'Linux', shell: 'sh', command: 'systemctl reboot', mode: 'run', runAs: 0, showTerminal: true, showGeneral: false, confirm: true, description: '' },
                { id: 'linuxdf', name: 'Disk usage', group: 'Linux', shell: 'sh', command: 'df -h', mode: 'run', runAs: 0, showTerminal: true, showGeneral: true, showDesktop: true, confirm: false, description: '' }
            ]
        };
    };

    // Validates and normalises a configuration object coming from the admin page or an import.
    obj.sanitize = function (input) {
        var clean = { version: 1, settings: { terminalView: 'strip', desktopView: 'menu' }, groups: [], groupColors: {}, commands: [] };
        if ((input == null) || (typeof input != 'object')) return clean;
        if ((input.settings != null) && (input.settings.terminalView == 'menu')) clean.settings.terminalView = 'menu';
        if ((input.settings != null) && (input.settings.desktopView == 'strip')) clean.settings.desktopView = 'strip';
        var str = function (v, max) { if (typeof v != 'string') return ''; v = v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ''); return v.length > max ? v.substring(0, max) : v; };
        // A scope rule: {mode:'only'|'except', targets:[{t:'mesh'|'node'|'tag', id?, name?}]}.
        // 'all' (or anything malformed) means no rule and is stored as nothing at all.
        var sanScope = function (s) {
            if ((s == null) || (typeof s != 'object')) return null;
            if ((s.mode != 'only') && (s.mode != 'except')) return null;
            var targets = [];
            if (Array.isArray(s.targets)) {
                s.targets.forEach(function (t) {
                    if ((t == null) || (typeof t != 'object') || (targets.length >= 100)) return;
                    var name = str(t.name, 200).trim();
                    if (t.t == 'tag') { if (name.length) targets.push({ t: 'tag', name: name }); return; }
                    if ((t.t != 'mesh') && (t.t != 'node')) return;
                    var id = str(t.id, 200);
                    if (id.length) targets.push({ t: t.t, id: id, name: name });
                });
            }
            return { mode: s.mode, targets: targets };
        };
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
                var out = {
                    id: id, name: name, group: group,
                    shell: (SHELLS.indexOf(c.shell) >= 0) ? c.shell : 'cmd',
                    command: cmd,
                    mode: (MODES.indexOf(c.mode) >= 0) ? c.mode : 'run',
                    runAs: ([0, 1, 2].indexOf(c.runAs | 0) >= 0) ? (c.runAs | 0) : 0,
                    showTerminal: (c.showTerminal !== false),
                    showGeneral: (c.showGeneral === true),
                    showDesktop: (c.showDesktop === true),
                    confirm: (c.confirm === true),
                    color: (COLORS.indexOf(c.color) >= 0) ? c.color : '',
                    description: str(c.description, 300).trim()
                };
                var sc = sanScope(c.scope); if (sc != null) out.scope = sc;
                clean.commands.push(out);
            });
        }
        if ((input.groupColors != null) && (typeof input.groupColors == 'object')) {
            clean.groups.forEach(function (g) { if (COLORS.indexOf(input.groupColors[g]) >= 0) clean.groupColors[g] = input.groupColors[g]; });
        }
        if ((input.groupScopes != null) && (typeof input.groupScopes == 'object')) {
            var gs = {};
            clean.groups.forEach(function (g) { var sc = sanScope(input.groupScopes[g]); if (sc != null) gs[g] = sc; });
            if (Object.keys(gs).length) clean.groupScopes = gs;
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
            // Device groups, tags and devices for the "Appears on" picker and its
            // live preview. The editor is a standalone tab without a websocket,
            // so this is rendered in. Site admins only, checked above.
            obj.db.GetAllType('node', function (err, docs) {
                var meshes = [], meshName = {}, nodes = [];
                try {
                    var all = obj.meshServer.webserver.meshes;
                    for (var mid in all) {
                        if (all[mid] && (all[mid].mtype == 2) && (all[mid].deleted == null)) { meshName[mid] = all[mid].name || mid; }
                    }
                } catch (e) { }
                var meshCount = {};
                if ((err == null) && Array.isArray(docs)) {
                    docs.forEach(function (n) {
                        if ((n == null) || (typeof n._id != 'string') || (meshName[n.meshid] == null)) return;
                        if (nodes.length >= 5000) return;
                        meshCount[n.meshid] = (meshCount[n.meshid] || 0) + 1;
                        var e = { id: n._id, name: n.name || n._id, meshid: n.meshid };
                        if (Array.isArray(n.tags) && n.tags.length) e.tags = n.tags;
                        nodes.push(e);
                    });
                }
                for (var mid2 in meshName) { meshes.push({ id: mid2, name: meshName[mid2], count: meshCount[mid2] || 0 }); }
                meshes.sort(function (a, b) { return a.name.localeCompare(b.name); });
                nodes.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
                res.render('admin', {
                    configJson: JSON.stringify(cfg).replace(/</g, '\\u003c'),
                    defaultsJson: JSON.stringify(obj.defaultConfig()).replace(/</g, '\\u003c'),
                    targetsJson: JSON.stringify({ meshes: meshes, nodes: nodes }).replace(/</g, '\\u003c')
                });
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
