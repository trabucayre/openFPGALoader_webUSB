//import { runOpenFPGALoader     } from 'https://cdn.jsdelivr.net/npm/@yowasp/openfpgaloader/gen/bundle.js';
import { runOpenFPGALoader     } from './bundle.js';
import { lineBuffered, chunked } from 'https://cdn.jsdelivr.net/npm/@yowasp/runtime/lib/util.js';

var list_boards = {};

await fill_cables();
await fill_boards();

const demo = document.getElementById('demo');
const demo2 = document.getElementById('demo2');

try {
	const response = await runYosys(["--version"]);
    const data = await response.json();
	demo.textcontent = '<font color="green">' + data + '</font>';
	demo2.textcontent = '<font color="green">' + data + '</font>';
	console.log(data);
}
catch (err) {
	var span1 = document.createElement("mess1");
	span1.innerHTML = "</br>Truc";
	span1.style.color = "black";
	var span2 = document.createElement("mess2");
	span2.innerHTML = "Error " + err.message;
	span2.style.color = "red";

	demo.innerHTML = 'Plop: <font color="red">error ' + err.message + ' blabla</font>';
	//demo2.textContent = '<span style="color:red">error ' + err.message + '</span>';
	demo2.appendChild(span1);
	demo2.appendChild(span2);
	console.log("plop");
}

const detectButton  = document.getElementById('detectButton');
const connectButton = document.getElementById('connectButton');
const programButton = document.getElementById('programButton');
const select_cable  = document.getElementById('cable_select');
const USBStatus     = document.getElementById('USBStatus');
const oflOpStatus   = document.getElementById('oflOpStatus');
let device          = null;

async function ofl_exec(args, div_id, fileIn={}, verbose=true) {
	const OFLStatus = document.getElementById('OFLStatus');
	let lines       = [];
	let lines_err   = [];
	const div_log   = document.getElementById(div_id);

	OFLStatus.innerHTML = 'Status: Loading bitstream...';

	if (!device) {
		console.log("device null");
		device = await navigator.usb.requestDevice({ filters: [] });
	}
	div_log.innerHTML = "";

	try {
		const response = await runOpenFPGALoader(args, fileIn,
			{
				stdout:lineBuffered((line) => lines.push(line)),
				stderr:lineBuffered((line) => lines_err.push(line)),
				decodeASCII: true
			}
		);
		lines.map((line, i) => {
			if (verbose) {
				console.log(line);
			}
			div_log.innerHTML += line + "</br>\n";
		});
		OFLStatus.innerHTML = 'Status: FPGA programmed successfully!';
	} catch(error) {
        console.error(error);
		OFLStatus.textContent = `Status: Error programming - ${error.message}`;
	}
	console.log(lines);
	console.log(lines_err);
	return lines;
}

async function fill_cables() {
	const select_cable = document.getElementById('cable_select');
	let lines          = [];
	const response = await runOpenFPGALoader(["--list-cables"],
		{},
		{
			stdout:lineBuffered((line) => lines.push(line)),
			stderr:console.log, decodeASCII: true
		}
	);
	lines = lines.slice(2); // remove some messages
	lines.map( (line, i) => {
	    let opt       = document.createElement("option");
		const cable   = line.split(' ')[0];
	    opt.value     = i + 1; // the index
	    opt.innerHTML = cable;
	    select_cable.append(opt);
	});
}
async function fill_boards() {
	const select_board = document.getElementById('board_select');
	let lines = [];
	const response = await runOpenFPGALoader(["--list-boards"],
		{},
		{
			stdout:lineBuffered((line) => lines.push(line)),
			stderr:console.log, decodeASCII: true
		}
	);
	lines = lines.slice(2);
	lines.map( (line, i) => {
	    let opt       = document.createElement("option");
		const line_s  = line.replace(/  +/g, ' ').split(" ");
		const board   = line_s[0];
	    opt.value     = i + 1; // the index
	    opt.innerHTML = board;
	    select_board.append(opt);
		list_boards[board] = {"cable": line_s[1], "fpga_part": line_s[2]};
	});
	//for (const [key, value] of Object.entries(list_boards)) {
	//	console.log("%s %s %s", key, value["cable"], value["fpga_part"]);
	//}
}

