import { lisan, t } from "lisan"
import Mousetrap from "mousetrap"
lisan.add(require(`./languages/en-US.js`))

export const _d = (i)=>{ i && console.debug(...(i[Symbol.iterator] ? i : [i])) }
const inputHandler = (function(m) {
	var _global_callbacks = {},
		_original_stop_callback = m.stopCallback
	m.stopCallback = function(e, element, combo) {
		if (_global_callbacks[combo]) { return false }
		return _original_stop_callback(e, element, combo)
	}
	m.bindGlobal = function(keys, callback, action) {
		m.bind(keys, callback, action)
		if (keys instanceof Array) {
			for (var i = 0; i < keys.length; i++) { _global_callbacks[keys[i]] = true }
			return
		}
		_global_callbacks[keys] = true
	}
	return m
})(Mousetrap)

export const ui = {
	"searchBox": null,
	"navOutput": null,
	"quickSearch": null,
	"navLoader": null,
	"createBox": ()=>{
		if(!document.body)
			return false
		let theme = pbiNavigatorSettings.theme
		let div = document.createElement("div")
		div.setAttribute("id", "pbinavStyleBox")
		div.setAttribute("class", theme)
		const loaderURL = chrome.extension.getURL("images/ajax-loader.gif")
		const logoURL = chrome.extension.getURL("images/sf-navigator128.png")
		div.innerHTML = `
<div id="pbinavSearchBox">
	<div class="pbinav_wrapper">
		<input type="text" id="pbinavQuickSearch" autocomplete="off"/>
		<img id="pbinavLoader" src= "${loaderURL}"/>
		<img id="pbinav_logo" src= "${logoURL}"/>
	</div>
	<div class="pbinav_shadow" id="pbinav_shadow"/>
	<div class="pbinavOutput" id="pbinavOutput"/>
</div>`
		document.body.appendChild(div)
		ui.searchBox = document.getElementById("pbinavSearchBox")
		ui.navOutput = document.getElementById("pbinavOutput")
		ui.quickSearch = document.getElementById("pbinavQuickSearch")
		ui.navLoader = document.getElementById("pbinavLoader")
	},
	"mouseHandler": (e)=>{
		e.target.classList.add('pbinav_selected')
		return true
	},
	"mouseClick": (e)=>{
		document.getElementById("pbinavQuickSearch").value = e.target.firstChild.nodeValue
		pbiNavigator.listPosition = -1
		ui.setVisibleSearch("hidden")
		if(e.target.dataset.key)
			pbiNavigator.invokeCommand(e.target.dataset, window.ctrlKey,'click')
		else
			ui.hideSearchBox()
		return true
	},
	"mouseHandlerOut": (e)=>{ e.target.classList.remove('pbinav_selected'); return true },
	"mouseClickLoginAs": (e)=>{ pbiNavigator.loginAsPerform(e.target.dataset.key.replace("commands.loginAs.","")); return true },
	"bindShortcuts": ()=>{
		if(!ui.quickSearch)
			return false
		inputHandler.bindGlobal('esc', function(e) { ui.hideSearchBox() }) // global doesn't seem to be working
		inputHandler(ui.quickSearch).bind('esc', function(e) { ui.hideSearchBox() })
		inputHandler(ui.quickSearch).bind('enter', ui.kbdCommand)
		for (var i = 0; i < pbiNavigator.newTabKeys.length; i++) {
			inputHandler(ui.quickSearch).bind(pbiNavigator.newTabKeys[i], ui.kbdCommand)
		}
		inputHandler(ui.quickSearch).bind('down', ui.selectMove.bind(this, 'down'))
		inputHandler(ui.quickSearch).bind('up', ui.selectMove.bind(this, 'up'))
		inputHandler(ui.quickSearch).bind('backspace', function(e) { pbiNavigator.listPosition = -1 })
		ui.quickSearch.oninput = ui.lookupCommands
	},
	"showLoadingIndicator": ()=>{ if(ui.navLoader) ui.navLoader.style.visibility = 'visible' },
	"hideLoadingIndicator": ()=>{ if(ui.navLoader) ui.navLoader.style.visibility = 'hidden' },
	"hideSearchBox": ()=>{
		ui.quickSearch.blur()
		ui.clearOutput()
		ui.quickSearch.value = ''
		ui.setVisibleSearch("hidden")
	},
	"setVisibleSearch": (visibility)=>{
		if(visibility == "hidden") {
			ui.searchBox.style.opacity = 0
			ui.searchBox.style.zIndex = -1
		}
		else {
			ui.searchBox.style.opacity = 0.98
			ui.searchBox.style.zIndex = 9999
			ui.quickSearch.focus()
		}
	},
	"lookupCommands": ()=>{
		const input = ui.quickSearch.value
		ui.clearOutput()
		if(input.substring(0,1) == "?") ui.addSearchResult("menu.globalSearch")
		else if(input.substring(0,1) == "!") ui.addSearchResult("menu.createTask")
		else {
			let words = ui.filterCommandList(input)
			if(words.length > 0)
				for (var i=0;i < words.length; ++i)
					ui.addSearchResult(words[i])
			else
				pbiNavigator.listPosition = -1
		}
		let firstEl = ui.navOutput.querySelector(":first-child")
		if(pbiNavigator.listPosition == -1 && firstEl != null) firstEl.className = "pbinav_child pbinav_selected"
	},
	"filterCommandList": (input)=>{
		if(typeof input === 'undefined' || input == '') return []
		input = input.toLowerCase()
		let preSort = {}, terms = input.toLowerCase().split(" ")
		for(const key in pbiNavigator.commands) {
			const label = pbiNavigator.commands[key]?.label ?? ""
			const comboSearch = (key + '|' + label).toLowerCase()
			if(comboSearch.indexOf(input) != -1) {
				preSort[key] = pbiNavigatorSettings.searchLimit
			} else {
				let match = 0
				let sortValue = 0
				for(let i=0;i<terms.length;i++) {
					if(comboSearch.indexOf(terms[i]) != -1) {
						match++
						sortValue = 1
					}
				}
				for(let i=1;i<=terms.length;i++) {
					if(comboSearch.indexOf(terms.slice(0,i).join(' ')) != -1)
						sortValue++
					else
						break
				}
				if (match == terms.length)
					preSort[key] = sortValue
			}
		}
		return Object.keys(preSort).sort((a,b)=>(preSort[b] - preSort[a])).slice(0,pbiNavigatorSettings.searchLimit)
	},
	"addSearchResult": (key)=>{
		let r = document.createElement("a")
		r.setAttribute("href", (pbiNavigator.commands[key]?.url ?? "#").replace('//','/'))
		r.setAttribute('data-key', key)
		r.classList.add("pbinav_child")
		r.onmouseover = ui.mouseHandler
		r.onmouseout = ui.mouseHandlerOut
		r.onclick = ui.mouseClick
		if(pbiNavigator.commands[key]?.label)
			r.appendChild(document.createTextNode(pbiNavigator.commands[key].label))
		else
			r.appendChild(document.createTextNode(t(key)))
		if(pbiNavigator.commands[key]?.userId) {
			r.setAttribute('data-userid',pbiNavigator.commands[key].userId)
			r.onclick = ui.mouseClickLoginAs
		}
		ui.navOutput.appendChild(r)
	},
	"addError": (text)=>{
		ui.clearOutput()
		let err = document.createElement("div")
		err.className = "pbinav_child pbinav-error-wrapper"
		err.appendChild(document.createTextNode(t("prefix.error")))
		err.appendChild(document.createElement('br'))
		for(let i = 0;i<text.length;i++) {
			err.appendChild(document.createTextNode(text[i].message))
			err.appendChild(document.createElement('br'))
		}
		ui.searchBox.appendChild(err)
	},
	"clearOutput": ()=>{
		ui.navOutput.innerHTML = ""
		pbiNavigator.listPosition = -1
	},
	"kbdCommand": (e, keyPress)=>{
		let cmdKey = ui.navOutput.childNodes[(pbiNavigator.listPosition < 0 ? 0 : pbiNavigator.listPosition)]?.dataset
		let details = e.target
		if(["?", "!"].includes(e.target.value[0]))
			cmdKey = { "key": (e.target.value[0] == "?" ? "commands.search" : "commands.createTask") }
		if(!cmdKey?.key?.startsWith("commands.loginAs.") && e.target.value.toLowerCase().includes(t("prefix.loginAs").toLowerCase())) {
			cmdKey = "commands.loginAs"
			details = ui.quickSearch.value
		}
		let newTab = pbiNavigator.newTabKeys.indexOf(keyPress) >= 0 ? true : false
		if(!newTab)
			ui.clearOutput()
		pbiNavigator.invokeCommand(cmdKey, newTab, details)
	},
	"selectMove": (direction)=>{
		let words = Array.from(ui.navOutput.childNodes).reduce((a,w)=>a.concat([w.textContent]), [])
		let isLastPos = direction == 'down' 
			? pbiNavigator.listPosition < words.length-1 // is at the bottom
			: pbiNavigator.listPosition >= 0 // so direction = up, is at the top
		if (words.length > 0 && isLastPos) {
			if(pbiNavigator.listPosition < 0)
				pbiNavigator.listPosition = 0
			pbiNavigator.listPosition = pbiNavigator.listPosition + (direction == 'down' ? 1 : -1)
			if (pbiNavigator.listPosition >=0) {
				ui.navOutput.childNodes[pbiNavigator.listPosition + (direction == 'down' ? -1 : 1) ]?.classList.remove('pbinav_selected')
				ui.navOutput.childNodes[pbiNavigator.listPosition]?.classList.add('pbinav_selected')
				try { ui.navOutput.childNodes[pbiNavigator.listPosition]?.scrollIntoViewIfNeeded() }
				catch { ui.navOutput.childNodes[pbiNavigator.listPosition]?.scrollIntoView() }
				return false
			}
		}
	}
}

