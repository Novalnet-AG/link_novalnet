/* global dw request response empty */
/* eslint-disable no-shadow */

'use strict';

var ISML = require('dw/template/ISML');
var OrderMgr = require('dw/order/OrderMgr');
var ArrayList = require('dw/util/ArrayList');
var CSRFProtection = require('dw/web/CSRFProtection');
var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var novalnetHelper = require('*/cartridge/scripts/novalnetHelper');
var novalnetService = require('*/cartridge/scripts/novalnetService');
var novalnetConfig = require('*/cartridge/scripts/novalnetConfig');
var Site = require('dw/system/Site');
var URLUtils = require('dw/web/URLUtils');
var URLAction = require('dw/web/URLAction');

function saveConfiguration() {
	var params = request.httpParameterMap;
	var formSubmitValue = params.submit_button.value;
	if(formSubmitValue && formSubmitValue.toLowerCase() == 'submit') {
		var productActivationKey = params.product_activation_key.value;
		var paymentAccessKey = params.payment_access_key.value;
		var clientKey = params.client_key.value;
		var novalnetEnabled = (params.novalnet_enabled == 'on') ? true : false;
		var nnWebhookTestMode = (params.nn_webhook_testMode == 'on') ? true : false;
		var nnWebhookEmail = params.nn_webhook_email.value;
		var nnTariffID = params.selected_tariff.value;
		var nnWebhookUrl = params.nn_webhook_url.value;
		Transaction.begin();
		Transaction.wrap(function () {
			Site.current.setCustomPreferenceValue('nnPublicKey', productActivationKey);
			Site.current.setCustomPreferenceValue('nnPrivateKey', paymentAccessKey);
			Site.current.setCustomPreferenceValue('nnClientSecretKey', clientKey);
			Site.current.setCustomPreferenceValue('nnEnabled', novalnetEnabled);
			Site.current.setCustomPreferenceValue('nnWebhookTestMode', nnWebhookTestMode);
			Site.current.setCustomPreferenceValue('nnWebhookEmailTo', nnWebhookEmail);
			Site.current.setCustomPreferenceValue('nnTariffID', nnTariffID);
			Site.current.setCustomPreferenceValue('nnWebhookUrl', nnWebhookUrl);
		});
		Transaction.commit();
	}
	start();
}

function getConfigurationValues() {
	var webhookUrl = Site.current.getCustomPreferenceValue('nnWebhookUrl');
	
	if(!webhookUrl) {
		var urlAction : URLAction = new URLAction("NovalnetWebhook-Notify", Site.current.name);
		var url : URL = URLUtils.abs(false, urlAction);
		webhookUrl = url.toString();
	}
	
	return {
		productActivationKey: Site.current.getCustomPreferenceValue('nnPublicKey') ? Site.current.getCustomPreferenceValue('nnPublicKey'): '' ,
		paymentAccessKey: Site.current.getCustomPreferenceValue('nnPrivateKey') ? Site.current.getCustomPreferenceValue('nnPrivateKey'): '' ,
		clientKey: Site.current.getCustomPreferenceValue('nnClientSecretKey') ? Site.current.getCustomPreferenceValue('nnClientSecretKey'): '' ,
		novalnetEnabled: Site.current.getCustomPreferenceValue('nnEnabled'),
		nnWebhookTestMode: Site.current.getCustomPreferenceValue('nnWebhookTestMode'),
		nnWebhookEmail: Site.current.getCustomPreferenceValue('nnWebhookEmailTo') ? Site.current.getCustomPreferenceValue('nnWebhookEmailTo') : '',
		nnTariffID: Site.current.getCustomPreferenceValue('nnTariffID') ? Site.current.getCustomPreferenceValue('nnTariffID') : '',
		nnWebhookUrl: webhookUrl
	}
}

function start() {
	var data = getConfigurationValues();
	require('dw/template/ISML').renderTemplate('configurationBoard', data);
}

function getMerchantCredentials() {
	var params = request.httpParameterMap;
	var productActivationKey = params.productActivationKey.stringValue;
	var paymentAccessKey = params.paymentAccessKey.stringValue;
	
	Transaction.begin();
	Transaction.wrap(function () {
		Site.current.setCustomPreferenceValue('nnPublicKey', productActivationKey);
		Site.current.setCustomPreferenceValue('nnPrivateKey', paymentAccessKey);
	});
	Transaction.commit();
	
	var data = {};

    data.merchant = {
        signature: productActivationKey
    };
    data.custom = {
        lang: novalnetConfig.getCurrentLang()
    };
	
	var callResult = novalnetService.getNovalnetService('https://payport.novalnet.de/v2/merchant/details').call(JSON.stringify(data));
    if (callResult.isOk() === false) {
        novalnetHelper.debugLog(callResult.getErrorMessage());
        return { statusText: callResult.getErrorMessage() };
    }
    var response = novalnetHelper.getFormattedResult(callResult.object);
	renderJson({ statusText: 'success', response: JSON.stringify(response)});
}

function configureWebhookUrl() {
	renderJson({ statusText: 'success', response: 'test'});
}

/**
 * Render Template
 * @param {string} templateName - Template Name
 * @param {Object} data - pdict data
 */
function render(templateName, data) {
    if (typeof data !== 'object') {
        data = {}; // eslint-disable-line no-param-reassign
    }
    try {
        ISML.renderTemplate(templateName, data);
    } catch (e) {
        throw new Error(e.javaMessage + '\n\r' + e.stack, e.fileName, e.lineNumber);
    }
}

/**
 * Write json data in response object
 * @param {Object} data - data contains novalnet response
 */
function renderJson(data) {
    response.setContentType('application/json');
    var json = JSON.stringify(data);
    response.writer.print(json);
}

start.public = true;
saveConfiguration.public = true;
getMerchantCredentials.public = true;
configureWebhookUrl.public = true;

exports.Start = start;
exports.SaveConfiguration = saveConfiguration;
exports.GetMerchantCredentials = getMerchantCredentials;
exports.ConfigureWebhookUrl = configureWebhookUrl;
