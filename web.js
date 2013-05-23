/*
pyplot - python based data plotting tools
created for DESY Zeuthen
Copyright (C) 2012  Adam Lucke

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

/** ajax default settings */
$.ajaxSetup({
    url : 'webplot.py',
    dataType : 'json',
    type : 'post'
});

var speed = 'fast';

/** add .startsWith() function to string */
if ( typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function(str) {
        return this.indexOf(str) == 0;
    };
}

/** add .foreach() to arrays */
Array.prototype.foreach = function(callback) {
    for (var k = 0; k < this.length; k++) {
        callback(k, this[k]);
    }
}
var tables_and_vars = null;

/** get available HDF5 from server and return new DOM element */
function sourcesBox() {
    var datasetbox, experimentbox;
    $.ajax({
        async : false,
        data : {
            a : 'list'
        },
        success : function(data) {
            // console.debug(data);
            // store HDF5- infos globally
            tables_and_vars = data;

            experimentbox = $('<select>').attr('name', 'experiment*');
            $('<option>').text('(bitte Experiment auswählen)').appendTo(experimentbox);
            datasetbox = $('<select>').attr('name', 's*');
            $('<option>').text('(bitte Datensatz auswählen)').appendTo(datasetbox);

            $.each(data, function(id, info) {
                // console.debug(id+' -- '+info);
                var m = id.match(/(.*):(.*)/);
                // filename incl. path
                var file = m[1];
                // filename only, w/o path and extension
                var filename = file.match(/(.*)\/(.+)\.h5/i)[2];
                // name of the table
                var tabname = m[2];

                // add a selectable option for this dataset and table
                var opt = $('<option>').text(filename + ' - ' + info[0]).val(id).appendTo(datasetbox);

                var experiment = file.match(/(.+?\/)*(.*?)\/.+?/)[2];
                console.debug('experiment = ' + experiment + ' / ' + id);
                opt.addClass('ex-' + experiment);
                if (experimentbox.find('option').filter(function() {
                    return $(this).text() == experiment;
                }).size() < 1) {
                    var ex = $('<option>').text(experiment).val(experiment).appendTo(experimentbox);
                    if (experiment.startsWith('x'))
                        ex.addClass('expert');
                }

                if (opt.text().startsWith('x'))
                    opt.addClass('expert');
            });
        },
        error : function(xhr, text, error) {
            alert(xhr['responseText']);
        }
    });

    var experimentlabel = $('<label>').addClass('required').attr('data-help', 'Hier wird der zu verwendende Experiment ausgewählt.').append('Experiment').append(experimentbox);
    var datasetlabel = $('<label>').addClass('required').attr('data-help', 'Hier wird der zu verwendende Datensatz ausgewählt.').append('Datensatz').append(datasetbox);
    return $('<div class="datasetselector">').append(experimentlabel).append(datasetlabel);
}

/** renumber form field names after add/del of plot */
function renumberPlots() {
    ch = $('#plots').children('.plot');
    ch.each(function(i) {
        plot = $(this);
        plot.find('legend').text('Diagramm ' + (i + 1));
        plot.find('[name]').each(function() {
            e = $(this);
            e.attr('name', e.attr('name').replace(/\*|\d/, '' + i));
        });
        // plot.find('.delplot').prop('disabled', ch.length <= 1);
    });
    if (ch.length >= 4)
        $('#addplot').hide();
    else
        $('#addplot').show();
}

function hide(s) {
    s = $(s);
    //	console.debug('hide: '+s.html());
    s.hide(speed).find(':input').prop('disabled', true);
    return s;
}

function show(s) {
    s = $(s);
    //	console.debug('show: '+s.html());
    s.show(speed).find(':input').prop('disabled', false);
    return s;
}

