/* global $ _ helper relEditor sidebar GM_info GM_xmlhttpRequest */
'use strict';
// ==UserScript==
// @name         MusicBrainz: Fill entity info from wikidata/VIAF
// @namespace    mbz-loujine
// @author       loujine
// @version      2017.11.1
// @downloadURL  https://bitbucket.org/loujine/musicbrainz-scripts/raw/default/mbz-create_artist_from_wikidata.user.js
// @updateURL    https://bitbucket.org/loujine/musicbrainz-scripts/raw/default/mbz-create_artist_from_wikidata.user.js
// @supportURL   https://bitbucket.org/loujine/musicbrainz-scripts
// @icon         https://bitbucket.org/loujine/musicbrainz-scripts/raw/default/icon.png
// @description  musicbrainz.org: Fill entity info from wikidata/VIAF
// @compatible   firefox+greasemonkey/tampermonkey
// @license      MIT
// @require      https://greasyfork.org/scripts/13747-mbz-loujine-common/code/mbz-loujine-common.js?version=228700
// @include      http*://*musicbrainz.org/artist/create*
// @include      http*://*musicbrainz.org/artist/*/edit
// @exclude      http*://*musicbrainz.org/artist/*/alias/*/edit
// @include      http*://*mbsandbox.org/artist/create*
// @include      http*://*mbsandbox.org/artist/*/edit
// @exclude      http*://*mbsandbox.org/artist/*/alias/*/edit
// @include      http*://*musicbrainz.org/place/create*
// @include      http*://*musicbrainz.org/place/*/edit
// @exclude      http*://*musicbrainz.org/place/*/alias/*/edit
// @include      http*://*mbsandbox.org/place/create*
// @include      http*://*mbsandbox.org/place/*/edit
// @exclude      http*://*mbsandbox.org/place/*/alias/*/edit
// @include      http*://*musicbrainz.org/work/create*
// @include      http*://*musicbrainz.org/work/*/edit
// @exclude      http*://*musicbrainz.org/work/*/alias/*/edit
// @grant        none
// @run-at       document-end
// ==/UserScript==

// https://www.wikidata.org/wiki/Wikidata:List_of_properties/Person
class WikiDataHelpers {

    constructor() {
        this.language = 'en';
        this.entities = {
            person: 5,
            stringQuartet: 207338,
            orchestra: 42998,
            band: 215380,
            rockBand: 5741069,
            male: 6581097,
            female: 6581072
        };
        this.fields = {
            type: 'P31',
            gender: 'P21',
            citizen: 'P27',
            coordinates: 'P625',
            country: 'P495',
            isni: 'P213',
            birthDate: 'P569',
            inceptionDate: 'P571',
            birthPlace: 'P19',
            formationLocation: 'P740',
            deathDate: 'P570',
            dissolutionDate: 'P576',
            deathPlace: 'P20',
            mbidArtist: 'P434',
            mbidArea: 'P982',
            mbidPlace: 'P1004',
            members: 'P527',
            student: 'P802',
            teacher: 'P1066',
            idAllMusic: 'P1728',
            idBNF: 'P268',
            idDiscogs: 'P1953',
            idFacebook: 'P2013',
            idGND: 'P227',
            idIMDB: 'P345',
            idIMSLP: 'P839',
            idInstagram: 'P2003',
            idOL: 'P648',
            idSpotify: 'P1902',
            idTwitter: 'P2002',
            idVIAF: 'P214'
        };
        this.urls = {
            idAllMusic: 'http://www.allmusic.com/artist/',
            idBNF: 'http://catalogue.bnf.fr/ark:/12148/cb',
            idDiscogs: 'https://www.discogs.com/artist/',
            idFacebook: 'https://www.facebook.com/',
            idGND: 'https://d-nb.info/gnd/',
            idIMDB: 'http://www.imdb.com/name/',
            idIMSLP: 'https://imslp.org/wiki/',
            idInstagram: 'https://www.instagram.com/',
            idOL: 'https://openlibrary.org/works/',
            idSpotify: 'https://open.spotify.com/artist/',
            idTwitter: 'https://twitter.com/',
            idVIAF: 'https://viaf.org/viaf/'
        };
    }

    existField(entity, field) {
        return entity.claims[this.fields[field]] !== undefined;
    }

    fieldValue(entity, field) {
        return entity.claims[this.fields[field]][0]
                     .mainsnak.datavalue.value;
    }

