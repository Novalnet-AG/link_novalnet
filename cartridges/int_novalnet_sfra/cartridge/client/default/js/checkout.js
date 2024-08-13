/* global $ */

'use strict';

var processInclude = require('base/util');

$(document).ready(function () {
    const name = 'novalnetPaymentError';
    const error = new RegExp(`[?&]${encodeURIComponent(name)}=([^&]*)`).exec(window.location.search);
    if (error) {
        $('.error-message').show();
        $('.error-message-text').text(decodeURIComponent(error[1]));
    }
    processInclude(require('./checkout/checkout'));
});