/** disable/enable fields according to detaillevel and plotmode */
function updateHiddenFields() {
    mode = $(':input[name="detaillevel"]').val();
    console.debug('detaillevel=' + mode);
    if (mode == 'expert') {
        tohide = 'nothing';
    } else if (mode == 'advanced') {
        tohide = '.expert';
    } else {
        tohide = '.expert, .advanced';
    }
    console.debug('tohide=' + tohide);

    visible = $('.expert,.advanced');
    hidden = $(tohide);

    // twin axes global fields
    $.each(['x', 'y'], function(i, v) {
        twinv = $('.twin' + v);
        visible = visible.add(twinv);
        if ($(':input[name^="tw"] option:selected[value="' + v + '"]').size() == 0) {
            hidden = hidden.add(twinv);
        }
    });

    // field in individual plot settings
    $('.plot').each(function() {
        plot = $(this);
        // mode dependant fields
        var options = plot.find('[class*="t-"]');
        // selects all options
        var plotmode = '.t-' + plot.find(':input[name^="m"]').val();
        console.debug('plotmode=' + plotmode);
        visible = visible.add(options);
        hidden = hidden.add(options.not(plotmode));

        // shift and weight
        r = plot.find(':input[name^="rs"], :input[name^="rc"]').parents('label');
        var windowempty = plot.find(':input[name^="rw"]').val().replace(/\s+/, '') == '';
        visible = visible.add(r);
        if (windowempty) {
            hidden = hidden.add(r);
        }

        // experiment/dataset
        var experiment = '' + plot.find(':input[name^="experiment"]').val();
        console.debug('experiment=' + experiment);
        if (experiment.match(/\s+/))
            experiment = '';
        console.debug('experiment=' + experiment);
        var datasets = plot.find('option[class*="ex-"]');
        visible = visible.add(datasets);
        hidden = hidden.add(datasets.not('.ex-' + experiment));
    });

    visible = visible.not(hidden);
    console.debug('visible=' + visible.size() + ' hidden=' + hidden.size());
    show(visible);
    hide(hidden);
}

/** add interactive handlers */
function addHandlers(plot) {
    // display available vars on certain input fields
    plot.find(':input[name^="x"],:input[name^="y"],:input[name^="z"],:input[name^="c"]').focusin(function() {
        p = $(this).parents('.plot');
        k = p.find('select[name^="s"]').val();
        $.each(tables_and_vars, function(kk, vv) {
            if (kk == k) {
                vars = $('#vars').empty();
                for ( i = 0; i < vv[1].length; ++i) {
                    if (i > 0)
                        vars.append(', ');
                    vars.append('' + vv[1][i]);
                    if (vv[2][i].length > 0)
                        vars.append(' [' + vv[2][i] + ']');
                }
                if (p.find(':input[name^="rw"]').val().replace(/\s+/, '') != '')
                    vars.append(', rate, count, weight');
                $('#varsbox').show();
                return false;
            }
        });
    }).focusout(function() {
        $('#varsbox').hide();
    });

    // delete plot button
    plot.find('.delplot').click(function() {
        $(this).parents('.plot').remove();
        renumberPlots();
    });

    // plot mode dropdown box
    plot.find(':input[name^="m"]').change(function() {
        updateHiddenFields();
    });

    // rate window field
    plot.find(':input[name^="rw"]').keyup(function() {
        updateHiddenFields();
    });

    // twin axes dropdown box
    plot.find(':input[name^="tw"]').change(function() {
        updateHiddenFields();
    });

    // experiment/datasets
    plot.find(':input[name^="experiment"]').change(function() {
        updateHiddenFields();
        $(this).parents('.datasetselector').find(':input[name^="s"] option:first').prop('selected', true);
    });

    updateHiddenFields();

    return plot;
}

/** Hilfe initialisieren */
function initHelp(el) {
    $(el).find('label[data-help]').each(function() {
        help = $(this).attr('data-help');
        if (help != '')
            //			$('<img>').attr('src', 'img/help.png').attr('title', help).addClass('help').prependTo(this).hide();
            $(this).find(':input').attr('title', help);

    }).hover(function() {
        $(this).find('.help').show();
    }, function() {
        $(this).find('.help').hide();
    });
}

function getSettings() {
    s = new Object();
    $('form :input:enabled:not(:button):not(:reset):not(:submit)[name]').each(function() {
        field = $(this);
        name = field.attr('name');
        if (field.is(':checkbox')) {
            s[name] = field.prop('checked');
        } else {
            val = field.val();
            s[name] = field.val();
        }
    });
    s['plots'] = $('.plot').size();
    return s;
}

function setSettings(s) {
    $('.plot').remove();
    for (var i = 0; i < s.plots; ++i)
        addPlot();
    $.each(s, function(k, v) {
        field = $(':input[name="' + k + '"]');
        if (field.is(':checkbox'))
            field.prop('checked', v);
        else
            field.val(v);
    });
    updateHiddenFields();
}