    /*
     * data: wikidata json for the area
     * place: wikidata code ('Q90', etc.)
     */
    _fillArea(data, place, nodeId, lang) {
        const entityArea = data.entities[place],
            input = document.getElementById(`id-edit-artist.${nodeId}.name`);
        if (!entityArea || !input) {  // no wikidata data
            return;
        }
        const area = entityArea.labels[lang].value;
        $('#newFields').append(
            $('<dt>', {'text': `Field "${FIELD_NAMES[nodeId]}":`})
        )
        if (input.value === area) {
            $('#newFields').append(
                $('<dd>', {'text': `Kept "${input.value}"`})
            )
            return;
        }
        if (input.value !== '' && input.value !== area) {
            $('#newFields').append(
                $('<dd>',
                  {'text': `Different value "${area}":`}).css('color', 'red')
            )
            return;
        }
        if (this.existField(entityArea, 'mbidArea')) {
            input.value = this.fieldValue(entityArea, 'mbidArea');
            $(input).trigger('keydown');
            $('#area-bubble').remove();
        } else {
            input.value = area;
        }
        $('#newFields').append(
            $('<dd>', {'text': `Added "${area}"`}).css('color', 'green')
        )
    }

    fillArea(entity, field, areaField, lang) {
        const area = 'Q' + this.fieldValue(entity, field)['numeric-id'];
        $.ajax({
            url: 'https://www.wikidata.org/w/api.php?action=wbgetentities&ids='
                 + area + '&format=json',
            dataType: 'jsonp'
        }).done(data => this._fillArea(data, area, areaField, lang));
    }

    fillDate(entity, entityType, fieldName, nodeId) {
        const field = this.fieldValue(entity, fieldName),
            prefix = `id-edit-${entityType}.period.${nodeId}`;
        // sometimes wikidata has valid data but not 'translatable'
        // to the mbz schema
        // cf https://www.mediawiki.org/wiki/Wikibase/DataModel#Dates_and_times
        if (field.precision < 9 || field.before > 0 || field.after > 0) {
            return;
        }
        // sometimes wikidata has invalid data for months/days
        let date = new Date(field.time.slice(1)); // remove leading "+"
        if (isNaN(date.getTime())) { // invalid date
            // try to find valid fields
            date = new RegExp('(.*)-(.*)-(.*)T').exec(field.time);
            if (parseInt(date[1]) !== 0) {
                setValue(prefix + '.year', parseInt(date[1]));
                if (parseInt(date[2]) > 0) {
                    setValue(prefix + '.month', parseInt(date[2]));
                    if (parseInt(date[3]) > 0) {
                        setValue(prefix + '.day', parseInt(date[3]));
                    }
                }
            }
            return;
        }
        setValue(prefix + '.year', date.getFullYear());
        const yearInput = document.getElementById(prefix + '.year');
        if (!yearInput) {
            return;
        }
        if (yearInput.classList.contains('jesus2099')) {
                // jesus2099's EASY_DATE script is shifting the input node
                // containing the year but not its id
                yearInput.nextSibling.value = date.getUTCFullYear();
        }
        if (field.precision > 9) {
            setValue(prefix + '.month', date.getUTCMonth() + 1);
            if (field.precision > 10) {
                setValue(prefix + '.day', date.getUTCDate());
            }
        }
    }

    request(wikiId, callback) {
        $.ajax({
            url: 'https://www.wikidata.org/w/api.php?action=wbgetentities&ids='
                 + wikiId + '&format=json',
            dataType: 'jsonp'
        }).done(data => {
            console.info('wikidata returned: ', data);
            if (data.error) {
                // eslint-disable-next-line no-alert
                alert('wikidata returned an error:\n' +
                      'code: ' + data.error.code + '\n' +
                      'wikidata ID: "' + data.error.id + '"\n' +
                      'info: ' + data.error.info);
                return;
            }
            callback(data.entities[wikiId]);
        });
    }
}

const libWD = new WikiDataHelpers();


const FIELD_NAMES = {
    'id-edit-artist.name': 'Name',
    'id-edit-artist.type_id': 'Type',
    'id-edit-artist.gender_id': 'Gender',
    'id-edit-artist.period.begin_date.year': 'Birth year',
    'id-edit-artist.period.begin_date.month': 'Birth month',
    'id-edit-artist.period.begin_date.day': 'Birth day',
    'id-edit-artist.period.end_date.year': 'Death year',
    'id-edit-artist.period.end_date.month': 'Death month',
    'id-edit-artist.period.end_date.day': 'Death day',
    'begin_area': 'Born in',
    'end_area': 'Died in',
    'area': 'Area',
};

