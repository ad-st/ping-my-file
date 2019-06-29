"use strict"
const vscode = require('vscode');
const File = require('./file')

function activate(context) {
	let disposable = [];
	let observed = {};
	let activeEditor = vscode.window.activeTextEditor;

	function getFile(editor) {
		return observed[editor.document.uri];
	};

	function createFile(editor) {
		const file = observed[editor.document.uri] || new File(editor);
		observed[editor.document.uri] = file;
		return file;
	}

	function restartPing(editor){
		if (editor) {
			const file = getFile(editor);
			if (file) {
				file.clearHosts();
				if (file.active) {
					file.prepareHosts();
					file.pingAll(true);
				}
			}
		}
	}

	vscode.workspace.onDidChangeTextDocument(() => {
		if (activeEditor) {
			const file = getFile(activeEditor);
			if (file) {
				file.pausePing();
				file.clearHosts();
				if (file.active) {
					clearTimeout(this.timeout);
					const delayafteredit = vscode.workspace.getConfiguration('pingmyfile').get('delayafteredit');
					this.timeout = setTimeout(()=>{
						this.timeout = undefined;
						restartPing(activeEditor);
					},delayafteredit);
				}
			}
		}
	});

	vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = undefined;
			restartPing(activeEditor);
		};

		if (activeEditor && activeEditor != editor) {
			const prevFile = getFile(activeEditor);
			if (prevFile)
				prevFile.hide();
		}

		if (editor) {
			const currFile = getFile(editor);
			if (currFile)
				currFile.show(editor);
		}

		activeEditor = editor;
	});

	disposable.push(vscode.commands.registerCommand('ping-my-file.ping', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		const file = createFile(editor);
		file.prepareHostsFromFile();
		file.pingAll(false);
	}));

	disposable.push(vscode.commands.registerCommand('ping-my-file.start', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		const file = createFile(editor);
		file.prepareHostsFromFile();
		file.pingAll(true);
	}));

	disposable.push(vscode.commands.registerCommand('ping-my-file.stop', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		const file = createFile(editor);
		file.cancelPing();
		file.clearHosts();
	}));

	context.subscriptions.push(...disposable);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}