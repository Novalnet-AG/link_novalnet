/* global request, dw */
/* eslint-disable no-plusplus */

'use strict';

var PaymentMgr = require('dw/order/PaymentMgr');
var collections = require('*/cartridge/scripts/util/collections');
var base = module.superModule;
var novalnetConfig = require('*/cartridge/scripts/novalnetConfig');

/**
 * Payment class that represents payment information for the current basket
 * @param {dw.order.Basket} currentBasket - the target Basket object
 * @param {dw.customer.Customer} currentCustomer - the associated Customer object
 * @param {string} countryCode - the associated Site countryCode
 */
function Payment(currentBasket, currentCustomer, countryCode) {
    base.call(this, currentBasket, currentCustomer, countryCode);
    var paymentInstruments = currentBasket.paymentInstruments;

    this.selectedPaymentInstruments = paymentInstruments ? getSelectedPaymentInstruments(paymentInstruments) : null;

    var paymentAmount = currentBasket.totalGrossPrice;

    var paymentMethods = PaymentMgr.getApplicablePaymentMethods(
        currentCustomer,
        countryCode,
        paymentAmount.value
    );


    paymentMethods = getNovalnetApplicablePaymentMethods(paymentMethods, currentBasket);
    this.applicablePaymentMethods = paymentMethods ? applicablePaymentMethods(paymentMethods) : null;
}

/**
 * Get Novalnet Applicable payment methods
 * @param {Object} paymentMethods - the target Basket object
 * @param {dw.order.Basket} currentBasket - the target Basket object
 * @returns {Object} filteredPaymentMethods
 */
function getNovalnetApplicablePaymentMethods(paymentMethods, currentBasket) {
    var isNovalnetEnabled = novalnetConfig.isNovalnetEnabled();
    const applicablePaymentMethodsIterator = paymentMethods.iterator();
    let filteredPaymentMethods = new dw.util.ArrayList();
    let applicablePaymentMethodID = [];
    while (applicablePaymentMethodsIterator.hasNext()) {
        let method = applicablePaymentMethodsIterator.next();
        let isNovalnet = isNovalnetPaymentMethods(method);
        if (isNovalnet) {
            if (isNovalnetEnabled && !empty(novalnetConfig.getProductActivationKey()) && !empty(novalnetConfig.getPaymentAccessKey()) && !empty(novalnetConfig.getTariffId())) {
                filteredPaymentMethods.push(method);
                applicablePaymentMethodID.push(method.ID);
            }
        } else {
            filteredPaymentMethods.push(method);
        }
    }

    var guaranteePayments = ['NOVALNET_GUARANTEED_INVOICE', 'NOVALNET_GUARANTEED_SEPA'];
    for (var payment in guaranteePayments) { // eslint-disable-line guard-for-in
        var nonGuaranteePayment = (guaranteePayments[payment] === 'NOVALNET_GUARANTEED_INVOICE') ? 'NOVALNET_INVOICE' : 'NOVALNET_SEPA';
        if (applicablePaymentMethodID.indexOf(guaranteePayments[payment]) > -1 && applicablePaymentMethodID.indexOf(nonGuaranteePayment) > -1) {
            var isGuaranteedPayment = checkGuaranteedPayment(guaranteePayments[payment], currentBasket, 999);
            if (!isGuaranteedPayment) {
                filteredPaymentMethods.remove(PaymentMgr.getPaymentMethod(guaranteePayments[payment]));
            } else {
                filteredPaymentMethods.remove(PaymentMgr.getPaymentMethod(nonGuaranteePayment));
            }
        }
    }

    var instalmentPayments = ['NOVALNET_INSTALMENT_SEPA', 'NOVALNET_INSTALMENT_INVOICE'];
    for (var key in instalmentPayments) {
        if (applicablePaymentMethodID.indexOf(instalmentPayments[key]) > -1) {
            var isValid = checkInstalmentPayment(instalmentPayments[key], currentBasket);
            var isGuaranteePayment = checkGuaranteedPayment(instalmentPayments[key], currentBasket, 1998);
            if (!isGuaranteePayment || !isValid) {
                filteredPaymentMethods.remove(PaymentMgr.getPaymentMethod(instalmentPayments[key]));
            }
        }
    }
    return filteredPaymentMethods;
}

/**
 * Check Instalment payment conditions
 * @param {string} payment - Instalment Payment Name
 * @param {dw.order.Basket} currentBasket - the target Basket object
 * @returns {boolean} isInstalment
 */
function checkInstalmentPayment(payment, currentBasket) {
    var currentSite = require('dw/system/Site').current;
    var cycleId = (payment === 'NOVALNET_INSTALMENT_INVOICE') ? 'nnInstlInvoiceCycles' : 'nnInstlSepaCycles';
    var cycles = currentSite.getCustomPreferenceValue(cycleId);
    var cycleArray = [];
    for (var key in cycles) { // eslint-disable-line guard-for-in
        cycleArray.push(cycles[key]);
    }
    var orderAmount = Math.round(currentBasket.totalGrossPrice * 100);
    var minVal = Math.min.apply(Math, cycleArray);
    var cycleAmount = orderAmount / minVal;
    if (cycleAmount >= 999) {
        return true;
    }
    return false;
}

/**
 * check guarantee payment conditions
 * @param {string} paymentMethod - novalnet guaranteed payment method
 * @param {dw.order.Basket} currentBasket - the target Basket object
 * @param {int} minAmount - minimum order amount for guaranteed payments
 * @returns {boolean} isGuaranteedPayment
 */
function checkGuaranteedPayment(paymentMethod, currentBasket, minAmount) {
    var orderAmount = Math.round(currentBasket.totalGrossPrice * 100);
    var config = novalnetConfig.getPaymentConfiguration(paymentMethod);
    minAmount = config.minAmount ? config.minAmount : minAmount;

    if (orderAmount >= minAmount && currentBasket.getCurrencyCode() === 'EUR') {
        return true;
    }
    return false;
}

/**
 * check if its novalnet payment
 * @param {string} paymentMethod - paymentmethod
 * @returns {boolean} isNovalnetPayment
 */
function isNovalnetPaymentMethods(paymentMethod) {
    if (!empty(paymentMethod)) {
        var paymentProcessor = paymentMethod.getPaymentProcessor();
        if (!empty(paymentProcessor) && paymentProcessor.ID.equals('NOVALNET')) {
            return true;
        }
    }
    return false;
}

/**
 * Creates an array of objects containing selected payment details
 * @param {Object} selectedPaymentInstruments - selected payment instruments
 * @returns {Array} paymentInstruments
 */
function getSelectedPaymentInstruments(selectedPaymentInstruments) {
    return collections.map(selectedPaymentInstruments, function (paymentInstrument) {
        return {
            paymentMethod: paymentInstrument.paymentMethod,
            paymentMethodName: PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod).name,
            amount: paymentInstrument.paymentTransaction.amount.value
        };
    });
}


/**
 * Creates an array of objects containing applicable payment methods
 * @param {dw.util.ArrayList<dw.order.dw.order.PaymentMethod>} paymentMethods - An ArrayList of
 *      applicable payment methods that the user could use for the current basket.
 * @returns {Array} of object that contain information about the applicable payment methods for the
 *      current cart
 */
function applicablePaymentMethods(paymentMethods) {
    return collections.map(paymentMethods, function (method) {
        return {
            ID: method.ID,
            name: method.name
        };
    });
}

module.exports = Payment;