document.getElementById('programButtonManual').addEventListener('click', async function () {
	console.log(document.getElementById("fileInput").files[0])
	let file     = document.getElementById("fileInput").files[0];
	var filename = null;
	let reader   = new FileReader();
	var cmd      = ["-c", "digilent", "-f", "--detect"];
	//var cmd        = ofl_cmd.value.split(' ');
	console.log("hello");

	//cmd.push("--fpga-part");
	//cmd.push("xc7a35tcsg324");
	cmd.push("--board");
	cmd.push("arty");

	// Clear status area.
	oflOpStatus.innerHTML = "";

	// Detect if command if to flash a bitstream
	// if so, detectSpiOverJtagName will return spiOverJtag bitstream
	// name, otherwise ""
	const ret           = await detectSpiOverJtagName(cmd);
	var soj_name        = ret[1];
	const ret_code      = ret[0];
	var soj_fileContent = null;
	// FIXME: todo something with return code.
	var detect_status = "";
	var mess          = "SpiOverJtag Bridge: ";
	if (ret_code < 0) {
		detect_status = "<font color=#ff0000>>Error to detect FPGA part: can't flash bitstream</font>";
		mess += '<font color="red">Error. Please adds --fpga-part option or --board</font>';
		return;
	} else if (ret_code == 0) {
		detect_status = "SpiOverJtag not required";
		mess += '<font color="blue">Not required.</font>'
	} else {
		mess += '<font color="green">Ok (' + soj_name + ').</font>'
		detect_status = "FPGA Part detected " + soj_name + " method: "
		if (ret_code == 1) {
			detect_status += "--fpga_part option";
		} else if (ret_code == 2) {
			detect_status += "board list entry";
		} else if (ret_code == 3) {
			detect_status += "FPGA detection with --detect option";
		}
	}
	console.log(detect_status);
	oflOpStatus.innerHTML += mess + "</br>";
	//soj_name +=".t"
	var span_soj_dl = document.createElement("span_soj_dl");
	oflOpStatus.appendChild(span_soj_dl);
	if (soj_name) {
		// read bitstream from the server to be used by utils when
		// openFPGALoader will be executed
		const soj_file_url = "spiOverJtag/" + soj_name;
		span_soj_dl.innerHTML = 'Fetch SpiOverJtag Bridge:';
		await readBinaryFileFromUrl(soj_file_url).then(uint8Array => {
		    if (uint8Array) {
				span_soj_dl.innerHTML = 'Fetch SpiOverJtag Bridge: <font color="green">Done</font>';
				soj_fileContent = uint8Array;
		    } else {
				span_soj_dl.innerHTML = 'Fetch SpiOverJtag Bridge: <font color="red">Fail</font>';
				return;
			}
		});
	} else {
		span_soj_dl.innerHTML = 'Fetch SpiOverJtag Bridge: <font color="blue">Not required</font>';
	}

	//reader.onload = function (event) {
	//	const binaryData  = new Uint8Array(event.target.result);
	//	const fileContent = binaryData;
	//	const ofl_cmd     = document.getElementById("ofl_cmd")
	//	var fileData      = {};
	//	if (soj_name == "") {
	//		fileData      = {[filename]: fileContent};
	//	} else {
	//		console.log(soj_fileContent);
	//		fileData      = {
	//			[filename]: fileContent,
	//			[soj_name]: soj_fileContent,
	//		};
	//		cmd.push("--bridge");
	//		cmd.push(soj_name);
	//	}
	//	cmd.push("--quiet");
	//	cmd.push(filename);
	//
	//	var span_ofl_exec = document.createElement("span_ofl_exec");
	//	oflOpStatus.appendChild(span_ofl_exec);
	//	span_soj_dl.innerHTML = 'Execute openFPGALoader:';
	//
	//	document.getElementById("oflCmdManual").textContent = "openFPGALoader" + cmd.join(" ")
	//	try {
	//		ofl_exec(cmd, "demo", fileData, true);
	//		span_soj_dl.innerHTML = 'Execute openFPGALoader: <font color="green">Done</font>';
	//	} catch (error) {
	//		console.error(errror);
	//		span_soj_dl.innerHTML = 'Execute openFPGALoader: <font color="red">Fail</font>';
	//	}
	//};

	//if (!soj_name || (soj_name && soj_fileContent != null))
	//	reader.readAsArrayBuffer(file);
	var fileContent = null;
	console.log(file);
	if (file) {
		await readBinaryFileFromHost(file).then(uint8Array => {
			if (uint8Array) {
				fileContent = uint8Array;
			} else {
				console.log("error");
			}
		});
		console.log(fileContent);
	}
	if (!soj_name || (soj_name && soj_fileContent != null)) {
	}
});

