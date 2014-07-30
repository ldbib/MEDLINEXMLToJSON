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
	var parser = sax.createStream(true, { // true means XML parsing
		//trim: true, // Trims text and comment nodes
		normalize: true // Turnes any whitespace into a single space
	});

	var json 	= new Array(),
		whereAmI = new Array(),
		whereIndex = -1,
		index 	= -1,
		abstractIndex = -1,
		authorIndex = -1,
		elocationIndex = -1,
		lastDateTag = "",
		issnType = "",
		authorListRun = false,
		nodeData = null,
		textParser = {
			"DeleteCitation": function(text) { console.log("\n\n\nDELETE FOUND!\n\n\n"); },
			"MedlineCitation": function(text) {
				index++;
				abstractIndex = -1;
				elocationIndex = -1;
				authorIndex = -1;
				authorListRun = false;
				/*json[index] = {
					"_id": 			null,
					"owner": 		nodeData.attributes.Owner,
					"status": 		nodeData.attributes.Status,
					"PMID": 		{
						"version": 	1,
						"id": 		null
					},
					"DateCreated": 	{
						"Year"
					}
				}*/
				json[index] = {
					"owner": 	nodeData.attributes.Owner,
					"status": 	nodeData.attributes.Status,
					"_id": null,
					"dates": {
						"created": {}, // year, month, day, and unixtime to be inserted
						//"completed": {}, // optional in the medline dtd
						//"revised": {}
					},
					"pubmodel": null,
					"article": null,
					// "articledate": null,
					"journal": {
						"title": null,
						"isoAbbreviation": null,
						"issn": null,
						"eissn": null,
						"lissn": null, // Linked issn
						"citedMedium": null, // Internet/Print
						"pubdate": {
							"year": null, // Year will be most commonly avaliable even if it's optional
							// "season": null,
							// "month": null,
							// "day": null,
							// "medlineDate": null
						},
						// "volume": null,
						// "issue": null
					},
					"pagnation": {
						"fp": null, // First Page
						"lp": null, // Last Page
						// "elocation": [{"type": "doi/pii", "valid": "Y/N"}]
					},
					//"authorlist": {
					//	"complete": "Y",
					//	"authors": []
					//},
					"language": [],
					"pubtype": [],
					"country": null,
					"medlineAbbreviation": null

				};
			},
			"PMID": function(text) { json[index]._id = text; },
			"DateCreated": function(text) { lastDateTag = "created"; },
			"DateCompleted": function(text) { lastDateTag = "completed"; json[index].dates.completed = {} },
			"DateRevised": function(text) { lastDateTag = "revised"; json[index].dates.revised = {} },
			"PubDate": function(text) { lastDateTag = "pubdate"; },
			"ArticleDate": function(text) { lastDateTag = "articledate"; json[index].articledate = {} },
			"Year": function(text) {
				if(["created", "completed", "revised"].indexOf(lastDateTag) !== -1) {
					json[index].dates[lastDateTag].year = text;
				} else if(lastDateTag === "pubdate") {
					json[index].journal.pubdate.year = text;
				} else if(lastDateTag === "articledate") {
					json[index].articledate.year = text;
				}
			},
			"Month": function(text) {
				if(["created", "completed", "revised"].indexOf(lastDateTag) !== -1) {
					json[index].dates[lastDateTag].month = text;
				} else if(lastDateTag === "pubdate") {
					json[index].journal.pubdate.month = text;
				} else if(lastDateTag === "articledate") {
					json[index].articledate.month = text;
				}
			},
			"Day": function(text) {
				if(["created", "completed", "revised"].indexOf(lastDateTag) !== -1) {
					json[index].dates[lastDateTag].day = text;
				} else if(lastDateTag === "pubdate") {
					json[index].journal.pubdate.day = text;
				} else if(lastDateTag === "articledate") {
					json[index].articledate.day = text;
				}
			},
			"Article": function(text) { json[index].pubmodel = nodeData.attributes.PubModel; },
			"Volume": function(text) { json[index].journal.volume = text; },
			"Issue": function(text) { json[index].journal.issue = text; },
			"ArticleTitle": function(text) { json[index].article = text; },
			"MedlinePgn": function(text) {
				text = text.split("-");
				json[index].pagnation.fp = text[0];
				if(text[1]) {
					json[index].pagnation.lp = text[1];
				}
			},
			"JournalIssue": function(text) { json[index].journal.citedMedium = nodeData.attributes.CitedMedium },
			"ELocationID": function(text) {
				elocationIndex++;
				if(typeof json[index].pagnation.elocation !== "object") {
					json[index].pagnation.elocation = new Array( { "type": nodeData.attributes.EIdType } );
				} else {
					json[index].pagnation.elocation.push( { "type": nodeData.attributes.EIdType } );
				}
				json[index].pagnation.elocation[elocationIndex].value = text;
			},
			"AbstractText": function(text) {
				if(whereAmI[whereIndex-2] === "Article") {
					abstractIndex++;
					if(json[index].abstract === undefined) {
						json[index].abstract = {};
					}
					if(typeof json[index].abstract.abstracts !== "object") {
						json[index].abstract.abstracts = new Array( { "text": "", "label": nodeData.attributes.Label, "nlmCategory": nodeData.attributes.NlmCategory } );
					} else {
						json[index].abstract.abstracts.push( { "text": "", "label": nodeData.attributes.Label, "nlmCategory": nodeData.attributes.NlmCategory } );
					}
				} else {
					console.log("TODO!!!");
				}
				json[index].abstract.abstracts[abstractIndex].text = text;
			},
			"CopyrightInformation": function(text) { json[index].abstract.copyright = text; },
			"Language": function(text) { json[index].language = text; },
			"ISSN": function(text) {
				issnType = nodeData.attributes.IssnType;
				json[index].journal[(issnType === "Electronic" ? "eissn" : "issn")] = text;
			},
			"Title": function(text) { json[index].journal.title = text; },
			"ISOAbbreviation": function(text) { json[index].journal.isoAbbreviation = text; },
			"AuthorList": function(text) {
				if(!authorListRun) {
					authorListRun = true;
					json[index].authors = new Array();
				}
			},
			"Author": function(text) {
				authorIndex++;
				json[index].authors.push({});
			},
			"LastName": function(text) {
				if(whereAmI[whereIndex-1] === "Author") {
					json[index].authors[authorIndex].lastName = text;
				} else {
					console.log("TODO!!");
				}
			},
			"ForeName": function(text) {
				if(whereAmI[whereIndex-1] === "Author") {
					json[index].authors[authorIndex].firstName = text;
				} else {
					console.log("TODO!!");
				}
			},
			"Initials": function(text) {
				if(whereAmI[whereIndex-1] === "Author") {
					json[index].authors[authorIndex].initials = text;
				} else {
					console.log("TODO!!");
				}
			},
			"Suffix": function(text) {
				if(whereAmI[whereIndex-1] === "Author") {
					json[index].authors[authorIndex].suffix = text;
				} else {
					console.log("TODO!!");
				}
			},
			"CollectiveName": function(text) {
				if(whereAmI[whereIndex-1] === "Author") {
					json[index].authors[authorIndex].collectiveName = text;
				} else {
					console.log("TODO!!");
				}
			},
			"Identifier": function(text) {
				if(whereAmI[whereIndex-1] === "Author") {
					json[index].authors[authorIndex].identifier = text;
				} else {
					console.log("TODO!!");
				}
			},
			"Affiliation": function(text) {
				if(whereAmI[whereIndex-1] === "Author") {
					json[index].authors[authorIndex].affiliation = text;
				} else {
					console.log("TODO!!");
				}
			},
			"PublicationType": function(text) {
				json[index].pubtype.push(text);
			},
			"MedlineTA": function(text) {
				json[index].medlineAbbreviation = text;
			},
			"NlmUniqueID": function(text) {
				json[index].nlmid = text;
			},
			"ISSNLinking": function(text) {
				json[index].journal.lissn = text;
			},
			"KeywordList": function(text) {
				if(typeof json[index].keywordList !== "object") {
					json[index].keywordList = new Array( { "owner": nodeData.attributes.Owner, "list": new Array() } );
				} else {
					json[index].keywordList.push( { "owner": nodeData.attributes.Owner, "list": new Array() } );
				}
			},
			"Keyword": function(text) {
				json[index].keywordList[json[index].keywordList.length-1].list.push( { "major": ( nodeData.attributes.MajorTopicYN === "Y" ? true : false ) } );
				json[index].keywordList[json[index].keywordList.length-1].list[json[index].keywordList[json[index].keywordList.length-1].list.length-1].text = text;
			},
			"_default": function(text) {
				console.log(JSON.stringify(nodeData));
				console.log(text);
			}
		};

	parser.on("opentag", function(data) { // Runs when an XML tag is opened. The data variable contains the name of the tag and it's attributes.
		whereAmI.push(data.name);
		whereIndex++;
		nodeData = data;
	});
	parser.on("closetag", function(nodeName) { // Runs when an XML tag is closed.
		whereAmI.pop();
		whereIndex--;
	});
	parser.on("text", function(text) { // Runs when there is text in an XML tag, not an attribute.
		// The following two lines fixes the bug in sax when text is run twice, once when the tag opens and once when the tag closes.
		if(whereAmI.length > 0) {
			if(whereAmI[whereAmI.length-1] === nodeData.name) {
				textParser[whereAmI[whereIndex]] ? textParser[whereAmI[whereIndex]](text) : textParser._default(text);
			}
		}
	});
	parser.on("end", function(text) { // Runs when all the XML processing is done.
		console.log("\nEND JSON:\n");
		console.log(JSON.stringify(json)); // Output to JSON in the console.
	});

	fs.createReadStream('./example.xml').pipe(parser); // Pipes the readstream of example.xml to the XML parser.

}());