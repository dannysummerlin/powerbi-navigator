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
		const logoURL = chrome.extension.getURL("images/pbi-navigator128.png")
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
			// disabling this for now since keys just contain IDs, not anything meaningful to search... maybe something later though
			// const comboSearch = (key + '|' + label).toLowerCase()
			const comboSearch = label.toLowerCase()
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
		const icon = key.replace(/\..+/,"")
		if(pbiNavigator.supportedIcons.includes(icon)) {
			r.setAttribute("data-icon", icon)
			r.setAttribute("title", icon)
			let iconBox = document.createElement("div")
			iconBox.classList.add("pbIcon")
			r.appendChild(iconBox)
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
	"debug": false,
	"language": "en-US",
	"availableThemes": ["Default", "Dark", "Unicorn", "Solarized"],
	"changeDictionary": (newLanguage) => lisan.add(require("./languages/" + newLanguage + ".js")),
	"setTheme": (command)=>{
		const newTheme = "theme-" + command.replace('commands.themes','').toLowerCase()
		document.getElementById('pbinavStyleBox').classList = [newTheme]
		pbiNavigatorSettings.set("theme", newTheme)
	},
	"settingsOnly": ()=>JSON.parse(JSON.stringify(pbiNavigatorSettings)),
	"set": (key, value)=>{ let s={}; s[key]=value; chrome.storage.sync.set(s, response=>pbiNavigator.refreshAndClear()) },
	"echo": (v)=>console.log('echo',v),
	"loadSettings": ()=>{
		chrome.storage.sync.get(pbiNavigatorSettings, settings=>{
			for(const k in settings) { pbiNavigatorSettings[k] = settings[k] }
			if(pbiNavigatorSettings.theme)
				document.getElementById('pbinavStyleBox').classList = [pbiNavigatorSettings.theme]
		})
	}
}

export const pbiNavigator = {
	"accessToken": null,
	"loaded": false,
	"listPosition": -1,
	"ctrlKey": false,
	"debug": false,
	"resources": ["workspace", "dataflow", "dataset"],
	"resourceCaches": {},
	"newTabKeys": [ "ctrl+enter", "command+enter", "shift+enter" ],
	"supportedIcons": [],
	"baseCommands": Array(
		"commands.home",
		"commands.settings",
		"commands.admin",
		"commands.help",
		"commands.refreshMetadata",
		"commands.dumpDebug",
		"commands.setSearchLimit"
	),
	"commands": null,
	"init": (sessionData)=>{
		try {
			if(!pbiNavigator.accessToken)
				pbiNavigator.accessToken = sessionData.powerBIAccessToken
			ui.showLoadingIndicator()
			pbiNavigator.supportedIcons = [...resources]
			resources.forEach(r=>( pbiNavigator.resourceCaches[r] = new Set() ))
			pbiNavigator.commands = new Map()
			document.onkeyup = (ev)=>{ window.ctrlKey = ev.ctrlKey }
			document.onkeydown = (ev)=>{ window.ctrlKey = ev.ctrlKey }
			pbiNavigatorSettings.loadSettings()
			lisan.setLocaleName(pbiNavigatorSettings.language)
			pbiNavigator.baseCommands.forEach(c=>{pbiNavigator.commands[c] = {"key": c}})
			pbiNavigatorSettings.availableThemes.forEach(th=>pbiNavigator.commands["commands.themes" + th] = { "key": "commands.themes" + th })
			Object.keys(pbiNavigator.urlMap).forEach(c=>{pbiNavigator.commands[c] = {
				"key": c,
				"url": pbiNavigator.urlMap[c],
				"label": [t("prefix.setup"), t(c)].join(" > ")
			}})
			ui.showLoadingIndicator()
			chrome.runtime.sendMessage({ "action": "init", "accessToken": pbiNavigator.accessToken }, response=>{
				if(response && response.error) { console.error("response", response, chrome.runtime.lastError); return }
				// just handing off for now, trying to do the command loading async
				try { return true }
				catch(e) { _d([e, response]) }
			})
			pbiNavigator.loadCommands()
			ui.createBox()
			ui.bindShortcuts()
		} catch(e) {
			console.info('err',e)
			if(pbiNavigatorSettings.debug) console.error(e)
		}
	},
	"loadCommands": ()=>{
		pbiNavigator.resourceCaches.forEach(r=>r.forEach( pbiNavigator.resourceCaches[r].forEach(c=>pbiNavigator.commands[c.key] = c) ))
		ui.hideLoadingIndicator()
	},
	"invokeCommand": (command, newTab, event)=>{
		if(!command) { return false }
		let targetUrl
		if(typeof command != "object") command = {"key": command}
		if(typeof pbiNavigator.commands[command.key] != 'undefined' && pbiNavigator.commands[command.key].url) {
			targetUrl = pbiNavigator.commands[command.key].url
		}
		if(command.key.startsWith("commands.themes")) {
			pbiNavigatorSettings.setTheme(command.key)
			return true
		}
		switch(command.key) {
			case "commands.refreshMetadata":
				pbiNavigator.refreshAndClear()
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
			case "commands.search":
				targetUrl = "https://app.powerbi.com/search?experience=power-bi&searchQuery=" + encodeURI(ui.quickSearch.value.substring(1).trim())
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
	"getHTTP": (getUrl, type = "json", headers = {}, data = {}, method = "GET") => {
		let request = { method: method, headers: headers }
		if(Object.keys(data).length > 0)
			request.body = JSON.stringify(data)
		return fetch(getUrl, request).then(response => {
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
		pbiNavigator.init()
		document.getElementById("pbinavQuickSearch").value = ""
	},
// going with different iteration of loading
	// "loadCommands": (settings, force = false) => {
	// 	if([pbiNavigator.accessToken].includes(null))
	// 		return pbiNavigator.init()
	// 	if(force || Object.keys(pbiNavigator.commands).length === 0)
	// 		pbiNavigator.resetCommands()
	// 	chrome.runtime.sendMessage(
	// 		Object.assign(options, {"action": "getWorkspaces"}),
	// 		response=>Object.assign(pbiNavigator.commands, response)
	// 	)
	// 	ui.hideLoadingIndicator()
	// },
	"goToUrl": (url, newTab, settings)=>chrome.runtime.sendMessage({
			action: "goToUrl",
			url: url,
			newTab: newTab,
			settings: Object.assign(pbiNavigatorSettings.settingsOnly())
		},
		response=>{}),
	"urlMap": {
		"command.settings": "https://app.powerbi.com/user/user-settings/general?experience=power-bi",
		"command.admin": "https://app.powerbi.com/admin-portal/tenantSettings?experience=power-bi",
		"command.home": "https://app.powerbi.com/",
	}
}