_.forOwn(FIELD_NAMES, (v, k) => {
    if (k.includes('artist')) {
        FIELD_NAMES[k.replace('artist', 'place')] = v;
        FIELD_NAMES[k.replace('artist', 'work')] = v;
    }
});


function setValue(nodeId, value, callback) {
    callback = callback || (() => {});
    const node = document.getElementById(nodeId);
    if (!node) {
        return false;
    }
    $('#newFields').append(
        $('<dt>', {'text': `Field "${FIELD_NAMES[nodeId]}":`})
    )
    const printableValue = node.options ? node.options[value].text : value;
    if (!node.value.trim()) {  // field was empty
        node.value = value;
        $('#newFields').append(
            $('<dd>',
              {'text': `Added "${printableValue}"`}).css('color', 'green')
        );
        return callback(); // eslint-disable-line consistent-return
    }
    if (node.value != value) {  // != to allow autocasting to int
        $('#newFields').append(
            $('<dd>', {'text': `Different value "${printableValue}" suggested`}
            ).css('color', 'red')
        );
        return callback(); // eslint-disable-line consistent-return
    }
    // identical value, not replaced
    $('#newFields').append(
        $('<dd>', {'text': `Kept "${printableValue}"`})
    );
    return false;
}


function fillISNI(isni) {
    const existing_isni = [],
        isniBlock = document.getElementsByClassName(
            'edit-artist.isni_codes-template')[0].parentElement,
        fields = isniBlock.getElementsByTagName('input');
    for (const input of fields) {
        existing_isni.push(input.value.split(" ").join(""));
    }
    existing_isni.splice(0, 1); // skip template
    if (existing_isni.includes(isni.split(" ").join(""))) {
        return;
    }
    if (existing_isni.length === 1 && existing_isni[0] === "") {
        document.getElementsByName('edit-artist.isni_codes.0')[0].value = isni;
    } else {
        isniBlock.getElementsByClassName('form-row-add')[0]
                 .getElementsByTagName('button')[0].click();
        document.getElementsByName(
            `edit-artist.isni_codes.${existing_isni.length}`)[0].value = isni;
    }
    $('#newFields').append(
        $('<dt>', {'text': 'New ISNI code added:'})
    ).append(
        $('<dd>', {'text': isni}).css('color', 'green')
    );
}


function _existingDomains() {
    let existingDomains = [];
    const fields = document.getElementById("external-links-editor")
                           .getElementsByTagName('input');
    for (const link of fields) {
        existingDomains.push(link.value.split('/')[2]);
    }
    return existingDomains.slice(0, existingDomains.length - 1);
}


function _fillExternalLinks(url, ) {
    const fields = document.getElementById('external-links-editor')
                           .getElementsByTagName('input');
    const input = fields[fields.length - 1];
    input.value = url;
    input.dispatchEvent(new Event('input', {'bubbles': true}));
    $('#newFields').append(
        $('<dt>', {'text': 'New external link added:'})
    ).append(
        $('<dd>', {'text': url}).css('color', 'green')
    );
}


function fillExternalLinks(url) {
    const existingDomains = _existingDomains();
    const domain = url.split('/')[2];
    if (!existingDomains.includes(domain)) {
        _fillExternalLinks(url);
    }
}


function _fillEntityName(value, entityType) {
    function callback() {
        if (helper.isArtistURL()) {
            $(document.getElementById('id-edit-artist.name')
                ).trigger('change');
            if (!document.getElementById('id-edit-artist.sort_name')
                         .value.length) {
                $('#newFields').append(
                    $('<p>',
                      {'text': 'You must set the sort name to '
                               + 'save the edit'}).css('color', 'red')
                );
            }
        }
    }
    setValue(`id-edit-${entityType}.name`, value, callback);
}


function _fillEntityType(entity, entityType) {
    let value;
    const type = libWD.fieldValue(entity, 'type')['numeric-id'];
    switch(type) {
        case libWD.entities.person:
            value = 1;
            break;
        case libWD.entities.stringQuartet:
        case libWD.entities.orchestra:
        case libWD.entities.band:
        case libWD.entities.rockBand:
            value = 2;
            break;
        default:
            value = 0;
            break;
    }
    setValue(`id-edit-${entityType}.type_id`, value);
}


