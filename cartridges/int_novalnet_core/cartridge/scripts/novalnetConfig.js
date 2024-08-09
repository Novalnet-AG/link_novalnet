'use strict';

/**
* Gets the product activation key.
*
* @returns {string} product activation key
*/
exports.getCurrentLang = function () {
    var locale = request.getLocale();
    if(locale === 'DEFAULT') {
		return 'DE';
	}
    var lang = locale.split('_');
    return lang[0].toUpperCase();
};

/**
* Gets the product activation key.
*
* @returns {string} product activation key
*/
exports.getProductActivationKey = function () {
    return require('dw/system/Site').current.getCustomPreferenceValue('nnPublicKey');
};

/**
* Gets the paymentAccessKey.
*
* @returns {string} PaymentAccessKey
*/
exports.getPaymentAccessKey = function () {
    return require('dw/system/Site').current.getCustomPreferenceValue('nnPrivateKey');
};

/**
* Gets the clientKey.
*
* @returns {string} clientKey
*/
exports.getClientKey = function () {
    return require('dw/system/Site').current.getCustomPreferenceValue('nnClientSecretKey');
};

/**
* Gets the tariffID.
*
* @returns {string} tariffID
*/
exports.getTariffId = function () {
    return require('dw/system/Site').current.getCustomPreferenceValue('nnTariffID');
};

/**
* Gets the Webhook Testmode.
*
* @returns {string} tariffID
*/
exports.getWebhookTestMode = function () {
    return require('dw/system/Site').current.getCustomPreferenceValue('nnWebhookTestMode');
};

/**
* Gets the Webhook email.
*
* @returns {string} tariffID
*/
exports.getWebhookEmail = function () {
    return require('dw/system/Site').current.getCustomPreferenceValue('nnWebhookEmailTo');
};

/**
* Gets the tariffID.
*
* @returns {string} tariffID
*/
exports.isNovalnetEnabled = function () {
    return require('dw/system/Site').current.getCustomPreferenceValue('nnEnabled');
};
