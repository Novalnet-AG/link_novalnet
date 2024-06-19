'use strict';

var Transaction = require('dw/system/Transaction');
var collections = require('*/cartridge/scripts/util/collections');
var novalnetHelper = require('*/cartridge/scripts/novalnetHelper');
var novalnetService = require('*/cartridge/scripts/novalnetService');
var OrderMgr = require('dw/order/OrderMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var Resource = require('dw/web/Resource');
var novalnetConfig = require('*/cartridge/scripts/novalnetConfig');


/**
 * Verifies that given payment details are valid. If the information is valid a
 * payment instrument is created
 * @param {dw.order.Basket} basket Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @return {Object} returns an error object
 */
function Handle(basket, paymentInformation) { // eslint-disable-line no-unused-vars
    var error = false;
    var serverErrors = [];
    var paramsMap = request.httpParameterMap;

    var selectedPaymentMethodID = paramsMap.dwfrm_billing_paymentMethods_selectedPaymentMethodID.stringValue || paramsMap.dwfrm_billing_paymentMethod.stringValue;
    try {
        Transaction.begin();
        Transaction.wrap(function () {
            collections.forEach(basket.getPaymentInstruments(), function (item) {
                basket.removePaymentInstrument(item);
            });
            var paymentType = selectedPaymentMethodID.toLowerCase();

            // guarantee /instalment payment validation
            if (['NOVALNET_GUARANTEED_INVOICE', 'NOVALNET_GUARANTEED_SEPA', 'NOVALNET_INSTALMENT_SEPA', 'NOVALNET_INSTALMENT_INVOICE'].indexOf(selectedPaymentMethodID) > -1) {
                var config = novalnetConfig.getPaymentConfiguration(selectedPaymentMethodID);
                var minAmount = config.minAmount ? config.minAmount : 999;
                var birthdate = paramsMap[paymentType + '_dob'].stringValue;
                var guaranteePaymentError = validateGuaranteePayment(basket, birthdate, minAmount);

                var nonGuaranteePaymentId = (selectedPaymentMethodID === 'NOVALNET_GUARANTEED_INVOICE') ? 'NOVALNET_INVOICE' : 'NOVALNET_SEPA';
                if (guaranteePaymentError.length) {
                    if (['NOVALNET_GUARANTEED_INVOICE', 'NOVALNET_GUARANTEED_SEPA'].indexOf(selectedPaymentMethodID) > -1) {
                        var paymentMethods = PaymentMgr.getActivePaymentMethods();
                        const paymentMethodsIterator = paymentMethods.iterator();
                        let enabledPayments = [];
                        while (paymentMethodsIterator.hasNext()) {
                            let method = paymentMethodsIterator.next();
                            enabledPayments.push(method.ID);
                        }
                        if (config.forceNonGuarantee && enabledPayments.indexOf(nonGuaranteePaymentId) > -1) {
                            selectedPaymentMethodID = nonGuaranteePaymentId;
                        } else {
                            error = true;
                            serverErrors.push(guaranteePaymentError);
                        }
                    } else {
                        error = true;
                        serverErrors.push(guaranteePaymentError);
                    }
                }
            }
            // create payment instrument
            var paymentInstrument = basket.createPaymentInstrument(
                selectedPaymentMethodID,
                basket.totalGrossPrice
            );

            // save payment data
            if (selectedPaymentMethodID === 'NOVALNET_CREDITCARD') {
                paymentInstrument.custom.novalnetPanHash = paramsMap.nn_pan_hash.stringValue;
                paymentInstrument.custom.novalnetUniqueId = paramsMap.nn_unique_id.stringValue;
                session.privacy.novalnetCCDoRedirect = paramsMap.nn_do_redirect.stringValue;
            } else if (['NOVALNET_SEPA', 'NOVALNET_GUARANTEED_SEPA', 'NOVALNET_INSTALMENT_SEPA'].indexOf(selectedPaymentMethodID) > -1) {
                paymentInstrument.custom.novalnetSepaIban = paramsMap[paymentType + '_iban'].stringValue;
                if(!empty(paymentInstrument.custom.novalnetSepaIban)) {
					var bic = paramsMap[paymentType + '_bic'].stringValue;
					var countryCode = (paymentInstrument.custom.novalnetSepaIban).substring(0,2);
					if (['CH', 'MC', 'SM', 'GB'].indexOf(countryCode) > -1) {
						if(empty(bic)) {
							error = true;
							serverErrors.push(Resource.msg('novalnet.account_details_error_msg', 'novalnet', null));
						}
						else {
							session.privacy.novalnetSepaBic = bic;
						}
					}
				}
            }

            if (['NOVALNET_INSTALMENT_SEPA', 'NOVALNET_INSTALMENT_INVOICE'].indexOf(selectedPaymentMethodID) > -1) {
                paymentInstrument.custom.novalnetInstalmentCycle = paramsMap[paymentType + '_cycle_select'].stringValue;
            }

            if (['NOVALNET_CREDITCARD', 'NOVALNET_SEPA', 'NOVALNET_GUARANTEED_SEPA', 'NOVALNET_INSTALMENT_SEPA'].indexOf(selectedPaymentMethodID) > -1) {
                if (paramsMap[paymentType + '_save_payment_details'].value && (paramsMap[paymentType + '_saved_token'].value === 'new_account_details' || !paramsMap[paymentType + '_saved_token'].value)) {
                    paymentInstrument.custom.novalnetSavePaymentData = true;
                } else if (!empty(paramsMap[paymentType + '_saved_token'].value) && paramsMap[paymentType + '_saved_token'].value !== 'new_account_details') {
                    paymentInstrument.custom.novalnetSavedToken = paramsMap[paymentType + '_saved_token'].value;
                }
            }

            if (['NOVALNET_GUARANTEED_INVOICE', 'NOVALNET_GUARANTEED_SEPA', 'NOVALNET_INSTALMENT_SEPA', 'NOVALNET_INSTALMENT_INVOICE'].indexOf(selectedPaymentMethodID) > -1) {
                paymentInstrument.custom.novalnetCustomerDob = paramsMap[paymentType + '_dob'].stringValue;
            }
        });
        Transaction.commit();
    } catch (e) {
        Transaction.rollback();
        error = true;
        serverErrors.push(e.message);
    }

    return { fieldErrors: [], serverErrors: serverErrors, error: error };
}
/**
 * Verifies the required information for billing form is provided.
 * @param {Object} req - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewFormData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
*/
function processForm(req, paymentForm, viewFormData) {
    var viewData = viewFormData;

    viewData.paymentMethod = {
        value: paymentForm.paymentMethod.value,
        htmlName: paymentForm.paymentMethod.value
    };

    return {
        error: false,
        viewData: viewData
    };
}

/**
 * Authorizes a payment
 * @param {number} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
 *      payment method
 * @return {Object} returns an error object
 */
function Authorize(order, paymentInstrument, paymentProcessor) {

    Transaction.begin();
    Transaction.wrap(function () {
        paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
    });
    Transaction.commit();

    var data = novalnetHelper.getPaymentRequestObject(order, paymentInstrument);

    var paymentUrl = novalnetHelper.getPaymentUrl(paymentInstrument);

    var callResult = novalnetService.getNovalnetService(paymentUrl).call(JSON.stringify(data));

    if (paymentInstrument.custom.novalnetSavePaymentData) {
        Transaction.begin();
        Transaction.wrap(function () {
            order.custom.novalnetSavePaymentData = true;
        });
        Transaction.commit();
    }

    novalnetHelper.clearPaymentData(paymentInstrument);

    if (callResult.isOk() === false) {
        novalnetHelper.debugLog(callResult.getErrorMessage());
        return {
            error: true,
            statusText: callResult.getErrorMessage()
        };
    }

    var resultObject = novalnetHelper.getFormattedResult(callResult.object);

    var error = resultObject.result.status !== 'SUCCESS';

    return { error: error, novalnetPaymentResponse: resultObject };
}


/**
 * Save the credit card information to login account if save card option is selected
 * @param {Object} req - The request object
 * @param {dw.order.Basket} basket - The current basket
 * @param {Object} billingData - payment information
 */
function savePaymentInformation(req, basket, billingData) { // eslint-disable-line no-unused-vars

}

/**
 * validates guarantee payment
 * @param {dw.order.Basket} basket - The current basket
 * @param {string} birthdate - Endcustomer birthdate
 * @param {integer} minAmount - Minimum order amount for guaranteed payment
 * @return {Array} Error Message
 */
function validateGuaranteePayment(basket, birthdate, minAmount) {
    var error = [];
    var orderAmount = Math.round(basket.totalGrossPrice * 100);
    var formattedAmount = novalnetHelper.getFormattedAmount(minAmount, 'EUR');
    if (basket.getCurrencyCode() !== 'EUR') {
        error.push(Resource.msg('novalnet.guarantee.currency.error', 'novalnet', null));
    }

    if (!basket.getBillingAddress().isEquivalentAddress(basket.getDefaultShipment().getShippingAddress())) {
        error.push(Resource.msg('novalnet.guarantee.address.error', 'novalnet', null));
    }

    var dateOfBirth = birthdate.split('.');

    var formatedDob = new Date(dateOfBirth[2], (dateOfBirth[1] - 1), dateOfBirth[0]);

    // calculate month difference from current date in time
    var month_diff = Date.now() - formatedDob.getTime();

    // convert the calculated difference in date format
    var age_dt = new Date(month_diff);

    // extract year from date
    var year = age_dt.getUTCFullYear();

    // now calculate the age of the user
    var age = Math.abs(year - 1970);

    if (age < 18) {
        error.push(Resource.msg('novalnet.guarantee.age.error', 'novalnet', null));
    }

    if (!(['AT', 'DE', 'CH'].indexOf(basket.getBillingAddress().getCountryCode().value) > -1)) {
        error.push(Resource.msg('novalnet.guarantee.country.error', 'novalnet', null));
    }

    if (orderAmount < minAmount) {
        error.push(Resource.msgf('novalnet.guarantee.amount.error', 'novalnet', null, formattedAmount));
    }

    return error;
}

exports.Handle = Handle;
exports.Authorize = Authorize;
exports.processForm = processForm;
