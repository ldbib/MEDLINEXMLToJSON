# MEDLINEXMLToJSON

MEDLINEXMLToJSON is a Node.js application designed for MEDLINE®/PubMed® Data licensees to download and convert the MEDLINE®/PubMed® XML data into a JSON format.

We are in no way affiliated with MEDLINE® or PubMed®. We're only a MEDLINE® licensed library that want to share this software with the public so that anyone with a MEDLINE license can easier utilize MEDLINE® metadata for improving healthcare.

Wikipedia has an article regarding MEDLINE® here https://en.wikipedia.org/wiki/MEDLINE and PubMed here https://en.wikipedia.org/wiki/PubMed

The U.S. National Library of Medicine have a page about MEDLINE® here http://www.nlm.nih.gov/pubs/factsheets/medline.html

It's developed for the 2014 version of the MEDLINE® XML DTD (Document type definition).

## Dependencies
The only dependency is the XML parser [sax](https://github.com/isaacs/sax-js) by [Isaac Z. Schlueter](https://github.com/isaacs).

## Installation
```
npm install medlinexmltojson
```

## Example usage

### Simple example
```JavaScript
var medline2json = require("medlinexmltojson");

medline2json.parse("myxmlfile.xml", function(err, json) {
	// err is a string saying what's wrong. It's null if there's not an error.
	// json is the json string. It's null if there's an error.
});
```

### Stream example
```JavaScript
var medline2json = require("medlinexmltojson"),
	fs = require("fs");

medline2json.parse(fs.createReadStream("./myxmlfile.xml"), function(err, json) {
	// err is a string saying what's wrong. It's null if there's not an error.
	// json is the json string. It's null if there's an error.
});
```

### Stream example with gzipping
```JavaScript
var medline2json = require("medlinexmltojson"),
	fs = require("fs"),
	zlib = require('zlib'),
	gzip = zlib.createGunzip();

medline2json.parse(fs.createReadStream("./myxmlfile.xml.gz").pipe(gzip), function(err, json) {
	// err is a string saying what's wrong. It's null if there's not an error.
	// json is the json string. It's null if there's an error.
});
```

## License
This project is released under the terms of the [GNU AGPL version 3](https://www.gnu.org/licenses/agpl.html)

## Author
[Emil Hemdal](https://github.com/emilhem)

## Changelog

### Version 1.1.0 - 15th of August 2014
Added data streaming functionality.
Improved test.

### Version 1.0.1 - 6th of August 2014
Changed to 1.0.1 to make npm less grumpy with publishing under the same version.

### Version 1.0 - 6th of August 2014
Test added.
Can and should be used as a module.
Moved around files.
Added an extensive test xml that contains a lot of the different possibilites that the MEDLINE® XML file could contain.

### Version 0.1 - 30th of July 2014
Basic usage with example file. Can not be used as a module yet!