function _fillEntityGender(entity) {
    let value;
    const gender = libWD.fieldValue(entity, 'gender')['numeric-id'];
    switch(gender) {
        case libWD.entities.male:
            value = 1;
            break;
        case libWD.entities.female:
            value = 2;
            break;
        default:
            value = 3;
            break;
    }
    setValue('id-edit-artist.gender_id', value);
}


function _fillFormFromWikidata(entity, entityType) {
    let lang = libWD.language,
        field, input;
    if (!(lang in entity.labels)) {
        lang = Object.keys(entity.labels)[0];
    }

    // name and sort name
    _fillEntityName(entity.labels[lang].value, entityType)

    // for places: Coordinates
    if (libWD.existField(entity, 'coordinates')) {
        input = document.getElementById('id-edit-place.coordinates');
        const coord = libWD.fieldValue(entity, 'coordinates');
        input.value = coord.latitude + ', ' + coord.longitude;
    }

    // Type and gender
    if (libWD.existField(entity, 'type')) {
        _fillEntityType(entity, entityType);
    }

    if (libWD.existField(entity, 'gender')) {
        _fillEntityGender(entity);
    }

    // Area
    // we need to fetch the wikidata entry of the different areas to
    // check if a musicbrainz MBID already exists
    if (libWD.existField(entity, 'citizen')
            || libWD.existField(entity, 'country')) {
        field = libWD.existField(entity, 'citizen') ? 'citizen' : 'country';
        libWD.fillArea(entity, field, 'area', lang);
    }

    // ISNI
    if (entityType === 'artist' && libWD.existField(entity, 'isni')) {
        fillISNI(libWD.fieldValue(entity, 'isni'));
    }

    // Dates & places
    if (libWD.existField(entity, 'birthDate')
            || libWD.existField(entity, 'inceptionDate')) {
        field = libWD.existField(entity, 'birthDate') ? 'birthDate'
                                                      : 'inceptionDate';
        libWD.fillDate(entity, entityType, field, 'begin_date');
    }

    if (libWD.existField(entity, 'birthPlace')
            || libWD.existField(entity, 'formationLocation')) {
        field = libWD.existField(entity, 'birthPlace') ? 'birthPlace'
                                                       : 'formationLocation';
        libWD.fillArea(entity, field, 'begin_area', lang);
    }

    if (libWD.existField(entity, 'deathDate')
            || libWD.existField(entity, 'dissolutionDate')) {
        field = libWD.existField(entity, 'deathDate') ? 'deathDate'
                                                      : 'dissolutionDate';
        libWD.fillDate(entity, entityType, field, 'end_date');
    }

    if (libWD.existField(entity, 'deathPlace')) {
        libWD.fillArea(entity, 'deathPlace', 'end_area', lang);
    }

    const existingDomains = _existingDomains();
    _.forOwn(libWD.urls, (url, externalLink) => {
        const domain = url.split('/')[2];
        if (libWD.existField(entity, externalLink) &&
                !existingDomains.includes(domain)) {
            _fillExternalLinks(
                url + libWD.fieldValue(entity, externalLink)
            );
        }
    });

    for (const role of ['student', 'teacher']) {
        if (libWD.existField(entity, role)) {
            libWD.request(libWD.fieldValue(entity, role).id,
                          data => {
                const name = data.labels[lang].value;
                $('#newFields').append(
                    $('<dt>', {'text': `${role} suggestion:`})
                ).append(
                    $('<dd>', {'text': name}).css('color', 'orange')
                );
            });
        }
    }
}

function fillFormFromWikidata(wikiId) {
    const entityType = document.URL.split('/')[3];
    libWD.request(wikiId, entity => {
        if (document.URL.split('/')[3] == 'create' && (
            (libWD.existField(entity, 'mbidArtist')
                || libWD.existField(entity, 'mbidPlace')))) {
            const mbid = libWD.existField(entity, 'mbidArtist') ?
                libWD.fieldValue(entity, 'mbidArtist') :
                libWD.fieldValue(entity, 'mbidPlace');
            // eslint-disable-next-line no-alert
            if (window.confirm(
                    'An entity already exists linked to this wikidata id, ' +
                    'click "ok" to redirect to their page')) {
                window.location.href = `/${entityType}/${mbid}`;
            }
        }
        _fillFormFromWikidata(entity, entityType);
    });
    document.getElementById(`id-edit-${entityType}.edit_note`)
            .value = sidebar.editNote(GM_info.script);
}


