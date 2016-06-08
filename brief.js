'use strict';
/* globals Brief, FeedUpdateService */
/* globals dactyl, commands, group, options, CommandExMode, modes */ 
/* globals window, Components */
var INFO =
['plugin', { name: 'brief',
             version: '2.1.0',
             href: 'https://github.com/willsALMANJ/pentadactyl-plugins',
             summary: 'Brief navigation and key mappings',
             xmlns: 'dactyl' },
    ['author', { href: 'https://github.com/willsALMANJ' },
        'Will Shanks'],
    ['license', { href: 'http://www.mozilla.org/MPL/2.0/' },
        'Mozilla Public License 2.0'],
    ['project', { name: 'Pentadactyl', 'min-version': '1.0' }],
    ['p', {},
        'This plugin implements a command set for working ',
        'with the Brief RSS Reader add-on in Pentadactyl.']];
// More added to INFO below.

var briefURL = 'chrome://brief/content/brief.xul';
var briefURL = Brief.BRIEF_URL
briefURL = briefURL.replace(/\:|\./, function(match) {return '\\' + match})
// Restrict :brief commands to Brief.BRIEF_URL
commands.execute(':group plugin-brief -n '+
	'-desc="group generated by brief.js plugin" -locs \'' + briefURL + '\'');
// Previous command restricts all group methods to briefURL.
// Have to use commands.execute to create a command that works elsewhere
commands.execute(':command! briefopen -n -desc "Open Brief RSS reader" ' +
	'-js plugins.brief.briefopen()');
commands.execute(':command! briefcheck -n -desc "Check Brief unread item count" ' +
	'-js plugins.brief.briefcheck()')
// group.autocmd.add(['DOMLoad'], briefURL, function() {expandselected()})
	
function briefcheck() {
	var checkedDate = new Date(1000*
		parseInt(Brief.prefs.getIntPref('update.lastUpdateTime')));
	
	let query = new Brief.query({
		includeFeedsExcludedFromGlobalViews: false,
		deleted: Brief.storage.ENTRY_STATE_NORMAL,
		read: false
	});
	
	query.getEntryCount().then(unreadEntriesCount => {
		dactyl.echo('Brief unread: ' + unreadEntriesCount + '.  ' + 
			'Last checked: ' + checkedDate.toString());
	});
}

function expandselected() {
		let gView = Brief.win.gCurrentView
		let selectedIndex = gView.getEntryIndex(gView.selectedEntry)
		if (gView.headlinesMode && gView.selectedEntry) {
			let entryView = gView.getEntryView(gView.selectedEntry);
			if (entryView.collapsed)
				entryView.expand(true);
		}
}

function briefopen() {
	Brief.open()
	// Ugly hack -- can we detect when the page is finished loading?
	window.setTimeout(expandselected, 500)
	window.setTimeout(expandselected, 1000)
	window.setTimeout(expandselected, 2000)
}

//Needed for scope to load Brief's Storage resource with naming conflict
var localNS = {}; 

group.options.add(['brief-load-passkeys'],
    'Load default Brief passkeys when Brief plugin is loaded',
    'string', true,
    {
    	completer: function(args,context) {return [['true', 'true'],['false','false']]},
    	setter: loadPasskeys
     });

var defaultPasskeys='<Enter>';

function loadPasskeys(values) {
	let passOpt=options.get('brief-load-passkeys');
	
	setPasskeys(passOpt.value=='true');
	
	return values
}
loadPasskeys();

function setPasskeys(addPasskeys) {
	if (typeof defaultPasskeys=='undefined') {
		return
	}

	var briefPasskeys = "'"+briefURL+"':"+defaultPasskeys;
	let passkeys=options.get('passkeys');
	let passkeysLoc=passkeys.value.toString().search(briefPasskeys);
	if (addPasskeys) {
		if (passkeysLoc==-1) {
			let newPasskeys=[passkeys.value.toString(),briefPasskeys].join(',');
			commands.execute(':set passkeys='+newPasskeys);
		}
	} else {
		if (passkeysLoc!=-1) {
			let passkeysArr=passkeys.value.toString().split(',');
			let briefIndex=passkeysArr.indexOf(briefPasskeys);
			let newPasskeysArr=[];
			for (let idx=0;idx<passkeysArr.length;idx++) {
				if (idx!=briefIndex) {
					newPasskeysArr.push(passkeysArr[idx]);
				}
			}
			let newPasskeys=newPasskeysArr.join(',');
			commands.execute(':set passkeys='+newPasskeys);
		}
	}
}

