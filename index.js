(function () {
    var reader = require('@theoryofnekomata/kanjidic-reader'),
        createJsonFile = function createJsonFile(filename, data, cb) {
            var jsonfile = require('jsonfile');

            return jsonfile.writeFile(
                filename,
                data.filter(datum => datum.type === 'entry'),
                cb
            );
        },
        createXmlFile = function createXmlFile(filename, data, cb) {
            var js2xmlparser = require('js2xmlparser'), // TODO create own converter
                fs = require('fs'),
                outputStream = fs.createWriteStream(filename);

            outputStream.on('close', cb);

            return outputStream
                .write(js2xmlparser("entries", data.map(entry => entry.data), {
                    arrayMap: {
                        entries: "entry",
                        meaning: "meaning",
                        strokes: "count"
                    }
                }));
        },
        createCsvFile = function createCsvFile(filename, data, cb) {
            var fs = require('fs'),
                outputStream = fs.createWriteStream(filename, { encoding: 'utf-8' }),
                has = require('lodash.has'),
                get = require('lodash.get'),
                prefixes = require('./prefixes'),
                nonPrefixFields = [
                    'kanji',
                    'mapping.shift_jis',
                    'reading.on',
                    'reading.kun',
                    'reading.special.nanori',
                    'reading.special.name_as_radical',
                ],
                fields = nonPrefixFields.concat(Object.keys(prefixes).map(prefix => prefixes[prefix].attr));

            function createCsvEntry(entry) {
                var fieldValues = fields
                    .map(field => {
                        if (!has(entry, field)) {
                            return '';
                        }

                        if (field === 'reading.kun') {
                            return entry.reading.kun.map(kun => {
                                if (!kun.okurigana) {
                                    return kun.base;
                                }
                                return kun.base + '.' + kun.okurigana;
                            });
                        }

                        if (field === 'strokes') {
                            return entry.strokes.join(',');
                        }

                        if (field === 'reading.special') {
                            return;
                        }

                        if (field === 'index.mp') {
                            return entry.index.mp.volume + '.' + entry.index.mp.page;
                        }

                        if (field === 'index.db') {
                            return entry.index.db.volume + '.' + entry.index.db.chapter;
                        }

                        return get(entry, field);
                    })
                    .map(field => {
                        if (field instanceof Array) {
                            return field.join(',');
                        }
                        return field;
                    })
                    .map(field => '' + field)
                    .map(field => {
                        if (field.indexOf(',') > -1 || field.indexOf('"') > -1) {
                            field = field.replace(/["]/g, '""');
                            return `"${field}"`;
                        }
                        return field;
                    });

                return fieldValues.join(',');
            }

            outputStream.write(fields.join(',') + '\n');

            return data.forEach(entry => {
                outputStream.write(createCsvEntry(entry.data) + '\n');
            });
        };

    module.exports = {
        export: function kanjidicExporter(inputPath, outputPath) {
            return function (format, cb) {
                return reader(inputPath, (data) => {
                    var fileWriters = {
                            json: createJsonFile,
                            xml: createXmlFile,
                            csv: createCsvFile
                        },
                        fileWriter = fileWriters[format];

                    if (!fileWriter) {
                        throw new Error('Input path, format, and output path should be specified.');
                    }

                    return fileWriter.apply(null, [
                        outputPath,
                        data,
                        cb || (() => {})
                    ]);
                });
            };
        }
    };
})();
