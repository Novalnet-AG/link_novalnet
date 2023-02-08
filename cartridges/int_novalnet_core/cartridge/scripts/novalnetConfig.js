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

/**
* Gets the novalnet payment configuration.
* @param {string} paymentId - payment name
* @returns {Object} novalnetPaymentConfiguration
*/
exports.getPaymentConfiguration = function (paymentId) {
    var currentSite = require('dw/system/Site').current;
    switch (paymentId) {
        case 'NOVALNET_INVOICE':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnInvoiceTestMode') ? 1 : 0,
                paymentAction: currentSite.getCustomPreferenceValue('nnInvoicePaymentAction'),
                onholdAmount: currentSite.getCustomPreferenceValue('nnInvoiceOnholdAmount'),
                dueDate: currentSite.getCustomPreferenceValue('nnInvoiceDuedate'),
                buyerNotification: currentSite.getCustomPreferenceValue('nnInvoiceBuyerNotification')
            };
        case 'NOVALNET_PREPAYMENT':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnPrepaymentTestMode') ? 1 : 0,
                dueDate: currentSite.getCustomPreferenceValue('nnPrepaymentDuedate'),
                buyerNotification: currentSite.getCustomPreferenceValue('nnPrepaymentBuyerNotification')
            };
        case 'NOVALNET_SEPA':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnSepaTestMode') ? 1 : 0,
                paymentAction: currentSite.getCustomPreferenceValue('nnSepaPaymentAction'),
                onholdAmount: currentSite.getCustomPreferenceValue('nnSepaOnholdAmount'),
                oneclick: currentSite.getCustomPreferenceValue('nnSepaOneclick'),
                dueDate: currentSite.getCustomPreferenceValue('nnSepaDuedate'),
                buyerNotification: currentSite.getCustomPreferenceValue('nnSepaBuyerNotification')
            };
        case 'NOVALNET_CREDITCARD':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnCCTestMode') ? 1 : 0,
                paymentAction: currentSite.getCustomPreferenceValue('nnCCPaymentAction'),
                onholdAmount: currentSite.getCustomPreferenceValue('nnCCOnholdAmount'),
                oneclick: currentSite.getCustomPreferenceValue('nnCCOneclick'),
                enforce3d: currentSite.getCustomPreferenceValue('nnCCEnforce3d'),
                inlineForm: currentSite.getCustomPreferenceValue('nnCCInlineForm'),
                labelStyle: currentSite.getCustomPreferenceValue('nnCCLabelStyle'),
                inputStyle: currentSite.getCustomPreferenceValue('nnCCInputStyle'),
                textStyle: currentSite.getCustomPreferenceValue('nnCCTextStyle'),
                buyerNotification: currentSite.getCustomPreferenceValue('nnCCBuyerNotification')
            };
        case 'NOVALNET_GUARANTEED_SEPA':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnGuaranteedSepaTestMode') ? 1 : 0,
                paymentAction: currentSite.getCustomPreferenceValue('nnGuaranteedSepaPaymentAction'),
                onholdAmount: currentSite.getCustomPreferenceValue('nnGuaranteedSepaOnholdAmount'),
                oneclick: currentSite.getCustomPreferenceValue('nnGuaranteedSepaOneclick'),
                minAmount: currentSite.getCustomPreferenceValue('nnGuaranteedSepaMinAmount'),
                dueDate: currentSite.getCustomPreferenceValue('nnGuaranteedSepaDuedate'),
                forceNonGuarantee: currentSite.getCustomPreferenceValue('nnGuaranteedSepaForce'),
                buyerNotification: currentSite.getCustomPreferenceValue('nnGuaranteedSepaBuyerNotification')
            };
        case 'NOVALNET_GUARANTEED_INVOICE':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnGuaranteedInvoiceTestMode') ? 1 : 0,
                paymentAction: currentSite.getCustomPreferenceValue('nnGuaranteedInvoicePaymentAction'),
                onholdAmount: currentSite.getCustomPreferenceValue('nnGuaranteedInvoiceOnholdAmount'),
                minAmount: currentSite.getCustomPreferenceValue('nnGuaranteedInvoiceMinAmount'),
                buyerNotification: currentSite.getCustomPreferenceValue('nnGuaranteedInvoiceBuyerNotification'),
                forceNonGuarantee: currentSite.getCustomPreferenceValue('nnGuaranteedInvoiceForce')
            };
        case 'NOVALNET_IDEAL':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnIdealTestMode') ? 1 : 0,
                buyerNotification: currentSite.getCustomPreferenceValue('nnIdealBuyerNotification')
            };
        case 'NOVALNET_SOFORT':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnSofortTestMode') ? 1 : 0,
                buyerNotification: currentSite.getCustomPreferenceValue('nnSofortBuyerNotification')
            };
        case 'NOVALNET_GIROPAY':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnGiropayTestMode') ? 1 : 0,
                buyerNotification: currentSite.getCustomPreferenceValue('nnGiropayTestMode')
            };
        case 'NOVALNET_CASHPAYMENT':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnCashpaymentTestMode') ? 1 : 0,
                dueDate: currentSite.getCustomPreferenceValue('nnCashpaymentDuedate'),
                buyerNotification: currentSite.getCustomPreferenceValue('nnCashpaymentBuyerNotification')
            };
        case 'NOVALNET_PRZELEWY':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnPrzelewyTestMode') ? 1 : 0,
                buyerNotification: currentSite.getCustomPreferenceValue('nnPrzelewyBuyerNotification')
            };
        case 'NOVALNET_EPS':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnEpsTestMode') ? 1 : 0,
                buyerNotification: currentSite.getCustomPreferenceValue('nnEpsBuyerNotification')
            };
        case 'NOVALNET_INSTALMENT_INVOICE':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnInstlInvoiceTestMode') ? 1 : 0,
                paymentAction: currentSite.getCustomPreferenceValue('nnInstlInvoicePaymentAction'),
                onholdAmount: currentSite.getCustomPreferenceValue('nnInstlInvoiceOnholdAmount'),
                minAmount: currentSite.getCustomPreferenceValue('nnInstlInvoiceMinAmount'),
                buyerNotification: currentSite.getCustomPreferenceValue('nnInstlInvoiceBuyerNotification'),
                cycles: JSON.stringify(getArrayFromObject(currentSite.getCustomPreferenceValue('nnInstlInvoiceCycles')))
            };
        case 'NOVALNET_INSTALMENT_SEPA':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnInstlSepaTestMode') ? 1 : 0,
                paymentAction: currentSite.getCustomPreferenceValue('nnInstlSepaPaymentAction'),
                onholdAmount: currentSite.getCustomPreferenceValue('nnInstlSepaOnholdAmount'),
                oneclick: currentSite.getCustomPreferenceValue('nnInstlSepaOneclick'),
                minAmount: currentSite.getCustomPreferenceValue('nnInstlSepaMinAmount'),
                dueDate: currentSite.getCustomPreferenceValue('nnInstlSepaDuedate'),
                buyerNotification: currentSite.getCustomPreferenceValue('nnInstlSepaBuyerNotification'),
                cycles: JSON.stringify(getArrayFromObject(currentSite.getCustomPreferenceValue('nnInstlSepaCycles')))
            };
        case 'NOVALNET_PAYPAL':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnPaypalTestMode') ? 1 : 0,
                paymentAction: currentSite.getCustomPreferenceValue('nnPaypalPaymentAction'),
                onholdAmount: currentSite.getCustomPreferenceValue('nnPaypalOnholdAmount'),
                buyerNotification: currentSite.getCustomPreferenceValue('nnPaypalBuyerNotification')
            };
        case 'NOVALNET_POSTFINANCE_CARD':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnPostfinanceCardTestMode') ? 1 : 0,
                buyerNotification: currentSite.getCustomPreferenceValue('nnPostfinanceCardBuyerNotification')
            };
        case 'NOVALNET_POSTFINANCE':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnPostfinanceTestMode') ? 1 : 0,
                buyerNotification: currentSite.getCustomPreferenceValue('nnPostfinanceBuyerNotification')
            };
        case 'NOVALNET_BANCONTACT':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnBancontactTestMode') ? 1 : 0,
                buyerNotification: currentSite.getCustomPreferenceValue('nnBancontactBuyerNotification')
            };
        case 'NOVALNET_MULTIBANCO':
            return {
                testMode: currentSite.getCustomPreferenceValue('nnMultibancoTestMode') ? 1 : 0,
                buyerNotification: currentSite.getCustomPreferenceValue('nnMultibancoBuyerNotification')
            };
        default:
            return {};
    }
};


/**
 * Provide array key value pairs.
 * @param {dw.util.Collection<dw.value.EnumValue>} dataCollection - ArrayList.
 * @returns {Array} Array of objects
 */
function getArrayFromObject(dataCollection) {
    if (dataCollection && dataCollection.length > 0) {
        return dataCollection.map(function (data) {
            return {
                value: data.value
            };
        });
    }
}
