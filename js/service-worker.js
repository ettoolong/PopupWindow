chrome.storage.local.get(results => {
  let defaultPreference = {
    defaultPosition: 0,
    windowPositionLeft: 0,
    windowPositionTop: 0,
    windowWidth: 500,
    windowHeight: 400,
    openThisLink: true,
    moveThisPage: true,
    iconColor: 0, //0:black, 1:white
    version: 4
  };
  if ((typeof results.length === 'number') && (results.length > 0)) {
    results = results[0];
  }
  if (results.version) {
    chrome.storage.session.set(results, _ => {})

    if (results.version !== defaultPreference.version) {
      const update = {};
      let needUpdate = false;
      for(const p in defaultPreference) {
        if(results[p] === undefined) {
          results[p] = defaultPreference[p]
          update[p] = defaultPreference[p];
          needUpdate = true;
        }
      }
      if(needUpdate) {
        chrome.storage.local.set(update);
      }
    }
    intaial()
  } else {
    // initial storage data
    chrome.storage.local.set(defaultPreference, _ => {});
    chrome.storage.session.set(defaultPreference, _ => {
      intaial()
    })
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if(area === 'local') {

    const updateValues = Object.keys(changes).reduce((acc, cur) => {
      acc[cur] = changes[cur].newValue;
      return acc;
    }, {}) ;
    chrome.storage.session.set(updateValues, _ => {
      if (changes.iconColor) {
        setBrowserActionIcon();
      }
      if (changes.openThisLink || changes.moveThisPage) {
        resetContextMenu()
      }
    })
  }
});

function intaial() {
  setBrowserActionIcon();
  resetContextMenu();
  chrome.windows.getAll({windowTypes: ['normal','popup']}, windowInfos => {
    for (let windowInfo of windowInfos) {
      if (windowInfo.type === 'normal') {
        addToWinMapping(windowInfo);
      } else {
        addToPopupMapping(windowInfo, null);
      }
    }
  });
}

const createContextMenu = (preferences) => {
  if (preferences.moveThisPage) {
    chrome.contextMenus.create({
      type: 'normal',
      id: 'menu_moveThisPage',
      title: chrome.i18n.getMessage('moveThisPage'),
      contexts: ['page', 'frame']
    });
  }

  if (preferences.openThisLink) {
    chrome.contextMenus.create({
      type: 'normal',
      id: 'menu_openThisLink',
      title: chrome.i18n.getMessage('openThisLink'),
      contexts: ['link']
    });
  }
};

const resetContextMenu = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.storage.session.get(['moveThisPage', 'openThisLink'], preferences => {
        createContextMenu(preferences);
    })
  })
};

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'menu_moveThisPage') {
    chrome.windows.getCurrent(windowInfo => {
      if(windowInfo.type === 'popup') {
        chrome.storage.session.get(['popupMapping'], preferences => {
          const popupMapping = preferences.popupMapping ?? {}
          let popup = popupMapping[windowInfo.id];
          mergeWindow(tab, popup ? popup.originalWindowId: null);
        })
      }
      else {
        popupWindow(tab);
      }
    });
  } else if (info.menuItemId === 'menu_openThisLink') {
    popupWindow(tab, info.linkUrl);
  }
})

const setBrowserActionIcon = () => {
  chrome.storage.session.get(['iconColor'], preferences => {
    if(preferences.iconColor === 1) {
      chrome.action.setIcon({path: '/icon/icon_w.png'});
    }
    else {
      chrome.action.setIcon({path: '/icon/icon_b.png'});
    }
  })
};

