/*

MEDLINE XML To JSON 1.2.1

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

var fs 			= require("fs"),
	sax 		= require("sax");

exports.parse = function(pathOrPipe, constantCallback, callback) {
	"use strict";

	if(typeof callback !== "function") {
		callback = constantCallback;
		constantCallback = false;
	}

	// We use the steam functionality of sax since the MEDLINE files tend to be quite large and to load a 100MB large XML file 
	// into memory is a bad idea when Node.js can process it on the go saving memory.
	var XMLParser = sax.createStream(true, { // true means XML parsing
		//trim: true, // Trims text and comment nodes
		normalize: true // Turnes any whitespace into a single space
	});

	var json 	= new Array(),
		whereAmI = new Array(),
		errorHappened = false,
		fileSteam,
		lastDateTag = "",
		nodeData = null,
		ignoreTags = [ "MedlineCitationSet", "Journal", "Pagination", "PublicationTypeList", "MedlineJournalInfo" ], // tags to ignore text processing on
		parser = {
			"DeleteCitation": function(text) {
				json.push({
					"delete": [ ]
				});
			},
			"MedlineCitation": function(text) {
				json.push({
					"owner": 	nodeData.attributes.Owner,
					"status": 	nodeData.attributes.Status,
					"_id": null,
					"dates": {
						"created": { }
					},
					"pubModel": null,
					"article": null,
					"journal": {
						"title": null,
						"isoAbbreviation": null,
						"issn": null,
						"eissn": null,
						"lissn": null, // Linked issn
						"citedMedium": null, // Internet/Print
						"pubDate": {
							"year": null
						}
					},
					"pagnation": {
						"fp": null, // First Page
						"lp": null, // Last Page
					},
					"language": [ ],
					"pubtype": [ ],
					"medlineAbbreviation": null
				});
			},
			"PMID": function(text) {
				if(whereAmI[whereAmI.length-2] === "MedlineCitation") {
					json[json.length-1]._id = ifNumRetNumElseRetStr(text);
					json[json.length-1].pmidVersion = ifNumRetNumElseRetStr(nodeData.attributes.Version);
				} else if(whereAmI[whereAmI.length-2] === "DeleteCitation") {
					json[json.length-1].delete.push( { "pmid": ifNumRetNumElseRetStr(text), "version": ifNumRetNumElseRetStr(nodeData.attributes.Version) } );
				} else if(whereAmI[whereAmI.length-2] === "CommentsCorrections") {
					json[json.length-1].commentsCorrections[json[json.length-1].commentsCorrections.length-1].pmid = ifNumRetNumElseRetStr(text);
					json[json.length-1].commentsCorrections[json[json.length-1].commentsCorrections.length-1].pmidVersion = ifNumRetNumElseRetStr(nodeData.attributes.Version);
				}
			},
			"DateCreated": function(text) { lastDateTag = "created"; },
			"DateCompleted": function(text) { lastDateTag = "completed"; json[json.length-1].dates.completed = { } },
			"DateRevised": function(text) { lastDateTag = "revised"; json[json.length-1].dates.revised = { } },
			"PubDate": function(text) { lastDateTag = "pubdate"; },
			"ArticleDate": function(text) {
				lastDateTag = "articleDate";
				if(typeof json[json.length-1].articleDate !== "object") {
					json[json.length-1].articleDate = new Array( {} );
				} else {
					json[json.length-1].articleDate.push( {} );
				}
			},
			"Year": function(text) { dateInsertion(ifNumRetNumElseRetStr(text), "year"); },
			"Month": function(text) { dateInsertion(ifNumRetNumElseRetStr(text), "month"); },
			"Day": function(text) { dateInsertion(ifNumRetNumElseRetStr(text), "day"); },
			"Season": function(text) { dateInsertion(text, "season"); },
			"MedlineDate": function(text) { dateInsertion(text, "medlineDate"); },
			"Article": function(text) { json[json.length-1].pubModel = nodeData.attributes.PubModel; },
			"Volume": function(text) { json[json.length-1].journal.volume = ifNumRetNumElseRetStr(text); },
			"Issue": function(text) { json[json.length-1].journal.issue = ifNumRetNumElseRetStr(text); },
			"ArticleTitle": function(text) { json[json.length-1].article = text; },
			"VernacularTitle": function(text) { json[json.length-1].vernacularTitle = text; },
			"MedlinePgn": function(text) { // Split it up into first page and last page
				text = text.split("-");
				json[json.length-1].pagnation.fp = ifNumRetNumElseRetStr(text[0]);
				if(text[1]) {
					json[json.length-1].pagnation.lp = ifNumRetNumElseRetStr(text[1]);
				}
			},
			"JournalIssue": function(text) { json[json.length-1].journal.citedMedium = nodeData.attributes.CitedMedium },
			"ELocationID": function(text) {
				if(typeof json[json.length-1].elocation !== "object") {
					json[json.length-1].elocation = new Array( { "type": nodeData.attributes.EIdType, "value": ifNumRetNumElseRetStr(text) } );
				} else {
					json[json.length-1].elocation.push( { "type": nodeData.attributes.EIdType, "value": ifNumRetNumElseRetStr(text) } );
				}
			},
			"Abstract": function(text) { json[json.length-1].abstract = {}; },
			"OtherAbstract": function(text) {
				if(typeof json[json.length-1].otherAbstracts !== "object") {
					json[json.length-1].otherAbstracts = new Array( { "type": nodeData.attributes.Type, "language": nodeData.attributes.Language } );
				} else {
					json[json.length-1].otherAbstracts.push( { "type": nodeData.attributes.Type, "language": nodeData.attributes.Language } );
				}
			},
			"AbstractText": function(text) {
				if(whereAmI[whereAmI.length-2] === "Abstract") {
					if(typeof json[json.length-1].abstract.abstracts !== "object") {
						json[json.length-1].abstract.abstracts = new Array( { "text": text, "label": nodeData.attributes.Label, "nlmCategory": nodeData.attributes.NlmCategory } );
					} else {
						json[json.length-1].abstract.abstracts.push( { "text": text, "label": nodeData.attributes.Label, "nlmCategory": nodeData.attributes.NlmCategory } );
					}
				} else if(whereAmI[whereAmI.length-2] === "OtherAbstract") {
					if(typeof json[json.length-1].otherAbstracts[json[json.length-1].otherAbstracts.length-1].abstracts !== "object") {
						json[json.length-1].otherAbstracts[json[json.length-1].otherAbstracts.length-1].abstracts = new Array( { "text": text, "label": nodeData.attributes.Label, "nlmCategory": nodeData.attributes.NlmCategory } );
					} else {
						json[json.length-1].otherAbstracts[json[json.length-1].otherAbstracts.length-1].abstracts.push( { "text": text, "label": nodeData.attributes.Label, "nlmCategory": nodeData.attributes.NlmCategory } );
					}
				}
			},
			"CopyrightInformation": function(text) {
				if(whereAmI[whereAmI.length-2] === "Abstract") {
					json[json.length-1].abstract.copyright = text;
				} else if(whereAmI[whereAmI.length-2] === "OtherAbstract") {
					json[json.length-1].otherAbstracts[json[json.length-1].otherAbstracts.length-1].copyright = text;
				}
			},
			"ChemicalList": function(text) { json[json.length-1].chemicals = new Array(); },
			"Chemical": function(text) { json[json.length-1].chemicals.push( { } ); },
			"RegistryNumber": function(text) { json[json.length-1].chemicals[json[json.length-1].chemicals.length-1].registryNumber = ifNumRetNumElseRetStr(text); },
			"NameOfSubstance": function(text) { json[json.length-1].chemicals[json[json.length-1].chemicals.length-1].nameOfSubstance = text; },
			"GrantList": function(text) {
				if(typeof nodeData.attributes.CompleteYN === "string") {
					json[json.length-1].grantList = { "list": new Array(), "complete": nodeData.attributes.CompleteYN === "N" ? false : true };
				} else {
					json[json.length-1].grantList = { "list": new Array() };
				}
			},
			"Grant": function(text) { json[json.length-1].grantList.list.push( { } ); },
			"GrantID": function(text) { grantInsertion(ifNumRetNumElseRetStr(text), "grantID"); },
			"Acronym": function(text) { grantInsertion(text, "acronym"); },
			"Agency": function(text) { grantInsertion(text, "agency"); },
			"Country": function(text) {
				if(whereAmI[whereAmI.length-2] === "MedlineJournalInfo") {
					json[json.length-1].country = text;
				} else if(whereAmI[whereAmI.length-2] === "Grant") {
					grantInsertion(text, "country");
				}
				
			},
			"Language": function(text) { json[json.length-1].language.push(text); },
			"ISSN": function(text) { json[json.length-1].journal[(nodeData.attributes.IssnType === "Electronic" ? "eissn" : "issn")] = text; },
			"Title": function(text) { json[json.length-1].journal.title = text; }, // Journal Title
			"ISOAbbreviation": function(text) { json[json.length-1].journal.isoAbbreviation = text; },
			"AuthorList": function(text) {
				if(typeof nodeData.attributes.CompleteYN === "string") {
					json[json.length-1].authors = { "list": new Array( ), "complete": nodeData.attributes.CompleteYN === "N" ? false : true };
				} else {
					json[json.length-1].authors = { "list": new Array( ) };
				}
			},
			"Author": function(text) {
				if(typeof nodeData.attributes.ValidYN === "string") {
					json[json.length-1].authors.list.push( { "valid": nodeData.attributes.ValidYN === "N" ? false : true } );
				} else {
					json[json.length-1].authors.list.push( { } );
				}
			},
			"LastName": function(text) { personInsertion(text, "lastName"); },
			"ForeName": function(text) { personInsertion(text, "firstName"); },
			"Initials": function(text) { personInsertion(text, "initials"); },
			"Suffix": function(text) { personInsertion(text, "suffix"); },
			"CollectiveName": function(text) { personInsertion(text, "collectiveName"); },
			"Identifier": function(text) {
				if(whereAmI[whereAmI.length-2] === "Author") {
					json[json.length-1].authors.list[json[json.length-1].authors.list.length-1].identifier = { "text": text, "source": nodeData.attributes.Source };
				} else if(whereAmI[whereAmI.length-2] === "Investigator") {
					json[json.length-1].investigators[json[json.length-1].investigators.length-1].identifier = { "text": text, "source": nodeData.attributes.Source };
				}
			},
			"Affiliation": function(text) { personInsertion(text, "affiliation"); },
			"PublicationType": function(text) { json[json.length-1].pubtype.push(text); },
			"MedlineTA": function(text) { json[json.length-1].medlineAbbreviation = text; },
			"NlmUniqueID": function(text) { json[json.length-1].nlmID = ifNumRetNumElseRetStr(text); },
			"OtherID": function(text) {
				if(typeof json[json.length-1].otherID !== "object") {
					json[json.length-1].otherID = new Array( { "source": nodeData.attributes.Source, "text": text } );
				} else {
					json[json.length-1].otherID.push( { "source": nodeData.attributes.Source, "text": text } );
				}
			},
			"ISSNLinking": function(text) { json[json.length-1].journal.lissn = text; },
			"KeywordList": function(text) {
				if(typeof json[json.length-1].keywordList !== "object") {
					json[json.length-1].keywordList = new Array( { "owner": nodeData.attributes.Owner, "list": new Array( ) } );
				} else {
					json[json.length-1].keywordList.push( { "owner": nodeData.attributes.Owner, "list": new Array( ) } );
				}
			},
			"Keyword": function(text) {
				if(typeof nodeData.attributes.MajorTopicYN === "string") {
					json[json.length-1].keywordList[json[json.length-1].keywordList.length-1].list.push({
						"major": ( nodeData.attributes.MajorTopicYN === "Y" ? true : false ),
						"text": text
					});
				} else {
					json[json.length-1].keywordList[json[json.length-1].keywordList.length-1].list.push( { "text": text } );
				}
			},
			"DataBankList": function(text) {
				if(typeof nodeData.attributes.CompleteYN === "string") {
					json[json.length-1].dataBankList = {"list": new Array(), "complete": nodeData.attributes.CompleteYN === "N" ? false : true };
				} else {
					json[json.length-1].dataBankList = {"list": new Array() };
				}
			},
			"DataBank": function(text) { json[json.length-1].dataBankList.list.push( { } ); },
			"DataBankName": function(text) {
				json[json.length-1].dataBankList.list[json[json.length-1].dataBankList.list.length-1].name = text;
			},
			"AccessionNumberList": function(text) {
				json[json.length-1].dataBankList.list[json[json.length-1].dataBankList.list.length-1].accessionNumbers = new Array( );
			},
			"AccessionNumber": function(text) {
				json[json.length-1].dataBankList.list[json[json.length-1].dataBankList.list.length-1].accessionNumbers.push(ifNumRetNumElseRetStr(text));
			},
			"SupplMeshList": function(text) {
				json[json.length-1].supplMeshList = new Array( );
			},
			"SupplMeshName": function(text) {
				json[json.length-1].supplMeshList.push( { "type": nodeData.attributes.Type, "name": text } );
			},
			"CitationSubset": function(text) {
				if(typeof json[json.length-1].citationSubset !== "object") {
					json[json.length-1].citationSubset = new Array( text );
				} else {
					json[json.length-1].citationSubset.push( text );
				}
			},
			"CommentsCorrectionsList": function(text) {
				json[json.length-1].commentsCorrections = new Array( );
			},
			"CommentsCorrections": function(text) { json[json.length-1].commentsCorrections.push( { "refType": nodeData.attributes.RefType } ); },
			"RefSource": function(text) {
				json[json.length-1].commentsCorrections[json[json.length-1].commentsCorrections.length-1].refSource = text;
			},
			"Note": function(text) {
				json[json.length-1].commentsCorrections[json[json.length-1].commentsCorrections.length-1].note = text;
			},
			"GeneSymbolList": function(text) {
				json[json.length-1].geneSymbols = new Array( );
			},
			"GeneSymbol": function(text) { json[json.length-1].geneSymbols.push( text ); },
			"MeshHeadingList": function(text) {
				json[json.length-1].meshHeadings = new Array( );
			},
			"MeshHeading": function(text) {
				json[json.length-1].meshHeadings.push( { } );
			},
			"DescriptorName": function(text) {
				if(typeof nodeData.attributes.MajorTopicYN === "string") {
					json[json.length-1].meshHeadings[json[json.length-1].meshHeadings.length-1].descriptorName = {
						"text": 		text,
						"majorTopic": 	nodeData.attributes.MajorTopicYN === "Y" ? true : false,
						"type": 		nodeData.attributes.Type
					};
				} else {
					json[json.length-1].meshHeadings[json[json.length-1].meshHeadings.length-1].descriptorName = {
						"text": 		text,
						"type": 		nodeData.attributes.Type
					};
				}
			},
			"QualifierName": function(text) {
				if(typeof nodeData.attributes.MajorTopicYN === "string") {
					json[json.length-1].meshHeadings[json[json.length-1].meshHeadings.length-1].qualifierName = {
						"text": 		text,
						"majorTopic": 	nodeData.attributes.MajorTopicYN === "Y" ? true : false
					};
				} else {
					json[json.length-1].meshHeadings[json[json.length-1].meshHeadings.length-1].qualifierName = {
						"text": 		text
					};
				}
			},
			"NumberOfReferences": function(text) { json[json.length-1].numberOfReferences = text; },
			"PersonalNameSubjectList": function(text) { json[json.length-1].personalNameSubjects = new Array( ); },
			"PersonalNameSubject": function(text) { json[json.length-1].personalNameSubjects.push( { } ); },
			"SpaceFlightMission": function(text) {
				if(typeof json[json.length-1].spaceFlightMission !== "object") {
					json[json.length-1].spaceFlightMission = new Array( text );
				} else {
					json[json.length-1].spaceFlightMission.push( text );
				}
			},
			"InvestigatorList": function(text) { json[json.length-1].investigators = new Array(); },
			"Investigator": function(text) {
				if(typeof nodeData.attributes.ValidYN === "string") {
					json[json.length-1].investigators.push( { "valid": nodeData.attributes.ValidYN === "N" ? false : true } );
				} else {
					json[json.length-1].investigators.push( { } );
				}
			},
			"GeneralNote": function(text) {
				if(typeof json[json.length-1].generalNote !== "object") {
					json[json.length-1].generalNote = new Array( { "note": text, "owner": nodeData.attributes.Owner } );
				} else {
					json[json.length-1].generalNote.push( { "note": text, "owner": nodeData.attributes.Owner } );
				}
			},
			"_default": function(text) {
				// Commented away this code since it was used for debugging the XML nodes. Will be useful if the MEDLINE DTD changes again.
				/*console.log(JSON.stringify(nodeData));
				if(text.trim().length > 0) {
					console.log(text);
				}*/
			}
		};

	XMLParser.on("opentag", function(data) { // Runs when an XML tag is opened. The data variable contains the name of the tag and it's attributes.
		whereAmI.push(data.name);
		nodeData = data;
	});
	XMLParser.on("closetag", function(nodeName) { // Runs when an XML tag is closed.
		whereAmI.pop();
		if(constantCallback) {
			if(whereAmI.length === 1) {
				callback(null, JSON.stringify(json.pop()));
			}
		}
	});
	XMLParser.on("text", function(text) { // Runs when there is text in an XML tag, not an attribute.
		// The following two lines fixes the bug in sax when text is run twice, once when the tag opens and once when the tag closes.
		if(whereAmI.length > 0) {
			if(whereAmI[whereAmI.length-1] === nodeData.name) {
				if(ignoreTags.indexOf(nodeData.name) === -1) { // Ignore text processing of the tags in the ignoreTags array
					parser[nodeData.name] ? parser[nodeData.name](text) : parser._default(text);
				}
			}
		}
	});
	XMLParser.on("end", function(text) { // Runs when all the XML processing is done.
		if(!constantCallback) {
			callback(null, JSON.stringify(json));
		}
	});
	XMLParser.on("error", function(error) { // Error happended
		// Stop it from calling callback more than once.
		// You can't stop the parsing (what I know of) since it's a continous stream, you can stop the stream from writing though
		if(errorHappened) {
			return;
		}
		errorHappened = true;
		console.error(error);
		if(typeof pathOrPipe === "string") {
			fileSteam.unpipe(XMLParser); // Unpipe the stream to avoid writing more data to it.
		}
		callback("File is not a correct XML file.", null);
	});

	if(typeof pathOrPipe === "string") { // assume that input is a file
		fs.stat(pathOrPipe, function(err, stats) {
			if(err) {
				return callback("File does not exist!", null);
			}
			if(stats.isFile()) {
				try {
					fileSteam = fs.createReadStream(pathOrPipe);
					fileSteam.pipe(XMLParser); // Pipes the readstream of path to the XML parser.
				} catch (error) {
					callback("File does not exist!", null);
				}
			} else {
				callback("Path is not a file!", null);
			}
		});
	} else { // assume that input is a stream
		pathOrPipe.pipe(XMLParser);
	}

	function dateInsertion(text, type) {
		if(["created", "completed", "revised"].indexOf(lastDateTag) !== -1) {
			json[json.length-1].dates[lastDateTag][type] = text;
		} else if(lastDateTag === "pubdate") {
			json[json.length-1].journal.pubDate[type] = text;
		} else if(lastDateTag === "articleDate") {
			json[json.length-1].articleDate[json[json.length-1].articleDate.length-1][type] = text;
		}
	}

	function personInsertion(text, type) {
		if(whereAmI[whereAmI.length-2] === "Author") {
			json[json.length-1].authors.list[json[json.length-1].authors.list.length-1][type] = text;
		} else if(whereAmI[whereAmI.length-2] === "PersonalNameSubject") {
			json[json.length-1].personalNameSubjects[json[json.length-1].personalNameSubjects.length-1][type] = text;
		} else if(whereAmI[whereAmI.length-2] === "Investigator") {
			json[json.length-1].investigators[json[json.length-1].investigators.length-1][type] = text;
		} else if(whereAmI[whereAmI.length-2] === "AffiliationInfo" && whereAmI[whereAmI.length-3] === "Author") {
			json[json.length-1].authors.list[json[json.length-1].authors.list.length-1][type] = text;
		}

	}

	function grantInsertion(text, type) {
		json[json.length-1].grantList.list[json[json.length-1].grantList.list.length-1][type] = text;
	}

	var rNumber = RegExp("[^0-9]");

	function ifNumRetNumElseRetStr(n) {

		if(rNumber.test(n)) {
			return n;
		}

		var nn = parseFloat(n, 10);

		if(typeof nn === "number" && isFinite(nn)) {
			return nn;
		} else {
			return n;
		}
	}
}
