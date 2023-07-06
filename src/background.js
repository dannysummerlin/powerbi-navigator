import { pbiNavigator, pbiNavigatorSettings, _d } from "./shared"
import { t } from "lisan"
const SessionData = {}
const showElement = (element)=>{
	chrome.tabs.query({currentWindow: true, active: true}, (tabs)=>{
		switch(element) {
			case "searchBox":
				chrome.tabs.executeScript(tabs[0].id, {code: `
					if(document.getElementById("pbinavSearchBox")) {
						document.getElementById("pbinavSearchBox").style.zIndex = 9999
						document.getElementById("pbinavSearchBox").style.opacity = 0.98
						document.getElementById("pbinavQuickSearch").focus()
					}
				`})
				break
		}
	})
}
const parseSessionData = (data, url, settings = {})=>{
	if (data.length == 0 || typeof data.sobjects == "undefined") return false
	let mapKeys = Object.keys(pbiNavigator.objectSetupLabelsMap)
	return data.sobjects.reduce((commands, { labelPlural, label, name, keyPrefix }) => {
		if (!keyPrefix || skipObjects.includes(keyPrefix)) { return commands }
		let baseUrl = ""
		if (pbiNavigatorSettings.lightningMode && name.endsWith("__mdt")) { baseUrl += "/lightning/setup/CustomSessionData/page?address=" }
		commands[keyPrefix + ".list"] = {
			"key": keyPrefix + ".list",
			"url": `${baseUrl}/${keyPrefix}`,
			"label": t("prefix.list") + " " + labelPlural
		}
		commands[keyPrefix + ".new"] = {
			"key": keyPrefix + ".new",
			"url": `${baseUrl}/${keyPrefix}/e`,
			"label": t("prefix.new") + " " + label
		}
		if(pbiNavigatorSettings.lightningMode) {
			let targetUrl = url + "/lightning/setup/ObjectManager/" + name
			mapKeys.forEach(key=>{
				commands[keyPrefix + "." + key] = {
					"key": keyPrefix + "." + key,
					"url": targetUrl + pbiNavigator.objectSetupLabelsMap[key],
					"label": [t("prefix.setup"), label, t(key)].join(" > ")
				}
			})
		} else {
			// TODO maybe figure out how to get the url for Classic
			commands[t("prefix.setup") + label] = { "url": keyPrefix, "key": key}
		}
		return commands
	}, {})
}

const goToUrl = (targetUrl, newTab, settings = {})=>{
	chrome.tabs.query({currentWindow: true, active: true}, (tabs)=>{
		const re = new RegExp("\\w+-extension:\/\/"+chrome.runtime.id,"g");
		targetUrl = targetUrl.replace(re,'')
		let newUrl = targetUrl.match(/.*?\.com(.*)/)
		newUrl = newUrl ? newUrl[1] : targetUrl
		if(!targetUrl.includes('-extension:'))
			newUrl = tabs[0].url.match(/.*?\.com/)[0] + newUrl
		else
			newUrl = targetUrl
		if(newTab)
			chrome.tabs.create({ "active": false, "url": newUrl })
		else
			chrome.tabs.update(tabs[0].id, { "url": newUrl })
	})
}

chrome.commands.onCommand.addListener((command)=>{
	switch(command) {
		case 'showSearchBox': showElement("searchBox"); break
	}
})
chrome.runtime.onMessage.addListener((request, sender, sendResponse)=>{
	var orgKey = request.key !== null ? request.key?.split('!')[0] : request.key
	switch(request.action) {
		case "goToUrl":
			goToUrl(request.url, request.newTab, request.settings)
			break
		case "getApiSessionId":
			if (request.key === null) { sendResponse({ "error": "Must include orgId" }); return }
			request.sid = request.uid = request.domain = ""
			chrome.cookies.getAll({}, (all)=>{
				all.forEach((c)=>{
					if(c.domain.includes("salesforce.com") && c.value.includes(request.key) && c.name === "sid") {
						request.sid = c.value
						request.domain = c.domain
					}
				})
				if(request.sid === "") { sendResponse({error: "No session data found for " + request.key}); return }
				pbiNavigator.getHTTP("https://" + request.domain + '/services/data/' + pbiNavigator.apiVersion, "json",
					{"Authorization": "Bearer " + request.sid, "Accept": "application/json"}
				).then(response => {
					if(response?.identity) {
						request.uid = response.identity.match(/005.*/)[0]
						sendResponse({sessionId: request.sid, userId: request.uid, apiUrl: request.domain})
					}
					else sendResponse({error: "No user data found for " + request.key})
				})
			})
			break
		case 'getSessionData':
			if(SessionData[request.sessionHash] == null || request.force)
				pbiNavigator.getHTTP("https://" + request.apiUrl + "/powerbi/metadata/app?preferReadOnlySession=true", "json",
					{"Authorization": "Bearer " + request.sessionId, "Accept": "application/json"})
					.then(response => {
						SessionData[request.sessionHash] = response // parseSessionData(response, request.domain, request.settings)
						sendResponse(SessionData[request.sessionHash])
					}).catch(e=>_d(e))
			else
				sendResponse(SessionData[request.sessionHash])
			break
	}
	return true
})