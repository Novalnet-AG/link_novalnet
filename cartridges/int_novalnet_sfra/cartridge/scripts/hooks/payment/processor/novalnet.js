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
            
            // create payment instrument
            var paymentInstrument = basket.createPaymentInstrument(
                selectedPaymentMethodID,
                basket.totalGrossPrice
            );
            
            paymentInstrument.custom.novalnetPaymentName = '';
            var errorMsg = "";
            var selectedPaymentData = paramsMap.nn_selected_payment_data.stringValue;
            var paymentDetails = paramsMap.nn_payment_details.stringValue;
            
            if(empty(selectedPaymentData)) {
				errorMsg = "Error";
			}
			else {
				paymentInstrument.custom.novalnetSelectedPaymentData = selectedPaymentData;
				selectedPaymentData = JSON.parse(selectedPaymentData);
				
				paymentInstrument.custom.novalnetPaymentName = selectedPaymentData.payment_details.name;
				var paymentType = selectedPaymentData.payment_details.type;
				
				if(paymentDetails) {
					paymentInstrument.custom.novalnetPaymentDetails = paymentDetails;
					paymentDetails = JSON.parse(paymentDetails);
					
					if(paymentDetails.result.status != 'SUCCESS') {
						errorMsg = paymentDetails.result.message;
					}
				}
			}
			
			if(!empty(errorMsg)) {
				error = true;
				serverErrors.push(errorMsg);
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
	
	var nnPaymentDetails = JSON.parse(paymentInstrument.custom.novalnetPaymentDetails);
	var bookingDetails = nnPaymentDetails.booking_details;
	
	var paymentAction = !empty(bookingDetails.payment_action) ? bookingDetails.payment_action : '';
    var paymentUrl = novalnetHelper.getPaymentUrl(paymentAction);

    var callResult = novalnetService.getNovalnetService(paymentUrl).call(JSON.stringify(data));

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

exports.Handle = Handle;
exports.Authorize = Authorize;
exports.processForm = processForm;
