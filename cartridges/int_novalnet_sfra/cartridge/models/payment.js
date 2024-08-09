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
            if (isNovalnetEnabled && !empty(novalnetConfig.getProductActivationKey()) && !empty(novalnetConfig.getPaymentAccessKey()) && !empty(novalnetConfig.getTariffId()) && !empty(novalnetConfig.getClientKey())) {
                filteredPaymentMethods.push(method);
                applicablePaymentMethodID.push(method.ID);
            }
        } else {
            filteredPaymentMethods.push(method);
        }
    }
    
    return filteredPaymentMethods;
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
