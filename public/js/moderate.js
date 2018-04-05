// TODO - multiple users on this list => refresh status of buttons and stuff

$(document).ready(function onModerateReady() {
  var amountPerPage = 10;

  var eventContentIds = [];
  var eventContents = {};

  var matches = /\/moderate\/([a-zA-Z0-9]+)/.exec(window.location.href);
  var eventId = matches[1];

  var filters = {};

  function popupCenter(url, title, w, h) {
    // Fixes dual-screen position                         Most browsers      Firefox
    var dualScreenLeft = window.screenLeft != undefined ? window.screenLeft : screen.left;
    var dualScreenTop = window.screenTop != undefined ? window.screenTop : screen.top;

    var width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
    var height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;

    var left = ((width / 2) - (w / 2)) + dualScreenLeft;
    var top = ((height / 2) - (h / 2)) + dualScreenTop;
    var newWindow = window.open(url, title, 'scrollbars=yes, width=' + w + ', height=' + h + ', top=' + top + ', left=' + left);

    // Puts focus on the newWindow
    if (window.focus) {
        newWindow.focus();
    }
  }

  function sortContent(c1, c2) {
    c1 = eventContents[c1];
    c2 = eventContents[c2];
    if (Date.parse(c1.content.date) < Date.parse(c2.content.date))
      return 1;
    else
      return -1;
  }

  function getEventContents() {
    var requestParams = {};
    $.get(
      '/eventContents/' + eventId, 
      requestParams, 
      function onGetContents(fetchedEventContents) {
        $('#loading').hide();
        var newEventContents = false;;
        for (var i in fetchedEventContents) {
          var eventContent = fetchedEventContents[i];
          if (typeof eventContents[eventContent._id] === 'undefined' 
            && matchesFilters(eventContent)) {
            // eventContentsList.push(eventContent);
            newEventContents = true;
            eventContentIds.push(eventContent._id);
            eventContents[eventContent._id] = eventContent;
            // console.log(eventContents);
          } else {
            var oldEC = eventContents[eventContent._id];
            if (oldEC.valid != eventContent.valid) {
              setModerated(eventContent._id, eventContent.valid);
            }
            if (oldEC.pinned != eventContent.pinned) {
              setPinned(eventContent._id, eventContent.pinned);
            }
            if (oldEC.selected != eventContent.selected) {
              setSelected(eventContent._id, eventContent.selected);
            }
            eventContents[eventContent._id] = eventContent;
          }
        }
        if (newEventContents) {
          pushEventContents(eventContentIds.slice().sort(sortContent));
        }
      }
    );
  }

  var doneOnce = false;
  function pushEventContents(newEventContents) {
    if ((newEventContents.length === 0 && doneOnce) || doneOnce) {
      var pageAt = $('#event-contents-pagination').pagination('getSelectedPageNum');
      $('#event-contents-pagination').pagination('destroy');
      $('#event-contents').html('');
    }
    if (newEventContents.length === 0)
      return;
    
    doneOnce = true;
    $('#event-contents-pagination').pagination({
      pageSize: amountPerPage,
      dataSource: newEventContents,
      callback: function (data, pagination) {
        var container = $('#event-contents');
        container.html('');
        for (var i in data) {
          var dom = getEventContentDOM(eventContents[data[i]]);
          container.append(dom);
        }
      }
    });
    if (newEventContents.length > 0)
      $('#event-contents-pagination').pagination('go', pageAt);
  }

  function urlize(url) {
    return url.replace(/((http|https|ftp):\/\/[\w?=&.\/-;#~%-]+(?![\w\s?&.\/;#~%"=-]*>))/g, '<a href="$1">$1</a> ');
  }

  function moderate(eventContentId) {
    $(this).attr('disabled', 'disabled');
    $.post(
      '/moderate/' + eventId,
      {
        valid: (eventContents[eventContentId].valid)?0:1,
        eventContent: eventContentId
      },
      function (res) {
        $(this).removeAttr('disabled');
        setModerated(eventContentId, !eventContents[eventContentId].valid);
        eventContents[eventContentId].valid = !eventContents[eventContentId].valid;
      }.bind(this)
    )
  }

  function setModerated(eventContentId, value) {
    var element = $('[event-content-id="' + eventContentId + '"').find('.btn-moderate');
    if (value) {
      $(element).removeClass('btn-success').addClass('btn-danger').html('Refuser')
    } else {
      $(element).removeClass('btn-danger').addClass('btn-success').html('Valider')
    }
  }

  function pin(eventContentId) {
    $(this).attr('disabled', 'disabled');
    $.post(
      '/moderate/' + eventId,
      {
        pinned: (eventContents[eventContentId].pinned)?0:1,
        eventContent: eventContentId
      },
      function (res) {
        $(this).removeAttr('disabled');
        setPinned(eventContentId, !eventContents[eventContentId].pinned);
        eventContents[eventContentId].pinned = !eventContents[eventContentId].pinned;
      }.bind(this)
    )
  }

  function setPinned(eventContentId, value) {
    var element = $('[event-content-id="' + eventContentId + '"').find('.btn-pin');
    if (value) {
      $(element).addClass('toggled')
    } else {
      $(element).removeClass('toggled')
    }
  }

  function select(eventContentId) {
    $(this).attr('disabled', 'disabled');
    $.post(
      '/moderate/' + eventId,
      {
        selected: (eventContents[eventContentId].selected)?0:1,
        eventContent: eventContentId
      },
      function (res) {
        $(this).removeAttr('disabled');
        setSelected(eventContentId, !eventContents[eventContentId].selected);
        eventContents[eventContentId].selected = !eventContents[eventContentId].selected;
      }.bind(this)
    )
  }

  function setSelected(eventContentId, value) {
    var element = $('[event-content-id="' + eventContentId + '"').find('.btn-select');
    if (value) {
      $(element).addClass('toggled')
    } else {
      $(element).removeClass('toggled')
    }
  }

  function updateFilters() {
    filters = [];
    $('[data-filter]').each(function () {
      var checked = $(this).prop('checked');
      if (!checked)
        return;
      var type = $(this).attr('data-filter-type');
      filters.push({
        type: type,
        active: checked,
        value: $(this).attr('data-filter')
      });
    });
    var filteredEventContents = [];
    for (var i in eventContents) {
      var eventContent = eventContents[i];
      if (matchesFilters(eventContent)) {
        filteredEventContents.push(eventContent._id);
      }
    }
    console.log(filters);
    pushEventContents(filteredEventContents.sort(sortContent));
  }

  function matchesFilters(eventContent) {
    var resultAttributes = true;
    var hasResultSourceTypes = false;
    var resultSourceTypes = true;
    for (var i in filters) {
      var filter = filters[i];
      if (filter.type === 'boolean-attribute') {
        resultAttributes &= eventContent[filter.value];
      } else if (filter.type === 'boolean-attribute-inverted') {
        resultAttributes &= !eventContent[filter.value];
      } else if (filter.type === 'source-type') {
        if (!hasResultSourceTypes) {
          hasResultSourceTypes = true;
          resultSourceTypes = false;
        }
        resultSourceTypes |= (eventContent.content.source.type === filter.value);
      }
    }
    console.log((resultAttributes && resultSourceTypes));
    return (resultAttributes && resultSourceTypes);
  }

  function getEventContentDOM(eventContent) {
    var container = $('<div>').addClass('event-content panel panel-default').attr('event-content-id', eventContent._id);
    if (eventContent.valid) {
      container.addClass('valid');
    }

    var headerContainer = $('<div>').addClass('panel-heading');
    var authorContainer = $('<a>')
      .addClass('author')
      .attr('href', (eventContent.content.author.url)?eventContent.content.author.url:undefined)
      .attr('target', '_blank');
    var pictureContainer = $('<div>').addClass('picture');
    if (eventContent.content.author.photo)
      var picture = $('<img>').attr('src', eventContent.content.author.photo);
    else
      var picture = $('<img>').attr('src', '/img/placeholder-profile-photo.png');
    pictureContainer.append(picture);
    authorContainer.append(pictureContainer);
    authorContainer.append($('<div>').addClass('name').html(eventContent.content.author.name));

    var source = $('<a>')
      .addClass('source')
      .addClass(eventContent.content.source.type)
      .html(' ')
      .attr('href', eventContent.content.source.url?eventContent.content.source.url:undefined)
      .attr('target', '_blank')
      .attr('title', eventContent.content.source.type);
    headerContainer.append(source);
    headerContainer.append(authorContainer);
    container.append(headerContainer);

    var contentContainer = $('<div>').addClass('content panel-body');

    container.append(contentContainer);

    var contentText = $('<div>').addClass('body').html(urlize(eventContent.content.text));
    contentContainer.append(contentText);

    if (eventContent.content.media.length != 0) {
      var mediasContainer = $('<div>').addClass('medias row');
      for (var i = 0; i < eventContent.content.media.length; i++) {
        var media = eventContent.content.media[i];
        var mediaDom = $('<div>').addClass('thumbnail col-xs-3');
        if (media.type === 'image') {
          mediaDom.append($('<img>').attr('src', media.url));
          mediasContainer.append(mediaDom);
        } else if (media.type === 'video') {
          mediaDom.append($('<video>').attr('src', media.url).attr('loop','loop').attr('muted','muted').attr('controls','controls'));
          mediasContainer.append(mediaDom);
        }
      }
      contentContainer.append(mediasContainer);
    }

    var dateText = $('<div>').addClass('content-date');

    dateText
      .append($('<span>').addClass('glyphicon glyphicon-calendar'))
      .append(' ' + new Date(Date.parse(eventContent.content.date)).toLocaleString('fr-CH'));
    contentContainer.append(dateText);

    var actionsContainer = $('<div>').addClass('panel-footer');

    var moderateButton = $('<div>').addClass('btn btn-lg btn-moderate');
    if (!eventContent.valid) {
      moderateButton.addClass('btn-success').append('Valider');
    } else {
      moderateButton.addClass('btn-danger').append('Refuser');
    }
    moderateButton.on('click', moderate.bind(moderateButton, eventContent._id));
    actionsContainer.append(moderateButton);

    if (eventContent.content.source.type === 'twitter') {
      actionsContainer.append(
        $('<a>')
          .addClass('btn btn-lg btn-default')
          .append($('<i>')
          .addClass('icon-retweet'))
          .append(' Retweet')
          .attr('href', 'https://twitter.com/intent/retweet?tweet_id=' + eventContent.content.source.id)
          .on('click', function (e){
            popupCenter($(this).attr('href'),'_blank', '500', '300');
            // window.open($(this).attr('href'), '_blank', 'width=500,height=300,fullscreen=no,left=300,');
            return false;
          })
      );
    }
    if (eventContent.content.source.type === 'facebook') {
      actionsContainer.append(
        $('<a>')
          .addClass('btn btn-lg btn-default')
          .append($('<i>')
          .addClass('icon-share'))
          .append(' Partager')
          .attr('href', 'https://facebook.com/sharer/sharer.php?u=' + encodeURI(eventContent.content.source.url))
          .on('click', function (e){
            popupCenter($(this).attr('href'),'_blank', '500', '300');
            // window.open($(this).attr('href'), '_blank', 'width=500,height=300,fullscreen=no,left=300,');
            return false;
          })
      );
    }

    var pinButton = $('<div>').attr('title','Epingler').addClass('btn btn-lg btn-default btn-pin').append($('<i>').addClass('glyphicon glyphicon-pushpin'));
    if (eventContent.pinned) {
      pinButton.addClass('toggled');
    }
    pinButton.on('click', pin.bind(pinButton, eventContent._id));
    actionsContainer.append(pinButton);

    var selectButton = $('<div>').attr('title','Selectionner').addClass('btn btn-lg btn-default btn-select').append($('<i>').addClass('glyphicon glyphicon-fullscreen'));
    if (eventContent.selected) {
      selectButton.addClass('toggled');
    }
    selectButton.on('click', select.bind(selectButton, eventContent._id));
    actionsContainer.append(selectButton);

    container.append(actionsContainer);

    return container;
  }

  getEventContents();
  setInterval(getEventContents, 1000);

  $(document).on('click', '.filters', function (e) {
    e.stopPropagation();
  });

  $('[data-filter]').each(function() {
    $(this).on('change', updateFilters);
  })

  $('[name="moderate-new-content"]').each(function () {
    $(this).bootstrapSwitch({
      onSwitchChange: function (e, value) {
        $(this).bootstrapSwitch('disabled', true);
        $.post('/moderate/' + eventId, {moderateNewContent: value?1:0}, function () {
          $(this).bootstrapSwitch('disabled', false);
        }.bind(this)).fail(function () {
          $(this).bootstrapSwitch('disabled', false);
          $(this).bootstrapSwitch('state', !value, true);
        }.bind(this))
      }.bind(this)
    });
  });
});