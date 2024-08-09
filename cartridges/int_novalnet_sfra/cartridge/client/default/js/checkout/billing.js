/* global $ */
/* eslint-disable no-cond-assign, no-void */

'use strict';

var base = require('base/checkout/billing');
var addressHelpers = require('base/checkout/address');
var currencyFormatter = require('currency-formatter');
var novalnetPaymentForm = require('../novalnet/novalnetPaymentForm');

/**
 * updates the billing address form values within payment forms
 * @param {Object} order - the order model
 */
function updateBillingAddressFormValues(order) {
    var billing = order.billing;
    if (!billing.billingAddress || !billing.billingAddress.address) return;

    var form = $('form[name=dwfrm_billing]');
    if (!form) return;

    $('input[name$=_firstName]', form).val(billing.billingAddress.address.firstName);
    $('input[name$=_lastName]', form).val(billing.billingAddress.address.lastName);
    $('input[name$=_address1]', form).val(billing.billingAddress.address.address1);
    $('input[name$=_address2]', form).val(billing.billingAddress.address.address2);
    $('input[name$=_city]', form).val(billing.billingAddress.address.city);
    $('input[name$=_postalCode]', form).val(billing.billingAddress.address.postalCode);
    $('select[name$=_stateCode],input[name$=_stateCode]', form)
        .val(billing.billingAddress.address.stateCode);
    $('select[name$=_country]', form).val(billing.billingAddress.address.countryCode.value);
    $('input[name$=_phone]', form).val(billing.billingAddress.address.phone);
    $('input[name$=_email]', form).val(order.orderEmail);
    
    var stage = 'stage';
	var checkoutStage = new RegExp(`[?&]${encodeURIComponent(stage)}=([^&]*)`).exec(window.location.search);
    checkoutStage = decodeURIComponent(checkoutStage[1]);
    if(checkoutStage == 'shipping' || checkoutStage == 'customer') {
		novalnetPaymentForm.methods.loadNovalnetPaymentForm();
	}
}

/**
 * clears the billing address form values
 */
function clearBillingAddressFormValues() {
    updateBillingAddressFormValues({
        billing: {
            billingAddress: {
                address: {
                    countryCode: {}
                }
            }
        }
    });
}

/**
 * Updates the billing information in checkout, based on the supplied order model
 * @param {Object} order - checkout model to use as basis of new truth
 * @param {Object} customer - customer model to use as basis of new truth
 * @param {Object} [options] - options
 */
function updateBillingInformation(order, customer) {
    base.methods.updateBillingAddressSelector(order, customer);

    // update billing address form
    updateBillingAddressFormValues(order);

    // update billing address summary
    addressHelpers.methods.populateAddressSummary(
        '.billing .address-summary',
        order.billing.billingAddress.address
    );

    // update billing parts of order summary
    $('.order-summary-email').text(order.orderEmail);

    if (order.billing.billingAddress.address) {
        $('.order-summary-phone').text(order.billing.billingAddress.address.phone);
    }
}

/**
 * Updates the payment information in checkout, based on the supplied order model
 * @param {Object} order - checkout model to use as basis of new truth
 */
function updatePaymentInformation(order) {
    var paymentInstrument;
    var nnOrderCurrency = $('#nn_order_currency').val();
    var nnOrderAmount = order.priceTotal;

    if (Number.isNaN(Number(nnOrderAmount))) {
        nnOrderAmount = currencyFormatter.unformat(nnOrderAmount, { code: nnOrderCurrency });
    }
    $('#nn_order_amount').val(nnOrderAmount);

    if ((paymentInstrument = order.billing.payment.selectedPaymentInstruments) === null || paymentInstrument === void 0 ? void 0 : paymentInstrument.length) {
        var selectedPaymentInstrument = order.billing.payment.selectedPaymentInstruments[0];
        var novalnetPaymentName =  selectedPaymentInstrument.paymentMethodName;
        var nnPaymentdetails = $('#nn_selected_payment_data').val();
        
        if(nnPaymentdetails) {
			nnPaymentdetails = JSON.parse(nnPaymentdetails);
			novalnetPaymentName = nnPaymentdetails.payment_details.name;
		}

        document.querySelector('.payment-details').innerHTML = '<div><span>' + novalnetPaymentName + '</span></div>';
    }
}

base.methods.updateBillingAddressFormValues = updateBillingAddressFormValues;
base.methods.clearBillingAddressFormValues = clearBillingAddressFormValues;
base.methods.updateBillingInformation = updateBillingInformation;
base.methods.updatePaymentInformation = updatePaymentInformation;

base.clearBillingForm = function () {
    $('body').on('checkout:clearBillingForm', function () {
        clearBillingAddressFormValues();
    });
};

module.exports = base;
