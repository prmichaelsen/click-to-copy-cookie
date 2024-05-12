import { CookieHandlerDevtools } from '../devtools/cookieHandlerDevtools.js';
import { BrowserDetector } from '../lib/browserDetector.js';
import { Cookie } from '../lib/cookie.js';
import { GenericStorageHandler } from '../lib/genericStorageHandler.js';
import { HeaderstringFormat } from '../lib/headerstringFormat.js';
import { OptionsHandler } from '../lib/optionsHandler.js';
import { PermissionHandler } from '../lib/permissionHandler.js';
import { ThemeHandler } from '../lib/themeHandler.js';
import { CookieHandlerPopup } from './cookieHandlerPopup.js';

(function () {
  ('use strict');

  let pageTitleContainer;
  let loadedCookies = {};

  const browserDetector = new BrowserDetector();
  const permissionHandler = new PermissionHandler(browserDetector);
  const storageHandler = new GenericStorageHandler(browserDetector);
  const optionHandler = new OptionsHandler(browserDetector, storageHandler);
  const themeHandler = new ThemeHandler(optionHandler);
  const cookieHandler = window.isDevtools
    ? new CookieHandlerDevtools(browserDetector)
    : new CookieHandlerPopup(browserDetector);

  document.addEventListener('DOMContentLoaded', async function () {
    pageTitleContainer = document.getElementById('pageTitle');

    pageTitleContainer.addEventListener('click', async function () {
      console.log('Requesting all permissions!');
      const isPermissionGranted =
        await permissionHandler.requestPermission('<all_urls>');
      console.log('Permission granted? ', isPermissionGranted);
      if (isPermissionGranted) {
        setPageTitle('Permissions granted!');
        showCookiesForTab(() => {
          copyText(HeaderstringFormat.format(loadedCookies));
          setPageTitle('Copied to clipboard!');
        });
      }
    });

    await initWindow();
  });

  // == End document ready == //

  /**
   * Builds the HTML for the cookies of the current tab.
   * @param {*} callback
   * @return {Promise|null}
   */
  async function showCookiesForTab(callback) {
    if (!cookieHandler.currentTab) {
      return;
    }

    console.log('showing cookies');

    document.myThing = 'DarkSide';

    // If devtools has not been fully init yet, we will wait for a signal.
    if (!cookieHandler.currentTab) {
      setPageTitle('No cookies found!');
      return;
    }
    const hasPermissions = await permissionHandler.checkPermissions(
      cookieHandler.currentTab.url,
    );
    if (!hasPermissions) {
      return;
    }

    cookieHandler.getAllCookies(function (cookies) {
      cookies = cookies.sort(sortCookiesByName);
      console.log(cookies);

      loadedCookies = {};

      if (cookies.length === 0) {
        setPageTitle('No cookies found!');
        return;
      }

      cookies.forEach(function (cookie) {
        const id = Cookie.hashCode(cookie);
        loadedCookies[id] = new Cookie(id, cookie, optionHandler);
      });

      callback();
    });
  }

  /**
   * Creates the HTML representation of a cookie.
   * @param {string} name Name of the cookie.
   * @param {string} value Value of the cookie.
   * @param {string} id HTML ID to use for the cookie.
   * @return {string} the HTML of the cookie.
   */
  function createHtmlForCookie(name, value, id) {
    const cookie = new Cookie(
      id,
      {
        name: name,
        value: value,
      },
      optionHandler,
    );

    return cookie.html;
  }

  /**
   * Creates the HTML form to allow editing a cookie.
   * @return {string} The HTML for the form.
   */
  function createHtmlFormCookie() {
    const template = document.importNode(
      document.getElementById('tmp-create').content,
      true,
    );
    return template.querySelector('form');
  }

  if (typeof createHtmlFormCookie === 'undefined') {
    // This should not happen anyway ;)
    // eslint-disable-next-line no-func-assign
    createHtmlFormCookie = createHtmlForCookie;
  }

  /**
   * Handles the CookiesChanged event and updates the interface.
   * @param {object} changeInfo
   */
  function onCookiesChanged(changeInfo) {
    if (!changeInfo) {
      showCookiesForTab();
      return;
    }

    console.log('Cookies have changed!', changeInfo.removed, changeInfo.cause);
    const id = Cookie.hashCode(changeInfo.cookie);

    if (changeInfo.cause === 'overwrite') {
      return;
    }

    if (loadedCookies[id]) {
      loadedCookies[id].updateHtml(changeInfo.cookie);
      return;
    }

    const newCookie = new Cookie(id, changeInfo.cookie, optionHandler);
    loadedCookies[id] = newCookie;
  }

  /**
   * Evaluates two cookies to determine which comes first when sorting them.
   * @param {object} a First cookie.
   * @param {object} b Second cookie.
   * @return {int} -1 if a should show first, 0 if they are equal, otherwise 1.
   */
  function sortCookiesByName(a, b) {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    return aName < bName ? -1 : aName > bName ? 1 : 0;
  }

  /**
   * Initialises the interface.
   * @param {object} _tab The current Tab.
   */
  async function initWindow(_tab) {
    await optionHandler.loadOptions();
    themeHandler.updateTheme();
    optionHandler.on('optionsChanged', onOptionsChanged);
    cookieHandler.on('cookiesChanged', onCookiesChanged);
    cookieHandler.on('ready', showCookiesForTab);
    if (cookieHandler.isReady) {
      showCookiesForTab();
    }
  }

  /**
   * Sets the page title.
   * @param {string} title Title to display.
   */
  function setPageTitle(title) {
    if (!pageTitleContainer) {
      return;
    }

    pageTitleContainer.querySelector('h1').textContent = title;
  }

  /**
   * Copy some text to the user's clipboard.
   * @param {string} text Text to copy.
   */
  function copyText(text) {
    const fakeText = document.createElement('textarea');
    fakeText.classList.add('clipboardCopier');
    fakeText.textContent = text;
    document.body.appendChild(fakeText);
    fakeText.focus();
    fakeText.select();
    document.execCommand('Copy');
    document.body.removeChild(fakeText);
  }

  /**
   * Handles the changes required to the interface when the options are changed
   * by an external source.
   * @param {Option} oldOptions the options before changes.
   */
  function onOptionsChanged(oldOptions) {
    showCookiesForTab();
  }
})();
