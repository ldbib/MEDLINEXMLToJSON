m2json = require("./app.js");

m2json.parse("../test", function(err, str) {
	if(str === null) {
		console.log("STR IS NULL");
	} else if(typeof str === "string") {
		console.log("STR IS A STRING");
	}
	m2json.parse("../LICENSE", function(err, str) {
		if(str === null) {
			console.log("STR IS NULL");
		} else if(typeof str === "string") {
			console.log("STR IS A STRING");
		}
		m2json.parse("./doesnt-exits.xml", function(err, str) {
			if(str === null) {
				console.log("STR IS NULL");
			} else if(typeof str === "string") {
				console.log("STR IS A STRING");
			}
			m2json.parse("./extensive-test.xml", function(err, str) {
				if(str === null) {
					console.log("STR IS NULL");
				} else if(typeof str === "string") {
					console.log("STR IS A STRING");
				}
			});
		});
	});
});