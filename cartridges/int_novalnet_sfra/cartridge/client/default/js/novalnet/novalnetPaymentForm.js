/* global $ */
/* eslint-disable no-unused-vars, no-undef */

'use strict';

var scrollAnimate = require('base/components/scrollAnimate');

function loadNovalnetPaymentForm() {
	var billingForm = document.getElementById('dwfrm_billing');
	var firstName = billingForm.querySelector('input[name$="_firstName"]').value;
	var lastName = billingForm.querySelector('input[name$="_lastName"]').value;
	var address1 = billingForm.querySelector('input[name$="_address1"]').value;
	var address2 = billingForm.querySelector('input[name$="_address2"]').value;
	
	var email = '';
	if(billingForm.querySelector('input[name$="_email"]') != null) {
		email = billingForm.querySelector('input[name$="_email"]').value;
	}
	
	var street = address1;
	if(address2 != '' && typeof(address2) != undefined) {
	  street += address2;
	}
	
	var city = billingForm.querySelector('input[name$="_city"]').value;
	var zip = billingForm.querySelector('input[name$="_postalCode"]').value;
	var countryCode = billingForm.querySelector('select[name$="_country"]').value;
	var state = '';
	
	if(billingForm.querySelector('input[name$="_stateCode"]')) {
		state = billingForm.querySelector('input[name$="_stateCode"]').value;
	}
	
	if(billingForm.querySelector('select[name$="_stateCode"]')) {
		state = billingForm.querySelector('select[name$="_stateCode"]').value;
	}
	
	if(firstName == '' || lastName == '' || street == '' || city == '' || zip == '' || countryCode == '') {
		return;
	}
	
	$.ajax({
		url: $('#nn_paymentfrom_ajax_url').val(),
		data: {'firstName': firstName, 'lastName': lastName, 'email': email, 'street': street, 'city': city, 'zip': zip, 'countryCode': countryCode, 'state': state},
		dataType: 'json',
		error: function (jqXHR, textStatus, errorThrown) {
			$('.error-message').show();
			$('.error-message-text').text(errorThrown);
			scrollAnimate($('.error-message'));
			return true;
		},
		success: function (data) {
			if(data.result.status == "SUCCESS") {
			  $('#novalnet_paymentform_iframe').attr('src', data.result.redirect_url);
			}
			else {
			  $('.error-message').show();
			  $('.error-message-text').text(data.result.message);
			  scrollAnimate($('.error-message'));
			  return true;
			}
		}
	});
}

module.exports = {
	initialize: function () {
		loadNovalnetPaymentForm();
		var form = document.getElementById('dwfrm_billing');
		if(form) {
			form.addEventListener('change', function() {
				loadNovalnetPaymentForm();
			});
		}
	},
	methods: {
		loadNovalnetPaymentForm: loadNovalnetPaymentForm
	}
};