export const pbiNavigatorSettings = {
	"MAX_SEARCH_RESULTS": 32,
	"theme":'theme-default',
	"searchLimit": 16,
	"commands": {},
	"enhancedprofiles": true,
	"debug": false,
	"developername": false,
	"lightningMode": true,
	"language": "en-US",
	"availableThemes": ["Default", "Dark", "Unicorn", "Solarized"],
	"ignoreList": null, // ignoreList will be for filtering custom objects, will need an add, remove, and list call
	"changeDictionary": (newLanguage) => lisan.add(require("./languages/" + newLanguage + ".js")),
	"setTheme": (command)=>{
		const newTheme = "theme-" + command.replace('commands.themes','').toLowerCase()
		document.getElementById('pbinavStyleBox').classList = [newTheme]
		pbiNavigatorSettings.set("theme", newTheme)
	},
	"settingsOnly": ()=>JSON.parse(JSON.stringify(pbiNavigatorSettings)),
	"set": (key, value)=>{ let s={}; s[key]=value; chrome.storage.sync.set(s, response=>pbiNavigator.refreshAndClear()) },
	"loadSettings": ()=>{
		chrome.storage.sync.get(pbiNavigatorSettings, settings=>{
			for(const k in settings) { pbiNavigatorSettings[k] = settings[k] }
			pbiNavigator.serverInstance = pbiNavigator.getServerInstance(pbiNavigatorSettings)
			if(pbiNavigatorSettings.theme)
				document.getElementById('pbinavStyleBox').classList = [pbiNavigatorSettings.theme]
			if(pbiNavigator.sessionId !== null) { return }
			chrome.runtime.sendMessage({ "action": "getApiSessionId", "key": pbiNavigator.organizationId }, response=>{
				if(response && response.error) { console.error("response", orgId, response, chrome.runtime.lastError); return }
				try {
					pbiNavigator.sessionId = unescape(response.sessionId)
					pbiNavigator.userId = unescape(response.userId)
					pbiNavigator.apiUrl = unescape(response.apiUrl)
					pbiNavigator.loadCommands(pbiNavigatorSettings)
					ui.hideLoadingIndicator()
				} catch(e) {
					_d([e, response])
				}
			})
		})
	}
}