// Handle program button click
programButton.addEventListener('click', async () => {
	const cable     = document.getElementById("cable_select");
	const board     = document.getElementById("board_select");
	const tgt_flash = document.getElementById("ofl_flash").checked;
	const tgt_sram  = document.getElementById("ofl_sram").checked;
	const verify    = document.getElementById("ofl_verify").checked;
	const file      = document.getElementById("fileAutoInput").files[0];

	var cmd = ["--quiet"]
	if (cable.selectedIndex > 0) {
		cmd.push("-c");
		cmd.push(cable.options[cable.selectedIndex].text);
	}
	if (board.selectedIndex > 0) {
		cmd.push("-b");
		cmd.push(board.options[board.selectedIndex].text);
	}
	if (tgt_flash) {
		cmd.push("-f")
		if (verify)
			cmd.push("--verify")
	}
	console.log(cmd.join(" "))

	const filename = file.name;
	let reader     = new FileReader();

	reader.onload = function (event) {
		const binaryData      = new Uint8Array(event.target.result);
		const fileContent     = binaryData;
		const fileData        = {[filename]: fileContent};
		cmd.push(filename);
		document.getElementById("oflCmdManual").textContent = "openFPGALoader" + cmd.join(" ")
		try {
			ofl_exec(cmd, "demo", fileData, true);
		} catch (error) {
			console.error(errror);
		}
	};

	reader.readAsArrayBuffer(file);
});