function onUnload() {
	setPasskeys(false);
}
    
var Actions = {};
Actions.briefview = {
	description: 'View a Brief folder/feed',
	mapping: {
		keys: ['bv'],
		openExMode: true},
/*	noPromptMapping: {
		keys: ['bv'],
		openExMode: false}, */
	defaultArgument: 'All items',
	argName: 'feed',
	extraDescription: function() {
		let exDesc=['.  ',['oa',{},this.argName],' is the name of a Brief feed',
			'or feed folder.'];
		exDesc=exDesc.concat(defaultArgDescription(this.argName, this.defaultArgument));
		return exDesc},
	
	command: function(args) {
		var title;
		if (args.length==1) {
			title = args[0];
		} else {
			title='All items';
		}
		var id;
		
		let parentList;
		if (title in sidebarBuiltins) {
			id=sidebarBuiltins[title];
			parentList=window.content.document.getElementById('view-list');
		} else {
			var matches=window.content.document.getElementsByAttribute('title',title);
			if (matches.length===0) {
				dactyl.echoerr('No feed or folder found with that title.');
				return
			}
			// Just use the first match -- no support for duplicate titles
			id=matches[0].getAttribute('id');
			parentList=window.content.document.getElementById('feed-list');
		}
		
		parentList.selectedItem=window.content.document.getElementById(id);
	},
	options: {
		literal: 0,
		argCount: '?',
		completer: function(context,args) {
			context.completions=sidebarCompletions('feed,folder,builtin')}
	}
};

Actions.briefmark = {
	description: 'Mark an item(s) read/unread',
	mapping: {
		keys: ['bM'],
		openExMode: true},
	noPromptMapping: {
		keys: ['bm'],
		openExMode: false},
	defaultArgument: 'single',
	argName: 'group',
	extraDescription: function() {
		let exDesc=['.  ',['oa',{},this.argName],' is ',
			['str',{},'single'],' (single item), ',['str',{},'view'],
			' (all items in the current feed view), or ',['str',{},'starred'],
			' (all visible items).'];
		exDesc=exDesc.concat(defaultArgDescription(this.argName, this.defaultArgument));
		return exDesc},
	
	command: function(args) {
		var mode;
		if (args.length==1) {
			mode=args[0];
		} else {
			mode='single';
		}
		
		switch (mode) {
			case 'single':
				Brief.win.Commands.toggleSelectedEntryRead();
				break
			case 'view':
				Brief.win.Commands.markViewRead();
				break
			case 'visible':
				Brief.win.Commands.markVisibleEntriesRead();
				break
		}
	},
	options: {
		argCount: '?',
		completer: function(context,args) {
			context.completions= [['single', 'Toggle single item read/unread'],
				['view', 'Mark current view read'],
				['visible', 'Mark visible items read']];
			}
	}
};

Actions.briefreveal = {
	description: 'Reveal all/unread/starred items',
	mapping: {
		keys: ['br'],
		openExMode: true},
/*	noPromptMapping: {
		keys: ['br'],
		openExMode: false}, */
	defaultArgument: 'all',
	argName: 'filter',
	extraDescription: function() {
		let exDesc=['.  ',['oa',{},this.argName],' is ',
			['str',{},'all'],', ',['str',{},'unread'],', or ',['str',{},'starred'],'.'];
		exDesc=exDesc.concat(defaultArgDescription(this.argName, this.defaultArgument));
		return exDesc},
	
	command: function(args) {
		var mode;
		if (args.length==1) {
			mode=args[0];
		} else {
			mode='all';
		}
		
		switch (mode) {
			case 'all':
				Brief.win.Commands.switchViewFilter('all')
				break
			case 'unread':
				Brief.win.Commands.switchViewFilter('unread')
				break
			case 'starred':
				Brief.win.Commands.switchViewFilter('starred')
				break
		}
		window.content.location.reload();
	},
	options: {
		literal: 0,
		argCount: '?',
		completer: function(context, args) {
			context.completions= [['all', 'All items'],
							      ['unread', 'Unread items'],
							      ['starred', 'Starred items']];
		}
	}
};

Actions.briefheadlines = {
	description: 'Toggle headlines mode',
	mapping: {
		keys: ['bh'],
		openExMode: false},
	
	command: function(args) {
		let mode
		if (Brief.win.FeedList.selectedFeed) {
			mode = (Brief.win.FeedList.selectedFeed.viewMode + 1) % 2
			Brief.win.Storage.changeFeedProperties({
				feedID: Brief.win.FeedList.selectedFeed.feedID,
				viewMode: mode
			})
		} else {
			mode = (Brief.win.Prefs.getIntPref('feedview.mode') + 1) % 2
			Brief.win.Prefs.setIntPref('feedview.mode', mode)
		}

		Brief.win.gCurrentView.refresh()
	},
	options: {
		argCount: 0
	}
};