function initSettingsLoader() {
    $(':button[name="load"]').click(function() {
        try {
            s = JSON.parse($(':input[name="settingstoload"]').val());
            $('nav a[href="#settings"]').click();
            setSettings(s);
            // $('form').submit();
        } catch (e) {
            alert('Fehler beim Laden der Einstellungen: ' + e);
        }
    });
}

function initExpertMode() {
    // add handler to expertmode checkbox
    $('select[name="detaillevel"]').click(updateHiddenFields);
    updateHiddenFields();
}

var templatePlot;

function initPlots() {
    // add source dropdown box to plot template, filled with available hdf5 data
    // files
    sourcesBox().prependTo('.plot');
    // detach the plot template (to be added by pressing 'add plot' button)
    templatePlot = $('.plot').detach();

    $('#varsbox').hide();

    $('#addplot').click(addPlot);

    try {
        setSettings(JSON.parse($.cookie('lastsettings')));
    } catch (e) {
        addPlot();
    }
}

function addPlot() {
    if ($('.plot').size() == 0)
        newplot = templatePlot.clone()
    else
        newplot = $('.plot:first').clone();
    newplot.appendTo('#plots');
    $('#addplot').appendTo('#plots');
    renumberPlots();
    addHandlers(newplot);
    initHelp(newplot);
    updateHiddenFields();
}

function initScroll() {
    // let navbar smoothscroll
    $('nav a').smoothScroll({
        offset : -15
    });

    // detach navbar on scroll down
    $(window).scroll(function() {
        scroll = $(this).scrollTop();
        nav = $('nav:not(.fixed)');
        if (nav.size() > 0)
            navoffset = nav.offset();
        if (scroll > navoffset.top) {
            $('nav').addClass('fixed').next().css('margin-top', $('nav').height());
        } else {
            $('nav').removeClass('fixed').next().css('margin-top', '0');
        }

        pos = scroll + $('nav').height();
        $('nav a').removeClass('active').each(function() {
            target = $(this).attr('href');
            offset = $(target).offset();
            height = $(target).height();

            if (offset.top <= pos && pos < offset.top + height) {
                $(this).addClass('active');
                return false;
            }
        })
    }).scroll();

    // set section size to viewport size
    $(window).resize(function() {
        $('#content > div').css('min-height', $(this).height());
    }).resize();
}

function getSessionID() {
    id = $.cookie('session');
    if (id != null)
        $('#sessionid').val(id);
    else
        newSessionID();
    return $('#sessionid').val();
}

function newSessionID() {
    $.ajax({
        async : false,
        data : {
            a : 'newid',
        },
        dataType : 'text',
        success : function(data, status, xhr) {
            $('#sessionid').val(data);
            $.cookie('session', data);
        }
    });
}

function initSavedPlots() {
    getSessionID();
    $('#newid').click(function() {
        newSessionID();
        loadPlots();
    });
    $('#loadid').click(function() {
        id = $('#sessionid').val();
        if (id.length < 8) {
            alert('Die Session-ID muss mindestens 8 Zeichen lang sein.');
            return;
        }
        $.cookie('session', id);
        loadPlots();
    });
    $('#sessionid').keyup(function(e) {
        if (e.keyCode == 13) {
            $('#loadid').click();
        }
    });
    loadPlots();
}

function savePlots() {
    o = new Object();
    o.savedPlots = [];
    $('.savedplot').each(function() {
        o.savedPlots.push($(this).data('settings'));
    });
    $.ajax({
        async : false,
        data : {
            a : 'save',
            id : getSessionID(),
            data : JSON.stringify(o)
        },
        // success : function(data, status, xhr) {
        // $('#debug').empty().append('' +
        // o).append('<br>').append(''+status).append('<br>').append(''+xhr);
        // },
        error : function(xhr, text, error) {
            alert('saving plots failed ' + xhr['responseText']);
        }
    });
}

function loadPlots() {
    $('#savedplots').empty();
    $.ajax({
        async : false,
        data : {
            a : 'load',
            id : getSessionID(),
        },
        success : function(o, status, xhr) {
            // $('#debug').empty().append('' + o).append('<br>').append('' +
            // status).append('<br>').append('' + xhr);
            $.each(o.savedPlots, function(i, s) {
                addPlotToSaved(s);
            });
        },
        // error : function(xhr, text, error) {
        // alert('loading plots failed ' + xhr['responseText'] + ' ' + text + ' ' +
        // error);
        // }
    });
}

