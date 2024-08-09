/* global $ */
/* eslint-disable no-unused-vars, no-undef */
'use strict';

var processInclude = require('base/util');
var scrollAnimate = require('base/components/scrollAnimate');

$(document).ready(function () {
    const novalnetPaymentIframe = new NovalnetPaymentForm();

	var walletparams = $('#nn_wallet_params').val();

	var lineItems = [];
	if(typeof walletparams != 'undefined' && walletparams != '') {
		walletparams = JSON.parse(walletparams);
		if(walletparams.lineItems) {
			lineItems = walletparams.lineItems;
		}
	}

	const paymentFormRequestObj = {
		iframe: '#novalnet_paymentform_iframe',
		initForm : {
			orderInformation : {
				lineItems: lineItems
			},
			uncheckPayments: true,
			setWalletPending: true,
			showButton : false
		}
	};
			
	/**
	 * Initiate the payment form IFRAME
	 */
	novalnetPaymentIframe.initiate(paymentFormRequestObj);

	/**
	 * Payment form validation result callback
	 */
	novalnetPaymentIframe.validationResponse((data) => {});

	/**
	 * Gives selected payment method
	 */
	novalnetPaymentIframe.selectedPayment((data) => {
		$('#nn_payment_details').val(null);
		$('#nn_selected_payment_data').val(JSON.stringify(data));
	});

	novalnetPaymentIframe.walletResponse({
		onProcessCompletion: (response) => {
			if (response.result.status == 'SUCCESS') {
				$('#nn_payment_details').val(JSON.stringify(response));
				$('.submit-payment').click();
				return {status: 'SUCCESS', statusText: 'successfull'};
			} else {
				return {status: 'FAILURE', statusText: 'failure'};
			}
		}
	});
		
	document.querySelector('button.submit-payment').addEventListener('click', function (event) {
        var activeTabId = $('.tab-pane.active').attr('id');
        var selectedPaymentMethod = $('#dwfrm_billing .' + activeTabId + ' .payment-form-fields input.form-control').val();

        if (selectedPaymentMethod === 'NOVALNET_PAYMENT') {
			event.preventDefault();
			event.stopImmediatePropagation();
			novalnetPaymentIframe.getPayment((data) => {
				$('#nn_payment_details').val(JSON.stringify(data));
				if(data) {
					if(data.result.status == 'ERROR') {
						$('.error-message').show();
						$('.error-message-text').text(data.result.message);
						scrollAnimate($('.error-message'));
						return true;
					}
				}
				$('.submit-payment').click();
				return true;
			});
		}
    });
	
    processInclude(require('./novalnet/novalnetPaymentForm'));
});
