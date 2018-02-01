let defaultPreference = {
  defaultPosition: 0,
  openThisLink: true,
  moveThisPage: true,
  //iconColor: 0, //0:black, 1:white
  version: 2
};
let preferences = {};
let menu_openThisLink = null;
let menu_moveThisPage = null;
let winMapping = new Map;
let popupMapping = new Map;

const storageChangeHandler = (changes, area) => {
  if(area === 'local') {
    let changedItems = Object.keys(changes);
    for (let item of changedItems) {
      preferences[item] = changes[item].newValue;
      switch (item) {
        // case 'iconColor':
        //   setBrowserActionIcon();
        //   break;
        case 'openThisLink':
          resetLinkMenu();
          break;
        case 'moveThisPage':
          resetContextMenu();
          break;
      }
    }
  }
};

const loadPreference = () => {
  chrome.storage.local.get(results => {
    if ((typeof results.length === 'number') && (results.length > 0)) {
      results = results[0];
    }
    if (!results.version) {
      preferences = defaultPreference;
      chrome.storage.local.set(defaultPreference, res => {
        chrome.storage.onChanged.addListener(storageChangeHandler);
      });
    } else {
      preferences = results;
      chrome.storage.onChanged.addListener(storageChangeHandler);
    }

    if (preferences.version !== defaultPreference.version) {
      let update = {};
      let needUpdate = false;
      for(let p in defaultPreference) {
        if(preferences[p] === undefined) {
          update[p] = defaultPreference[p];
          needUpdate = true;
        }
      }
      if(needUpdate) {
        chrome.storage.local.set(update);
      }
    }

    resetLinkMenu();
    resetContextMenu();
    //setBrowserActionIcon();
  });
};

const createContextMenu = (mode) => {
  if(menu_moveThisPage)
    return;
  menu_moveThisPage = chrome.contextMenus.create({
    type: 'normal',
    title: chrome.i18n.getMessage('moveThisPage'),
    contexts: ['page', 'frame'],
    onclick: (data, tab) => {
      chrome.windows.getCurrent(windowInfo => {
        if(windowInfo.type === 'popup') {
          let popup = popupMapping.get(windowInfo.id);
          mergeWindow(tab, popup ? popup.originalWindowId: null);
        }
        else {
          popupWindow(tab);
        }
      });
    }
  });
};

const resetContextMenu = (type) => {
  if (preferences.moveThisPage) {
    createContextMenu(type);
  } else {
    if(menu_moveThisPage !== null) {
      chrome.contextMenus.remove(menu_moveThisPage, () => {
        menu_moveThisPage = null;
        contextMenuMode = '';
      });
    }
  }
};

const createLinkMenu = () => {
  if(menu_openThisLink)
    return;
  menu_openThisLink = chrome.contextMenus.create({
    type: 'normal',
    title: chrome.i18n.getMessage('openThisLink'),
    contexts: ['link'],
    onclick: (data, tab) => {
      popupWindow(tab, data.linkUrl);
    }
  });
}

const resetLinkMenu = () => {
  if (preferences.openThisLink) {
    createLinkMenu();
  }
  else {
    if(menu_openThisLink !== null) {
      chrome.contextMenus.remove(menu_openThisLink, () => {
        menu_openThisLink = null;
      });
    }
  }
};

// const setBrowserActionIcon = () => {
//   if(preferences.iconColor === 1) {
//     chrome.browserAction.setIcon({path: 'icon/icon_w.png'});
//   }
//   else {
//     chrome.browserAction.setIcon({path: 'icon/icon.png'});
//   }
// };

