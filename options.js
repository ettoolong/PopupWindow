let currentPrefs = {};

const saveToPreference = (id, value) => {
  let update = {};
  update[id] = value;
  chrome.storage.local.set(update);
};

const handleVelueChange = id => {
  let elem = document.getElementById(id);
  if(elem) {
    let elemType = elem.getAttribute('type');
    if(elemType === 'checkbox') {
      elem.addEventListener('input', event => {
        saveToPreference(id, elem.checked ? true : false);
      });
    }
    else if(elemType === 'option') {
      elem.addEventListener('input', event => {
        saveToPreference(id, parseInt(elem.value));
      });
    }
    else if(elemType === 'number') {
      elem.addEventListener('input', event => {
        saveToPreference(id, parseInt(elem.value));
      });
    }
    else if(elemType === 'radioGroup') {
      let radios = Array.from(elem.querySelectorAll('input[name='+id+']'));
      for(let radio of radios) {
        radio.addEventListener('input', event => {
          if(radio.checked)
            saveToPreference(id, parseInt(radio.getAttribute('value')));
        });
      }
    }
  }
};

const setValueToElem = (id, value) => {
  let elem = document.getElementById(id);
  if(elem) {
    let elemType = elem.getAttribute('type');
    if(elemType === 'checkbox') {
      elem.checked = value;
    }
    else if(elemType === 'option') {
      let options = Array.from(elem.querySelectorAll('option'));
      for(let option of options) {
        if(parseInt(option.getAttribute('value')) === value) {
          option.selected = true;
          break;
        }
      }
    }
    else if(elemType === 'number') {
      elem.value = value;
    }
    else if(elemType === 'radioGroup') {
      let radios = Array.from(elem.querySelectorAll('input[name='+id+']'));
      for(let radio of radios) {
        if(parseInt(radio.getAttribute('value')) === value) {
          radio.checked = true;
          break;
        }
      }
    }
  }
};

const init = preferences => {
  currentPrefs = preferences;
  for(let p in preferences) {
    setValueToElem(p, preferences[p]);
    handleVelueChange(p);
  }
  let l10nTags = Array.from(document.querySelectorAll('[data-l10n-id]'));
  l10nTags.forEach(tag => {
    tag.textContent = chrome.i18n.getMessage(tag.getAttribute('data-l10n-id'));
  });
};

window.addEventListener('load', event => {
  chrome.storage.local.get(results => {
    if ((typeof results.length === 'number') && (results.length > 0)) {
      results = results[0];
    }
    if (results.version) {
      init(results);
    }
  });
}, true);