Actions.briefdelete = {
	description: 'Delete selected entry (or restore if in Trash)',
	mapping: {
		keys: ['bd'],
		openExMode: false},
	
	command: function(args) {
		Brief.win.Commands.deleteOrRestoreSelectedEntry();
	},
	options: {
		argCount: 0
	}
};

Actions.briefbookmark = {
	description: 'Bookmark/unbookmark selected entry',
	mapping: {
		keys: ['bb'],
		openExMode: false},
	
	command: function(args) {
		Brief.win.Commands.toggleSelectedEntryStarred();
	},
	options: {
		argCount: 0
	}
};

Actions.brieffind = {
	description: 'Focus/clear search bar',
	mapping: {
		keys: ['bf'],
		openExMode: true},
	defaultArgument: 'focus',
	argName: 'action',
	extraDescription: function() {
		let exDesc=['.  ',['oa',{},this.argName],' is either',
			['str',{},'clear'],' or ',['str',{},'focus'],'.'];
		exDesc=exDesc.concat(defaultArgDescription(this.argName, this.defaultArgument));
		return exDesc},
	
	command: function(args) {
		var mode;
		if (args.length==1) {
			mode=args[0];
		} else {
			mode='focus';
		}
		
		var searchbar=Brief.win.getElement('searchbar')
		
		switch (mode) {
			case 'focus':
				searchbar.focus()
				break
			case 'clear':
				searchbar.reset();
				searchbar.blur();
				window.content.location.reload();
				break
		}
	},
	options: {
		literal: 0,
		argCount: '?',
		completer: function(context, args) {
			context.completions=[['focus', 'Focus search bar'],
				['clear', 'Clear search bar']];
		}
	}
};

Actions.briefexpand = {
	description: 'Expand/collapse item in headlines mode',
	mapping: {
		keys: ['be'],
		openExMode: false},
	
	command: function(args) {
		Brief.win.Commands.toggleSelectedEntryCollapsed()
	},
	options: {
		argCount: 0
	}
};

Actions.briefselectnext = {
	description: 'Select next entry (auto-collpase/expand in headlines mode)',
	mapping: {
		keys: ['j'],
		openExMode: false},
	
	command: function(args) {
		let gView = Brief.win.gCurrentView
		if (gView.headlinesMode && gView.selectedEntry) {
			let entryView = gView.getEntryView(gView.selectedEntry);
			if (!entryView.collapsed)
				entryView.collapse(true);
		}
		let count = args.count || 1
		if (count === 1) {
			gView.selectNextEntry()
		} else {
			let selectedIndex = gView.getEntryIndex(gView.selectedEntry)
			for (let idx = count; idx > 0; idx--) {
				let nextEntry = gView._loadedEntries[selectedIndex + idx]
				if (nextEntry) {
					gView.selectEntry(nextEntry, true, true)
					break
				}
			}
		}
		if (gView.headlinesMode && gView.selectedEntry) {
			let entryView = gView.getEntryView(gView.selectedEntry);
			if (entryView.collapsed)
				entryView.expand(true);
		}
	},
	options: {
		argCount: 0
	}
};

Actions.briefselectprevious = {
	description: 'Select previous entry (auto-collpase/expand in headlines mode)',
	mapping: {
		keys: ['k'],
		openExMode: false},
	
	command: function(args) {
		let gView = Brief.win.gCurrentView
		if (gView.headlinesMode && gView.selectedEntry) {
			let entryView = gView.getEntryView(gView.selectedEntry);
			if (!entryView.collapsed)
				entryView.collapse(true);
		}
		let count = args.count || 1
		if (count === 1) {
			gView.selectPrevEntry()
		} else {
			let selectedIndex = gView.getEntryIndex(gView.selectedEntry)
			for (let idx = count; idx > 0; idx--) {
				let prevEntry = gView._loadedEntries[selectedIndex - idx]
				if (prevEntry) {
					gView.selectEntry(prevEntry, true, true)
					break
				}
			}
		}
		if (gView.headlinesMode && gView.selectedEntry) {
			let entryView = gView.getEntryView(gView.selectedEntry);
			if (entryView.collapsed)
				entryView.expand(true);
		}
	},
	options: {
		argCount: 0
	}
};

