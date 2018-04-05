$(document).ready(function (){
  $('[data-confirm]').each(function () {
    $(this).on('click tap', function () {
      if (confirm($(this).attr('data-confirm')) === true) {
        window.location = $(this).attr('href')
      }
      return false;
    });
  })
})