export const pbiNavigator = {
	"organizationId": null,
	"userId": null,
	"sessionId": null,
	"sessionHash": null,
	"serverInstance": null,
	"apiUrl": null,
	"apiVersion": "v56.0",
	"loaded": false,
	"listPosition": -1,
	"ctrlKey": false,
	"debug": false,
	"newTabKeys": [ "ctrl+enter", "command+enter", "shift+enter" ],
	"regMatchSid": /sid=([a-zA-Z0-9\.\!]+)/,
	"otherExtensions": [{
		"platform": "chrome-extension",
		"id": "aodjmnfhjibkcdimpodiifdjnnncaafh",
		"urlId": "aodjmnfhjibkcdimpodiifdjnnncaafh",
		"name": "Salesforce Inspector",
		"checkData": {"message": "getSfHost", "url": location.href},
		"commands": [
			{"url": "/data-export.html?host=$APIURL", "key": "other.inspector.dataExport"},
			{"url": "/inspect.html?host=$APIURL&objectType=$SOBJECT&recordId=$RECORDID", "key": "other.inspector.showAllData"}
		]
	},{
		"platform": "moz-extension",
		"id": "jid1-DBcuAQpfLMcvOQ@jetpack",
		"urlId": "84da8919-e6e9-4aae-ac9c-7f68b87003a1",
		"name": "Salesforce Inspector",
		"checkData": {"message": "getSfHost", "url": location.href},
		"commands": [
			{"url": "/data-export.html?host=$APIURL", "key": "other.inspector.dataExport"},
			{"url": "/inspect.html?host=$APIURL&objectType=$SOBJECT&recordId=$RECORDID", "key": "other.inspector.showAllData"}
		]
	}],
	"commands": {},
	"init": ()=>{
		try {
			document.onkeyup = (ev)=>{ window.ctrlKey = ev.ctrlKey }
			document.onkeydown = (ev)=>{ window.ctrlKey = ev.ctrlKey }
			pbiNavigator.organizationId = document.cookie?.match(/sid=([\w\d]+)/)[1] || pbiNavigator.organizationId
			pbiNavigator.sessionHash = pbiNavigator.getSessionHash()
			pbiNavigatorSettings.loadSettings()
			lisan.setLocaleName(pbiNavigatorSettings.language)
			pbiNavigator.resetCommands()
			ui.createBox()
			ui.bindShortcuts()
			if(pbiNavigatorSettings.enhancedprofiles) {
				delete pbiNavigator.commands["setup.profiles"]
			} else {
				delete pbiNavigator.commands["setup.enhancedProfiles"]
			}
		} catch(e) {
			console.info('err',e)
			if(pbiNavigatorSettings.debug) console.error(e)
		}
	},
	"invokeCommand": (command, newTab, event)=>{
		if(!command) { return false }
		let targetUrl
		if(typeof command != "object") command = {"key": command}
		if(typeof pbiNavigator.commands[command.key] != 'undefined' && pbiNavigator.commands[command.key].url) {
			targetUrl = pbiNavigator.commands[command.key].url
		}
		if(command.key.startsWith("commands.loginAs.")) {
			pbiNavigator.loginAsPerform(command.key.replace("commands.loginAs.",""), newTab)
			return true
		} else if(command.key.startsWith("commands.themes")) {
			pbiNavigatorSettings.setTheme(command.key)
			return true
		} else if(command.key.startsWith("other")) {
			switch(command.key) {
				case "other.inspector.showAllData":
					const matching = location.href.match(/\/r\/([\w_]+)\/(\w+)/)
					const sObject = matching[1]
					const recordId = matching[2]
					targetUrl = pbiNavigator.commands[command.key].url.replace("$SOBJECT", sObject).replace("$RECORDID", recordId)
			}
		}
		switch(command.key) {
			case "commands.refreshMetadata":
				pbiNavigator.refreshAndClear()
				return true
				break
			case "commands.objectManager":
				targetUrl = pbiNavigator.serverInstance + "/lightning/setup/ObjectManager/home"
				break
			case "switch to classic":
			case "switch to lightning":
			case "commands.toggleLightning":
				let mode = pbiNavigatorSettings.lightningMode ? "classic" : "lex-campaign"
				const matchUrl = window.location.href.replace(window.location.origin,"")
				targetUrl = pbiNavigator.serverInstance + "/ltng/switcher?destination=" + mode + "&referrer=" + encodeURIComponent(matchUrl)
				pbiNavigatorSettings.lightningMode = mode === "lex-campaign"
				pbiNavigatorSettings.set("lightningMode", pbiNavigatorSettings.lightningMode)
				break
			case "commands.toggleEnhancedProfiles":
				pbiNavigatorSettings.enhancedprofiles = !pbiNavigatorSettings.enhancedprofiles
				pbiNavigatorSettings.set("enhancedprofiles", pbiNavigatorSettings.enhancedprofiles)
				return true
				break
			case "dump":
			case "commands.dumpDebug":
				console.info("session settings:", pbiNavigatorSettings)
				console.info("server instance: ", pbiNavigator.serverInstance)
				console.info("API Url: ", pbiNavigator.apiUrl)
				console.info("Commands: ", pbiNavigator.commands)
				ui.hideSearchBox()
				break
			case "commands.toggleDeveloperName":
			    pbiNavigatorSettings.developername = !pbiNavigatorSettings.developername
				pbiNavigatorSettings.set("developername", pbiNavigatorSettings.developername)
				return true
				break
			case "commands.setup":
				targetUrl = pbiNavigator.serverInstance + (pbiNavigatorSettings.lightningMode ? "/lightning/setup/SetupOneHome/home" : "/ui/setup/Setup")
				break
			case "commands.home":
				targetUrl = pbiNavigator.serverInstance + "/"
				break
			case "commands.toggleAllCheckboxes":
				Array.from(document.querySelectorAll('input[type="checkbox"]')).forEach(c => c.checked=(c.checked ? false : true))
				ui.hideSearchBox()
				break
			case "commands.loginAs": 
				pbiNavigator.loginAs(command, newTab)
				return true
			case "commands.mergeAccounts":
				pbiNavigator.launchMergerAccounts(command.value)
				break
			case "commands.createTask":
				pbiNavigator.createTask(ui.quickSearch.value.substring(1).trim())
				break
			case "commands.search":
				targetUrl = pbiNavigator.searchTerms(ui.quickSearch.value.substring(1).trim())
				break
		}
		if(command.key.replace(/\d+/,'').trim().split(' ').reduce((i,c) => {
			if('set search limit'.includes(c))
				return ++i
			else
				return i
		}, 0) > 1) {
			const newLimit = parseInt(command.replace(/\D+/,''))
			if(newLimit != NaN && newLimit <= MAX_SEARCH_RESULTS) {
				pbiNavigatorSettings.searchLimit = newLimit
				pbiNavigatorSettings.set("searchLimit", pbiNavigatorSettings.searchLimit)
					.then(result=>ui.addSearchResult("notification.searchSettingsUpdated"))
				return true
			} else
				ui.addError(t("error.searchLimitMax"))
		}
		if(!targetUrl) {
			console.error('No command match', command)
			return false
		}
		ui.hideSearchBox()
		pbiNavigator.goToUrl(targetUrl, newTab, {command: command})
		return true
	},
	"resetCommands": ()=>{
		const modeUrl = pbiNavigatorSettings.lightningMode ? "lightning" : "classic"
		pbiNavigator.commands = {}
		Array(
			"commands.home",
			"commands.setup",
			"commands.mergeAccounts",
			"commands.toggleAllCheckboxes",
			"commands.toggleLightning",
			"commands.loginAs",
			"commands.help",
			"commands.objectManager",
			"commands.toggleEnhancedProfiles",
			"commands.refreshMetadata",
			"commands.dumpDebug",
			"commands.setSearchLimit"
		).forEach(c=>{pbiNavigator.commands[c] = {"key": c}})
		pbiNavigatorSettings.availableThemes.forEach(th=>pbiNavigator.commands["commands.themes" + th] = { "key": "commands.themes" + th })
		Object.keys(pbiNavigator.urlMap).forEach(c=>{pbiNavigator.commands[c] = {
			"key": c,
			"url": pbiNavigator.urlMap[c][modeUrl],
			"label": [t("prefix.setup"), t(c)].join(" > ")
		}})
	},
	"searchTerms": (terms)=>{
		// TODO doesn't work from a searched page in Lightning, SF just won't reparse the update URL because reasons, looks like they hijack the navigate event
		let searchUrl = pbiNavigator.serverInstance
		searchUrl += (!pbiNavigatorSettings.lightningMode)
		? "/_ui/search/ui/UnifiedSearchResults?sen=ka&sen=500&str=" + encodeURI(terms) + "#!/str=" + encodeURI(terms) + "&searchAll=true&initialViewMode=summary"
		: "/one/one.app?forceReload#" + btoa(JSON.stringify({
			"componentDef":"forceSearch:search",
			"attributes":{
				"term": terms,
				"scopeMap": { "type":"TOP_RESULTS" },
				"context":{
					"disableSpellCorrection":false,
					"SEARCH_ACTIVITY": {"term": terms}
				}
			}
		}))
		return searchUrl
	},
	"getServerInstance": (settings = {})=>{
		let serverUrl
		let url = location.origin + ""
		if(settings.lightningMode) {// if(url.indexOf("lightning.force") != -1)
			serverUrl = url.replace('lightning.force.com','').replace('my.salesforce.com','') + "lightning.force.com"
		} else {
			if(url.includes("salesforce"))
				serverUrl = url.substring(0, url.indexOf("salesforce")) + "salesforce.com"
			else if(url.includes("cloudforce"))
				serverUrl = url.substring(0, url.indexOf("cloudforce")) + "cloudforce.com"
			else if(url.includes("visual.force")) {
				let urlParseArray = url.split(".")
				serverUrl = urlParseArray[1] + '.salesforce.com'
			} else {
				serverUrl = url.replace('lightning.force.com','') + "my.salesforce.com"
			}
		}
		return serverUrl
	},
	"getSessionHash": ()=>{
		try {
			let sId = document.cookie?.match(pbiNavigator.regMatchSid)[1]
			return sId.split('!')[0] + '!' + sId.substring(sId.length - 10, sId.length)
		} catch(e) { _d([e]) }
	},
	"getHTTP": (getUrl, type = "json", headers = {}, data = {}, method = "GET") => {
		let request = { method: method, headers: headers }
		if(Object.keys(data).length > 0)
			request.body = JSON.stringify(data)
		return fetch(getUrl, request).then(response => {
			pbiNavigator.apiUrl = response.url.match(/:\/\/(.*)salesforce.com/)[1] + "salesforce.com"
			switch(type) {
				case "json": return response.clone().json()
				case "document": return response.clone().text()
			}
		}).then(data => {
			if(typeof data == "string")
				return (new DOMParser()).parseFromString(data, "text/html")
			else
				return data
		})
	},
	"refreshAndClear": ()=>{
		ui.showLoadingIndicator()
		pbiNavigator.serverInstance = pbiNavigator.getServerInstance(pbiNavigator)
		pbiNavigator.loadCommands(pbiNavigatorSettings, true)
		document.getElementById("pbinavQuickSearch").value = ""
	},
	"loadCommands": (settings, force = false) => {
		if([pbiNavigator.serverInstance, pbiNavigator.organizationId, pbiNavigator.sessionId].includes(null))
			return pbiNavigator.init()
		if(force || Object.keys(pbiNavigator.commands).length === 0)
			pbiNavigator.resetCommands()
		let options = {
			"sessionHash": pbiNavigator.sessionHash,
			"domain": pbiNavigator.serverInstance,
			"apiUrl": pbiNavigator.apiUrl,
			"key": pbiNavigator.organizationId,
			"force": force,
			"sessionId": pbiNavigator.sessionId,
			"action": "getMetadata"
		}
		chrome.runtime.sendMessage(options, response=>Object.assign(pbiNavigator.commands, response))
		chrome.runtime.sendMessage(Object.assign(options, {"action": "getActiveFlows"}), response=>Object.assign(pbiNavigator.commands, response))
		pbiNavigator.otherExtensions.filter(e=>{ return e.platform == (!!window.chrome ? "chrome-extension" : "moz-extension") }).forEach(e=>chrome.runtime.sendMessage(
			Object.assign(options, { "action": "getOtherExtensionCommands", "otherExtension": e }), r=>{ return Object.assign(pbiNavigator.commands, r) }
		))
		ui.hideLoadingIndicator()
	},
	"goToUrl": (url, newTab, settings)=>chrome.runtime.sendMessage({
		action: "goToUrl",
		url: url,
		newTab: newTab,
		settings: Object.assign(pbiNavigatorSettings.settingsOnly(), {
				serverInstance: pbiNavigator.serverInstance,
				lightningMode: pbiNavigatorSettings.lightningMode
			})
		},
		response=>{}),
	"loginAs": (cmd, newTab)=>{
		let searchValue = ui.searchBox.querySelector('input').value.toLowerCase().replace(t("prefix.loginAs").toLowerCase(), "")
		if(![null,undefined,""].includes(searchValue) && searchValue.length > 1) {
			ui.showLoadingIndicator()
			chrome.runtime.sendMessage({
				action:'searchLogins', apiUrl: pbiNavigator.apiUrl,
				key: pbiNavigator.sessionHash, sessionId: pbiNavigator.sessionId,
				domain: pbiNavigator.serverInstance, sessionHash: pbiNavigator.sessionHash,
				searchValue: searchValue, userId: pbiNavigator.userId
			}, success=>{
				let numberOfUserRecords = success.records.length
				ui.hideLoadingIndicator()
				if(numberOfUserRecords < 1) { ui.addError([{"message":"No user for your search exists."}]) }
				else if(numberOfUserRecords > 1) { pbiNavigator.loginAsShowOptions(success.records) }
				else {
					var userId = success.records[0].Id
					pbiNavigator.loginAsPerform(userId, newTab)
				}
			})
		}
	},
	"loginAsShowOptions": (records)=>{
		for(let i = 0; i < records.length; ++i) {
			pbiNavigator.commands["commands.loginAs." + records[i].Id] = {
				"key": "commands.loginAs." + records[i].Id,
				"userId": records[i].Id,
				"label": t("prefix.loginAs") +" "+ records[i].Name
			}
			ui.addSearchResult("commands.loginAs." + records[i].Id)
		}
		let firstEl = document.querySelector('#pbinavOutput :first-child')
		if(firstEl != null) firstEl.className = "pbinav_child pbinav_selected"
	},
	"loginAsPerform": (userId, newTab)=>{
		let targetUrl = "https://" + pbiNavigator.apiUrl + "/servlet/servlet.su?oid=" + pbiNavigator.organizationId + "&suorgadminid=" + userId + "&retURL=" + encodeURIComponent(window.location.pathname) + "&targetURL=" + encodeURIComponent(window.location.pathname) + "&"
		ui.hideSearchBox()
		if(newTab) pbiNavigator.goToUrl(targetUrl, true)
		else pbiNavigator.goToUrl(targetUrl)
		return true
	},
	"objectSetupLabelsMap": {
		"objects.details": "/Details/view",
		"objects.fieldsAndRelationships": "/FieldsAndRelationships/view",
		"objects.pageLayouts": "/PageLayouts/view",
		"objects.lightningPages": "/LightningPages/view",
		"objects.buttonsLinksActions": "/ButtonsLinksActions/view",
		"objects.compactLayouts": "/CompactLayouts/view",
		"objects.fieldSets": "/FieldSets/view",
		"objects.limits": "/Limits/view",
		"objects.recordTypes": "/RecordTypes/view",
		"objects.relatedLookupFilters": "/RelatedLookupFilters/view",
		"objects.searchLayouts": "/SearchLayouts/view",
		"objects.triggers": "/Triggers/view",
		"objects.lightningPages": "/LightningPages/view",
		"objects.validationRules": "/ValidationRules/view"
	},
	"urlMap": {
		"setup.home": {
			"lightning": "/lightning/page/home",
			"classic": "//"
		},
		"setup.setup": {
			"lightning": "",
			"classic": "/ui/setup/Setup"
		},
		"setup.objectManager": {
			"lightning": "/lightning/setup/ObjectManager/home",
			"classic": "/p/setup/custent/CustomObjectsPage?setupid=CustomObjects&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDevTools"
		},
		"setup.profiles": {
			"lightning": "/lightning/setup/Profiles/home",
			"classic": "/00e?setupid=EnhancedProfiles&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DUsers"
		},
		"setup.searchLayouts": {
			"lightning": "/lightning/setup/EinsteinSearchLayouts/home",
			"classic": "/lightning/setup/ObjectManager/ContactPointPhone/SearchLayouts/view"
		},
		"setup.recordTypes": {
			"lightning": "/lightning/setup/CollaborationGroupRecordTypes/home",
			"classic": "/lightning/setup/ObjectManager/ContactPointAddress/RecordTypes/view"
		},
		"setup.releaseUpdates": {
			"lightning": "/lightning/setup/ReleaseUpdates/home",
			"classic": "/ui/setup/releaseUpdate/ReleaseUpdatePage?setupid=ReleaseUpdates&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DAdminSetup"
		},
		"setup.users": {
			"lightning": "/lightning/setup/ManageUsers/home",
			"classic": "/005?isUserEntityOverride=1&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DUsers&setupid=ManageUsers"
		},
		"setup.roles": {
			"lightning": "/lightning/setup/Roles/home",
			"classic": "/ui/setup/user/RoleViewPage?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DUsers&setupid=Roles"
		},
		"setup.permissionSets": {
			"lightning": "/lightning/setup/PermSets/home",
			"classic": "/0PS?setupid=PermSets&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DUsers"
		},
		"setup.permissionSetGroups": {
			"lightning": "/lightning/setup/PermSetGroups/home",
			"classic": "/_ui/perms/ui/setup/PermSetGroupsPage?setupid=PermSetGroups&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DUsers"
		},    "Public Groups": {
			"lightning": "/lightning/setup/PublicGroups/home",
			"classic": "/p/own/OrgPublicGroupsPage/d?setupid=PublicGroups&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DUsers"
		},
		"setup.queues": {
			"lightning": "/lightning/setup/Queues/home",
			"classic": "/p/own/OrgQueuesPage/d?setupid=Queues&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DUsers"
		},
		"setup.loginHistory": {
			"lightning": "/lightning/setup/OrgLoginHistory/home",
			"classic": "/0Ya?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DUsers&setupid=OrgLoginHistory"
		},
		"setup.identityVerificationHistory": {
			"lightning": "/lightning/setup/VerificationHistory/home",
			"classic": "/setup/secur/VerificationHistory.apexp?setupid=VerificationHistory&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DUsers"
		},
		"setup.companyInformation": {
			"lightning": "/lightning/setup/CompanyProfileInfo/home",
			"classic": "/00D41000000f27H?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCompanyProfile&setupid=CompanyProfileInfo"
		},
		"setup.fiscalYear": {
			"lightning": "/lightning/setup/ForecastFiscalYear/home",
			"classic": "/setup/org/orgfydetail.jsp?id=00D41000000f27H&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCompanyProfile&setupid=ForecastFiscalYear"
		},
		"setup.businessHours": {
			"lightning": "/lightning/setup/BusinessHours/home",
			"classic": "/01m?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCompanyProfile&setupid=BusinessHours"
		},
		"setup.holidays": {
			"lightning": "/lightning/setup/Holiday/home",
			"classic": "/p/case/HolidayList?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCompanyProfile&setupid=Holiday"
		},
		"setup.languageSettings": {
			"lightning": "/lightning/setup/LanguageSettings/home",
			"classic": "/_ui/system/organization/LanguageSettings?setupid=LanguageSettings&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCompanyProfile"
		},
		"setup.healthCheck": {
			"lightning": "/lightning/setup/HealthCheck/home",
			"classic": "/_ui/security/dashboard/aura/SecurityDashboardAuraContainer?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSecurity&setupid=HealthCheck"
		},
		"setup.sharingSettings": {
			"lightning": "/lightning/setup/SecuritySharing/home",
			"classic": "/p/own/OrgSharingDetail?setupid=SecuritySharing&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSecurity"
		},
		"setup.fieldAccessibility": {
			"lightning": "/lightning/setup/FieldAccessibility/home",
			"classic": "/setup/layout/flslayoutjump.jsp?setupid=FieldAccessibility&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSecurity"
		},
		"setup.loginFlows": {
			"lightning": "/lightning/setup/LoginFlow/home",
			"classic": "/0Kq?setupid=LoginFlow&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSecurity"
		},
		"setup.activations": {
			"lightning": "/lightning/setup/ActivatedIpAddressAndClientBrowsersPage/home",
			"classic": "/setup/secur/identityconfirmation/ActivatedIpAddressAndClientBrowsersPage.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSecurity&setupid=ActivatedIpAddressAndClientBrowsersPage"
		},
		"setup.sessionManagement": {
			"lightning": "/lightning/setup/SessionManagementPage/home",
			"classic": "/setup/secur/session/SessionManagementPage.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSecurity&setupid=SessionManagementPage"
		},
		"setup.singleSignOnSettings": {
			"lightning": "/lightning/setup/SingleSignOn/home",
			"classic": "/_ui/identity/saml/SingleSignOnSettingsUi/d?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSecurity&setupid=SingleSignOn"
		},
		"setup.identityProvider": {
			"lightning": "/lightning/setup/IdpPage/home",
			"classic": "/setup/secur/idp/IdpPage.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSecurity&setupid=IdpPage"
		},
		"setup.viewSetupAuditTrail": {
			"lightning": "/lightning/setup/SecurityEvents/home",
			"classic": "/setup/org/orgsetupaudit.jsp?setupid=SecurityEvents&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSecurity"
		},
		"setup.delegatedAdministration": {
			"lightning": "/lightning/setup/DelegateGroups/home",
			"classic": "/ui/setup/user/DelegateGroupListPage?setupid=DelegateGroups&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSecurity"
		},
		"setup.remoteSiteSettings": {
			"lightning": "/lightning/setup/SecurityRemoteProxy/home",
			"classic": "/0rp?spl1=1&setupid=SecurityRemoteProxy&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSecurity"
		},
		"setup.cspTrustedSites": {
			"lightning": "/lightning/setup/SecurityCspTrustedSite/home",
			"classic": "/08y?spl1=1&setupid=SecurityCspTrustedSite&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSecurity"
		},
		"setup.namedCredentials": {
			"lightning": "/lightning/setup/NamedCredential/home",
			"classic": "/0XA?setupid=NamedCredential&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSecurity"
		},
		"setup.domains": {
			"lightning": "/lightning/setup/DomainNames/home",
			"classic": "/0I4?setupid=DomainNames&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDomains"
		},
		"setup.customURLs": {
			"lightning": "/lightning/setup/DomainSites/home",
			"classic": "/0Jf?setupid=DomainSites&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDomains"
		},
		"setup.myDomain": {
			"lightning": "/lightning/setup/OrgDomain/home",
			"classic": "/domainname/DomainName.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDomains&setupid=OrgDomain"
		},
		"setup.translationLanguageSettings": {
			"lightning": "/lightning/setup/LabelWorkbenchSetup/home",
			"classic": "/01h?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DLabelWorkbench&setupid=LabelWorkbenchSetup"
		},
		"setup.translate": {
			"lightning": "/lightning/setup/LabelWorkbenchTranslate/home",
			"classic": "/i18n/TranslationWorkbench.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DLabelWorkbench&setupid=LabelWorkbenchTranslate"
		},
		"setup.override": {
			"lightning": "/lightning/setup/LabelWorkbenchOverride/home",
			"classic": "/i18n/LabelWorkbenchOverride.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DLabelWorkbench&setupid=LabelWorkbenchOverride"
		},
		"setup.export": {
			"lightning": "/lightning/setup/LabelWorkbenchExport/home",
			"classic": "/i18n/TranslationExport.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DLabelWorkbench&setupid=LabelWorkbenchExport"
		},
		"setup.import": {
			"lightning": "/lightning/setup/LabelWorkbenchImport/home",
			"classic": "/i18n/TranslationImport.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DLabelWorkbench&setupid=LabelWorkbenchImport"
		},
		"setup.duplicateErrorLogs": {
			"lightning": "/lightning/setup/DuplicateErrorLog/home",
			"classic": "/075?setupid=DuplicateErrorLog&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDuplicateManagement"
		},
		"setup.duplicateRules": {
			"lightning": "/lightning/setup/DuplicateRules/home",
			"classic": "/0Bm?setupid=DuplicateRules&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDuplicateManagement"
		},
		"setup.matchingRules": {
			"lightning": "/lightning/setup/MatchingRules/home",
			"classic": "/0JD?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDuplicateManagement&setupid=MatchingRules"
		},
		"setup.dataIntegrationRules": {
			"lightning": "/lightning/setup/CleanRules/home",
			"classic": "/07i?setupid=CleanRules&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDataManagement"
		},
		"setup.dataIntegrationMetrics": {
			"lightning": "/lightning/setup/XCleanVitalsUi/home",
			"classic": "/_ui/xclean/ui/XCleanVitalsUi?setupid=XCleanVitalsUi&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDataManagement"
		},
		"setup.reportingSnapshots": {
			"lightning": "/lightning/setup/AnalyticSnapshots/home",
			"classic": "/_ui/analytics/jobs/AnalyticSnapshotSplashUi?setupid=AnalyticSnapshots&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDataManagement"
		},
		"setup.dataImportWizard": {
			"lightning": "/lightning/setup/DataManagementDataImporter/home",
			"classic": "/ui/setup/dataimporter/DataImporterAdminLandingPage?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDataManagement&setupid=DataManagementDataImporter"
		},
		"setup.salespbiNavigation": {
			"lightning": "/lightning/setup/ProjectOneAppMenu/home",
			"classic": "/setup/salesforce1AppMenu.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DMobileAdministration&setupid=ProjectOneAppMenu"
		},
		"setup.salesforceSettings": {
			"lightning": "/lightning/setup/Salesforce1Settings/home",
			"classic": "/mobile/mobileadmin/settingsMovedToConnectedApps.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSalesforce1&setupid=Salesforce1Settings"
		},
		"setup.salesforceBranding": {
			"lightning": "/lightning/setup/Salesforce1Branding/home",
			"classic": "/branding/setup/s1Branding.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSalesforce1&setupid=Salesforce1Branding"
		},
		"setup.outlookConfigurations": {
			"lightning": "/lightning/setup/EmailConfigurations/home",
			"classic": "/063?Type=E&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDesktopAdministration&setupid=EmailConfigurations"
		},
		"setup.emailToSalesforce": {
			"lightning": "/lightning/setup/EmailToSalesforce/home",
			"classic": "/email-admin/services/emailToSalesforceOrgSetup.apexp?mode=detail&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DEmailAdmin&setupid=EmailToSalesforce"
		},
		"setup.apexExceptionEmail": {
			"lightning": "/lightning/setup/ApexExceptionEmail/home",
			"classic": "/apexpages/setup/apexExceptionEmail.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DEmailAdmin&setupid=ApexExceptionEmail"
		},
		"setup.renameTabsAndLabels": {
			"lightning": "/lightning/setup/RenameTab/home",
			"classic": "/ui/setup/RenameTabPage?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DTab&setupid=RenameTab"
		},
		"setup.mapsAndLocationSettings": {
			"lightning": "/lightning/setup/MapsAndLocationServicesSettings/home",
			"classic": "/maps/mapsAndLocationSvcSettings.apexp?setupid=MapsAndLocationServicesSettings&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DMapsAndLocationServices"
		},
		"setup.taskFields": {
			"lightning": "/lightning/setup/ObjectManager/Task/FieldsAndRelationships/view",
			"classic": "/p/setup/layout/LayoutFieldList?type=Task&setupid=TaskFields&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity"
		},
		"setup.taskValidationRules": {
			"lightning": "/lightning/setup/ObjectManager/Task/ValidationRules/view",
			"classic": "/_ui/common/config/entity/ValidationFormulaListUI/d?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity&tableEnumOrId=Task&setupid=TaskValidations"
		},
		"setup.taskTriggers": {
			"lightning": "/lightning/setup/ObjectManager/Task/Triggers/view",
			"classic": "/p/setup/layout/ApexTriggerList?type=Task&setupid=TaskTriggers&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity"
		},
		"setup.taskButtons,Links,AndActions": {
			"lightning": "/lightning/setup/ObjectManager/Task/ButtonsLinksActions/view",
			"classic": "/p/setup/link/ActionButtonLinkList?pageName=Task&type=Task&setupid=TaskLinks&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity"
		},
		"setup.taskPageLayouts": {
			"lightning": "/lightning/setup/ObjectManager/Task/PageLayouts/view",
			"classic": "/ui/setup/layout/PageLayouts?type=Task&setupid=TaskLayouts&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity"
		},
		"setup.taskFieldSets": {
			"lightning": "/lightning/setup/ObjectManager/Task/FieldSets/view",
			"classic": "/_ui/common/config/entity/FieldSetListUI/d?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity&tableEnumOrId=Task&setupid=TaskFieldSets"
		},
		"setup.taskCompactLayouts": {
			"lightning": "/lightning/setup/ObjectManager/Task/CompactLayouts/view",
			"classic": "/_ui/common/config/compactlayout/CompactLayoutListUi/d?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity&type=Task&setupid=TaskCompactLayouts"
		},
		"setup.taskRecordTypes": {
			"lightning": "/lightning/setup/ObjectManager/Task/RecordTypes/view",
			"classic": "/ui/setup/rectype/RecordTypes?type=Task&setupid=TaskRecords&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity"
		},
		"setup.taskLimits": {
			"lightning": "/lightning/setup/ObjectManager/Task/Limits/view",
			"classic": "/p/setup/custent/EntityLimits?type=Task&setupid=TaskLimits&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity"
		},
		"setup.eventFields": {
			"lightning": "/lightning/setup/ObjectManager/Event/FieldsAndRelationships/view",
			"classic": "/p/setup/layout/LayoutFieldList?type=Event&setupid=EventFields&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity"
		},
		"setup.eventValidationRules": {
			"lightning": "/lightning/setup/ObjectManager/Event/ValidationRules/view",
			"classic": "/_ui/common/config/entity/ValidationFormulaListUI/d?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity&tableEnumOrId=Event&setupid=EventValidations"
		},
		"setup.eventTriggers": {
			"lightning": "/lightning/setup/ObjectManager/Event/Triggers/view",
			"classic": "/p/setup/layout/ApexTriggerList?type=Event&setupid=EventTriggers&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity"
		},
		"setup.eventPageLayouts": {
			"lightning": "/lightning/setup/ObjectManager/Event/PageLayouts/view",
			"classic": "/ui/setup/layout/PageLayouts?type=Event&setupid=EventLayouts&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity"
		},
		"setup.eventFieldSets": {
			"lightning": "/lightning/setup/ObjectManager/Event/FieldSets/view",
			"classic": "/_ui/common/config/entity/FieldSetListUI/d?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity&tableEnumOrId=Event&setupid=EventFieldSets"
		},
		"setup.eventCompactLayouts": {
			"lightning": "/lightning/setup/ObjectManager/Event/CompactLayouts/view",
			"classic": "/_ui/common/config/compactlayout/CompactLayoutListUi/d?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity&type=Event&setupid=EventCompactLayouts"
		},
		"setup.eventRecordTypes": {
			"lightning": "/lightning/setup/ObjectManager/Event/RecordTypes/view",
			"classic": "/ui/setup/rectype/RecordTypes?type=Event&setupid=EventRecords&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity"
		},
		"setup.eventLimits": {
			"lightning": "/lightning/setup/ObjectManager/Event/Limits/view",
			"classic": "/p/setup/custent/EntityLimits?type=Event&setupid=EventLimits&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity"
		},
		"setup.activityCustomFields": {
			"lightning": "/lightning/setup/ObjectManager/Activity/FieldsAndRelationships/view",
			"classic": "/p/setup/layout/LayoutFieldList?type=Activity&setupid=ActivityFields&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity"
		},
		"setup.publicCalendarsAndResources": {
			"lightning": "/lightning/setup/Calendars/home",
			"classic": "/023/s?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity&setupid=Calendars"
		},
		"setup.activitySettings": {
			"lightning": "/lightning/setup/HomeActivitiesSetupPage/home",
			"classic": "/setup/activitiesSetupPage.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DActivity&setupid=HomeActivitiesSetupPage"
		},
		"setup.autoAssociationSettings": {
			"lightning": "/lightning/setup/AutoAssociationSettings/home",
			"classic": "/p/camp/CampaignInfluenceAutoAssociationSetupUi/d?ftype=CampaignInfluence&setupid=AutoAssociationSettings&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCampaignInfluence2"
		},
		"setup.campaignInfluenceSettings": {
			"lightning": "/lightning/setup/CampaignInfluenceSettings/home",
			"classic": "/p/camp/CampaignInfluenceSetupUi/d?setupid=CampaignInfluenceSettings&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCampaignInfluence2"
		},
		"setup.leadAssignmentRules": {
			"lightning": "/lightning/setup/LeadRules/home",
			"classic": "/setup/own/entityrulelist.jsp?rtype=1&entity=Lead&setupid=LeadRules&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DLead"
		},
		"setup.leadSettings": {
			"lightning": "/lightning/setup/LeadSettings/home",
			"classic": "/_ui/sales/lead/LeadSetup/d?setupid=LeadSettings&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DLead"
		},
		"setup.leadProcesses": {
			"lightning": "/lightning/setup/LeadProcess/home",
			"classic": "/setup/ui/bplist.jsp?id=00Q&setupid=LeadProcess&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DLead"
		},
		"setup.webToLead": {
			"lightning": "/lightning/setup/LeadWebtoleads/home",
			"classic": "/lead/leadcapture.jsp?setupid=LeadWebtoleads&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DLead"
		},
		"setup.leadAutoResponseRules": {
			"lightning": "/lightning/setup/LeadResponses/home",
			"classic": "/setup/own/entityrulelist.jsp?rtype=4&entity=Lead&setupid=LeadResponses&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DLead"
		},
		"setup.accountSettings": {
			"lightning": "/lightning/setup/AccountSettings/home",
			"classic": "/accounts/accountSetup.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DAccount&setupid=AccountSettings"
		},
		"setup.notesSettings": {
			"lightning": "/lightning/setup/NotesSetupPage/home",
			"classic": "/setup/notesSetupPage.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DNotes&setupid=NotesSetupPage"
		},
		"setup.contactRolesOnOpportunities": {
			"lightning": "/lightning/setup/OpportunityRoles/home",
			"classic": "/setup/ui/picklist_masterdetail.jsp?tid=00K&pt=11&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DOpportunity&setupid=OpportunityRoles"
		},
		"setup.salesProcesses": {
			"lightning": "/lightning/setup/OpportunityProcess/home",
			"classic": "/setup/ui/bplist.jsp?id=006&setupid=OpportunityProcess&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DOpportunity"
		},
		"setup.opportunitySettings": {
			"lightning": "/lightning/setup/OpportunitySettings/home",
			"classic": "/setup/opp/oppSettings.jsp?setupid=OpportunitySettings&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DOpportunity"
		},
		"setup.pathSettings": {
			"lightning": "/lightning/setup/PathAssistantSetupHome/home",
			"classic": "/ui/setup/pathassistant/PathAssistantSetupPage?setupid=PathAssistantSetupHome&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DPathAssistant"
		},
		"setup.forecastsSettings": {
			"lightning": "/lightning/setup/Forecasting3Settings/home",
			"classic": "/_ui/sales/forecasting/ui/ForecastingSettingsPageAura?setupid=Forecasting3Settings&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DForecasting3"
		},
		"setup.forecastsHierarchy": {
			"lightning": "/lightning/setup/Forecasting3Role/home",
			"classic": "/ui/setup/forecasting/ForecastingRolePage?setupid=Forecasting3Role&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DForecasting3"
		},
		"setup.contactRolesOnCases": {
			"lightning": "/lightning/setup/CaseContactRoles/home",
			"classic": "/setup/ui/picklist_masterdetail.jsp?tid=03j&pt=45&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCase&setupid=CaseContactRoles"
		},
		"setup.caseAssignmentRules": {
			"lightning": "/lightning/setup/CaseRules/home",
			"classic": "/setup/own/entityrulelist.jsp?rtype=1&entity=Case&setupid=CaseRules&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCase"
		},
		"setup.escalationRules": {
			"lightning": "/lightning/setup/CaseEscRules/home",
			"classic": "/setup/own/entityrulelist.jsp?rtype=3&entity=Case&setupid=CaseEscRules&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCase"
		},
		"setup.supportProcesses": {
			"lightning": "/lightning/setup/CaseProcess/home",
			"classic": "/setup/ui/bplist.jsp?id=500&setupid=CaseProcess&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCase"
		},
		"setup.supportSettings": {
			"lightning": "/lightning/setup/CaseSettings/home",
			"classic": "/_ui/support/organization/SupportOrganizationSetupUi/d?setupid=CaseSettings&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCase"
		},
		"setup.caseAutoResponseRules": {
			"lightning": "/lightning/setup/CaseResponses/home",
			"classic": "/setup/own/entityrulelist.jsp?rtype=4&entity=Case&setupid=CaseResponses&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCase"
		},
		"setup.emailToCase": {
			"lightning": "/lightning/setup/EmailToCase/home",
			"classic": "/ui/setup/email/EmailToCaseSplashPage?setupid=EmailToCase&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCase"
		},
		"setup.feedFilters": {
			"lightning": "/lightning/setup/FeedFilterDefinitions/home",
			"classic": "/_ui/common/feedfilter/setup/ui/FeedFilterListPage/d?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCase&context=Case&setupid=FeedFilterDefinitions"
		},
		"setup.caseTeamRoles": {
			"lightning": "/lightning/setup/CaseTeamRoles/home",
			"classic": "/0B7?kp=500&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCaseTeams&setupid=CaseTeamRoles"
		},
		"setup.predefinedCaseTeams": {
			"lightning": "/lightning/setup/CaseTeamTemplates/home",
			"classic": "/0B4?kp=500&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCaseTeams&setupid=CaseTeamTemplates"
		},
		"setup.caseCommentTriggers": {
			"lightning": "/lightning/setup/CaseCommentTriggers/home",
			"classic": "/p/setup/layout/ApexTriggerList?type=CaseComment&setupid=CaseCommentTriggers&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCaseComment"
		},
		"setup.webToCase": {
			"lightning": "/lightning/setup/CaseWebtocase/home",
			"classic": "/cases/webtocasesetup.jsp?setupid=CaseWebtocase&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSelfService"
		},
		"setup.webToCaseHTMLGenerator": {
			"lightning": "/lightning/setup/CaseWebToCaseHtmlGenerator/home",
			"classic": "/_ui/common/config/entity/WebToCaseUi/e?setupid=CaseWebToCaseHtmlGenerator&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSelfService"
		},
		"setup.macroSettings": {
			"lightning": "/lightning/setup/MacroSettings/home",
			"classic": "/_ui/support/macros/MacroSettings/d?setupid=MacroSettings&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DMacro"
		},
		"setup.contactRolesOnContracts": {
			"lightning": "/lightning/setup/ContractContactRoles/home",
			"classic": "/setup/ui/picklist_masterdetail.jsp?tid=02a&pt=39&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DContract&setupid=ContractContactRoles"
		},
		"setup.contractSettings": {
			"lightning": "/lightning/setup/ContractSettings/home",
			"classic": "/ctrc/contractsettings.jsp?setupid=ContractSettings&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DContract"
		},
		"setup.orderSettings": {
			"lightning": "/lightning/setup/OrderSettings/home",
			"classic": "/oe/orderSettings.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DOrder&setupid=OrderSettings"
		},
		"setup.productSchedulesSettings": {
			"lightning": "/lightning/setup/Product2ScheduleSetup/home",
			"classic": "/setup/pbk/orgAnnuityEnable.jsp?setupid=Product2ScheduleSetup&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DProducts"
		},
		"setup.productSettings": {
			"lightning": "/lightning/setup/Product2Settings/home",
			"classic": "/setup/pbk/productSettings.jsp?setupid=Product2Settings&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DProducts"
		},
		"setup.assetFiles": {
			"lightning": "/lightning/setup/ContentAssets/home",
			"classic": "/03S?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DSalesforceFiles&setupid=ContentAssets"
		},
		"setup.chatterSettings": {
			"lightning": "/lightning/setup/CollaborationSettings/home",
			"classic": "/collaboration/collaborationSettings.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCollaboration&setupid=CollaborationSettings"
		},
		"setup.publisherLayouts": {
			"lightning": "/lightning/setup/GlobalPublisherLayouts/home",
			"classic": "/ui/setup/layout/PageLayouts?type=Global&setupid=GlobalPublisherLayouts&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DGlobalActions"
		},
		"setup.feedTracking": {
			"lightning": "/lightning/setup/FeedTracking/home",
			"classic": "/feeds/feedTracking.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCollaboration&setupid=FeedTracking"
		},
		"setup.emailSettings": {
			"lightning": "/lightning/setup/ChatterEmailSettings/home",
			"classic": "/_ui/core/chatter/email/ui/ChatterEmailSettings/e?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCollaboration&setupid=ChatterEmailSettings"
		},
		"setup.inboundChangeSets": {
			"lightning": "/lightning/setup/InboundChangeSet/home",
			"classic": "/changemgmt/listInboundChangeSet.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDeploy&setupid=InboundChangeSet"
		},
		"setup.outboundChangeSets": {
			"lightning": "/lightning/setup/OutboundChangeSet/home",
			"classic": "/changemgmt/listOutboundChangeSet.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDeploy&setupid=OutboundChangeSet"
		},
		"setup.feedItemLayouts": {
			"lightning": "/lightning/setup/FeedItemLayouts/home",
			"classic": "/ui/setup/layout/PageLayouts?type=FeedItem&setupid=FeedItemLayouts&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DFeedItemActionConfig"
		},
		"setup.feedItemActions": {
			"lightning": "/lightning/setup/FeedItemActions/home",
			"classic": "/p/setup/link/ActionButtonLinkList?pageName=FeedItem&type=FeedItem&setupid=FeedItemActions&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DFeedItemActionConfig"
		},
		"setup.feedCommentTriggers": {
			"lightning": "/lightning/setup/FeedCommentTriggers/home",
			"classic": "/p/setup/layout/ApexTriggerList?type=FeedComment&setupid=FeedCommentTriggers&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DFeedTriggers"
		},
		"setup.feedItemTriggers": {
			"lightning": "/lightning/setup/FeedItemTriggers/home",
			"classic": "/p/setup/layout/ApexTriggerList?type=FeedItem&setupid=FeedItemTriggers&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DFeedTriggers"
		},
		"setup.groupTriggers": {
			"lightning": "/lightning/setup/CollaborationGroupTriggers/home",
			"classic": "/p/setup/layout/ApexTriggerList?type=CollaborationGroup&setupid=CollaborationGroupTriggers&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCollaborationGroup"
		},
		"setup.groupMemberTriggers": {
			"lightning": "/lightning/setup/CollaborationGroupMemberTriggers/home",
			"classic": "/p/setup/layout/ApexTriggerList?type=CollaborationGroupMember&setupid=CollaborationGroupMemberTriggers&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCollaborationGroup"
		},
		"setup.groupRecordTriggers": {
			"lightning": "/lightning/setup/CollaborationGroupRecordTriggers/home",
			"classic": "/p/setup/layout/ApexTriggerList?type=CollaborationGroupRecord&setupid=CollaborationGroupRecordTriggers&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCollaborationGroup"
		},
		"setup.groupLayouts": {
			"lightning": "/lightning/setup/CollaborationGroupLayouts/home",
			"classic": "/ui/setup/layout/PageLayouts?type=CollaborationGroup&setupid=CollaborationGroupLayouts&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DCollaborationGroup"
		},
		"setup.topicTriggers": {
			"lightning": "/lightning/setup/TopicTriggers/home",
			"classic": "/p/setup/layout/ApexTriggerList?type=Topic&setupid=TopicTriggers&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DTopic"
		},
		"setup.topicAssignmentTriggers": {
			"lightning": "/lightning/setup/TopicAssigmentTriggers/home",
			"classic": "/p/setup/layout/ApexTriggerList?type=TopicAssignment&setupid=TopicAssigmentTriggers&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DTopic"
		},
		"setup.enhancedEmail": {
			"lightning": "/lightning/setup/EnhancedEmail/home",
			"classic": "/ui/setup/email/EnhancedEmailSetupPage?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DEmailExperience&setupid=EnhancedEmail"
		},
		"setup.individualSettings": {
			"lightning": "/lightning/setup/IndividualSettings/home",
			"classic": "/individual/individualSetup.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DIndividual&setupid=IndividualSettings"
		},
		"setup.customLabels": {
			"lightning": "/lightning/setup/ExternalStrings/home",
			"classic": "/101?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDevTools&setupid=ExternalStrings"
		},
		"setup.bigObjects": {
			"lightning": "/lightning/setup/BigObjects/home",
			"classic": "/p/setup/custent/BigObjectsPage?setupid=BigObjects&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDevTools"
		},
		"setup.picklistValueSets": {
			"lightning": "/lightning/setup/Picklists/home",
			"classic": "/_ui/platform/ui/schema/wizard/picklist/PicklistsPage?setupid=Picklists&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDevTools"
		},
		"setup.reportTypes": {
			"lightning": "/lightning/setup/CustomReportTypes/home",
			"classic": "/070?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDevTools&setupid=CustomReportTypes"
		},
		"setup.tabs": {
			"lightning": "/lightning/setup/CustomTabs/home",
			"classic": "/setup/ui/customtabs.jsp?setupid=CustomTabs&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDevTools"
		},
		"setup.globalActions": {
			"lightning": "/lightning/setup/GlobalActions/home",
			"classic": "/p/setup/link/ActionButtonLinkList?pageName=Global&type=Global&setupid=GlobalActionLinks&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DGlobalActions"
		},
		"setup.workflowRules": {
			"lightning": "/lightning/setup/WorkflowRules/home",
			"classic": "/_ui/core/workflow/WorkflowSplashUi?EntityId=WorkflowRule&setupid=WorkflowRules&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DWorkflow"
		},
		"setup.approvalProcesses": {
			"lightning": "/lightning/setup/ApprovalProcesses/home",
			"classic": "/p/process/ProcessDefinitionSetup?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DWorkflow&setupid=ApprovalProcesses"
		},
		"setup.flows": {
			"lightning": "/lightning/setup/Flows/home",
			"classic": "/300?setupid=InteractionProcesses&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DWorkflow"
		},
		"setup.tasks": {
			"lightning": "/lightning/setup/WorkflowTasks/home",
			"classic": "/_ui/core/workflow/WorkflowSplashUi?EntityId=ActionTask&setupid=WorkflowTasks&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DWorkflow"
		},
		"setup.emailAlerts": {
			"lightning": "/lightning/setup/WorkflowEmails/home",
			"classic": "/_ui/core/workflow/WorkflowSplashUi?EntityId=ActionEmail&setupid=WorkflowEmails&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DWorkflow"
		},
		"setup.fieldUpdates": {
			"lightning": "/lightning/setup/WorkflowFieldUpdates/home",
			"classic": "/_ui/core/workflow/WorkflowSplashUi?EntityId=ActionFieldUpdate&setupid=WorkflowFieldUpdates&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DWorkflow"
		},
		"setup.outboundMessages": {
			"lightning": "/lightning/setup/WorkflowOutboundMessaging/home",
			"classic": "/ui/setup/outbound/WfOutboundStatusUi?setupid=WorkflowOmStatus&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DMonitoring"
		},
		"setup.sendActions": {
			"lightning": "/lightning/setup/SendAction/home",
			"classic": "/07V?setupid=SendAction&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DWorkflow"
		},
		"setup.postTemplates": {
			"lightning": "/lightning/setup/FeedTemplates/home",
			"classic": "/07D?setupid=FeedTemplates&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DWorkflow"
		},
		"setup.processAutomationSettings": {
			"lightning": "/lightning/setup/WorkflowSettings/home",
			"classic": "/_ui/core/workflow/WorkflowSettingsUi?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DWorkflow&setupid=WorkflowSettings"
		},
		"setup.apexClasses": {
			"lightning": "/lightning/setup/ApexClasses/home",
			"classic": "/01p?retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate&setupid=ApexClasses"
		},
		"setup.apexTriggers": {
			"lightning": "/lightning/setup/ApexTriggers/home",
			"classic": "/setup/build/allTriggers.apexp?retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate&setupid=ApexTriggers"
		},
		"setup.apexTestExecution": {
			"lightning": "/lightning/setup/ApexTestQueue/home",
			"classic": "/ui/setup/apex/ApexTestQueuePage?retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate&setupid=ApexTestQueue"
		},
		"setup.apexHammerTestResults": {
			"lightning": "/lightning/setup/ApexHammerResultStatus/home",
			"classic": "/ui/setup/apex/ApexHammerResultStatusLandingPage?retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate&setupid=ApexHammerResultStatus"
		},
		"setup.api": {
			"lightning": "/lightning/setup/WebServices/home",
			"classic": "/ui/setup/sforce/WebServicesSetupPage?setupid=WebServices&retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate"
		},
		"setup.visualforceComponents": {
			"lightning": "/lightning/setup/ApexComponents/home",
			"classic": "/apexpages/setup/listApexComponent.apexp?retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate&setupid=ApexComponents"
		},
		"setup.changeDataCapture": {
			"lightning": "/lightning/setup/CdcObjectEnablement/home",
			"classic": "/ui/setup/cdc/CdcObjectEnablementPage?setupid=CdcObjectEnablement&retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate"
		},
		"setup.customPermissions": {
			"lightning": "/lightning/setup/CustomPermissions/home",
			"classic": "/0CP?setupid=CustomPermissions&retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate"
		},
		"setup.customMetadataTypes": {
			"lightning": "/lightning/setup/CustomMetadata/home",
			"classic": "/_ui/platform/ui/schema/wizard/entity/CustomMetadataTypeListPage?retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate&setupid=CustomMetadata"
		},
		"setup.customSettings": {
			"lightning": "/lightning/setup/CustomSettings/home",
			"classic": "/setup/ui/listCustomSettings.apexp?retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate&setupid=CustomSettings"
		},
		"setup.devHub": {
			"lightning": "/lightning/setup/DevHub/home",
			"classic": "/ui/setup/sfdx/SomaSetupPage?setupid=DevHub&retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate"
		},
		"setup.lightningComponents": {
			"lightning": "/lightning/setup/LightningComponentBundles/home",
			"classic": "/ui/aura/impl/setup/LightningComponentListPage?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DLightningComponents&setupid=LightningComponentBundles"
		},
		"setup.debugMode": {
			"lightning": "/lightning/setup/UserDebugModeSetup/home",
			"classic": "/ui/aura/impl/setup/UserDebugModeSetupPage?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DLightningComponents&setupid=UserDebugModeSetup"
		},
		"setup.visualforcePages": {
			"lightning": "/lightning/setup/ApexPages/home",
			"classic": "/apexpages/setup/listApexPage.apexp?retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate&setupid=ApexPages"
		},
		"setup.platformCache": {
			"lightning": "/lightning/setup/PlatformCache/home",
			"classic": "/0Er?setupid=PlatformCache&retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate"
		},
		"setup.sites": {
			"lightning": "/lightning/setup/CustomDomain/home",
			"classic": "/0DM/o?setupid=CustomDomain&retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate"
		},
		"setup.staticResources": {
			"lightning": "/lightning/setup/StaticResources/home",
			"classic": "/apexpages/setup/listStaticResource.apexp?retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate&setupid=StaticResources"
		},
		"setup.tools": {
			"lightning": "/lightning/setup/ClientDevTools/home",
			"classic": "/ui/setup/sforce/ClientDevToolsSetupPage?setupid=ClientDevTools&retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate"
		},
		"setup.externalDataSources": {
			"lightning": "/lightning/setup/ExternalDataSource/home",
			"classic": "/0XC?setupid=ExternalDataSource&retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate"
		},
		"setup.externalObjects": {
			"lightning": "/lightning/setup/ExternalObjects/home",
			"classic": "/p/setup/custent/ExternalObjectsPage?setupid=ExternalObjects&retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate"
		},
		"setup.platformEvents": {
			"lightning": "/lightning/setup/EventObjects/home",
			"classic": "/p/setup/custent/EventObjectsPage?setupid=EventObjects&retURL=%2Fsetup%2Fintegratesplash.jsp%3Fsetupid%3DDevToolsIntegrate%26retURL%3D%252Fui%252Fsetup%252FSetup%253Fsetupid%253DDevToolsIntegrate"
		},
		"setup.lightningAppBuilder": {
			"lightning": "/lightning/setup/FlexiPageList/home",
			"classic": "/_ui/flexipage/ui/FlexiPageFilterListPage?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DStudio&setupid=FlexiPageList"
		},
		"setup.installedPackages": {
			"lightning": "/lightning/setup/ImportedPackage/home",
			"classic": "/0A3?setupid=ImportedPackage&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DStudio"
		},
		"setup.packageUsage": {
			"lightning": "/lightning/setup/PackageUsageSummary/home",
			"classic": "/_ui/isvintel/ui/PackageUsageSummarySetupPage?setupid=PackageUsageSummary&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DStudio"
		},
		"setup.appExchangeMarketplace": {
			"lightning": "/lightning/setup/AppExchangeMarketplace/home",
			"classic": "/packaging/viewAEMarketplace.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DStudio&setupid=AppExchangeMarketplace"
		},
		"setup.sandboxes": {
			"lightning": "/lightning/setup/DataManagementCreateTestInstance/home",
			"classic": "/07E?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDeploy&setupid=DataManagementCreateTestInstance"
		},
		"setup.scheduledJobs": {
			"lightning": "/lightning/setup/ScheduledJobs/home",
			"classic": "/08e?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DJobs&setupid=ScheduledJobs"
		},
		"setup.apexJobs": {
			"lightning": "/lightning/setup/AsyncApexJobs/home",
			"classic": "/apexpages/setup/listAsyncApexJobs.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DJobs&setupid=AsyncApexJobs"
		},
		"setup.apexFlexQueue": {
			"lightning": "/lightning/setup/ApexFlexQueue/home",
			"classic": "/apexpages/setup/viewApexFlexQueue.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DJobs&setupid=ApexFlexQueue"
		},
		"setup.backgroundJobs": {
			"lightning": "/lightning/setup/ParallelJobsStatus/home",
			"classic": "/0Ys?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DJobs&setupid=ParallelJobsStatus"
		},
		"setup.dataExport": {
			"lightning": "/lightning/setup/DataManagementExport/home",
			"classic": "chrome-extension://aodjmnfhjibkcdimpodiifdjnnncaafh/data-export.html?host=jstart.my.salesforce.com"
		},
		"setup.pausedFlows": {
			"lightning": "/lightning/setup/Pausedflows/home",
			"classic": ""
		},
		"setup.digitalExperienceAllSites": {
			"lightning": "/lightning/setup/SetupNetworks/home",
			"classic": "/_ui/networks/setup/SetupNetworksPage?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DNetworks&setupid=SetupNetworks"
		},
		"setup.digitalExperiencePages":{
			"lightning": "/lightning/setup/CommunityFlexiPageList/home",
			"classic": "/_ui/sites/setup/ui/CommunityFlexiPageFilterListPage?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DNetworks&setupid=CommunityFlexiPageList"
		},
		"setup.digitalExperienceSettings":{
			"lightning": "/lightning/setup/NetworkSettings/home",
			"classic": "/_ui/networks/setup/NetworkSettingsPage?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DNetworks&setupid=NetworkSettings"
		},
		"setup.digitalExperienceTemplates":{
			"lightning": "/lightning/setup/CommunityTemplateDefinitionList/home",
			"classic": "/_ui/sites/setup/ui/CommunityTemplateDefinitionFilterListPage?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DNetworks&setupid=CommunityTemplateDefinitionList"
		},
		"setup.digitalExperienceThemes":{
			"lightning": "/lightning/setup/CommunityThemeDefinitionList/home",
			"classic": "/_ui/sites/setup/ui/CommunityThemeDefinitionFilterListPage?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DNetworks&setupid=CommunityThemeDefinitionList"
		},
		"setup.emailDeliverability": {
			"lightning":"/lightning/setup/OrgEmailSettings/home",
			"classic":""
		},
		"setup.emailInternationalization": {
			"lightning":"/lightning/setup/InternationalEmailAddresses/home",
			"classic":""
		},
		"setup.emailAttachments": {
			"lightning":"/lightning/setup/EmailAttachmentSettings/home",
			"classic":""
		},
		"setup.emailDisclaimers": {
			"lightning":"/lightning/setup/EmailDisclaimers/home",
			"classic":""
		},
		"setup.emailGMail": {
			"lightning":"/lightning/setup/LightningForGmailAndSyncSettings/home",
			"classic":""
		},
		"setup.emailClassicTemplates": {
			"lightning":"/lightning/setup/CommunicationTemplatesEmail/home",
			"classic":""
		},
		"setup.emailClassicLetterheads": {
			"lightning":"/lightning/setup/CommunicationTemplatesLetterheads/home",
			"classic":""
		},
		"setup.emailFilterEmailTracking": {
			"lightning":"/lightning/setup/FilterEmailTracking/home",
			"classic":""
		},
		"setup.emailOutlookSync": {
			"lightning":"/lightning/setup/LightningForOutlookAndSyncSettings/home",
			"classic":""
		},
		"setup.emailExternalService": {
			"lightning":"/lightning/setup/EmailTransportServiceSetupPage/home",
			"classic":""
		},
		"setup.emailTestDeliverability": {
			"lightning":"/lightning/setup/TestEmailDeliverability/home",
			"classic":""
		},
	}
}