Actions.briefsidebar = {
	description: 'Toggle sidebar',
	mapping: {
		keys: ['bs'],
		openExMode: false},
	
	command: function(args) {
		var sidebar=Brief.win.getElement('sidebar');
		if (sidebar.hidden) {
			Brief.win.Commands.revealSidebar();
		} else {
			Brief.win.Commands.hideSidebar();
		}
	},
	options: {
		argCount: 0
	}
};

Actions.briefupdate = {
	description: 'Update a Brief folder/feed',
	mapping: {
		keys: ['bu'],
		openExMode: true},
/*	noPromptMapping: {
		keys: ['bu'],
		openExMode: false}, */
	defaultArgument: 'All items',
	argName: 'feed',
	extraDescription: function() {
		let exDesc=['.  ',['oa',{},this.argName],
			' is the name of any feed or folder.'];
		exDesc=exDesc.concat(defaultArgDescription(this.argName, this.defaultArgument));
		return exDesc},
	
	command: function(args) {
		var title;
		if (args.length==1) {
			title = args[0];
		} else {
			title='All items';
		}
		
		if (title=='current') {
			var viewlist=window.content.document.getElementById('view-list');
			var selection=viewlist.selectedItem;
			if (selection.id=='all-items-folder') {
				title='All items';
			} else {
				if (['unread-folder','starred-folder','trash-folder'].
						indexOf(selection.id)!=-1) {
					dactyl.echoerr("Can't update current selection.");
					return
				}
			}
		}
		
		switch (title) {
			case 'All items':
				Brief.win.FeedUpdateService.updateAllFeeds();
				break
			case 'stop':
				Brief.win.FeedUpdateService.stopUpdating();
				break
			default:
				var matches=window.content.document.getElementsByAttribute('title',title);
				if (matches.length===0) {
					dactyl.echoerr('No feed or folder found with that title.');
					return
				}
				
				Components.utils.import('resource://brief/Storage.jsm', localNS);
				Components.utils.import('resource://brief/FeedUpdateService.jsm');
				
				// Just use the first match -- no support for duplicate titles
				var id=matches[0].getAttribute('id');
				var elem=window.content.document.getElementById(id);
				if (elem.tagName=='richtreeitem') {
					FeedUpdateService.updateFeeds([localNS.Storage.getFeed(id)]);
				} else if (elem.tagName=='richtreefolder') {
					let items = elem.getElementsByTagName('richtreeitem');
					let feeds = [];
					for (let i = 0; i < items.length; i++) {
						feeds.push(localNS.Storage.getFeed(items[i].id));
					}
					FeedUpdateService.updateFeeds(feeds);
				}
		}
	},
	options: {
		literal: 0,
		argCount: '?',
		completer: function(context, args) {
			var completions=sidebarCompletions('feed,folder');
			completions.unshift(['current', 'Current item'],['All items','All items'],
				['stop','Stop updating feeds']);
			context.completions=completions;
		}
	}
};

Actions.brieftoggle = {
	description: 'Toggle feed folder open/closed',
	mapping: {
		keys: ['bt'],
		openExMode: true},
	defaultArgument: 'current',
	argName: 'folder',
	extraDescription: function() {
		let exDesc=['.  ',['oa',{},this.argName],' is the name of any feed folder.  '];
		exDesc=exDesc.concat(defaultArgDescription(this.argName, this.defaultArgument)); 
		return exDesc},
	
	command: function(args) {
		var title;
		if (args.length==1) {
			title = args[0];
		} else {
			title='current';
		}
	
		var folder;
		if (title=='current') {
			var viewlist=Brief.win.content.document.getElementById('view-list');
			folder=viewlist.selectedItem;
			if (folder.tagName!='richtreefolder') {
				dactyl.echoerr('Current selection is not a feed folder.');
				return
			}
		} else {
			var matches=Brief.win.content.document.getElementsByAttribute('title',title);
			if (matches.length===0) {
				dactyl.echoerr('No folder found with that title.');
				return
			}
			// Just use the first match -- no support for duplicate titles
			folder=window.content.document.getElementById(matches[0].getAttribute('id'));
		}
		
		folder.setAttribute('open', !folder.openState)
	},
	options: {
		literal: 0,
		argCount: '?',
		completer: function(context,args) {
			var completions=sidebarCompletions('folder');
			completions.unshift(['current','Currently selected feed folder']);
			context.completions=completions;
		}
	}
};

