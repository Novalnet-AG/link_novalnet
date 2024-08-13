/* global jQuery */

var novalnetConfig = (function ($) {
    function sendApiRequest() {
        var productActivationKey = $('#product-activation-key').val();
        var paymentAccessKey = $('#payment-access-key').val();
        if($.trim(productActivationKey) != '' && $.trim(paymentAccessKey) != '') {
            
            $('#tariff option').remove();
            $('.nn_testmode_box').hide();
            $('#config-loading-gif').removeClass('hide-content');
            $('#configuration-content').addClass('hide-content');
            
            $.ajax({
                url: $('#nn-ajax-url').val(),
                data: {productActivationKey: productActivationKey, paymentAccessKey: paymentAccessKey},
                dataType: 'json',
                error: function (jqXHR, textStatus, errorThrown) {
                    alert(textStatus);
                    $('#config-loading-gif').addClass('hide-content');
                    $('#configuration-content').removeClass('display', 'none');
                },
                success: function (data) {
                    if (data && data.statusText) {
                        var response = JSON.parse(data.response);
                        if(response.result.status_code == 100) {
                            if(response.merchant.test_mode == 1) {
                                $('.nn_testmode_box').show();
                            }
                            if (typeof response.merchant.client_key !== 'undefined' && response.merchant.client_key !== '') {
                                $('#client-key').val(response.merchant.client_key);
                            }
                            
                            var tariffDropdown = $('#tariff');
                            var selectedTariff = $('#selected-tariff').val();

                            $.each(response.merchant.tariff, function ( key, value ) {
                                tariffDropdown.append($("<option>").attr('value',key).text(value.name));
                            });
                            
                            if(selectedTariff) {
                                $("#tariff option[value="+selectedTariff+"]").attr('selected', 'selected');
                            }
                        }
                        else {
                            alert(response.result.status_text);
                        }
                    } else {
                        alert('An Error occured');
                    }
                    $('#config-loading-gif').addClass('hide-content');
                    $('#configuration-content').removeClass('hide-content');
                }
            });
        }
    }
    return {
        init: function () {
            
            sendApiRequest();
            $('#product-activation-key, #payment-access-key').on('change', function(e) {
                sendApiRequest();
            });
            
            $('#novalnet-configuration-form').submit(function(e) {
                $('.nn_error_box').hide();
                var productActivationKey = $('#product-activation-key').val();
                var paymentAccessKey = $('#payment-access-key').val();
                if(!productActivationKey || !paymentAccessKey) {
                    $('.nn_error_box').show();
                    event.preventDefault();
                }
                
                var tariff = $('#tariff').val();
                $('#selected-tariff').val(tariff);
            });
            
            
        }
    };
}(jQuery));


 
