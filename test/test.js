m2json = require("../lib/app.js");

console.log('Current directory: ' + process.cwd());
if(process.cwd().substr(process.cwd().length-4) !== "test") { // if testing with npm test we need to change directory to the test directory
	process.chdir('./test');
	console.log('Entered test directory: ' + process.cwd());
}

m2json.parse("../test", function(err, str) {
	if(str === null) {
		console.log("Directory test successful!");
	} else {
		console.log("ERROR: Directory test unsuccessful!");
		process.exit(1);
	}
	m2json.parse("../LICENSE", function(err, str) {
		if(str === null) {
			console.log("Non XML test successful!");
		} else {
			console.log("ERROR: Non XML test unsuccessful!");
			process.exit(1);
		}
		m2json.parse("./doesnt-exits.xml", function(err, str) {
			if(str === null) {
				console.log("Non existing file test successful!");
			} else {
				console.log("ERROR: Non existing file test unsuccessful!");
				process.exit(1);
			}
			m2json.parse("./extensive-test.xml", function(err, str) {
				if(typeof str === "string") {
					console.log("Proper XML file test successful!");
				} else {
					console.log("ERROR: Proper XML file test unsuccessful!");
					process.exit(1);
				}
			});
		});
	});
});