// Try to detect FPGA Vendor/Model
// cmd_line must be a list
// return a list with the first argument is a status and second the
// FPGA code.
// -3: no device found.
// -2: generic error.
// -1: No full part_part for a non Xilinx Artix or Spartan7
// 0: Not flash action
// 1: fpga_part found by option
// 2: fpga_part found by board entry
// 3: fpga_part found via --detect
async function detectSpiOverJtagName(cmd_line)
{
	var ret_status = 0;
	var soj_name   = "";
	console.log(cmd_line);

	// search If the command contains flash argument (-f or --flash).
	if (!(cmd_line.includes("-f") || cmd_line.includes("--flash"))) {
		return [ret_status, ""];
	}

	// command to send if it's not possible to deduces part from
	// the command line.
	var search_cmd = ["--detect"];

	// First quick try: user has provided part
	if (cmd_line.indexOf("--fpga-part") != -1) {
		const part = cmd_line[cmd_line.indexOf("--fpga-part") + 1];
		ret_status = 1;
		soj_name   = part;
		return [ret_status, "spiOverJtag_" + part + ".bit.gz"];
	}

	// For Xilinx, altera and efinix the board entry MUST
	// provides fpga_part

	var board_index = cmd_line.indexOf("-b");
	if (board_index == -1)
		board_index = cmd_line.indexOf("--board");
	if (board_index != -1) {
		const board_name = cmd_line[board_index + 1];
		const fpga_part  = list_boards[board_name]["fpga_part"];
		search_cmd.push("-b");
		search_cmd.push(board_name);
		if (fpga_part != "Undefined")
			return [2, "spiOverJtag_" + fpga_part + ".bit.gz"];
	}

	// No --fpga_part option nor board or board without
	// fpga_part section: extract information from
	// openFPGALoader with --detect option
	// FIXME: more than one device is not supported.

	// Search for short/long cable argument
	var cable_index = cmd_line.indexOf("-c");
	if (cable_index == -1)
		cable_index = cmd_line.indexOf("--cable");
	if (cable_index != -1) {
		search_cmd.push("-c");
		search_cmd.push(cmd_line[cable_index + 1]);
	}

	if (ret_status != 1 && ret_status != 2) {
		// Executes --detect command to have manufacturer name and
		// FPGA Model
		const lines        = await ofl_exec(search_cmd, "demo", [], false);

		// Extracts vendor and Model
		const vendor_index = lines.findIndex(findManufacturer);
		const model_index  = lines.findIndex(findModel);

		// No device found
		if (vendor_index == -1)
			return [-3, ""];

		const t = lines[vendor_index].replace(/  +/g, ' ').split(" ")[1].toLowerCase();
		if (t == "xilinx") {
			if (ret_status == 0) {
				var tt       = lines[model_index].replace(/  +/g, ' ').split(" ")[1];
				// Only Xilinx Artix7 and Spartan7 have a generic spiOverJtag bitstream
				// per size.
				if (!(tt.includes("xc7a") || tt.includes("xc7s")))
					return [-1, ""];
				if (tt == "xc7a35")
					tt = "xc7a35t";
				soj_name   = "spiOverJtag_" + tt + ".bit.gz";
				ret_status = 3;
				console.log(tt);
				console.log("requires spiOverJtag: "+ soj_name);
			}
		// For Efinix & Altera FPGA model must be fully provided
		} else if (t == "efinix" || t == "altera") {
			console.log("Error: spiOverJtag bitstream must be specified");
			return [-1, ""];
		}
		// Nothing to do for FPGA with internal SPI Flash access logic.
	}

	if (ret_status > 0)
		soj_name = "spiOverJtag" + soj_name + ".bit.gz";

	return [ret_status, soj_name]
}
function findManufacturer(l) {
	return l.includes("manufacturer");
}
function findModel(l) {
	return l.includes("model");
}

async function readBinaryFileFromUrl(url) {
    try {
        const response = await fetch(url);
        if (!response.ok)
            throw new Error(`HTTP error! status: ${response.status}`);
		const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        return uint8Array;
    } catch (error) {
        console.error('Error reading file:', error);
        return null;
    }
}

function readBinaryFileFromHost(file) {
	return new Promise((resolve, reject) => {
		var reader = new FileReader();

		reader.onload = function (evt) {
			resolve(new Uint8Array(evt.target.result));
		};

		reader.onerror = function (evt) {
			reject("File reading failed");
		};

		try {
			reader.readAsArrayBuffer(file);
		} catch (error) {
			console.error('Error reading file:', error);
			return null;
		}
	});
}

// Handle device disconnection
navigator.usb.addEventListener('disconnect', (event) => {
	console.log("disconnect");
    if (event.device === device) {
        USBStatus.textContent = 'Status: Device disconnected';
        device = null;
    }
});

navigator.usb.addEventListener('connect', (event) => {
	console.log("connect");
	//if (event.device === device) {
//    if (!device) {
        USBStatus.textContent = 'Status: Device connected';
//        programButton.disabled = true;
//        connectButton.disabled = false;
//        device = event.device;
//    }
});