const popupWindow = (tab, targetUrl, winLeft, winTop, winWidth, winHeight) => {
  chrome.system.display.getInfo(
    {},
    displayInfo => {
      let screen = displayInfo.filter(i => i.isPrimary)[0] ?? {workArea: {
        height: 919,
        left: 55,
        top: 37,
        width: 1415,
      }};
      chrome.storage.session.get(['windowWidth', 'windowHeight', 'defaultPosition', 'windowPositionTop', 'windowPositionLeft'], preferences => {
        let width = winWidth ?? preferences.windowWidth;
        let height = winHeight ?? preferences.windowHeight;

        let top = screen.workArea.top;
        let left = screen.workArea.left;
        let sTop = top;
        let sLeft = left;
        let sWidth = screen.workArea.width;
        let sHeight = screen.workArea.height;
        if (preferences.defaultPosition === 0) {
          top = sTop + Math.round((sHeight - height)/2);
          left = sLeft + Math.round((sWidth - width)/2);
        }
        else if (preferences.defaultPosition === 5) {
          top = preferences.windowPositionTop;
          left = preferences.windowPositionLeft;
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
        if(winTop !== undefined) {
          top = winTop;
        }
        if(winLeft !== undefined) {
          left = winLeft;
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
      })
    }
  )
};

const moveTab = (tabId, windowId) => {
  chrome.tabs.move(tabId, {windowId: windowId, index: -1});
  chrome.windows.update(windowId, {focused: true});
  chrome.tabs.update(tabId, {active: true});
}

const mergeWindow = (tab, windowId) => {
  chrome.storage.session.get(['winMapping'], preferences => {
    const winMapping = preferences.winMapping ?? {}
    let window = windowId ? winMapping[windowId] : null;
    if(!window) {
      for (let w of Object.values(winMapping)) {
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
  })
}

chrome.action.onClicked.addListener(tab => {
  popupWindow(tab);
});

chrome.windows.onRemoved.addListener(windowId => {
  chrome.storage.session.get(['winMapping', 'popupMapping'], preferences => {
    const winMapping = preferences.winMapping ?? {}
    const popupMapping = preferences.popupMapping ?? {}
    if (winMapping[windowId]) {
      delete winMapping[windowId]
      chrome.storage.session.set({ winMapping }, _ => {})
    } else {
      if (popupMapping[windowId]){
        delete popupMapping[windowId]
        chrome.storage.session.set({ popupMapping }, _ => {})
      }
    }
  })
});

chrome.windows.onCreated.addListener(windowInfo => {
  if (windowInfo.type === 'normal') {
    addToWinMapping(windowInfo);
  }
});

chrome.windows.onFocusChanged.addListener(windowId => {
  chrome.storage.session.get(['winMapping'], preferences => {
    const winMapping = preferences.winMapping ?? {}
    let window = winMapping[windowId];
    if (!window) return;
    window.lastFocus = performance.now();
  })
});

function addToWinMapping(window) {
  chrome.storage.session.get(['winMapping'], preferences => {
    const winMapping = preferences.winMapping ?? {}
    winMapping[window.id] = {
      id: window.id,
      lastFocus: 0
    }
    chrome.storage.session.set({ winMapping }, _ => {})
  })
}

function addToPopupMapping(window, originalWindowId) {
  chrome.storage.session.get(['popupMapping'], preferences => {
    const popupMapping = preferences.popupMapping ?? {}
    popupMapping[window.id] = {
      id: window.id,
      originalWindowId: originalWindowId
    }
    chrome.storage.session.set({ popupMapping }, _ => {})
  })
}

chrome.commands.onCommand.addListener(command => {
  chrome.storage.session.get(['popupMapping'], preferences => {
    const popupMapping = preferences.popupMapping ?? {}
    if (command === "popupWindow") {
      chrome.windows.getCurrent(windowInfo => {
        chrome.tabs.query({active: true, currentWindow: true}, tabs => {
          if ((typeof tabs !== 'undefined') && (tabs.length > 0)) {
            let tab = tabs[0];
            if(windowInfo.type === 'popup') {
              let popup = popupMapping[windowInfo.id];
              mergeWindow(tab, popup ? popup.originalWindowId: null);
            }
            else {
              popupWindow(tab);
            }
          }
        });
      });
    }
  })
});

const messageHandler = (message, sender, sendResponse) => {
  if(message.action === 'popupWindow') {
    chrome.tabs.get(message.tabId, tab => {
      if(message.left && message.top) {
        popupWindow(tab, null, message.left, message.top);
      }
      else {
        popupWindow(tab);
      }
    });
  }
  else if(message.action === 'ack') {
    sendResponse({result:'ok'});
  }
};

chrome.runtime.onMessage.addListener(messageHandler);
chrome.runtime.onMessageExternal.addListener(messageHandler);
