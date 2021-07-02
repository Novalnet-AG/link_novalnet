'use strict';

const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
const StringUtils = require('dw/util/StringUtils');
var novalnetConfig = require('*/cartridge/scripts/novalnetConfig');

/**
 * Creates a Local Services Framework service definition
 * @param {string} url - end point
 * @returns {dw.svc.Service} - The created service definition.
 */
exports.getNovalnetService = function (url) {
    return LocalServiceRegistry.createService('novalnet.http.service', {
        /**
         * A callback function to configure HTTP request parameters before
         * a call is made to novalnet web service
         *
         * @param {dw.svc.Service} svc Service instance
         * @param {string} requestObject - Request object, containing the end point, query string params, payload etc.
         * @returns {string} - The body of HTTP request
         */
        createRequest: function (svc, requestObject) {
            var apiKey = StringUtils.encodeBase64(novalnetConfig.getPaymentAccessKey());

            svc.addHeader('Content-type', 'application/json');
            svc.addHeader('charset', 'UTF-8');
            svc.addHeader('X-NN-Access-Key', apiKey);
            svc.setURL(url);
            svc.setRequestMethod('POST');
            return requestObject;
        },
        parseResponse: function (svc, httpClient) {
            return httpClient.text;
        },
        filterLogMessage: function (msg) {
            return msg;
        }
    });
};
