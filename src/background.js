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
	const standardHeaders = {"headers": {"Authorization": "Bearer " + request.accessToken, "Accept": "application/json"}}
	switch(request.action) {
		case "goToUrl":
			goToUrl(request.url, request.newTab, request.settings)
			break
		case "init":
			let apiUrl = "https://api.powerbi.com/v1.0/myorg"
			try {
				(async ()=>{
					let data = {"dataflows": {}, "datasets": {}}
					data["workspaces"] = await fetch(`${apiUrl}/groups`, standardHeaders).then(w=>w.json()).then(w=>w.value).catch(e=>{ sendResponse(e); return false })
					if(data["workspaces"]) {
						for (let i = data["workspaces"].length - 1; i >= 0; i--) {
							let w = data["workspaces"][i]
							data["dataflows"][w.id] = await fetch(`${apiUrl}/groups/${w.id}/dataflows`, standardHeaders).then(d=>d.json()).then(d=>d.value)
							data["datasets"][w.id] = await fetch(`${apiUrl}/groups/${w.id}/datasets`, standardHeaders).then(d=>d.json()).then(d=>d.value)
						}
						let commands = []
						data["workspaces"].forEach(w=>{
							commands.push({ "label": w.name, "key": `workspace.${w.id}`, "url": `https://app.powerbi.com/groups/${w.id}/list?experience=power-bi` })
							data["datasets"][w.id].forEach(d=>commands.push({ "label": `${w.name} > ${d.name}`, "key": `dataset.${d.id}`, "url": d.webUrl }))
							data["dataflows"][w.id].forEach(d=>commands.push({ "label": `${w.name} > ${d.name}`, "key": `dataflow.${d.objectId}`, "url": `https://app.powerbi.com/groups/${w.id}/dataflows/${d.objectId}?experience=power-bi` }))
						})
						sendResponse(commands)
					}
				})()
				return true
			} catch(e) {
				console.error(e)
				sendResponse(e)
			}
			break
		case 'getSessionData':
			if(SessionData[request.accessToken] == null || request.force)
				pbiNavigator.getHTTP(request.apiUrl + "/metadata/app?preferReadOnlySession=true&cmd=home", "json",
					{"Authorization": "Bearer " + request.accessToken, "Accept": "application/json"})
					.then(response => {
						console.log("session", response)
						SessionData[request.accessToken] = response
						sendResponse(SessionData[request.accessToken])
					}).catch(e=>_d(e))
			else
				sendResponse(SessionData[request.accessToken])
			break
		case 'getFolders':
			if(SessionData[request.accessToken] == null || request.force)
				pbiNavigator.getHTTP(request.apiUrl + "/metadata/dataDomains/folders", "json",
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