function fillFormFromVIAF(viafURL) {
    const entityType = document.URL.split('/')[3];
    fetch(viafURL).then(resp => {
        fillExternalLinks(viafURL);
        const parser = new DOMParser(),
            doc = parser.parseFromString(resp, 'text/html');
        setValue(
            'id-edit-artist.name',
            doc.getElementsByTagName('h2')[1].textContent,
            () => {
                $(document.getElementById(
                    'id-edit-artist.name')).trigger('change');
                document.getElementsByClassName(
                    'guesscase-sortname')[0].click();
            }
        );
        for (const site of ["catalogue.bnf.fr", "d-nb.info", "wikidata.org"]) {
            const link = doc.querySelector(`a[href*="${site}"]`);
            if (link && link.href) {
                fillExternalLinks(link.href);
            }
        }
        const link = doc.querySelector(`a[href*="isni.org"]`);
        if (link && link.href) {
            fillISNI(link.href.split('/')[4]);
        }
        document.getElementById(`id-edit-${entityType}.edit_note`)
                .value = sidebar.editNote(GM_info.script);
    });
}


function fillFormFromISNI(isniURL) {
    const entityType = document.URL.split('/')[3];
    GM_xmlhttpRequest({
        method: "GET",
        url: isniURL,
        timeout: 1000,
        onload: function(resp) {
            fillISNI(isniURL.split('/')[3]);
            const parser = new DOMParser();
            const doc = parser.parseFromString(resp.responseText, 'text/html');
            const rgx = new RegExp(/ISNI [0-9]+ (.*)/).exec(doc.title);
            _fillEntityName(rgx[1], entityType);
            ["viaf.org", "catalogue.bnf.fr",
             "d-nb.info", "wikidata.org"].forEach(function (site) {
                const link = doc.querySelector(`a[href*="${site}"]`);
                if (link && link.href) {
                    fillExternalLinks(link.href);
                }
            });
        }
    });
}


(function displayToolbar(relEditor) {
    $('div.half-width').after(
        $('<div>', {float: 'right'})).after(
        relEditor.container().append(
            $('<h3>Add external link</h3>')
        ).append(
            $('<p>Add a wikidata/VIAF/ISNI ' +
              'link here to retrieve automatically some information.' +
              '<br />Warning: ISNI does not work with Greasemonkey ' +
              'but only with Tampermonkey</p>')
        ).append(
            $('<input>', {
                'id': 'linkParser',
                'type': 'text',
                'value': '',
                'placeholder': 'URL to parse',
                'width': '400px'
            })
        ).append(
            $('<dl>', {'id': 'newFields'})
        )
    );
    $('div#loujine-menu').css('margin-left', '550px');
})(relEditor);


$(document).ready(function() {
    const node = document.getElementById('linkParser');
    node.addEventListener('input', () => {
        const domain = node.value.split('/')[2];
        $('#linkParser').css('background-color', '#bbffbb');
        if (domain === "www.wikidata.org") {
            fillExternalLinks(node.value);
            fillFormFromWikidata(node.value.split('/')[4].trim());
        } else if (domain === "viaf.org") {
            node.value = node.value.replace(/http:/g, 'https:')
            if (!node.value.endsWith('/')) {
                node.value += '/';
            }
            fillFormFromVIAF(node.value);
        } else if (domain === "www.isni.org") {
            node.value = node.value.replace(/isni\//g, '')
            fillFormFromISNI(node.value);
        } else {
            $('#linkParser').css('background-color', '#ffaaaa');
        }
    }, false);
    return false;
});

// test data:
// https://www.wikidata.org/wiki/Q11331342
// https://www.wikidata.org/wiki/Q1277689 invalid date with precision=10 (Y+M)
// https://www.wikidata.org/wiki/Q3290108 invalid date with precision=9 (year)
// https://www.wikidata.org/wiki/Q3193910 invalid date with precision=7

// import viaf
// https://viaf.org/viaf/44485204/
// https://viaf.org/viaf/80111787/

// bnf
// http://catalogue.bnf.fr/ark:/12148/cb13894801b.unimarc
//  103 .. $a 19161019 19851014


// test data for places:
// https://www.wikidata.org/wiki/Q2303621

// isni
// http://www.isni.org/isni/0000000073684002 person
// http://www.isni.org/0000000120191498 orchestra
// http://www.isni.org/0000000120191498 place
