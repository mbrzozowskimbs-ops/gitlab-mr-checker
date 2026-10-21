'use strict';

// Chrome MV3 accepts one service worker file; load the shared background scripts in Firefox's order.
importScripts('settings.js', 'background.js');
