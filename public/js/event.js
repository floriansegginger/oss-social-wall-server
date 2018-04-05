$(document).ready(function () {
  function updatePreview (e) {
    var selector = $(this).attr('data-control-update-selector');
    var property = $(this).attr('data-control-update-property');
    if ($(this).attr('data-control-type') === 'color-picker')
      var val = $(this).data('colorpicker').color.toHex();
    else
      var val = $(this).val();

    if ($(this).attr('data-control-update-calc')) {
      var calcValue = $(this).attr('data-control-update-calc')
      val = eval(calcValue);
    }

    $('' + selector).css('' + property, val);
  }

  $('[data-control-type="color-picker"]').each(function () {
    $(this).colorpicker({
      format: 'hex'
    });
  });

  $('[data-control-type="datetime-picker"]').each(function () {
    $(this).datetimepicker({
      locale: 'fr-ch'
    });
  });

  $('[data-control-type="font-picker"]').each(function () {
    $(this).pmwFontSelector({
      callback: function (newFont) {
      }.bind(this)
    });
  });

  $('[data-control-update-selector]').each(function () {
    $(this).on('change changeColor', updatePreview);
    updatePreview.call(this);
  })

  $('#event-form').on('submit', function onSubmit(){
    $('#submit-button').attr('disabled', true);
  });

  $(document).ready(function (){
  $('[type="checkbox"]').each(function () {
    $(this).bootstrapSwitch();
  });
});
})