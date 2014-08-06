/*

Copyright 2014 Emil Hemdal <emil(at)hemdal(dot)se>
Copyright 2014 Landstinget Dalarna Bibliotek och informationscentral <webmaster(dot)lasarettsbiblioteken(at)ltdalarna(dot)se>

This file is part of MEDLINEXMLToJSON.

Foobar is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Foobar is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with Foobar.  If not, see <http://www.gnu.org/licenses/>.

*/

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