//import { runOpenFPGALoader     } from 'https://cdn.jsdelivr.net/npm/@yowasp/openfpgaloader/gen/bundle.js';
import { runOpenFPGALoader     } from './bundle.js';
import { lineBuffered, chunked } from 'https://cdn.jsdelivr.net/npm/@yowasp/runtime/lib/util.js';
await fill_cables();
await fill_boards();

const demo = document.getElementById('demo');

try {
	const response = await runYosys(["--version"]);
    const data = await response.json();
	demo.textcontent = data;
	console.log(data);
}
catch (err) {
	demo.textContent = "error" + err.message;
	console.log("plop");
}

const detectButton  = document.getElementById('detectButton');
const connectButton = document.getElementById('connectButton');
const programButton = document.getElementById('programButton');
const select_cable  = document.getElementById('cable_select');
const USBStatus     = document.getElementById('USBStatus');
let device          = null;

async function ofl_exec(args, div_id, fileIn={}, verbose=true) {
	const OFLStatus  = document.getElementById('OFLStatus');
	let lines        = [];
	let lines_err    = [];

	const div_log = document.getElementById(div_id);

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
	    let opt = document.createElement("option");
		const cable   = line.split(' ')[0];
	    opt.value     = i + 1; // the index
	    opt.innerHTML = cable;
	    select_board.append(opt);
	});
}

document.getElementById('programButtonManual').addEventListener('click', async function () {
	let file       = document.getElementById("fileInput").files[0]
	const filename = file.name;
	let reader     = new FileReader();

	reader.onload = function (event) {
		const binaryData      = new Uint8Array(event.target.result);
		const fileContent     = binaryData;
		const ofl_cmd         = document.getElementById("ofl_cmd")
		const fileData        = {[filename]: fileContent};
		var cmd               = ["-c", "digilent"];
		//var cmd = ofl_cmd.value.split(' ');
		cmd.push("--quiet");
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
