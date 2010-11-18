/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Panorama Add-on SDK library.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Michael Yoshitaka Erlewine <mitcho@mitcho.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
 
"use strict";

const {Cc,Ci} = require("chrome");
//const observers = require("observer-service");
const { EventEmitter } = require("events");
const { setTimeout } = require("timer");
const unload = require("unload");
const winUtils = require("window-utils");
const { Trait } = require('traits');
const { WindowDom } = require("windows/dom");
const tabBrowser = require("tab-browser");

const ON_INIT = "init";
const ON_SHOW = "show";
const ON_HIDE = "hide";
const ON_INIT_OBSERVER = "tabviewframeinitialized";
const ON_SHOW_OBSERVER = "tabviewshown";
const ON_HIDE_OBSERVER = "tabviewhidden";

const TabItem = Trait.compose(
  EventEmitter,
  Trait.compose({
    constructor: function TabItem(tabItem) {
      this._tabItem = tabItem;
      this._panoramaWindow = tabItem.container.ownerDocument.defaultView;
      this._tab = this._tabItem.tab;
      this._window = this._tab.linkedBrowser.contentWindow;
    },
    get dom() this._panoramaWindow.iQ(this._tabItem.container),
    get parent() this._tabItem.parent,
    _tabItem: null,
    _window: null,
    _panoramaWindow: null
  }),
  WindowDom
);
const TabItems = Trait.compose(
  EventEmitter,
  Trait.compose({
    _emit: Trait.required,
    constructor: function TabItems(window, chromeWindow) {
      this._tabItems = window.TabItems;
      this._window = window;
      this._chromeWindow = chromeWindow;
      // TODO: fire "add" event
      let tabModule = new tabBrowser.TabModule(this._chromeWindow);
      
      let self = this;
      let gBrowser = this._chromeWindow.gBrowser;
      
      function getTabItem(wrappedTab) {
        let tab = gBrowser._getTabForContentWindow(wrappedTab.contentWindow);
        if ("tabItem" in tab)
          return TabItem(tab.tabItem);
        return false;
      }
      
      tabModule.onReady.add(function(tab) {self._onFire("ready", getTabItem(tab))});
      tabModule.onLoad.add(function(tab) {self._onFire("load", getTabItem(tab))});
      tabModule.onOpen.add(function(tab) {self._onFire("open", getTabItem(tab))});
      tabModule.onPaint.add(function(tab) {self._onFire("paint", getTabItem(tab))});

      gBrowser.tabContainer.addEventListener("TabAttrModified", function(event) {self._onFire("modified", TabItem(event.target.tabItem))}, false);

      require("unload").ensure(tabModule);
    },
    _onFire: function(type, safeTabItem) {
      this._emit(type, safeTabItem, PanoramaInstance(this._window, this._chromeWindow));
    },
    unload: function _destructor() {
      // just unload the TabAttrModified, which TabModule doesn't yet support and
      // which doesn't remove itself gracefully
      let gBrowser = this._chromeWindow.gBrowser;
      gBrowser.tabContainer.removeEventListener("TabAttrModified", this._onModified, false);
    },
    _tabItems: null,
    get: function(index) {
      let tabItems = this._tabItems.getItems();
      return TabItem(tabItems[index]);
    },
    get length() {
      let tabItems = this._tabItems.getItems();
      return tabItems.length;
    }
  })
);

const PanoramaInstance = Trait.compose(
  EventEmitter,
  Trait.compose({
    _emit: Trait.required,
    /**
     * Constructor returns wrapper of the specified chrome window.
     * @param {nsIWindow} window of the Panorama iframe
     */
    constructor: function PanoramaInstance(window, chromeWindow) {
      // make sure we don't have unhandled errors
      this.on('error', console.exception.bind(console));
      this._window = window;
      this._chromeWindow = chromeWindow;
    },
//    get GroupItems() GroupItems(this._window.GroupItems),
    get TabItems() TabItems(this._window, this._chromeWindow),
    get iQ() this._window.iQ,
    _window: null
  })
);

const panorama = EventEmitter.compose({
  constructor: function Panorama() {
    // Binding method to instance since it will be used with `setTimeout`.
    this._emit = this._emit.bind(this);
    this.unload = this.unload.bind(this);
    // Report unhandled errors from listeners
    this.on("error", console.exception.bind(console));
    unload.ensure(this);

    let emitter = this;
    this._panoramaLoader = new winUtils.WindowTracker({
      onTrack: function(window) {
        window.document.addEventListener(ON_INIT_OBSERVER, function() {
          emitter.onFire(ON_INIT, window);
        }, false);
        window.document.addEventListener(ON_SHOW_OBSERVER, function() {
          emitter.onFire(ON_SHOW, window);
        }, false);
        window.document.addEventListener(ON_HIDE_OBSERVER, function() {
          emitter.onFire(ON_HIDE, window);
        }, false);
      },
      onUntrack: function(window) {
        window.document.removeEventListener(ON_INIT_OBSERVER, function() {
          emitter.onFire(ON_INIT, window);
        }, false);
        window.document.removeEventListener(ON_SHOW_OBSERVER, function() {
          emitter.onFire(ON_SHOW, window);
        }, false);
        window.document.removeEventListener(ON_HIDE_OBSERVER, function() {
          emitter.onFire(ON_HIDE, window);
        }, false);
      }
    });
  },
  unload: function _destructor() {
    this._panoramaLoader.unload();
  },
  onFire: function onFire(type, window) {
    let tabviewframe = window.document.getElementById("tab-view");
    if (!tabviewframe) {
      console.error("Can't find Panorama!");
      return;
    }
    let panoramaInstance = PanoramaInstance(tabviewframe.contentWindow, window);
    setTimeout(this._emit, 0, type, panoramaInstance);
  },
  _panoramaLoader: {}
})()

exports.on = panorama.on;
exports.removeListener = panorama.removeListener;
