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
	switch(request.action) {
		case "goToUrl":
			goToUrl(request.url, request.newTab, request.settings)
			break
		case 'getSessionData':
			if(SessionData[request.accessToken] == null || request.force)
				pbiNavigator.getHTTP(request.apiUrl + "/metadata/app?preferReadOnlySession=true&cmd=home", "json",
					{"Authorization": "Bearer " + request.accessToken, "Accept": "application/json"})
					.then(response => {
						console.log(response.folders)
						SessionData[request.accessToken] = response
						sendResponse(SessionData[request.accessToken])
					}).catch(e=>_d(e))
			else
				sendResponse(SessionData[request.accessToken])
			break
	}
	return true
})