const popupWindow = (tab, targetUrl) => {
  let screen = window.screen;
  let width = 500;
  let height = 400;

  let top = screen.availTop !== undefined ? screen.availTop: screen.top;
  let left = screen.availLeft !== undefined ? screen.availLeft: screen.left;
  let sTop = top;
  let sLeft = left;
  let sWidth = screen.availWidth !== undefined ? screen.availWidth: screen.width;
  let sHeight = screen.availHeight !== undefined ? screen.availHeight: screen.height;
  if (preferences.defaultPosition === 0) {
    top = sTop + Math.round((sHeight - height)/2);
    left = sLeft + Math.round((sWidth - width)/2);
  }
  else {
    if (preferences.defaultPosition === 2 || preferences.defaultPosition === 4) {
      top = sTop + sHeight - height;
      if(top < sTop)
        top = sTop;
    }
    if (preferences.defaultPosition === 3 || preferences.defaultPosition === 4) {
      left = sLeft + sWidth - width;
      if(left < sLeft)
        left = sLeft;
    }
  }
  let setting = {
    type: 'popup',
    top: top,
    left: left,
    width: width,
    height: height,
  };
  if(targetUrl) {
    setting.url = targetUrl;
  }
  else {
    setting.tabId = tab.id;
  }
  chrome.windows.create(setting, windowInfo => {
    chrome.windows.update(windowInfo.id,{focused: true, top: top, left: left});
    addToPopupMapping(windowInfo, tab.windowId);
  });
};

const moveTab = (tabId, windowId) => {
  chrome.tabs.move(tabId, {windowId: windowId, index: -1});
  chrome.windows.update(windowId, {focused: true});
  chrome.tabs.update(tabId, {active: true});
}

const mergeWindow = (tab, windowId) => {
  let window = windowId ? winMapping.get(windowId) : null;
  if(!window) {
    for (let w of winMapping.values()) {
      if (!window || w.lastFocus > window.lastFocus) {
        window = w;
      }
    }
  }

  if(window) {
    moveTab(tab.id, window.id);
  }
  else {
    chrome.windows.getAll({windowTypes: ['normal']}, winsInfo => {
      let normalWindows = [];
      for(let win of winsInfo) { //Firefox bug, 'windowTypes' filter not working.
        if(win.type === 'normal') normalWindows.push(winsInfo);
      }
      if(normalWindows.length === 0) { //no any window, create new one.
        chrome.windows.create({
          tabId: tab.id,
          type: 'normal'
        });
      }
      else {
        moveTab(tab.id, normalWindows[0].id);
      }
    });
  }
}

chrome.browserAction.onClicked.addListener(tab => {
  popupWindow(tab);
});

chrome.windows.onRemoved.addListener(windowId => {
  if(winMapping.get(windowId)) {
    winMapping.delete(windowId);
  }
  else {
    if(popupMapping.get(windowId)){
      popupMapping.delete(windowId);
    }
  }
});

chrome.windows.onCreated.addListener(windowInfo => {
  if(windowInfo.type === 'normal') {
    addToWinMapping(windowInfo);
  }
});

chrome.windows.onFocusChanged.addListener(windowId => {
  let window = winMapping.get(windowId);
  if (!window) return;
  window.lastFocus = performance.now();
});

chrome.windows.getAll({windowTypes: ['normal','popup']}, windowInfos => {
  for (let windowInfo of windowInfos) {
    if(windowInfo.type === 'normal') {
      addToWinMapping(windowInfo);
    }
    else{
      addToPopupMapping(windowInfo, null);
    }
  }
});

function addToWinMapping(window) {
  winMapping.set(window.id, {
    id: window.id,
    lastFocus: 0
  });
}

function addToPopupMapping(window, originalWindowId) {
  popupMapping.set(window.id, {
    id: window.id,
    originalWindowId: originalWindowId
  });
}

window.addEventListener('DOMContentLoaded', event => {
  loadPreference();
});

const messageHandler = (message, sender, sendResponse) => {
  if(message.action === 'popupWindow') {
    chrome.tabs.get(message.tabId, tab => {
      popupWindow(tab);
    });
  }
};

chrome.runtime.onMessage.addListener(messageHandler);
chrome.runtime.onMessageExternal.addListener(messageHandler);