function bindColorbox() {
    $('#savedplots .savedplot').unbind().colorbox({
        photo : true,
        maxWidth : '90%',
        maxHeight : '90%',
        rel : 'plots',
        title : 'gespeichertes Diagramm'
    });
}

function addPlotToSaved(settings) {
    $('<div>').appendTo('#savedplots').append($('<img src="' + settings.url + '" href="' + settings.url + '" title="' + settings.t + '">').addClass('savedplot').data('settings', settings))
    // add delete button
    .append($('<img>').attr('src', 'img/cross.png').attr('title', 'Plot löschen').addClass('delete').click(function() {
        $(this).parents('.savedplot').remove();
        bindColorbox();
        savePlots();
    }))
    // add load button
    .append($('<img>').attr('src', 'img/arrow_redo.png').attr('title', 'Plot laden').addClass('loadplot').click(function() {
        setSettings($(this).parent().find('.savedplot').data('settings'));
        $('form').submit();
    }));

    bindColorbox();
}

var xhr;

function initSubmit() {
    // hand submission of plot request and reception of the plot
    $('form').submit(function() {
        try {// abort previous request
            xhr.abort();
        } catch (e) {
            // if there was no previous request, ignore errors
        }

        // the form (all input fields) as url query string
        query = $('form').serialize();
        settings = getSettings();
        $.cookie('lastsettings', JSON.stringify(settings));

        // store current plot settings (all input fields) into
        // settings object

        result = $('#result');
        // print status information
        result.empty().append('<p>Plot wird erstellt, bitte warten&hellip;</p><img src="img/bar90.gif">');

        // scroll to plot section
        $('nav a[href="#output"]').click();

        // perform ajax request to get the plot (created on
        // server)
        $('#error').empty();
        xhr = $.ajax({
            data : query,
            success : function(data) {
                result.empty();
                var img;
                // if (Modernizr.svg) {
                    // img = data.svg;
                // } else {
                    img = data.png;
                // }
                $('<img>').attr('src', img + '?' + new Date().getTime())
                // add query string to prevent browser
                // from showing cached image
                .attr('alt', query).appendTo(result);

                // links to pdf and svg
                p = $('<p>').appendTo(result);
                p.append('Download als ');
                $('<a>').attr('href', data.pdf).text('PDF').appendTo(p);
                p.append(', ');
                $('<a>').attr('href', data.svg).text('SVG').appendTo(p);

                // plot settings
                result.append('<br>Einstellungen dieses Plots:<br>');
                jsonsettings = JSON.stringify(settings);
                result.append($('<textarea id="plotsettings">').text(jsonsettings));

                // plot url
                result.append('<br>Diesen Plot auf einer Webseite einbinden:<br>');
                ploturl = $(location).attr('href').replace(/[#?].*/, '') + 'webplot.py?' + query.replace(/a=plot/, 'a=png');
                result.append($('<textarea id="ploturl">').text('<img src="' + ploturl + '" />'));

                // store settings in cookie
                $.extend(settings, data);
                // append plot image urls to
                settings['url'] = ploturl;
                // save plot button
                p.append(', ');
                $('<input>').attr('type', 'image').attr('src', 'img/disk.png').attr('title', 'Diagramm speichern').attr('value', 'Diagramm speichern').click(function() {
                    addPlotToSaved(settings);
                    $(this).hide(speed);
                    savePlots();
                }).appendTo(p);

                // scroll to plot section
                $('nav a[href="#output"]').click();
            },
            error : function(xhr, text, error) {
                $('#result').empty();
                $('#error').html('<p>plot error, check input values!</p>' + '<p>"' + text + '"</p><p>"' + error + '"</p>' + '<p style="color: red;">responseText:</p>' + xhr['responseText']);
                // scroll to plot section
                $('nav a[href="#output"]').click();
            }
        });

        return false;
    });
}

function appendSymbol(selector, symbol) {
    $(selector).each(function() {
        var t = $(this).contents().first()
        if (t.get(0).nodeType != 3)// if it's not a text node
            return;
        t.after(' <span class="symbol">' + symbol + '</span>');
    });
}

function initSymbols() {
    appendSymbol('label.required', '&diams;');
    appendSymbol('label.advanced', '&dagger;');
    appendSymbol('label.expert', '&Dagger;');
}

/** on page load... */
$(function() {
    initScroll();
    initHelp('fieldset.global');
    initExpertMode();
    initPlots();
    initSubmit();
    initSettingsLoader();
    initSavedPlots();
    initSymbols();
});