var sidebarBuiltins = {};
sidebarBuiltins['All items'] = 'all-items-folder';
sidebarBuiltins.Unread = 'unread-folder';
sidebarBuiltins.Starred = 'starred-folder';
sidebarBuiltins.Trash = 'trash-folder';
    
function sidebarCompletions(targets) {
	var completions=[];
	
	targets=targets.split(',');
	if (targets.indexOf('builtin')!=-1) {
		for (var title in sidebarBuiltins) {
			completions.push([title, 'View']);
		}
	}
	
	var folders
	var idx
	if (targets.indexOf('folder')!=-1) {
		folders=window.content.document.getElementsByClassName('feed-folder');
		for (idx=0;idx<folders.length;idx++) {
			completions.push([folders[idx].getAttribute('title'), 'Folder']);
		}
	}
	
	if (targets.indexOf('feed')!=-1) {
		folders=window.content.document.getElementsByClassName('feed-treeitem');
		for (idx=0;idx<folders.length;idx++) {
			completions.push([folders[idx].getAttribute('title'), 'Feed']);
		}
	}
	
	return completions
}
    	
function addMapping(action, mapKind) {
	let command;
	let actionStr=action; //Needed for scoping/evaluation reasons
	if (Actions[action][mapKind].openExMode) {
		command=(function(args) {
			new CommandExMode().open(actionStr+' ')
		});
	} else {
		command=(function(args) {
			(Actions[actionStr].command(args));
		});
	}
	
	group.mappings.add([modes.NORMAL], Actions[action][mapKind].keys, 
		Actions[action].description,
		(command),
		{}
	);
}

function defaultArgDescription(argName, defaultStr) {
	return ['  If ',['oa',{},argName],' is omitted, then the default value of ',
			['str',{},defaultStr],' is used.']
}

INFO.push(['item', {},
        ['tags', {}, ':briefopen'],
        ['spec', {}, ':briefopen'],
        ['description', { short: 'true' },
            ['p', {}, 'Open/focus Brief.']]]);
            
INFO.push(['item', {},
        ['tags', {}, ':briefcheck'],
        ['spec', {}, ':briefcheck'],
        ['description', {},
            ['p', {}, 'Check Brief unread count and last checked time (This function' + 
            ' does not update all feeds.', ['ex',{},':briefupdate'], ' does).']]]);
            
INFO.push(['item', {},
	['tags',{},'brief-load-passkeys'],
	['spec',{},'brief-load-passkeys'],
	['type',{},'string'],
	['default',{},'true'],
	['description',{},
		['p',{},'If ',['str',{},'true'],', the plugin sets the following passkeys ',
		"for Brief's url: ",['str',{},defaultPasskeys],'. Many other keyboard ',
		"shortcuts are available in Brief (see Brief's preferences), but they conflict ",
		'with common ',
		'Pentadactyl mappings.  Most of their functionality is reproduced by ',
		'the commands provided by this plugin.'],
		['p',{},'The passkeys set by the plugin perform the following actions:'],
		['dl',{},
			['dt',{},'j'],['dd',{},'Select the next item'],
			['dt',{},'k'],['dd',{},'Select the previous item'],
			['dt',{},'h'],['dd',{},'Expand/collapse current item in headlines mode'],
			['dt',{},'<Enter>'],['dd',{},'Open the current item']
		]]]);

for (let action in Actions) {
	group.commands.add([action],Actions[action].description,
		Actions[action].command, Actions[action].options,true);

	for (let mapKind in {mapping: null, noPromptMapping: null}) {
		if (mapKind in Actions[action]) {
			addMapping(action, mapKind);
		}
	}
	
	let tagStr=':'+action;
	if ('mapping' in Actions[action]) {
		tagStr+=' '+Actions[action].mapping.keys.join(' ');
	}
	let specVal;
	if ('argName' in Actions[action]) {
		specVal=['spec',{},':'+action+' ',['oa',{},Actions[action].argName]];
	} else {
		specVal=['spec',{},':'+action];
	}
	let description=['p', {}, Actions[action].description];
	if ('extraDescription' in Actions[action]) {
		description=description.concat(Actions[action].extraDescription());
	}
	INFO.push(['item', {},
        ['tags', {}, tagStr],
        specVal,
        ['description', {},
            description]]);
            
    if ('noPromptMapping' in Actions[action]) {
    	tagStr=Actions[action].noPromptMapping.keys.join(' ');
    	INFO.push(['item', {},
			['tags', {}, tagStr],
			['spec', {}, tagStr],
			['description', { short: 'true' },
				['p', {}, 'Excecute ',
					['ex',{},':'+action],' without opening the command prompt.']]]);
    }
}
