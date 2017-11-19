let defaultPreference = {
  defaultPosition: 0,
  openThisLink: true,
  moveThisPage: true,
  iconColor: 0, //0:black, 1:white
  version: 1
};
let preferences = {};
let menu_openThisLink = null;
let menu_moveThisPage = null;

const storageChangeHandler = (changes, area) => {
  if(area === 'local') {
    let changedItems = Object.keys(changes);
    for (let item of changedItems) {
      preferences[item] = changes[item].newValue;
      switch (item) {
        case 'iconColor':
          setBrowserActionIcon();
          break;
        case 'openThisLink':
        case 'moveThisPage':
          resetContextMenu();
          break;
      }
    }
  }
};

const loadPreference = () => {
  browser.storage.local.get().then(results => {
    if ((typeof results.length === 'number') && (results.length > 0)) {
      results = results[0];
    }
    if (!results.version) {
      preferences = defaultPreference;
      browser.storage.local.set(defaultPreference).then(res => {
        browser.storage.onChanged.addListener(storageChangeHandler);
      }, err => {
      });
    } else {
      preferences = results;
      browser.storage.onChanged.addListener(storageChangeHandler);
    }
    resetContextMenu();
    setBrowserActionIcon();
  });
};

const createContextMenu = () => {
  if (menu_openThisLink === null && preferences.openThisLink) {
    menu_openThisLink = browser.contextMenus.create({
      type: 'normal',
      title: browser.i18n.getMessage('openThisLink'),
      contexts: ['link'],
      onclick: (data, tab) => {
        popupWindow(tab, data.linkUrl);
      }
    });
  }
  else if (menu_openThisLink !== null && !preferences.openThisLink) {
    browser.contextMenus.remove(menu_openThisLink);
    menu_openThisLink = null;
  }

  if (menu_moveThisPage === null && preferences.moveThisPage) {
    menu_moveThisPage = browser.contextMenus.create({
      type: 'normal',
      title: browser.i18n.getMessage('moveThisPage'),
      contexts: ['page', 'frame'],
      onclick: (data, tab) => {
        popupWindow(tab);
      }
    });
  }
  else if (menu_moveThisPage !== null && !preferences.moveThisPage) {
    browser.contextMenus.remove(menu_moveThisPage);
    menu_moveThisPage = null;
  }

};

const resetContextMenu = () => {
  let createNew = false;
  if (preferences.openThisLink || preferences.moveThisPage) {
    createContextMenu();
  } else {
    browser.contextMenus.removeAll(() => {
      menu_openThisLink = null;
      menu_moveThisPage = null;
    });
  }
};

const setBrowserActionIcon = () => {
  if(preferences.iconColor === 1) {
    browser.browserAction.setIcon({path: 'icon/icon_w.svg'});
  } else {
    browser.browserAction.setIcon({path: 'icon/icon.svg'});
  }
};

const popupWindow = (tab, targetUrl) => {
  let screen = window.screen;
  let width = 500;
  let height = 400;

  let top = screen.top;
  let left = screen.left;
  if (preferences.defaultPosition === 0) {
    top = screen.top + (screen.height - height)/2;
    left = screen.left + (screen.width - width)/2;
  }
  else {
    if (preferences.defaultPosition === 2 || preferences.defaultPosition === 4) {
      top = screen.top + screen.height - height;
      if(top < screen.top)
        top = screen.top;
    }
    if (preferences.defaultPosition === 3 || preferences.defaultPosition === 4) {
      left = screen.left + screen.width - width;
      if(left < screen.left)
        left = screen.left;
    }
  }
  browser.windows.create({
    url: targetUrl || 'about:blank',
    type: 'popup',
    top: top,
    left: left,
    width: width,
    height: height,
  }).then(windowInfo => {
    let windowID = windowInfo.id;
    let tabID = windowInfo.tabs[0].id;
    browser.windows.update(windowID,{focused: true, top: top, left: left});
    if(!targetUrl) {
      browser.tabs.move(tab.id, {windowId: windowID, index: -1});
      browser.tabs.remove(tabID);
    }
  });
};

browser.browserAction.onClicked.addListener(tab => {
  popupWindow(tab);
});

window.addEventListener('DOMContentLoaded', event => {
  loadPreference();
});

// const messageHandler = (message, sender, sendResponse) => {
//   if(message.action === 'launchVideo') {
//     launchVideo(message.url, preferences);
//   }
// };

// browser.runtime.onMessage.addListener(messageHandler);
// browser.runtime.onMessageExternal.addListener(messageHandler);

/*
  APIs for other addon, for example:

  Foxy Gestures: https://addons.mozilla.org/zh-TW/firefox/addon/foxy-gestures/
  ```
  browser.runtime.sendMessage('PopupVideoWebExt@ettoolong',
  {
    action: 'launchVideo',
    url: data.element.linkHref
  }).then();
  ```
*/
