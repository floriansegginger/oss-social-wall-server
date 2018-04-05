(function($) {
  'use strict';
  $.fn.pmwFontSelector = function(options) {
    var settings = $.extend({
      fonts: [
        'Roboto',
        'Playfair Display',
        'Work Sans',
        'Rubik',
        'Cormorant Garamond',
        'Libre Franklin',
        'Space Mono',
        'Fira Sans',
        'Eczar',
        'Alegreya Sans',
        'Alegreya',
        'Karla',
        'Lora',
        'Source Sans Pro',
        'Source Serif Pro',
        'Roboto Slab',
        'Poppins',
        'BioRhyme',
        'Archivo Narrow',
        'Libre Baskerville',
        'Crimson Text',
        'Chivo',
        'Bitter',
        'Raleway',
        'Open Sans',
        'Permanent Marker',
        'Gloria Hallelujah',
        'Reenie Beanie',
        'Sue Ellen Francisco'
      ],
      element: null,
      callback: function(font) {
        return;
      }
    }, options);

    for (var i in settings.fonts) {
      var loader = $('<link>')
        .attr('rel', 'stylesheet')
        .attr('href', '//fonts.googleapis.com/css?family='
          + settings.fonts[i].replace(/ /g, '+')
      );
      $('body').append(loader);
    }

    settings.fonts.sort();
    this.find(".fonts-list").empty();

    for (var i in settings.fonts) {
      var newFont = $("<li>");
      newFont.attr("role", "presentation");
      var newFontLink = $("<a>");
      newFont.append(newFontLink);
      newFontLink.attr("role", "menuitem")
      newFont.addClass("font-selector-font");
      if (this.find(".font-box").css('font-family') == settings.fonts[i]) {
        newFont.addClass("selected");
      }
      newFontLink.css('font-family', settings.fonts[i]);
      newFontLink.html(settings.fonts[i]);
      newFont.data({ callback: settings.callback, parent: this, font: settings.fonts[i] });
      newFont.click(function(parent) {
        $(this).data("parent").find(".fonts-list-font").each(function() {
          $(this).removeClass("selected");
        });
        $(this).addClass("selected");
        $(parent).find(".font-box")
          .html($(this).data("font"))
          .css("font-family", $(this).data("font"));
        $(parent).find('input').val($(this).data("font"));
        $(parent).find('input').change();
        $(parent).find(".fonts-list-font").each(function (){
          if ( $(this).hasClass('selected') && $(this).css("font-family") != newFont ){
            $(this).removeClass("selected");
          }
        });
        $(this).data("callback")($(this).data("font"));
      }.bind(newFont, this));
      this.find(".fonts-list").append(newFont);

      $

      $(this).find(".font-box")
        .html($(this).find('input').val())
        .css("font-family", $(this).find('input').val());
    }
  };
}(jQuery));
