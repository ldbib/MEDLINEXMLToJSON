/*

MEDLINE XML To JSON 0.0.1 development branch

Copyright 2014 Emil Hemdal <emil(at)hemdal(dot)se>
Copyright 2014 Landstinget Dalarna Bibliotek och informationscentral <webmaster(dot)lasarettsbiblioteken(at)ltdalarna(dot)se>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

(function() {
	"use strict";
	var fs 			= require("fs"),
		sax 		= require("sax");

	// We use the steam functionality of sax since the MEDLINE files tend to be quite large and to load a 100MB large XML file 
	// into memory is a bad idea when Node.js can process it on the go saving memory.
	var XMLParser = sax.createStream(true, { // true means XML parsing
		//trim: true, // Trims text and comment nodes
		normalize: true // Turnes any whitespace into a single space
	});

	var json 	= new Array(),
		whereAmI = new Array(),
		lastDateTag = "",
		nodeData = null,
		parser = {
			"DeleteCitation": function(text) {
				json.push ({
					"delete": []
				});
			},
			"MedlineCitation": function(text) {
				json.push({
					"owner": 	nodeData.attributes.Owner,
					"status": 	nodeData.attributes.Status,
					"_id": null,
					"dates": {
						"created": {}
					},
					"pubmodel": null,
					"article": null,
					"journal": {
						"title": null,
						"isoAbbreviation": null,
						"issn": null,
						"eissn": null,
						"lissn": null, // Linked issn
						"citedMedium": null, // Internet/Print
						"pubdate": {
							"year": null
						}
					},
					"pagnation": {
						"fp": null, // First Page
						"lp": null, // Last Page
					},
					"language": [],
					"pubtype": [],
					"country": null,
					"medlineAbbreviation": null
				});
			},
			"PMID": function(text) {
				if(whereAmI[whereAmI.length-2] === "MedlineCitation") {
					json[json.length-1]._id = text;
				} else if(whereAmI[whereAmI.length-2] === "DeleteCitation") {
					json[json.length-1].delete.push(text);
				} else if(whereAmI[whereAmI.length-2] === "CommentsCorrections") {
					console.log("TODO!!!");
				}
			},
			"DateCreated": function(text) { lastDateTag = "created"; },
			"DateCompleted": function(text) { lastDateTag = "completed"; json[json.length-1].dates.completed = {} },
			"DateRevised": function(text) { lastDateTag = "revised"; json[json.length-1].dates.revised = {} },
			"PubDate": function(text) { lastDateTag = "pubdate"; },
			"ArticleDate": function(text) { lastDateTag = "articledate"; json[json.length-1].articledate = {} },
			"Year": function(text) {
				dateInsertion(text, "year");
			},
			"Month": function(text) {
				dateInsertion(text, "month");
			},
			"Day": function(text) {
				dateInsertion(text, "day");
			},
			"Article": function(text) { json[json.length-1].pubmodel = nodeData.attributes.PubModel; },
			"Volume": function(text) { json[json.length-1].journal.volume = text; },
			"Issue": function(text) { json[json.length-1].journal.issue = text; },
			"ArticleTitle": function(text) { json[json.length-1].article = text; },
			"MedlinePgn": function(text) {
				text = text.split("-");
				json[json.length-1].pagnation.fp = text[0];
				if(text[1]) {
					json[json.length-1].pagnation.lp = text[1];
				}
			},
			"JournalIssue": function(text) { json[json.length-1].journal.citedMedium = nodeData.attributes.CitedMedium },
			"ELocationID": function(text) {
				if(typeof json[json.length-1].pagnation.elocation !== "object") {
					json[json.length-1].pagnation.elocation = new Array( { "type": nodeData.attributes.EIdType, "value": text } );
				} else {
					json[json.length-1].pagnation.elocation.push( { "type": nodeData.attributes.EIdType, "value": text } );
				}
			},
			"AbstractText": function(text) {
				if(whereAmI[whereAmI.length-3] === "Article") {
					if(typeof json[json.length-1].abstract !== "object") {
						json[json.length-1].abstract = {};
					}
					if(typeof json[json.length-1].abstract.abstracts !== "object") {
						json[json.length-1].abstract.abstracts = new Array( { "text": text, "label": nodeData.attributes.Label, "nlmCategory": nodeData.attributes.NlmCategory } );
					} else {
						json[json.length-1].abstract.abstracts.push( { "text": text, "label": nodeData.attributes.Label, "nlmCategory": nodeData.attributes.NlmCategory } );
					}
				} else {
					console.log("TODO!!!");
				}
			},
			"CopyrightInformation": function(text) {
				if(whereAmI[whereAmI.length-2] === "Abstract") {
					json[json.length-1].abstract.copyright = text;
				} else {
					console.log("TODO!!!");
				}
			},
			"Language": function(text) { json[json.length-1].language.push(text); },
			"ISSN": function(text) { json[json.length-1].journal[(nodeData.attributes.IssnType === "Electronic" ? "eissn" : "issn")] = text; },
			"Title": function(text) { json[json.length-1].journal.title = text; }, // Journal Title
			"ISOAbbreviation": function(text) { json[json.length-1].journal.isoAbbreviation = text; },
			"AuthorList": function(text) {
				json[json.length-1].authors = new Array();
			},
			"Author": function(text) {
				json[json.length-1].authors.push({});
			},
			"LastName": function(text) {
				if(whereAmI[whereAmI.length-2] === "Author") {
					json[json.length-1].authors[json[json.length-1].authors.length-1].lastName = text;
				} else {
					console.log("TODO!!");
				}
			},
			"ForeName": function(text) {
				if(whereAmI[whereAmI.length-2] === "Author") {
					json[json.length-1].authors[json[json.length-1].authors.length-1].firstName = text;
				} else {
					console.log("TODO!!");
				}
			},
			"Initials": function(text) {
				if(whereAmI[whereAmI.length-2] === "Author") {
					json[json.length-1].authors[json[json.length-1].authors.length-1].initials = text;
				} else {
					console.log("TODO!!");
				}
			},
			"Suffix": function(text) {
				if(whereAmI[whereAmI.length-2] === "Author") {
					json[json.length-1].authors[json[json.length-1].authors.length-1].suffix = text;
				} else {
					console.log("TODO!!");
				}
			},
			"CollectiveName": function(text) {
				if(whereAmI[whereAmI.length-2] === "Author") {
					json[json.length-1].authors[json[json.length-1].authors.length-1].collectiveName = text;
				} else {
					console.log("TODO!!");
				}
			},
			"Identifier": function(text) {
				if(whereAmI[whereAmI.length-2] === "Author") {
					json[json.length-1].authors[json[json.length-1].authors.length-1].identifier = text;
				} else {
					console.log("TODO!!");
				}
			},
			"Affiliation": function(text) {
				if(whereAmI[whereAmI.length-2] === "Author") {
					json[json.length-1].authors[json[json.length-1].authors.length-1].affiliation = text;
				} else {
					console.log("TODO!!");
				}
			},
			"PublicationType": function(text) {
				json[json.length-1].pubtype.push(text);
			},
			"MedlineTA": function(text) {
				json[json.length-1].medlineAbbreviation = text;
			},
			"NlmUniqueID": function(text) {
				json[json.length-1].nlmid = text;
			},
			"ISSNLinking": function(text) {
				json[json.length-1].journal.lissn = text;
			},
			"KeywordList": function(text) {
				if(typeof json[json.length-1].keywordList !== "object") {
					json[json.length-1].keywordList = new Array( { "owner": nodeData.attributes.Owner, "list": new Array() } );
				} else {
					json[json.length-1].keywordList.push( { "owner": nodeData.attributes.Owner, "list": new Array() } );
				}
			},
			"Keyword": function(text) {
				json[json.length-1].keywordList[json[json.length-1].keywordList.length-1].list.push( { "major": ( nodeData.attributes.MajorTopicYN === "Y" ? true : false ) } );
				json[json.length-1].keywordList[json[json.length-1].keywordList.length-1].list[json[json.length-1].keywordList[json[json.length-1].keywordList.length-1].list.length-1].text = text;
			},
			"_default": function(text) {
				console.log(JSON.stringify(nodeData));
				if(text.trim().length > 0) {
					console.log(text);
				}
			}
		};

	XMLParser.on("opentag", function(data) { // Runs when an XML tag is opened. The data variable contains the name of the tag and it's attributes.
		whereAmI.push(data.name);
		nodeData = data;
	});
	XMLParser.on("closetag", function(nodeName) { // Runs when an XML tag is closed.
		whereAmI.pop();
	});
	XMLParser.on("text", function(text) { // Runs when there is text in an XML tag, not an attribute.
		// The following two lines fixes the bug in sax when text is run twice, once when the tag opens and once when the tag closes.
		if(whereAmI.length > 0) {
			if(whereAmI[whereAmI.length-1] === nodeData.name) {
				parser[whereAmI[whereAmI.length-1]] ? parser[whereAmI[whereAmI.length-1]](text) : parser._default(text);
			}
		}
	});
	XMLParser.on("end", function(text) { // Runs when all the XML processing is done.
		console.log("\nEND JSON:");
		console.log(JSON.stringify(json)); // Output to JSON in the console.
	});

	fs.createReadStream('./example.xml').pipe(XMLParser); // Pipes the readstream of example.xml to the XML parser.

	function dateInsertion(text, type) {
		if(["created", "completed", "revised"].indexOf(lastDateTag) !== -1) {
			json[json.length-1].dates[lastDateTag][type] = text;
		} else if(lastDateTag === "pubdate") {
			json[json.length-1].journal.pubdate[type] = text;
		} else if(lastDateTag === "articledate") {
			json[json.length-1].articledate[type] = text;
		}
	}

}());